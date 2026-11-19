-- Permission tests. Run after the stub, the four migrations and seed.sql:
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
create schema tests;
update foundation_settings set value = 'approval' where key = 'publish_mode';  -- these tests exercise the approval workflow
grant usage on schema tests to anon, authenticated;
create function tests.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', false);
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), false);
  perform set_config('role', case when u is null then 'anon' else 'authenticated' end, false);
end $$;
create function tests.root() returns void language plpgsql as $$
begin perform set_config('role', 'postgres', false); perform set_config('request.jwt.claim.sub', '', false); end $$;
create function tests.fails(q text) returns boolean language plpgsql as $$
begin execute q; return false; exception when others then return true; end $$;
create function tests.ok(c boolean, label text) returns void language plpgsql as $$
begin if c is not true then raise exception 'FAILED: %', label; end if; raise notice 'ok  %', label; end $$;
grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'founder@test', '{"full_name":"Founder","role":"super_admin"}'),
  ('00000000-0000-0000-0000-00000000000b', 'chennai@test', '{}'),
  ('00000000-0000-0000-0000-00000000000c', 'madurai@test', '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'vol@test', '{}'),
  ('00000000-0000-0000-0000-00000000000e', 'donor@test', '{}');
select tests.ok((select count(*) from profiles) = 5, 'sign-up creates a profile');
select tests.ok((select count(*) from user_roles) = 0, 'sign-up metadata cannot grant a role');
insert into user_roles (user_id, role_key) values ('00000000-0000-0000-0000-00000000000a', 'super_admin');

\set founder '''00000000-0000-0000-0000-00000000000a'''
\set chennai '''00000000-0000-0000-0000-00000000000b'''
\set madurai '''00000000-0000-0000-0000-00000000000c'''
\set vol     '''00000000-0000-0000-0000-00000000000d'''
\set donor   '''00000000-0000-0000-0000-00000000000e'''

-- Founder appoints two district presidents
select tests.login(:founder);
insert into regional_appointments (user_id, role_key, district_id, full_name, email, phone, show_contact)
  select :chennai, 'district_president', id, 'Test President One', 'chennai@test', '9000000001', false from districts where slug = 'chennai';
insert into regional_appointments (user_id, role_key, district_id, full_name, email)
  select :madurai, 'district_president', id, 'Test President Two', 'madurai@test' from districts where slug = 'madurai';
select tests.root();
select tests.ok((select count(*) from user_roles where role_key = 'district_president' and is_active) = 2, 'appointment grants the district role');
select tests.ok(exists (select 1 from notification_queue where template = 'leadership_appointment'), 'appointment queues a notification');

-- District president: own district only
select tests.login(:chennai);
insert into activities (title, slug, district_id, publish_status)
  select 'Chennai activity', 'chennai-activity', id, 'published' from districts where slug = 'chennai';
select tests.ok((select publish_status from activities where slug = 'chennai-activity') = 'pending', 'approval mode holds district content for the founder');
select tests.ok(tests.fails($$insert into activities (title, slug, district_id) select 'x', 'x', id from districts where slug = 'madurai'$$), 'president cannot create in another district');
select tests.ok(tests.fails($$insert into activities (title, slug) values ('fw', 'fw')$$), 'president cannot create foundation-wide content');
select tests.ok(tests.fails($$insert into user_roles (user_id, role_key) values (auth.uid(), 'super_admin')$$), 'president cannot grant roles');
select tests.ok(tests.fails($$insert into regional_appointments (role_key, full_name) values ('state_director', 'Self')$$), 'president cannot appoint');
select tests.ok(tests.fails($$update foundation_settings set value = 'immediate' where key = 'publish_mode'; select 1/(select count(*) from foundation_settings where key='publish_mode' and value='immediate')$$), 'president cannot change settings');
select tests.ok((select count(*) from donation_submissions) = 0 and tests.fails($$select verify_donation(gen_random_uuid())$$), 'president cannot see or verify donations');

select tests.login(:madurai);
insert into events (title, slug, starts_at, district_id, publish_status, registration_mode)
  select 'Madurai event', 'madurai-event', now() + interval '10 hours', id, 'draft', 'form' from districts where slug = 'madurai';
select tests.login(:chennai);
update events set title = 'hijacked' where slug = 'madurai-event';
update activities set district_id = (select id from districts where slug = 'chennai') where slug = 'none';
select tests.root();
select tests.ok((select title from events where slug = 'madurai-event') = 'Madurai event', 'president cannot edit another district''s event');

-- Founder switches to immediate publishing
select tests.login(:founder);
update foundation_settings set value = 'immediate' where key = 'publish_mode';
update events set publish_status = 'published' where slug = 'madurai-event';
select tests.login(:chennai);
insert into activities (title, slug, district_id, publish_status)
  select 'Chennai two', 'chennai-two', id, 'published' from districts where slug = 'chennai';
select tests.ok((select publish_status from activities where slug = 'chennai-two') = 'published', 'immediate mode publishes straight away');

-- Anonymous visitor
select tests.login(null);
select tests.ok((select count(*) from activities) = 1, 'public sees only published activities');
select tests.ok((select count(*) from public_appointments) = 2 and (select count(*) from public_appointments where email is not null or phone is not null) = 0, 'public sees leaders, contact details hidden');
select tests.ok(tests.fails($$select count(*) from regional_appointments where 1/(select count(*) from regional_appointments) > 0$$), 'public cannot read the appointments table');
insert into volunteer_applications (full_name, email, phone, district_id, consent_contact, whatsapp_opt_in)
  select 'Anon Volunteer', 'anon@test', '9000000002', id, true, true from districts where slug = 'chennai';
select tests.ok((select count(*) from volunteer_applications) = 0, 'public cannot read applications');
select tests.ok(tests.fails($$insert into volunteer_applications (full_name, email, phone, status) values ('a','b@test','1','approved')$$), 'public cannot pre-approve an application');
insert into donation_submissions (donor_name, email, phone, amount, utr, paid_on) values ('Donor', 'donor@test', '9000000003', 1000, 'UTR123456789', current_date);
select tests.ok(tests.fails($$insert into donation_submissions (donor_name, email, phone, amount, utr, paid_on, status) values ('D','d@test','1',5,'UTRX','2026-01-01','verified')$$), 'public cannot submit a donation as verified');
select tests.ok(tests.fails($$insert into donation_submissions (donor_name, email, phone, amount, utr, paid_on) values ('D','d2@test','1',5,'utr123456789','2026-01-01')$$), 'duplicate UTR is rejected');
select tests.ok((select count(*) from donation_submissions) = 0, 'public cannot read donations');
select tests.ok(tests.fails($$select verify_donation((select id from donation_submissions limit 1))$$), 'public cannot verify');
select tests.ok(tests.fails($$select * from claim_notifications(5)$$), 'public cannot claim the notification queue');
select tests.ok(tests.fails($$select enqueue_notification('email','welcome','x@test','{}','k')$$), 'public cannot enqueue notifications');
select tests.ok((select count(*) from notification_queue) = 0 and (select count(*) from audit_logs) = 0, 'public cannot read queue or audit log');
insert into event_registrations (event_id, full_name, email) select id, 'Guest', 'guest@test' from events where slug = 'madurai-event';
select tests.ok(tests.fails($$insert into event_registrations (event_id, full_name, email) select id, 'Guest', 'GUEST@test' from events where slug = 'madurai-event'$$), 'double registration is rejected');
select tests.ok(tests.fails($$insert into storage.objects (bucket_id, name) values ('media', 'x.jpg')$$), 'public cannot upload to media');
insert into storage.objects (bucket_id, name) values ('private-uploads', 'proofs/x.jpg');
select tests.ok((select count(*) from storage.objects where bucket_id = 'private-uploads') = 0, 'public cannot read private uploads');

-- Throttle
do $$ begin for i in 1..4 loop
  insert into donation_submissions (donor_name, email, phone, amount, utr, paid_on) values ('Donor', 'donor@test', '9', 10, 'T' || i, current_date);
end loop; end $$;
select tests.ok(tests.fails($$insert into donation_submissions (donor_name, email, phone, amount, utr, paid_on) values ('Donor','DONOR@test','9',10,'T9',current_date)$$), 'sixth submission in an hour is throttled');

-- Volunteer review by the district president
select tests.root();
update volunteer_applications set user_id = :vol where email = 'anon@test';
select tests.login(:chennai);
select tests.ok(tests.fails($$update volunteer_applications set status = 'approved', assigned_role_key = 'district_president'$$), 'president cannot hand out a management role');
select tests.ok(tests.fails($$update volunteer_applications set status = 'approved', assigned_district_id = (select id from districts where slug = 'madurai')$$), 'president cannot assign into another district');
update volunteer_applications set status = 'approved';
select tests.root();
select tests.ok(exists (select 1 from user_roles where user_id = :vol and role_key = 'volunteer' and is_active), 'approval grants the volunteer role');
select tests.ok((select count(*) from notification_queue where template = 'volunteer_approved') = 2, 'approval queues email and WhatsApp (opted in)');
select tests.login(:vol);
select tests.ok(tests.fails($$insert into activities (title, slug, district_id, publish_status) select 'Volunteer report', 'vol-report', id, 'published' from districts where slug = 'chennai'$$), 'volunteers are members, not content editors');
select tests.ok(tests.fails($$insert into events (title, slug, starts_at, district_id) select 'e', 'e', now(), id from districts where slug = 'chennai'$$), 'volunteer cannot create events');

-- Founder verifies a donation
select tests.login(:founder);
select tests.ok((select count(*) from donation_submissions where status = 'pending') = 5, 'founder sees pending donations');
select receipt_no from verify_donation((select id from donation_submissions where utr = 'UTR123456789'), 'matched bank statement');
select tests.ok(tests.fails($$select verify_donation((select id from donation_submissions where utr = 'UTR123456789'))$$), 'a donation cannot be verified twice');
select tests.ok(not exists (select 1 from notification_queue where template = 'donation_acknowledgement'), 'no acknowledgement before the receipt PDF exists');
update donation_receipts set pdf_path = 'x.pdf';
select tests.ok(exists (select 1 from notification_queue where template = 'donation_acknowledgement'), 'acknowledgement queued once the receipt PDF exists');
select reject_donation((select id from donation_submissions where utr = 'T1'), 'not found in bank records');
select tests.ok(exists (select 1 from notification_queue where template = 'donation_rejected'), 'rejection queues a notification');
select tests.ok((select enqueue_event_reminders()) = 1, 'reminder queued for an event starting within 24 hours');
select tests.ok((select count(*) from claim_notifications(100)) > 5 and (select count(*) from claim_notifications(100)) = 0, 'queue batch is claimed exactly once');
select tests.ok((select count(*) from audit_logs where entity = 'donation_submissions') >= 2 and exists (select 1 from audit_logs where entity = 'regional_appointments'), 'audit log records sensitive changes');

-- Removing an appointment revokes the role; unsubscribe works for the public
update regional_appointments set status = 'inactive' where user_id = :madurai;
select tests.root();
select tests.ok(not exists (select 1 from user_roles where user_id = :madurai and is_active), 'deactivating an appointment revokes the role');
select tests.login(null);
select tests.ok((select count(*) from public_appointments) = 1, 'inactive leader disappears from the public network');
select tests.root();
select tests.login(null);
select tests.ok(not unsubscribe(gen_random_uuid()), 'unknown unsubscribe token does nothing');
select tests.root();
select tests.ok((select unsubscribe(token) from notification_preferences where contact = 'anon@test'), 'unsubscribe marks the contact opted out');
\echo ALL PERMISSION TESTS PASSED
