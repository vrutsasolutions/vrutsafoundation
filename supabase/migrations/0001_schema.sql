-- VRUTSA FOUNDATION — core schema
-- Run in order: 0001 → 0002 → 0003 → 0004, then supabase/seed.sql

create extension if not exists pgcrypto;

-- ───────────────────────── Roles & geography ─────────────────────────
-- The hierarchy is data, not code: add a row here to add a level.
create table public.roles (
  key            text primary key,
  name           text not null,
  rank           int  not null,                     -- 10 = highest authority
  scope          text not null check (scope in ('global','state','district')),
  can_manage     boolean not null default false,    -- manage content + volunteers inside scope
  can_contribute boolean not null default false,    -- submit content for approval inside scope
  show_in_network boolean not null default true     -- appears on the public network page
);

insert into public.roles (key, name, rank, scope, can_manage, can_contribute, show_in_network) values
  ('super_admin',          'Founder / Managing Authority', 10, 'global',   true,  true,  true),
  ('national_leader',      'Central Leadership',           20, 'global',   true,  true,  true),
  ('state_director',       'State Director',               30, 'state',    true,  true,  true),
  ('district_president',   'District President',           40, 'district', true,  true,  true),
  ('district_director',    'District Director',            50, 'district', true,  true,  true),
  ('district_coordinator', 'District Coordinator',         60, 'district', true,  true,  true),
  ('zone_coordinator',     'Area / Zone Coordinator',      70, 'district', false, true,  true),
  ('volunteer',            'Volunteer',                    80, 'district', false, true,  false),
  ('worker',               'Foundation Worker',            80, 'district', false, true,  false);

create table public.states (
  id        uuid primary key default gen_random_uuid(),
  name      text not null unique,
  code      text unique,
  is_active boolean not null default true
);

create table public.districts (
  id             uuid primary key default gen_random_uuid(),
  state_id       uuid not null references public.states(id) on delete restrict,
  name           text not null,
  slug           text not null unique,
  lat            double precision,
  lng            double precision,
  office_address text,                 -- official office only, never a home address
  is_active      boolean not null default true,
  unique (state_id, name)
);
create index on public.districts (state_id);

-- ───────────────────────── People ─────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  state_id    uuid references public.states(id) on delete set null,
  district_id uuid references public.districts(id) on delete set null,
  city        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.profiles (district_id);

create table public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role_key    text not null references public.roles(key) on update cascade,
  state_id    uuid references public.states(id) on delete cascade,
  district_id uuid references public.districts(id) on delete cascade,
  is_active   boolean not null default true,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create unique index user_roles_unique on public.user_roles
  (user_id, role_key,
   coalesce(state_id, '00000000-0000-0000-0000-000000000000'),
   coalesce(district_id, '00000000-0000-0000-0000-000000000000'));
create index on public.user_roles (user_id) where is_active;

-- A public leadership profile. user_id is optional: a person can be listed
-- before they have a login; linking a login grants the matching role.
create table public.regional_appointments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles(id) on delete set null,
  role_key         text not null references public.roles(key) on update cascade,
  state_id         uuid references public.states(id) on delete cascade,
  district_id      uuid references public.districts(id) on delete cascade,
  full_name        text not null,
  designation      text,
  photo_url        text,
  bio              text,
  responsibilities text,
  email            text,
  phone            text,
  whatsapp_opt_in  boolean not null default false,
  show_contact     boolean not null default false,  -- contact is public only when true
  appointed_on     date not null default current_date,
  status           text not null default 'active' check (status in ('active','inactive')),
  is_public        boolean not null default true,
  appointed_by     uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.regional_appointments (district_id, status);
create index on public.regional_appointments (state_id, status);

-- ───────────────────────── Content ─────────────────────────
create table public.categories (            -- focus areas / programme categories
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  description text,
  image_url   text,
  sort_order  int not null default 0,
  is_active   boolean not null default true
);

create table public.hero_slides (
  id         uuid primary key default gen_random_uuid(),
  image_url  text not null,
  title      text,
  subtitle   text,
  link_url   text,
  sort_order int not null default 0,
  is_active  boolean not null default true
);

create table public.events (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  slug              text not null unique,
  description       text,
  poster_url        text,
  starts_at         timestamptz not null,
  ends_at           timestamptz,
  venue             text,
  district_id       uuid references public.districts(id) on delete set null,
  lat               double precision,
  lng               double precision,
  contact_name      text,
  contact_phone     text,                 -- official event contact, shown publicly
  coordinators      text,
  registration_mode text not null default 'none' check (registration_mode in ('none','form','link')),
  registration_url  text,
  is_cancelled      boolean not null default false,
  highlights        text,                 -- short results, shown once completed
  report_url        text,
  publish_status    text not null default 'draft' check (publish_status in ('draft','pending','published')),
  created_by        uuid references public.profiles(id) on delete set null,
  published_by      uuid references public.profiles(id) on delete set null,
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on public.events (publish_status, starts_at);
create index on public.events (district_id);

-- Upcoming / Completed / Cancelled is derived, never typed in by hand.
create function public.event_status(e public.events) returns text
language sql stable as $$
  select case when e.is_cancelled then 'cancelled'
              when coalesce(e.ends_at, e.starts_at + interval '6 hours') < now() then 'completed'
              else 'upcoming' end
$$;

create table public.activities (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  slug             text not null unique,
  summary          text,
  description      text,
  category_id      uuid references public.categories(id) on delete set null,
  activity_date    date not null default current_date,
  location         text,
  district_id      uuid references public.districts(id) on delete set null,
  cover_url        text,
  related_event_id uuid references public.events(id) on delete set null,
  publish_status   text not null default 'draft' check (publish_status in ('draft','pending','published')),
  created_by       uuid references public.profiles(id) on delete set null,
  published_by     uuid references public.profiles(id) on delete set null,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.activities (publish_status, activity_date desc);
create index on public.activities (district_id);
create index on public.activities (category_id);

create table public.activity_media (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid references public.activities(id) on delete cascade,
  event_id    uuid references public.events(id) on delete cascade,
  media_type  text not null default 'image' check (media_type in ('image','video')),
  url         text not null,
  caption     text,
  sort_order  int not null default 0,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (activity_id is not null or event_id is not null)
);
create index on public.activity_media (activity_id);
create index on public.activity_media (event_id);

-- ───────────────────────── Participation ─────────────────────────
create table public.volunteer_applications (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references public.profiles(id) on delete set null,
  full_name            text not null,
  email                text not null,
  phone                text not null,
  state_id             uuid references public.states(id) on delete set null,
  district_id          uuid references public.districts(id) on delete set null,
  city                 text,
  interest             text,
  skills               text,
  availability         text,
  intro                text,
  photo_path           text,               -- private bucket path
  consent_contact      boolean not null default false,
  whatsapp_opt_in      boolean not null default false,
  status               text not null default 'submitted'
                       check (status in ('submitted','under_review','approved','rejected','active','inactive')),
  assigned_role_key    text references public.roles(key) on update cascade,
  assigned_district_id uuid references public.districts(id) on delete set null,
  assigned_event_id    uuid references public.events(id) on delete set null,
  assigned_activity_id uuid references public.activities(id) on delete set null,
  coordinator_id       uuid references public.profiles(id) on delete set null,
  review_note          text,
  reviewed_by          uuid references public.profiles(id) on delete set null,
  reviewed_at          timestamptz,
  created_at           timestamptz not null default now()
);
create index on public.volunteer_applications (status);
create index on public.volunteer_applications (district_id);
create index on public.volunteer_applications (user_id);
create index on public.volunteer_applications (lower(email), created_at);

create table public.event_registrations (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  user_id         uuid references public.profiles(id) on delete set null,
  full_name       text not null,
  email           text not null,
  phone           text,
  whatsapp_opt_in boolean not null default false,
  created_at      timestamptz not null default now()
);
create unique index event_registrations_unique on public.event_registrations (event_id, lower(email));
create index on public.event_registrations (user_id);

-- ───────────────────────── Donations (direct bank transfer, manual verification) ─────────────────────────
create table public.donation_submissions (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique default ('VFD-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,10))),
  user_id         uuid references public.profiles(id) on delete set null,
  donor_name      text not null,
  email           text not null,
  phone           text not null,
  amount          numeric(12,2) not null check (amount > 0),
  utr             text not null,
  paid_on         date not null,
  purpose         text,
  proof_path      text,                    -- private bucket path
  whatsapp_opt_in boolean not null default false,
  status          text not null default 'pending' check (status in ('pending','verified','rejected')),
  created_at      timestamptz not null default now()
);
create unique index donation_utr_unique on public.donation_submissions (upper(utr));
create index on public.donation_submissions (status, created_at desc);
create index on public.donation_submissions (user_id);
create index on public.donation_submissions (lower(email), created_at);

create table public.donation_verifications (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.donation_submissions(id) on delete cascade,
  action        text not null check (action in ('verified','rejected')),
  note          text,
  verified_by   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on public.donation_verifications (submission_id);

create sequence public.receipt_seq;
create table public.donation_receipts (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.donation_submissions(id) on delete cascade,
  receipt_no    text not null unique
                default ('VF-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text, 6, '0')),
  pdf_path      text,                      -- set once the PDF is stored; triggers the acknowledgement
  issued_by     uuid references public.profiles(id) on delete set null,
  issued_at     timestamptz not null default now()
);

-- ───────────────────────── Notifications ─────────────────────────
create table public.notification_preferences (
  contact    text primary key,             -- lower-cased email or phone number
  opted_out  boolean not null default false,  -- applies to non-essential messages only
  token      uuid not null unique default gen_random_uuid(),
  updated_at timestamptz not null default now()
);

create table public.notification_queue (
  id              uuid primary key default gen_random_uuid(),
  channel         text not null check (channel in ('email','whatsapp')),
  template        text not null,
  recipient       text not null,
  payload         jsonb not null default '{}',
  dedupe_key      text not null unique,     -- one message per event per recipient per channel
  is_essential    boolean not null default true,
  status          text not null default 'queued' check (status in ('queued','sending','sent','failed')),
  attempts        int not null default 0,
  last_error      text,
  next_attempt_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);
create index on public.notification_queue (status, next_attempt_at);

create table public.notification_logs (
  id         uuid primary key default gen_random_uuid(),
  queue_id   uuid references public.notification_queue(id) on delete cascade,
  channel    text not null,
  template   text not null,
  recipient  text not null,
  status     text not null,
  error      text,
  created_at timestamptz not null default now()
);
create index on public.notification_logs (created_at desc);

-- ───────────────────────── Audit & settings ─────────────────────────
create table public.audit_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  action     text not null,
  entity     text not null,
  entity_id  text,
  details    jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs (created_at desc);
create index on public.audit_logs (entity, entity_id);

create table public.foundation_settings (
  key        text primary key,
  value      text,
  is_public  boolean not null default true,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
