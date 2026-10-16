"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const message = new URLSearchParams(window.location.search).get("error");
    if (!message) return;

    const timer = window.setTimeout(() => setErrorMessage(message), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    if (!isSupabaseConfigured) {
      setErrorMessage("Password recovery is not configured. Please contact support.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", "/reset-password");
    callbackUrl.searchParams.set("flow", "recovery");

    setIsSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: callbackUrl.toString(),
    });
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSentTo(normalizedEmail);
  };

  return (
    <main className="min-h-screen bg-linear-to-b from-[#fffcf7] to-[#fff8ed] px-6 pt-24">
      <div className="mx-auto flex max-w-xl items-center py-16">
        <section className="w-full rounded-3xl border border-[#f3ede4] bg-white/80 p-8 shadow-lg backdrop-blur-sm sm:p-10">
          <Link
            href="/login"
            className="mb-8 inline-flex items-center gap-2 text-sm text-[#6b5e52] transition-colors hover:text-[#e5a930]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>

          {sentTo ? (
            <div className="text-center" aria-live="polite">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#fef3dc]">
                <CheckCircle2 className="h-8 w-8 text-[#e5a930]" />
              </div>
              <h1 className="mb-3 text-3xl text-[#2d2520]">Check your email</h1>
              <p className="mb-3 leading-relaxed text-[#6b5e52]">
                If an account exists for <span className="font-medium text-[#2d2520]">{sentTo}</span>,
                we sent a password reset link.
              </p>
              <p className="mb-8 text-sm text-[#6b5e52]">
                Open the link to choose a new password. Check your spam folder if it does not arrive.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSentTo("");
                  setErrorMessage("");
                }}
                className="w-full cursor-pointer rounded-full border border-[#e5a930] px-8 py-3 text-[#b57b08] transition-colors hover:bg-[#fef3dc]"
              >
                Use another email
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fef3dc]">
                  <Mail className="h-7 w-7 text-[#e5a930]" />
                </div>
                <h1 className="mb-3 text-3xl text-[#2d2520]">Forgot your password?</h1>
                <p className="leading-relaxed text-[#6b5e52]">
                  Enter the email used for your account and we will send you a secure reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {errorMessage && (
                  <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {errorMessage}
                  </p>
                )}

                <div>
                  <label htmlFor="recovery-email" className="mb-2 block text-sm uppercase tracking-wider text-[#6b5e52]">
                    Email address
                  </label>
                  <input
                    id="recovery-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoFocus
                    placeholder="you@gmail.com"
                    className="w-full rounded-xl border border-[#f3ede4] bg-white px-4 py-3 text-[#2d2520] outline-none transition-all placeholder:text-[#2d2520]/50 focus:ring-2 focus:ring-[#e5a930]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full cursor-pointer rounded-full bg-[#e5a930] px-8 py-4 text-white transition-shadow hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Sending reset link…" : "Send reset link"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
