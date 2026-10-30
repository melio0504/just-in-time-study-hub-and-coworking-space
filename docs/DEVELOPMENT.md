# Development and operations

## Repository layout

```text
.
├── frontend/          Public Next.js application
├── admin/             Remote staff dashboard Next.js application
├── kiosk/             Electron front-desk scanner application
├── supabase/          Database, Auth, tests, and local service configuration
├── docs/              Developer and operator documentation
├── package.json       Workspace scripts and shared tool versions
└── package-lock.json  Locked dependencies for all workspaces
```

## Quality checks

Before opening a pull request, run:

```bash
npm run lint
npm test
npm run build
```

Run `npm run test:e2e` for user-interface changes. The complete unit, browser,
database, coverage, and CI workflow is documented in [Testing](TESTING.md).

For database-related changes, also run:

```bash
npm run supabase:reset
npx supabase test db --local
npx supabase db advisors --local --type all --level warn --fail-on warn
npm run supabase:types
```

Commit generated database type changes when the schema changes.

## Database workflow

This project uses ordered SQL migrations in `supabase/migrations/`.

1. Start the local Supabase stack.
2. Create the migration with the installed CLI rather than inventing a file
   name:

   ```bash
   npx supabase migration new descriptive_change_name
   ```

3. Edit the generated SQL migration.
4. Rebuild the local database and run tests and advisors.
5. Regenerate TypeScript database types.
6. Review the SQL, generated types, and application behavior together.

Every table exposed through the Data API must use RLS with policies matching
the real ownership and staff-access model. Do not solve permission errors by
adding a service-role key to either application.

Production migration commands and the first-administrator procedure are in
[the Supabase reference](../supabase/README.md).

## Running production builds locally

Build all applications:

```bash
npm run build
```

Then start them in separate terminals:

```bash
npm run start:frontend
npm run start:admin
npm run start:kiosk
```

The frontend and admin commands start local servers. `start:kiosk` opens the
previously exported kiosk UI in Electron; use `desktop:kiosk` to rebuild it
first. Production admin is a separate Vercel deployment, while kiosk stays on
the facility computer.

## Deployment boundaries

- Deploy `frontend/` as the Vercel Root Directory.
- Deploy `admin/` as a second Vercel project at `admin.jit-studyhub.com`.
- Do not deploy `kiosk/` or create a public DNS record for it.
- Apply database migrations through the documented Supabase workflow.
- Do not seed production with `supabase/seed.sql`.
- Configure hosted environment variables through the platform, following
  [Environment and secrets](ENVIRONMENT.md).

## Troubleshooting

### “Supabase is not configured”

Confirm that both required Supabase variables exist in the `.env.local` file
inside the application being run. Restart the development server after any
change.

### The local API cannot be reached

Check Docker, then inspect service status:

```bash
docker ps
npx supabase status
```

If the stack is stopped, run `npm run supabase:start`.

### Local schema or seed data looks stale

Recreate the local database:

```bash
npm run supabase:reset
npm run supabase:types
```

This deletes and recreates local development data.

### Ports are already in use

The expected application ports are `3000` and `3001`; Supabase uses the ports
defined in `supabase/config.toml`, including `54321` for the API, `54323` for
Studio, and `54324` for the email viewer. Stop the conflicting local process or
service before restarting the project.

### Admin is unavailable from another device during local development

This is expected for `npm run dev:admin`, which listens only on `127.0.0.1`.
Use `admin.jit-studyhub.com` for the deployed remote dashboard. The kiosk is a
separate Electron application on the facility computer.
