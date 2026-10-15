"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Loader2,
  Pencil,
  Save,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
} from "lucide-react";
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

type LoginEvent = {
  id: number;
  actor_id: string | null;
  action: string;
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function functionErrorMessage(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const payload = await error.context.json().catch(() => null) as { error?: string } | null;
    if (payload?.error) return payload.error;
  }
  return error instanceof Error ? error.message : "The request could not be completed.";
}

export default function StaffAccountsPage() {
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [loginEvents, setLoginEvents] = useState<LoginEvent[]>([]);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [permissions, setPermissions] = useState<StaffPermission[]>(allPermissions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<StaffPermission[]>([]);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirmation, setResetPasswordConfirmation] = useState("");
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [deactivationAccount, setDeactivationAccount] = useState<StaffAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const email = useMemo(() => emailFromName(name), [name]);

  const loadStaff = useCallback(async () => {
    const supabase = createClient();
    const { data, error: queryError } = await supabase
      .from("profiles")
      .select("id, full_name, email, staff_permissions, must_change_password, is_active, created_at")
      .eq("role", "staff")
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const accounts = (data ?? []) as StaffAccount[];
    setStaff(accounts);

    if (accounts.length > 0) {
      const { data: history, error: historyError } = await supabase
        .from("audit_logs")
        .select("id, actor_id, action, created_at")
        .eq("entity_type", "admin_session")
        .ilike("action", "Signed in%")
        .in("actor_id", accounts.map((account) => account.id))
        .order("created_at", { ascending: false })
        .limit(100);

      if (historyError) setError(historyError.message);
      setLoginEvents((history ?? []) as LoginEvent[]);
    } else {
      setLoginEvents([]);
    }

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
      setError(await functionErrorMessage(invokeError));
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

  const runAction = async (
    account: StaffAccount,
    action: string,
    body: Record<string, unknown>,
    successMessage: string,
  ) => {
    setError("");
    setMessage("");
    setBusyAction(`${account.id}:${action}`);

    const { error: invokeError } = await createClient().functions.invoke("manage-staff-account", {
      body: { action, staffId: account.id, ...body },
    });

    if (invokeError) {
      setError(await functionErrorMessage(invokeError));
    } else {
      setMessage(successMessage);
      setEditingId(null);
      setResettingId(null);
      setResetPassword("");
      setResetPasswordConfirmation("");
    }

    await loadStaff();
    setBusyAction(null);
  };

  const savePermissions = async (account: StaffAccount) => {
    if (draftPermissions.length === 0) {
      setError("Select at least one employee permission.");
      return;
    }
    await runAction(
      account,
      "update_permissions",
      { permissions: draftPermissions },
      `${account.full_name}'s permissions were updated.`,
    );
  };

  const resetStaffPassword = async (event: React.FormEvent, account: StaffAccount) => {
    event.preventDefault();
    setError("");
    if (resetPassword !== resetPasswordConfirmation) {
      setError("The temporary passwords do not match.");
      return;
    }
    if (resetPassword.length < 8 || resetPassword.length > 72 || !/[A-Za-z]/.test(resetPassword) || !/\d/.test(resetPassword)) {
      setError("Use 8 to 72 characters with at least one letter and number.");
      return;
    }
    await runAction(
      account,
      "reset_password",
      { password: resetPassword },
      `${account.full_name}'s temporary password was set and all sessions were revoked.`,
    );
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-7">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-[#b47b0d]">Owner controls</p>
        <h1 className="text-3xl font-semibold tracking-tight text-[#2d2520] sm:text-4xl">Employee accounts</h1>
        <p className="mt-2 max-w-3xl text-[#5f5248]">Create employee access, adjust permissions, secure accounts, and review sign-ins without sharing the owner password.</p>
      </div>

      {message && <p role="status" className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">{message}</p>}
      {error && <p role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(340px,0.78fr)_1.5fr]">
        <form onSubmit={handleSubmit} className="h-fit rounded-3xl border border-[#e8dfd4] bg-white p-6 shadow-sm xl:sticky xl:top-8">
          <div className="mb-6 flex items-center gap-3"><span className="rounded-xl bg-[#fef3dc] p-2.5 text-[#b47b0d]"><UserPlus className="h-5 w-5" /></span><div><h2 className="text-xl font-semibold text-[#2d2520]">New employee</h2><p className="text-sm text-[#5f5248]">Owner authorization required</p></div></div>
          <div className="space-y-5">
            <Field label="Employee name"><input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Maria Santos" className="input" /></Field>
            <div className="rounded-xl border border-[#eadfce] bg-[#fffbf5] px-4 py-3"><p className="text-xs font-semibold uppercase tracking-wider text-[#8a671a]">Generated email</p><p className="mt-1 break-all font-medium text-[#2d2520]">{email}</p></div>
            <Field label="Temporary password">
              <PasswordInput value={password} onChange={setPassword} visible={showPassword} onToggle={() => setShowPassword((current) => !current)} label="temporary password" />
              <span className="mt-2 block text-xs text-[#6b5e52]">8 to 72 characters with a letter and number.</span>
            </Field>
            <Field label="Confirm temporary password">
              <PasswordInput value={confirmPassword} onChange={setConfirmPassword} visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((current) => !current)} label="confirmation password" />
            </Field>

            <PermissionPicker permissions={permissions} onToggle={togglePermission} />

            <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2d2520] px-4 py-3.5 font-semibold text-white hover:bg-[#463a31] disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}{saving ? "Creating account…" : "Create employee account"}</button>
          </div>
        </form>

        <section className="overflow-hidden rounded-3xl border border-[#e8dfd4] bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-[#eee5da] p-5"><span className="rounded-xl bg-[#f7f1e8] p-2.5 text-[#8a671a]"><Users className="h-5 w-5" /></span><div><h2 className="text-xl font-semibold text-[#2d2520]">Employee access</h2><p className="text-sm text-[#5f5248]">{staff.length} {staff.length === 1 ? "account" : "accounts"}</p></div></div>
          {loading ? (
            <div className="flex min-h-64 items-center justify-center text-[#5f5248]"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading employees…</div>
          ) : staff.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center text-[#5f5248]"><Users className="mb-3 h-9 w-9" /><p>No employee accounts have been created.</p></div>
          ) : (
            <div className="divide-y divide-[#eee5da]">
              {staff.map((account) => {
                const accountLogins = loginEvents.filter((event) => event.actor_id === account.id);
                const busy = busyAction?.startsWith(`${account.id}:`) ?? false;
                return (
                  <article key={account.id} className="p-5 sm:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-[#2d2520]">{account.full_name}</h3>
                        <p className="mt-1 text-sm text-[#5f5248]">{account.email}</p>
                        <p className="mt-2 text-xs text-[#7a6b5f]">Last sign-in: {accountLogins[0] ? formatDate(accountLogins[0].created_at) : "No recorded sign-ins"}</p>
                      </div>
                      <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${!account.is_active ? "bg-red-50 text-red-700" : account.must_change_password ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{!account.is_active ? "Inactive" : account.must_change_password ? "Password change required" : "Active"}</span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">{account.staff_permissions.map((permission) => <span key={permission} className="rounded-full border border-[#eadfce] bg-[#fffbf5] px-3 py-1 text-xs font-medium text-[#6b5e52]">{STAFF_PERMISSION_OPTIONS.find((option) => option.value === permission)?.label ?? permission}</span>)}</div>

                    <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
                      <ActionButton icon={Pencil} label="Permissions" disabled={busy} onClick={() => { setEditingId(editingId === account.id ? null : account.id); setDraftPermissions(account.staff_permissions); setResettingId(null); }} />
                      <ActionButton icon={KeyRound} label="Reset password" disabled={busy} onClick={() => { setResettingId(resettingId === account.id ? null : account.id); setResetPassword(""); setResetPasswordConfirmation(""); setEditingId(null); }} />
                      <ActionButton icon={account.is_active ? UserX : UserCheck} label={account.is_active ? "Deactivate" : "Reactivate"} danger={account.is_active} disabled={busy} loading={busyAction === `${account.id}:set_active`} onClick={() => { if (account.is_active) { setEditingId(null); setResettingId(null); setDeactivationAccount(account); } else void runAction(account, "set_active", { isActive: true }, `${account.full_name} was reactivated.`); }} />
                      <ActionButton icon={History} label="Login history" disabled={busy} onClick={() => setHistoryId(historyId === account.id ? null : account.id)} />
                    </div>

                    {editingId === account.id && (
                      <div className="mt-4 rounded-2xl border border-[#e8dfd4] bg-[#fffcf8] p-4">
                        <p className="mb-3 text-sm font-semibold text-[#2d2520]">Edit permissions</p>
                        <div className="grid gap-2 md:grid-cols-3">
                          {STAFF_PERMISSION_OPTIONS.map((option) => {
                            const checked = draftPermissions.includes(option.value);
                            return <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#eadfce] bg-white p-3 text-sm text-[#3f3630]"><input className="h-4 w-4 accent-[#b47b0d]" type="checkbox" checked={checked} onChange={() => setDraftPermissions((current) => current.includes(option.value) ? current.filter((value) => value !== option.value) : [...current, option.value])} />{option.label}</label>;
                          })}
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          <button type="button" onClick={() => setEditingId(null)} className="inline-flex items-center gap-2 rounded-xl border border-[#d8cdc1] px-4 py-2 text-sm font-semibold text-[#5f5248]"><X className="h-4 w-4" />Cancel</button>
                          <button type="button" disabled={busy} onClick={() => void savePermissions(account)} className="inline-flex items-center gap-2 rounded-xl bg-[#2d2520] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busyAction === `${account.id}:update_permissions` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save permissions</button>
                        </div>
                      </div>
                    )}

                    {resettingId === account.id && (
                      <form onSubmit={(event) => void resetStaffPassword(event, account)} className="mt-4 rounded-2xl border border-[#e8dfd4] bg-[#fffcf8] p-4">
                        <p className="text-sm font-semibold text-[#2d2520]">Set a temporary password</p>
                        <p className="mt-1 text-xs leading-5 text-[#6b5e52]">All sessions will be revoked. The employee must choose a new private password at the next sign-in.</p>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <input required type="password" minLength={8} maxLength={72} value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} autoComplete="new-password" placeholder="New temporary password" aria-label="New temporary password" className="input" />
                          <input required type="password" minLength={8} maxLength={72} value={resetPasswordConfirmation} onChange={(event) => setResetPasswordConfirmation(event.target.value)} autoComplete="new-password" placeholder="Confirm temporary password" aria-label="Confirm temporary password" className="input" />
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          <button type="button" onClick={() => setResettingId(null)} className="inline-flex items-center gap-2 rounded-xl border border-[#d8cdc1] px-4 py-2 text-sm font-semibold text-[#5f5248]"><X className="h-4 w-4" />Cancel</button>
                          <button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#2d2520] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busyAction === `${account.id}:reset_password` ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}Reset password</button>
                        </div>
                      </form>
                    )}

                    {historyId === account.id && (
                      <div className="mt-4 rounded-2xl border border-[#e8dfd4] bg-[#fffcf8] p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-[#2d2520]">Recent login history</p><p className="mt-1 text-xs text-[#6b5e52]">Successful admin portal sign-ins, newest first.</p></div><span className="text-xs text-[#7a6b5f]">Created {formatDate(account.created_at)}</span></div>
                        {accountLogins.length === 0 ? <p className="mt-4 rounded-xl bg-white p-4 text-sm text-[#6b5e52]">No sign-ins have been recorded for this account.</p> : <ol className="mt-4 divide-y divide-[#eee5da] overflow-hidden rounded-xl border border-[#eee5da] bg-white">{accountLogins.slice(0, 10).map((event) => <li key={event.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm"><span className="font-medium text-[#3f3630]">{event.action}</span><time className="shrink-0 text-xs text-[#7a6b5f]" dateTime={event.created_at}>{formatDate(event.created_at)}</time></li>)}</ol>}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {deactivationAccount && (
        <ConfirmationModal
          account={deactivationAccount}
          busy={busyAction === `${deactivationAccount.id}:set_active`}
          onCancel={() => setDeactivationAccount(null)}
          onConfirm={() => {
            const account = deactivationAccount;
            void runAction(account, "set_active", { isActive: false }, `${account.full_name} was deactivated.`)
              .finally(() => setDeactivationAccount(null));
          }}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#5f5248]">{label}</span>{children}</label>;
}

function PasswordInput({ value, onChange, visible, onToggle, label }: { value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void; label: string }) {
  return (
    <span className="relative block">
      <input required type={visible ? "text" : "password"} minLength={8} maxLength={72} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" aria-label={label} className="input pr-12" />
      <button type="button" onClick={onToggle} aria-label={`${visible ? "Hide" : "Show"} ${label}`} aria-pressed={visible} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#6b5e52] transition hover:text-[#2d2520] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b47b0d]">
        {visible ? <EyeOff className="h-4.5 w-4.5" aria-hidden="true" /> : <Eye className="h-4.5 w-4.5" aria-hidden="true" />}
      </button>
    </span>
  );
}

function PermissionPicker({ permissions, onToggle }: { permissions: StaffPermission[]; onToggle: (permission: StaffPermission) => void }) {
  return (
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
            return <label key={option.value} className="flex cursor-pointer gap-3 rounded-xl p-3 hover:bg-[#fffbf5]"><input type="checkbox" checked={checked} onChange={() => onToggle(option.value)} className="sr-only" /><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? "border-[#e5a930] bg-[#e5a930] text-white" : "border-[#b9aa9b]"}`}>{checked && <Check className="h-3.5 w-3.5" />}</span><span><span className="block text-sm font-semibold text-[#2d2520]">{option.label}</span><span className="mt-0.5 block text-xs leading-5 text-[#6b5e52]">{option.description}</span></span></label>;
          })}
        </div>
      </details>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, disabled, loading = false, danger = false }: { icon: typeof Pencil; label: string; onClick: () => void; disabled: boolean; loading?: boolean; danger?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${danger ? "border-red-200 text-red-700 hover:bg-red-50" : "border-[#d8cdc1] text-[#5f5248] hover:bg-[#fffbf5] hover:text-[#2d2520]"}`}>{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}{label}</button>;
}

function ConfirmationModal({ account, busy, onCancel, onConfirm }: { account: StaffAccount; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#211b17]/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="deactivate-staff-title" aria-describedby="deactivate-staff-description" className="w-full max-w-md rounded-3xl border border-[#e8dfd4] bg-white p-6 shadow-2xl sm:p-7">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700"><UserX className="h-6 w-6" /></div>
        <h2 id="deactivate-staff-title" className="mt-5 text-2xl font-semibold text-[#2d2520]">Deactivate employee?</h2>
        <p id="deactivate-staff-description" className="mt-3 leading-6 text-[#5f5248]"><strong>{account.full_name}</strong> will no longer be able to sign in. Their active sessions will also be ended.</p>
        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" autoFocus disabled={busy} onClick={onCancel} className="rounded-xl border border-[#d8cdc1] px-5 py-2.5 text-sm font-semibold text-[#5f5248] hover:bg-[#fffbf5] disabled:opacity-60">Cancel</button>
          <button type="button" disabled={busy} onClick={onConfirm} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}Deactivate account</button>
        </div>
      </section>
    </div>
  );
}
