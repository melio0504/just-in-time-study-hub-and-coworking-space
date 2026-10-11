# Getting started

This guide runs the public website, facility admin application, and their
shared Supabase backend on one development machine.

## Prerequisites

- Node.js 22.12 or newer
- npm (included with Node.js)
- Docker Desktop or Docker Engine, installed and running
- Git

Docker is required for this project's local development database. The
`npm run supabase:start` command starts Postgres and the other local Supabase
services in Docker containers; installing only the Docker command-line client
is not sufficient because the Docker daemon must also be running.

### Install Docker

Use Docker's installation guide for your operating system:

- **macOS:** Install [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/).
  Choose the download for Apple silicon or Intel, move Docker to Applications,
  and launch Docker Desktop.
- **Windows:** Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/).
  Use the WSL 2 backend (the default), enable hardware virtualization if
  needed, and launch Docker Desktop after installation.
- **Linux:** Install [Docker Engine](https://docs.docker.com/engine/install/)
  using the instructions for your distribution, then start the Docker service.
  Complete Docker's
  [Linux post-installation steps](https://docs.docker.com/engine/install/linux-postinstall/)
  if you want to run Docker without `sudo`.

After installation, make sure Docker Desktop or the Docker service is running,
then verify Node.js, npm, the Docker client, and the Docker daemon:

```bash
node --version
npm --version
docker version
docker info
```

Both Docker commands must complete successfully before you start the local
database. If `docker version` shows only a client section or `docker info`
cannot connect to the daemon, start Docker Desktop or the Docker service and
try again.

## 1. Install dependencies

From the repository root, install all npm workspaces:

```bash
npm install
```

Run npm commands from the repository root unless a guide explicitly says
otherwise. The root lockfile is the dependency source of truth.

## 2. Start the local backend

Start the Docker-based Supabase services and apply all migrations and seed
data:

```bash
npm run supabase:start
npm run supabase:reset
```

Display the local connection details:

```bash
npx supabase status
```

Keep the `API_URL` and `PUBLISHABLE_KEY` values available for the next step.
They belong to this local Supabase instance.

## 3. Create local environment files

Each Next.js application reads its own environment file. Create both files
from the committed templates:

```bash
cp frontend/.env.example frontend/.env.local
cp admin/.env.example admin/.env.local
```

Set the local values as follows, replacing the publishable-key placeholder
with the value printed by `npx supabase status`:

```dotenv
# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_local_publishable_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

```dotenv
# admin/.env.local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_local_publishable_key
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001
```

Do not put these variables only in a root `.env` file. The two apps are
separate workspace packages and must each have their own `.env.local`.

For a shared or production environment, the project owner will provide the
real values separately through a secure credential-sharing method. They are
intentionally not included in this repository or documentation. See
[Environment and secrets](ENVIRONMENT.md).

## 4. Generate database types

Generate TypeScript definitions from the running local database:

```bash
npm run supabase:types
```

This updates the frontend type file and copies the same definitions to the
admin application.

## 5. Run the applications

Open two terminals at the repository root.

Terminal 1 — public customer website:

```bash
npm run dev:frontend
```

Terminal 2 — facility admin and kiosk:

```bash
npm run dev:admin
```

Open:

- <http://localhost:3000> for the public website
- <http://127.0.0.1:3001/admin> for administration
- <http://127.0.0.1:3001/kiosk> for the on-site kiosk

The admin development server deliberately binds to `127.0.0.1`; it is not
available to other devices on the network.

## 6. Verify the setup

Run the project checks:

```bash
npm run lint
npm run build
npx supabase test db --local
```

You can inspect test emails at <http://127.0.0.1:54324> and local data at
<http://127.0.0.1:54323>.

## Daily commands

```bash
# Start or stop the local backend
npm run supabase:start
npm run supabase:stop

# Recreate the database from migrations and development seed data
npm run supabase:reset

# Run one application
npm run dev:frontend
npm run dev:admin

# Validate all workspaces
npm run lint
npm run build
```

`supabase:reset` recreates local database data. Do not use it against a
production project.
