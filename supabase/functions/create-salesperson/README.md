# create-salesperson

Deploy with `supabase functions deploy create-salesperson --no-verify-jwt`.

The hosted Supabase runtime supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. For local serving, provide those only through the Edge Function environment; never use a `VITE_` prefix or expose the service-role value to the browser.

Gateway JWT verification is disabled specifically for compatibility with modern `sb_publishable_` keys. This does not make account creation anonymous: the function requires an `Authorization: Bearer <user access token>` header, validates that token with Supabase Auth, and then requires an `ACTIVE` `ADMIN` profile. It always creates a `SALESPERSON`, never logs or stores the temporary password, and returns only safe account metadata.
