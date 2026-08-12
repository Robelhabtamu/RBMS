-- RLS-preserving Admin booth projections and guarded status changes.
create or replace view public.admin_booth_details with (security_invoker = true) as
select b.id, b.name, b.code, b.status, b.location_id, l.name as location_name,
  assignment.salesperson_id, assignment.salesperson_name,
  day.id as business_day_id, coalesce(day.status::text, 'NOT_STARTED') as operational_state,
  coalesce(day.revenue, 0)::numeric as today_revenue, coalesce(day.prints, 0)::bigint as today_prints,
  coalesce(day.paper_status, 'Not started') as paper_status, coalesce(day.closing_status, latest.closing_status) as closing_status, day.started_at, day.closed_at,
  b.created_at, b.updated_at
from public.booths b join public.locations l on l.id=b.location_id
left join lateral (
  select a.salesperson_id, p.full_name as salesperson_name
  from public.booth_assignments a join public.profiles p on p.id=a.salesperson_id
  where a.booth_id=b.id and a.active and a.start_date <= (now() at time zone 'Africa/Addis_Ababa')::date
    and (a.end_date is null or a.end_date >= (now() at time zone 'Africa/Addis_Ababa')::date)
  order by a.start_date desc limit 1
) assignment on true
left join lateral (
  select bd.id, bd.status, bd.closing_status, bd.started_at, bd.closed_at,
    coalesce(t.revenue,0)::numeric revenue, coalesce(t.prints,0)::bigint prints,
    case when bd.status='OPEN' then (bd.starting_paper+coalesce(pm.added,0)-coalesce(t.prints,0)-coalesce(fp.faulty,0))::text||' expected'
      when coalesce(bd.paper_difference,0)=0 then 'Balanced'
      else 'Difference '||case when bd.paper_difference>0 then '+' else '' end||bd.paper_difference::text end paper_status
  from public.business_days bd
  left join lateral (select sum(total_amount) revenue,sum(quantity) prints from public.transactions where business_day_id=bd.id and status='COMPLETED') t on true
  left join lateral (select sum(quantity) added from public.paper_movements where business_day_id=bd.id and movement_type='ADDITION') pm on true
  left join lateral (select sum(quantity) faulty from public.faulty_paper_records where business_day_id=bd.id) fp on true
  where bd.booth_id=b.id and bd.business_date=(now() at time zone 'Africa/Addis_Ababa')::date limit 1
) day on true
left join lateral (
  select bd.closing_status from public.business_days bd
  where bd.booth_id=b.id and bd.closing_status is not null order by bd.business_date desc limit 1
) latest on true;

create or replace view public.admin_booth_history with (security_invoker = true) as
select bd.id as business_day_id, bd.booth_id, bd.business_date, bd.status, p.full_name as salesperson_name,
  coalesce(t.revenue,0)::numeric revenue, coalesce(t.prints,0)::bigint prints,
  bd.closing_status, bd.paper_difference, bd.revenue_difference, bd.started_at, bd.closed_at
from public.business_days bd join public.profiles p on p.id=bd.salesperson_id
left join lateral (select sum(total_amount) revenue,sum(quantity) prints from public.transactions where business_day_id=bd.id and status='COMPLETED') t on true;

grant select on public.admin_booth_details, public.admin_booth_history to authenticated;

create or replace function public.admin_booth_summary()
returns table(total_booths bigint, active_booths bigint, operating_today bigint, needs_attention bigint)
language sql stable security invoker set search_path='' as $$
  select count(*)::bigint, count(*) filter(where status='ACTIVE')::bigint,
    count(*) filter(where operational_state='OPEN')::bigint,
    count(*) filter(where operational_state in ('CLOSED_WITH_DISCREPANCY','PENDING_REVIEW'))::bigint
  from public.admin_booth_details;
$$;

create or replace function public.admin_update_booth(p_booth_id uuid,p_name text,p_location_id uuid,p_status public.record_status)
returns void language plpgsql security invoker set search_path='' as $$
declare v_current public.record_status;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Admin access required' using errcode='42501'; end if;
  if nullif(trim(p_name),'') is null then raise exception 'Booth name is required'; end if;
  select status into v_current from public.booths where id=p_booth_id for update;
  if not found then raise exception 'Booth not found'; end if;
  if v_current='ACTIVE' and p_status='INACTIVE' and exists(select 1 from public.business_days where booth_id=p_booth_id and status='OPEN') then
    raise exception 'A booth with an open business day cannot be deactivated';
  end if;
  update public.booths set name=trim(p_name),location_id=p_location_id,status=p_status where id=p_booth_id;
end;
$$;

revoke all on function public.admin_booth_summary() from public;
revoke all on function public.admin_update_booth(uuid,text,uuid,public.record_status) from public;
grant execute on function public.admin_booth_summary(), public.admin_update_booth(uuid,text,uuid,public.record_status) to authenticated;
