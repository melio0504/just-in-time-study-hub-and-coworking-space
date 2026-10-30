"use client";

import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

type PaymentState = "loading" | "ready" | "paying" | "success" | "email_error" | "error";

interface PaymentPreview {
  reservationCode: string;
  guestName: string;
  guestEmail: string;
  startsAt: string;
  endsAt: string;
  seats: string[];
  subtotalCents: number;
  expiresAt: string;
  confirmed: boolean;
}

const formatPrice = (cents: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(cents / 100);

const formatSchedule = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));

async function invokePayment(token: string, action: "preview" | "confirm") {
  const response = await fetch("/api/reservation/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, action }),
    cache: "no-store",
    signal: AbortSignal.timeout(action === "preview" ? 20_000 : 35_000),
  });
  const data = await response.json().catch(() => ({
    error: "The payment service returned an invalid response.",
  }));
  return { data, ok: response.ok };
}

function requestErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return "The payment service did not respond. Ask staff to check the local Supabase Functions service.";
  }
  return error instanceof Error ? error.message : fallback;
}

function PaymentContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<PaymentState>("loading");
  const [preview, setPreview] = useState<PaymentPreview | null>(null);
  const [message, setMessage] = useState("Loading payment details…");

  useEffect(() => {
    let cancelled = false;
    const loadPreview = async () => {
      if (!token) {
        setState("error");
        setMessage("This payment link is missing its secure token.");
        return;
      }
      try {
        const { data, ok } = await invokePayment(token, "preview");
        if (cancelled) return;
        if (!ok || data?.error) {
          setState("error");
          setMessage(
            typeof data?.error === "string" ? data.error : "Unable to load payment details.",
          );
          return;
        }
        if (
          typeof data?.reservationCode !== "string" ||
          typeof data?.guestName !== "string" ||
          typeof data?.guestEmail !== "string" ||
          typeof data?.startsAt !== "string" ||
          typeof data?.endsAt !== "string" ||
          !Array.isArray(data?.seats) ||
          typeof data?.subtotalCents !== "number"
        ) {
          setState("error");
          setMessage("The server returned incomplete payment details.");
          return;
        }
        setPreview(data as PaymentPreview);
        setState("ready");
        setMessage("");
      } catch (previewError) {
        if (cancelled) return;
        setState("error");
        setMessage(requestErrorMessage(previewError, "Unable to load payment details."));
      }
    };
    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const pay = useCallback(async () => {
    if (!preview || state === "paying") return;
    setState("paying");
    setMessage("Confirming payment and preparing your kiosk pass…");
    try {
      const { data, ok } = await invokePayment(token, "confirm");
      if (!ok || data?.error) {
        const detail =
          typeof data?.error === "string" ? data.error : "Payment confirmation failed.";
        if (data?.confirmed === true) {
          setState("email_error");
          setMessage(detail);
          return;
        }
        setState("error");
        setMessage(detail);
        return;
      }
      setState("success");
      setMessage(`Your reservation is confirmed. The kiosk QR pass was sent to ${data.email}.`);
    } catch (paymentError) {
      setState("error");
      setMessage(requestErrorMessage(paymentError, "Payment confirmation failed."));
    }
  }, [preview, state, token]);

  const isBusy = state === "loading" || state === "paying";
  const isComplete = state === "success" || state === "email_error";

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#f3f6fb] text-[#14213d]">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-white shadow-2xl">
        <header className="bg-[#0877e8] px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => history.back()}
              className="rounded-full p-2 hover:bg-white/10"
              aria-label="Go back">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div className="text-center">
              <p className="text-2xl font-extrabold tracking-tight">GCash</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-100">
                Payment simulator
              </p>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
              <ShieldCheck className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-7 text-center">
            <p className="text-sm text-blue-100">Amount due</p>
            <p className="mt-1 text-4xl font-bold tracking-tight">
              {preview ? formatPrice(preview.subtotalCents) : "₱—"}
            </p>
          </div>
        </header>

        <main className="relative -mt-3 flex flex-1 flex-col rounded-t-3xl bg-[#f3f6fb] px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
          {isBusy && (
            <section className="flex flex-1 flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-[#0877e8]" />
              <h1 className="mt-5 text-xl font-bold">
                {state === "paying" ? "Processing payment" : "Secure checkout"}
              </h1>
              <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">{message}</p>
            </section>
          )}

          {!isBusy && preview && !isComplete && (
            <>
              <section className="rounded-2xl bg-white p-5 shadow-[0_8px_30px_rgba(15,50,100,0.08)]">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-[#0877e8]">
                    <ReceiptText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wider text-slate-400">Paying</p>
                    <h1 className="truncate font-bold text-slate-900">Just In Time Study Hub</h1>
                  </div>
                </div>
                <dl className="mt-4 space-y-4 text-sm">
                  <Detail
                    icon={ReceiptText}
                    label="Reservation"
                    primary={preview.reservationCode}
                  />
                  <Detail
                    icon={UserRound}
                    label="Customer"
                    primary={preview.guestName}
                    secondary={preview.guestEmail}
                  />
                  <Detail
                    icon={MapPin}
                    label={`Seat${preview.seats.length === 1 ? "" : "s"}`}
                    primary={preview.seats.join(", ")}
                  />
                  <Detail
                    icon={CalendarClock}
                    label="Schedule"
                    primary={formatSchedule(preview.startsAt)}
                    secondary={`Until ${formatSchedule(preview.endsAt)}`}
                  />
                </dl>
                <div className="mt-5 flex items-center justify-between border-t border-dashed border-slate-200 pt-4">
                  <span className="font-semibold text-slate-600">Total</span>
                  <span className="text-2xl font-extrabold text-[#0877e8]">
                    {formatPrice(preview.subtotalCents)}
                  </span>
                </div>
              </section>

              {state === "error" && <ErrorNotice message={message} />}

              <div className="mt-auto pt-6">
                <div className="mb-3 flex items-center justify-center gap-2 text-xs text-slate-500">
                  <LockKeyhole className="h-4 w-4" />
                  Secure local payment simulation
                </div>
                <button
                  type="button"
                  onClick={() => void pay()}
                  className="min-h-14 w-full rounded-2xl bg-[#0877e8] px-5 py-4 text-lg font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-[#0668cc] active:scale-[0.99]">
                  {preview.confirmed ? "Continue" : `Pay ${formatPrice(preview.subtotalCents)}`}
                </button>
              </div>
            </>
          )}

          {!isBusy && isComplete && preview && (
            <section className="flex flex-1 flex-col items-center justify-center py-12 text-center">
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-14 w-14" />
              </span>
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">
                Payment successful
              </p>
              <h1 className="mt-2 text-3xl font-extrabold text-slate-900">Reservation confirmed</h1>
              <p className="mt-2 text-2xl font-bold text-[#0877e8]">
                {formatPrice(preview.subtotalCents)}
              </p>
              <p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">{message}</p>
              <div
                className={`mt-6 flex max-w-sm gap-3 rounded-2xl p-4 text-left text-sm ${state === "email_error" ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-900"}`}>
                <Mail className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  {state === "email_error"
                    ? "The reservation is confirmed, but the email could not be delivered. Show the reservation code to staff."
                    : "Check your email for the private QR code used to check in and out at the kiosk."}
                </p>
              </div>
              <p className="mt-5 font-mono text-sm font-bold text-slate-600">
                {preview.reservationCode}
              </p>
            </section>
          )}

          {!isBusy && state === "error" && !preview && (
            <section className="flex flex-1 flex-col items-center justify-center py-16 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertCircle className="h-11 w-11" />
              </span>
              <h1 className="mt-5 text-2xl font-bold text-slate-900">Payment unavailable</h1>
              <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">{message}</p>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  primary,
  secondary,
}: {
  icon: typeof ReceiptText;
  label: string;
  primary: string;
  secondary?: string;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
      <div>
        <dt className="text-slate-400">{label}</dt>
        <dd className="font-semibold text-slate-800">{primary}</dd>
        {secondary && <dd className="text-xs text-slate-500">{secondary}</dd>}
      </div>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mt-4 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertCircle className="h-5 w-5 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

export default function ConfirmReservationPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[100] bg-[#f3f6fb]" />}>
      <PaymentContent />
    </Suspense>
  );
}
