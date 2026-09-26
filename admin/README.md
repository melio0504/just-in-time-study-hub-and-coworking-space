# Facility operations

This Next.js application contains the administrator dashboard and facility kiosk. It is intended to run locally at the study hub and must not be connected to the public Vercel project.

From the repository root, run:

```bash
npm run dev:admin
npm run build:admin
npm run start:admin
```

The normal scripts bind to `127.0.0.1:3001`. To serve trusted devices on the facility LAN, use `npm run start:admin:lan` and restrict port 3001 with the host and router firewalls. Do not configure public port forwarding.
