import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // Supabase falls back to the configured Site URL when a redirect URL does
  // not match its allowlist exactly. Recover auth responses that arrive at the
  // landing page by sending them through the route that establishes a session.
  const isRootAuthCallback =
    request.nextUrl.pathname === "/" &&
    (request.nextUrl.searchParams.has("code") ||
      (request.nextUrl.searchParams.has("token_hash") && request.nextUrl.searchParams.has("type")));

  if (isRootAuthCallback) {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";

    return NextResponse.redirect(callbackUrl);
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
