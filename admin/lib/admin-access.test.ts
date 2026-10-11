import { describe, expect, it } from "vitest";

import { defaultAdminPath, hasAdminAccess, type AdminAccess } from "./admin-access";

describe("admin access", () => {
  it("grants every permission to the owner", () => {
    const owner: AdminAccess = { role: "admin", permissions: [] };

    expect(hasAdminAccess(owner, "seating")).toBe(true);
    expect(hasAdminAccess(owner, "reservations")).toBe(true);
    expect(hasAdminAccess(owner, "announcements")).toBe(true);
    expect(defaultAdminPath(owner)).toBe("/admin/dashboard");
  });

  it("only grants a staff member's explicit permissions", () => {
    const staff: AdminAccess = { role: "staff", permissions: ["reservations"] };

    expect(hasAdminAccess(staff, "seating")).toBe(false);
    expect(hasAdminAccess(staff, "reservations")).toBe(true);
    expect(hasAdminAccess(staff, "announcements")).toBe(false);
    expect(defaultAdminPath(staff)).toBe("/admin/dashboard?section=reservations");
  });

  it("routes announcement-only and empty staff access to content", () => {
    expect(defaultAdminPath({ role: "staff", permissions: ["announcements"] })).toBe(
      "/admin/dashboard?section=content",
    );
    expect(defaultAdminPath({ role: "staff", permissions: [] })).toBe(
      "/admin/dashboard?section=content",
    );
  });
});
