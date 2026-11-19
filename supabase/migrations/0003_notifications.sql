-- VRUTSA FOUNDATION — notification queue.
-- Triggers put messages in notification_queue when something important happens.
-- The server worker (POST /api/notifications/process) sends them and writes logs.
-- Nothing is "sent" by the database itself.

create function public.enqueue_notification(
  p_channel text, p_template text, p_recipient text, p_payload jsonb, p_dedupe text, p_essential boolean default true
) returns void
language plpgsql security definer set search_path = public as $$
declare c text; pref notification_preferences;
begin
  c := lower(trim(coalesce(p_recipient, '')));
  if c = '' then return; end if;
  insert into notification_preferences (contact) values (c) on conflict (contact) do nothing;
  select * into pref from notification_preferences where contact = c;
  if not p_essential and pref.opted_out then return; end if;
  insert into notification_queue (channel, template, recipient, payload, dedupe_key, is_essential)
  values (p_channel, p_template, c, coalesce(p_payload, '{}') || jsonb_build_object('unsubscribe_token', pref.token),
          p_channel || ':' || p_dedupe, p_essential)
  on conflict (dedupe_key) do nothing;
end $$;

-- Email always; WhatsApp only with the person's opt-in.
create function public.notify_person(
  p_template text, p_email text, p_phone text, p_whatsapp boolean, p_payload jsonb, p_dedupe text, p_essential boolean default true
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform enqueue_notification('email', p_template, p_email, p_payload, p_dedupe || ':' || lower(coalesce(p_email,'')), p_essential);
  if p_whatsapp then
    perform enqueue_notification('whatsapp', p_template, p_phone, p_payload, p_dedupe || ':' || coalesce(p_phone,''), p_essential);
  end if;
end $$;

create function public.notify_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform enqueue_notification('email', 'welcome', new.email,
    jsonb_build_object('name', coalesce(new.full_name, '')), 'welcome:' || new.id);
  return new;
end $$;
create trigger notify after insert on public.profiles for each row execute function public.notify_profile();

create function public.notify_volunteer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform notify_person('volunteer_received', new.email, new.phone, new.whatsapp_opt_in,
      jsonb_build_object('name', new.full_name), 'volunteer_received:' || new.id);
  elsif new.status = 'approved' and old.status is distinct from 'approved' then
    perform notify_person('volunteer_approved', new.email, new.phone, new.whatsapp_opt_in,
      jsonb_build_object('name', new.full_name,
        'district', (select name from districts where id = coalesce(new.assigned_district_id, new.district_id))),
      'volunteer_approved:' || new.id);
  end if;
  return new;
end $$;
create trigger notify after insert or update on public.volunteer_applications
  for each row execute function public.notify_volunteer();

create function public.notify_appointment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' then
    perform notify_person('leadership_appointment', new.email, new.phone, new.whatsapp_opt_in,
      jsonb_build_object('name', new.full_name,
        'role', coalesce(new.designation, (select name from roles where key = new.role_key)),
        'area', coalesce((select name from districts where id = new.district_id),
                         (select name from states where id = new.state_id), '')),
      'appointment:' || new.id);
  end if;
  return new;
end $$;
create trigger notify after insert on public.regional_appointments
  for each row execute function public.notify_appointment();

create function public.notify_donation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform notify_person('donation_received', new.email, new.phone, new.whatsapp_opt_in,
      jsonb_build_object('name', new.donor_name, 'amount', new.amount, 'reference', new.reference, 'utr', new.utr),
      'donation_received:' || new.id);
  elsif new.status = 'rejected' and old.status = 'pending' then
    perform notify_person('donation_rejected', new.email, new.phone, new.whatsapp_opt_in,
      jsonb_build_object('name', new.donor_name, 'amount', new.amount, 'reference', new.reference,
        'note', (select note from donation_verifications where submission_id = new.id order by created_at desc limit 1)),
      'donation_rejected:' || new.id);
  end if;
  return new;
end $$;
create trigger notify after insert or update on public.donation_submissions
  for each row execute function public.notify_donation();

-- The acknowledgement goes out only after the receipt PDF exists.
create function public.notify_receipt() returns trigger
language plpgsql security definer set search_path = public as $$
declare s donation_submissions;
begin
  if new.pdf_path is not null and old.pdf_path is null then
    select * into s from donation_submissions where id = new.submission_id;
    perform notify_person('donation_acknowledgement', s.email, s.phone, s.whatsapp_opt_in,
      jsonb_build_object('name', s.donor_name, 'amount', s.amount, 'reference', s.reference,
        'receipt_no', new.receipt_no, 'pdf_path', new.pdf_path),
      'donation_ack:' || new.id);
  end if;
  return new;
end $$;
create trigger notify after update on public.donation_receipts
  for each row execute function public.notify_receipt();

create function public.notify_registration() returns trigger
language plpgsql security definer set search_path = public as $$
declare e events;
begin
  select * into e from events where id = new.event_id;
  perform notify_person('event_registration', new.email, new.phone, new.whatsapp_opt_in,
    jsonb_build_object('name', new.full_name, 'event', e.title, 'starts_at', e.starts_at, 'venue', e.venue, 'slug', e.slug),
    'event_registration:' || new.id);
  return new;
end $$;
create trigger notify after insert on public.event_registrations
  for each row execute function public.notify_registration();

-- Called from the admin panel by someone who manages the event's district.
--   'announcement' → approved volunteers of that district who agreed to be contacted (non-essential)
--   'update'       → people registered for the event (essential)
create function public.enqueue_event_notice(p_event uuid, p_kind text) returns int
language plpgsql security definer set search_path = public as $$
declare e events; n int := 0; r record; stamp text := to_char(now(), 'YYYYMMDDHH24');
begin
  select * into e from events where id = p_event;
  if e.id is null or e.publish_status <> 'published' then raise exception 'Publish the event first'; end if;
  if auth.uid() is not null and not can_manage_district(e.district_id) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if p_kind = 'announcement' then
    for r in select full_name, email, phone, whatsapp_opt_in from volunteer_applications
              where status in ('approved','active') and consent_contact
                and (e.district_id is null or coalesce(assigned_district_id, district_id) = e.district_id) loop
      perform notify_person('event_announcement', r.email, r.phone, r.whatsapp_opt_in,
        jsonb_build_object('name', r.full_name, 'event', e.title, 'starts_at', e.starts_at, 'venue', e.venue, 'slug', e.slug),
        'event_announcement:' || e.id, false);
      n := n + 1;
    end loop;
  elsif p_kind = 'update' then
    for r in select full_name, email, phone, whatsapp_opt_in from event_registrations where event_id = e.id loop
      perform notify_person('event_update', r.email, r.phone, r.whatsapp_opt_in,
        jsonb_build_object('name', r.full_name, 'event', e.title, 'starts_at', e.starts_at, 'venue', e.venue,
                           'slug', e.slug, 'cancelled', e.is_cancelled),
        'event_update:' || e.id || ':' || stamp);
      n := n + 1;
    end loop;
  else
    raise exception 'Unknown notice type';
  end if;
  return n;
end $$;

-- Worker-only functions (service role, or the founder pressing "Send queued messages").
create function public.enqueue_event_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  if auth.uid() is not null and not is_super_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  for r in select g.full_name, g.email, g.phone, g.whatsapp_opt_in, e.id, e.title, e.starts_at, e.venue, e.slug
             from event_registrations g join events e on e.id = g.event_id
            where e.publish_status = 'published' and not e.is_cancelled
              and e.starts_at between now() and now() + interval '24 hours' loop
    perform notify_person('event_reminder', r.email, r.phone, r.whatsapp_opt_in,
      jsonb_build_object('name', r.full_name, 'event', r.title, 'starts_at', r.starts_at, 'venue', r.venue, 'slug', r.slug),
      'event_reminder:' || r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Hands out a batch exactly once, even if two workers run at the same time.
create function public.claim_notifications(p_limit int default 20) returns setof public.notification_queue
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_super_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  return query
    update notification_queue q set status = 'sending', attempts = q.attempts + 1
     where q.id in (select id from notification_queue
                     where (status = 'queued' and next_attempt_at <= now())
                        or (status = 'sending' and next_attempt_at < now() - interval '15 minutes')
                     order by created_at limit p_limit for update skip locked)
    returning q.*;
end $$;

create function public.unsubscribe(p_token uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update notification_preferences set opted_out = true, updated_at = now() where token = p_token;
  return found;
end $$;

revoke execute on function public.enqueue_notification(text,text,text,jsonb,text,boolean),
  public.notify_person(text,text,text,boolean,jsonb,text,boolean),
  public.notify_profile(), public.notify_volunteer(), public.notify_appointment(), public.notify_donation(),
  public.notify_receipt(), public.notify_registration() from public, anon, authenticated;
revoke execute on function public.enqueue_event_notice(uuid,text), public.enqueue_event_reminders(),
  public.claim_notifications(int) from public, anon;
grant execute on function public.enqueue_event_notice(uuid,text), public.enqueue_event_reminders(),
  public.claim_notifications(int) to authenticated, service_role;
grant execute on function public.unsubscribe(uuid) to anon, authenticated, service_role;
-- (notification tables were created in 0001, so the grants in 0002 already cover them)
