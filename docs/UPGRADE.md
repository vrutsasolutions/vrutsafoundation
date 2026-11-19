# Upgrade 2 — membership, three logins, ID cards, donation transparency

## A. Run it on localhost, step by step

The database part is already done: migration `0005_upgrade.sql` was applied to the Supabase project
`vrutsafoundation` on 16 November 2026. You do not need to run any SQL for it.

1. **Replace the project folder.** Unzip the new `vrutsa-foundation.zip`. Copy your existing `.env.local`
   from the old folder into the new one (it is the only file you made yourself).
2. **Check `.env.local`.** It needs these four lines filled in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://vmmvfffzhkxvzbihlqnn.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...        (Supabase → Project Settings → API Keys → anon / publishable)
   SUPABASE_SERVICE_ROLE_KEY=...            (same page → service_role / secret; new requirement, see below)
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
   Why the service key now: approving a District Representative creates a login for another person, which only
   the server may do. It never reaches the browser.
3. **Install and start.** In a terminal inside the project folder:
   ```
   npm install
   npm run dev
   ```
   Open http://localhost:3000. Restart `npm run dev` whenever you change `.env.local`.
4. **Supabase dashboard, once:** Authentication → URL Configuration → Site URL `http://localhost:3000`,
   and add `http://localhost:3000/**` under Redirect URLs. Without this, confirmation and set-password links fail.
5. **Email while testing.** Supabase's built-in email only delivers to the email addresses of your own Supabase
   team members, and only a few per hour. For local testing choose one:
   - register only with an address that is a member of your Supabase organisation, or
   - Authentication → Sign In / Providers → Email → switch **Confirm email** off (switch it back on before launch).
   For real use, set up custom SMTP (Authentication → Emails → SMTP Settings) — Resend works.
6. **Create the founder account (once).**
   1. Open http://localhost:3000/register and create an account with the founder's email.
   2. Supabase → SQL Editor → run (with that email):
      ```sql
      insert into public.user_roles (user_id, role_key)
      select id, 'super_admin' from public.profiles where email = 'founder-email-here';
      ```
   3. Go to http://localhost:3000/login → **Founder or admin** → sign in. You land on the founder dashboard.
7. **Try each flow.**
   | Do this | Expect |
   |---|---|
   | Founder: Website settings → add QR, UPI ID; Founder profile and content → fill founder details | Homepage and Donate page fill in |
   | Founder: Homepage slider → add 2 slides | Slider appears under the top of the homepage |
   | Signed out: Get involved → register a volunteer | "Registered" (or "confirm your email"); founder dashboard shows 1 volunteer |
   | As that volunteer: Login → Volunteer or member | ID card on the account page; Download ID card opens a PDF |
   | Scan the QR on the PDF (or open `/verify/...`) | "Valid: active member" |
   | Signed out: footer → Join as District Representative → complete the 4 steps | Reference number `DRA-…` |
   | Founder: Representative applications → Approve and create account | Profile appears on that district's page; a set-password link is shown (and emailed when email is set up) |
   | Open the set-password link in a private window → set password → Login → District Representative | District dashboard with only that district |
   | As representative: Volunteers | Only volunteers of their district; Suspend makes the QR page show "Not valid" |
   | Founder: Donations and reports → Verified → Record a donation | Donate page totals change; acknowledgement PDF created |
   | Founder: Email and WhatsApp | Every message listed. Without `RESEND_API_KEY` they show "Failed: Email is not configured", which is correct |

If a page shows "could not be loaded: … migration 0005", the app is pointing at a different Supabase project
than the one that was migrated; run `supabase/migrations/0005_upgrade.sql` in that project's SQL Editor.

## B. What changed

**Three access levels, one login page with three doors**
- `/login?as=member`, `?as=representative`, `?as=founder`. The door only routes; rights come from the database.
- Nobody can self-register as founder or representative.

**Volunteers (no manual approval)**
- `/get-involved` creates the account and the membership together. After email confirmation the membership is
  active, a membership ID (`VF-V-0000001`) is issued, the ID card is emailed, and the district's
  representative and the founder are notified by email.
- Duplicate email and duplicate mobile are refused. Volunteers must be 18 or older (see section D).
- Member portal `/account`: ID card, PDF download, email-me-my-card, editable contact details, their
  District Representative, announcements.
- Volunteers have no admin access.

**District Representatives**
- `/join-representative`: four-step form with progress bar, automatic age, conditional work fields,
  photograph, optional document, review step, reference number. Linked in the footer.
- Founder → Representative applications: full application, photograph, approve / under review / reject.
- Approve = login created (set-password link, no password is ever emailed) + public profile on the district
  page + district rights + membership ID (`VF-DR-0001`) + ID card email.
- Representative panel: district overview, volunteers (view, add, suspend, remove, flag), activities, events,
  media, announcements to their district, My profile, My notifications.
- Suspending or removing a representative (Volunteers and members → type: District Representatives) removes
  their rights and hides their profile.

**ID cards**
- PDF with logo, photograph, name, role, membership ID, district, state, joining date and a QR code.
- `/verify/<code>` shows Valid / Suspended / Closed from live records. No contact details or photograph are shown.

**Homepage**
- Top: foundation name and three buttons only.
- Slider directly below: up to 10 slides (database-enforced), image / GIF / video, heading, description,
  button, order, active switch, show-from / show-until dates.
- Three latest activities; Upcoming events and Past events as sliding rows; founder profile with quotation;
  featured District Representatives (tick "Feature on the homepage" on up to five; until then Chennai,
  Coimbatore, Madurai, Tiruchirappalli and Salem are shown when they have representatives).

**Activities**: newest first, filters Category + District + Year + Month working together, 12 per page.

**Donations**
- Founder can record a donation seen in the bank statement, correct it, or void it (reason required, history kept).
- The donor form with founder verification still exists.
- Public "Donation transparency" on `/donate`: verified donors and amount this month and this year, total,
  month-by-month and year-by-year tables, last-updated date. Only totals; zero is shown as zero.

**Notifications**
- Founder (email to `vrutsafoundation@gmail.com`, changeable in Website settings): new representative
  application, new volunteer, representative account created, representative profile updated, district
  activity/event published/edited/deleted, suspensions and removals. Volunteer and content alerts can be switched off.
- Representative (email): new volunteer in district with details and running count, suspensions and removals.
- Volunteer (email, plus WhatsApp if they opted in): welcome with ID card, membership status changes,
  event announcements, announcements.
- WhatsApp is never used for the founder or representatives.

**Database**: new tables `members`, `representative_applications`, `announcements`; new columns on
`hero_slides`, `regional_appointments`, `donation_submissions`; 21 new or replaced functions. See
`supabase/migrations/0005_upgrade.sql`. 101 permission tests pass on PostgreSQL 16 (`supabase/tests`).

**New routes**: `/join-representative`, `/verify/[token]`, `/auth/accept`, `/api/id-card`,
`/admin/applications`, `/admin/announcements`, `/admin/profile`, `/admin/inbox`.

**New environment variables**: `SUPABASE_SERVICE_ROLE_KEY` is now required for approvals;
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are optional (bot check).

## C. Tested and not tested

- Tested: production build and type check; all five migrations and 101 permission tests on a local PostgreSQL;
  the migration applied to your Supabase project and checked there (tables, functions, privileges, row
  security on every table); public pages in a browser with placeholder data; ID card and receipt PDFs.
- Not tested, because it needs a signed-in session against your project: registration, the three logins,
  approval and set-password link, photograph uploads, every admin page with real data, Resend and WhatsApp
  delivery. Section A step 7 is the test script. Expect a few small fixes on first run; send me the error
  text or a screenshot and I will send the corrected file.

## D. Decisions and limits you should know

1. **Media is still on Supabase Storage**, as you chose. Cloudflare R2 is not built. All uploads go through two
   small components (`src/components/uploads.tsx`), so the switch is contained when you want it.
2. **Volunteers and applicants must be 18 or older.** Your document did not set an age. Registering children
   needs verifiable parental consent under India's data protection law, so the form refuses under-18s. Say so if
   you want a different rule.
3. **No password is emailed.** Volunteers choose their own; representatives get a one-time set-password link.
4. **Annual income, house address and date of birth** are stored because the document asks for them. Income is
   optional and visible only to the founder; addresses are never public. Have the privacy policy cover this.
5. **Phone (OTP) verification is not built**; it needs a paid SMS provider. Email verification is in place.
6. **Bot protection** is Cloudflare Turnstile and is off until you add its two keys. Rate limits are always on.
7. **Two-step sign-in (MFA) for the founder is still not built.**
8. **ID card and receipt PDFs print Latin letters only**; Tamil names appear as "?".
9. **Announcements** are queued one member at a time. Fine for thousands; for hundreds of thousands this
   needs batching.
10. **Founder alerts for "system and security events"** are not built; the audit log records sensitive changes.
11. **Supabase's security advisor** lists the permission-check functions and the public leadership view as
    warnings. They are deliberate: each function checks the caller's role inside, and the view exists to hide
    private contact details.
12. The old "volunteer application with manual review" screen is gone; its table remains, empty.
13. WhatsApp templates to register for this upgrade: `vf_volunteer_welcome` ({{1}} name, {{2}} membership ID),
    `vf_membership_update` ({{1}} name, {{2}} membership ID, {{3}} status), `vf_announcement` ({{1}} subject,
    {{2}} message).
