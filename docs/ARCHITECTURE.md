# Architecture

## System overview

This repository is an npm workspace with two Next.js 16 applications and one
shared Supabase project.

```text
Customer browser                    Facility computer
       |                                   |
       v                                   v
frontend/ (port 3000)              admin/ (port 3001)
       |                                   |
       +-------------+---------------------+
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

It runs on port `3000` and is the only application intended for public Vercel
deployment.

### `admin/`

The facility application contains:

- the authenticated admin area at `/admin`
- dashboard and analytics pages
- the on-site check-in kiosk at `/kiosk`

It runs on `127.0.0.1:3001` on the facility machine. Authorization and database
Row Level Security (RLS) remain required.

### `supabase/`

This directory is the shared backend source of truth:

- `migrations/` — ordered database schema and policy changes
- `seed.sql` — development-only sample data
- `tests/` — database tests
- `config.toml` — local Supabase services and Auth configuration
- `templates/` — local Auth email templates
- `functions/` — Edge Function documentation and future function code

Both applications use the same generated database types. Run
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
4. Realtime-enabled operational data updates the dashboard and kiosk views.

## Source-of-truth rules

- Database changes belong in `supabase/migrations/`, not manual production
  Dashboard edits.
- `package-lock.json` is the dependency lockfile for both workspaces.
- Generated database types must stay synchronized across both applications.
- Public pages belong in `frontend/`; admin and kiosk pages belong in
  `admin/`.

