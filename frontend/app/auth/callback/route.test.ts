import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";

import { GET } from "./route";

vi.mock("@/lib/supabase/config", () => ({
  isSupabaseConfigured: true,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const createClientMock = vi.mocked(createClient, { deep: true, partial: true });

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  createClientMock.mockReset();
});

describe("GET /auth/callback", () => {
  it("replaces an inherited OAuth error fragment on failure", async () => {
    const request = new NextRequest(
      "http://localhost:3000/auth/callback?error=server_error&error_code=unexpected_failure",
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/register?error=Google+sign-up+could+not+be+completed.+Please+try+again.#_",
    );
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("redirects a successful code exchange to the safe next path", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue({
      auth: { exchangeCodeForSession },
    });

    const request = new NextRequest(
      "http://localhost:3000/auth/callback?code=valid-code&next=/account",
    );

    const response = await GET(request);

    expect(exchangeCodeForSession).toHaveBeenCalledWith("valid-code");
    expect(response.headers.get("location")).toBe("http://localhost:3000/account");
  });
});
