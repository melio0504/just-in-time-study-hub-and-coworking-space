import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateSession } from "@/lib/supabase/proxy";

import { proxy } from "./proxy";

vi.mock("@/lib/supabase/proxy", () => ({
  updateSession: vi.fn(),
}));

const updateSessionMock = vi.mocked(updateSession);

beforeEach(() => {
  updateSessionMock.mockReset();
});

describe("frontend proxy", () => {
  it("recovers an OAuth code sent to the landing page", async () => {
    const response = await proxy(new NextRequest("https://www.jit-studyhub.com/?code=google-code"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://www.jit-studyhub.com/auth/callback?code=google-code",
    );
    expect(updateSessionMock).not.toHaveBeenCalled();
  });

  it("recovers an email confirmation sent to the landing page", async () => {
    const response = await proxy(
      new NextRequest(
        "https://www.jit-studyhub.com/?token_hash=pkce_35375fd3749341d4a95df76a631236a5b824e15f9e7755f25a47080c&type=email",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://www.jit-studyhub.com/auth/callback?token_hash=pkce_35375fd3749341d4a95df76a631236a5b824e15f9e7755f25a47080c&type=email",
    );
    expect(updateSessionMock).not.toHaveBeenCalled();
  });

  it("recovers a password reset token sent to the landing page", async () => {
    const response = await proxy(
      new NextRequest("https://www.jit-studyhub.com/?token_hash=recovery-token&type=recovery"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://www.jit-studyhub.com/auth/callback?token_hash=recovery-token&type=recovery",
    );
    expect(updateSessionMock).not.toHaveBeenCalled();
  });

  it("continues normal session handling for ordinary landing-page visits", async () => {
    const expectedResponse = new Response(null, { status: 204 });
    updateSessionMock.mockResolvedValue(expectedResponse as never);
    const request = new NextRequest("https://www.jit-studyhub.com/");

    const response = await proxy(request);

    expect(response).toBe(expectedResponse);
    expect(updateSessionMock).toHaveBeenCalledWith(request);
  });
});
