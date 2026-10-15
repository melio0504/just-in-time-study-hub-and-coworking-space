"use client";

import Image from "next/image";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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

type KioskAction = "check-in" | "check-out";
type ScanState = "idle" | "scanning" | "success" | "error";
const ERROR_DISPLAY_SECONDS = 5;

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
  | "access"
  | "invalid"
  | "expired"
  | "not_yet_scheduled"
  | "confirmation_pending"
  | "server";

const ERROR_MESSAGES: Record<ValidationError, { title: string; description: string }> = {
  access: {
    title: "Kiosk unavailable",
    description: "Ask a staff member to check the kiosk service, then scan the pass again.",
  },
  invalid: {
    title: "Invalid QR Code",
    description: "This code is not recognized. Please use the QR from your booking confirmation email.",
  },
  expired: {
    title: "Booking Expired",
    description: "Your reservation window has ended. Please book a new session at the front desk or online.",
  },
  not_yet_scheduled: {
    title: "Check-in Not Open Yet",
    description: "Check-in opens 15 minutes before your reservation and remains available until it ends.",
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

function getGuestErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  return message.replace(
    /^Error invoking remote method '[^']+': Error:\s*/i,
    "",
  );
}

export function KioskScanner() {
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
  const [errorSecondsRemaining, setErrorSecondsRemaining] = useState(ERROR_DISPLAY_SECONDS);
  const successSoundRef = useRef<HTMLAudioElement>(null);
  const errorSoundRef = useRef<HTMLAudioElement>(null);

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
      const desktop = window.kioskDesktop;
      if (!desktop) return;

      try {
        const response = await desktop.getActiveSessions();
        if (!cancelled) {
          setSessions(response.sessions);
          setActivity(response.activity ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setServerError(getGuestErrorMessage(error, "The kiosk service is unavailable."));
        }
      }
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

  useEffect(() => {
    if (scanState !== "error") return;

    const countdown = window.setInterval(() => {
      setErrorSecondsRemaining((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    const resumeScanner = window.setTimeout(resetToIdle, ERROR_DISPLAY_SECONDS * 1000);

    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(resumeScanner);
    };
  }, [resetToIdle, scanState]);

  useEffect(() => {
    const sound = scanState === "success"
      ? successSoundRef.current
      : scanState === "error"
        ? errorSoundRef.current
        : null;
    if (!sound) return;

    sound.currentTime = 0;
    void sound.play().catch(() => undefined);
  }, [scanState]);

  const processScan = useCallback(
    async (rawCode: string) => {
      const code = rawCode.trim();
      if (!code) return;

      setScanState("scanning");
      setServerError('');

      const desktop = window.kioskDesktop;
      if (!desktop) {
        setErrorType('access');
        setServerError('QR scanning is available in the installed desktop kiosk.');
        setErrorSecondsRemaining(ERROR_DISPLAY_SECONDS);
        setScanState('error');
        return;
      }

      let data: KioskScanResponse;
      try {
        data = await desktop.scanBookingPass(code);
      } catch (error) {
        const message = getGuestErrorMessage(error, 'The QR pass could not be processed.');
        const lower = message.toLowerCase();
        const accessError = lower.includes('kiosk service') || lower.includes('credential') || lower.includes('configured');
        setErrorType(accessError ? 'access' : lower.includes('not been confirmed') ? 'confirmation_pending' : lower.includes('expired') ? 'expired' : lower.includes('not ready') || lower.includes('check-in opens') ? 'not_yet_scheduled' : lower.includes('invalid') || lower.includes('used') ? 'invalid' : 'server');
        setServerError(message);
        setErrorSecondsRemaining(ERROR_DISPLAY_SECONDS);
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
    <div className="flex h-dvh min-h-dvh w-full flex-col overflow-hidden bg-gradient-to-br from-[#fffcf7] via-[#fff8ed] to-[#fef3dc]">
      <audio ref={successSoundRef} src="/audio/success.mp3" preload="auto" aria-hidden="true" />
      <audio ref={errorSoundRef} src="/audio/error.mp3" preload="auto" aria-hidden="true" />

      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#f3ede4] bg-white/80 px-3 py-2 backdrop-blur-md sm:gap-4 sm:px-5 sm:py-3 xl:px-7">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Image
            src="/logo.png"
            alt="Just In Time Study Hub and Coworking Space"
            width={245}
            height={118}
            priority
            unoptimized
            className="h-12 w-auto shrink-0 object-contain sm:h-14 xl:h-16"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b47b0d] sm:text-sm">
              Facility Kiosk
            </p>
            <h1 className="hidden truncate text-lg text-[#2d2520] sm:block xl:text-xl">QR check-in &amp; check-out</h1>
          </div>
        </div>

        <div className="hidden 2xl:flex items-center gap-5 shrink-0">
          {features.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-base text-[#6b5e52]">
              <div className="w-9 h-9 bg-[#fef3dc] rounded-lg flex items-center justify-center">
                <Icon className="w-4 h-4 text-[#e5a930]" />
              </div>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="flex shrink-0 items-center">
          <div className="text-right">
            <p className="font-mono text-2xl leading-tight tabular-nums text-[#2d2520] sm:text-3xl xl:text-4xl">
              {now ? formatClock(now) : "--:--:-- --"}
            </p>
            <p className="hidden min-h-[1.25rem] text-sm text-[#6b5e52] sm:block sm:text-base">
              {todayLabel}
            </p>
          </div>
        </div>
      </header>

      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#f3ede4] bg-white/50 px-4 py-2 text-base lg:hidden sm:px-5 sm:py-2.5 sm:text-lg">
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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Main scanner */}
        <main className="flex min-h-0 flex-col overflow-hidden px-4 py-3 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <AnimatePresence mode="wait">
            {scanState === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col items-center justify-center"
              >
                <h2 className="mb-1 shrink-0 text-center text-2xl leading-tight text-[#2d2520] sm:text-3xl">
                  Scan your <span className="text-[#e5a930]">QR pass</span>
                </h2>
                <p className="mb-3 max-w-xl shrink-0 text-center text-base text-[#6b5e52] sm:text-lg">
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
                className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col items-center justify-center overflow-y-auto px-2 py-3 text-center"
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
                    <span className="text-base uppercase tracking-wider text-[#6b5e52]">Seat</span>
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
                  <div className="flex justify-between text-base sm:text-lg">
                    <span className="text-[#6b5e52]">Booking ID</span>
                    <span className="font-mono text-[#2d2520]">{successBooking.id}</span>
                  </div>
                </div>

                {lastAction === "check-in" && (
                  <div className="w-full shrink-0 space-y-2 rounded-xl bg-[#fef3dc]/60 p-4 text-left text-base sm:text-lg">
                    <p className="mb-1 text-sm font-medium uppercase tracking-wider text-[#6b5e52] sm:text-base">
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

                <p className="mt-3 shrink-0 text-base text-[#6b5e52] sm:text-lg">Returning to scanner…</p>
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
                <p className="mb-6 max-w-lg shrink-0 text-lg leading-relaxed text-[#6b5e52] sm:text-xl">
                  {serverError || ERROR_MESSAGES[errorType].description}
                </p>
                <p className="shrink-0 text-base font-medium text-[#2d2520] sm:text-lg" aria-live="polite">
                  Scanner resuming in {errorSecondsRemaining}{" "}
                  {errorSecondsRemaining === 1 ? "second" : "seconds"}…
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Side panel — live monitoring */}
        <aside className="hidden min-h-0 flex-col gap-3 overflow-y-auto border-l border-[#f3ede4] bg-white/50 p-4 text-base backdrop-blur-sm lg:flex xl:p-5 2xl:p-6">
          <div className="shrink-0">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-[#6b5e52]">Live occupancy</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-[#f3ede4] p-3">
                <Users className="w-5 h-5 text-[#e5a930] mb-1.5" />
                <p className="text-3xl leading-none text-[#2d2520]">{occupiedCount}</p>
                <p className="text-sm text-[#6b5e52]">Checked in</p>
              </div>
              <div className="bg-white rounded-xl border border-[#f3ede4] p-3">
                <Armchair className="w-5 h-5 text-[#e5a930] mb-1.5" />
                <p className="text-3xl leading-none text-[#2d2520]">
                  {Math.round((occupiedCount / totalSeats) * 100)}%
                </p>
                <p className="text-sm text-[#6b5e52]">Capacity</p>
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
            <p className="mt-1.5 text-base text-[#6b5e52]">
              {totalSeats - occupiedCount} seats available
            </p>
          </div>

          <div className="shrink-0 min-h-0">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#6b5e52]">
              <Clock className="w-4 h-4" />
              Active sessions
            </p>
            {sessions.length === 0 ? (
              <p className="rounded-lg border border-[#f3ede4] bg-[#fef3dc]/40 p-3 text-base text-[#6b5e52]">
                No active check-ins.
              </p>
            ) : (
              <ul className="space-y-2">
                {visibleSessions.map((s) => (
                  <li
                    key={s.bookingId}
                    className="rounded-lg border border-[#f3ede4] bg-white p-3 text-base"
                  >
                    <p className="truncate text-lg font-medium text-[#2d2520]">{s.guestName}</p>
                    <p className="text-sm text-[#6b5e52]">
                      {s.seats.join(", ")} · {getRemainingMinutes(s.scheduledEnd)} min left
                    </p>
                  </li>
                ))}
                {sessions.length > 3 && (
                  <p className="text-sm text-[#6b5e52]">+{sessions.length - 3} more</p>
                )}
              </ul>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-[#6b5e52]">Recent activity</p>
            {activity.length === 0 ? (
              <p className="text-base text-[#6b5e52]">Activity appears after scans.</p>
            ) : (
              <ul className="space-y-2">
                {recentActivity.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-start gap-2 border-b border-[#f3ede4]/80 pb-2 text-base last:border-0"
                  >
                    {a.type === "check-in" ? (
                      <LogIn className="w-4 h-4 text-[#16a34a] shrink-0 mt-0.5" />
                    ) : (
                      <LogOut className="w-4 h-4 text-[#6b5e52] shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-lg text-[#2d2520]">
                        {a.guestName}{" "}
                        <span className="text-[#6b5e52]">
                          {a.type === "check-in" ? "arrived" : "left"}
                        </span>
                      </p>
                      <p className="text-sm text-[#6b5e52]">
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
              <div className="text-base">
                <p className="mb-1 text-lg font-medium text-[#2d2520]">Need help?</p>
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
      <footer className="shrink-0 border-t border-[#f3ede4] bg-white/60 px-5 py-2 [@media(max-height:700px)]:hidden">
        <p className="truncate text-center text-sm text-[#6b5e52] sm:text-base">
          Booking → QR → Camera scan → Automatic check-in or check-out → Analytics
        </p>
      </footer>
    </div>
  );
}
