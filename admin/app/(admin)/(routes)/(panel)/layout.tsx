import { redirect } from "next/navigation";
import type { AdminAccess, StaffPermission } from "@/lib/admin-access";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "../_components/AdminShell";

export default async function AdminPanelLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!isSupabaseConfigured) {
    redirect("/");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email, is_active, must_change_password, staff_permissions")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active || !["admin", "staff"].includes(profile.role)) {
    redirect("/");
  }

  if (profile.must_change_password) {
    redirect("/change-password");
  }

  const access: AdminAccess = {
    role: profile.role as AdminAccess["role"],
    permissions: profile.staff_permissions as StaffPermission[],
  };

  return (
    <AdminShell
      access={access}
      profile={{
        name: profile.full_name || "Staff member",
        email: profile.email || user.email || "",
      }}>
      {children}
    </AdminShell>
  );
}
