grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
grant insert on public.transaction_proofs, public.paper_movements, public.faulty_paper_records to authenticated;
grant insert, update, delete on public.locations, public.booths, public.booth_assignments, public.payment_methods,
  public.expense_categories, public.expenses, public.revenue_accounts, public.deposits, public.app_settings to authenticated;
grant update on public.profiles, public.business_days, public.transactions to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter table public.profiles enable row level security;
alter table public.locations enable row level security;
alter table public.booths enable row level security;
alter table public.booth_assignments enable row level security;
alter table public.business_days enable row level security;
alter table public.payment_methods enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_proofs enable row level security;
alter table public.paper_movements enable row level security;
alter table public.faulty_paper_records enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.revenue_accounts enable row level security;
alter table public.deposits enable row level security;
alter table public.app_settings enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_read_self_or_admin on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy locations_admin_all on public.locations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy locations_sales_read on public.locations for select to authenticated using (
  public.is_active_salesperson() and exists (
    select 1 from public.booths b where b.location_id = locations.id and public.is_assigned_to_booth(b.id)
  )
);

create policy booths_admin_all on public.booths for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy booths_sales_read on public.booths for select to authenticated
  using (public.is_active_salesperson() and public.is_assigned_to_booth(id));

create policy assignments_admin_all on public.booth_assignments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy assignments_sales_read_own on public.booth_assignments for select to authenticated
  using (salesperson_id = auth.uid() and public.is_active_salesperson());

create policy business_days_admin_all on public.business_days for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy business_days_sales_read on public.business_days for select to authenticated using (
  salesperson_id = auth.uid() and public.is_active_salesperson()
  and public.is_assigned_to_booth(booth_id, auth.uid(), business_date)
);

create policy payment_methods_admin_all on public.payment_methods for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy payment_methods_sales_read_active on public.payment_methods for select to authenticated
  using (active and public.is_active_salesperson());

create policy transactions_admin_all on public.transactions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy transactions_sales_read on public.transactions for select to authenticated using (
  salesperson_id = auth.uid() and public.is_active_salesperson()
  and exists (
    select 1 from public.business_days d
    where d.id = transactions.business_day_id and d.salesperson_id = auth.uid()
      and d.booth_id = transactions.booth_id
  )
);

create policy transaction_proofs_admin_all on public.transaction_proofs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy transaction_proofs_sales_read on public.transaction_proofs for select to authenticated using (
  uploaded_by = auth.uid() and exists (
    select 1 from public.transactions t where t.id = transaction_proofs.transaction_id and t.salesperson_id = auth.uid()
  )
);
create policy transaction_proofs_sales_insert on public.transaction_proofs for insert to authenticated with check (
  uploaded_by = auth.uid() and public.is_active_salesperson() and exists (
    select 1 from public.transactions t join public.business_days d on d.id = t.business_day_id
    where t.id = transaction_proofs.transaction_id and t.salesperson_id = auth.uid() and d.status = 'OPEN'
  )
);

create policy paper_movements_admin_all on public.paper_movements for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy paper_movements_sales_read on public.paper_movements for select to authenticated using (
  created_by = auth.uid() and exists (select 1 from public.business_days d where d.id = paper_movements.business_day_id and d.salesperson_id = auth.uid())
);
create policy paper_movements_sales_insert on public.paper_movements for insert to authenticated with check (
  movement_type = 'ADDITION' and created_by = auth.uid() and public.is_active_salesperson() and exists (
    select 1 from public.business_days d where d.id = paper_movements.business_day_id and d.salesperson_id = auth.uid() and d.status = 'OPEN'
  )
);

create policy faulty_paper_admin_all on public.faulty_paper_records for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy faulty_paper_sales_read on public.faulty_paper_records for select to authenticated using (
  created_by = auth.uid() and exists (select 1 from public.business_days d where d.id = faulty_paper_records.business_day_id and d.salesperson_id = auth.uid())
);
create policy faulty_paper_sales_insert on public.faulty_paper_records for insert to authenticated with check (
  created_by = auth.uid() and public.is_active_salesperson() and exists (
    select 1 from public.business_days d where d.id = faulty_paper_records.business_day_id and d.salesperson_id = auth.uid() and d.status = 'OPEN'
  )
);

create policy expense_categories_admin_all on public.expense_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy expenses_admin_all on public.expenses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy revenue_accounts_admin_all on public.revenue_accounts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy deposits_admin_all on public.deposits for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy app_settings_admin_all on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy audit_logs_admin_read on public.audit_logs for select to authenticated using (public.is_admin());

create or replace function public.audit_sensitive_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_action text; v_id text; v_reason text;
begin
  v_action := tg_op;
  v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id', to_jsonb(new) ->> 'key', to_jsonb(old) ->> 'key');
  v_reason := nullif(current_setting('app.audit_reason', true), '');
  insert into public.audit_logs (actor_user_id, entity_type, entity_id, action, old_values, new_values, reason)
  values (auth.uid(), tg_table_name, v_id, v_action,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    v_reason);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger audit_profiles after update on public.profiles for each row execute function public.audit_sensitive_change();
create trigger audit_transactions after update or delete on public.transactions for each row execute function public.audit_sensitive_change();
create trigger audit_business_days after update on public.business_days for each row execute function public.audit_sensitive_change();
create trigger audit_expenses after insert or update or delete on public.expenses for each row execute function public.audit_sensitive_change();
create trigger audit_deposits after insert or update or delete on public.deposits for each row execute function public.audit_sensitive_change();
create trigger audit_settings after insert or update or delete on public.app_settings for each row execute function public.audit_sensitive_change();

revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;
