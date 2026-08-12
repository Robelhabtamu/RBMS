-- Extends the read-only Admin transaction summary for Daily Operations drill-down.
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
  p_search text default null,
  p_business_day_id uuid default null
)
returns table (transaction_count bigint, print_count bigint, revenue_total numeric)
language sql stable security invoker set search_path = '' as $$
  select count(*)::bigint, coalesce(sum(v.quantity), 0)::bigint,
    coalesce(sum(v.total_amount) filter (where v.status = 'COMPLETED'), 0)::numeric
  from public.admin_transaction_details v
  where v.business_date between p_date_from and p_date_to
    and (p_business_day_id is null or v.business_day_id = p_business_day_id)
    and (p_location_id is null or v.location_id = p_location_id)
    and (p_booth_id is null or v.booth_id = p_booth_id)
    and (p_salesperson_id is null or v.salesperson_id = p_salesperson_id)
    and (p_payment_method is null or v.payment_method = p_payment_method)
    and (p_transaction_type is null or v.transaction_type::text = p_transaction_type)
    and (p_status is null or v.status::text = p_status)
    and (p_verification is null
      or (p_verification = 'VERIFIED' and v.proof_id is not null)
      or (p_verification = 'MISSING_PROOF' and v.payment_method in ('CBE', 'TELEBIRR') and v.proof_id is null))
    and (p_search is null or v.transaction_number ilike '%' || p_search || '%');
$$;

revoke all on function public.admin_transaction_summary(date, date, uuid, uuid, uuid, text, text, text, text, text, uuid) from public;
grant execute on function public.admin_transaction_summary(date, date, uuid, uuid, uuid, text, text, text, text, text, uuid) to authenticated;
