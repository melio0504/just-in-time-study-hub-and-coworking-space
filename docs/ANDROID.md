# Android app

The public frontend is available as a Capacitor 8 Android application. The
native project is in `frontend/android` and has the application ID
`com.jitstudyhub.app`.

The Next.js frontend uses server routes and Supabase SSR, so it is not a static
web bundle. The Android WebView therefore loads a running Next.js deployment.
By default it loads the host development server through the standard Android
emulator address, `http://10.0.2.2:3000`. Set `CAPACITOR_SERVER_URL` to use a
physical-device or deployed URL.

> **Architecture note:** Capacitor documents `server.url` as a live-reload
> option rather than a production packaging strategy. This project uses it for
> the production wrapper because the current Next.js application depends on a
> server and cannot be copied into the APK as static files. A fully bundled,
> offline-capable app would require a separate refactor of the server routes,
> middleware, and Supabase SSR flows.

## Prerequisites

- Node.js 22 or newer and npm
- Android Studio 2025.2.1 or newer
- Android SDK Platform 36 and the Android SDK tools
- An Android emulator or a physical device with USB debugging enabled

Android Studio includes the required JDK. If command-line builds cannot find
Java, set `JAVA_HOME` to the JDK shown under **Settings > Build, Execution,
Deployment > Build Tools > Gradle > Gradle JDK** in Android Studio.

### Linux installations outside the default location

If Android Studio is installed under `/opt/android-studio`, add these lines to
your shell configuration (for example, `~/.bashrc`):

```bash
export CAPACITOR_ANDROID_STUDIO_PATH=/opt/android-studio/bin/studio.sh
export JAVA_HOME=/opt/android-studio/jbr
export PATH="$JAVA_HOME/bin:$PATH"
```

Reload the shell configuration before running the Android commands:

```bash
source ~/.bashrc
```

`CAPACITOR_ANDROID_STUDIO_PATH` tells `cap open android` which executable to
launch. Using Android Studio's bundled JDK also avoids Gradle failures caused
by an incompatible system Java version.

## Install and open the app

From the repository root:

```bash
npm install
npm run dev:frontend:lan
```

Leave that terminal running. In another terminal:

```bash
npm run android:sync
npm run android:open
```

The last command opens `frontend/android` in Android Studio. Wait for the
Gradle sync to finish, choose an emulator or connected device, and click
**Run**.

To select and launch a device from the terminal instead:

```bash
npm run android:run
```

The default address works with the standard Android emulator. For a physical
device or a deployed frontend, set the URL as described below.

## Develop against the local frontend

Start the frontend so it listens on the local network if it is not already
running:

```bash
npm run dev:frontend:lan
```

In another terminal, launch the app. The standard Android emulator can use the
configured default because the host computer is available at `10.0.2.2`:

```bash
npm run android:run
```

For a physical device, connect the phone and computer to the same network and
replace `192.168.1.20` with the computer's LAN address:

```bash
CAPACITOR_SERVER_URL=http://192.168.1.20:3000 npm run android:run
```

The selected URL is written into generated Android assets by Capacitor each
time it syncs.

When testing on a physical device, allow incoming TCP traffic on port 3000 in
the computer's firewall. Local Supabase URLs such as `127.0.0.1:54321` refer to
the Android device itself when used by browser-side code. Use a reachable
Supabase environment for device testing, or expose the local Supabase ports to
the device and update the frontend environment accordingly.

### Windows PowerShell

PowerShell sets the one-command override like this:

```powershell
$env:CAPACITOR_SERVER_URL = "http://10.0.2.2:3000"
npm run android:run
Remove-Item Env:CAPACITOR_SERVER_URL
```

## Sync after changes

Run a sync whenever Capacitor configuration, plugins, or the local shell
changes:

```bash
npm run android:sync
```

Normal website changes are served by Next.js and do not require a native sync.

## Build an APK or app bundle

Open Android Studio with `npm run android:open`, then use:

- **Build > Build APK(s)** for an installable debug APK.
- **Build > Generate Signed Bundle / APK** for a signed release APK or Android
  App Bundle (`.aab`) for Google Play.

Keep signing keystores and passwords outside the repository. Before making a
release build, sync with the real HTTPS frontend URL:

```bash
CAPACITOR_SERVER_URL=https://your-production-domain.example npm run android:sync
```

Do not create a release with the default emulator URL. At the time this guide
was added, the repository homepage domain `jit-studyhub.com` did not resolve,
so it is intentionally not hard-coded into the app.

For a command-line debug APK:

```bash
cd frontend/android
./gradlew assembleDebug
```

On Windows, use `gradlew.bat assembleDebug`. The APK is written under
`frontend/android/app/build/outputs/apk/debug/`.

## Configuration reference

- Capacitor configuration: `frontend/capacitor.config.ts`
- Native Android project: `frontend/android`
- Offline/error page: `frontend/capacitor-shell/index.html`
- Production URL override: `CAPACITOR_SERVER_URL`

Production URLs must use HTTPS. Plain HTTP is enabled only when the selected
URL starts with `http://`, for local live-reload development.
