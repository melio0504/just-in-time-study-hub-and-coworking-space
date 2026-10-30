"use client";

import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { validateNewPassword } from "@/lib/password";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    const validationError = validateNewPassword(password, confirmation);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setIsSubmitting(false);
      setErrorMessage(error.message);
      return;
    }

    // The recovery callback already established the user's session. Updating
    // the password keeps that session active, so the account opens without a
    // second sign-in.
    router.replace("/account");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-linear-to-b from-[#fffcf7] to-[#fff8ed] px-6 pt-24">
      <div className="mx-auto flex max-w-xl items-center py-16">
        <section className="w-full rounded-3xl border border-[#f3ede4] bg-white/80 p-8 shadow-lg backdrop-blur-sm sm:p-10">
          <div className="mb-8">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fef3dc]">
              <LockKeyhole className="h-7 w-7 text-[#e5a930]" />
            </div>
            <h1 className="mb-3 text-3xl text-[#2d2520]">Create a new password</h1>
            <p className="leading-relaxed text-[#6b5e52]">
              Use at least 8 characters with at least one letter and one number. You will be signed
              in automatically after saving it.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMessage && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {errorMessage}
              </p>
            )}

            <PasswordField
              id="new-password"
              label="New password"
              value={password}
              visible={showPassword}
              onChange={setPassword}
              onToggle={() => setShowPassword((current) => !current)}
              autoComplete="new-password"
              autoFocus
            />

            <PasswordField
              id="confirm-password"
              label="Confirm new password"
              value={confirmation}
              visible={showConfirmation}
              onChange={setConfirmation}
              onToggle={() => setShowConfirmation((current) => !current)}
              autoComplete="new-password"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full cursor-pointer rounded-full bg-[#e5a930] px-8 py-4 text-white transition-shadow hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? "Updating password…" : "Update password"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
  autoComplete: "new-password";
  autoFocus?: boolean;
};

function PasswordField({
  id,
  label,
  value,
  visible,
  onChange,
  onToggle,
  autoComplete,
  autoFocus = false,
}: PasswordFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm uppercase tracking-wider text-[#6b5e52]">
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
          minLength={8}
          autoFocus={autoFocus}
          className="w-full rounded-xl border border-[#f3ede4] bg-white px-4 py-3 pr-12 text-[#2d2520] outline-none transition-all focus:ring-2 focus:ring-[#e5a930]"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center rounded-r-xl text-[#6b5e52] transition-colors hover:text-[#e5a930] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#e5a930]">
          {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
