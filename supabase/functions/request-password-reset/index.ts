import { withSupabase } from "@supabase/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MINIMUM_RESPONSE_TIME_MS = 500;

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function waitForNeutralTiming(startedAt: number) {
  const remaining = MINIMUM_RESPONSE_TIME_MS - (Date.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
}

export default {
  fetch: withSupabase({ auth: "none" }, async (request, context) => {
    const startedAt = Date.now();

    if (request.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    let body: { email?: unknown; redirectTo?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: "Enter a valid email address." }, 400);
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : "";
    if (email.length > 320 || !EMAIL_PATTERN.test(email)) {
      return json({ error: "Enter a valid email address." }, 400);
    }

    try {
      const redirectUrl = new URL(redirectTo);
      const isLocalDevelopment =
        redirectUrl.protocol === "http:" &&
        (redirectUrl.hostname === "localhost" || redirectUrl.hostname === "127.0.0.1");
      if (redirectUrl.protocol !== "https:" && !isLocalDevelopment) {
        return json({ error: "Password recovery is not configured correctly." }, 400);
      }
    } catch {
      return json({ error: "Password recovery is not configured correctly." }, 400);
    }

    const { data: profile, error: profileError } = await context.supabaseAdmin
      .from("profiles")
      .select("auth_providers")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("Password recovery provider lookup failed", profileError.code);
      await waitForNeutralTiming(startedAt);
      return json({ error: "Password recovery is temporarily unavailable. Please try again." }, 500);
    }

    const providers = Array.isArray(profile?.auth_providers) ? profile.auth_providers : [];
    const isGoogleOnly = providers.includes("google") && !providers.includes("email");
    if (!isGoogleOnly && providers.includes("email")) {
      const { error: recoveryError } = await context.supabaseAdmin.auth.resetPasswordForEmail(
        email,
        { redirectTo },
      );
      if (recoveryError) {
        console.error(
          "Password recovery email request failed",
          recoveryError.status,
          recoveryError.code,
        );
      }
    }

    await waitForNeutralTiming(startedAt);
    return json({ accepted: true, signInMethod: isGoogleOnly ? "google" : "email" });
  }),
};
