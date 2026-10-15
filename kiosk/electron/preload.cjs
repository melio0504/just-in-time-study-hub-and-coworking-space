const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kioskDesktop", {
  isElectron: true,
  scanBookingPass: (code) => ipcRenderer.invoke("kiosk-api:scan-booking-pass", code),
  getActiveSessions: () => ipcRenderer.invoke("kiosk-api:get-active-sessions"),
});
