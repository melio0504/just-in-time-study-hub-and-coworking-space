# Remote administration

This Next.js application contains the authenticated staff dashboard. Deploy it
as its own Vercel project with `admin` selected as the monorepo root directory
and attach `admin.jit-studyhub.com` to that project.

From the repository root, run:

```bash
npm run dev:admin
npm run build:admin
npm run start:admin
```

Local development and production scripts bind to `127.0.0.1:3001`.

Configure the Vercel project with the production Supabase URL, publishable key,
and `NEXT_PUBLIC_SITE_URL=https://admin.jit-studyhub.com`. Never add a Supabase
secret or service-role key to this application.

The front-desk QR scanner is a separate localhost-only application under
`kiosk/` and is intentionally absent from this deployment.

The deployed admin routes are:

- `/` — staff sign-in
- `/dashboard` — live seating overview
- `/walk-ins` — walk-in sessions and billing
- `/reservations` — reservation management
- `/announcements` — customer announcements
- `/analytics` — owner analytics
- `/staffs` — owner-managed employee accounts
- `/logs` — owner access logs

## Vercel and Porkbun setup

1. Import this repository into a second Vercel project and set its **Root
   Directory** to `admin`.
2. Add the three production environment variables above and deploy.
3. In that Vercel project, open **Settings → Domains**, add
   `admin.jit-studyhub.com`, and copy the CNAME target Vercel displays.
4. In Porkbun, open **Domain Management → jit-studyhub.com → Details → DNS
   Records**. Add a `CNAME` with host `admin` and the exact Vercel target as its
   answer. Remove an existing `admin` record first only if it conflicts.
5. Return to Vercel and wait for the domain and automatic TLS certificate to
   show as valid.

Use the target Vercel provides for this project instead of copying a generic
CNAME from another deployment. See the official
[Vercel custom-domain guide](https://vercel.com/docs/domains/set-up-custom-domain)
and [Porkbun subdomain guide](https://kb.porkbun.com/article/200-how-to-create-a-subdomain).

Before the kiosk goes live, deploy the authenticated scan function from the
repository root:

```bash
npx supabase functions deploy scan-booking-pass --use-api
```

Do not add `--no-verify-jwt`; kiosk scans require a valid staff session.
