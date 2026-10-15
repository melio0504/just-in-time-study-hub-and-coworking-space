import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email, is_active, must_change_password")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    profile.role !== "admin" ||
    profile.email?.toLowerCase() !== "admin@jit-studyhub.com" ||
    !profile.is_active ||
    profile.must_change_password
  ) {
    redirect("/dashboard");
  }

  return children;
}
