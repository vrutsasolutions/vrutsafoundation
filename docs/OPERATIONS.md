# Vrutsa Foundation — setup, operation and handover

## 1. Connect Supabase (about 20 minutes)

1. Create a Supabase project (region: Mumbai `ap-south-1`).
2. SQL Editor → run these files in order, each as one query:
   `supabase/migrations/0001_schema.sql`, `0002_security.sql`, `0003_notifications.sql`, `0004_storage.sql`, then `supabase/seed.sql`.
   The seed adds Tamil Nadu, its 38 districts and operating defaults. It adds no people, programmes or figures.
   Do **not** run anything in `supabase/tests/` on Supabase; those files are for a local PostgreSQL only.
3. Authentication → URL Configuration: Site URL = your website address; add `<site>/auth/callback` to Redirect URLs.
4. Authentication → Providers → Email: keep "Confirm email" on. Authentication → Policies: minimum password length 10.
5. Authentication → Emails → SMTP: add your own SMTP (Resend provides one). The built-in sender is rate-limited
   and meant for testing only.
6. Copy `.env.example` to `.env.local` and fill in the URL, anon key, service role key, site URL and a long random `CRON_SECRET`.

## 2. Create the founder account

Nobody can register as an administrator. The first founder is created once, by hand:

1. Open the website → Login → Create an account, using the founder's email. Confirm the email.
2. Supabase → SQL Editor:
   ```sql
   insert into public.user_roles (user_id, role_key)
   select id, 'super_admin' from public.profiles where email = 'founder@your-domain';
   ```
3. Sign in again. The account page now shows "Open admin panel".

Every later administrator is created inside the panel: the person registers normally, then the founder either
adds a **Leadership appointment** with their login email (public profile + rights in one step) or grants a role
under **Users and permissions**.

## 3. Deploy (Vercel)

1. Push the project to a Git repository and import it in Vercel.
2. Add every variable from `.env.example` in Project → Settings → Environment Variables. Only the three
   `NEXT_PUBLIC_` values reach the browser.
3. Deploy, then set `NEXT_PUBLIC_SITE_URL` and the Supabase Site URL to the final domain and redeploy.
4. Scheduler for notifications: `vercel.json` calls `/api/notifications/process` once a day (the limit on Vercel's
   free plan). For prompt delivery call the same address every 5 minutes from any scheduler, with the header
   `Authorization: Bearer <CRON_SECRET>`. Supabase can do it itself with the `pg_cron` and `pg_net` extensions:
   ```sql
   select cron.schedule('send-notifications', '*/5 * * * *', $$
     select net.http_post(url := 'https://YOUR-DOMAIN/api/notifications/process',
                          headers := '{"Authorization":"Bearer YOUR_CRON_SECRET"}'::jsonb) $$);
   ```
   The founder can also press **Send queued messages now** in the panel at any time.

Any Node 20+ host works the same way: `npm run build`, `npm start`.

## 4. First content (founder, in the admin panel)

| Where | What to enter |
|---|---|
| Website content | Mission statement, descriptions, about text, founder message, privacy policy, terms |
| Homepage slides | 3–5 landscape photographs of real foundation work |
| Focus areas | The foundation's programme categories |
| Settings | Official UPI QR, account name, UPI ID, bank details, contact details, social links, publishing rule |
| Districts | Adjust coordinates, add official office addresses, add other states when needed |
| Leadership appointments | One entry per representative |

Until these are entered the public pages show neutral "will be published here" notes. Nothing is invented.

## 5. Donation verification procedure

1. A donor pays the foundation's account directly and submits the form. The entry appears under
   **Donations and receipts → Pending verification**. The donor sees and is emailed "pending verification".
2. Open the foundation's bank or UPI statement. Find the same **UTR, amount and date**. The donor's screenshot is
   supporting information only; screenshots are easy to fake.
3. Found: tick the confirmation box and press **Verify and issue acknowledgement**. The system assigns the next
   number (`VF-YYYY-000001`), creates the PDF, stores it privately and queues it to the donor.
4. Not found: enter a reason and press **Reject**. The donor is told and can reply with details.
5. Each UTR can be submitted once. Verification cannot be done twice. Every step is in the audit log.

Tax and foreign-contribution wording: the website and the PDF make **no** tax-benefit claim; the PDF says it is not
a certificate for income-tax deduction. The requirements for 80G and FCRA were not researched or verified as part of
this build. Before adding any such wording or accepting money from outside India, have the foundation's chartered
accountant confirm its current registrations and the wording and certificates the law requires. The donate page
states that only contributions in rupees from Indian bank accounts are accepted.

## 6. Email (Resend)

1. Create a Resend account, add and verify your domain (DNS records).
2. Set `RESEND_API_KEY` and `EMAIL_FROM` (an address on the verified domain). Redeploy.
3. Admin → Email and WhatsApp shows whether keys are present; delivery is reported per message.

Emails sent: welcome, volunteer application received / approved, leadership appointment, donation confirmation
received, donation acknowledgement (PDF attached), donation not verified, event registration, event announcement,
event update or cancellation, event reminder (24 hours before, to registered people).

## 7. WhatsApp Business Platform

Needs a Meta Business account, a phone number registered on the WhatsApp Business Platform (Cloud API), a permanent
access token and **approved templates**. Nothing is sent until all of that exists; messages for people who opted in
wait in the queue with the reason shown.

Create these templates in WhatsApp Manager with exactly these names and body variables (category Utility, except the
announcement, which is Marketing). Suggested wording:

| Template name | Body |
|---|---|
| `vf_volunteer_received` | Hello {{1}}, Vrutsa Foundation has received your volunteer application. We will contact you after review. |
| `vf_volunteer_approved` | Hello {{1}}, your volunteer application with Vrutsa Foundation is approved for {{2}}. A coordinator will contact you. |
| `vf_leadership_appointment` | Hello {{1}}, you have been appointed as {{2}} for {{3}} at Vrutsa Foundation. |
| `vf_event_announcement` | Vrutsa Foundation event: {{1}} on {{2}} at {{3}}. |
| `vf_event_update` | Update for {{1}}: {{2}}. Please check the event page for details. |
| `vf_event_reminder` | Reminder: {{1}} is on {{2}} at {{3}}. |
| `vf_event_registration` | Hello {{1}}, you are registered for {{2}} on {{3}}. |
| `vf_donation_received` | Hello {{1}}, we received your confirmation for {{2}} (reference {{3}}). It is pending verification against our bank records. |
| `vf_donation_acknowledgement` | Hello {{1}}, your contribution of {{2}} to Vrutsa Foundation is verified. Acknowledgement number {{3}} has been emailed to you. |
| `vf_donation_not_verified` | Hello {{1}}, we could not verify donation reference {{2}} against our bank records. Please reply to our email with the transaction details. |

Then set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_LANG` and redeploy. WhatsApp is
used only for people who ticked the WhatsApp box on a form. Only template messages are sent, so the 24-hour
customer-service window does not apply; free-form replies are not part of this build.

## 8. How the pieces behave

- **Publishing.** Settings → Publishing decides what "Publish" means for district administrators: send for approval
  (default), publish immediately, or keep as draft. Volunteer reports always wait for approval. The founder approves
  from the list with one button. Edits to an item that is already published stay published.
- **District limits.** A district administrator's menus list only their district, and the database refuses writes
  to any other district regardless of what the browser sends.
- **Appointments.** Active + public shows the profile on the district page. Linking a login email grants the role;
  setting the appointment inactive or changing its district removes the old rights.
- **Events.** Upcoming / Completed / Cancelled is derived from the dates and the cancel switch.
- **Notifications.** Database triggers add one row per person per event per channel to the queue; the worker sends,
  retries failures with increasing delays (5 attempts) and logs every attempt. Announcements carry an unsubscribe link.
- **Audit log.** Written by database triggers for roles, appointments, donations, receipts, settings, districts,
  activities, events and volunteer decisions.

## 9. Test checklist before launch

Run through this on the live project; none of it could be exercised without your accounts.

- [ ] Register, confirm email, sign in, reset password.
- [ ] Founder: add a focus area, a slide, website content; confirm they appear on the public site.
- [ ] Founder: appoint a district president with a linked login.
- [ ] As that president: create an activity and an event for the district; upload photographs and a video; confirm
      another district cannot be chosen; confirm Donations, Settings and Users are not reachable.
- [ ] Founder: approve the pending items; they appear publicly, on the district page and on the map.
- [ ] Public: submit a volunteer application with a photograph; president reviews and approves.
- [ ] Public: register for an event; registration appears on the event's admin page.
- [ ] Public: submit a donation confirmation with a real UTR; verify it; open the PDF; confirm the email arrives.
- [ ] Submit the same UTR again: it is refused.
- [ ] Email and WhatsApp page: messages show Sent, or a clear failure reason.
- [ ] Phone and tablet: menu, forms, donate flow, map.

Database permission tests (already passing on PostgreSQL 16) can be re-run locally:
```bash
createdb vrutsa_test && cd supabase
for f in tests/00_supabase_stub.sql migrations/000*.sql seed.sql tests/rls_test.sql; do psql -v ON_ERROR_STOP=1 -d vrutsa_test -f $f; done
```

## 10. Security checklist

- [x] Row Level Security on every table; public role can read published content only.
- [x] Admin rights only from `user_roles`, writable only by the founder; sign-up data cannot grant a role.
- [x] Donation status changes only through founder-only database functions.
- [x] Service role key used only by the notification worker route; never sent to the browser.
- [x] Public forms: server-side validation, hidden bot field, per-IP limit, database limit of 5 per email per hour.
- [x] Uploads: type and size limits on each bucket; payment proofs, applicant photographs and receipts are private
      and opened through 60-second signed links.
- [x] Leader contact details hidden from the public unless "show contact" is ticked; no home addresses stored.
- [x] Security headers; admin and account pages excluded from search engines.
- [x] Audit log written by the database.
- [ ] **You:** turn on Supabase database backups (daily backups come with the Pro plan; on the free plan export weekly).
- [ ] **You:** enable leaked-password protection and CAPTCHA in Supabase Auth settings if available on your plan.
- [ ] **You:** keep the founder account on a unique password and a mailbox with two-step sign-in.
- [ ] **You:** have the privacy policy and terms reviewed, including India's DPDP Act obligations.

## 11. Known limitations

1. **Not run against a live Supabase project.** The build, the database rules and the public pages were tested; sign-in,
   the admin panel with real data, storage uploads, Resend and WhatsApp were not. Expect small fixes on first connection.
2. **No two-step sign-in (MFA) screen yet** for the founder and administrators. Supabase supports TOTP; adding the
   enrolment and challenge screens is the first recommended follow-up.
3. **Receipt PDFs use Latin characters only.** Names typed in Tamil or other scripts print as "?" on the PDF.
   Fix: embed a Unicode font with a shaping-capable PDF library.
4. **Reference research** was done from indexed pages, not a live visual walkthrough (see `PLAN.md`).
5. **Donation matching is manual.** A static QR cannot tell the website that money arrived.
6. **No broadcast tool** for general foundation announcements; event announcements and updates are covered.
7. **The in-memory rate limit** is per server instance; the database limit is the firm one.
8. **Editing published content** by a district administrator does not go back through approval.
9. **Media deletion** removes the database entry and the file for items uploaded through an activity or event;
   files replaced in single-image fields remain in storage until removed in the Supabase dashboard.
10. **Map tiles** come from OpenStreetMap's public servers, which are for light use. If traffic grows, move to a
    tile provider with a service agreement.
11. Not built: advanced analytics, volunteer performance reports, advanced search, detailed donation reports, CSV export.

## 12. Mobile app path

The app talks to the same Supabase project with the anon key and the user's session:

| Need | Reuse |
|---|---|
| Sign-in, profiles | Supabase Auth, `profiles` |
| Hierarchy, districts, leaders | `roles`, `user_roles`, `districts`, view `public_appointments` |
| Activities, events, media | same tables and storage bucket `media` |
| Donate | insert into `donation_submissions`; upload proof to `private-uploads/proofs/` |
| Volunteer, event registration | insert into `volunteer_applications`, `event_registrations` |
| Admin actions | same tables under RLS; `verify_donation`, `reject_donation`, `enqueue_event_notice` functions |
| Notifications | same queue; add a `push` channel and a device-token table |

Two things run in Next.js today and would need an endpoint for the app: receipt PDF creation
(`src/lib/receipt.ts`) and the notification worker. Both are plain server functions that can move to Supabase
Edge Functions unchanged in logic.

## 13. Roadmap

Next: MFA screens, Unicode receipts, CSV exports, donation reports, announcement broadcast.
Later: volunteer attendance and tasks, district dashboards, partner portal, Tamil language, bank-feed
reconciliation through an authorised bank integration, Android and iOS apps.
