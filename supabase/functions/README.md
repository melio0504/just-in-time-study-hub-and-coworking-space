# Supabase Edge Functions

`create-staff-account` is the owner-only backend for creating employee Auth
users. It verifies the caller's JWT and owner profile before using the
server-side admin client. Never move this operation or any secret/service-role
key into either Next.js browser application.

Serve it locally with:

```bash
npm run supabase:functions
```

Deploy it after linking the Supabase project:

```bash
npx supabase functions deploy create-staff-account --use-api
```
