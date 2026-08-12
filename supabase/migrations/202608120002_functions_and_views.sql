create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and role = 'ADMIN' and status = 'ACTIVE'
  );
$$;

create or replace function public.is_active_salesperson(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and role = 'SALESPERSON' and status = 'ACTIVE'
  );
$$;

create or replace function public.is_assigned_to_booth(p_booth_id uuid, p_user_id uuid default auth.uid(), p_on_date date default current_date)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.booth_assignments a
    where a.booth_id = p_booth_id and a.salesperson_id = p_user_id and a.active
      and a.start_date <= p_on_date and (a.end_date is null or a.end_date >= p_on_date)
  );
$$;

revoke all on function public.is_admin(uuid) from public;
revoke all on function public.is_active_salesperson(uuid) from public;
revoke all on function public.is_assigned_to_booth(uuid, uuid, date) from public;
grant execute on function public.is_admin(uuid), public.is_active_salesperson(uuid), public.is_assigned_to_booth(uuid, uuid, date) to authenticated;

create or replace function public.current_print_price()
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare v_price numeric;
begin
  select (value #>> '{}')::numeric into v_price from public.app_settings where key = 'current_print_price';
  if v_price is null or v_price < 0 then raise exception 'A valid current_print_price setting is required'; end if;
  return v_price;
end;
$$;
revoke all on function public.current_print_price() from public;
grant execute on function public.current_print_price() to authenticated;

create or replace function public.start_business_day(p_booth_id uuid, p_starting_paper integer)
returns public.business_days language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_day public.business_days;
begin
  if v_user is null or not public.is_active_salesperson(v_user) then raise exception 'Active salesperson required' using errcode = '42501'; end if;
  if p_starting_paper < 0 then raise exception 'Starting paper cannot be negative' using errcode = '22023'; end if;
  if not public.is_assigned_to_booth(p_booth_id, v_user, current_date) then raise exception 'Not assigned to this booth' using errcode = '42501'; end if;
  perform 1 from public.booths where id = p_booth_id and status = 'ACTIVE' for update;
  if not found then raise exception 'Active booth not found'; end if;

  insert into public.business_days (booth_id, salesperson_id, business_date, starting_paper)
  values (p_booth_id, v_user, current_date, p_starting_paper) returning * into v_day;
  if p_starting_paper > 0 then
    insert into public.paper_movements (business_day_id, movement_type, quantity, created_by)
    values (v_day.id, 'STARTING', p_starting_paper, v_user);
  end if;
  return v_day;
exception when unique_violation then
  raise exception 'A business day already exists for this booth and date' using errcode = '23505';
end;
$$;

create or replace function public.create_transaction(
  p_business_day_id uuid,
  p_transaction_type public.transaction_type,
  p_quantity integer,
  p_payment_method text
)
returns public.transactions language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_day public.business_days; v_price numeric; v_transaction public.transactions;
begin
  if v_user is null or not public.is_active_salesperson(v_user) then raise exception 'Active salesperson required' using errcode = '42501'; end if;
  if p_quantity <= 0 then raise exception 'Quantity must be greater than zero' using errcode = '22023'; end if;
  select * into v_day from public.business_days where id = p_business_day_id for update;
  if not found or v_day.status <> 'OPEN' then raise exception 'Open business day not found'; end if;
  if v_day.salesperson_id <> v_user or not public.is_assigned_to_booth(v_day.booth_id, v_user, v_day.business_date) then
    raise exception 'Business day is not accessible' using errcode = '42501';
  end if;
  if not exists (select 1 from public.payment_methods where code = p_payment_method and active) then raise exception 'Invalid payment method'; end if;
  v_price := public.current_print_price();
  insert into public.transactions (business_day_id, booth_id, salesperson_id, transaction_type, quantity, price_per_print, payment_method)
  values (v_day.id, v_day.booth_id, v_user, p_transaction_type, p_quantity, v_price, p_payment_method)
  returning * into v_transaction;
  return v_transaction;
end;
$$;

create or replace function public.business_day_totals(p_business_day_id uuid)
returns table (
  total_transactions bigint, sold_print_count bigint, revenue_total numeric,
  revenue_by_payment_method jsonb, total_added_paper bigint, total_faulty_paper bigint,
  expected_remaining_paper bigint, paper_difference bigint, expected_revenue numeric,
  recorded_revenue numeric, revenue_difference numeric, fully_balanced boolean
) language sql stable security invoker set search_path = '' as $$
  with d as (select * from public.business_days where id = p_business_day_id),
  tx as (
    select count(*) filter (where status = 'COMPLETED') total_transactions,
      coalesce(sum(quantity) filter (where status = 'COMPLETED'), 0)::bigint sold_print_count,
      coalesce(sum(total_amount) filter (where status = 'COMPLETED'), 0)::numeric revenue_total
    from public.transactions where business_day_id = p_business_day_id
  ), payments as (
    select coalesce(jsonb_object_agg(payment_method, amount), '{}'::jsonb) values
    from (select payment_method, sum(total_amount) amount from public.transactions where business_day_id = p_business_day_id and status = 'COMPLETED' group by payment_method) p
  ), paper as (
    select coalesce(sum(quantity) filter (where movement_type = 'ADDITION'), 0)::bigint added
    from public.paper_movements where business_day_id = p_business_day_id
  ), faulty as (
    select coalesce(sum(quantity), 0)::bigint total from public.faulty_paper_records where business_day_id = p_business_day_id
  )
  select tx.total_transactions, tx.sold_print_count, tx.revenue_total, payments.values, paper.added, faulty.total,
    (d.starting_paper + paper.added - tx.sold_print_count - faulty.total)::bigint,
    case when d.actual_remaining_paper is null then null else d.actual_remaining_paper - (d.starting_paper + paper.added - tx.sold_print_count - faulty.total) end,
    tx.revenue_total, coalesce(d.recorded_revenue, tx.revenue_total),
    case when d.recorded_revenue is null then 0 else d.recorded_revenue - tx.revenue_total end,
    d.actual_remaining_paper is not null
      and d.actual_remaining_paper = d.starting_paper + paper.added - tx.sold_print_count - faulty.total
      and coalesce(d.recorded_revenue, tx.revenue_total) = tx.revenue_total
  from d cross join tx cross join payments cross join paper cross join faulty;
$$;

create or replace function public.close_business_day(p_business_day_id uuid, p_actual_remaining_paper integer, p_closing_notes text default null)
returns public.business_days language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_day public.business_days; v_totals record; v_balanced boolean;
begin
  if p_actual_remaining_paper < 0 then raise exception 'Remaining paper cannot be negative' using errcode = '22023'; end if;
  select * into v_day from public.business_days where id = p_business_day_id for update;
  if not found or v_day.status <> 'OPEN' then raise exception 'Open business day not found'; end if;
  if not public.is_admin(v_user) and (v_day.salesperson_id <> v_user or not public.is_active_salesperson(v_user)) then
    raise exception 'Business day is not accessible' using errcode = '42501';
  end if;
  select * into v_totals from public.business_day_totals(p_business_day_id);
  v_balanced := p_actual_remaining_paper = v_totals.expected_remaining_paper;
  update public.business_days set
    actual_remaining_paper = p_actual_remaining_paper,
    paper_difference = p_actual_remaining_paper - v_totals.expected_remaining_paper,
    expected_revenue = v_totals.revenue_total,
    recorded_revenue = v_totals.revenue_total,
    revenue_difference = 0,
    closing_status = case when v_balanced then 'BALANCED'::public.closing_status else 'DISCREPANCY'::public.closing_status end,
    status = case when v_balanced then 'CLOSED'::public.business_day_status else 'CLOSED_WITH_DISCREPANCY'::public.business_day_status end,
    closing_notes = nullif(trim(p_closing_notes), ''), closed_at = now()
  where id = p_business_day_id returning * into v_day;
  return v_day;
end;
$$;

revoke all on function public.start_business_day(uuid, integer) from public;
revoke all on function public.create_transaction(uuid, public.transaction_type, integer, text) from public;
revoke all on function public.business_day_totals(uuid) from public;
revoke all on function public.close_business_day(uuid, integer, text) from public;
grant execute on function public.start_business_day(uuid, integer), public.create_transaction(uuid, public.transaction_type, integer, text), public.business_day_totals(uuid), public.close_business_day(uuid, integer, text) to authenticated;

create or replace view public.business_day_reconciliation with (security_invoker = true) as
select d.id business_day_id, d.booth_id, d.salesperson_id, d.business_date, d.status,
  t.total_transactions, t.sold_print_count, t.revenue_total, t.revenue_by_payment_method,
  t.total_added_paper, t.total_faulty_paper, t.expected_remaining_paper,
  t.paper_difference, t.expected_revenue, t.recorded_revenue, t.revenue_difference, t.fully_balanced
from public.business_days d cross join lateral public.business_day_totals(d.id) t;
