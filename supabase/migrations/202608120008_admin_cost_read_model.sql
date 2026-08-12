-- Read-only Admin cost projection and exact filtered totals. Underlying table RLS remains authoritative.
create or replace view public.admin_cost_details with (security_invoker = true) as
select e.id, e.expense_date, e.expense_category_id, c.name as category_name,
  e.description, e.amount, e.payment_source, e.receipt_storage_path,
  e.business_day_id, e.booth_id, b.name as booth_name,
  l.id as location_id, l.name as location_name,
  e.created_by, p.full_name as created_by_name, e.created_at, e.updated_at
from public.expenses e
join public.expense_categories c on c.id = e.expense_category_id
join public.profiles p on p.id = e.created_by
left join public.booths b on b.id = e.booth_id
left join public.locations l on l.id = b.location_id;

grant select on public.admin_cost_details to authenticated;

create or replace function public.admin_cost_summary(
  p_date_from date, p_date_to date,
  p_location_id uuid default null, p_booth_id uuid default null,
  p_category_id uuid default null, p_payment_source text default null,
  p_search text default null, p_business_day_id uuid default null
)
returns table (cost_count bigint, total_cost numeric, largest_cost numeric)
language sql stable security invoker set search_path = '' as $$
  select count(*)::bigint, coalesce(sum(v.amount), 0)::numeric, coalesce(max(v.amount), 0)::numeric
  from public.admin_cost_details v
  where v.expense_date between p_date_from and p_date_to
    and (p_location_id is null or v.location_id = p_location_id)
    and (p_booth_id is null or v.booth_id = p_booth_id)
    and (p_category_id is null or v.expense_category_id = p_category_id)
    and (p_payment_source is null or v.payment_source ilike p_payment_source)
    and (p_search is null or v.description ilike '%' || p_search || '%')
    and (p_business_day_id is null or v.business_day_id = p_business_day_id);
$$;

revoke all on function public.admin_cost_summary(date, date, uuid, uuid, uuid, text, text, uuid) from public;
grant execute on function public.admin_cost_summary(date, date, uuid, uuid, uuid, text, text, uuid) to authenticated;
