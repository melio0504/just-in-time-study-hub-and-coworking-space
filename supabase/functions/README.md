# Supabase Edge Functions

The Edge Functions provide the trusted server boundary for staff account
creation, local booking confirmation QR codes, confirmation email delivery,
and kiosk QR scans. Never move a secret or service-role key into either
Next.js browser application.

Copy `.env.example` to `.env` in this directory for local development and fill
in the QR token secret and customer-app confirmation URL. Booking confirmations use the local
Mailpit inbox by default at <http://127.0.0.1:54324>; Mailpit captures the
message and inline kiosk QR without delivering it to a real inbox. This `.env`
file is ignored by Git. The public confirmation function accepts only a short-lived,
random, one-time token; raw tokens and customer details are not stored in the QR.

For production delivery, set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and a
verified sender in `EMAIL_FROM` before deploying function secrets.

Serve it locally with:

```bash
npm run supabase:functions
```

Deploy it after linking the Supabase project:

```bash
npx supabase functions deploy create-staff-account --use-api
npx supabase functions deploy create-booking-confirmation --use-api
npx supabase functions deploy confirm-booking --no-verify-jwt --use-api
npx supabase functions deploy scan-booking-pass --no-verify-jwt --use-api
```
