import { type NextRequest, NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

function redirectOrigin(request: NextRequest) {
  if (process.env.NODE_ENV === "development") return request.nextUrl.origin;

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  return forwardedHost ? `${forwardedProto}://${forwardedHost}` : request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const origin = redirectOrigin(request);
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = safeNextPath(request.nextUrl.searchParams.get("next"));
  const isPasswordRecovery =
    request.nextUrl.searchParams.get("flow") === "recovery" ||
    requestedNext === "/reset-password";
  const next = isPasswordRecovery ? "/reset-password" : requestedNext;

  if (isSupabaseConfigured && code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const failureUrl = new URL(isPasswordRecovery ? "/forgot-password" : "/register", origin);
  failureUrl.searchParams.set(
    "error",
    isPasswordRecovery
      ? "The password reset link is invalid or expired. Request a new one."
      : "Google sign-up could not be completed. Please try again.",
  );
  // A redirect without its own fragment inherits the fragment from the
  // incoming OAuth URL. Override it so provider error details and state do not
  // leak into the registration page URL.
  failureUrl.hash = "_";
  return NextResponse.redirect(failureUrl);
}
