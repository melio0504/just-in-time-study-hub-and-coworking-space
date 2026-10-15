# Project documentation

This directory is the starting point for developers and operators working on
Just In Time Study Hub and Coworking Space.

## Documentation map

- [Getting started](GETTING_STARTED.md) — install Docker and the project,
  configure the environment, start the local Supabase database, and run both
  applications.
- [Environment and secrets](ENVIRONMENT.md) — required variables, safe local
  setup, and how production credentials are handed over.
- [PayMongo and email](PAYMENTS_AND_EMAIL.md) — dynamic QR Ph payments,
  webhooks, local Mailpit, production Resend, and deployment.
- [Architecture](ARCHITECTURE.md) — applications, routes, shared services, and
  important data flows.
- [Development and operations](DEVELOPMENT.md) — checks, database changes,
  generated types, deployment boundaries, and troubleshooting.
- [Testing](TESTING.md) — unit, browser, database/RLS, coverage, and CI suites.
- [Contributing](CONTRIBUTING.md) — branch, commit, and pull-request workflow.
- [Supabase reference](../supabase/README.md) — database testing, production
  migration, Auth configuration, and first-admin setup.

## Quick start

The local development database runs in Docker. Install and start Docker first;
see the [Docker installation instructions](GETTING_STARTED.md#install-docker).

For a complete local environment:

```bash
npm install
npm run supabase:start
npm run supabase:reset
npm run supabase:types
cp frontend/.env.example frontend/.env.local
cp admin/.env.example admin/.env.local
cp kiosk/.env.example kiosk/.env.local
```

Use `npx supabase status` to obtain the local API URL and publishable key, add
them to all three `.env.local` files, then run the applications in separate
terminals:

```bash
npm run dev:frontend
npm run dev:admin
npm run dev:kiosk
```

- Public site: <http://localhost:3000>
- Admin: <http://127.0.0.1:3001>
- Kiosk: <http://127.0.0.1:3002>
- Supabase Studio: <http://127.0.0.1:54323>
- Local email viewer: <http://127.0.0.1:54324>

`npm run dev:kiosk` is the browser development preview. Run
`npm run desktop:kiosk` to build and open the Electron desktop application.
