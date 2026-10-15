# Testing

The repository has four automated test layers: TypeScript unit tests, Electron
main-process tests, browser smoke tests for all three interfaces, and pgTAP
tests for the database schema and row-level security (RLS).

## Unit tests

Run every application unit test, including the Electron static-server tests:

```bash
npm test
```

Run either application independently from the repository root:

```bash
npm run test:frontend
npm run test:admin
```

The equivalent npm workspace commands are `npm test --workspace
@jit-studyhub/frontend`, `npm test --workspace @jit-studyhub/admin`, and
`npm test --workspace @jit-studyhub/kiosk`.

During development, run the watcher for the application you are changing:

```bash
npm run test:watch --workspace @jit-studyhub/frontend
npm run test:watch --workspace @jit-studyhub/admin
```

Generate coverage in `coverage/frontend/` and `coverage/admin/`:

```bash
npm run test:coverage
```

Vitest enforces 80% line, function, and statement coverage and 75% branch
coverage for code loaded by each workspace's unit suite. Keep tests beside the
module they cover using the `*.test.ts` suffix.

## Browser tests

Install the Playwright Chromium browser once, then run the smoke suite:

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright starts browser previews of the public app on port 3000, admin on
port 3001, and kiosk on port 3002. It verifies the public booking journey,
pricing and 404 pages, operations authentication, and kiosk authorization.

To use a system Chromium or Chrome installation instead of Playwright's
download, provide its absolute path:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome npm run test:e2e
```

Open the interactive runner with `npm run test:e2e:ui`. Failure artifacts go
to `test-results/`, and the HTML report goes to `playwright-report/`.

Run one application's browser smoke tests independently:

```bash
npm run test:e2e:frontend
npm run test:e2e:admin
npm run test:e2e:kiosk
```

## Database and RLS tests

The database suite requires Docker and the local Supabase stack:

```bash
npm run supabase:start
npm run test:db
```

For a clean migration test, reset the development database first. This deletes
local development data and restores the checked-in seed:

```bash
npm run supabase:reset
npm run test:db
```

The SQL files in `supabase/tests/` run inside transactions and roll back their
own fixtures. `core_schema_test.sql` checks schema and privilege contracts;
`rls_access_test.sql` executes access paths as anonymous visitors, customers,
scoped employees, and the owner; and `booking_operations_test.sql` verifies
atomic booking, overlap prevention, cancellation, availability, walk-in
occupancy, audit logging, and permission enforcement.

## Common commands

```bash
npm run check          # lint, unit tests, and production builds
npm run test:all       # unit, browser, and database tests
npm run test:unit      # unit tests only
npm run test:frontend  # frontend unit tests only
npm run test:admin     # admin unit tests only
npm run test:coverage  # unit tests with thresholds and reports
npm run test:e2e       # public, admin, and kiosk browser smoke tests
npm run test:e2e:frontend # public browser tests only
npm run test:e2e:admin # admin browser tests only
npm run test:e2e:kiosk # kiosk browser tests only
npm run test:db        # pgTAP schema and RLS tests
```

`test:all` expects the Playwright browser and local Supabase stack to already
be available. GitHub Actions installs and starts those dependencies in separate
application and database jobs.
