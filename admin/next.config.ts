import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

function getSupabaseConnectSources() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!configuredUrl) return [];

  try {
    const url = new URL(configuredUrl);
    const websocketProtocol = url.protocol === "https:" ? "wss:" : "ws:";
    return [url.origin, `${websocketProtocol}//${url.host}`];
  } catch {
    return [];
  }
}

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${getSupabaseConnectSources().join(" ")}`.trim(),
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "no-referrer",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
] as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/admin/dashboard",
        has: [{ type: "query", key: "section", value: "reservations" }],
        destination: "/reservations",
        permanent: true,
      },
      {
        source: "/admin/dashboard",
        has: [{ type: "query", key: "section", value: "content" }],
        destination: "/announcements",
        permanent: true,
      },
      {
        source: "/admin/dashboard",
        has: [{ type: "query", key: "section", value: "logs" }],
        destination: "/logs",
        permanent: true,
      },
      { source: "/admin", destination: "/", permanent: true },
      { source: "/admin/dashboard", destination: "/dashboard", permanent: true },
      { source: "/admin/walk-ins", destination: "/walk-ins", permanent: true },
      { source: "/admin/analytics", destination: "/analytics", permanent: true },
      { source: "/admin/staff", destination: "/staffs", permanent: true },
      { source: "/admin/change-password", destination: "/change-password", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders],
      },
    ];
  },
};

export default nextConfig;
