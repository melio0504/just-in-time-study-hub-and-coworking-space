# PayMongo QR Ph and confirmation email setup

The reservation flow is:

```text
Reserve seat -> database seat hold -> PayMongo dynamic QR Ph -> signed webhook
             -> paid booking -> kiosk access pass -> Mailpit or Resend email
```

The browser never receives a PayMongo secret key and never marks a booking as
paid. The amount comes from `bookings.subtotal_cents`, which is calculated by
Postgres from the selected seats and duration.

## Local development

Copy the function environment template if it does not exist:

```bash
cp supabase/functions/.env.example supabase/functions/.env
```

Set these ignored local values in `supabase/functions/.env`:

```dotenv
QR_ACCESS_TOKEN_SECRET=<at-least-32-random-characters>
PUBLIC_SITE_URL=http://localhost:3000
PAYMONGO_MODE=test
PAYMONGO_SIMULATE_REFUNDS=true
PAYMONGO_SECRET_KEY=sk_test_...
PAYMONGO_PUBLIC_KEY=pk_test_...
PAYMONGO_WEBHOOK_SECRET=<secret-for-the-test-webhook-endpoint>

EMAIL_PROVIDER=mailpit
EMAIL_FROM=Just In Time Study Hub <bookings@local.test>
MAILPIT_API_URL=http://inbucket:8025/api/v1/send
```

Start or rebuild the local stack after changing function secrets:

```bash
npm run supabase:reset
npm run supabase:functions
npm run dev:frontend
```

Install the `cloudflared` system dependency before testing PayMongo webhooks.
Follow the official [Cloudflare Tunnel installation instructions](https://developers.cloudflare.com/tunnel/downloads/),
then verify the executable is available:

```bash
cloudflared --version
```

Mailpit is available at <http://127.0.0.1:54324>. It captures confirmation
emails locally and never delivers them to the customer's real inbox.

PayMongo cannot call a localhost webhook. Keep the local Edge Functions server
running, then start a Cloudflare Quick Tunnel in another terminal:

```bash
npm run paymongo:tunnel
```

The command exposes `http://127.0.0.1:54321` and prints a temporary base URL
similar to `https://random-words.trycloudflare.com`. Append the Edge Function
path and register the complete URL as the **test-mode** PayMongo webhook:

```text
https://random-words.trycloudflare.com/functions/v1/paymongo-webhook
```

Update the existing webhook URL in the PayMongo test-mode dashboard before
authorizing a payment. A Quick Tunnel URL stops working when the command stops,
and every new run generates a different hostname; replace the PayMongo webhook
URL after every restart. Keep the tunnel terminal open throughout the test.

Subscribe to `payment.paid`, `payment.failed`, and `qrph.expired`. If you create
a new webhook instead of updating the existing one, copy its signing secret
into `PAYMONGO_WEBHOOK_SECRET`, then restart `npm run supabase:functions`. Use
PayMongo's test keys and test controls. Do not scan the test QR code with a
banking or e-wallet app; use PayMongo's `test_url` instead.

The local PayMongo test workflow therefore needs three long-running processes:

```bash
npm run supabase:functions # terminal 1
npm run paymongo:tunnel    # terminal 2; update PayMongo with the printed URL
npm run dev:frontend       # terminal 3
```

After a reservation displays its test QR code, open PayMongo's approval and
rejection controls for the latest active local Payment Intent with:

```bash
npm run paymongo:test-url
```

The command prints the test URL and opens it in the default browser when a
desktop is available. To only print the URL, run:

```bash
npm run paymongo:test-url -- --print-only
```

PayMongo only supports refunds for live transactions. In test mode,
`PAYMONGO_SIMULATE_REFUNDS=true` makes the cancellation Edge Function complete
the same database workflow using a `ref_test_sim_...` identifier and a marked
simulation payload; no money is moved and no refund request is sent to
PayMongo. Restart `npm run supabase:functions` after changing the value. Set it
to `false` (or remove it) in production; the function also refuses to start a
live refund while simulation is enabled.

## Production: Supabase and Resend

1. Verify the sending domain in Resend. Add the SPF and DKIM records Resend
   provides, and use a sender on that domain, such as
   `reservations@jit-studyhub.com`.
2. In the hosted Supabase project, set these Edge Function secrets through
   **Edge Functions -> Secrets** or the CLI:

   ```text
   QR_ACCESS_TOKEN_SECRET
   PUBLIC_SITE_URL=https://your-vercel-domain.example
   PAYMONGO_MODE=live
   PAYMONGO_SIMULATE_REFUNDS=false
   PAYMONGO_SECRET_KEY=sk_live_...
   PAYMONGO_PUBLIC_KEY=pk_live_...
   PAYMONGO_WEBHOOK_SECRET=<live-endpoint-signing-secret>
   EMAIL_PROVIDER=resend
   EMAIL_FROM=Just In Time Study Hub <reservations@your-verified-domain.example>
   RESEND_API_KEY=re_...
   ```

3. Push the database migration, then deploy the payment functions:

   ```bash
   npx supabase db push
   npx supabase functions deploy create-paymongo-qr --use-api
   npx supabase functions deploy paymongo-webhook --no-verify-jwt --use-api
   ```

4. Also deploy the two compatibility stubs so an older deployed simulator
   cannot confirm an unpaid booking:

   ```bash
   npx supabase functions deploy create-booking-confirmation --use-api
   npx supabase functions deploy confirm-booking --no-verify-jwt --use-api
   ```

5. In the PayMongo live dashboard, register:

   ```text
   https://<your-project-ref>.supabase.co/functions/v1/paymongo-webhook
   ```

   Subscribe to `payment.paid`, `payment.failed`, and `qrph.expired`, then save
   the live endpoint signing secret as `PAYMONGO_WEBHOOK_SECRET` in Supabase.

The live webhook points to Supabase, not Vercel. Supabase owns payment
finalization, database updates, kiosk-pass generation, and transactional email.

## Production: Vercel

The Vercel frontend needs only browser-safe values:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
```

Do not add `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, `RESEND_API_KEY`, or
a Supabase secret/service-role key to Vercel. No PayMongo key is required in
the browser for this QR-only implementation.

## Supabase Auth email is separate

The Resend API integration above sends reservation/payment emails. Signup,
password-reset, and magic-link messages are sent by Supabase Auth. Configure
Resend SMTP (or a Supabase Send Email Hook) separately in the Supabase Auth
settings if production Auth email should also use Resend.

## Go-live checks

- Generate two reservations and confirm each receives a different single-use
  QR containing its exact server-calculated amount.
- Confirm an overlapping seat cannot be booked while the first payment is
  pending.
- Confirm only a verified `payment.paid` webhook changes the booking to paid.
- Replay the same webhook and verify it does not duplicate the booking, kiosk
  pass, or Resend email.
- Test `payment.failed` and `qrph.expired` and verify the seat becomes available.
- Confirm the email contains the separate `JITPASS:` kiosk QR, not the payment
  QR.
- Switch all four PayMongo values together when moving from test to live.
