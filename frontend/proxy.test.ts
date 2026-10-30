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

  it("continues normal session handling for ordinary landing-page visits", async () => {
    const expectedResponse = new Response(null, { status: 204 });
    updateSessionMock.mockResolvedValue(expectedResponse as never);
    const request = new NextRequest("https://www.jit-studyhub.com/");

    const response = await proxy(request);

    expect(response).toBe(expectedResponse);
    expect(updateSessionMock).toHaveBeenCalledWith(request);
  });
});
