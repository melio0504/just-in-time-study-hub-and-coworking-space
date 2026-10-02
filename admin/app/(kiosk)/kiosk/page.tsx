"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import {
  QrCode,
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
import { CameraQrScanner } from "./CameraQrScanner";
import { createClient } from "@/lib/supabase/client";

type KioskAction = "check-in" | "check-out";
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
  | "not_yet_scheduled"
  | "confirmation_pending"
  | "server";

const ERROR_MESSAGES: Record<ValidationError, { title: string; description: string }> = {
  invalid: {
    title: "Invalid QR Code",
    description: "This code is not recognized. Please use the QR from your booking confirmation email.",
  },
  expired: {
    title: "Booking Expired",
    description: "Your reservation window has ended. Please book a new session at the front desk or online.",
  },
  not_yet_scheduled: {
    title: "Not Yet Scheduled",
    description: "Your booking is not active yet. Please return within 15 minutes of your start time.",
  },
  confirmation_pending: {
    title: "Reservation Not Confirmed",
    description: "Confirm the reservation first, then scan the access QR again to check in.",
  },
  server: {
    title: "Pass could not be processed",
    description: "Ask a staff member to verify this reservation.",
  },
};

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

export default function KioskPage() {
  // Keep the server render and the first client render identical. The live
  // value is filled in after hydration so crossing a second boundary cannot
  // produce different text on the server and client.
  const [now, setNow] = useState<Date | null>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [errorType, setErrorType] = useState<ValidationError>("invalid");
  const [successBooking, setSuccessBooking] = useState<Booking | null>(null);
  const [lastAction, setLastAction] = useState<KioskAction | null>(null);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [serverError, setServerError] = useState('');

  const totalSeats = 50;
  const occupiedCount = sessions.reduce((count, session) => count + session.seats.length, 0);

  useEffect(() => {
    const initialTick = window.setTimeout(() => setNow(new Date()), 0);
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearTimeout(initialTick);
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadActiveSessions = async () => {
      const { data } = await createClient()
        .from('check_in_sessions')
        .select('booking_id, checked_in_at, scheduled_end_at, booking:bookings(reservation_code, guest_name, seat_ids)')
        .eq('status', 'checked_in')
        .order('checked_in_at', { ascending: false });
      if (cancelled || !data) return;
      setSessions(data.flatMap((row) => {
        const booking = row.booking as unknown as { reservation_code: string; guest_name: string; seat_ids: string[] } | null;
        return booking ? [{
          bookingId: booking.reservation_code,
          guestName: booking.guest_name,
          seats: booking.seat_ids,
          checkedInAt: row.checked_in_at,
          scheduledEnd: row.scheduled_end_at,
        }] : [];
      }));
    };
    void loadActiveSessions();
    return () => { cancelled = true; };
  }, []);

  const addActivity = useCallback(
    (entry: Omit<ActivityEntry, "id" | "timestamp">) => {
      const item: ActivityEntry = {
        ...entry,
        id: `${Date.now()}`,
        timestamp: new Date().toISOString(),
      };
      setActivity((current) => [item, ...current].slice(0, 12));
    },
    []
  );

  const resetToIdle = useCallback(() => {
    setScanState("idle");
    setSuccessBooking(null);
    setLastAction(null);
  }, []);

  const processScan = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) return;

      setScanState("scanning");
      setServerError('');

      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke('scan-booking-pass', { body: { code } });
      if (error || data?.error || !data?.result) {
        let message = typeof data?.error === 'string' ? data.error : error?.message ?? 'The QR pass could not be processed.';
        const response = (error as { context?: Response } | null)?.context;
        if (response) {
          const payload = await response.clone().json().catch(() => null);
          if (typeof payload?.error === 'string') message = payload.error;
        }
        const lower = message.toLowerCase();
        setErrorType(lower.includes('not been confirmed') ? 'confirmation_pending' : lower.includes('expired') ? 'expired' : lower.includes('not ready') ? 'not_yet_scheduled' : lower.includes('invalid') || lower.includes('used') ? 'invalid' : 'server');
        setServerError(message);
        setScanState('error');
        return;
      }

      const result = data.result as {
        action: KioskAction;
        reservation_code: string;
        guest_name: string;
        seat_ids: string[];
        scheduled_start: string;
        scheduled_end: string;
        scanned_at: string;
      };
      const booking: Booking = {
        id: result.reservation_code,
        guestName: result.guest_name,
        seats: result.seat_ids,
        date: result.scheduled_start.slice(0, 10),
        timeIn: formatTime(new Date(result.scheduled_start)),
        durationHours: Math.max(1, Math.round((new Date(result.scheduled_end).getTime() - new Date(result.scheduled_start).getTime()) / 3_600_000)),
        paymentConfirmed: true,
        scheduledStart: new Date(result.scheduled_start),
        scheduledEnd: new Date(result.scheduled_end),
      };

      if (result.action === 'check-in') {
        setSessions((current) => [...current.filter((session) => session.bookingId !== booking.id), {
          bookingId: booking.id,
          guestName: booking.guestName,
          seats: booking.seats,
          checkedInAt: result.scanned_at,
          scheduledEnd: result.scheduled_end,
        }]);
      } else {
        setSessions((current) => current.filter((session) => session.bookingId !== booking.id));
      }
      addActivity({ type: result.action, guestName: booking.guestName, seats: booking.seats });
      setLastAction(result.action);
      setSuccessBooking(booking);
      setScanState('success');
      window.setTimeout(resetToIdle, result.action === 'check-in' ? 8000 : 6000);
    },
    [addActivity, resetToIdle]
  );

  const todayLabel = useMemo(
    () =>
      now?.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }) ?? "",
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
            loading="eager"
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
            {now ? formatClock(now) : "--:--:-- --"}
          </p>
          <p className="min-h-[1.25rem] text-xs sm:text-sm text-[#6b5e52] hidden sm:block">
            {todayLabel}
          </p>
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
                  Scan your <span className="text-[#e5a930]">QR pass</span>
                </h2>
                <p className="text-[#6b5e52] text-center text-xs sm:text-sm mb-2 max-w-md shrink-0">
                  Hold your booking QR in front of the camera. The kiosk automatically checks you in or out.
                </p>

                <CameraQrScanner onScan={processScan} />
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
                  {lastAction === "check-out" ? "Check-out complete" : "Check-in successful"}
                </h2>
                <p className="text-xl sm:text-2xl text-[#e5a930] mb-4 shrink-0">
                  {lastAction === "check-out" ? "Thank you" : "Welcome"}, {successBooking.guestName}
                </p>

                <div className="w-full bg-white/80 backdrop-blur-sm rounded-2xl border border-[#f3ede4] p-5 text-left space-y-3 mb-3 shrink-0">
                  <div className="flex justify-between items-center border-b border-[#f3ede4] pb-3">
                    <span className="text-sm text-[#6b5e52] uppercase tracking-wider">Seat</span>
                    <span className="text-2xl sm:text-3xl text-[#2d2520] font-medium">
                      {successBooking.seats.join(", ")}
                    </span>
                  </div>
                  {lastAction === "check-in" && (
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

                {lastAction === "check-in" && (
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
                  {serverError || ERROR_MESSAGES[errorType].description}
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
          Booking → QR → Camera scan → Automatic check-in or check-out → Analytics
        </p>
      </footer>
    </div>
  );
}
