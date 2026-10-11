# Facility operations

This Next.js application contains the administrator dashboard and facility kiosk. It is intended to run locally at the study hub and must not be connected to the public Vercel project.

From the repository root, run:

```bash
npm run dev:admin
npm run build:admin
npm run start:admin
```

The scripts bind to `127.0.0.1:3001`, so use the dashboard and kiosk directly
from the facility computer. Browser camera access is available on
`localhost`/`127.0.0.1`.

The `/kiosk` route is always available without an administrator sign-in. QR
passes are long, random credentials and are processed by the server-side scan
function; the browser is not granted direct access to booking or check-in
tables. Keep the app on the trusted facility computer.
