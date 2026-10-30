# Architecture

## System overview

This repository is an npm workspace with two Next.js 16 web applications, one
Electron kiosk with a statically exported Next.js renderer, and one shared
Supabase project.

```text
Customer browser     Staff browser       Facility desktop
       |                   |                     |
       v                   v                     v
frontend/ (3000)     admin/ (3001)       kiosk/ (Electron)
       |                   |                     |
       +-------------------+---------------------+
                     |
                     v
       Supabase Auth, Data API, Realtime, and Postgres
                     |
                     v
       migrations, RLS policies, functions, and seed data
                    in supabase/
```

## Applications

### `frontend/`

The public customer application contains:

- marketing pages, pricing, gallery, and virtual tour
- registration, login, and email confirmation
- account and reservation flows
- public announcements

It runs on port `3000` and is deployed to `jit-studyhub.com`.

### `admin/`

The remote staff application contains:

- the administrator sign-in page at `/`
- dedicated `/dashboard`, `/walk-ins`, `/reservations`, `/announcements`,
  `/analytics`, `/staffs`, and `/logs` pages

It runs locally on `127.0.0.1:3001` and is deployed as a separate Vercel project
at `admin.jit-studyhub.com`. Authentication, staff permissions, and database
Row Level Security (RLS) are required.

### `kiosk/`

The facility-only application packages the front-desk QR scanner inside
Electron. Its static UI is served internally on loopback and is not publicly
deployed. It opens without a user login; Electron's main process authenticates
scan requests with a kiosk-scoped device credential. The renderer is sandboxed,
has no Node.js access, and never receives that credential.

### `supabase/`

This directory is the shared backend source of truth:

- `migrations/` — ordered database schema and policy changes
- `seed.sql` — development-only sample data
- `tests/` — database tests
- `config.toml` — local Supabase services and Auth configuration
- `templates/` — local Auth email templates
- `functions/` — Edge Function documentation and future function code

The frontend and admin applications use the same generated database types. Run
`npm run supabase:types` after a schema change.

## Data and authorization

Supabase Auth provides user identity. A trigger creates the related
`public.profiles` row, whose role is one of `customer`, `staff`, or `admin`.
Authorization is enforced in database policies and functions; user-editable
Auth metadata is not used to grant roles.

Core data areas include:

- profiles and staff roles
- seats, bookings, booking seats, payments, and QR access passes
- check-in sessions and walk-in occupancy
- announcements and hub content
- flashcards and study sessions
- analytics, daily business metrics, and audit logs

RLS is enabled on the application tables. Browser applications use a
publishable key; privileged database keys must not be shipped to either app.

## Important flows

### Customer booking

1. A customer signs in through Supabase Auth.
2. The frontend requests seat availability from the database function.
3. The frontend submits the reservation through `create_booking`.
4. The database validates the user and requested seats and writes the booking
   atomically.
5. The authenticated payment function creates a PayMongo dynamic QR Ph code
   for the database-calculated amount.
6. A signed PayMongo webhook verifies the Payment Intent, confirms the booking,
   creates the kiosk pass, and sends the Mailpit or Resend email.
7. RLS limits customers to their own booking data while staff can perform
   authorized operational work.

### Facility operations

1. The admin application refreshes and validates the Supabase session.
2. Database authorization confirms the user's staff or admin role.
3. Admin actions use the exposed, permission-checked database functions and
   policies.
4. The separately authenticated kiosk invokes the permission-checked scanning
   function; Realtime updates operational views.

## Source-of-truth rules

- Database changes belong in `supabase/migrations/`, not manual production
  Dashboard edits.
- `package-lock.json` is the dependency lockfile for all workspaces.
- Generated database types must stay synchronized across frontend and admin.
- Public pages belong in `frontend/`, staff pages in `admin/`, and the local
  scanner in `kiosk/`.
