import { NextResponse } from "next/server";

import { getPreferredLanIpv4Address } from "@/lib/network/lan-address";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const browserUrl = new URL(`${requestUrl.protocol}//${request.headers.get("host") ?? requestUrl.host}`);
  if (!LOOPBACK_HOSTS.has(browserUrl.hostname)) {
    return NextResponse.json(
      { error: "LAN address discovery is only available from this machine." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const address = getPreferredLanIpv4Address();
  if (!address) {
    return NextResponse.json(
      { error: "No private LAN address was found." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const port = browserUrl.port ? `:${browserUrl.port}` : "";
  return NextResponse.json(
    { origin: `${browserUrl.protocol}//${address}${port}` },
    { headers: { "Cache-Control": "no-store" } },
  );
}
