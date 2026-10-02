"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Eye, EyeOff, Loader2, UserPlus, Users } from "lucide-react";
import { FunctionsHttpError } from "@supabase/supabase-js";

import { STAFF_PERMISSION_OPTIONS, type StaffPermission } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/client";

type StaffAccount = {
  id: string;
  full_name: string;
  email: string | null;
  staff_permissions: StaffPermission[];
  must_change_password: boolean;
  is_active: boolean;
  created_at: string;
};

const allPermissions = STAFF_PERMISSION_OPTIONS.map((option) => option.value);

function emailFromName(name: string) {
  const localPart = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return localPart ? `${localPart}@jit-studyhub.com` : "name@jit-studyhub.com";
}

export default function StaffAccountsPage() {
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [permissions, setPermissions] = useState<StaffPermission[]>(allPermissions);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const email = useMemo(() => emailFromName(name), [name]);

  const loadStaff = useCallback(async () => {
    const { data, error: queryError } = await createClient()
      .from("profiles")
      .select("id, full_name, email, staff_permissions, must_change_password, is_active, created_at")
      .eq("role", "staff")
      .order("created_at", { ascending: false });

    if (queryError) setError(queryError.message);
    setStaff((data ?? []) as StaffAccount[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadStaff());
  }, [loadStaff]);

  const togglePermission = (permission: StaffPermission) => {
    setPermissions((current) => current.includes(permission)
      ? current.filter((value) => value !== permission)
      : [...current, permission]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (password !== confirmPassword) {
      setError("The temporary passwords do not match.");
      return;
    }
    if (permissions.length === 0) {
      setError("Select at least one employee permission.");
      return;
    }

    setSaving(true);
    const { data, error: invokeError } = await createClient().functions.invoke("create-staff-account", {
      body: { name, password, permissions },
    });

    if (invokeError) {
      let detail = invokeError.message;
      if (invokeError instanceof FunctionsHttpError) {
        const payload = await invokeError.context.json().catch(() => null) as { error?: string } | null;
        detail = payload?.error ?? detail;
      }
      setError(detail);
      setSaving(false);
      return;
    }

    const createdEmail = (data as { account?: { email?: string } } | null)?.account?.email ?? email;
    setMessage(`${createdEmail} was created. The employee must replace the temporary password at first sign-in.`);
    setName("");
    setPassword("");
    setConfirmPassword("");
    setPermissions(allPermissions);
    await loadStaff();
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-7">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-[#b47b0d]">Owner controls</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[#2d2520] sm:text-4xl">Employee accounts</h1>
        <p className="mt-2 max-w-3xl text-[#5f5248]">Create employee access without sharing the owner password. Analytics, access logs, and account creation always remain owner-only.</p>
      </div>

      {message && <p className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(340px,0.85fr)_1.4fr]">
        <form onSubmit={handleSubmit} className="h-fit rounded-3xl border border-[#e8dfd4] bg-white p-6 shadow-sm xl:sticky xl:top-8">
          <div className="mb-6 flex items-center gap-3"><span className="rounded-xl bg-[#fef3dc] p-2.5 text-[#b47b0d]"><UserPlus className="h-5 w-5" /></span><div><h2 className="text-xl font-semibold text-[#2d2520]">New employee</h2><p className="text-sm text-[#5f5248]">Owner authorization required</p></div></div>
          <div className="space-y-5">
            <Field label="Employee name"><input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Maria Santos" className="input" /></Field>
            <div className="rounded-xl border border-[#eadfce] bg-[#fffbf5] px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wider text-[#8a671a]">Generated email</p><p className="mt-1 break-all font-medium text-[#2d2520]">{email}</p></div>
            <Field label="Temporary password">
              <PasswordInput value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} label="temporary password" />
              <span className="mt-2 block text-xs text-[#6b5e52]">At least 8 characters with a letter and number.</span>
            </Field>
            <Field label="Confirm temporary password">
              <PasswordInput value={confirmPassword} onChange={setConfirmPassword} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((current) => !current)} label="confirmation password" />
            </Field>

            <div>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#5f5248]">Permissions</span>
              <details className="group rounded-xl border border-[#cfc3b6] bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-[#2d2520]">
                  <span>{permissions.length} {permissions.length === 1 ? "scope" : "scopes"} selected</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="space-y-2 border-t border-[#eee5da] p-3">
                  {STAFF_PERMISSION_OPTIONS.map((option) => {
                    const checked = permissions.includes(option.value);
                    return <label key={option.value} className="flex cursor-pointer gap-3 rounded-xl p-3 hover:bg-[#fffbf5]"><input type="checkbox" checked={checked} onChange={() => togglePermission(option.value)} className="sr-only" /><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? "border-[#e5a930] bg-[#e5a930] text-white" : "border-[#b9aa9b]"}`}>{checked && <Check className="h-3.5 w-3.5" />}</span><span><span className="block text-sm font-semibold text-[#2d2520]">{option.label}</span><span className="mt-0.5 block text-xs leading-5 text-[#6b5e52]">{option.description}</span></span></label>;
                  })}
                </div>
              </details>
            </div>

            <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2d2520] px-4 py-3.5 font-semibold text-white hover:bg-[#463a31] disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{saving ? "Creating account…" : "Create employee account"}</button>
          </div>
        </form>

        <section className="overflow-hidden rounded-3xl border border-[#e8dfd4] bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-[#eee5da] p-5"><span className="rounded-xl bg-[#f7f1e8] p-2.5 text-[#8a671a]"><Users className="h-5 w-5" /></span><div><h2 className="text-xl font-semibold text-[#2d2520]">Employee access</h2><p className="text-sm text-[#5f5248]">{staff.length} {staff.length === 1 ? "account" : "accounts"}</p></div></div>
          {loading ? <div className="flex min-h-64 items-center justify-center text-[#5f5248]"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading employees…</div> : staff.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center text-[#5f5248]"><Users className="mb-3 h-9 w-9" /><p>No employee accounts have been created.</p></div> : <div className="divide-y divide-[#eee5da]">{staff.map((account) => <article key={account.id} className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h3 className="font-semibold text-[#2d2520]">{account.full_name}</h3><p className="mt-1 text-sm text-[#5f5248]">{account.email}</p></div><span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${!account.is_active ? "bg-red-50 text-red-700" : account.must_change_password ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{!account.is_active ? "Inactive" : account.must_change_password ? "Password change required" : "Active"}</span></div><div className="mt-4 flex flex-wrap gap-2">{account.staff_permissions.map((permission) => <span key={permission} className="rounded-full border border-[#eadfce] bg-[#fffbf5] px-3 py-1 text-xs font-medium text-[#6b5e52]">{STAFF_PERMISSION_OPTIONS.find((option) => option.value === permission)?.label ?? permission}</span>)}</div></article>)}</div>}
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#5f5248]">{label}</span>{children}</label>;
}

function PasswordInput({ value, onChange, visible, onToggle, label }: { value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void; label: string }) {
  return (
    <span className="relative block">
      <input required type={visible ? "text" : "password"} minLength={8} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" className="input pr-12" />
      <button type="button" onClick={onToggle} aria-label={`${visible ? "Hide" : "Show"} ${label}`} aria-pressed={visible} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#6b5e52] transition hover:text-[#2d2520] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b47b0d]">
        {visible ? <EyeOff className="h-4.5 w-4.5" aria-hidden="true" /> : <Eye className="h-4.5 w-4.5" aria-hidden="true" />}
      </button>
    </span>
  );
}
