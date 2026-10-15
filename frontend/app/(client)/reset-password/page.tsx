import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

import { ResetPasswordForm } from "./ResetPasswordForm";

function recoveryErrorUrl() {
  const params = new URLSearchParams({
    error: "Your password reset session is invalid or expired. Request a new link.",
  });
  return `/forgot-password?${params.toString()}`;
}

export default async function ResetPasswordPage() {
  if (!isSupabaseConfigured) redirect(recoveryErrorUrl());

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(recoveryErrorUrl());

  return <ResetPasswordForm />;
}
