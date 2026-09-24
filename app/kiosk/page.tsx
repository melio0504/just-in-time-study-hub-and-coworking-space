"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import {
  QrCode,
  ScanLine,
  Clock,
  Users,
  Armchair,
  CheckCircle2,
  XCircle,
  LogIn,
  LogOut,
  Wifi,
  Coffee,
  MapPin,
  AlertCircle,
  Timer,
  UserCheck,
  Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type KioskMode = "check-in" | "check-out";
type ScanState = "idle" | "scanning" | "success" | "error";

interface Booking {
  id: string;
  guestName: string;
  seats: string[];
  date: string;
  timeIn: string;
  durationHours: number;
  paymentConfirmed: boolean;
  scheduledStart: Date;
  scheduledEnd: Date;
}

interface ActiveSession {
  bookingId: string;
  guestName: string;
  seats: string[];
  checkedInAt: string;
  scheduledEnd: string;
}

interface ActivityEntry {
  id: string;
  type: "check-in" | "check-out";
  guestName: string;
  seats: string[];
  timestamp: string;
}

type ValidationError =
  | "invalid"
  | "expired"
  | "already_checked_in"
  | "not_yet_scheduled"
  | "payment_pending"
  | "not_checked_in";

const STORAGE_SESSIONS = "jit_kiosk_active_sessions";
const STORAGE_ACTIVITY = "jit_kiosk_activity_log";

function buildDemoBookings(): Record<string, Booking> {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const inFourHours = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const expiredEnd = new Date(now.getTime() - 30 * 60 * 1000);
  const expiredStart = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const futureStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const futureEnd = new Date(now.getTime() + 5 * 60 * 60 * 1000);

  return {
    "RES-DEMO-VALID": {
      id: "RES-DEMO-VALID",
      guestName: "Maria Santos",
      seats: ["UA03"],
      date: today,
      timeIn: formatTime(now),
      durationHours: 4,
      paymentConfirmed: true,
      scheduledStart: hourAgo,
      scheduledEnd: inFourHours,
    },
    "RES-DEMO-EARLY": {
      id: "RES-DEMO-EARLY",
      guestName: "Juan Dela Cruz",
      seats: ["LA02"],
      date: today,
      timeIn: formatTime(futureStart),
      durationHours: 2,
      paymentConfirmed: true,
      scheduledStart: futureStart,
      scheduledEnd: futureEnd,
    },
    "RES-DEMO-EXPIRED": {
      id: "RES-DEMO-EXPIRED",
      guestName: "Expired Booking",
      seats: ["BR01"],
      date: today,
      timeIn: formatTime(expiredStart),
      durationHours: 1,
      paymentConfirmed: true,
      scheduledStart: expiredStart,
      scheduledEnd: expiredEnd,
    },
    "RES-DEMO-UNPAID": {
      id: "RES-DEMO-UNPAID",
      guestName: "Pending Payment",
      seats: ["RC02"],
      date: today,
      timeIn: formatTime(now),
      durationHours: 3,
      paymentConfirmed: false,
      scheduledStart: hourAgo,
      scheduledEnd: inTwoHours,
    },
  };
}

const ERROR_MESSAGES: Record<ValidationError, { title: string; description: string }> = {
  invalid: {
    title: "Invalid QR Code",
    description: "This code is not recognized. Please use the QR from your booking confirmation email.",
  },
  expired: {
    title: "Booking Expired",
    description: "Your reservation window has ended. Please book a new session at the front desk or online.",
  },
  already_checked_in: {
    title: "Already Checked In",
    description: "This pass was already used for entry. Scan again at checkout when you leave.",
  },
  not_yet_scheduled: {
    title: "Not Yet Scheduled",
    description: "Your booking is not active yet. Please return within 15 minutes of your start time.",
  },
  payment_pending: {
    title: "Payment Not Confirmed",
    description: "Complete payment first, then scan your QR again to check in.",
  },
  not_checked_in: {
    title: "No Active Session",
    description: "We could not find an active check-in for this booking. Scan at entry first.",
  },
};

function loadSessions(): ActiveSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_SESSIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadActivity(): ActivityEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVITY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatClock(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function getRemainingMinutes(endIso: string) {
  const end = new Date(endIso).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((end - now) / 60000));
}

function resolveBooking(code: string): Booking | null {
  const normalized = code.trim().toUpperCase();
  const demoBookings = buildDemoBookings();
  if (demoBookings[normalized]) return demoBookings[normalized];
  if (normalized.startsWith("RES-")) {
    const now = new Date();
    const end = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    return {
      id: normalized,
      guestName: "Walk-in Guest",
      seats: ["UA01"],
      date: now.toISOString().split("T")[0],
      timeIn: formatTime(now),
      durationHours: 4,
      paymentConfirmed: true,
      scheduledStart: new Date(now.getTime() - 30 * 60 * 1000),
      scheduledEnd: end,
    };
  }
  return null;
}

export default function KioskPage() {
  const [now, setNow] = useState(() => new Date());
  const [mode, setMode] = useState<KioskMode>("check-in");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [codeInput, setCodeInput] = useState("");
  const [errorType, setErrorType] = useState<ValidationError>("invalid");
  const [successBooking, setSuccessBooking] = useState<Booking | null>(null);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  const totalSeats = 52;
  const occupiedCount = sessions.length;

  useEffect(() => {
    setSessions(loadSessions());
    setActivity(loadActivity());
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const persistSessions = useCallback((next: ActiveSession[]) => {
    setSessions(next);
    localStorage.setItem(STORAGE_SESSIONS, JSON.stringify(next));
  }, []);

  const persistActivity = useCallback((next: ActivityEntry[]) => {
    const trimmed = next.slice(0, 12);
    setActivity(trimmed);
    localStorage.setItem(STORAGE_ACTIVITY, JSON.stringify(trimmed));
  }, []);

  const addActivity = useCallback(
    (entry: Omit<ActivityEntry, "id" | "timestamp">) => {
      const item: ActivityEntry = {
        ...entry,
        id: `${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
      persistActivity([item, ...loadActivity()]);
    },
    [persistActivity]
  );

  const resetToIdle = useCallback(() => {
    setScanState("idle");
    setCodeInput("");
    setSuccessBooking(null);
  }, []);

  const validateCheckIn = useCallback(
    (booking: Booking): ValidationError | null => {
      if (!booking.paymentConfirmed) return "payment_pending";
      const nowMs = Date.now();
      if (nowMs > booking.scheduledEnd.getTime()) return "expired";
      if (nowMs < booking.scheduledStart.getTime() - 15 * 60 * 1000) return "not_yet_scheduled";
      if (sessions.some((s) => s.bookingId === booking.id)) return "already_checked_in";
      return null;
    },
    [sessions]
  );

  const processScan = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim().toUpperCase();
      if (!code) return;

      setScanState("scanning");
      await new Promise((r) => setTimeout(r, 900));

      const booking = resolveBooking(code);
      if (!booking) {
        setErrorType("invalid");
        setScanState("error");
        return;
      }

      if (mode === "check-in") {
        const err = validateCheckIn(booking);
        if (err) {
          setErrorType(err);
          setScanState("error");
          return;
        }

        const session: ActiveSession = {
          bookingId: booking.id,
          guestName: booking.guestName,
          seats: booking.seats,
          checkedInAt: new Date().toISOString(),
          scheduledEnd: booking.scheduledEnd.toISOString(),
        };
        const next = [...sessions.filter((s) => s.bookingId !== booking.id), session];
        persistSessions(next);
        addActivity({
          type: "check-in",
          guestName: booking.guestName,
          seats: booking.seats,
        });
        setSuccessBooking(booking);
        setScanState("success");
        window.setTimeout(resetToIdle, 8000);
        return;
      }

      const existing = sessions.find((s) => s.bookingId === booking.id);
      if (!existing) {
        setErrorType("not_checked_in");
        setScanState("error");
        return;
      }

      persistSessions(sessions.filter((s) => s.bookingId !== booking.id));
      addActivity({
        type: "check-out",
        guestName: booking.guestName,
        seats: booking.seats,
      });
      setSuccessBooking(booking);
      setScanState("success");
      window.setTimeout(resetToIdle, 6000);
    },
    [mode, sessions, validateCheckIn, persistSessions, addActivity, resetToIdle]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processScan(codeInput);
  };

  const todayLabel = useMemo(
    () =>
      now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    [now]
  );

  const features = [
    { icon: QrCode, label: "QR Entry System" },
    { icon: Timer, label: "Automated Time Tracking" },
    { icon: UserCheck, label: "Kiosk Reception" },
    { icon: Activity, label: "Attendance Monitoring" },
  ];

  const recentActivity = activity.slice(0, 4);
  const visibleSessions = sessions.slice(0, 3);

  return (
    <div className="h-full bg-gradient-to-br from-[#fffcf7] via-[#fff8ed] to-[#fef3dc] flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="border-b border-[#f3ede4] bg-white/80 backdrop-blur-md px-5 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <Image
            src="/images/logo.png"
            alt="Just In Time Study Hub"
            width={245}
            height={118}
            className="w-12 h-auto shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs text-[#e5a930] uppercase tracking-wider font-medium">
              Facility Kiosk
            </p>
            <h1 className="text-lg sm:text-xl text-[#2d2520] truncate">Just In Time Study Hub</h1>
          </div>
        </div>

        <div className="hidden xl:flex items-center gap-5 shrink-0">
          {features.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm text-[#6b5e52]">
              <div className="w-9 h-9 bg-[#fef3dc] rounded-lg flex items-center justify-center">
                <Icon className="w-4 h-4 text-[#e5a930]" />
              </div>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="text-right shrink-0">
          <p className="text-3xl sm:text-4xl font-mono text-[#2d2520] tabular-nums leading-tight">
            {formatClock(now)}
          </p>
          <p className="text-xs sm:text-sm text-[#6b5e52] hidden sm:block">{todayLabel}</p>
        </div>
      </header>

      <div className="lg:hidden shrink-0 px-5 py-2.5 border-b border-[#f3ede4] bg-white/50 flex items-center justify-between gap-3 text-base">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#e5a930]" />
          <span className="text-[#2d2520] font-medium">{occupiedCount}</span>
          <span className="text-[#6b5e52]">in</span>
        </div>
        <div className="flex-1 h-2 bg-[#f3ede4] rounded-full overflow-hidden max-w-[140px]">
          <div
            className="h-full bg-[#e5a930] rounded-full transition-all duration-500"
            style={{ width: `${(occupiedCount / totalSeats) * 100}%` }}
          />
        </div>
        <span className="text-[#6b5e52]">{totalSeats - occupiedCount} free</span>
      </div>

      <div className="flex-1 grid lg:grid-cols-[1fr_320px] gap-0 min-h-0 overflow-hidden">
        {/* Main scanner */}
        <main className="flex flex-col min-h-0 overflow-hidden px-5 py-3 lg:px-8">
          {/* Mode toggle */}
          <div className="flex justify-center mb-2 shrink-0">
            <div className="inline-flex bg-white/80 border border-[#f3ede4] rounded-full p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setMode("check-in");
                  resetToIdle();
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm transition-all ${
                  mode === "check-in"
                    ? "bg-[#e5a930] text-white shadow-md"
                    : "text-[#6b5e52] hover:text-[#2d2520]"
                }`}
              >
                <LogIn className="w-4 h-4" />
                Check In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("check-out");
                  resetToIdle();
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm transition-all ${
                  mode === "check-out"
                    ? "bg-[#2d2520] text-white shadow-md"
                    : "text-[#6b5e52] hover:text-[#2d2520]"
                }`}
              >
                <LogOut className="w-4 h-4" />
                Check Out
              </button>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {scanState === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="flex-1 flex flex-col items-center justify-center min-h-0 max-w-2xl mx-auto w-full"
              >
                <h2 className="text-xl sm:text-2xl text-center text-[#2d2520] mb-1 shrink-0 leading-tight">
                  {mode === "check-in" ? (
                    <>
                      Scan your <span className="text-[#e5a930]">QR pass</span> to enter
                    </>
                  ) : (
                    <>
                      Scan to <span className="text-[#2d2520]">check out</span>
                    </>
                  )}
                </h2>
                <p className="text-[#6b5e52] text-center text-xs sm:text-sm mb-2 max-w-md shrink-0">
                  {mode === "check-in"
                    ? "Hold your booking QR up to the scanner. Your seat activates automatically."
                    : "Scan the same QR when leaving to record your time out."}
                </p>

                {/* Scanner frame */}
                <div className="relative flex-1 w-full max-w-[min(100%,420px)] min-h-[220px] max-h-[min(44dvh,420px)] aspect-square mb-3">
                  <div className="absolute inset-0 rounded-3xl border-[3px] border-[#e5a930]/30" />
                  <motion.div
                    className="absolute inset-4 rounded-2xl border-[3px] border-dashed border-[#e5a930]"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm rounded-3xl m-6">
                    <ScanLine className="w-16 h-16 sm:w-20 sm:h-20 text-[#e5a930] mb-3" />
                    <QrCode className="w-24 h-24 sm:w-32 sm:h-32 text-[#6b5e52]/40" />
                    <motion.div
                      className="absolute left-8 right-8 h-1 bg-[#e5a930] shadow-[0_0_16px_#e5a930]"
                      animate={{ top: ["18%", "82%", "18%"] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                  <div className="absolute top-3 left-3 w-10 h-10 border-t-[5px] border-l-[5px] border-[#e5a930] rounded-tl-xl" />
                  <div className="absolute top-3 right-3 w-10 h-10 border-t-[5px] border-r-[5px] border-[#e5a930] rounded-tr-xl" />
                  <div className="absolute bottom-3 left-3 w-10 h-10 border-b-[5px] border-l-[5px] border-[#e5a930] rounded-bl-xl" />
                  <div className="absolute bottom-3 right-3 w-10 h-10 border-b-[5px] border-r-[5px] border-[#e5a930] rounded-br-xl" />
                </div>

                <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-1 shrink-0">
                  <label className="block text-[10px] sm:text-xs text-[#6b5e52] uppercase tracking-wider text-center">
                    Or enter booking ID manually
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                      placeholder="RES-XXXXXXXX"
                      className="flex-1 px-3 py-2.5 rounded-xl border border-[#f3ede4] bg-white text-[#2d2520] text-sm sm:text-base font-mono focus:outline-none focus:ring-2 focus:ring-[#e5a930] placeholder:text-[#6b5e52]/50"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      type="submit"
                      disabled={!codeInput.trim()}
                      className="px-4 py-2.5 bg-[#e5a930] text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm"
                    >
                      {mode === "check-in" ? "Enter" : "Exit"}
                    </button>
                  </div>
                </form>

                <p className="text-[10px] sm:text-xs text-[#6b5e52] mt-2 text-center shrink-0">
                  Demo codes:{" "}
                  <button
                    type="button"
                    onClick={() => processScan("RES-DEMO-VALID")}
                    className="text-[#e5a930] hover:underline"
                  >
                    RES-DEMO-VALID
                  </button>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => processScan("RES-DEMO-EXPIRED")}
                    className="text-[#e5a930] hover:underline"
                  >
                    expired
                  </button>
                  {" · "}
                  <button
                    type="button"
                    onClick={() => processScan("RES-DEMO-EARLY")}
                    className="text-[#e5a930] hover:underline"
                  >
                    early
                  </button>
                </p>
              </motion.div>
            )}

            {scanState === "scanning" && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center min-h-0"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  className="w-20 h-20 border-4 border-[#f3ede4] border-t-[#e5a930] rounded-full mb-6"
                />
                <p className="text-2xl sm:text-3xl text-[#2d2520]">Validating your pass…</p>
                <p className="text-lg sm:text-xl text-[#6b5e52] mt-2">Checking booking, payment, and schedule</p>
              </motion.div>
            )}

            {scanState === "success" && successBooking && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center min-h-0 max-w-lg mx-auto w-full text-center overflow-hidden px-2"
              >
                <div className="w-20 h-20 bg-[#dcfce7] rounded-full flex items-center justify-center mb-4 shrink-0">
                  <CheckCircle2 className="w-12 h-12 text-[#16a34a]" />
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl text-[#2d2520] mb-2 shrink-0">
                  {mode === "check-in" ? "Check-in successful" : "Check-out complete"}
                </h2>
                <p className="text-xl sm:text-2xl text-[#e5a930] mb-4 shrink-0">Welcome, {successBooking.guestName}</p>

                <div className="w-full bg-white/80 backdrop-blur-sm rounded-2xl border border-[#f3ede4] p-5 text-left space-y-3 mb-3 shrink-0">
                  <div className="flex justify-between items-center border-b border-[#f3ede4] pb-3">
                    <span className="text-sm text-[#6b5e52] uppercase tracking-wider">Seat</span>
                    <span className="text-2xl sm:text-3xl text-[#2d2520] font-medium">
                      {successBooking.seats.join(", ")}
                    </span>
                  </div>
                  {mode === "check-in" && (
                    <>
                      <div className="flex justify-between text-base sm:text-lg">
                        <span className="text-[#6b5e52]">Time in</span>
                        <span className="text-[#2d2520]">{formatTime(new Date())}</span>
                      </div>
                      <div className="flex justify-between text-base sm:text-lg">
                        <span className="text-[#6b5e52]">Scheduled end</span>
                        <span className="text-[#2d2520]">
                          {formatTime(successBooking.scheduledEnd)}
                        </span>
                      </div>
                      <div className="flex justify-between text-base sm:text-lg">
                        <span className="text-[#6b5e52]">Remaining</span>
                        <span className="text-[#e5a930] font-medium">
                          ~{getRemainingMinutes(successBooking.scheduledEnd.toISOString())} min
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-sm sm:text-base">
                    <span className="text-[#6b5e52]">Booking ID</span>
                    <span className="font-mono text-[#2d2520]">{successBooking.id}</span>
                  </div>
                </div>

                {mode === "check-in" && (
                  <div className="w-full bg-[#fef3dc]/60 rounded-xl p-4 text-left text-sm sm:text-base space-y-2 shrink-0">
                    <p className="text-[#6b5e52] uppercase tracking-wider text-xs sm:text-sm mb-1 font-medium">
                      Facility info
                    </p>
                    <div className="flex items-center gap-2 text-[#2d2520]">
                      <Wifi className="w-5 h-5 text-[#e5a930] shrink-0" />
                      WiFi: JIT-StudyHub · Ask staff for password
                    </div>
                    <div className="flex items-center gap-2 text-[#2d2520]">
                      <Coffee className="w-5 h-5 text-[#e5a930] shrink-0" />
                      Coffee & iced tea at the pantry
                    </div>
                    <div className="flex items-center gap-2 text-[#2d2520]">
                      <MapPin className="w-5 h-5 text-[#e5a930] shrink-0" />
                      Quiet zones — keep noise low
                    </div>
                  </div>
                )}

                <p className="text-sm sm:text-base text-[#6b5e52] mt-3 shrink-0">Returning to scanner…</p>
              </motion.div>
            )}

            {scanState === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col items-center justify-center min-h-0 max-w-lg mx-auto w-full text-center px-4"
              >
                <div className="w-20 h-20 bg-[#fee2e2] rounded-full flex items-center justify-center mb-5 shrink-0">
                  <XCircle className="w-12 h-12 text-[#dc2626]" />
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl text-[#2d2520] mb-3 shrink-0">{ERROR_MESSAGES[errorType].title}</h2>
                <p className="text-base sm:text-lg text-[#6b5e52] mb-6 leading-relaxed shrink-0 max-w-md">
                  {ERROR_MESSAGES[errorType].description}
                </p>
                <button
                  type="button"
                  onClick={resetToIdle}
                  className="px-8 py-4 bg-[#2d2520] text-white rounded-full hover:shadow-lg transition-all text-lg font-medium shrink-0"
                >
                  Try again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Side panel — live monitoring */}
        <aside className="hidden lg:flex border-l border-[#f3ede4] bg-white/50 backdrop-blur-sm p-4 lg:p-5 flex-col gap-3 min-h-0 overflow-hidden text-base">
          <div className="shrink-0">
            <p className="text-xs text-[#6b5e52] uppercase tracking-wider mb-2 font-medium">Live occupancy</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-[#f3ede4] p-3">
                <Users className="w-5 h-5 text-[#e5a930] mb-1.5" />
                <p className="text-2xl text-[#2d2520] leading-none">{occupiedCount}</p>
                <p className="text-xs text-[#6b5e52]">Checked in</p>
              </div>
              <div className="bg-white rounded-xl border border-[#f3ede4] p-3">
                <Armchair className="w-5 h-5 text-[#e5a930] mb-1.5" />
                <p className="text-2xl text-[#2d2520] leading-none">
                  {Math.round((occupiedCount / totalSeats) * 100)}%
                </p>
                <p className="text-xs text-[#6b5e52]">Capacity</p>
              </div>
            </div>
            <div className="mt-2 h-2 bg-[#f3ede4] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#e5a930] rounded-full"
                initial={false}
                animate={{ width: `${(occupiedCount / totalSeats) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-sm text-[#6b5e52] mt-1.5">
              {totalSeats - occupiedCount} seats available
            </p>
          </div>

          <div className="shrink-0 min-h-0">
            <p className="text-xs text-[#6b5e52] uppercase tracking-wider mb-2 flex items-center gap-2 font-medium">
              <Clock className="w-4 h-4" />
              Active sessions
            </p>
            {sessions.length === 0 ? (
              <p className="text-sm text-[#6b5e52] bg-[#fef3dc]/40 rounded-lg p-3 border border-[#f3ede4]">
                No active check-ins.
              </p>
            ) : (
              <ul className="space-y-2">
                {visibleSessions.map((s) => (
                  <li
                    key={s.bookingId}
                    className="bg-white rounded-lg border border-[#f3ede4] p-3 text-sm"
                  >
                    <p className="text-[#2d2520] font-medium truncate text-base">{s.guestName}</p>
                    <p className="text-[#6b5e52] text-xs">
                      {s.seats.join(", ")} · {getRemainingMinutes(s.scheduledEnd)} min left
                    </p>
                  </li>
                ))}
                {sessions.length > 3 && (
                  <p className="text-xs text-[#6b5e52]">+{sessions.length - 3} more</p>
                )}
              </ul>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <p className="text-xs text-[#6b5e52] uppercase tracking-wider mb-2 font-medium">Recent activity</p>
            {activity.length === 0 ? (
              <p className="text-sm text-[#6b5e52]">Activity appears after scans.</p>
            ) : (
              <ul className="space-y-2">
                {recentActivity.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start gap-2 text-sm border-b border-[#f3ede4]/80 pb-2 last:border-0"
                  >
                    {a.type === "check-in" ? (
                      <LogIn className="w-4 h-4 text-[#16a34a] shrink-0 mt-0.5" />
                    ) : (
                      <LogOut className="w-4 h-4 text-[#6b5e52] shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[#2d2520] truncate text-base">
                        {a.guestName}{" "}
                        <span className="text-[#6b5e52]">
                          {a.type === "check-in" ? "arrived" : "left"}
                        </span>
                      </p>
                      <p className="text-xs text-[#6b5e52]">
                        {a.seats.join(", ")} ·{" "}
                        {new Date(a.timestamp).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-l-4 border-[#e5a930] bg-[#fef3dc]/40 rounded-r-lg p-3 shrink-0">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-[#e5a930] shrink-0" />
              <div className="text-sm">
                <p className="text-[#2d2520] font-medium mb-1 text-base">Need help?</p>
                <p className="text-[#6b5e52] leading-snug">
                  Ask staff at the cashier or email{" "}
                  <span className="text-[#e5a930]">jit.studyhub@gmail.com</span>
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Flow strip */}
      <footer className="border-t border-[#f3ede4] bg-white/60 px-5 py-2 shrink-0">
        <p className="text-xs sm:text-sm text-[#6b5e52] text-center truncate">
          Booking → QR → Arrival → Scan → Check-in → Monitoring → Check-out → Analytics
        </p>
      </footer>
    </div>
  );
}
