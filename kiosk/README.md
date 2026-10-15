# Facility kiosk desktop app

The kiosk is an Electron desktop application installed only on the dedicated
front-desk computer. It packages the statically exported Next.js interface and
serves it internally over a random `127.0.0.1` port. It is not a Vercel project
and must not have a public hostname.

## Behavior

- Opens maximized on every launch.
- The kiosk header has no minimize or full-screen controls.
- `F11` toggles full screen and `Escape` leaves full screen.
- After leaving full screen, the native window can be moved, resized, maximized,
  minimized, or closed normally.
- The interface adapts to resized, maximized, and full-screen windows.
- Only the packaged local interface may navigate inside the window.
- Node integration is disabled; the renderer runs with context isolation and
  Chromium sandboxing.
- Only camera permission is accepted, and only for the internal kiosk origin.
- The scanner opens immediately; customers and staff do not sign in.
- A kiosk-only device credential is embedded in Electron's main-process bundle
  when the desktop app is built and is never exposed to the renderer.

## Local setup

1. Copy `.env.example` to `.env.local` and add the hosted Supabase URL,
   publishable key, and a random `KIOSK_ACCESS_TOKEN` of at least 32 characters.
   Use the same token for the Supabase Edge Function secret. Never add a
   Supabase secret or service-role key. The ignored `.env.local` file is needed
   only on the computer that builds the desktop app.
2. From the repository root, install dependencies with `npm install`.
3. Build and open the desktop application:

   ```bash
   npm run desktop:kiosk
   ```

4. Allow camera access when the operating system prompts.
5. The application opens directly to the scanner with no staff login screen.

After an existing build, `npm run start:kiosk` opens Electron without rebuilding.
For browser-only UI development, `npm run dev:kiosk` remains available at
`http://127.0.0.1:3002`.

## Create an installer

Build on the operating system that will run the kiosk:

```bash
# Windows NSIS installer
npm run dist:kiosk:win

# Linux AppImage
npm run dist:kiosk:linux
```

Artifacts are written to `kiosk/dist-electron/`. The Windows installer creates
Desktop and Start Menu shortcuts and lets the installer choose the destination.
Code-sign production installers before distributing them to avoid operating
system trust warnings.

The packaging command embeds the three kiosk values from `.env.local` inside
the application's `app.asar`. An installed kiosk therefore does not need an
environment or configuration file. Changing or rotating the token requires a
new installer build and reinstall.

The device token authorizes only the scan Edge Function. The function keeps
database writes behind its server-only client; no Supabase service-role key is
packaged with the application. Because a user with access to the installed
files can extract an Electron archive, distribute the installer only to trusted
facility computers and rotate the kiosk token if a device or installer is lost.
