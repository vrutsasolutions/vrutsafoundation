-- VRUTSA FOUNDATION — upgrade 2: membership, representative applications, ID cards,
-- founder-entered donations with public totals, founder alerts, announcements, slider upgrades.
-- Run after 0001–0004. Safe on a database that already has data.

-- ───────────────────────── Roles ─────────────────────────
update public.roles set name = 'District Representative' where key = 'district_president';
-- Volunteers are members, not staff: they use the member portal, not the admin panel.
update public.roles set can_contribute = false where key = 'volunteer';

-- ───────────────────────── Homepage slider ─────────────────────────
alter table public.hero_slides
  add column if not exists media_type   text not null default 'image' check (media_type in ('image','video')),
  add column if not exists cta_label    text,
  add column if not exists publish_from  timestamptz,
  add column if not exists publish_until timestamptz;

create or replace function public.limit_slides() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from hero_slides) >= 10 then
    raise exception 'The homepage slider holds at most 10 slides. Remove one first.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists limit_slides on public.hero_slides;
create trigger limit_slides before insert on public.hero_slides for each row execute function public.limit_slides();

-- ───────────────────────── Representative profiles ─────────────────────────
alter table public.regional_appointments
  add column if not exists experience     text,
  add column if not exists is_featured    boolean not null default false,
  add column if not exists featured_order int not null default 0;

drop view if exists public.public_appointments;
create view public.public_appointments as
  select a.id, a.role_key, r.name as role_name, r.rank as role_rank, a.state_id, a.district_id,
         a.full_name, a.designation, a.photo_url, a.bio, a.experience, a.responsibilities, a.appointed_on,
         a.is_featured, a.featured_order,
         case when a.show_contact then a.email end as email,
         case when a.show_contact then a.phone end as phone
    from public.regional_appointments a join public.roles r on r.key = a.role_key
   where a.is_public and a.status = 'active' and r.show_in_network;
grant select on public.public_appointments to anon, authenticated;

-- ───────────────────────── Founder alerts ─────────────────────────
insert into public.foundation_settings (key, value, is_public) values
  ('founder_notify_email', 'vrutsafoundation@gmail.com', false),
  ('founder_alerts_volunteers', 'on', false),
  ('founder_alerts_content', 'on', false)
on conflict (key) do nothing;
update public.foundation_settings set value = 'immediate' where key = 'publish_mode' and value = 'approval';

-- Operational email to the founder. Categories can be switched off in Settings.
create or replace function public.notify_founder(p_category text, p_title text, p_lines jsonb, p_key text) returns void
language plpgsql security definer set search_path = public as $$
declare addr text; sw text;
begin
  select value into addr from foundation_settings where key = 'founder_notify_email';
  select value into sw from foundation_settings where key = 'founder_alerts_' || p_category;
  if coalesce(addr, '') = '' or sw = 'off' then return; end if;
  perform enqueue_notification('email', 'founder_alert', addr,
    jsonb_build_object('title', p_title, 'lines', coalesce(p_lines, '[]'::jsonb)), 'founder:' || p_key);
end $$;

-- Operational email to the active representatives of one district. Email only, never WhatsApp.
create or replace function public.notify_district_reps(p_district uuid, p_title text, p_lines jsonb, p_key text) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if p_district is null then return; end if;
  for r in select a.id, a.email from regional_appointments a join roles ro on ro.key = a.role_key
            where a.district_id = p_district and a.status = 'active' and ro.can_manage and coalesce(a.email, '') <> '' loop
    perform enqueue_notification('email', 'rep_alert', r.email,
      jsonb_build_object('title', p_title, 'lines', coalesce(p_lines, '[]'::jsonb)), 'rep:' || r.id || ':' || p_key);
  end loop;
end $$;

-- Appointment mail: email only (WhatsApp is for volunteers), and skipped when the
-- approval flow sends its own welcome with the ID card.
create or replace function public.notify_appointment() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and coalesce(current_setting('vf.skip_appointment_mail', true), '') <> '1' then
    perform notify_person('leadership_appointment', new.email, new.phone, false,
      jsonb_build_object('name', new.full_name,
        'role', coalesce(new.designation, (select name from roles where key = new.role_key)),
        'area', coalesce((select name from districts where id = new.district_id),
                         (select name from states where id = new.state_id), '')),
      'appointment:' || new.id);
  end if;
  return new;
end $$;

-- Founder hears about district content changes made by someone else.
create or replace function public.alert_content_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare row_ jsonb; what text; actor text;
begin
  if auth.uid() is null or is_super_admin() then return coalesce(new, old); end if;
  row_ := to_jsonb(coalesce(new, old));
  if tg_op <> 'DELETE' and row_->>'publish_status' <> 'published' then return new; end if;
  what := case tg_table_name when 'activities' then 'Activity' else 'Event' end;
  select coalesce(full_name, email) into actor from profiles where id = auth.uid();
  perform notify_founder('content',
    what || ' ' || case tg_op when 'INSERT' then 'published' when 'UPDATE' then 'updated' else 'deleted' end || ': ' || (row_->>'title'),
    jsonb_build_array('By: ' || coalesce(actor, 'unknown'),
                      'District: ' || coalesce((select name from districts where id = (row_->>'district_id')::uuid), 'Foundation-wide')),
    tg_table_name || ':' || (row_->>'id') || ':' || tg_op || ':' || to_char(now(), 'YYYYMMDDHH24MI'));
  return coalesce(new, old);
end $$;
drop trigger if exists alert_founder on public.activities;
drop trigger if exists alert_founder on public.events;
create trigger alert_founder after insert or update or delete on public.activities for each row execute function public.alert_content_change();
create trigger alert_founder after insert or update or delete on public.events     for each row execute function public.alert_content_change();

-- ───────────────────────── Members (volunteers and district representatives) ─────────────────────────
create sequence if not exists public.member_v_seq;
create sequence if not exists public.member_dr_seq;

create table if not exists public.members (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid unique references public.profiles(id) on delete set null,
  member_type     text not null default 'volunteer' check (member_type in ('volunteer','district_representative')),
  membership_id   text not null unique,
  verify_token    uuid not null unique default gen_random_uuid(),   -- inside the ID card QR code
  full_name       text not null,
  email           text,
  phone           text,
  date_of_birth   date,
  gender          text,
  state_id        uuid references public.states(id) on delete set null,
  district_id     uuid references public.districts(id) on delete set null,
  city            text,
  address         text,                 -- private: member, their district representative, founder
  photo_path      text,                 -- private bucket path
  occupation      text,
  interest        text,
  skills          text,
  availability    text,
  whatsapp_opt_in boolean not null default false,
  consent_contact boolean not null default true,
  status          text not null default 'active' check (status in ('pending_email','active','suspended','removed')),
  flagged         boolean not null default false,
  status_note     text,
  joined_on       date not null default current_date,
  added_by        uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists members_district_idx on public.members (district_id, status);
create index if not exists members_created_idx  on public.members (created_at desc);
create index if not exists members_email_idx    on public.members (lower(email));
create index if not exists members_phone_idx    on public.members (phone);
create index if not exists members_name_idx     on public.members (lower(full_name) text_pattern_ops);
create index if not exists members_added_by_idx on public.members (added_by);
create index if not exists members_state_idx    on public.members (state_id);

create or replace function public.members_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.membership_id := case new.member_type
      when 'district_representative' then 'VF-DR-' || lpad(nextval('member_dr_seq')::text, 4, '0')
      else 'VF-V-' || lpad(nextval('member_v_seq')::text, 7, '0') end;
    new.verify_token := gen_random_uuid();
    -- vf.trusted_insert is set only by the registration and approval functions in this file.
    if auth.uid() is not null and coalesce(current_setting('vf.trusted_insert', true), '') <> '1' then
      new.added_by := auth.uid();
      -- A representative can add volunteers to their own district only.
      if not is_super_admin() and (new.member_type <> 'volunteer' or not can_manage_district(new.district_id)) then
        raise exception 'You can add volunteers to your own district only' using errcode = '42501';
      end if;
    end if;
    if new.state_id is null and new.district_id is not null then
      select state_id into new.state_id from districts where id = new.district_id;
    end if;
    return new;
  end if;

  new.updated_at := now();
  if auth.uid() is null or is_super_admin() then return new; end if;

  -- Identity fields never change from the browser.
  new.membership_id := old.membership_id; new.verify_token := old.verify_token;
  new.user_id := old.user_id; new.member_type := old.member_type; new.joined_on := old.joined_on;

  if old.member_type = 'volunteer' and can_manage_district(old.district_id) then
    if not can_manage_district(new.district_id) then
      raise exception 'You cannot move a volunteer to another district' using errcode = '42501';
    end if;
    return new;
  elsif old.user_id = auth.uid() then
    -- A member edits contact and interest details only.
    new.status := old.status; new.flagged := old.flagged; new.status_note := old.status_note;
    new.full_name := old.full_name; new.date_of_birth := old.date_of_birth; new.email := old.email;
    new.state_id := old.state_id; new.district_id := old.district_id; new.added_by := old.added_by;
    return new;
  end if;
  raise exception 'Not authorised' using errcode = '42501';
end $$;
drop trigger if exists members_before on public.members;
create trigger members_before before insert or update on public.members for each row execute function public.members_before();

-- Welcome + ID card, alerts to the district representative and the founder, status changes.
create or replace function public.members_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare d text; is_vol boolean; label text;
begin
  select name into d from districts where id = new.district_id;
  is_vol := new.member_type = 'volunteer';
  label := case when is_vol then 'Volunteer' else 'District Representative' end;

  if new.status = 'active' and (tg_op = 'INSERT' or old.status = 'pending_email') then
    perform notify_person(case when is_vol then 'volunteer_welcome' else 'representative_welcome' end,
      new.email, new.phone, is_vol and new.whatsapp_opt_in,
      jsonb_build_object('name', new.full_name, 'membership_id', new.membership_id, 'member_id', new.id,
                         'district', coalesce(d, ''), 'role', label),
      'member_welcome:' || new.id);
    if is_vol then
      perform notify_district_reps(new.district_id, 'New volunteer in ' || coalesce(d, 'your district') || ': ' || new.full_name,
        jsonb_build_array('Membership ID: ' || new.membership_id, 'Mobile: ' || coalesce(new.phone, 'not given'),
                          'Email: ' || coalesce(new.email, 'not given'), 'City: ' || coalesce(new.city, 'not given'),
                          'Interested in: ' || coalesce(new.interest, 'not given'),
                          'Volunteers in this district now: ' || (select count(*) from members m where m.district_id = new.district_id and m.status = 'active' and m.member_type = 'volunteer')),
        'new_volunteer:' || new.id);
      perform notify_founder('volunteers', 'New volunteer: ' || new.full_name,
        jsonb_build_array('Membership ID: ' || new.membership_id, 'District: ' || coalesce(d, 'not given')), 'new_volunteer:' || new.id);
    else
      perform notify_founder('representatives', 'District Representative account created: ' || new.full_name,
        jsonb_build_array('Membership ID: ' || new.membership_id, 'District: ' || coalesce(d, 'not given')), 'new_rep:' || new.id);
    end if;

  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and old.status <> 'pending_email' then
    perform notify_person('membership_update', new.email, new.phone, is_vol and new.whatsapp_opt_in,
      jsonb_build_object('name', new.full_name, 'membership_id', new.membership_id, 'status', new.status),
      'member_status:' || new.id || ':' || new.status || ':' || to_char(now(), 'YYYYMMDDHH24MI'));
    perform notify_founder('representatives', label || ' ' || new.status || ': ' || new.full_name,
      jsonb_build_array('Membership ID: ' || new.membership_id, 'District: ' || coalesce(d, 'not given'),
                        'Note: ' || coalesce(new.status_note, 'none')),
      'member_status:' || new.id || ':' || new.status || ':' || to_char(now(), 'YYYYMMDDHH24MI'));
    if is_vol then
      perform notify_district_reps(new.district_id, 'Volunteer ' || new.status || ': ' || new.full_name,
        jsonb_build_array('Membership ID: ' || new.membership_id, 'Note: ' || coalesce(new.status_note, 'none')),
        'member_status:' || new.id || ':' || new.status || ':' || to_char(now(), 'YYYYMMDDHH24MI'));
    elsif new.status in ('suspended','removed') and new.user_id is not null then
      -- Suspending or removing a representative takes their admin rights and public profile away.
      update regional_appointments set status = 'inactive' where user_id = new.user_id and status = 'active';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists members_after on public.members;
create trigger members_after after insert or update on public.members for each row execute function public.members_after();

drop trigger if exists audit on public.members;
create trigger audit after update or delete on public.members for each row execute function public.audit_row();

-- Builds a volunteer membership from registration details. Internal.
create or replace function public.create_volunteer(p jsonb, p_user uuid, p_email text, p_status text) returns public.members
language plpgsql security definer set search_path = public as $$
declare m members; d uuid; dob date;
begin
  if coalesce(trim(p->>'full_name'), '') = '' then raise exception 'Full name is required'; end if;
  select id into d from districts where id = nullif(p->>'district_id', '')::uuid and is_active;
  if d is null then raise exception 'Choose a district'; end if;
  begin dob := nullif(p->>'date_of_birth', '')::date; exception when others then dob := null; end;
  perform set_config('vf.trusted_insert', '1', true);
  insert into members (user_id, member_type, membership_id, full_name, email, phone, date_of_birth, gender, district_id, city, address,
                       photo_path, occupation, interest, skills, availability, whatsapp_opt_in, status)
  values (p_user, 'volunteer', '', left(trim(p->>'full_name'), 120), lower(p_email), nullif(left(p->>'phone', 20), ''), dob,
          nullif(left(p->>'gender', 30), ''), d, nullif(left(p->>'city', 80), ''), nullif(left(p->>'address', 400), ''),
          case when p->>'photo_path' ~ '^applicants/[A-Za-z0-9_-]+\.(jpg|jpeg|png)$' then p->>'photo_path' end,
          nullif(left(p->>'occupation', 120), ''), nullif(left(p->>'interest', 300), ''), nullif(left(p->>'skills', 300), ''),
          nullif(left(p->>'availability', 160), ''), coalesce((p->>'whatsapp_opt_in')::boolean, false), p_status)
  returning * into m;
  update profiles set district_id = d, state_id = m.state_id, city = coalesce(m.city, city) where id = p_user;
  return m;
end $$;

-- Sign-up: create the profile, and the volunteer membership when the visitor registered as a volunteer.
-- Sign-up data can create a volunteer membership only; it can never grant an admin role.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, phone)
  values (new.id, new.email,
          nullif(left(new.raw_user_meta_data->>'full_name', 120), ''),
          nullif(left(new.raw_user_meta_data->>'phone', 20), ''))
  on conflict (id) do nothing;
  if new.raw_user_meta_data->>'register_as' = 'volunteer' then
    begin
      perform create_volunteer(new.raw_user_meta_data, new.id, new.email,
                               case when new.email_confirmed_at is null then 'pending_email' else 'active' end);
    exception when others then
      raise warning 'volunteer membership not created for %: %', new.id, sqlerrm;  -- the portal offers the form again
    end;
  end if;
  return new;
end $$;

-- Email verified → the membership becomes active and the ID card goes out.
create or replace function public.handle_user_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update members set status = 'active' where user_id = new.id and status = 'pending_email';
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_confirmed();

-- A signed-in person without a membership joins as a volunteer.
create or replace function public.join_as_volunteer(p jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare m members; mail text;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if exists (select 1 from members where user_id = auth.uid()) then raise exception 'You are already a member'; end if;
  select email into mail from profiles where id = auth.uid();
  m := create_volunteer(p, auth.uid(), mail, 'active');
  return m.membership_id;
end $$;

-- Duplicate check for the public registration form (true = this mobile number is already registered).
create or replace function public.volunteer_phone_taken(p_phone text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where phone = p_phone and status <> 'removed')
$$;

-- Public ID verification: what the QR code on an ID card opens. No contact details, no photograph.
create or replace function public.verify_member(p_token uuid)
returns table (full_name text, membership_id text, role text, district text, state text, joined_on date, status text)
language sql stable security definer set search_path = public as $$
  select m.full_name, m.membership_id,
         case m.member_type when 'district_representative' then 'District Representative' else 'Volunteer' end,
         d.name, s.name, m.joined_on, m.status
    from members m left join districts d on d.id = m.district_id left join states s on s.id = m.state_id
   where m.verify_token = p_token and m.status <> 'pending_email'
$$;

-- A member asks for their ID card by email again (at most once a day).
create or replace function public.email_my_id_card() returns boolean
language plpgsql security definer set search_path = public as $$
declare m members;
begin
  select * into m from members where user_id = auth.uid() and status = 'active';
  if m.id is null then return false; end if;
  perform enqueue_notification('email', 'id_card', m.email,
    jsonb_build_object('name', m.full_name, 'membership_id', m.membership_id, 'member_id', m.id),
    'id_card:' || m.id || ':' || to_char(now(), 'YYYYMMDD'));
  return true;
end $$;

alter table public.members enable row level security;
drop policy if exists read_members on public.members;
drop policy if exists add_members on public.members;
drop policy if exists update_members on public.members;
drop policy if exists delete_members on public.members;
create policy read_members on public.members for select to authenticated
  using (user_id = (select auth.uid()) or is_super_admin() or can_manage_district(district_id));
create policy add_members on public.members for insert to authenticated
  with check (is_super_admin() or (member_type = 'volunteer' and can_manage_district(district_id)));
create policy update_members on public.members for update to authenticated
  using (user_id = (select auth.uid()) or is_super_admin() or (member_type = 'volunteer' and can_manage_district(district_id)))
  with check (user_id = (select auth.uid()) or is_super_admin() or (member_type = 'volunteer' and can_manage_district(district_id)));
create policy delete_members on public.members for delete to authenticated using (is_super_admin());

-- ───────────────────────── District Representative applications ─────────────────────────
create table if not exists public.representative_applications (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique default ('DRA-' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8))),
  full_name       text not null,
  date_of_birth   date not null,
  email           text not null,
  phone           text not null,
  state_id        uuid references public.states(id) on delete set null,
  district_id     uuid not null references public.districts(id) on delete restrict,
  city            text,
  address         text,
  photo_path      text,
  employment_type text not null check (employment_type in ('salaried','self_employed','business_owner','student','other')),
  organisation    text, designation text, business_name text, business_type text,
  profession      text, institution text, course text,
  annual_income   text,
  motivation      text, past_activities text, ngo_experience text, introduction text,
  documents       text[] not null default '{}',
  status          text not null default 'submitted' check (status in ('submitted','under_review','approved','rejected','suspended')),
  review_note     text,
  reviewed_by     uuid references public.profiles(id) on delete set null,
  reviewed_at     timestamptz,
  appointment_id  uuid references public.regional_appointments(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists rep_apps_status_idx   on public.representative_applications (status, created_at desc);
create index if not exists rep_apps_email_idx    on public.representative_applications (lower(email), created_at);
create index if not exists rep_apps_district_idx on public.representative_applications (district_id);
create index if not exists rep_apps_state_idx    on public.representative_applications (state_id);
create index if not exists rep_apps_reviewer_idx on public.representative_applications (reviewed_by);
create index if not exists rep_apps_appt_idx     on public.representative_applications (appointment_id);

alter table public.representative_applications enable row level security;
drop policy if exists apply_rep on public.representative_applications;
drop policy if exists founder_rep on public.representative_applications;
create policy apply_rep on public.representative_applications for insert
  with check (status = 'submitted' and reviewed_by is null and appointment_id is null and review_note is null);
create policy founder_rep on public.representative_applications for all to authenticated
  using (is_super_admin()) with check (is_super_admin());

drop trigger if exists throttle on public.representative_applications;
create trigger throttle before insert on public.representative_applications for each row execute function public.throttle_public_form();
drop trigger if exists audit on public.representative_applications;
create trigger audit after update or delete on public.representative_applications for each row execute function public.audit_row();

create or replace function public.notify_rep_application() returns trigger
language plpgsql security definer set search_path = public as $$
declare d text;
begin
  select name into d from districts where id = new.district_id;
  if tg_op = 'INSERT' then
    perform enqueue_notification('email', 'rep_application_received', new.email,
      jsonb_build_object('name', new.full_name, 'reference', new.reference, 'district', coalesce(d, '')), 'rep_app:' || new.id);
    perform notify_founder('applications', 'New District Representative application: ' || new.full_name,
      jsonb_build_array('Reference: ' || new.reference, 'District: ' || coalesce(d, ''), 'Open the admin panel to review it.'),
      'rep_app:' || new.id);
  elsif new.status is distinct from old.status then
    new.reviewed_by := coalesce(auth.uid(), new.reviewed_by);
    new.reviewed_at := now();
    if new.status = 'rejected' then
      perform enqueue_notification('email', 'rep_application_rejected', new.email,
        jsonb_build_object('name', new.full_name, 'reference', new.reference), 'rep_app_rejected:' || new.id);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists notify_ins on public.representative_applications;
drop trigger if exists notify_upd on public.representative_applications;
create trigger notify_ins after insert on public.representative_applications for each row execute function public.notify_rep_application();
create trigger notify_upd before update on public.representative_applications for each row execute function public.notify_rep_application();

-- Founder approves an application: public profile + district rights + membership with ID card.
-- p_user is the login created for the applicant (by invitation); p_photo_url is the public copy of their photograph.
create or replace function public.approve_representative(p_application uuid, p_user uuid, p_photo_url text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare a representative_applications; appt uuid;
begin
  if auth.uid() is not null and not is_super_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  select * into a from representative_applications where id = p_application for update;
  if a.id is null then raise exception 'Application not found'; end if;
  if a.status = 'approved' then raise exception 'This application is already approved'; end if;
  if p_user is null or not exists (select 1 from profiles where id = p_user) then raise exception 'The login account was not found'; end if;

  perform set_config('vf.skip_appointment_mail', '1', true);
  perform set_config('vf.trusted_insert', '1', true);
  insert into regional_appointments (user_id, role_key, state_id, district_id, full_name, designation, photo_url, bio, experience,
                                     email, phone, show_contact, status, is_public)
  values (p_user, 'district_president', coalesce(a.state_id, (select state_id from districts where id = a.district_id)), a.district_id,
          a.full_name, 'District Representative', p_photo_url, a.introduction,
          nullif(concat_ws(E'\n\n', a.ngo_experience, a.past_activities), ''), a.email, a.phone, false, 'active', true)
  returning id into appt;

  if exists (select 1 from members where user_id = p_user) then
    update members set member_type = 'district_representative', status = 'active', district_id = a.district_id,
           membership_id = 'VF-DR-' || lpad(nextval('member_dr_seq')::text, 4, '0'), joined_on = current_date
     where user_id = p_user;
    perform enqueue_notification('email', 'representative_welcome', a.email,
      jsonb_build_object('name', a.full_name, 'member_id', (select id from members where user_id = p_user),
                         'membership_id', (select membership_id from members where user_id = p_user),
                         'district', (select name from districts where id = a.district_id), 'role', 'District Representative'),
      'member_welcome_dr:' || p_user);
  else
    insert into members (user_id, member_type, membership_id, full_name, email, phone, date_of_birth, state_id, district_id, city, address, photo_path, occupation, status)
    values (p_user, 'district_representative', '', a.full_name, lower(a.email), a.phone, a.date_of_birth, a.state_id, a.district_id, a.city, a.address,
            a.photo_path, coalesce(a.designation, a.profession, a.business_type, a.course), 'active');
  end if;

  update representative_applications set status = 'approved', appointment_id = appt where id = a.id;
  return appt;
end $$;

-- A representative edits their own public profile; the founder is told.
create or replace function public.update_my_rep_profile(p_bio text, p_experience text, p_email text, p_phone text, p_show_contact boolean, p_photo_url text) returns int
language plpgsql security definer set search_path = public as $$
declare n int; who text;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  update regional_appointments set bio = nullif(left(p_bio, 1500), ''), experience = nullif(left(p_experience, 3000), ''),
         email = nullif(left(p_email, 160), ''), phone = nullif(left(p_phone, 20), ''), show_contact = coalesce(p_show_contact, false),
         photo_url = coalesce(nullif(p_photo_url, ''), photo_url)
   where user_id = auth.uid() and status = 'active';
  get diagnostics n = row_count;
  if n > 0 then
    select coalesce(full_name, email) into who from profiles where id = auth.uid();
    perform notify_founder('representatives', 'Representative profile updated: ' || coalesce(who, ''), '[]'::jsonb,
      'rep_profile:' || auth.uid() || ':' || to_char(now(), 'YYYYMMDDHH24'));
  end if;
  return n;
end $$;

-- ───────────────────────── Announcements ─────────────────────────
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  district_id uuid references public.districts(id) on delete cascade,   -- null = whole foundation
  recipients  int not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists announcements_idx on public.announcements (district_id, created_at desc);
create index if not exists announcements_author_idx on public.announcements (created_by);
alter table public.announcements enable row level security;
drop policy if exists read_announcements on public.announcements;
create policy read_announcements on public.announcements for select to authenticated
  using (is_super_admin() or can_manage_district(district_id)
         or exists (select 1 from members m where m.user_id = (select auth.uid()) and m.status = 'active'
                    and (announcements.district_id is null or m.district_id = announcements.district_id)));

-- Founder: everyone or one district. Representative: own district. Non-essential, so opt-outs are respected.
create or replace function public.send_announcement(p_title text, p_body text, p_district uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare ann uuid; n int := 0; r record;
begin
  if auth.uid() is null or not (is_super_admin() or (p_district is not null and can_manage_district(p_district))) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if coalesce(trim(p_title), '') = '' or coalesce(trim(p_body), '') = '' then raise exception 'Write a title and a message'; end if;
  insert into announcements (title, body, district_id, created_by) values (left(trim(p_title), 160), left(trim(p_body), 3000), p_district, auth.uid())
  returning id into ann;
  for r in select id, full_name, email, phone, whatsapp_opt_in, member_type from members
            where status = 'active' and consent_contact and (p_district is null or district_id = p_district) loop
    perform notify_person('announcement', r.email, r.phone, r.member_type = 'volunteer' and r.whatsapp_opt_in,
      jsonb_build_object('name', r.full_name, 'title', left(trim(p_title), 160), 'body', left(trim(p_body), 3000)),
      'announcement:' || ann, false);
    n := n + 1;
  end loop;
  update announcements set recipients = n where id = ann;
  return n;
end $$;

-- Event announcements now go to members instead of the old application list.
create or replace function public.enqueue_event_notice(p_event uuid, p_kind text) returns int
language plpgsql security definer set search_path = public as $$
declare e events; n int := 0; r record; stamp text := to_char(now(), 'YYYYMMDDHH24');
begin
  select * into e from events where id = p_event;
  if e.id is null or e.publish_status <> 'published' then raise exception 'Publish the event first'; end if;
  if auth.uid() is not null and not can_manage_district(e.district_id) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if p_kind = 'announcement' then
    for r in select full_name, email, phone, whatsapp_opt_in from members
              where status = 'active' and member_type = 'volunteer' and consent_contact
                and (e.district_id is null or district_id = e.district_id) loop
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

-- People can see the messages that were sent to their own address.
drop policy if exists read_own on public.notification_queue;
create policy read_own on public.notification_queue for select to authenticated
  using (recipient = (select lower(email) from profiles where id = (select auth.uid())));

-- ───────────────────────── Donations: founder entry, corrections, public totals ─────────────────────────
alter table public.donation_submissions alter column email drop not null;
alter table public.donation_submissions alter column phone drop not null;
alter table public.donation_submissions
  add column if not exists source text not null default 'online_form' check (source in ('online_form','founder_entry')),
  add column if not exists notes  text;
alter table public.donation_verifications drop constraint if exists donation_verifications_action_check;
alter table public.donation_verifications add constraint donation_verifications_action_check
  check (action in ('verified','rejected','corrected','voided'));

-- "Pending verification" mail only for confirmations sent in by donors.
create or replace function public.notify_donation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.source = 'online_form' then
      perform notify_person('donation_received', new.email, new.phone, new.whatsapp_opt_in,
        jsonb_build_object('name', new.donor_name, 'amount', new.amount, 'reference', new.reference, 'utr', new.utr),
        'donation_received:' || new.id);
    end if;
  elsif new.status = 'rejected' and old.status = 'pending' then
    perform notify_person('donation_rejected', new.email, new.phone, new.whatsapp_opt_in,
      jsonb_build_object('name', new.donor_name, 'amount', new.amount, 'reference', new.reference,
        'note', (select note from donation_verifications where submission_id = new.id order by created_at desc limit 1)),
      'donation_rejected:' || new.id);
  end if;
  return new;
end $$;

-- Founder records a donation after seeing the money in the foundation's bank account.
create or replace function public.record_donation(p_name text, p_amount numeric, p_paid_on date, p_utr text,
  p_email text default null, p_phone text default null, p_purpose text default null, p_note text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if auth.uid() is null or not is_super_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if p_paid_on > (now() at time zone 'Asia/Kolkata')::date then raise exception 'The payment date cannot be in the future'; end if;
  insert into donation_submissions (donor_name, email, phone, amount, utr, paid_on, purpose, status, source, notes)
  values (left(trim(p_name), 120), nullif(lower(trim(p_email)), ''), nullif(trim(p_phone), ''), p_amount, upper(trim(p_utr)),
          p_paid_on, nullif(trim(p_purpose), ''), 'verified', 'founder_entry', nullif(trim(p_note), ''))
  returning id into sid;
  insert into donation_verifications (submission_id, action, note, verified_by) values (sid, 'verified', coalesce(nullif(trim(p_note), ''), 'Entered by the founder from bank records'), auth.uid());
  insert into donation_receipts (submission_id, issued_by) values (sid, auth.uid());
  return sid;
end $$;

-- Correct or void a verified record. The old values stay in the audit log.
create or replace function public.correct_donation(p_id uuid, p_amount numeric, p_paid_on date, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_super_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Give a reason for the correction'; end if;
  update donation_submissions set amount = p_amount, paid_on = p_paid_on where id = p_id and status = 'verified';
  if not found then raise exception 'Only verified donations can be corrected'; end if;
  insert into donation_verifications (submission_id, action, note, verified_by) values (p_id, 'corrected', trim(p_note), auth.uid());
end $$;

create or replace function public.void_donation(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not is_super_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Give a reason'; end if;
  update donation_submissions set status = 'rejected' where id = p_id and status = 'verified';
  if not found then raise exception 'Only verified donations can be voided'; end if;
  insert into donation_verifications (submission_id, action, note, verified_by) values (p_id, 'voided', trim(p_note), auth.uid());
end $$;

-- Public transparency figures: totals only, verified donations only. No names, references or contact details.
create or replace function public.donation_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  with v as (
    select amount, paid_on, coalesce(nullif(lower(email), ''), nullif(phone, ''), id::text) as donor
      from donation_submissions where status = 'verified'),
  today as (select (now() at time zone 'Asia/Kolkata')::date as d)
  select jsonb_build_object(
    'month',  (select jsonb_build_object('donors', count(distinct donor), 'amount', coalesce(sum(amount), 0)) from v, today where date_trunc('month', paid_on) = date_trunc('month', d)),
    'year',   (select jsonb_build_object('donors', count(distinct donor), 'amount', coalesce(sum(amount), 0)) from v, today where date_trunc('year', paid_on) = date_trunc('year', d)),
    'total',  (select jsonb_build_object('donors', count(distinct donor), 'amount', coalesce(sum(amount), 0), 'donations', count(*)) from v),
    'monthly', coalesce((select jsonb_agg(x order by x.period desc) from (
                 select to_char(date_trunc('month', paid_on), 'YYYY-MM') as period, count(distinct donor) as donors, sum(amount) as amount
                   from v group by 1 order by 1 desc limit 24) x), '[]'::jsonb),
    'yearly',  coalesce((select jsonb_agg(x order by x.period desc) from (
                 select to_char(date_trunc('year', paid_on), 'YYYY') as period, count(distinct donor) as donors, sum(amount) as amount
                   from v group by 1 order by 1 desc limit 10) x), '[]'::jsonb),
    'updated_at', (select max(created_at) from donation_verifications where action <> 'rejected'))
$$;

-- ───────────────────────── Dashboard figures ─────────────────────────
-- p_district null = whole foundation (founder only); otherwise one district the caller manages.
create or replace function public.overview_stats(p_district uuid default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if auth.uid() is null or not (is_super_admin() or (p_district is not null and can_manage_district(p_district))) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'volunteers', (select count(*) from members where member_type = 'volunteer' and status = 'active' and (p_district is null or district_id = p_district)),
    'volunteers_month', (select count(*) from members where member_type = 'volunteer' and status in ('active','suspended')
                           and created_at >= date_trunc('month', today) and (p_district is null or district_id = p_district)),
    'representatives', (select count(*) from regional_appointments a join roles r on r.key = a.role_key
                         where a.status = 'active' and r.scope = 'district' and r.can_manage and (p_district is null or a.district_id = p_district)),
    'districts_covered', (select count(distinct a.district_id) from regional_appointments a where a.status = 'active' and a.district_id is not null),
    'districts_total', (select count(*) from districts where is_active),
    'pending_applications', case when p_district is null then (select count(*) from representative_applications where status in ('submitted','under_review')) else 0 end,
    'activities', (select count(*) from activities where publish_status = 'published' and (p_district is null or district_id = p_district)),
    'events_upcoming', (select count(*) from events where publish_status = 'published' and not is_cancelled
                          and coalesce(ends_at, starts_at + interval '6 hours') >= now() and (p_district is null or district_id = p_district)),
    'monthly_volunteers', coalesce((select jsonb_agg(jsonb_build_object('period', to_char(g, 'YYYY-MM'), 'count',
                             (select count(*) from members m where m.member_type = 'volunteer' and m.status <> 'removed'
                                and m.created_at >= g and m.created_at < g + interval '1 month' and (p_district is null or m.district_id = p_district))) order by g)
                           from generate_series(date_trunc('month', today) - interval '5 months', date_trunc('month', today), interval '1 month') g), '[]'::jsonb));
end $$;

-- ───────────────────────── Storage ─────────────────────────
update storage.buckets set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','application/pdf'] where id = 'media';
drop policy if exists "private insert" on storage.objects;
create policy "private insert" on storage.objects for insert
  with check (bucket_id = 'private-uploads' and (name like 'proofs/%' or name like 'applicants/%' or name like 'documents/%'));
drop policy if exists "private own photo" on storage.objects;
create policy "private own photo" on storage.objects for select to authenticated
  using (bucket_id = 'private-uploads' and exists (
    select 1 from public.members m where m.photo_path = name and m.user_id = (select auth.uid())));
drop policy if exists "private member photo update" on storage.objects;

-- ───────────────────────── Privileges ─────────────────────────
grant select, insert, update, delete on public.members, public.representative_applications, public.announcements to anon, authenticated;
grant all on public.members, public.representative_applications, public.announcements to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

revoke execute on function public.limit_slides(), public.notify_founder(text,text,jsonb,text), public.notify_district_reps(uuid,text,jsonb,text),
  public.alert_content_change(), public.members_before(), public.members_after(), public.create_volunteer(jsonb,uuid,text,text),
  public.handle_user_confirmed(), public.notify_rep_application() from public, anon, authenticated;
revoke execute on function public.join_as_volunteer(jsonb), public.email_my_id_card(), public.approve_representative(uuid,uuid,text),
  public.update_my_rep_profile(text,text,text,text,boolean,text), public.send_announcement(text,text,uuid),
  public.record_donation(text,numeric,date,text,text,text,text,text), public.correct_donation(uuid,numeric,date,text),
  public.void_donation(uuid,text), public.overview_stats(uuid) from public, anon;
grant execute on function public.join_as_volunteer(jsonb), public.email_my_id_card(), public.approve_representative(uuid,uuid,text),
  public.update_my_rep_profile(text,text,text,text,boolean,text), public.send_announcement(text,text,uuid),
  public.record_donation(text,numeric,date,text,text,text,text,text), public.correct_donation(uuid,numeric,date,text),
  public.void_donation(uuid,text), public.overview_stats(uuid) to authenticated, service_role;
grant execute on function public.volunteer_phone_taken(text), public.verify_member(uuid), public.donation_stats() to anon, authenticated, service_role;
