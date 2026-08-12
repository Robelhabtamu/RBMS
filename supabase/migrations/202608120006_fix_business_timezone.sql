-- RedBooth timestamps remain timestamptz/UTC. Operational calendar dates use Ethiopia time explicitly.
create or replace function public.redbooth_business_date(p_instant timestamptz default now())
returns date
language sql stable
set search_path = ''
as $$
  select (p_instant at time zone 'Africa/Addis_Ababa')::date;
$$;

revoke all on function public.redbooth_business_date(timestamptz) from public;
grant execute on function public.redbooth_business_date(timestamptz) to authenticated;

alter table public.business_days alter column business_date set default public.redbooth_business_date();
alter table public.booth_assignments alter column start_date set default public.redbooth_business_date();
alter table public.expenses alter column expense_date set default public.redbooth_business_date();
alter table public.deposits alter column deposit_date set default public.redbooth_business_date();

create or replace function public.is_assigned_to_booth(
  p_booth_id uuid,
  p_user_id uuid default auth.uid(),
  p_on_date date default public.redbooth_business_date()
)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.booth_assignments a
    where a.booth_id = p_booth_id and a.salesperson_id = p_user_id and a.active
      and a.start_date <= p_on_date and (a.end_date is null or a.end_date >= p_on_date)
  );
$$;

create or replace function public.start_business_day(p_booth_id uuid, p_starting_paper integer)
returns public.business_days language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_business_date date := public.redbooth_business_date();
  v_day public.business_days;
begin
  if v_user is null or not public.is_active_salesperson(v_user) then
    raise exception 'Active salesperson required' using errcode = '42501';
  end if;
  if p_starting_paper < 0 then
    raise exception 'Starting paper cannot be negative' using errcode = '22023';
  end if;
  if not public.is_assigned_to_booth(p_booth_id, v_user, v_business_date) then
    raise exception 'Not assigned to this booth' using errcode = '42501';
  end if;

  perform 1 from public.booths where id = p_booth_id and status = 'ACTIVE' for update;
  if not found then raise exception 'Active booth not found'; end if;

  select * into v_day
  from public.business_days
  where booth_id = p_booth_id and business_date = v_business_date
  for update;

  if found then
    if v_day.status = 'OPEN' and v_day.salesperson_id = v_user then return v_day; end if;
    if v_day.status = 'OPEN' then
      raise exception 'Today''s business day is already open by another salesperson' using errcode = '42501';
    end if;
    raise exception 'Today''s business day has already been closed' using errcode = 'P0001';
  end if;

  insert into public.business_days (booth_id, salesperson_id, business_date, starting_paper)
  values (p_booth_id, v_user, v_business_date, p_starting_paper)
  returning * into v_day;

  if p_starting_paper > 0 then
    insert into public.paper_movements (business_day_id, movement_type, quantity, created_by)
    values (v_day.id, 'STARTING', p_starting_paper, v_user);
  end if;
  return v_day;
exception when unique_violation then
  select * into v_day
  from public.business_days
  where booth_id = p_booth_id and business_date = v_business_date;
  if found and v_day.status = 'OPEN' and v_day.salesperson_id = v_user then return v_day; end if;
  if found and v_day.status <> 'OPEN' then
    raise exception 'Today''s business day has already been closed' using errcode = 'P0001';
  end if;
  raise exception 'Today''s business day is already open' using errcode = '23505';
end;
$$;

revoke all on function public.start_business_day(uuid, integer) from public;
grant execute on function public.start_business_day(uuid, integer) to authenticated;

comment on function public.redbooth_business_date(timestamptz) is
  'Returns the RedBooth operational calendar date in Africa/Addis_Ababa while timestamps remain UTC.';
