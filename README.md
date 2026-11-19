# Vrutsa Foundation website

Public website, member accounts and a role-scoped admin panel for Vrutsa Foundation.
Next.js (App Router) + Tailwind CSS on the front, Supabase (PostgreSQL, Auth, Storage) behind it,
Leaflet + OpenStreetMap for maps, Resend for email, WhatsApp Business Platform for WhatsApp.

## Start here

0. `docs/UPGRADE.md` — the latest changes (membership, three logins, ID cards, donation transparency) and the localhost run steps.
1. `docs/PLAN.md` — research comparison, sitemap, wireframe, journeys, hierarchy, permission matrix, schema, architecture, 3-day plan, accounts you need.
2. `docs/OPERATIONS.md` — connect Supabase, create the founder account, deploy, set up email and WhatsApp, verify donations, security checklist, known limitations, mobile-app path.

## Quick start

```bash
npm install
cp .env.example .env.local        # fill in the Supabase URL and anon key
# In Supabase → SQL Editor run, in order:
#   supabase/migrations/0001_schema.sql, 0002_security.sql, 0003_notifications.sql, 0004_storage.sql, 0005_upgrade.sql
#   supabase/seed.sql
npm run dev                       # http://localhost:3000
```

Without Supabase keys the site still runs and shows empty states with a setup banner.

## Layout

```
supabase/migrations   schema, permissions (RLS), notification queue, storage rules
supabase/seed.sql     Tamil Nadu + 38 districts, operating defaults (no foundation content)
supabase/tests        permission tests that run on a plain local PostgreSQL
src/app/(site)        public pages and member account
src/app/admin         admin panel
src/app/actions       server actions (public forms, auth, admin)
src/app/api           notification worker, private file links
src/lib               data access, permissions, receipts, notifications, module definitions
src/components        interface components
```

## What is tested and what is not

- Tested here: production build and type check; all five migrations plus 101 permission tests on PostgreSQL 16
  (`supabase/tests`); public pages rendered in a browser against placeholder data; receipt PDF generation.
- Not tested here (needs your accounts): the live Supabase project, sign-in, the admin panel against real data,
  Supabase Storage uploads, Resend delivery, WhatsApp delivery. Follow the checklist in `docs/OPERATIONS.md` §9.
