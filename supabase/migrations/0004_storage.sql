-- VRUTSA FOUNDATION — storage buckets and their access rules.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('media', 'media', true, 52428800,
     array['image/jpeg','image/png','image/webp','video/mp4','video/webm','application/pdf']),
  ('private-uploads', 'private-uploads', false, 5242880,
     array['image/jpeg','image/png','image/webp','application/pdf']),
  ('receipts', 'receipts', false, 2097152, array['application/pdf'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- media: public photographs, posters, videos, the donation QR. Staff upload; founder and managers remove.
create policy "media read"   on storage.objects for select using (bucket_id = 'media');
create policy "media insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_staff());
create policy "media update" on storage.objects for update to authenticated
  using (bucket_id = 'media' and (public.is_manager() or owner = auth.uid()));
create policy "media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (public.is_manager() or owner = auth.uid()));

-- private-uploads: payment proofs and applicant photographs. Anyone can add; nobody public can read.
create policy "private insert" on storage.objects for insert
  with check (bucket_id = 'private-uploads' and (name like 'proofs/%' or name like 'applicants/%'));
create policy "private read" on storage.objects for select to authenticated
  using (bucket_id = 'private-uploads'
         and (public.is_super_admin() or (name like 'applicants/%' and public.is_manager())));
create policy "private delete" on storage.objects for delete to authenticated
  using (bucket_id = 'private-uploads' and public.is_super_admin());

-- receipts: founder writes; a signed-in donor can read their own.
create policy "receipts founder" on storage.objects for all to authenticated
  using (bucket_id = 'receipts' and public.is_super_admin())
  with check (bucket_id = 'receipts' and public.is_super_admin());
create policy "receipts own" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and exists (
    select 1 from public.donation_receipts r join public.donation_submissions s on s.id = r.submission_id
     where r.pdf_path = name and s.user_id = auth.uid()));
