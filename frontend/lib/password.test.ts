import { describe, expect, it } from "vitest";

import { validateNewPassword } from "./password";

describe("validateNewPassword", () => {
  it("requires at least eight characters", () => {
    expect(validateNewPassword("Test12", "Test12")).toBe("Password must be at least 8 characters.");
  });

  it("requires both a letter and a number", () => {
    expect(validateNewPassword("password", "password")).toBe(
      "Password must include at least one letter and one number.",
    );
  });

  it("requires matching confirmation", () => {
    expect(validateNewPassword("Password1", "Password2")).toBe("Passwords do not match.");
  });

  it("accepts a password that satisfies the configured policy", () => {
    expect(validateNewPassword("StudyHub2026", "StudyHub2026")).toBeNull();
  });
});
