create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum ('ADMIN', 'SALESPERSON');
create type public.profile_status as enum ('ACTIVE', 'INACTIVE');
create type public.record_status as enum ('ACTIVE', 'INACTIVE');
create type public.business_day_status as enum ('OPEN', 'CLOSED', 'CLOSED_WITH_DISCREPANCY', 'PENDING_REVIEW');
create type public.closing_status as enum ('BALANCED', 'DISCREPANCY');
create type public.transaction_type as enum ('STANDARD', 'REPRINT');
create type public.transaction_status as enum ('COMPLETED', 'CANCELLED', 'CORRECTED', 'REFUNDED');
create type public.paper_movement_type as enum ('STARTING', 'ADDITION');
create type public.deposit_status as enum ('PENDING', 'CONFIRMED', 'CANCELLED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  role public.user_role not null default 'SALESPERSON',
  status public.profile_status not null default 'INACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  status public.record_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booths (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  name text not null check (length(trim(name)) > 0),
  code text not null unique check (length(trim(code)) > 0),
  status public.record_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (location_id, name)
);

create table public.booth_assignments (
  id uuid primary key default gen_random_uuid(),
  booth_id uuid not null references public.booths(id),
  salesperson_id uuid not null references public.profiles(id),
  active boolean not null default true,
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create unique index booth_assignments_one_active
  on public.booth_assignments (booth_id, salesperson_id) where active and end_date is null;

create table public.business_days (
  id uuid primary key default gen_random_uuid(),
  booth_id uuid not null references public.booths(id),
  salesperson_id uuid not null references public.profiles(id),
  business_date date not null default current_date,
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  status public.business_day_status not null default 'OPEN',
  starting_paper integer not null check (starting_paper >= 0),
  actual_remaining_paper integer check (actual_remaining_paper >= 0),
  paper_difference integer,
  expected_revenue numeric(14,2),
  recorded_revenue numeric(14,2),
  revenue_difference numeric(14,2),
  closing_status public.closing_status,
  closing_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booth_id, business_date),
  check ((status = 'OPEN' and closed_at is null) or status <> 'OPEN')
);
create unique index business_days_one_open_per_booth
  on public.business_days (booth_id) where status = 'OPEN';

create table public.payment_methods (
  code text primary key check (code ~ '^[A-Z][A-Z0-9_]*$'),
  display_name text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_number text not null unique default ('RB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))),
  business_day_id uuid not null references public.business_days(id),
  booth_id uuid not null references public.booths(id),
  salesperson_id uuid not null references public.profiles(id),
  transaction_type public.transaction_type not null,
  quantity integer not null check (quantity > 0),
  price_per_print numeric(12,2) not null check (price_per_print >= 0),
  total_amount numeric(14,2) generated always as (quantity * price_per_print) stored,
  payment_method text not null references public.payment_methods(code),
  status public.transaction_status not null default 'COMPLETED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index transactions_business_day_idx on public.transactions (business_day_id, created_at);

create table public.transaction_proofs (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id),
  storage_path text not null unique check (length(trim(storage_path)) > 0),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.paper_movements (
  id uuid primary key default gen_random_uuid(),
  business_day_id uuid not null references public.business_days(id),
  movement_type public.paper_movement_type not null,
  quantity integer not null check (quantity > 0),
  storage_path text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create unique index paper_movements_one_starting
  on public.paper_movements (business_day_id) where movement_type = 'STARTING';

create table public.faulty_paper_records (
  id uuid primary key default gen_random_uuid(),
  business_day_id uuid not null references public.business_days(id),
  quantity integer not null check (quantity > 0),
  reason text not null check (length(trim(reason)) > 0),
  notes text,
  storage_path text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_day_id uuid references public.business_days(id),
  booth_id uuid references public.booths(id),
  expense_category_id uuid not null references public.expense_categories(id),
  amount numeric(14,2) not null check (amount > 0),
  description text not null check (length(trim(description)) > 0),
  payment_source text,
  receipt_storage_path text,
  created_by uuid not null references public.profiles(id),
  expense_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.revenue_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  account_type text not null check (length(trim(account_type)) > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  amount numeric(14,2) not null check (amount > 0),
  source_type text not null check (length(trim(source_type)) > 0),
  destination_account_id uuid not null references public.revenue_accounts(id),
  business_day_id uuid references public.business_days(id),
  reference_number text,
  proof_storage_path text,
  deposit_date date not null default current_date,
  status public.deposit_status not null default 'PENDING',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*$'),
  value jsonb not null,
  value_type text not null check (value_type in ('NUMBER', 'STRING', 'BOOLEAN', 'JSON')),
  description text,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (value_type <> 'NUMBER' or jsonb_typeof(value) = 'number'),
  check (value_type <> 'STRING' or jsonb_typeof(value) = 'string'),
  check (value_type <> 'BOOLEAN' or jsonb_typeof(value) = 'boolean')
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id),
  entity_type text not null,
  entity_id text not null,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','locations','booths','business_days','payment_methods','transactions','expense_categories','expenses','revenue_accounts','deposits','app_settings']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, role, status)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1), 'New user'), 'SALESPERSON', 'INACTIVE');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
