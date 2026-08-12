insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('transaction-proofs', 'transaction-proofs', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('paper-proofs', 'paper-proofs', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('expense-receipts', 'expense-receipts', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('deposit-proofs', 'deposit-proofs', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Object names use `<record-uuid>/<generated-file-name>`. Metadata rows store the full object path.
create policy storage_admin_read on storage.objects for select to authenticated
  using (bucket_id in ('transaction-proofs','paper-proofs','expense-receipts','deposit-proofs') and public.is_admin());
create policy storage_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('transaction-proofs','paper-proofs','expense-receipts','deposit-proofs') and public.is_admin());
create policy storage_admin_update on storage.objects for update to authenticated
  using (bucket_id in ('transaction-proofs','paper-proofs','expense-receipts','deposit-proofs') and public.is_admin())
  with check (bucket_id in ('transaction-proofs','paper-proofs','expense-receipts','deposit-proofs') and public.is_admin());
create policy storage_admin_delete on storage.objects for delete to authenticated
  using (bucket_id in ('transaction-proofs','paper-proofs','expense-receipts','deposit-proofs') and public.is_admin());

create policy transaction_proof_sales_read on storage.objects for select to authenticated using (
  bucket_id = 'transaction-proofs' and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (select 1 from public.transactions t where t.id = ((storage.foldername(name))[1])::uuid and t.salesperson_id = auth.uid())
);
create policy transaction_proof_sales_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'transaction-proofs' and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.transactions t join public.business_days d on d.id = t.business_day_id
    where t.id = ((storage.foldername(name))[1])::uuid and t.salesperson_id = auth.uid() and d.status = 'OPEN'
  )
);

create policy paper_proof_sales_read on storage.objects for select to authenticated using (
  bucket_id = 'paper-proofs' and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (select 1 from public.business_days d where d.id = ((storage.foldername(name))[1])::uuid and d.salesperson_id = auth.uid())
);
create policy paper_proof_sales_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'paper-proofs' and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (select 1 from public.business_days d where d.id = ((storage.foldername(name))[1])::uuid and d.salesperson_id = auth.uid() and d.status = 'OPEN')
);

-- Expense and deposit evidence is admin-only in V1. No salesperson policy exists.
