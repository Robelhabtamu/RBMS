-- Focused operational settings: configurable proof requirements and safe audit coverage.
alter table public.payment_methods add column if not exists requires_proof boolean not null default false;
update public.payment_methods set requires_proof = true where code in ('CBE', 'TELEBIRR');
update public.payment_methods set requires_proof = false where code = 'CASH';

insert into public.app_settings (key, value, value_type, description) values
  ('require_paper_addition_proof', 'false'::jsonb, 'BOOLEAN', 'Whether paper additions require uploaded proof.'),
  ('require_faulty_paper_proof', 'false'::jsonb, 'BOOLEAN', 'Whether faulty paper records require uploaded proof.'),
  ('require_closing_proof', 'false'::jsonb, 'BOOLEAN', 'Whether business-day closing requires uploaded proof.'),
  ('business_name', '"RedBooth"'::jsonb, 'STRING', 'Business name displayed in RedBooth administration.'),
  ('currency', '"ETB"'::jsonb, 'STRING', 'Operational currency code.')
on conflict (key) do nothing;

-- Extend the existing audit function to recognize stable code-keyed tables.
create or replace function public.audit_sensitive_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_action text; v_id text; v_reason text;
begin
  v_action := tg_op;
  v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id', to_jsonb(new) ->> 'key', to_jsonb(old) ->> 'key', to_jsonb(new) ->> 'code', to_jsonb(old) ->> 'code');
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

-- Reuse the existing audit architecture for configuration tables. Codes/rows are retained, never deleted by the UI.
drop trigger if exists audit_payment_methods on public.payment_methods;
create trigger audit_payment_methods after insert or update or delete on public.payment_methods for each row execute function public.audit_sensitive_change();
drop trigger if exists audit_expense_categories on public.expense_categories;
create trigger audit_expense_categories after insert or update or delete on public.expense_categories for each row execute function public.audit_sensitive_change();
drop trigger if exists audit_revenue_accounts on public.revenue_accounts;
create trigger audit_revenue_accounts after insert or update or delete on public.revenue_accounts for each row execute function public.audit_sensitive_change();

create or replace view public.admin_transaction_details with (security_invoker = true) as
select t.id, t.transaction_number, t.business_day_id, d.business_date, t.created_at, t.updated_at,
  t.booth_id, b.name as booth_name, b.code as booth_code, l.id as location_id, l.name as location_name,
  t.salesperson_id, p.full_name as salesperson_name, t.transaction_type, t.quantity,
  t.price_per_print, t.total_amount, t.payment_method, t.status,
  proof.id as proof_id, proof.storage_path as proof_storage_path, proof.created_at as proof_created_at,
  pm.requires_proof as payment_requires_proof
from public.transactions t
join public.business_days d on d.id = t.business_day_id
join public.booths b on b.id = t.booth_id
join public.locations l on l.id = b.location_id
join public.profiles p on p.id = t.salesperson_id
join public.payment_methods pm on pm.code = t.payment_method
left join lateral (
  select tp.id, tp.storage_path, tp.created_at from public.transaction_proofs tp
  where tp.transaction_id = t.id order by tp.created_at limit 1
) proof on true;

create or replace function public.admin_transaction_summary(
  p_date_from date, p_date_to date, p_location_id uuid default null, p_booth_id uuid default null,
  p_salesperson_id uuid default null, p_payment_method text default null,
  p_transaction_type text default null, p_status text default null,
  p_verification text default null, p_search text default null, p_business_day_id uuid default null
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
      or (p_verification = 'VERIFIED' and v.payment_requires_proof and v.proof_id is not null)
      or (p_verification = 'MISSING_PROOF' and v.payment_requires_proof and v.proof_id is null))
    and (p_search is null or v.transaction_number ilike '%' || p_search || '%');
$$;

grant select on public.admin_transaction_details to authenticated;
revoke all on function public.admin_transaction_summary(date, date, uuid, uuid, uuid, text, text, text, text, text, uuid) from public;
grant execute on function public.admin_transaction_summary(date, date, uuid, uuid, uuid, text, text, text, text, text, uuid) to authenticated;
