# Supabase setup

The same migrations are used locally and in production. Do not create or edit
production tables manually in the Dashboard after adopting this workflow.

## Local database and Auth

Prerequisites: Node.js 22 or newer and Docker running locally. Docker is
required because the project's supported local database workflow runs Postgres
and the other Supabase services in containers. If Docker is not installed, use
the project's [Docker installation instructions](../docs/GETTING_STARTED.md#install-docker)
before continuing.

```bash
npm install
npm run supabase:start
npm run supabase:reset
npm run supabase:functions # keep running in a second terminal
npx supabase status
```

Copy `frontend/.env.example` to `frontend/.env.local` and
`admin/.env.example` to `admin/.env.local`, then copy the local `API_URL` and
`PUBLISHABLE_KEY` printed by `npx supabase status` into both files. The
checked-in local Auth configuration requires email confirmation and sends the
branded welcome email through Supabase Auth. Test messages are available in Mailpit at
<http://127.0.0.1:54324>.

Copy `supabase/functions/.env.example` to `supabase/functions/.env` and set a
random QR token secret. The example uses the local Mailpit inbox, so no
email-provider account is needed during local development. Generate the QR
token secret with `openssl rand -base64 48`.
The function `.env` file and all `.env.local` files are ignored by Git.

Keep `EMAIL_PROVIDER=mailpit` locally and inspect booking confirmations at
<http://127.0.0.1:54324>. Mailpit captures messages instead of delivering them
to the guest's real inbox. For production, change `EMAIL_PROVIDER=resend`, set
`RESEND_API_KEY`, and use a verified sender in `EMAIL_FROM`.

Useful local URLs:

- Public application: <http://localhost:3000>
- Facility operations: <http://127.0.0.1:3001>
- Supabase Studio: <http://127.0.0.1:54323>
- Mailpit: <http://127.0.0.1:54324>

## Test QR confirmation from a phone on the same network

Find the computer's private IPv4 address (for example `192.168.1.20`) and use
that exact address everywhere below. The phone and computer must be on the same
Wi-Fi, and the OS firewall must allow TCP ports `3000` and `54321`.

1. In `frontend/.env.local`, set:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=http://192.168.1.20:54321
   NEXT_PUBLIC_SITE_URL=http://192.168.1.20:3000
   NEXT_PUBLIC_ALLOW_INSECURE_LAN=true
   SUPABASE_INTERNAL_URL=http://127.0.0.1:54321
   ```

   The phone-facing confirmation page uses a same-origin route on port 3000;
   `SUPABASE_INTERNAL_URL` lets the Next.js server contact Supabase locally, so
   the phone does not need direct access to port 54321.

2. In `supabase/functions/.env`, set:

   ```dotenv
   # Leave empty locally; the frontend detects the computer's LAN address.
   BOOKING_CONFIRMATION_URL=
   ```

3. Restart the local functions and start the customer app on all interfaces:

   ```bash
   npm run supabase:functions
   npm run dev:frontend:lan
   ```

4. On the phone, first open `http://192.168.1.20:3000`. If the page does not
   load, fix the firewall/network before testing the QR. Create a reservation
   from the computer using the same LAN URL, then scan the displayed QR with
   the phone's normal Camera app and open the link.

The scan confirms the database booking and sends a second, private kiosk-access
QR to the account email. With `EMAIL_PROVIDER=mailpit`, the message is captured
at <http://127.0.0.1:54324> rather than delivered externally. To deliver to the
real account inbox, configure `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and a
verified `EMAIL_FROM`. For deployed use, use HTTPS and leave
`NEXT_PUBLIC_ALLOW_INSECURE_LAN=false`.

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
npx supabase functions deploy create-staff-account --use-api
npx supabase functions deploy create-booking-confirmation --use-api
npx supabase functions deploy confirm-booking --no-verify-jwt --use-api
npx supabase functions deploy scan-booking-pass --use-api
npx supabase secrets set --env-file supabase/functions/.env
npx supabase migration list
npx supabase db advisors --linked --type all --level warn --fail-on warn
```

Do not use `--include-seed` for production. Facility seats are reference data
in the migration; `seed.sql` contains development-only sample content.

In the production Supabase Dashboard:

1. Authentication > URL Configuration: set the Site URL to the deployed HTTPS
   URL and allow `http://localhost:3000/**` plus the deployed callback URL.
2. Authentication > Providers > Email: enable **Confirm email** so registration
   sends the branded welcome and account activation message.
3. Authentication > Email Templates > Confirm signup: copy the subject and HTML
   from `supabase/templates/confirmation.html`. Local template files are not
   automatically uploaded to hosted projects.
4. Configure a production SMTP provider before launch. Supabase's default
   email sender is intended only for limited testing.
5. Put the production URL and publishable key in Vercel as
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and set
   `NEXT_PUBLIC_SITE_URL` to the deployed app URL. Never expose a secret or
   service-role key through a `NEXT_PUBLIC_` variable.

## First administrator

The development seed creates the local owner account automatically:

```text
Email: admin@jit-studyhub.com
Password: admin123
```

These credentials are for local development only. `seed.sql` must never be
applied to production. For a production project, register
`admin@jit-studyhub.com` normally and then promote it from a trusted SQL
session:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'admin@jit-studyhub.com'
);
```

The owner can then create employee accounts at `/admin/staff`. Authorization is
stored in `profiles.role` and `profiles.staff_permissions`; user-editable Auth
metadata is never used for access control. New employee accounts remain blocked
from staff data until they replace their temporary password.
