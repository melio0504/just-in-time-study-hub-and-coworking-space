function isAllowedSupabaseUrl(value) {
  try {
    const url = new URL(value);
    const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return url.protocol === "https:" || (url.protocol === "http:" && isLoopback);
  } catch {
    return false;
  }
}

function getKioskConfig(environment = process.env) {
  const supabaseUrl = environment.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const publishableKey = environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const accessToken = environment.KIOSK_ACCESS_TOKEN?.trim();

  if (!supabaseUrl || !isAllowedSupabaseUrl(supabaseUrl)) {
    throw new Error("The kiosk service URL is not configured correctly.");
  }
  if (!publishableKey || publishableKey.includes("your_publishable_key")) {
    throw new Error("The kiosk publishable key is not configured.");
  }
  if (!accessToken || accessToken.length < 32 || accessToken.includes("replace_with")) {
    throw new Error("The kiosk device credential is not configured.");
  }

  return { supabaseUrl, publishableKey, accessToken };
}

async function requestKioskApi(config, { method = "GET", body } = {}, fetchImplementation = fetch) {
  const response = await fetchImplementation(
    `${config.supabaseUrl}/functions/v1/scan-booking-pass`,
    {
      method,
      headers: {
        apikey: config.publishableKey,
        "x-kiosk-token": config.accessToken,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof payload?.error === "string" ? payload.error : "The kiosk service is unavailable.",
    );
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("The kiosk service returned an invalid response.");
  }

  return payload;
}

module.exports = { getKioskConfig, requestKioskApi };
