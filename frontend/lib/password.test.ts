import { describe, expect, it } from "vitest";

import { PASSWORD_REQUIREMENTS_MESSAGE, validateNewPassword } from "./password";

describe("validateNewPassword", () => {
  it("requires at least eight characters", () => {
    expect(validateNewPassword("Test12", "Test12")).toBe("Password must be at least 8 characters.");
  });

  it.each([
    ["an uppercase letter", "password1!"],
    ["a lowercase letter", "PASSWORD1!"],
    ["a number", "Password!"],
    ["a symbol", "Password1"],
  ])("requires %s", (_requirement, password) => {
    expect(validateNewPassword(password, password)).toBe(PASSWORD_REQUIREMENTS_MESSAGE);
  });

  it("requires matching confirmation", () => {
    expect(validateNewPassword("Password1!", "Password2!")).toBe("Passwords do not match.");
  });

  it("accepts a password that satisfies the configured policy", () => {
    expect(validateNewPassword("StudyHub2026!", "StudyHub2026!")).toBeNull();
  });
});
