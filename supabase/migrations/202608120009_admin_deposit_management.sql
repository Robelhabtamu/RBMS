-- Admin deposit projection, exact reconciliation summary, and audited status changes.
create or replace view public.admin_deposit_details with (security_invoker = true) as
select d.id, d.amount, d.source_type, d.destination_account_id,
  a.name as destination_account_name, a.account_type as destination_account_type,
  d.business_day_id, bd.business_date, bd.status as business_day_status,
  b.id as booth_id, b.name as booth_name, l.id as location_id, l.name as location_name,
  d.reference_number, d.proof_storage_path, d.deposit_date, d.status,
  d.created_by, p.full_name as created_by_name, d.created_at, d.updated_at
from public.deposits d
join public.revenue_accounts a on a.id = d.destination_account_id
join public.profiles p on p.id = d.created_by
left join public.business_days bd on bd.id = d.business_day_id
left join public.booths b on b.id = bd.booth_id
left join public.locations l on l.id = b.location_id;

grant select on public.admin_deposit_details to authenticated;

create or replace function public.admin_deposit_summary(
  p_date_from date, p_date_to date,
  p_location_id uuid default null, p_booth_id uuid default null,
  p_destination_account_id uuid default null, p_deposit_status text default null,
  p_source_type text default null, p_search text default null,
  p_business_day_id uuid default null
)
returns table (revenue_generated numeric, deposited numeric, pending numeric)
language sql stable security invoker set search_path = '' as $$
  with scoped_days as (
    select bd.id
    from public.business_days bd
    join public.booths b on b.id = bd.booth_id
    where bd.business_date between p_date_from and p_date_to
      and (p_location_id is null or b.location_id = p_location_id)
      and (p_booth_id is null or bd.booth_id = p_booth_id)
      and (p_business_day_id is null or bd.id = p_business_day_id)
  ), revenue as (
    select coalesce(sum(t.total_amount), 0)::numeric as amount
    from public.transactions t
    where t.status = 'COMPLETED' and t.business_day_id in (select id from scoped_days)
  ), confirmed as (
    select coalesce(sum(d.amount), 0)::numeric as amount
    from public.deposits d
    join public.revenue_accounts a on a.id = d.destination_account_id
    where d.status = 'CONFIRMED'
      and d.business_day_id in (select id from scoped_days)
      and (p_destination_account_id is null or d.destination_account_id = p_destination_account_id)
      and (p_deposit_status is null or p_deposit_status = 'CONFIRMED')
      and (p_source_type is null or d.source_type ilike p_source_type)
      and (p_search is null or d.reference_number ilike '%' || p_search || '%' or a.name ilike '%' || p_search || '%')
  )
  select revenue.amount, confirmed.amount, revenue.amount - confirmed.amount from revenue, confirmed;
$$;

revoke all on function public.admin_deposit_summary(date, date, uuid, uuid, uuid, text, text, text, uuid) from public;
grant execute on function public.admin_deposit_summary(date, date, uuid, uuid, uuid, text, text, text, uuid) to authenticated;

create or replace function public.admin_update_deposit_status(
  p_deposit_id uuid, p_status public.deposit_status, p_reason text default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare v_current public.deposit_status;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Admin access required' using errcode = '42501'; end if;
  if p_status not in ('CONFIRMED', 'CANCELLED') then raise exception 'Unsupported deposit status'; end if;
  if p_status = 'CANCELLED' and nullif(trim(p_reason), '') is null then raise exception 'A cancellation reason is required'; end if;

  select status into v_current from public.deposits where id = p_deposit_id for update;
  if not found then raise exception 'Deposit not found'; end if;
  if v_current = 'CANCELLED' then raise exception 'A cancelled deposit cannot be changed'; end if;
  if v_current = p_status then return; end if;
  if v_current = 'CONFIRMED' and p_status = 'CONFIRMED' then return; end if;

  perform set_config('app.audit_reason', coalesce(nullif(trim(p_reason), ''), 'Deposit confirmed by admin'), true);
  update public.deposits set status = p_status where id = p_deposit_id;
end;
$$;

revoke all on function public.admin_update_deposit_status(uuid, public.deposit_status, text) from public;
grant execute on function public.admin_update_deposit_status(uuid, public.deposit_status, text) to authenticated;
