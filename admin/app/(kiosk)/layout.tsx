import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { hasAdminAccess, type AdminAccess, type StaffPermission } from "@/lib/admin-access";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Kiosk | Just In Time Study Hub",
  description:
    "QR check-in and check-out kiosk for Just In Time Study Hub and Coworking Space.",
};

export default async function KioskLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) {
    redirect("/admin?next=%2Fkiosk");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin?next=%2Fkiosk");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, must_change_password, staff_permissions")
    .eq("id", user.id)
    .single();

  if (profile?.must_change_password) {
    redirect("/admin/change-password?next=%2Fkiosk");
  }

  if (!profile || !profile.is_active || !["admin", "staff"].includes(profile.role)) {
    redirect("/admin?next=%2Fkiosk");
  }

  const access: AdminAccess = {
    role: profile.role as AdminAccess["role"],
    permissions: profile.staff_permissions as StaffPermission[],
  };

  if (!hasAdminAccess(access, "seating")) {
    redirect("/admin?next=%2Fkiosk&reason=seating");
  }

  return <div className="h-dvh overflow-hidden">{children}</div>;
}
