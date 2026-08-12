# RedBooth Management System

## Project goal

Build a production-quality POS and daily reconciliation system for a photobooth business. The application foundation, database schema, RLS, private storage, and authentication boundary are established. Do not implement full POS/dashboard workflows or widespread fake data until explicitly requested.

## Architecture

- `src/app`: composition root, routing, and global styles.
- `src/auth`: authentication, authorization, session, and role guards.
- `src/admin`: admin-only layouts, pages, and feature orchestration.
- `src/salesperson`: salesperson-only layouts, pages, and feature orchestration.
- `src/transactions`, `src/paper`, `src/finance`, `src/reports`: business-domain modules shared by role experiences where appropriate.
- `src/shared`: reusable presentational components and role-neutral utilities. Do not place domain rules here.
- `src/lib`: external service abstractions and infrastructure, including Supabase.

Keep business rules in domain modules, data access behind focused service/repository functions, and UI components focused on display and interaction. Prefer feature-local code; promote code to `shared` only when genuinely reused.

## Coding rules

- Use strict TypeScript. Avoid `any`; model domain states explicitly.
- Use React function components and small, composable modules.
- Keep Supabase access behind `src/lib/supabase` and domain data-access modules.
- Read public client configuration from Vite environment variables. Never commit keys or service-role credentials.
- Treat browser Supabase credentials as public and rely on PostgreSQL Row Level Security for authorization.
- Protect role routes in the client for UX, but enforce all authorization with RLS in the backend.
- Do not put calculations, reconciliation rules, or network requests in random presentational components.
- Avoid new dependencies until they solve a demonstrated need. Do not add Redux by default. Add TanStack Query when asynchronous server-state caching becomes useful.
- Use real backend integration when available; otherwise use clear empty and placeholder states, not pervasive fake data.
- Salesperson experiences are mobile-first with large touch targets and short flows.
- Admin experiences are desktop-first and responsive.
- Maintain accessible labels, semantic HTML, keyboard behavior, and sufficient contrast.

## Role separation

- `admin` and `salesperson` are the only roles currently supported.
- Admin pages live under `/admin` and salesperson pages under `/sales`.
- Do not expose admin navigation or operations to salesperson users.
- Shared domain behavior may be reused, but role-specific pages and workflow orchestration remain in their role modules.
- A future authenticated profile/claims source will resolve roles. `RoleGuard` is currently the explicit integration point, not an authorization boundary.

## Core business invariants

- The current price is 300 ETB per print, but pricing must be configurable and effective-dated rather than embedded in UI code.
- One transaction may contain multiple prints.
- Transaction count and print count are different measures and must never be inferred from one another.
- Revenue calculations must use the price applicable to the transaction and preserve auditable values.
- Paper reconciliation must account separately for starting quantity, additions, sold/used prints, faulty paper, and closing quantity.
- Business-day opening and closing are explicit lifecycle events.
- Payment verification attachments are private evidence and must use protected storage plus RLS-backed access controls.
- Financial and reconciliation records require traceability; avoid destructive overwrites of auditable events.
