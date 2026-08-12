-- Safe, repeatable reference data. This file deliberately creates no auth users or passwords.
insert into public.payment_methods (code, display_name, sort_order) values
  ('CASH', 'Cash', 10), ('CBE', 'CBE', 20), ('TELEBIRR', 'Telebirr', 30)
on conflict (code) do update set display_name = excluded.display_name, sort_order = excluded.sort_order;

insert into public.app_settings (key, value, value_type, description) values
  ('current_print_price', '300'::jsonb, 'NUMBER', 'Current price per print in ETB. Transactions snapshot this value at creation.')
on conflict (key) do nothing;

-- Optional development organization data:
with location_row as (
  insert into public.locations (name) values ('Development Location')
  on conflict (name) do update set name = excluded.name returning id
)
insert into public.booths (location_id, name, code)
select id, 'Development Booth', 'DEV-001' from location_row
on conflict (code) do nothing;

-- Create development users through Supabase Auth, then activate them with SQL such as:
-- update public.profiles set role = 'ADMIN', status = 'ACTIVE', full_name = 'Development Admin' where id = '<auth-user-uuid>';
-- update public.profiles set role = 'SALESPERSON', status = 'ACTIVE', full_name = 'Development Salesperson' where id = '<auth-user-uuid>';
-- insert into public.booth_assignments (booth_id, salesperson_id)
-- select b.id, '<salesperson-auth-user-uuid>'::uuid from public.booths b where b.code = 'DEV-001';
