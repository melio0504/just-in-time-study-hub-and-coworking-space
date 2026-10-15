import type { Enums } from "@/lib/supabase/database.types";

export type StaffPermission = Enums<"staff_permission">;

export type AdminAccess = {
  role: "admin" | "staff";
  permissions: StaffPermission[];
};

export const STAFF_PERMISSION_OPTIONS: Array<{
  value: StaffPermission;
  label: string;
  description: string;
}> = [
  {
    value: "seating",
    label: "Seating status",
    description: "View the live floor plan and manage walk-in occupancy.",
  },
  {
    value: "reservations",
    label: "Reservations",
    description: "View reservation details and cancel bookings.",
  },
  {
    value: "announcements",
    label: "Announcements",
    description: "Create, edit, publish, and archive announcements.",
  },
];

export function hasAdminAccess(access: AdminAccess, permission: StaffPermission) {
  return access.role === "admin" || access.permissions.includes(permission);
}

export function defaultAdminPath(access: AdminAccess) {
  if (hasAdminAccess(access, "seating")) return "/dashboard";
  if (hasAdminAccess(access, "reservations")) return "/reservations";
  return "/announcements";
}
