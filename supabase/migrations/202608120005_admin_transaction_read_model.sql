-- Read-only Admin transaction projection. security_invoker preserves underlying RLS.
create or replace view public.admin_transaction_details with (security_invoker = true) as
select
  t.id,
  t.transaction_number,
  t.business_day_id,
  d.business_date,
  t.created_at,
  t.updated_at,
  t.booth_id,
  b.name as booth_name,
  b.code as booth_code,
  l.id as location_id,
  l.name as location_name,
  t.salesperson_id,
  p.full_name as salesperson_name,
  t.transaction_type,
  t.quantity,
  t.price_per_print,
  t.total_amount,
  t.payment_method,
  t.status,
  proof.id as proof_id,
  proof.storage_path as proof_storage_path,
  proof.created_at as proof_created_at
from public.transactions t
join public.business_days d on d.id = t.business_day_id
join public.booths b on b.id = t.booth_id
join public.locations l on l.id = b.location_id
join public.profiles p on p.id = t.salesperson_id
left join lateral (
  select tp.id, tp.storage_path, tp.created_at
  from public.transaction_proofs tp
  where tp.transaction_id = t.id
  order by tp.created_at
  limit 1
) proof on true;

grant select on public.admin_transaction_details to authenticated;

create or replace function public.admin_transaction_summary(
  p_date_from date,
  p_date_to date,
  p_location_id uuid default null,
  p_booth_id uuid default null,
  p_salesperson_id uuid default null,
  p_payment_method text default null,
  p_transaction_type text default null,
  p_status text default null,
  p_verification text default null,
  p_search text default null
)
returns table (transaction_count bigint, print_count bigint, revenue_total numeric)
language sql stable security invoker set search_path = '' as $$
  select
    count(*)::bigint,
    coalesce(sum(v.quantity), 0)::bigint,
    coalesce(sum(v.total_amount) filter (where v.status = 'COMPLETED'), 0)::numeric
  from public.admin_transaction_details v
  where v.business_date between p_date_from and p_date_to
    and (p_location_id is null or v.location_id = p_location_id)
    and (p_booth_id is null or v.booth_id = p_booth_id)
    and (p_salesperson_id is null or v.salesperson_id = p_salesperson_id)
    and (p_payment_method is null or v.payment_method = p_payment_method)
    and (p_transaction_type is null or v.transaction_type::text = p_transaction_type)
    and (p_status is null or v.status::text = p_status)
    and (
      p_verification is null
      or (p_verification = 'VERIFIED' and v.proof_id is not null)
      or (p_verification = 'MISSING_PROOF' and v.payment_method in ('CBE', 'TELEBIRR') and v.proof_id is null)
    )
    and (p_search is null or v.transaction_number ilike '%' || p_search || '%');
$$;

revoke all on function public.admin_transaction_summary(date, date, uuid, uuid, uuid, text, text, text, text, text) from public;
grant execute on function public.admin_transaction_summary(date, date, uuid, uuid, uuid, text, text, text, text, text) to authenticated;
