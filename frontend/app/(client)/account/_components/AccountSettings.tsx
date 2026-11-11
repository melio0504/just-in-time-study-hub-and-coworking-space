"use client";

import { FunctionsHttpError } from "@supabase/supabase-js";
import { Eye, EyeOff, KeyRound, Mail, Save, Trash2, User, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PASSWORD_REQUIREMENTS_MESSAGE, validateNewPassword } from "@/lib/password";
import { createClient } from "@/lib/supabase/client";
import { canUserChangePassword } from "@/lib/supabase/user";

interface AccountSettingsProps {
  username: string;
  email: string;
  canChangePassword: boolean;
  usernameChangedAt: string | null;
  currentTimestamp: number;
  onUsernameChanged: (username: string, changedAt: string) => void;
}

const USERNAME_CHANGE_COOLDOWN_DAYS = 30;

function getNextUsernameChangeAt(changedAt: string | null) {
  if (!changedAt) return null;
  const changedAtTime = Date.parse(changedAt);
  if (Number.isNaN(changedAtTime)) return null;
  return new Date(changedAtTime + USERNAME_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
}

async function getFunctionError(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    const payload = (await error.context.json().catch(() => null)) as { error?: unknown } | null;
    if (typeof payload?.error === "string") return payload.error;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AccountSettings({
  username,
  email,
  canChangePassword,
  usernameChangedAt,
  currentTimestamp,
  onUsernameChanged,
}: AccountSettingsProps) {
  const router = useRouter();
  const [name, setName] = useState(username);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!showDeleteModal) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDeleting) setShowDeleteModal(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isDeleting, showDeleteModal]);

  useEffect(() => {
    if (!showPasswordModal) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isChangingPassword) {
        setShowPasswordModal(false);
        setPasswordError("");
      }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isChangingPassword, showPasswordModal]);

  const normalizedName = name.trim().replace(/\s+/g, " ");
  const nameUnchanged = normalizedName === username;
  const nextUsernameChangeAt = getNextUsernameChangeAt(usernameChangedAt);
  const usernameChangeOnCooldown = Boolean(
    nextUsernameChangeAt && nextUsernameChangeAt.getTime() > currentTimestamp,
  );
  const nextUsernameChangeLabel = nextUsernameChangeAt?.toLocaleDateString("en-PH", {
    dateStyle: "long",
    timeZone: "Asia/Manila",
  });

  const saveUsername = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError("");
    setSaveMessage("");

    if (normalizedName.length < 2 || normalizedName.length > 120) {
      setSaveError("Enter a username between 2 and 120 characters.");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setIsSaving(false);
      setSaveError("Your session could not be verified. Please sign in again.");
      return;
    }

    const { data: updatedProfile, error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: normalizedName })
      .eq("id", user.id)
      .select("full_name, username_changed_at")
      .single();

    if (profileError || !updatedProfile) {
      setIsSaving(false);
      setSaveError(profileError?.message ?? "Your username could not be updated.");
      return;
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: { full_name: normalizedName },
    });
    setIsSaving(false);

    if (metadataError) {
      setSaveError("Your username was saved, but your session profile could not be refreshed.");
    } else {
      setSaveMessage("Username updated successfully.");
    }
    setName(updatedProfile.full_name);
    if (updatedProfile.username_changed_at) {
      onUsernameChanged(updatedProfile.full_name, updatedProfile.username_changed_at);
    } else {
      setSaveMessage("");
      setSaveError("Your username was saved, but its change date could not be refreshed.");
    }
  };

  const openDeleteModal = () => {
    setDeleteConfirmation("");
    setDeleteError("");
    setShowDeleteModal(true);
  };

  const openPasswordModal = (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");

    if (!currentPassword) {
      setPasswordError("Enter your current password.");
      return;
    }

    const validationError = validateNewPassword(newPassword, passwordConfirmation);
    if (validationError) {
      setPasswordError(validationError);
      return;
    }

    setShowPasswordModal(true);
  };

  const closePasswordModal = () => {
    if (isChangingPassword) return;
    setShowPasswordModal(false);
    setPasswordError("");
  };

  const changePassword = async () => {
    if (isChangingPassword) return;

    setPasswordError("");
    setIsChangingPassword(true);
    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setIsChangingPassword(false);
      setPasswordError("Your session could not be verified. Please sign in again.");
      return;
    }

    if (!canUserChangePassword(user)) {
      setIsChangingPassword(false);
      setPasswordError("Password changes are not available for this account.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      current_password: currentPassword,
      password: newPassword,
    });
    setIsChangingPassword(false);

    if (error) {
      setPasswordError(error.message);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setPasswordConfirmation("");
    setShowPasswordModal(false);
    setPasswordMessage("Password changed successfully.");
  };

  const deleteAccount = async () => {
    if (deleteConfirmation !== "DELETE" || isDeleting) return;

    setIsDeleting(true);
    setDeleteError("");
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke("delete-account", {
      body: {},
    });

    if (error || data?.deleted !== true) {
      setDeleteError(await getFunctionError(error, "Your account could not be deleted."));
      setIsDeleting(false);
      return;
    }

    await supabase.auth.signOut({ scope: "local" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <>
      <section className="rounded-3xl border border-[#f3ede4] bg-white/70 p-6 shadow-lg backdrop-blur-sm sm:p-8">
        <h2 className="text-2xl text-[#2d2520]">Account settings</h2>
        <p className="mt-2 text-sm leading-6 text-[#6b5e52]">
          Update the name shown on your account and used for future reservations.
        </p>

        <form onSubmit={saveUsername} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="account-username"
              className="mb-2 block text-xs uppercase tracking-wider text-[#6b5e52]"
            >
              <User className="mr-1 inline h-4 w-4" />
              Username
            </label>
            <input
              id="account-username"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSaveError("");
                setSaveMessage("");
              }}
              minLength={2}
              maxLength={120}
              autoComplete="name"
              required
              disabled={usernameChangeOnCooldown}
              className="w-full rounded-xl border border-[#f3ede4] bg-white px-4 py-3 text-[#2d2520] outline-none transition focus:border-[#e5a930] focus:ring-2 focus:ring-[#e5a930]/30 disabled:cursor-not-allowed disabled:bg-[#f5f1eb] disabled:text-[#8a8179]"
            />
            {usernameChangeOnCooldown ? (
              <p
                role="status"
                className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800"
              >
                Username changes are limited to once every {USERNAME_CHANGE_COOLDOWN_DAYS} days. You
                can change it again on {nextUsernameChangeLabel}.
              </p>
            ) : (
              <p className="mt-2 text-xs leading-5 text-[#6b5e52]">
                You can change your username once every {USERNAME_CHANGE_COOLDOWN_DAYS} days.
              </p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-[#6b5e52]">
              <Mail className="mr-1 inline h-4 w-4" />
              Email
            </p>
            <p className="break-all rounded-xl border border-[#f3ede4] bg-[#fffcf7] px-4 py-3 text-sm text-[#6b5e52]">
              {email}
            </p>
          </div>

          {saveError && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {saveError}
            </p>
          )}
          {saveMessage && (
            <p
              role="status"
              className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700"
            >
              {saveMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving || nameUnchanged || usernameChangeOnCooldown}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#e5a930] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#d69520] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Saving…" : "Save username"}
          </button>
        </form>

        {canChangePassword && (
          <div className="mt-8 border-t border-[#f3ede4] pt-6">
            <h3 className="flex items-center gap-2 text-lg font-medium text-[#2d2520]">
              <KeyRound className="h-5 w-5 text-[#e5a930]" />
              Change password
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#6b5e52]">
              Confirm your current password, then choose a new password for your account.
            </p>

            <form onSubmit={openPasswordModal} className="mt-5 space-y-4">
              <PasswordField
                id="account-current-password"
                label="Current password"
                value={currentPassword}
                visible={showCurrentPassword}
                onChange={(value) => {
                  setCurrentPassword(value);
                  setPasswordError("");
                  setPasswordMessage("");
                }}
                onToggle={() => setShowCurrentPassword((current) => !current)}
                autoComplete="current-password"
                disabled={isChangingPassword}
              />

              <PasswordField
                id="account-new-password"
                label="New password"
                value={newPassword}
                visible={showNewPassword}
                onChange={(value) => {
                  setNewPassword(value);
                  setPasswordError("");
                  setPasswordMessage("");
                }}
                onToggle={() => setShowNewPassword((current) => !current)}
                autoComplete="new-password"
                disabled={isChangingPassword}
              />

              <PasswordField
                id="account-confirm-password"
                label="Confirm new password"
                value={passwordConfirmation}
                visible={showPasswordConfirmation}
                onChange={(value) => {
                  setPasswordConfirmation(value);
                  setPasswordError("");
                  setPasswordMessage("");
                }}
                onToggle={() => setShowPasswordConfirmation((current) => !current)}
                autoComplete="new-password"
                disabled={isChangingPassword}
              />

              <p className="text-xs leading-5 text-[#6b5e52]">{PASSWORD_REQUIREMENTS_MESSAGE}</p>

              {passwordError && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {passwordError}
                </p>
              )}
              {passwordMessage && (
                <p
                  role="status"
                  className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700"
                >
                  {passwordMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={isChangingPassword}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#2d2520] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#44382f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4" />
                {isChangingPassword ? "Changing password…" : "Change password"}
              </button>
            </form>
          </div>
        )}

        <div className="mt-8 border-t border-red-100 pt-6">
          <h3 className="text-lg font-medium text-red-700">Delete account</h3>
          <p className="mt-2 text-sm leading-6 text-[#6b5e52]">
            Permanently remove your login and personal profile. You must cancel or complete active
            reservations first.
          </p>
          <button
            type="button"
            onClick={openDeleteModal}
            className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Delete my account
          </button>
        </div>
      </section>

      {showPasswordModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-[#2d2520]/60 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) closePasswordModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
            aria-describedby="change-password-description"
            className="w-full max-w-lg rounded-3xl border border-[#f3ede4] bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#fef3dc] text-[#e5a930]">
                <KeyRound className="h-5 w-5" />
              </div>
              <button
                type="button"
                onClick={closePasswordModal}
                disabled={isChangingPassword}
                aria-label="Close password change confirmation"
                className="cursor-pointer rounded-full p-2 text-[#6b5e52] transition-colors hover:bg-[#f3ede4] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <h2 id="change-password-title" className="mt-5 text-2xl text-[#2d2520]">
              Change your password?
            </h2>
            <p id="change-password-description" className="mt-2 text-sm leading-6 text-[#6b5e52]">
              Your current password will stop working immediately. Use your new password the next
              time you sign in.
            </p>

            {passwordError && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {passwordError}
              </p>
            )}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closePasswordModal}
                disabled={isChangingPassword}
                className="cursor-pointer rounded-full border border-[#f3ede4] bg-white px-5 py-2.5 text-sm text-[#2d2520] transition-colors hover:border-[#e5a930] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void changePassword()}
                disabled={isChangingPassword}
                autoFocus
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#2d2520] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#44382f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4" />
                {isChangingPassword ? "Changing password…" : "Change password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-[#2d2520]/60 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isDeleting) setShowDeleteModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            aria-describedby="delete-account-description"
            className="w-full max-w-lg rounded-3xl border border-red-100 bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                aria-label="Close account deletion confirmation"
                className="cursor-pointer rounded-full p-2 text-[#6b5e52] transition-colors hover:bg-[#f3ede4] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <h2 id="delete-account-title" className="mt-5 text-2xl text-[#2d2520]">
              Permanently delete your account?
            </h2>
            <p id="delete-account-description" className="mt-2 text-sm leading-6 text-[#6b5e52]">
              Your login, profile, and personal study data will be deleted. Past reservation and
              payment records are retained for business records but anonymized and unlinked from
              your account. This cannot be undone.
            </p>

            <label
              htmlFor="delete-account-confirmation"
              className="mt-5 block text-sm font-medium text-[#2d2520]"
            >
              Type <strong>DELETE</strong> to confirm
            </label>
            <input
              id="delete-account-confirmation"
              value={deleteConfirmation}
              onChange={(event) => {
                setDeleteConfirmation(event.target.value);
                setDeleteError("");
              }}
              disabled={isDeleting}
              autoComplete="off"
              autoFocus
              className="mt-2 w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-[#2d2520] outline-none transition focus:ring-2 focus:ring-red-300 disabled:bg-gray-50"
              placeholder="DELETE"
            />

            {deleteError && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {deleteError}
              </p>
            )}

            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="cursor-pointer rounded-full border border-[#f3ede4] bg-white px-5 py-2.5 text-sm text-[#2d2520] transition-colors hover:border-[#e5a930] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Keep my account
              </button>
              <button
                type="button"
                onClick={() => void deleteAccount()}
                disabled={deleteConfirmation !== "DELETE" || isDeleting}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? "Deleting…" : "Delete account permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  autoComplete: "current-password" | "new-password";
  disabled: boolean;
};

function PasswordField({
  id,
  label,
  value,
  visible,
  onChange,
  onToggle,
  autoComplete,
  disabled,
}: PasswordFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs uppercase tracking-wider text-[#6b5e52]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
          minLength={autoComplete === "new-password" ? 8 : undefined}
          disabled={disabled}
          className="w-full rounded-xl border border-[#f3ede4] bg-white px-4 py-3 pr-12 text-[#2d2520] outline-none transition focus:border-[#e5a930] focus:ring-2 focus:ring-[#e5a930]/30 disabled:cursor-not-allowed disabled:bg-[#f5f1eb]"
        />
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center rounded-r-xl text-[#6b5e52] transition-colors hover:text-[#e5a930] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#e5a930] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
