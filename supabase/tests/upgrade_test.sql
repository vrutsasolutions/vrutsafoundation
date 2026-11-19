-- Permission tests for 0005_upgrade.sql. Run after rls_test.sql in the same database.
\set founder '''00000000-0000-0000-0000-00000000000a'''
\set chennai '''00000000-0000-0000-0000-00000000000b'''
\set vol     '''00000000-0000-0000-0000-00000000000d'''
select tests.root();
delete from notification_queue;
update foundation_settings set value = 'immediate' where key = 'publish_mode';

-- Volunteer self-registration through sign-up (email not yet confirmed)
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000f1', 'newvol@test',
  jsonb_build_object('register_as', 'volunteer', 'full_name', 'New Volunteer', 'phone', '9111111111', 'role', 'super_admin',
    'district_id', (select id from districts where slug = 'chennai'), 'whatsapp_opt_in', true, 'date_of_birth', '1999-05-01'));
select tests.ok((select status from members where email = 'newvol@test') = 'pending_email', 'sign-up creates a membership waiting for email confirmation');
select tests.ok((select membership_id from members where email = 'newvol@test') ~ '^VF-V-\d{7}$', 'membership ID is generated');
select tests.ok(not exists (select 1 from user_roles where user_id = '00000000-0000-0000-0000-0000000000f1'), 'volunteer sign-up grants no admin role');
select tests.ok(not exists (select 1 from notification_queue where template = 'volunteer_welcome'), 'no ID card before the email is confirmed');
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000000f1';
select tests.ok((select status from members where email = 'newvol@test') = 'active', 'confirming the email activates the membership');
select tests.ok((select count(*) from notification_queue where template = 'volunteer_welcome') = 2, 'welcome with ID card queued by email and WhatsApp (opted in)');
select tests.ok(exists (select 1 from notification_queue where template = 'rep_alert' and recipient = 'chennai@test'), 'district representative is told about the new volunteer');
select tests.ok(exists (select 1 from notification_queue where template = 'founder_alert' and recipient = 'vrutsafoundation@gmail.com'), 'founder is told about the new volunteer');
select tests.ok(not exists (select 1 from notification_queue where channel = 'whatsapp' and template in ('rep_alert','founder_alert','leadership_appointment')), 'no WhatsApp to founder or representatives');

-- Public: verification and duplicate check only
select tests.login(null);
select tests.ok((select count(*) from members) = 0, 'public cannot read members');
select tests.ok(volunteer_phone_taken('9111111111') and not volunteer_phone_taken('9000000000'), 'duplicate mobile check works');
select tests.ok(tests.fails($$select join_as_volunteer('{}'::jsonb)$$) and tests.fails($$select overview_stats()$$), 'public cannot join without an account or read dashboard figures');
select tests.root();
select tests.login(null);
select tests.ok(tests.fails($$select record_donation('x', 5, current_date, 'UTRZ1')$$), 'public cannot record donations');
select tests.ok((select (donation_stats()->'total'->>'donations')::int) = 1, 'public sees donation totals (1 verified so far)');
select tests.ok(donation_stats()::text !~ 'UTR|@test|donor_name', 'public totals contain no donor details');
select tests.root();
select tests.ok((select status from verify_member((select verify_token from members where email = 'newvol@test'))) = 'active', 'QR verification shows an active member');

-- The volunteer: own row only, contact fields only
select tests.login('00000000-0000-0000-0000-0000000000f1');
select tests.ok((select count(*) from members) = 1, 'member sees only their own membership');
update members set status = 'suspended', full_name = 'Hacked', membership_id = 'VF-DR-0001', member_type = 'district_representative', city = 'Adyar';
select tests.ok((select status = 'active' and full_name = 'New Volunteer' and membership_id like 'VF-V-%' and member_type = 'volunteer' and city = 'Adyar' from members),
  'member can change contact details but not status, name, ID or type');
select tests.ok(tests.fails($$insert into members (membership_id, full_name, district_id) select '', 'x', id from districts where slug = 'chennai'$$), 'member cannot add other members');
select tests.ok(tests.fails($$select send_announcement('t', 'b')$$) and tests.fails($$insert into activities (title, slug, district_id) select 'v', 'v2', district_id from members$$), 'volunteer cannot announce or publish');
select tests.ok(email_my_id_card() and not exists (select 1 from announcements), 'member can request the ID card by email');

-- A signed-in person without a membership joins directly
select tests.login('00000000-0000-0000-0000-00000000000e');
select tests.ok((select join_as_volunteer(jsonb_build_object('full_name', 'Donor Person', 'district_id', (select id from districts where slug = 'madurai')))) like 'VF-V-%', 'signed-in user can join as volunteer');
select tests.ok(tests.fails($$select join_as_volunteer(jsonb_build_object('full_name', 'Again', 'district_id', (select id from districts where slug = 'madurai')))$$), 'cannot join twice');

-- District representative: own district only
select tests.login(:chennai);
select tests.ok((select count(*) from members) = 1, 'representative sees volunteers of their own district only');
insert into members (membership_id, full_name, phone, district_id) select '', 'Added By Rep', '9222222222', id from districts where slug = 'chennai';
select tests.ok(tests.fails($$insert into members (membership_id, full_name, district_id) select '', 'x', id from districts where slug = 'madurai'$$), 'representative cannot add volunteers elsewhere');
select tests.ok(tests.fails($$insert into members (membership_id, full_name, district_id, member_type) select '', 'x', id, 'district_representative' from districts where slug = 'chennai'$$), 'representative cannot create representatives');
select tests.ok(tests.fails($$update members set district_id = (select id from districts where slug = 'madurai') where full_name = 'Added By Rep'$$), 'representative cannot move a volunteer away');
update members set status = 'suspended', status_note = 'policy' where email = 'newvol@test';
select tests.ok((select overview_stats((select id from districts where slug = 'chennai'))->>'volunteers')::int = 1, 'district figures count active volunteers');
select tests.ok(tests.fails($$select overview_stats()$$) and tests.fails($$select overview_stats((select id from districts where slug = 'madurai'))$$), 'representative cannot read other figures');
select tests.ok((select count(*) from representative_applications) = 0 and tests.fails($$select approve_representative(gen_random_uuid(), auth.uid())$$), 'representative cannot see or approve applications');
select tests.ok(tests.fails($$select record_donation('x', 5, current_date, 'UTRZ2')$$) and tests.fails($$select send_announcement('t', 'b')$$), 'representative cannot record donations or announce foundation-wide');
select tests.ok(send_announcement('District meeting', 'Details', (select id from districts where slug = 'chennai')) = 1, 'representative can announce to own district');
select tests.ok(update_my_rep_profile('My intro', 'My experience', 'chennai@test', '9000000001', true, null) = 1, 'representative can update their own profile');
insert into activities (title, slug, district_id, publish_status) select 'Rep activity', 'rep-activity', id, 'published' from districts where slug = 'chennai';
select tests.root();
select tests.ok((select status from verify_member((select verify_token from members where email = 'newvol@test'))) = 'suspended', 'a suspended ID card verifies as suspended');
select tests.ok(exists (select 1 from notification_queue where template = 'membership_update'), 'member is told about the suspension');
select tests.ok(exists (select 1 from audit_logs where entity = 'members' and action = 'update'), 'suspension is in the audit log');
select tests.ok(exists (select 1 from notification_queue where template = 'founder_alert' and payload->>'title' like 'Activity published%'), 'founder is told about district activity');
select tests.ok(exists (select 1 from notification_queue where template = 'founder_alert' and payload->>'title' like 'Representative profile updated%'), 'founder is told about profile updates');

-- Representative application → founder approval
select tests.login(null);
insert into representative_applications (full_name, date_of_birth, email, phone, district_id, employment_type, introduction, ngo_experience, annual_income, address)
  select 'Applicant One', '1990-01-01', 'applicant@test', '9333333333', id, 'salaried', 'Intro', 'Experience', '5-10 lakh', 'Private address' from districts where slug = 'salem';
select tests.ok(tests.fails($$insert into representative_applications (full_name, date_of_birth, email, phone, district_id, employment_type, status) select 'x','1990-01-01','y@test','1',id,'other','approved' from districts limit 1$$), 'public cannot submit a pre-approved application');
select tests.ok((select count(*) from representative_applications) = 0, 'public cannot read applications');
select tests.root();
select tests.ok(exists (select 1 from notification_queue where template = 'rep_application_received') and exists (select 1 from notification_queue where template = 'founder_alert' and payload->>'title' like 'New District Representative application%'), 'applicant acknowledged and founder notified');
insert into auth.users (id, email, email_confirmed_at) values ('00000000-0000-0000-0000-0000000000f2', 'applicant@test', now());
select tests.login(:founder);
select approve_representative((select id from representative_applications), '00000000-0000-0000-0000-0000000000f2', 'https://x/p.jpg') is not null as approved;
select tests.root();
select tests.ok(exists (select 1 from user_roles where user_id = '00000000-0000-0000-0000-0000000000f2' and role_key = 'district_president' and is_active), 'approval grants the district role');
select tests.ok((select membership_id from members where user_id = '00000000-0000-0000-0000-0000000000f2') ~ '^VF-DR-\d{4}$', 'representative gets a membership ID');
select tests.ok(exists (select 1 from notification_queue where template = 'representative_welcome') and not exists (select 1 from notification_queue where template = 'leadership_appointment' and recipient = 'applicant@test'), 'one welcome with ID card, no duplicate appointment mail');
select tests.login(null);
select tests.ok(exists (select 1 from public_appointments where full_name = 'Applicant One' and email is null and experience is not null), 'new representative is public, private details hidden');
select tests.login(:founder);
update members set status = 'suspended', status_note = 'test' where user_id = '00000000-0000-0000-0000-0000000000f2';
select tests.root();
select tests.ok(not exists (select 1 from user_roles where user_id = '00000000-0000-0000-0000-0000000000f2' and is_active), 'suspending a representative removes their admin rights');

-- Founder: donations entry, correction, totals; slider limit; announcements
select tests.login(:founder);
select record_donation('Bank Donor', 2500, current_date, 'NEFT000111', null, null, 'General', 'statement 16 Nov') is not null as recorded;
select tests.ok((donation_stats()->'month'->>'amount')::numeric = 3500 and (donation_stats()->'month'->>'donors')::int = 2, 'totals update after the founder records a donation');
select correct_donation((select id from donation_submissions where utr = 'NEFT000111'), 2000, current_date, 'typing error');
select tests.ok((donation_stats()->'total'->>'amount')::numeric = 3000, 'correction changes the totals');
select void_donation((select id from donation_submissions where utr = 'NEFT000111'), 'entered twice');
select tests.ok((donation_stats()->'total'->>'amount')::numeric = 1000 and (select count(*) from donation_verifications where action in ('corrected','voided')) = 2, 'voiding removes it from totals and keeps the history');
select tests.ok(tests.fails($$select record_donation('Dup', 1, current_date, 'utr123456789')$$), 'a UTR cannot be recorded twice');
select tests.ok(send_announcement('Hello', 'Message to all') >= 2, 'founder can announce to everyone');
select tests.ok((overview_stats()->>'pending_applications')::int = 0 and jsonb_array_length(overview_stats()->'monthly_volunteers') = 6, 'founder dashboard figures');
insert into hero_slides (image_url) select 'https://x/' || g || '.jpg' from generate_series(1, 10) g;
select tests.ok(tests.fails($$insert into hero_slides (image_url) values ('https://x/11.jpg')$$), 'slider is limited to 10 slides');
select tests.login('00000000-0000-0000-0000-00000000000e');
select tests.ok((select count(*) from announcements) = 1, 'member sees foundation announcements, not other districts');
select tests.root();
\echo ALL UPGRADE TESTS PASSED
