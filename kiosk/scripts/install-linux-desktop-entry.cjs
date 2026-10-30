const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DESKTOP_FILE_NAME = "com.jitstudyhub.kiosk.desktop";

function quoteDesktopExecArgument(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function createDesktopEntry({ electronPath, kioskDirectory, iconPath }) {
  return [
    "[Desktop Entry]",
    "Name=Just In Time Kiosk",
    "Comment=Desktop QR check-in kiosk for Just In Time Study Hub",
    `Exec=${quoteDesktopExecArgument(electronPath)} ${quoteDesktopExecArgument(kioskDirectory)}`,
    `Icon=${iconPath}`,
    "Terminal=false",
    "Type=Application",
    "Categories=Utility;",
    "StartupWMClass=com.jitstudyhub.kiosk",
    "",
  ].join("\n");
}

function installLinuxDesktopEntry({
  platform = process.platform,
  dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"),
  electronPath = require("electron"),
  kioskDirectory = path.resolve(__dirname, ".."),
  iconPath = path.resolve(__dirname, "..", "electron", "icon.png"),
} = {}) {
  if (platform !== "linux") return null;

  const applicationsDirectory = path.join(dataHome, "applications");
  const desktopEntryPath = path.join(applicationsDirectory, DESKTOP_FILE_NAME);
  const desktopEntry = createDesktopEntry({ electronPath, kioskDirectory, iconPath });

  fs.mkdirSync(applicationsDirectory, { recursive: true });
  if (
    !fs.existsSync(desktopEntryPath) ||
    fs.readFileSync(desktopEntryPath, "utf8") !== desktopEntry
  ) {
    fs.writeFileSync(desktopEntryPath, desktopEntry, { encoding: "utf8", mode: 0o644 });
  }

  return desktopEntryPath;
}

if (require.main === module) {
  const installedPath = installLinuxDesktopEntry();
  if (installedPath) console.log(`Linux desktop entry ready: ${installedPath}`);
}

module.exports = { createDesktopEntry, installLinuxDesktopEntry };
