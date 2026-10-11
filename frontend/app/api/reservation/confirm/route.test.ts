import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getSupabaseConfig } from "@/lib/supabase/config";

import { POST } from "./route";

vi.mock("@/lib/supabase/config", () => ({
  getSupabaseConfig: vi.fn(),
}));

const getSupabaseConfigMock = vi.mocked(getSupabaseConfig);
const validToken = "A".repeat(40);

function request(body: BodyInit) {
  return new Request("http://localhost:3000/api/reservation/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

beforeEach(() => {
  getSupabaseConfigMock.mockReturnValue({
    supabaseUrl: "https://public.supabase.test",
    supabasePublishableKey: "publishable-test-key",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/reservation/confirm", () => {
  it("rejects malformed JSON before reading configuration", async () => {
    const response = await POST(request("{"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request body." });
    expect(getSupabaseConfigMock).not.toHaveBeenCalled();
  });

  it.each([
    [{ token: "short", action: "preview" }],
    [{ token: validToken, action: "delete" }],
    [{ token: 42, action: "confirm" }],
  ])("rejects an invalid payment request (%j)", async (body) => {
    const response = await POST(request(JSON.stringify(body)));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid payment request." });
    expect(getSupabaseConfigMock).not.toHaveBeenCalled();
  });

  it("forwards a validated request to the internal Edge Function", async () => {
    vi.stubEnv("SUPABASE_INTERNAL_URL", "http://supabase-internal:54321");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ reservationCode: "JIT-TEST" }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request(JSON.stringify({ token: `  ${validToken}  `, action: "confirm" })),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ reservationCode: "JIT-TEST" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://supabase-internal:54321/functions/v1/confirm-booking",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        body: JSON.stringify({ token: validToken, action: "confirm" }),
        headers: {
          apikey: "publishable-test-key",
          Authorization: "Bearer publishable-test-key",
          "Content-Type": "application/json",
        },
      }),
    );
  });

  it("preserves an upstream error status and handles a non-JSON response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad gateway", { status: 502 })));

    const response = await POST(
      request(JSON.stringify({ token: validToken, action: "preview" })),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "The payment service returned an invalid response.",
    });
  });

  it("returns a service-unavailable response when the Edge Function cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(
      request(JSON.stringify({ token: validToken, action: "confirm" })),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "The local payment service is unavailable. Ask staff to check the Supabase Functions service.",
    });
  });
});
