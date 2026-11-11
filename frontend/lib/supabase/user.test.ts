import { describe, expect, it } from "vitest";

import { canUserChangePassword } from "./user";

describe("canUserChangePassword", () => {
  it("allows accounts created with email authentication", () => {
    expect(
      canUserChangePassword({
        app_metadata: { provider: "email", providers: ["email", "google"] },
      }),
    ).toBe(true);
  });

  it("does not allow accounts created with Google authentication", () => {
    expect(
      canUserChangePassword({
        app_metadata: { provider: "google", providers: ["google", "email"] },
      }),
    ).toBe(false);
  });

  it("fails closed when the original provider is unavailable", () => {
    expect(canUserChangePassword({ app_metadata: {} })).toBe(false);
  });
});
