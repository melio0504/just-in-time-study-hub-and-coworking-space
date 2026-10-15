const path = require("node:path");

const { app, BrowserWindow, ipcMain, Menu } = require("electron");

const { createStaticServer, listenOnLoopback } = require("./static-server.cjs");
const { getKioskConfig, requestKioskApi } = require("./kiosk-api.cjs");
const embeddedKioskEnvironment = require("./build-config.cjs");

const kioskConfig = getKioskConfig(embeddedKioskEnvironment);

let kioskWindow = null;
let staticServer = null;
let rendererOrigin = "";

function senderIsTrusted(event) {
  try {
    return new URL(event.senderFrame.url).origin === rendererOrigin;
  } catch {
    return false;
  }
}

function configurePermissions(electronSession) {
  electronSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    return permission === "media" &&
      webContents === kioskWindow?.webContents &&
      requestingOrigin === rendererOrigin &&
      details.mediaType !== "audio";
  });

  electronSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    let isTrusted = false;
    try {
      isTrusted = new URL(details.requestingUrl).origin === rendererOrigin;
    } catch {
      isTrusted = false;
    }

    const mediaTypes = Array.isArray(details.mediaTypes) ? details.mediaTypes : [];
    const requestsAudio = mediaTypes.includes("audio");
    const requestsVideo = mediaTypes.length === 0 || mediaTypes.includes("video");
    callback(
      permission === "media" &&
      webContents === kioskWindow?.webContents &&
      isTrusted &&
      requestsVideo &&
      !requestsAudio,
    );
  });
}

async function createWindow() {
  const exportDirectory = app.isPackaged
    ? path.join(process.resourcesPath, "out")
    : path.join(__dirname, "..", "out");
  staticServer = createStaticServer(exportDirectory);
  rendererOrigin = await listenOnLoopback(staticServer);

  kioskWindow = new BrowserWindow({
    title: "Just In Time Kiosk",
    width: 1366,
    height: 768,
    minWidth: 960,
    minHeight: 640,
    show: false,
    fullScreen: false,
    fullscreenable: true,
    minimizable: true,
    maximizable: true,
    resizable: true,
    autoHideMenuBar: true,
    backgroundColor: "#fffcf7",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
      partition: "persist:jit-studyhub-kiosk",
    },
  });

  configurePermissions(kioskWindow.webContents.session);

  kioskWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  kioskWindow.webContents.on("will-navigate", (event, destination) => {
    try {
      if (new URL(destination).origin !== rendererOrigin) event.preventDefault();
    } catch {
      event.preventDefault();
    }
  });
  kioskWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());
  kioskWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") {
      event.preventDefault();
      kioskWindow?.setFullScreen(!kioskWindow.isFullScreen());
    } else if (input.key === "Escape" && kioskWindow?.isFullScreen()) {
      event.preventDefault();
      kioskWindow.setFullScreen(false);
    }
  });

  kioskWindow.once("ready-to-show", () => {
    kioskWindow?.maximize();
    kioskWindow?.show();
  });
  kioskWindow.on("closed", () => {
    kioskWindow = null;
  });

  await kioskWindow.loadURL(rendererOrigin);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!kioskWindow) return;
    if (kioskWindow.isMinimized()) kioskWindow.restore();
    kioskWindow.focus();
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);

    ipcMain.handle("kiosk-api:scan-booking-pass", async (event, code) => {
      if (!senderIsTrusted(event)) throw new Error("Untrusted kiosk request.");
      if (typeof code !== "string" || code.length > 512) throw new Error("Invalid QR pass.");
      return requestKioskApi(kioskConfig, { method: "POST", body: { code } });
    });
    ipcMain.handle("kiosk-api:get-active-sessions", async (event) => {
      if (!senderIsTrusted(event)) throw new Error("Untrusted kiosk request.");
      return requestKioskApi(kioskConfig);
    });

    try {
      await createWindow();
    } catch (error) {
      console.error("Unable to start the kiosk window:", error);
      app.quit();
    }
  });
}

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  staticServer?.close();
  staticServer = null;
});
