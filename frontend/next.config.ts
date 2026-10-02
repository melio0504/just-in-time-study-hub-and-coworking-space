import type { NextConfig } from "next";

import { getPrivateLanIpv4Addresses } from "./lib/network/lan-address";

const nextConfig: NextConfig = {
  // Allow phones on the facility LAN to load the development client and HMR
  // assets. This is only used by `next dev`; production is unaffected.
  allowedDevOrigins: getPrivateLanIpv4Addresses(),
};

export default nextConfig;
