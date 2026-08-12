# Supabase setup

These migrations define the RedBooth relational model, trusted RPCs, RLS, audit triggers, and private proof storage. They contain no passwords or service-role credentials.

## Apply to a Supabase project

1. Create a Supabase project and record its project URL and public anon/publishable key.
2. Install the Supabase CLI, authenticate, and link this repository:

   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. Review pending migrations, then apply them:

   ```bash
   supabase db push --dry-run
   supabase db push
   ```

4. Apply reference/development seed data if desired. For a hosted project, paste `seed.sql` into the SQL Editor or use an appropriately secured database connection. `supabase db reset` applies it automatically to a local CLI project.
5. In Authentication settings, keep public user signup disabled. Create staff users only through the Dashboard or a future protected admin workflow.
6. Set the application's `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never expose a service-role key in the browser.

Applying migrations to a fresh project should be tested in a staging project before production. A local stack is optional and requires Docker only if you choose to run `supabase start`; the hosted migration flow does not require Docker.

## Create the first admin

There is intentionally no public admin signup.

1. Open Supabase Dashboard > Authentication > Users > Add user.
2. Create the user with a temporary password and auto-confirm the email if appropriate for your environment.
3. Copy the new user's UUID. The auth trigger creates an `INACTIVE` salesperson profile by default.
4. In Dashboard > SQL Editor, run this with the copied UUID:

   ```sql
   update public.profiles
   set full_name = 'Admin Name', role = 'ADMIN', status = 'ACTIVE'
   where id = 'AUTH_USER_UUID';
   ```

5. Confirm exactly one row was updated, then sign in at `/login` and change/rotate the temporary password through a secure Auth flow when available.

The bootstrap update is a one-time trusted Dashboard operation. Do not place a service-role key in `.env.local` and do not add an unauthenticated admin-registration endpoint.

## Create a salesperson and assignment

Create the Auth user in the Dashboard, copy the UUID, then run:

```sql
update public.profiles
set full_name = 'Salesperson Name', role = 'SALESPERSON', status = 'ACTIVE'
where id = 'AUTH_USER_UUID';

insert into public.booth_assignments (booth_id, salesperson_id)
values ('BOOTH_UUID', 'AUTH_USER_UUID');
```

## Pricing and reconciliation

`app_settings.current_print_price` begins at 300 when the seed is applied. `create_transaction` reads it inside PostgreSQL and snapshots it into `transactions.price_per_print`; the generated `total_amount` cannot be supplied by the client.

`business_days.starting_paper` is the authoritative opening snapshot. A corresponding `STARTING` movement is recorded when the opening quantity is positive for an auditable event trail; reconciliation intentionally uses the snapshot once, avoiding double counting. Later additions are immutable `ADDITION` ledger rows.

`close_business_day` locks the open day, calculates paper and revenue from trusted rows, writes closing snapshots atomically, and chooses the closing/discrepancy state. Closing revenue snapshots equal completed transaction revenue in V1 because no independent cash-count input is collected yet. Payment-method totals remain available from `business_day_totals` and the reconciliation view.

## Business timezone

PostgreSQL and all `timestamptz` values remain UTC. RedBooth calendar dates are derived explicitly in `Africa/Addis_Ababa` through `public.redbooth_business_date()`. The Start Day RPC, business-day defaults, and assignment start dates use this helper and do not depend on the database session timezone. Dormant legacy finance tables retain their existing date defaults for migration compatibility.

The timezone migration intentionally does not rewrite historical rows. For disposable development data created with an incorrect `business_date`, delete the affected business day through a controlled development reset (including its dependent test records) or reset the local database, then recreate the day after applying migrations. Do not rewrite production financial history without a reviewed data-correction migration and audit plan.

## Private storage

Four private buckets are created:

- `transaction-proofs`: `<transaction_uuid>/<generated_filename>`
- `paper-proofs`: `<business_day_uuid>/<generated_filename>`
- `expense-receipts`: deprecated and unused; retained to preserve existing private objects
- `deposit-proofs`: deprecated and unused; retained to preserve existing private objects

Salespeople can upload/read transaction and paper evidence only for their own permitted records. They cannot update or delete objects. The application no longer reads or writes the deprecated buckets. Existing policies and private objects remain in place; never make a bucket public.

## Optional local verification

If Docker and the Supabase CLI are available:

```bash
supabase start
supabase db reset
supabase db lint
```

Then test policies with real Admin and Salesperson JWTs. In particular, verify unrelated-booth reads, direct transaction inserts, price/identity manipulation, closed-day writes, audit writes, and public storage URLs are rejected.
