-- VRUTSA FOUNDATION — permission helpers, business rules and Row Level Security.
-- Every rule here is enforced by the database, so the website, a future mobile
-- app and any script all get the same answer.

-- ───────────────────────── Permission helpers ─────────────────────────
create function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles
                 where user_id = auth.uid() and role_key = 'super_admin' and is_active)
$$;

create function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles ur join roles r on r.key = ur.role_key
                 where ur.user_id = auth.uid() and ur.is_active and r.can_manage)
$$;

create function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles ur join roles r on r.key = ur.role_key
                 where ur.user_id = auth.uid() and ur.is_active and (r.can_manage or r.can_contribute))
$$;

-- d = null means "foundation-wide", which only global roles may touch.
create function public.can_manage_district(d uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles ur join roles r on r.key = ur.role_key
    where ur.user_id = auth.uid() and ur.is_active and r.can_manage and (
      r.scope = 'global'
      or (r.scope = 'state'    and d is not null and ur.state_id = (select state_id from districts where id = d))
      or (r.scope = 'district' and d is not null and ur.district_id = d)))
$$;

create function public.can_contribute_district(d uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from user_roles ur join roles r on r.key = ur.role_key
    where ur.user_id = auth.uid() and ur.is_active and (r.can_manage or r.can_contribute) and (
      r.scope = 'global'
      or (r.scope = 'state'    and d is not null and ur.state_id = (select state_id from districts where id = d))
      or (r.scope = 'district' and d is not null and ur.district_id = d)))
$$;

-- ───────────────────────── Sign-up: create the profile ─────────────────────────
-- Roles are never read from sign-up data, so nobody can register as an admin.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, phone)
  values (new.id, new.email,
          nullif(left(new.raw_user_meta_data->>'full_name', 120), ''),
          nullif(left(new.raw_user_meta_data->>'phone', 20), ''))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Publishing workflow ─────────────────────────
-- foundation_settings.publish_mode: 'immediate' | 'approval' | 'draft'
create function public.enforce_publish_workflow() returns trigger
language plpgsql security definer set search_path = public as $$
declare mode text;
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then new.created_by := auth.uid();
    else new.created_by := old.created_by; end if;

    if new.publish_status = 'published'
       and (tg_op = 'INSERT' or old.publish_status <> 'published')
       and not is_super_admin() then
      if not can_manage_district(new.district_id) then
        new.publish_status := 'pending';              -- volunteers always go through approval
      else
        select value into mode from foundation_settings where key = 'publish_mode';
        if coalesce(mode, 'approval') = 'approval' then new.publish_status := 'pending';
        elsif mode = 'draft' then new.publish_status := 'draft';
        end if;
      end if;
    end if;
  end if;

  if new.publish_status = 'published' and new.published_at is null then
    new.published_at := now();
    new.published_by := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger activities_publish before insert or update on public.activities
  for each row execute function public.enforce_publish_workflow();
create trigger events_publish before insert or update on public.events
  for each row execute function public.enforce_publish_workflow();

-- ───────────────────────── Appointments grant / revoke the matching role ─────────────────────────
create function public.sync_appointment_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE','DELETE') and old.user_id is not null then
    update user_roles set is_active = false
     where user_id = old.user_id and role_key = old.role_key
       and state_id is not distinct from old.state_id
       and district_id is not distinct from old.district_id;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    new.updated_at := now();
    if tg_op = 'INSERT' then new.appointed_by := auth.uid(); end if;
    if new.user_id is not null and new.status = 'active' then
      insert into user_roles (user_id, role_key, state_id, district_id, is_active, assigned_by)
      values (new.user_id, new.role_key, new.state_id, new.district_id, true, auth.uid())
      on conflict (user_id, role_key,
                   coalesce(state_id, '00000000-0000-0000-0000-000000000000'),
                   coalesce(district_id, '00000000-0000-0000-0000-000000000000'))
      do update set is_active = true;
    end if;
    return new;
  end if;
  return old;
end $$;
create trigger appointments_sync before insert or update or delete on public.regional_appointments
  for each row execute function public.sync_appointment_role();

-- ───────────────────────── Volunteer review ─────────────────────────
create function public.volunteer_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare r roles; d uuid;
begin
  if new.status is distinct from old.status then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  d := coalesce(new.assigned_district_id, new.district_id);
  if new.assigned_role_key is not null then
    select * into r from roles where key = new.assigned_role_key;
    -- Only the founder hands out roles that carry management rights.
    if (r.can_manage or r.key = 'super_admin') and auth.uid() is not null and not is_super_admin() then
      raise exception 'Only the founder can assign the role "%"', r.name using errcode = '42501';
    end if;
  end if;
  if auth.uid() is not null and not can_manage_district(d) then
    raise exception 'You cannot assign volunteers to that district' using errcode = '42501';
  end if;

  if new.user_id is not null then
    if new.status in ('approved','active') then
      insert into user_roles (user_id, role_key, state_id, district_id, is_active, assigned_by)
      values (new.user_id, coalesce(new.assigned_role_key, 'volunteer'),
              case when coalesce(r.scope,'district') = 'state' then new.state_id end,
              case when coalesce(r.scope,'district') = 'district' then d end, true, auth.uid())
      on conflict (user_id, role_key,
                   coalesce(state_id, '00000000-0000-0000-0000-000000000000'),
                   coalesce(district_id, '00000000-0000-0000-0000-000000000000'))
      do update set is_active = true;
    elsif new.status in ('rejected','inactive') and old.status in ('approved','active') then
      update user_roles set is_active = false
       where user_id = new.user_id and role_key = coalesce(old.assigned_role_key, 'volunteer')
         and district_id is not distinct from coalesce(old.assigned_district_id, old.district_id);
    end if;
  end if;
  return new;
end $$;
create trigger volunteer_review before update on public.volunteer_applications
  for each row execute function public.volunteer_review();

-- ───────────────────────── Public form throttle (per email, per hour) ─────────────────────────
create function public.throttle_public_form() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  execute format('select count(*) from %I where lower(email) = lower($1) and created_at > now() - interval ''1 hour''', tg_table_name)
    into n using new.email;
  if n >= 5 then
    raise exception 'Too many submissions. Please try again later.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger throttle before insert on public.donation_submissions   for each row execute function public.throttle_public_form();
create trigger throttle before insert on public.volunteer_applications for each row execute function public.throttle_public_form();
create trigger throttle before insert on public.event_registrations    for each row execute function public.throttle_public_form();

-- ───────────────────────── Donation verification (founder only) ─────────────────────────
create function public.verify_donation(p_id uuid, p_note text default null)
returns public.donation_receipts
language plpgsql security definer set search_path = public as $$
declare rec donation_receipts;
begin
  if auth.uid() is not null and not is_super_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  update donation_submissions set status = 'verified' where id = p_id and status = 'pending';
  if not found then raise exception 'This donation is not pending verification'; end if;
  insert into donation_verifications (submission_id, action, note, verified_by)
  values (p_id, 'verified', p_note, auth.uid());
  insert into donation_receipts (submission_id, issued_by) values (p_id, auth.uid()) returning * into rec;
  return rec;
end $$;

create function public.reject_donation(p_id uuid, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_super_admin() then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  update donation_submissions set status = 'rejected' where id = p_id and status = 'pending';
  if not found then raise exception 'This donation is not pending verification'; end if;
  insert into donation_verifications (submission_id, action, note, verified_by)
  values (p_id, 'rejected', p_note, auth.uid());
end $$;

-- ───────────────────────── Audit trail ─────────────────────────
create function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare o jsonb; n jsonb; diff jsonb; rid text;
begin
  if tg_op <> 'INSERT' then o := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then n := to_jsonb(new); end if;
  rid := coalesce(n->>'id', o->>'id', n->>'key', o->>'key');
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, jsonb_build_array(o->k, n->k)) into diff
      from jsonb_object_keys(n) k
     where n->k is distinct from o->k and k not in ('updated_at');
    if diff is null then return new; end if;
  else
    diff := coalesce(n, o);
  end if;
  insert into audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), lower(tg_op), tg_table_name, rid, diff);
  return coalesce(new, old);
end $$;

create trigger audit after insert or update or delete on public.user_roles            for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.regional_appointments for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.roles                 for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.states                for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.districts             for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.activities            for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.events                for each row execute function public.audit_row();
create trigger audit after insert or update or delete on public.foundation_settings   for each row execute function public.audit_row();
create trigger audit after update or delete on public.donation_submissions            for each row execute function public.audit_row();
create trigger audit after insert on public.donation_verifications                    for each row execute function public.audit_row();
create trigger audit after insert or update on public.donation_receipts               for each row execute function public.audit_row();
create trigger audit after update or delete on public.volunteer_applications          for each row execute function public.audit_row();

-- ───────────────────────── Public view of leadership ─────────────────────────
-- The base table is staff-only. The public reads this view, which hides contact
-- details unless show_contact is switched on for that person.
create view public.public_appointments as
  select a.id, a.role_key, r.name as role_name, r.rank as role_rank, a.state_id, a.district_id,
         a.full_name, a.designation, a.photo_url, a.bio, a.responsibilities, a.appointed_on,
         case when a.show_contact then a.email end as email,
         case when a.show_contact then a.phone end as phone
    from public.regional_appointments a join public.roles r on r.key = a.role_key
   where a.is_public and a.status = 'active' and r.show_in_network;
grant select on public.public_appointments to anon, authenticated;

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.roles                    enable row level security;
alter table public.states                   enable row level security;
alter table public.districts                enable row level security;
alter table public.profiles                 enable row level security;
alter table public.user_roles               enable row level security;
alter table public.regional_appointments    enable row level security;
alter table public.categories               enable row level security;
alter table public.hero_slides              enable row level security;
alter table public.events                   enable row level security;
alter table public.activities               enable row level security;
alter table public.activity_media           enable row level security;
alter table public.volunteer_applications   enable row level security;
alter table public.event_registrations      enable row level security;
alter table public.donation_submissions     enable row level security;
alter table public.donation_verifications   enable row level security;
alter table public.donation_receipts        enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_queue       enable row level security;
alter table public.notification_logs        enable row level security;
alter table public.audit_logs               enable row level security;
alter table public.foundation_settings      enable row level security;

-- Reference data: everyone reads, founder writes.
create policy read_all   on public.roles       for select using (true);
create policy write_sa   on public.roles       for all to authenticated using (is_super_admin()) with check (is_super_admin());
create policy read_all   on public.states      for select using (true);
create policy write_sa   on public.states      for all to authenticated using (is_super_admin()) with check (is_super_admin());
create policy read_all   on public.districts   for select using (true);
create policy write_sa   on public.districts   for all to authenticated using (is_super_admin()) with check (is_super_admin());
create policy read_all   on public.categories  for select using (true);
create policy write_sa   on public.categories  for all to authenticated using (is_super_admin()) with check (is_super_admin());
create policy read_all   on public.hero_slides for select using (true);
create policy write_sa   on public.hero_slides for all to authenticated using (is_super_admin()) with check (is_super_admin());

create policy read_public on public.foundation_settings for select using (is_public or is_super_admin());
create policy write_sa    on public.foundation_settings for all to authenticated using (is_super_admin()) with check (is_super_admin());

-- Profiles: yourself; managers see people in districts they manage.
create policy read_own  on public.profiles for select to authenticated
  using (id = auth.uid() or is_super_admin() or (district_id is not null and can_manage_district(district_id)));
create policy update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Roles held by users: only the founder grants or revokes.
create policy read_roles on public.user_roles for select to authenticated
  using (user_id = auth.uid() or is_super_admin() or (district_id is not null and can_manage_district(district_id)));
create policy write_sa on public.user_roles for all to authenticated using (is_super_admin()) with check (is_super_admin());

-- Appointments: only the founder appoints, changes or removes.
create policy read_staff on public.regional_appointments for select to authenticated
  using (is_super_admin() or can_manage_district(district_id) or user_id = auth.uid());
create policy write_sa on public.regional_appointments for all to authenticated using (is_super_admin()) with check (is_super_admin());

-- Activities & events: public sees published; staff work inside their own district only.
create policy read_activities on public.activities for select
  using (publish_status = 'published' or created_by = auth.uid() or can_contribute_district(district_id));
create policy insert_activities on public.activities for insert to authenticated
  with check (can_contribute_district(district_id));
create policy update_activities on public.activities for update to authenticated
  using (can_manage_district(district_id) or (created_by = auth.uid() and publish_status <> 'published'))
  with check (can_manage_district(district_id) or (created_by = auth.uid() and can_contribute_district(district_id) and publish_status <> 'published'));
create policy delete_activities on public.activities for delete to authenticated
  using (can_manage_district(district_id));

create policy read_events on public.events for select
  using (publish_status = 'published' or created_by = auth.uid() or can_contribute_district(district_id));
create policy insert_events on public.events for insert to authenticated
  with check (can_manage_district(district_id));
create policy update_events on public.events for update to authenticated
  using (can_manage_district(district_id)) with check (can_manage_district(district_id));
create policy delete_events on public.events for delete to authenticated
  using (can_manage_district(district_id));

create policy read_media on public.activity_media for select using (true);
create policy write_media on public.activity_media for all to authenticated
  using (
    (activity_id is not null and exists (select 1 from activities a where a.id = activity_id
        and (can_manage_district(a.district_id) or (a.created_by = auth.uid() and a.publish_status <> 'published'))))
    or (event_id is not null and exists (select 1 from events e where e.id = event_id and can_manage_district(e.district_id))))
  with check (
    (activity_id is not null and exists (select 1 from activities a where a.id = activity_id
        and (can_manage_district(a.district_id) or (a.created_by = auth.uid() and a.publish_status <> 'published'))))
    or (event_id is not null and exists (select 1 from events e where e.id = event_id and can_manage_district(e.district_id))));

-- Volunteer applications: anyone may apply; applicants see their own; managers see their district.
create policy apply on public.volunteer_applications for insert
  with check (status = 'submitted' and (user_id is null or user_id = auth.uid())
              and assigned_role_key is null and reviewed_by is null);
create policy read_applications on public.volunteer_applications for select to authenticated
  using (user_id = auth.uid() or can_manage_district(district_id) or can_manage_district(assigned_district_id));
create policy review_applications on public.volunteer_applications for update to authenticated
  using (can_manage_district(district_id) or can_manage_district(assigned_district_id))
  with check (can_manage_district(district_id) or can_manage_district(assigned_district_id));
create policy delete_sa on public.volunteer_applications for delete to authenticated using (is_super_admin());

create policy register on public.event_registrations for insert
  with check ((user_id is null or user_id = auth.uid())
              and exists (select 1 from events e where e.id = event_id and e.publish_status = 'published'
                          and e.registration_mode = 'form' and not e.is_cancelled));
create policy read_registrations on public.event_registrations for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from events e where e.id = event_id and can_manage_district(e.district_id)));
create policy delete_registrations on public.event_registrations for delete to authenticated
  using (exists (select 1 from events e where e.id = event_id and can_manage_district(e.district_id)));

-- Donations: anyone may submit a confirmation; only the founder reads the ledger.
-- Status changes go through verify_donation() / reject_donation() only.
create policy submit on public.donation_submissions for insert
  with check (status = 'pending' and (user_id is null or user_id = auth.uid()));
create policy read_donations on public.donation_submissions for select to authenticated
  using (is_super_admin() or user_id = auth.uid());
create policy delete_sa on public.donation_submissions for delete to authenticated using (is_super_admin());

create policy read_sa on public.donation_verifications for select to authenticated using (is_super_admin());
create policy read_receipts on public.donation_receipts for select to authenticated
  using (is_super_admin() or exists (select 1 from donation_submissions s where s.id = submission_id and s.user_id = auth.uid()));
create policy update_sa on public.donation_receipts for update to authenticated using (is_super_admin()) with check (is_super_admin());

-- Notifications & audit: founder reads. Rows are written by triggers and the server worker.
create policy read_sa   on public.notification_queue for select to authenticated using (is_super_admin());
create policy update_sa on public.notification_queue for update to authenticated using (is_super_admin()) with check (is_super_admin());
create policy read_sa   on public.notification_logs  for select to authenticated using (is_super_admin());
create policy insert_sa on public.notification_logs  for insert to authenticated with check (is_super_admin());
create policy read_sa   on public.notification_preferences for select to authenticated using (is_super_admin());
create policy read_sa   on public.audit_logs for select to authenticated using (is_super_admin());

-- Internal helpers are not callable by the public API roles.
revoke execute on function public.handle_new_user(), public.enforce_publish_workflow(), public.sync_appointment_role(),
  public.volunteer_review(), public.throttle_public_form(), public.audit_row() from public, anon, authenticated;
revoke execute on function public.verify_donation(uuid, text), public.reject_donation(uuid, text) from public, anon;
grant  execute on function public.verify_donation(uuid, text), public.reject_donation(uuid, text) to authenticated, service_role;

-- Table privileges for the API roles. Row Level Security above still decides row by row;
-- these grants only make the tables reachable (newer Supabase projects do not always add them automatically).
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
