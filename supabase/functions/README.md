# Supabase Edge Functions

The Edge Functions provide the trusted server boundary for staff account
creation and lifecycle management, PayMongo dynamic QR Ph payments,
confirmation and reservation end-time email delivery, and kiosk QR scans. Kiosk scans require the
private `KIOSK_ACCESS_TOKEN` shared with the installed Electron main process;
the kiosk has no staff login screen. Never move a Supabase secret or
service-role key into a browser application.

Copy `.env.example` to `.env` in this directory for local development and fill
in the test PayMongo keys, test webhook signing secret, QR token secret, and
kiosk device token. The same kiosk token must be set in `kiosk/.env.local`.
Keep `PAYMONGO_SIMULATE_REFUNDS=true` only in test environments: PayMongo does
not create refunds for test transactions, so the cancellation function records
a clearly marked simulated success instead of calling the provider. Live mode
rejects this setting and always requires a real PayMongo refund.
Booking confirmations use the local Mailpit inbox by default at
<http://127.0.0.1:54324>; Mailpit captures the message and inline kiosk QR
without delivering it to a real inbox. This `.env` file is ignored by Git.

For production delivery, set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and a
verified sender in `EMAIL_FROM` before deploying function secrets.

The reservation end reminder runs every minute from Supabase Cron and sends
one email when a checked-in reservation reaches its final 30 minutes. Set the
same random value (at least 32 characters) as the Edge Function secret and the
Vault scheduler secret, then add the project URL and publishable key to Vault:

```sql
select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co', 'project_url');
select vault.create_secret('YOUR_PUBLISHABLE_KEY', 'publishable_key');
select vault.create_secret('YOUR_RANDOM_CRON_SECRET', 'end_time_reminder_cron_secret');
```

```bash
npx supabase secrets set END_TIME_REMINDER_CRON_SECRET=YOUR_RANDOM_CRON_SECRET
```

Serve it locally with:

```bash
npm run supabase:functions
```

Deploy it after linking the Supabase project:

```bash
npx supabase functions deploy create-staff-account --use-api
npx supabase functions deploy manage-staff-account --use-api
npx supabase functions deploy create-paymongo-qr --use-api
npx supabase functions deploy paymongo-webhook --no-verify-jwt --use-api
npx supabase functions deploy create-booking-confirmation --use-api
npx supabase functions deploy confirm-booking --no-verify-jwt --use-api
npx supabase functions deploy resend-booking-pass --use-api
npx supabase functions deploy get-booking-pass --use-api
npx supabase functions deploy cancel-customer-booking --use-api
npx supabase functions deploy delete-account --use-api
npx supabase functions deploy scan-booking-pass --no-verify-jwt --use-api
npx supabase functions deploy send-end-time-reminders --no-verify-jwt --use-api
```

Before deploying the kiosk function, add its production credential with
`npx supabase secrets set KIOSK_ACCESS_TOKEN=<random-value>`. Install that same
value only on the facility kiosk computer.
