# Supabase setup

The same migrations are used locally and in production. Do not create or edit
production tables manually in the Dashboard after adopting this workflow.

## Local database and Auth

Prerequisites: Docker and Node.js 22 or newer.

```bash
npm install
npm run supabase:start
npm run supabase:reset
npx supabase status
```

Copy `frontend/.env.example` to `frontend/.env.local` and
`admin/.env.example` to `admin/.env.local`, then copy the local `API_URL` and
`PUBLISHABLE_KEY` printed by `npx supabase status` into both files. The
checked-in local Auth configuration requires email confirmation. Test messages
are available in Mailpit at <http://127.0.0.1:54324>.

Useful local URLs:

- Public application: <http://localhost:3000>
- Facility operations: <http://127.0.0.1:3001>
- Supabase Studio: <http://127.0.0.1:54323>
- Mailpit: <http://127.0.0.1:54324>

Run database validation after every schema change:

```bash
npx supabase test db --local
npx supabase db advisors --local --type all --level warn --fail-on warn
npm run supabase:types
```

## Production deployment

Use a scoped Supabase personal access token and the database password. Never
commit either value.

```bash
export SUPABASE_ACCESS_TOKEN=your_scoped_personal_access_token
export SUPABASE_DB_PASSWORD=your_project_database_password
npx supabase link --project-ref your_project_ref
npx supabase db push --dry-run
npx supabase db push
npx supabase migration list
npx supabase db advisors --linked --type all --level warn --fail-on warn
```

Do not use `--include-seed` for production. Facility seats are reference data
in the migration; `seed.sql` contains development-only sample content.

In the production Supabase Dashboard:

1. Authentication > URL Configuration: set the Site URL to the deployed HTTPS
   URL and allow `http://localhost:3000/**` plus the deployed callback URL.
2. Authentication > Providers > Email: enable **Confirm email**.
3. Authentication > Email Templates > Confirm signup: use this link:

   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">
     Confirm your account
   </a>
   ```

4. Configure a production SMTP provider before launch. Supabase's default
   email sender is intended only for limited testing.
5. Put the production URL and publishable key in Vercel as
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and set
   `NEXT_PUBLIC_SITE_URL` to the deployed app URL. Never expose a secret or
   service-role key through a `NEXT_PUBLIC_` variable.

## First administrator

New accounts are customers. After the intended administrator has registered
and confirmed their email, promote the account from a trusted SQL session:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'owner@example.com'
);
```

Authorization is stored in `profiles.role`; user-editable Auth metadata is
never used for access control.
