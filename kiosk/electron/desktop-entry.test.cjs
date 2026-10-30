const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createDesktopEntry,
  installLinuxDesktopEntry,
} = require("../scripts/install-linux-desktop-entry.cjs");

test("creates a Linux desktop entry that matches the Electron app identity", () => {
  const entry = createDesktopEntry({
    electronPath: "/opt/Electron Runtime/electron",
    kioskDirectory: "/opt/Just In Time/kiosk",
    iconPath: "/opt/Just In Time/kiosk/electron/icon.png",
  });

  assert.match(entry, /^Name=Just In Time Kiosk$/m);
  assert.match(entry, /^Exec="\/opt\/Electron Runtime\/electron" "\/opt\/Just In Time\/kiosk"$/m);
  assert.match(entry, /^Icon=\/opt\/Just In Time\/kiosk\/electron\/icon\.png$/m);
  assert.match(entry, /^StartupWMClass=com\.jitstudyhub\.kiosk$/m);
});

test("installs the desktop entry in the selected XDG data directory", (context) => {
  const dataHome = fs.mkdtempSync(path.join(os.tmpdir(), "jit-kiosk-desktop-entry-"));
  context.after(() => fs.rmSync(dataHome, { recursive: true, force: true }));

  const installedPath = installLinuxDesktopEntry({
    platform: "linux",
    dataHome,
    electronPath: "/usr/bin/electron",
    kioskDirectory: "/srv/jit/kiosk",
    iconPath: "/srv/jit/kiosk/electron/icon.png",
  });

  assert.equal(installedPath, path.join(dataHome, "applications", "com.jitstudyhub.kiosk.desktop"));
  assert.match(
    fs.readFileSync(installedPath, "utf8"),
    /^Icon=\/srv\/jit\/kiosk\/electron\/icon\.png$/m,
  );
});
