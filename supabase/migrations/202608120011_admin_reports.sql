-- Read-only, RLS-preserving reporting API. All money is derived from stored transaction snapshots.
create index if not exists business_days_report_date_idx on public.business_days (business_date, booth_id);
create index if not exists transactions_report_day_status_idx on public.transactions (business_day_id, status);
create index if not exists expenses_report_date_booth_idx on public.expenses (expense_date, booth_id);
create index if not exists deposits_report_date_status_idx on public.deposits (deposit_date, status);
create index if not exists deposits_report_day_status_idx on public.deposits (business_day_id, status) where business_day_id is not null;
create index if not exists faulty_paper_report_day_idx on public.faulty_paper_records (business_day_id);

create or replace function public.admin_report(
  p_date_from date, p_date_to date, p_location_id uuid default null, p_booth_id uuid default null
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_result jsonb;
begin
  if not public.is_admin(auth.uid()) then raise exception 'Admin access required' using errcode = '42501'; end if;
  if p_date_from is null or p_date_to is null or p_date_to < p_date_from or p_date_to - p_date_from > 370 then
    raise exception 'Invalid report period';
  end if;

  with selected_booths as (
    select b.id, b.name, b.location_id, l.name as location_name
    from public.booths b join public.locations l on l.id = b.location_id
    where b.status = 'ACTIVE' and (p_location_id is null or b.location_id = p_location_id) and (p_booth_id is null or b.id = p_booth_id)
  ), calendar as (
    select d::date as business_date from generate_series(p_date_from, p_date_to, interval '1 day') d
  ), days as (
    select bd.* from public.business_days bd join selected_booths b on b.id = bd.booth_id
    where bd.business_date between p_date_from and p_date_to
  ), completed as (
    select t.* from public.transactions t join days d on d.id = t.business_day_id where t.status = 'COMPLETED'
  ), expense_scope as (
    select e.*, coalesce(e.booth_id, bd.booth_id) as report_booth_id
    from public.expenses e left join public.business_days bd on bd.id = e.business_day_id
    where e.expense_date between p_date_from and p_date_to
      and ((p_location_id is null and p_booth_id is null) or coalesce(e.booth_id, bd.booth_id) in (select id from selected_booths))
  ), additions as (
    select pm.business_day_id, sum(pm.quantity)::bigint amount from public.paper_movements pm join days d on d.id = pm.business_day_id
    where pm.movement_type = 'ADDITION' group by pm.business_day_id
  ), faulty as (
    select f.business_day_id, sum(f.quantity)::bigint amount from public.faulty_paper_records f join days d on d.id = f.business_day_id group by f.business_day_id
  ), tx_day as (
    select business_day_id, count(*)::bigint transactions, coalesce(sum(quantity),0)::bigint prints, coalesce(sum(total_amount),0)::numeric revenue
    from completed group by business_day_id
  ), day_metrics as (
    select d.id, d.business_date, d.booth_id, d.salesperson_id, d.status, d.starting_paper,
      d.actual_remaining_paper, d.paper_difference, d.revenue_difference, d.closing_status,
      coalesce(t.transactions,0) transactions, coalesce(t.prints,0) prints, coalesce(t.revenue,0) revenue,
      coalesce(a.amount,0) added, coalesce(f.amount,0) faulty
    from days d left join tx_day t on t.business_day_id=d.id left join additions a on a.business_day_id=d.id left join faulty f on f.business_day_id=d.id
  ), proof_health as (
    select count(*) filter (where pm.requires_proof)::bigint required,
      count(*) filter (where pm.requires_proof and tp.transaction_id is not null)::bigint verified,
      count(*) filter (where pm.requires_proof and tp.transaction_id is null)::bigint missing
    from completed t join public.payment_methods pm on pm.code=t.payment_method
    left join (select distinct transaction_id from public.transaction_proofs) tp on tp.transaction_id=t.id
  ), proof_by_booth as (
    select t.booth_id, count(*) filter (where pm.requires_proof)::bigint required,
      count(*) filter (where pm.requires_proof and tp.transaction_id is null)::bigint missing
    from completed t join public.payment_methods pm on pm.code=t.payment_method
    left join (select distinct transaction_id from public.transaction_proofs) tp on tp.transaction_id=t.id
    group by t.booth_id
  ), totals as (
    select count(c.id)::bigint transactions, coalesce(sum(c.quantity),0)::bigint prints, coalesce(sum(c.total_amount),0)::numeric revenue,
      coalesce((select sum(amount) from expense_scope),0)::numeric costs from completed c
  ), deposit_position as (
    select coalesce((select sum(d.amount) from public.deposits d where d.status='CONFIRMED' and d.business_day_id in (select id from days)),0)::numeric confirmed,
      coalesce((select sum(d.amount) from public.deposits d where d.status='CONFIRMED' and d.business_day_id is null and d.deposit_date between p_date_from and p_date_to),0)::numeric unattributed
  ), trend as (
    select c.business_date, coalesce(sum(dm.transactions),0)::bigint transactions, coalesce(sum(dm.prints),0)::bigint prints,
      coalesce(sum(dm.revenue),0)::numeric revenue,
      coalesce((select sum(e.amount) from expense_scope e where e.expense_date=c.business_date),0)::numeric costs,
      count(dm.id)::bigint booth_days,
      count(dm.id) filter (where dm.status='CLOSED' and coalesce(dm.paper_difference,0)=0 and coalesce(dm.revenue_difference,0)=0)::bigint balanced,
      count(dm.id) filter (where dm.status in ('CLOSED_WITH_DISCREPANCY','PENDING_REVIEW') or coalesce(dm.paper_difference,0)<>0 or coalesce(dm.revenue_difference,0)<>0)::bigint issues
    from calendar c left join day_metrics dm on dm.business_date=c.business_date group by c.business_date
  ), booth_perf as (
    select b.id booth_id, b.name booth_name, b.location_id, b.location_name,
      count(dm.id)::bigint booth_days, coalesce(sum(dm.transactions),0)::bigint transactions, coalesce(sum(dm.prints),0)::bigint prints,
      coalesce(sum(dm.revenue),0)::numeric revenue,
      coalesce((select sum(e.amount) from expense_scope e where e.report_booth_id=b.id),0)::numeric costs,
      coalesce(sum(dm.faulty),0)::bigint faulty,
      count(dm.id) filter (where dm.status in ('CLOSED_WITH_DISCREPANCY','PENDING_REVIEW') or coalesce(dm.paper_difference,0)<>0 or coalesce(dm.revenue_difference,0)<>0)::bigint discrepancies,
      coalesce(sum(dm.paper_difference) filter (where dm.actual_remaining_paper is not null),0)::bigint paper_difference,
      coalesce(sum(dm.revenue_difference),0)::numeric revenue_difference,
      coalesce(pb.required,0)::bigint proof_required, coalesce(pb.missing,0)::bigint missing_proof,
      (array_agg(dm.id order by dm.business_date desc) filter (where dm.id is not null))[1] business_day_id,
      (array_agg(dm.status::text order by dm.business_date desc) filter (where dm.id is not null))[1] status,
      (array_agg(dm.closing_status::text order by dm.business_date desc) filter (where dm.closing_status is not null))[1] closing_status,
      (array_agg(p.full_name order by dm.business_date desc) filter (where dm.id is not null))[1] salesperson
    from selected_booths b left join day_metrics dm on dm.booth_id=b.id left join public.profiles p on p.id=dm.salesperson_id left join proof_by_booth pb on pb.booth_id=b.id
    group by b.id,b.name,b.location_id,b.location_name,pb.required,pb.missing
  )
  select jsonb_build_object(
    'period',jsonb_build_object('from',p_date_from,'to',p_date_to),
    'summary',jsonb_build_object('transactions',t.transactions,'prints',t.prints,'revenue',t.revenue,'costs',t.costs,'net',t.revenue-t.costs,'daysOperated',(select count(distinct business_date) from days),'boothDays',(select count(*) from days)),
    'operations',jsonb_build_object('activeBooths',(select count(*) from selected_booths),'expectedBoothDays',(select count(*) from selected_booths)*(p_date_to-p_date_from+1),'started',(select count(*) from days),'closed',(select count(*) from days where status in ('CLOSED','CLOSED_WITH_DISCREPANCY')),'open',(select count(*) from days where status='OPEN'),'balanced',(select count(*) from days where status='CLOSED' and coalesce(paper_difference,0)=0 and coalesce(revenue_difference,0)=0),'discrepant',(select count(*) from days where status='CLOSED_WITH_DISCREPANCY'),'pendingReview',(select count(*) from days where status='PENDING_REVIEW'),'pastOpen',(select count(*) from days where status='OPEN' and business_date < (now() at time zone 'Africa/Addis_Ababa')::date)),
    'paper',jsonb_build_object('starting',(select coalesce(sum(starting_paper),0) from day_metrics),'added',(select coalesce(sum(added),0) from day_metrics),'prints',t.prints,'faulty',(select coalesce(sum(faulty),0) from day_metrics),'expectedRemaining',(select coalesce(sum(starting_paper+added-prints-faulty),0) from day_metrics),'actualRemaining',(select coalesce(sum(actual_remaining_paper),0) from day_metrics where actual_remaining_paper is not null),'closedWithActual',(select count(*) from day_metrics where actual_remaining_paper is not null),'difference',(select coalesce(sum(paper_difference),0) from day_metrics where actual_remaining_paper is not null)),
    'verification',jsonb_build_object('required',ph.required,'verified',ph.verified,'missing',ph.missing),
    'deposits',jsonb_build_object('revenue',t.revenue,'confirmed',dp.confirmed,'pending',greatest(t.revenue-dp.confirmed,0),'overDeposited',greatest(dp.confirmed-t.revenue,0),'unattributed',dp.unattributed),
    'payments',(select coalesce(jsonb_agg(jsonb_build_object('code',pm.code,'name',pm.display_name,'transactions',coalesce(x.transactions,0),'prints',coalesce(x.prints,0),'amount',coalesce(x.amount,0)) order by pm.sort_order),'[]'::jsonb) from public.payment_methods pm left join (select payment_method,count(*) transactions,sum(quantity) prints,sum(total_amount) amount from completed group by payment_method)x on x.payment_method=pm.code where coalesce(x.transactions,0)>0),
    'costCategories',(select coalesce(jsonb_agg(jsonb_build_object('id',ec.id,'name',ec.name,'amount',x.amount) order by x.amount desc),'[]'::jsonb) from (select expense_category_id,sum(amount) amount from expense_scope group by expense_category_id)x join public.expense_categories ec on ec.id=x.expense_category_id),
    'trend',(select coalesce(jsonb_agg(jsonb_build_object('date',business_date,'transactions',transactions,'prints',prints,'revenue',revenue,'costs',costs,'net',revenue-costs,'boothDays',booth_days,'balanced',balanced,'issues',issues) order by business_date),'[]'::jsonb) from trend),
    'booths',(select coalesce(jsonb_agg(jsonb_build_object('boothId',booth_id,'boothName',booth_name,'locationId',location_id,'locationName',location_name,'businessDayId',business_day_id,'salesperson',salesperson,'status',coalesce(status,'NOT_STARTED'),'closingStatus',closing_status,'boothDays',booth_days,'transactions',transactions,'prints',prints,'revenue',revenue,'costs',costs,'net',revenue-costs,'faulty',faulty,'paperDifference',paper_difference,'revenueDifference',revenue_difference,'discrepancies',discrepancies,'proofRequired',proof_required,'missingProof',missing_proof) order by revenue desc,booth_name),'[]'::jsonb) from booth_perf)
  ) into v_result from totals t cross join proof_health ph cross join deposit_position dp;
  return v_result;
end;
$$;

revoke all on function public.admin_report(date,date,uuid,uuid) from public;
grant execute on function public.admin_report(date,date,uuid,uuid) to authenticated;
