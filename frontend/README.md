# Just in Time Study Hub Frontend

This Next.js application contains only customer-facing routes. Deploy this directory as the Root Directory of the Vercel project.

The `/admin` and `/kiosk` routes belong to the sibling `admin/` application and are not included in this build.

From the repository root, run:

```bash
npm run dev:frontend
npm run build:frontend
```

The Capacitor Android wrapper is in `frontend/android`. See the
[Android app guide](../docs/ANDROID.md) for prerequisites, local development,
and release builds.
