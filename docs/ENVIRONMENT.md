# Environment and secrets

## Required application variables

Both `frontend/.env.local` and `admin/.env.local` require these variables:

| Variable | Purpose | Browser-visible? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API URL | Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key used by the Supabase client | Yes |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for the application | Yes |

All variables prefixed with `NEXT_PUBLIC_` are included in browser code. Only
use a Supabase **publishable** key in
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never place a Supabase secret key,
legacy `service_role` key, database password, personal access token, or other
private credential in a `NEXT_PUBLIC_` variable.

## Local development

The committed `.env.example` files contain safe local defaults and
placeholders. Create ignored local files with:

```bash
cp frontend/.env.example frontend/.env.local
cp admin/.env.example admin/.env.local
```

Get the local publishable key from:

```bash
npx supabase status
```

Restart the affected Next.js development server after changing an environment
file.

## Shared and production credentials

Real hosted-environment values are deliberately omitted from Git. The project
owner will provide them separately using a more secure method, such as an
approved password manager or the deployment platform's encrypted environment
variable settings.

When receiving credentials:

1. Verify the intended environment (development, staging, or production).
2. Add public frontend values directly to the correct deployment project or
   local `.env.local` file.
3. Store private operational credentials only in the service that needs them.
4. Do not paste credentials into issues, pull requests, chat messages,
   screenshots, documentation, or source files.
5. Do not commit `.env`, `.env.local`, or exported credential files.

If a private credential is accidentally committed or shared publicly, treat
it as compromised: revoke or rotate it immediately, remove it from active
systems, and notify the project owner. Removing it in a later commit does not
remove it from Git history.

## Deployment values

The public Vercel project uses the values for the hosted Supabase project:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

Set them in Vercel's environment-variable settings rather than committing an
environment file. Use separate values for Preview and Production when those
environments use separate backends.

The facility admin application uses its own `admin/.env.local`. Its public
Supabase values may point to the hosted project, but any database password,
Supabase personal access token, or other privileged operational credential
must remain outside the Next.js client environment.

## Files and precedence

- `frontend/.env.example` and `admin/.env.example` are committed templates.
- `frontend/.env.local` and `admin/.env.local` are machine-specific and
  ignored by Git.
- A root `.env` is not the canonical configuration for either application.
- Environment-specific files must never replace the committed templates.

Before committing, check that no environment file is staged:

```bash
git status --short
git diff --cached
```

