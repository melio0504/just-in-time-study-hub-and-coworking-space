import type { CapacitorConfig } from "@capacitor/cli";

const emulatorDevelopmentUrl = "http://10.0.2.2:3000";
const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim() || emulatorDevelopmentUrl;

const config: CapacitorConfig = {
  appId: "com.jitstudyhub.app",
  appName: "Just In Time Study Hub",
  webDir: "capacitor-shell",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    errorPath: "index.html",
  },
};

export default config;
