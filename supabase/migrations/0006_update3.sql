-- VRUTSA FOUNDATION — update 3: four-slide hero, donation programmes, private donation totals,
-- representative login invitations. Run after 0005. Safe to run more than once.

-- Hero carousel: second button, crop focus, four slides at most.
alter table public.hero_slides
  add column if not exists cta2_label text,
  add column if not exists cta2_url   text,
  add column if not exists focus      text not null default 'center' check (focus in ('center','top','bottom','left','right'));

create or replace function public.limit_slides() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from hero_slides) >= 4 then
    raise exception 'The homepage carousel has four slots. Remove or replace a slide first.' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- "What your donations support" cards on the Donate page.
create table if not exists public.donation_programmes (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  image_url   text,
  link_url    text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.donation_programmes enable row level security;
drop policy if exists read_all on public.donation_programmes;
drop policy if exists write_sa on public.donation_programmes;
create policy read_all on public.donation_programmes for select using (true);
create policy write_sa on public.donation_programmes for all to authenticated using (is_super_admin()) with check (is_super_admin());
grant select, insert, update, delete on public.donation_programmes to anon, authenticated;
grant all on public.donation_programmes to service_role;

insert into public.donation_programmes (title, description, sort_order)
select v.title, v.description, v.sort_order from (values
  ('Food distribution', 'Food distribution to roadside and underprivileged people, and food assistance to people in need.', 1),
  ('Clothing distribution', 'Distributing clothes to roadside people and supporting underprivileged families.', 2),
  ('Old-age home support', 'Providing food and essential assistance to elderly residents.', 3),
  ('Children''s home support', 'Supporting children living in children''s homes and care institutions.', 4),
  ('Education support', 'Mainly for Kindergarten to Primary School students in government schools: stationery kits, notebooks, textbooks and educational books, and other essential study materials.', 5),
  ('Social awareness programmes', 'Social awareness speeches, community awareness campaigns, and educational and social development initiatives.', 6)
) as v(title, description, sort_order)
where not exists (select 1 from public.donation_programmes);

-- Donation totals are now for the founder only (removed from the public website).
create or replace function public.donation_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_super_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  return (
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
      'updated_at', (select max(created_at) from donation_verifications where action <> 'rejected')));
end $$;
revoke execute on function public.donation_stats() from public, anon;
grant execute on function public.donation_stats() to authenticated, service_role;

-- Founder links a login to a representative's appointment: grants the district role (through the
-- appointment trigger) and makes sure the person has a membership, which is what the ID card is built from.
create or replace function public.link_representative_account(p_appointment uuid, p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare a regional_appointments; mid uuid;
begin
  if auth.uid() is not null and not is_super_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
  select * into a from regional_appointments where id = p_appointment for update;
  if a.id is null then raise exception 'Appointment not found'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'The login account was not found'; end if;
  if a.user_id is distinct from p_user then
    update regional_appointments set user_id = p_user where id = a.id;
  end if;
  select id into mid from members where user_id = p_user;
  if mid is null then
    perform set_config('vf.trusted_insert', '1', true);
    insert into members (user_id, member_type, membership_id, full_name, email, phone, state_id, district_id, status)
    values (p_user, 'district_representative', '', a.full_name, lower(a.email), a.phone, a.state_id, a.district_id, 'active')
    returning id into mid;                       -- the welcome email with the ID card is queued by the members trigger
  elsif (select member_type from members where id = mid) <> 'district_representative' then
    update members set member_type = 'district_representative', status = 'active', district_id = a.district_id,
           membership_id = 'VF-DR-' || lpad(nextval('member_dr_seq')::text, 4, '0') where id = mid;
  end if;
  return mid;
end $$;

-- Founder (anyone) or a representative (own district's volunteers) sends a member their ID card again.
create or replace function public.queue_id_card(p_member uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare m members;
begin
  select * into m from members where id = p_member;
  if m.id is null or auth.uid() is null
     or not (is_super_admin() or (m.member_type = 'volunteer' and can_manage_district(m.district_id))) then
    raise exception 'Not authorised' using errcode = '42501';
  end if;
  if m.status <> 'active' or coalesce(m.email, '') = '' then return false; end if;
  perform enqueue_notification('email', 'id_card', m.email,
    jsonb_build_object('name', m.full_name, 'membership_id', m.membership_id, 'member_id', m.id),
    'id_card:' || m.id || ':' || to_char(now(), 'YYYYMMDDHH24MI'));
  return true;
end $$;

revoke execute on function public.link_representative_account(uuid, uuid), public.queue_id_card(uuid) from public, anon;
grant execute on function public.link_representative_account(uuid, uuid), public.queue_id_card(uuid) to authenticated, service_role;