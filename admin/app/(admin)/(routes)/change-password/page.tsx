"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Loader2, LockKeyhole } from "lucide-react";

import { defaultAdminPath, type AdminAccess, type StaffPermission } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/client";

export default function ChangeInitialPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, must_change_password")
        .eq("id", data.user.id)
        .single();

      if (!profile || profile.role !== "staff" || !profile.must_change_password) {
        router.replace("/dashboard");
        return;
      }

      setEmail(data.user.email ?? "");
      setLoading(false);
    });
  }, [router]);

  const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError("Use at least 8 characters with a letter and a number.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Your new password must be different from the temporary password.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
      current_password: currentPassword,
    });

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase
        .from("profiles")
        .select("role, staff_permissions, must_change_password")
        .eq("id", user.id)
        .single()
      : { data: null };

    if (!profile || profile.role !== "staff" || profile.must_change_password) {
      setError("The password changed, but account access could not be finalized. Please sign in again.");
      setSaving(false);
      return;
    }

    await supabase.rpc("log_admin_access", { p_action: "Completed first-login password change" });
    const access: AdminAccess = {
      role: "staff",
      permissions: profile.staff_permissions as StaffPermission[],
    };
    router.replace(defaultAdminPath(access));
    router.refresh();
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f8f5f0] text-[#5f5248]"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Verifying account…</div>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-linear-to-b from-[#fffcf7] to-[#fff8ed] p-5">
      <section className="w-full max-w-lg rounded-3xl border border-[#eee5da] bg-white p-7 shadow-xl sm:p-9">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fef3dc] text-[#a27621]"><KeyRound className="h-7 w-7" /></div>
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#b47b0d]">First sign-in security</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#2d2520]">Create your private password</h1>
        <p className="mt-3 leading-6 text-[#5f5248]">The temporary password for <strong>{email}</strong> must be replaced before any employee dashboard data is available.</p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <PasswordField label="Temporary password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
          <PasswordField label="New password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
          <PasswordField label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
          <p className="text-sm text-[#6b5e52]">Use at least 8 characters containing a letter and a number.</p>
          <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2d2520] px-5 py-3.5 font-semibold text-white hover:bg-[#463a31] disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
            {saving ? "Changing password…" : "Change password and continue"}
          </button>
        </form>
      </section>
    </main>
  );
}

function PasswordField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string }) {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-[#3f3630]">{label}</label>
      <div className="relative">
        <input id={id} type={visible ? "text" : "password"} required value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className="input pr-12" />
        <button type="button" onClick={() => setVisible((current) => !current)} aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#6b5e52] transition hover:text-[#2d2520] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b47b0d]">
          {visible ? <EyeOff className="h-4.5 w-4.5" aria-hidden="true" /> : <Eye className="h-4.5 w-4.5" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
