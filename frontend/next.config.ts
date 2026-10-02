import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow phones on the facility LAN to load the development client and HMR
  // assets. This is only used by `next dev`; production is unaffected.
  allowedDevOrigins: ["192.168.1.12"],
};

export default nextConfig;
