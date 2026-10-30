import { describe, expect, it } from "vitest";

import { isExistingAccountSignUp } from "./sign-up";

describe("isExistingAccountSignUp", () => {
  it("recognizes the existing-user auth error code", () => {
    expect(
      isExistingAccountSignUp(
        { user: null },
        { code: "user_already_exists", message: "A user with this email already exists" },
      ),
    ).toBe(true);
  });

  it("recognizes the legacy already-registered error message", () => {
    expect(isExistingAccountSignUp({ user: null }, { message: "User already registered" })).toBe(
      true,
    );
  });

  it("recognizes Supabase's obfuscated duplicate user response", () => {
    expect(isExistingAccountSignUp({ user: { identities: [] } }, null)).toBe(true);
  });

  it("does not treat a new user identity as an existing account", () => {
    expect(isExistingAccountSignUp({ user: { identities: [{ provider: "email" }] } }, null)).toBe(
      false,
    );
  });
});
