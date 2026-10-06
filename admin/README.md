# Facility operations

This Next.js application contains the administrator dashboard and facility kiosk. It is intended to run locally at the study hub and must not be connected to the public Vercel project.

From the repository root, run:

```bash
npm run dev:admin
npm run build:admin
npm run start:admin
```

The normal scripts bind to `127.0.0.1:3001`. To serve trusted devices on the facility LAN, use `npm run start:admin:lan` and restrict port 3001 with the host and router firewalls. Do not configure public port forwarding.

Browser camera access is available on `localhost`/`127.0.0.1` or over HTTPS.
When developing from another device on the LAN, run `npm run dev:admin:https`
from the repository root, accept the development certificate on that device,
and open `https://<facility-computer-ip>:3001/kiosk`. A production LAN setup
must terminate HTTPS with a certificate trusted by every kiosk device; plain
HTTP on a LAN IP cannot request camera access.

The `/kiosk` route is always available without an administrator sign-in. QR
passes are long, random credentials and are processed by the server-side scan
function; the browser is not granted direct access to booking or check-in
tables. Keep the app limited to trusted facility devices and networks as
described above.
