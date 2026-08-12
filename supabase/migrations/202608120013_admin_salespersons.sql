-- Admin salesperson projections and atomic, audited profile/assignment actions.
alter table public.profiles add column if not exists email_snapshot text;
create unique index if not exists profiles_email_snapshot_unique on public.profiles (lower(email_snapshot)) where email_snapshot is not null;
create unique index if not exists booth_assignments_one_active_per_salesperson on public.booth_assignments (salesperson_id) where active;
create index if not exists business_days_salesperson_date_idx on public.business_days (salesperson_id,business_date desc);

drop trigger if exists audit_booth_assignments on public.booth_assignments;
create trigger audit_booth_assignments after insert or update or delete on public.booth_assignments for each row execute function public.audit_sensitive_change();

create or replace view public.admin_salesperson_details with (security_invoker=true) as
select p.id,p.full_name,p.email_snapshot,p.status,p.role,
  a.id assignment_id,a.booth_id,a.booth_name,a.location_id,a.location_name,a.start_date assignment_start_date,
  case when p.status='INACTIVE' then 'INACTIVE' when a.id is null then 'UNASSIGNED' else coalesce(today.status::text,'NOT_STARTED') end today_status,
  today.business_day_id,coalesce(today.transactions,0)::bigint today_transactions,coalesce(today.prints,0)::bigint today_prints,
  coalesce(today.revenue,0)::numeric today_revenue,coalesce(today.paper_status,'Not started') paper_status,
  coalesce(today.closing_status,latest.closing_status) latest_closing_status,latest.latest_activity,
  coalesce(recent.business_days,0)::bigint recent_business_days,coalesce(recent.transactions,0)::bigint recent_transactions,
  coalesce(recent.prints,0)::bigint recent_prints,coalesce(recent.revenue,0)::numeric recent_revenue,
  coalesce(recent.discrepancies,0)::bigint recent_discrepancies,p.created_at,p.updated_at
from public.profiles p
left join lateral(
  select ba.id,ba.booth_id,b.name booth_name,b.location_id,l.name location_name,ba.start_date
  from public.booth_assignments ba join public.booths b on b.id=ba.booth_id join public.locations l on l.id=b.location_id
  where ba.salesperson_id=p.id and ba.active order by ba.start_date desc limit 1
)a on true
left join lateral(
  select bd.id business_day_id,bd.status,bd.closing_status,
    coalesce(t.transactions,0) transactions,coalesce(t.prints,0) prints,coalesce(t.revenue,0) revenue,
    case when bd.status='OPEN' then (bd.starting_paper+coalesce(pm.added,0)-coalesce(t.prints,0)-coalesce(fp.faulty,0))::text||' expected'
      when coalesce(bd.paper_difference,0)=0 then 'Balanced' else 'Difference '||bd.paper_difference::text end paper_status
  from public.business_days bd
  left join lateral(select count(*) transactions,sum(quantity) prints,sum(total_amount) revenue from public.transactions where business_day_id=bd.id and status='COMPLETED')t on true
  left join lateral(select sum(quantity) added from public.paper_movements where business_day_id=bd.id and movement_type='ADDITION')pm on true
  left join lateral(select sum(quantity) faulty from public.faulty_paper_records where business_day_id=bd.id)fp on true
  where bd.salesperson_id=p.id and bd.business_date=(now() at time zone 'Africa/Addis_Ababa')::date order by bd.started_at desc limit 1
)today on true
left join lateral(
  select bd.closing_status,bd.started_at latest_activity from public.business_days bd where bd.salesperson_id=p.id order by bd.business_date desc,bd.started_at desc limit 1
)latest on true
left join lateral(
  select count(*) business_days,coalesce(sum(x.transactions),0) transactions,coalesce(sum(x.prints),0) prints,coalesce(sum(x.revenue),0) revenue,
    count(*) filter(where bd.status in('CLOSED_WITH_DISCREPANCY','PENDING_REVIEW') or coalesce(bd.paper_difference,0)<>0 or coalesce(bd.revenue_difference,0)<>0) discrepancies
  from public.business_days bd left join lateral(select count(*) transactions,sum(quantity) prints,sum(total_amount) revenue from public.transactions where business_day_id=bd.id and status='COMPLETED')x on true
  where bd.salesperson_id=p.id and bd.business_date between (now() at time zone 'Africa/Addis_Ababa')::date-6 and (now() at time zone 'Africa/Addis_Ababa')::date
)recent on true
where p.role='SALESPERSON';

create or replace view public.admin_salesperson_history with(security_invoker=true) as
select bd.id business_day_id,bd.salesperson_id,bd.business_date,bd.status,b.name booth_name,l.name location_name,
  coalesce(t.transactions,0)::bigint transactions,coalesce(t.prints,0)::bigint prints,coalesce(t.revenue,0)::numeric revenue,
  bd.paper_difference,bd.revenue_difference,bd.closing_status,bd.started_at,bd.closed_at
from public.business_days bd join public.booths b on b.id=bd.booth_id join public.locations l on l.id=b.location_id
left join lateral(select count(*) transactions,sum(quantity) prints,sum(total_amount) revenue from public.transactions where business_day_id=bd.id and status='COMPLETED')t on true;

grant select on public.admin_salesperson_details,public.admin_salesperson_history to authenticated;

create or replace function public.admin_salesperson_summary()
returns table(total bigint,active bigint,assigned bigint,unassigned bigint) language sql stable security invoker set search_path='' as $$
 select count(*)::bigint,count(*)filter(where status='ACTIVE')::bigint,count(*)filter(where assignment_id is not null)::bigint,count(*)filter(where assignment_id is null)::bigint from public.admin_salesperson_details;
$$;

create or replace function public.admin_update_salesperson(p_salesperson_id uuid,p_full_name text,p_status public.profile_status)
returns void language plpgsql security invoker set search_path='' as $$
declare v_role public.user_role;v_current public.profile_status;
begin
 if not public.is_admin(auth.uid()) then raise exception 'Admin access required' using errcode='42501';end if;
 if nullif(trim(p_full_name),'') is null then raise exception 'Full name is required';end if;
 select role,status into v_role,v_current from public.profiles where id=p_salesperson_id for update;
 if not found or v_role<>'SALESPERSON' then raise exception 'Salesperson not found';end if;
 if v_current='ACTIVE' and p_status='INACTIVE' and exists(select 1 from public.business_days where salesperson_id=p_salesperson_id and status='OPEN') then raise exception 'Close the current business day before deactivating this salesperson';end if;
 perform set_config('app.audit_reason',case when v_current<>p_status then 'Admin changed salesperson account status' else 'Admin updated salesperson profile' end,true);
 update public.profiles set full_name=trim(p_full_name),status=p_status where id=p_salesperson_id and role='SALESPERSON';
end;$$;

create or replace function public.admin_assign_salesperson_to_booth(p_salesperson_id uuid,p_booth_id uuid,p_start_date date)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_assignment uuid;v_profile_status public.profile_status;v_booth_status public.record_status;v_existing_booth uuid;
begin
 if not public.is_admin(auth.uid()) then raise exception 'Admin access required' using errcode='42501';end if;
 select status into v_profile_status from public.profiles where id=p_salesperson_id and role='SALESPERSON' for update;
 if not found or v_profile_status<>'ACTIVE' then raise exception 'Salesperson must be active';end if;
 select status into v_booth_status from public.booths where id=p_booth_id for update;
 if not found or v_booth_status<>'ACTIVE' then raise exception 'Booth must be active';end if;
 perform 1 from public.booth_assignments where salesperson_id=p_salesperson_id and active for update;
 if exists(select 1 from public.business_days where salesperson_id=p_salesperson_id and status='OPEN') then raise exception 'This salesperson has an open business day';end if;
 select booth_id into v_existing_booth from public.booth_assignments where salesperson_id=p_salesperson_id and active limit 1;
 if v_existing_booth=p_booth_id then raise exception 'This salesperson is already assigned to this booth';end if;
 perform set_config('app.audit_reason','Admin reassigned salesperson',true);
 update public.booth_assignments set active=false,end_date=greatest(start_date,p_start_date) where salesperson_id=p_salesperson_id and active;
 insert into public.booth_assignments(booth_id,salesperson_id,active,start_date)values(p_booth_id,p_salesperson_id,true,p_start_date)returning id into v_assignment;
 return v_assignment;
end;$$;

create or replace function public.admin_end_salesperson_assignment(p_salesperson_id uuid,p_end_date date)
returns void language plpgsql security invoker set search_path='' as $$
declare v_assignment public.booth_assignments%rowtype;
begin
 if not public.is_admin(auth.uid()) then raise exception 'Admin access required' using errcode='42501';end if;
 select * into v_assignment from public.booth_assignments where salesperson_id=p_salesperson_id and active order by start_date desc limit 1 for update;
 if not found then raise exception 'This salesperson is not assigned';end if;
 if p_end_date<v_assignment.start_date then raise exception 'End date cannot be before assignment start date';end if;
 if exists(select 1 from public.business_days where salesperson_id=p_salesperson_id and status='OPEN') then raise exception 'This salesperson has an open business day';end if;
 perform set_config('app.audit_reason','Admin ended salesperson assignment',true);
 update public.booth_assignments set active=false,end_date=p_end_date where id=v_assignment.id;
end;$$;

revoke all on function public.admin_salesperson_summary(),public.admin_update_salesperson(uuid,text,public.profile_status),public.admin_assign_salesperson_to_booth(uuid,uuid,date),public.admin_end_salesperson_assignment(uuid,date) from public;
grant execute on function public.admin_salesperson_summary(),public.admin_update_salesperson(uuid,text,public.profile_status),public.admin_assign_salesperson_to_booth(uuid,uuid,date),public.admin_end_salesperson_assignment(uuid,date) to authenticated;
