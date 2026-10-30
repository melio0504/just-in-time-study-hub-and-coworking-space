"use client";

import { FunctionsHttpError } from "@supabase/supabase-js";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  QrCode,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { SeatingPlan } from "@/app/components/SeatingPlan";
import {
  type BookingSettings,
  type BusinessClosure,
  type BusinessHours,
  closureForDate,
  DEFAULT_BOOKING_SETTINGS,
  formatHoursRange,
  formatTime,
  hoursAvailableFrom,
  isClosureDate,
  isRegularlyClosedDate,
  maximumBookingDate,
  meetsMinimumNotice,
  reservationDateForTime,
  reservationTimeOptions,
} from "@/lib/business-config";
import { formatCountdown, getCountdownSeconds } from "@/lib/paymentCountdown";
import { getManilaDateString, isReservationTimePast } from "@/lib/reservationTime";
import {
  getReservationAvailabilityWindow,
  SEAT_AVAILABILITY_REFRESH_MS,
} from "@/lib/seatAvailability";
import { allSeatIds } from "@/lib/seats";
import { cancelBooking, createBooking } from "@/lib/supabase/bookings";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ReservationSelect } from "./_components/ReservationSelect";

type SeatStatus = "available" | "reserved" | "selected";

interface Seat {
  id: string;
  status: SeatStatus;
}

interface MemberIdentity {
  name: string;
  email: string;
}

interface ReservationDraft {
  date: string;
  time: string;
  duration: string;
  seatIds: string[];
}

const RESERVATION_DRAFT_KEY = "jit-reservation-draft";
const getDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isPastDate = (date: Date) => getDateString(date) < getManilaDateString();

function ReserveContent() {
  const searchParams = useSearchParams();
  const requestedSeatParam = searchParams.get("seats") ?? searchParams.get("seat");
  const requestedDateParam = searchParams.get("date");
  const shouldFocusSchedule = searchParams.get("focus") === "schedule";
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    date: getManilaDateString(),
    time: "",
    duration: "",
    space: "",
  });

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const calendarRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const timeSelectRef = useRef<HTMLButtonElement>(null);
  const paymentModalCloseRef = useRef<HTMLButtonElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmationStep, setConfirmationStep] = useState<"pending" | "success">("pending");
  const [reservationId, setReservationId] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [subtotalCents, setSubtotalCents] = useState(0);
  const [confirmationQr, setConfirmationQr] = useState("");
  const [qrExpiresAt, setQrExpiresAt] = useState("");
  const [qrCountdownNow, setQrCountdownNow] = useState(0);
  const [confirmationError, setConfirmationError] = useState("");
  const [cancellationError, setCancellationError] = useState("");
  const [isConfirmationLoading, setIsConfirmationLoading] = useState(false);
  const [isCancellingReservation, setIsCancellingReservation] = useState(false);
  const [isConfirmationEmailSent, setIsConfirmationEmailSent] = useState(false);
  const [emailDeliveryError, setEmailDeliveryError] = useState("");
  const [lastSelectedSeats, setLastSelectedSeats] = useState<string[]>([]);
  const [bookingError, setBookingError] = useState("");
  const [availabilityError, setAvailabilityError] = useState("");
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(isSupabaseConfigured);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberIdentity, setMemberIdentity] = useState<MemberIdentity | null>(null);
  const [isIdentityLoading, setIsIdentityLoading] = useState(isSupabaseConfigured);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([]);
  const [closures, setClosures] = useState<BusinessClosure[]>([]);
  const [bookingSettings, setBookingSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS);
  const [configurationLoading, setConfigurationLoading] = useState(isSupabaseConfigured);
  const [configurationError, setConfigurationError] = useState("");
  const qrRequestVersionRef = useRef(0);
  const paymentSuccessSoundRef = useRef<HTMLAudioElement>(null);
  const soundedBookingIdRef = useRef("");
  const reservationControlsDisabled = isIdentityLoading || !memberIdentity;

  const initializeSeats = useCallback((_date: string, selectedSeats: string[] = []): Seat[] => {
    return allSeatIds.map((id) => ({
      id,
      status: selectedSeats.includes(id) ? "selected" : "available",
    }));
  }, []);

  const [seats, setSeats] = useState<Seat[]>(initializeSeats(getManilaDateString()));

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }
    let cancelled = false;
    const loadConfiguration = async () => {
      const supabase = createClient();
      const [hoursResult, closureResult, settingsResult] = await Promise.all([
        supabase.from("business_hours").select().order("day_of_week"),
        supabase
          .from("business_closures")
          .select("id, name, starts_on, ends_on, closure_type, is_active")
          .eq("is_active", true),
        supabase
          .from("booking_settings")
          .select(
            "max_seats_per_booking, min_duration_hours, max_duration_hours, minimum_notice_minutes, maximum_advance_days",
          )
          .eq("singleton", true)
          .single(),
      ]);
      if (cancelled) return;
      const error = hoursResult.error || closureResult.error || settingsResult.error;
      setConfigurationError(
        error ? `Unable to load booking hours and limits: ${error.message}` : "",
      );
      setBusinessHours(hoursResult.data ?? []);
      setClosures(closureResult.data ?? []);
      if (settingsResult.data) setBookingSettings(settingsResult.data);
      setConfigurationLoading(false);
    };
    void loadConfiguration();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const updateCurrentTime = () => {
      const now = new Date();
      setCurrentTime(now);
      setFormData((current) => {
        const bookingDate = reservationDateForTime(current.date, current.time, businessHours);
        if (
          !current.time ||
          meetsMinimumNotice(bookingDate, current.time, bookingSettings.minimum_notice_minutes, now)
        ) {
          return current;
        }

        return { ...current, time: "", duration: "" };
      });
    };
    const refreshInterval = window.setInterval(updateCurrentTime, 30_000);
    window.addEventListener("focus", updateCurrentTime);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", updateCurrentTime);
    };
  }, [bookingSettings.minimum_notice_minutes, businessHours]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    const loadMemberIdentity = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setMemberIdentity(null);
          setIsIdentityLoading(false);
        }
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const email = user.email ?? "";
      const metadataName =
        typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name.trim() : "";
      const name = profile?.full_name.trim() || metadataName || email.split("@")[0] || "Member";

      if (!cancelled) {
        setMemberIdentity({ name, email });
        setFormData((current) => ({ ...current, name, email }));
        setIsIdentityLoading(false);
      }
    };

    void loadMemberIdentity();

    return () => {
      cancelled = true;
    };
  }, []);

  const finishCancelledBooking = () => {
    qrRequestVersionRef.current += 1;
    setIsModalOpen(false);
    setConfirmationStep("pending");
    setBookingId("");
    setReservationId("");
    setSubtotalCents(0);
    setConfirmationQr("");
    setQrExpiresAt("");
    setQrCountdownNow(0);
    setConfirmationError("");
    setCancellationError("");
    setIsConfirmationLoading(false);
    setIsConfirmationEmailSent(false);
    setEmailDeliveryError("");
    setSeats((currentSeats) =>
      currentSeats.map((seat) =>
        lastSelectedSeats.includes(seat.id) ? { ...seat, status: "available" } : seat,
      ),
    );
    setLastSelectedSeats([]);
  };

  const closePaymentModal = async () => {
    if (confirmationStep === "success" || !bookingId) {
      setIsModalOpen(false);
      setConfirmationStep("pending");
      return;
    }
    if (isCancellingReservation) return;

    setIsCancellingReservation(true);
    setCancellationError("");
    try {
      await cancelBooking(bookingId);
      finishCancelledBooking();
    } catch (error) {
      const supabase = createClient();
      const { data } = await supabase
        .from("bookings")
        .select("status")
        .eq("id", bookingId)
        .single();

      if (data?.status === "confirmed") {
        setConfirmationStep("success");
        setConfirmationError("");
      } else if (data?.status === "cancelled") {
        finishCancelledBooking();
      } else {
        setCancellationError(
          error instanceof Error
            ? error.message
            : "Unable to cancel this reservation. Please try again.",
        );
      }
    } finally {
      setIsCancellingReservation(false);
    }
  };

  useEffect(() => {
    if (!isModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      paymentModalCloseRef.current?.click();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [isModalOpen]);

  useEffect(() => {
    if (!bookingId || !isModalOpen) return;

    const supabase = createClient();
    const handleBooking = (booking: {
      status?: string;
      confirmation_email_sent_at?: string | null;
      confirmation_email_error?: string | null;
    }) => {
      if (booking.status === "confirmed") {
        setConfirmationStep("success");
        setConfirmationError("");
        setSeats((currentSeats) =>
          currentSeats.map((seat) =>
            seat.status === "selected" ? { ...seat, status: "reserved" } : seat,
          ),
        );
        window.localStorage.removeItem(RESERVATION_DRAFT_KEY);
      } else if (booking.status === "declined") {
        setConfirmationError(
          "The QR Ph code expired or the payment failed. Please create a new reservation.",
        );
      }
      setIsConfirmationEmailSent(Boolean(booking.confirmation_email_sent_at));
      setEmailDeliveryError(booking.confirmation_email_error ?? "");
    };

    const channel = supabase
      .channel(`booking-confirmation-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        (payload) =>
          handleBooking(
            payload.new as {
              status?: string;
              confirmation_email_sent_at?: string | null;
              confirmation_email_error?: string | null;
            },
          ),
      )
      .subscribe();

    void supabase
      .from("bookings")
      .select("status, confirmation_email_sent_at, confirmation_email_error")
      .eq("id", bookingId)
      .single()
      .then(({ data }) => {
        if (data) handleBooking(data);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [bookingId, isModalOpen]);

  useEffect(() => {
    if (!qrExpiresAt || !isModalOpen || confirmationStep !== "pending") return;

    const updateCountdown = () => setQrCountdownNow(Date.now());
    const countdownInterval = window.setInterval(updateCountdown, 1000);
    window.addEventListener("focus", updateCountdown);

    return () => {
      window.clearInterval(countdownInterval);
      window.removeEventListener("focus", updateCountdown);
    };
  }, [confirmationStep, isModalOpen, qrExpiresAt]);

  useEffect(() => {
    if (confirmationStep !== "success" || !bookingId || soundedBookingIdRef.current === bookingId) {
      return;
    }

    soundedBookingIdRef.current = bookingId;
    const sound = paymentSuccessSoundRef.current;
    if (!sound) return;

    sound.currentTime = 0;
    void sound.play().catch(() => undefined);
  }, [bookingId, confirmationStep]);

  const createPaymongoQr = async (id: string) => {
    const requestVersion = ++qrRequestVersionRef.current;
    setIsConfirmationLoading(true);
    setConfirmationError("");
    setCancellationError("");
    setConfirmationQr("");
    setQrExpiresAt("");
    setQrCountdownNow(0);
    setIsConfirmationEmailSent(false);
    setEmailDeliveryError("");

    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("create-paymongo-qr", {
        body: { bookingId: id },
      });
      if (error) {
        let message = error.message;
        if (error instanceof FunctionsHttpError) {
          const payload = await error.context.json().catch(() => null);
          if (typeof payload?.error === "string") message = payload.error;
        }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      if (typeof data?.qrImage !== "string" || typeof data?.expiresAt !== "string") {
        throw new Error("PayMongo did not return a QR Ph code.");
      }
      if (requestVersion === qrRequestVersionRef.current) {
        setConfirmationQr(data.qrImage);
        setQrExpiresAt(data.expiresAt);
        setQrCountdownNow(Date.now());
      }
    } catch (error) {
      if (requestVersion === qrRequestVersionRef.current) {
        setConfirmationError(error instanceof Error ? error.message : "Unable to generate QR Ph.");
      }
    } finally {
      if (requestVersion === qrRequestVersionRef.current) {
        setIsConfirmationLoading(false);
      }
    }
  };

  const formatTimeLabel = (time: string) => {
    return time ? formatTime(time) : "";
  };

  const formatReservationTimeRange = (startTime: string, durationHours: string) => {
    if (!startTime || !durationHours) return "";
    const [startHour, startMinute] = startTime.slice(0, 5).split(":").map(Number);
    const absoluteEndMinutes = startHour * 60 + startMinute + Number(durationHours) * 60;
    const endMinutes = absoluteEndMinutes % 1440;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
    const nextDayLabel = absoluteEndMinutes >= 1440 ? " (Next Day)" : "";
    return `${formatTimeLabel(startTime)} - ${formatTimeLabel(endTime)}${nextDayLabel}`;
  };

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(cents / 100);

  useEffect(() => {
    if (!hasRestoredDraft || !formData.date) return;
    let cancelled = false;
    const loadAvailability = async () => {
      setIsAvailabilityLoading(true);
      setAvailabilityError("");
      const bookingDate =
        formData.time && formData.duration
          ? reservationDateForTime(formData.date, formData.time, businessHours)
          : formData.date;
      const { startsAt, endsAt } = getReservationAvailabilityWindow(
        bookingDate,
        formData.time,
        formData.duration,
      );
      const { data, error } = await createClient().rpc("get_available_seats", {
        p_starts_at: startsAt,
        p_ends_at: endsAt,
      });
      if (cancelled) return;
      if (error) {
        setAvailabilityError(`Unable to refresh seat availability: ${error.message}`);
        setIsAvailabilityLoading(false);
        return;
      }
      const available = new Set((data ?? []).map((seat) => seat.code));
      setSeats((currentSeats) => {
        const selected = new Set(
          currentSeats.filter((seat) => seat.status === "selected").map((seat) => seat.id),
        );

        return allSeatIds.map((id) => ({
          id,
          status: available.has(id) ? (selected.has(id) ? "selected" : "available") : "reserved",
        }));
      });
      setIsAvailabilityLoading(false);
    };
    const refreshAvailability = () => void loadAvailability();
    const refreshInterval = window.setInterval(refreshAvailability, SEAT_AVAILABILITY_REFRESH_MS);
    window.addEventListener("focus", refreshAvailability);

    void loadAvailability();
    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshAvailability);
    };
  }, [businessHours, formData.date, formData.duration, formData.time, hasRestoredDraft]);

  useEffect(() => {
    if (configurationLoading || isIdentityLoading) return;
    const restoreDraft = window.setTimeout(() => {
      let date = getManilaDateString();
      let time = "";
      let duration = "";
      let seatIds: string[] = [];

      try {
        const storedDraft = window.localStorage.getItem(RESERVATION_DRAFT_KEY);
        if (storedDraft) {
          const draft = JSON.parse(storedDraft) as Partial<ReservationDraft>;
          const parsedDate =
            typeof draft.date === "string" ? new Date(`${draft.date}T00:00:00`) : null;
          date =
            parsedDate && !Number.isNaN(parsedDate.getTime()) && !isPastDate(parsedDate)
              ? (draft.date as string)
              : date;
          time =
            typeof draft.time === "string" && /^([01]\d|2[0-3]):00$/.test(draft.time)
              ? draft.time
              : "";
          duration =
            typeof draft.duration === "string" &&
            Number.isInteger(Number(draft.duration)) &&
            Number(draft.duration) >= 1 &&
            Number(draft.duration) <= 24
              ? draft.duration
              : "";
          seatIds = Array.isArray(draft.seatIds)
            ? draft.seatIds
                .filter(
                  (seatId): seatId is string =>
                    typeof seatId === "string" && allSeatIds.includes(seatId),
                )
                .slice(0, bookingSettings.max_seats_per_booking)
            : [];

          const bookingDate = reservationDateForTime(date, time, businessHours);
          if (time && isReservationTimePast(bookingDate, time)) {
            time = "";
            duration = "";
          }
        }
      } catch {
        window.localStorage.removeItem(RESERVATION_DRAFT_KEY);
      }

      const requestedSeats = requestedSeatParam
        ? Array.from(
            new Set(
              requestedSeatParam
                .split(",")
                .map((seat) => seat.trim().toUpperCase())
                .filter((seat) => allSeatIds.includes(seat)),
            ),
          ).slice(0, bookingSettings.max_seats_per_booking)
        : [];
      const parsedRequestedDate =
        requestedDateParam && /^\d{4}-\d{2}-\d{2}$/.test(requestedDateParam)
          ? new Date(`${requestedDateParam}T00:00:00`)
          : null;

      if (requestedSeats.length > 0) {
        if (
          parsedRequestedDate &&
          !Number.isNaN(parsedRequestedDate.getTime()) &&
          !isPastDate(parsedRequestedDate)
        ) {
          date = requestedDateParam as string;
        }
        time = "";
        duration = "";
        seatIds = requestedSeats;
      }

      const availableHours = time ? hoursAvailableFrom(date, time, businessHours) : 0;
      const durationHours = Number(duration);
      if (
        isClosureDate(date, closures) ||
        isRegularlyClosedDate(date, businessHours) ||
        (time &&
          !meetsMinimumNotice(
            reservationDateForTime(date, time, businessHours),
            time,
            bookingSettings.minimum_notice_minutes,
          )) ||
        availableHours === 0 ||
        durationHours < bookingSettings.min_duration_hours ||
        durationHours > bookingSettings.max_duration_hours ||
        durationHours > availableHours
      ) {
        time = "";
        duration = "";
      }

      if (!memberIdentity) {
        date = getManilaDateString();
        time = "";
        duration = "";
        seatIds = [];
      }

      setFormData((current) => ({ ...current, date, time, duration }));
      setCurrentMonth(new Date(`${date}T00:00:00`));
      setSeats(initializeSeats(date, seatIds));
      setHasRestoredDraft(true);

      if (memberIdentity && requestedSeats.length > 0 && shouldFocusSchedule) {
        window.setTimeout(() => {
          scheduleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          timeSelectRef.current?.focus({ preventScroll: true });
        }, 150);
      }
    }, 0);

    return () => window.clearTimeout(restoreDraft);
  }, [
    bookingSettings,
    businessHours,
    closures,
    configurationLoading,
    initializeSeats,
    isIdentityLoading,
    memberIdentity,
    requestedDateParam,
    requestedSeatParam,
    shouldFocusSchedule,
  ]);

  useEffect(() => {
    if (!hasRestoredDraft || !memberIdentity) return;

    const draft: ReservationDraft = {
      date: formData.date,
      time: formData.time,
      duration: formData.duration,
      seatIds: seats.filter((seat) => seat.status === "selected").map((seat) => seat.id),
    };

    window.localStorage.setItem(RESERVATION_DRAFT_KEY, JSON.stringify(draft));
  }, [formData.date, formData.duration, formData.time, hasRestoredDraft, memberIdentity, seats]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTimeSelect = (value: string) => {
    if (reservationControlsDisabled) return;

    setIsAvailabilityLoading(true);
    setAvailabilityError("");
    setFormData((current) => {
      const bookingDate = reservationDateForTime(current.date, value, businessHours);
      if (
        value &&
        !meetsMinimumNotice(bookingDate, value, bookingSettings.minimum_notice_minutes)
      ) {
        return { ...current, time: "", duration: "" };
      }
      const hoursUntilClosing = hoursAvailableFrom(current.date, value, businessHours);
      const duration = Number(current.duration) <= hoursUntilClosing ? current.duration : "";
      return { ...current, time: value, duration };
    });
  };

  const handleDurationSelect = (value: string) => {
    if (reservationControlsDisabled) return;

    setIsAvailabilityLoading(true);
    setAvailabilityError("");
    setFormData((current) => ({ ...current, duration: value }));
  };

  const handleDateSelect = (date: Date) => {
    if (reservationControlsDisabled) return;

    const candidate = getDateString(date);
    if (
      isPastDate(date) ||
      candidate > maximumBookingDate(getManilaDateString(), bookingSettings.maximum_advance_days) ||
      isClosureDate(candidate, closures) ||
      isRegularlyClosedDate(candidate, businessHours)
    )
      return;

    const dateString = candidate;
    setIsAvailabilityLoading(true);
    setAvailabilityError("");

    setFormData((current) => {
      const keepTime = Boolean(
        current.time &&
          meetsMinimumNotice(
            reservationDateForTime(dateString, current.time, businessHours),
            current.time,
            bookingSettings.minimum_notice_minutes,
          ) &&
          hoursAvailableFrom(dateString, current.time, businessHours) >=
            Number(current.duration || 1),
      );
      return {
        ...current,
        date: dateString,
        time: keepTime ? current.time : "",
        duration: keepTime ? current.duration : "",
      };
    });

    const currentSelected = seats.filter((s) => s.status === "selected").map((s) => s.id);
    setSeats(initializeSeats(dateString, currentSelected));
    setIsCalendarOpen(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "Select Date";
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const isSameDay = (date1: Date | null, date2String: string) => {
    if (!date1) return false;
    const year = date1.getFullYear();
    const month = String(date1.getMonth() + 1).padStart(2, "0");
    const day = String(date1.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}` === date2String;
  };

  const canGoToPreviousMonth = () => {
    const today = new Date(`${getManilaDateString()}T00:00:00`);
    const viewYear = currentMonth.getFullYear();
    const viewMonth = currentMonth.getMonth();
    return (
      viewYear > today.getFullYear() ||
      (viewYear === today.getFullYear() && viewMonth > today.getMonth())
    );
  };

  const handleSeatClick = (seatId: string) => {
    if (
      reservationControlsDisabled ||
      isAvailabilityLoading ||
      availabilityError ||
      configurationLoading ||
      configurationError ||
      selectedDateUnavailable
    )
      return;
    const seat = seats.find((s) => s.id === seatId);
    if (!seat || seat.status === "reserved") return;

    const selectedCount = seats.filter((s) => s.status === "selected").length;

    setSeats(
      seats.map((s) => {
        if (s.id === seatId) {
          if (s.status === "selected") {
            return { ...s, status: "available" };
          } else if (selectedCount < bookingSettings.max_seats_per_booking) {
            return { ...s, status: "selected" };
          }
        }
        return s;
      }),
    );
  };

  const handleClearSelectedSeats = () => {
    setSeats((currentSeats) =>
      currentSeats.map((seat) =>
        seat.status === "selected" ? { ...seat, status: "available" } : seat,
      ),
    );
  };

  const getSeatStatus = (seatId: string): SeatStatus => {
    return seats.find((s) => s.id === seatId)?.status || "available";
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBookingError("");

    if (!isSupabaseConfigured) {
      setBookingError("Supabase is not configured. Add your project values to .env.");
      return;
    }

    if (!memberIdentity) {
      setBookingError("Please sign in before choosing a schedule and reserving seats.");
      return;
    }

    if (!formData.time || !formData.duration) {
      setBookingError("Please select a reservation time and duration.");
      timeSelectRef.current?.focus();
      return;
    }

    const bookingDate = reservationDateForTime(formData.date, formData.time, businessHours);

    if (isReservationTimePast(bookingDate, formData.time)) {
      setBookingError("Please select a future reservation time.");
      setFormData((current) => ({ ...current, time: "", duration: "" }));
      timeSelectRef.current?.focus();
      return;
    }

    if (!meetsMinimumNotice(bookingDate, formData.time, bookingSettings.minimum_notice_minutes)) {
      setBookingError(
        `Reservations require at least ${bookingSettings.minimum_notice_minutes} minutes notice.`,
      );
      setFormData((current) => ({ ...current, time: "", duration: "" }));
      timeSelectRef.current?.focus();
      return;
    }

    const closure = closureForDate(formData.date, closures);
    if (closure) {
      setBookingError(`Reservations are unavailable on this date: ${closure.name}.`);
      return;
    }

    if (isRegularlyClosedDate(formData.date, businessHours)) {
      setBookingError("Reservations are unavailable because the hub is closed on this day.");
      return;
    }

    if (
      hoursAvailableFrom(formData.date, formData.time, businessHours) < Number(formData.duration)
    ) {
      setBookingError("Please choose a time and duration within the current operating hours.");
      return;
    }

    const selectedSeats = seats.filter((s) => s.status === "selected").map((s) => s.id);

    setIsSubmitting(true);
    try {
      const booking = await createBooking({
        guestName: formData.name,
        guestEmail: formData.email,
        bookingDate,
        startTime: formData.time,
        durationHours: Number(formData.duration),
        space: formData.space || "study-seat",
        seatCodes: selectedSeats,
      });
      setReservationId(booking.reservation_code);
      setBookingId(booking.id);
      setSubtotalCents(booking.subtotal_cents);
      setLastSelectedSeats(selectedSeats);
      setConfirmationStep("pending");
      setCancellationError("");
      setIsModalOpen(true);
      await createPaymongoQr(booking.id);
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : "Unable to create booking.");
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
  };

  const renderSeatButton = (id: string) => {
    const status = getSeatStatus(id);
    const isSeatDisabled =
      reservationControlsDisabled ||
      status === "reserved" ||
      isAvailabilityLoading ||
      configurationLoading ||
      Boolean(availabilityError) ||
      Boolean(configurationError) ||
      selectedDateUnavailable;
    const colors = {
      available: "bg-[#e8e8e8] enabled:hover:bg-[#d0d0d0] text-[#2d2520]",
      reserved: "bg-[#9ca3af] text-white",
      selected: "bg-[#3b82f6] text-white",
    };

    return (
      <button
        key={id}
        type="button"
        onClick={() => handleSeatClick(id)}
        aria-describedby={
          !isIdentityLoading && !memberIdentity ? "reservation-sign-in-notice" : undefined
        }
        className={`w-14 h-14 shrink-0 rounded-xl ${isAvailabilityLoading ? "bg-[#d1d5db] cursor-wait text-white animate-pulse" : colors[status]} ${isSeatDisabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"} transition-all text-xs font-medium flex items-center justify-center`}
        disabled={isSeatDisabled}
      >
        {id}
      </button>
    );
  };

  const selectedCount = seats.filter((s) => s.status === "selected").length;
  const hoursUntilClosing = hoursAvailableFrom(formData.date, formData.time, businessHours);
  const availableDurationOptions = Array.from(
    {
      length: Math.max(
        0,
        Math.min(bookingSettings.max_duration_hours, hoursUntilClosing) -
          bookingSettings.min_duration_hours +
          1,
      ),
    },
    (_, index) => bookingSettings.min_duration_hours + index,
  ).map((hours) => [String(hours), `${hours} hour${hours === 1 ? "" : "s"}`] as const);
  const availableTimeOptions = reservationTimeOptions(formData.date, businessHours).filter(
    ([time]) =>
      meetsMinimumNotice(
        reservationDateForTime(formData.date, time, businessHours),
        time,
        bookingSettings.minimum_notice_minutes,
        currentTime,
      ),
  );
  const selectedClosure = closureForDate(formData.date, closures);
  const selectedDayHours = businessHours.find(
    (hours) => hours.day_of_week === new Date(`${formData.date}T12:00:00`).getDay(),
  );
  const selectedDayClosed = isRegularlyClosedDate(formData.date, businessHours);
  const selectedDateUnavailable = Boolean(selectedClosure) || selectedDayClosed;
  const qrSecondsRemaining = qrExpiresAt ? getCountdownSeconds(qrExpiresAt, qrCountdownNow) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fffcf7] to-[#fff8ed] pt-20 sm:pt-24">
      <audio
        ref={paymentSuccessSoundRef}
        src="/audio/success.mp3"
        preload="auto"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 sm:py-16">
        <div className="mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-5xl mb-3 sm:mb-4 text-[#2d2520]">Reserve Your Desk</h1>
          <p className="text-base sm:text-lg text-[#6b5e52] max-w-xl">
            Select your preferred seat from the floor plan below. You can choose up to{" "}
            {bookingSettings.max_seats_per_booking} seats.
          </p>
        </div>

        {!isIdentityLoading && !memberIdentity && (
          <div
            id="reservation-sign-in-notice"
            role="status"
            className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#e5a930]/50 bg-[#fef3dc] p-5 shadow-sm sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#b47b0d]">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-[#2d2520]">Sign in to reserve a seat</h2>
                <p className="mt-1 text-sm leading-6 text-[#6b5e52]">
                  Please sign in or create an account before choosing a date, time, and seats.
                </p>
              </div>
            </div>
            <Link
              href="/register"
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#e5a930] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-[#d69520] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d69520] focus-visible:ring-offset-2"
            >
              Sign in
            </Link>
          </div>
        )}

        {/* Seat Plan */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-lg mb-6 sm:mb-8">
          <div className="mb-5 sm:mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              <h2 className="text-2xl sm:text-3xl mb-2 text-[#2d2520]">Seat Plan</h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs sm:flex sm:flex-wrap sm:items-center sm:gap-6 sm:text-sm sm:mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 shrink-0 bg-[#e8e8e8] rounded-lg"></div>
                  <span className="text-[#6b5e52]">Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 shrink-0 bg-[#9ca3af] rounded-lg"></div>
                  <span className="text-[#6b5e52]">Reserved</span>
                </div>
                <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 shrink-0 bg-[#3b82f6] rounded-lg"></div>
                  <span className="text-[#6b5e52]">
                    Selected ({selectedCount}/{bookingSettings.max_seats_per_booking})
                  </span>
                </div>
              </div>
            </div>
            <div className="w-full sm:w-72 lg:w-64 relative" ref={calendarRef}>
              <label
                htmlFor="reservation-date"
                className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2"
              >
                <Calendar className="inline w-4 h-4 mr-1" />
                Select Date
              </label>
              <button
                id="reservation-date"
                type="button"
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                disabled={reservationControlsDisabled}
                aria-describedby={
                  !isIdentityLoading && !memberIdentity ? "reservation-sign-in-notice" : undefined
                }
                className="w-full px-4 py-3 rounded-xl border border-[#f3ede4] bg-white focus:outline-none focus:ring-2 focus:ring-[#e5a930] transition-all text-left flex items-center justify-between disabled:cursor-not-allowed disabled:bg-[#eee9e2] disabled:opacity-70"
              >
                <span className="text-[#2d2520]">{formatDate(formData.date)}</span>
                <Calendar className="w-4 h-4 text-[#6b5e52]" />
              </button>

              {isCalendarOpen && (
                <div className="absolute top-full mt-2 inset-x-0 bg-white rounded-2xl shadow-2xl border border-[#f3ede4] p-3 sm:p-4 z-50 w-full sm:w-80 sm:left-auto sm:right-0">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentMonth(
                          new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1),
                        )
                      }
                      disabled={reservationControlsDisabled || !canGoToPreviousMonth()}
                      className="p-2 hover:bg-[#f3ede4] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <ChevronLeft className="w-5 h-5 text-[#6b5e52]" />
                    </button>
                    <span className="text-lg text-[#2d2520]">
                      {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentMonth(
                          new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
                        )
                      }
                      disabled={reservationControlsDisabled}
                      className="p-2 hover:bg-[#f3ede4] rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronRight className="w-5 h-5 text-[#6b5e52]" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                      <div key={day} className="text-center text-xs text-[#6b5e52] py-2">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {getDaysInMonth(currentMonth).map((day, index) => {
                      const dateString = day ? getDateString(day) : "";
                      const closure = day ? closureForDate(dateString, closures) : undefined;
                      const regularlyClosed = day
                        ? isRegularlyClosedDate(dateString, businessHours)
                        : false;
                      const closed = Boolean(closure) || regularlyClosed;
                      const unavailable = day
                        ? isPastDate(day) ||
                          dateString >
                            maximumBookingDate(
                              getManilaDateString(),
                              bookingSettings.maximum_advance_days,
                            ) ||
                          closed
                        : false;
                      const unavailableReason =
                        closure?.name ?? (regularlyClosed ? "Closed on this day" : undefined);
                      return (
                        <div key={index}>
                          {day ? (
                            <button
                              type="button"
                              onClick={() => handleDateSelect(day)}
                              disabled={reservationControlsDisabled || unavailable}
                              title={unavailableReason}
                              aria-label={
                                unavailableReason
                                  ? `${formatDate(dateString)} — ${unavailableReason}`
                                  : formatDate(dateString)
                              }
                              className={`w-full aspect-square rounded-lg text-sm transition-all ${
                                unavailable
                                  ? closed
                                    ? "cursor-not-allowed bg-[#e4e1dd] text-[#968c82] line-through"
                                    : "cursor-not-allowed text-[#c4b8ab]"
                                  : isSameDay(day, formData.date)
                                    ? "bg-[#e5a930] text-white"
                                    : "hover:bg-[#f3ede4] text-[#2d2520]"
                              }`}
                            >
                              {day.getDate()}
                            </button>
                          ) : (
                            <div></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-[#f3ede4] pt-3 text-xs text-[#6b5e52]">
                    <span className="h-4 w-4 rounded bg-[#e4e1dd]" aria-hidden="true" />
                    Closed
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl sm:rounded-2xl border border-[#e8e0d4] bg-[#f3f0eb] p-2 sm:p-6">
            <p className="text-sm text-[#6b5e52] mb-1 sm:mb-4 px-1 sm:px-0">
              {reservationControlsDisabled
                ? "Sign in to select seats from the floor plan."
                : isAvailabilityLoading
                  ? "Checking live seat availability…"
                  : `Layout follows the in-store floor plan — tap a seat to select (up to ${bookingSettings.max_seats_per_booking}).`}
            </p>
            {availabilityError && (
              <p
                className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800"
                role="alert"
              >
                {availabilityError} Seat selection is disabled until it reconnects.
              </p>
            )}
            <p className="text-xs text-[#8b7355] mb-3 px-1 sm:hidden">
              Swipe sideways to explore the full floor plan.
            </p>
            <SeatingPlan renderSeat={renderSeatButton} />
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white/70 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-lg"
        >
          {isIdentityLoading ? (
            <div className="mb-4 h-[74px] animate-pulse rounded-xl bg-[#f3ede4]/70 sm:mb-6">
              <span className="sr-only">Loading account profile</span>
            </div>
          ) : memberIdentity ? (
            <div className="mb-4 rounded-xl border border-[#e8e0d4] bg-[#fffcf7] px-4 py-3 sm:mb-6">
              <p className="mb-1 text-xs uppercase tracking-wider text-[#8b7355]">Booking as</p>
              <p className="font-medium text-[#2d2520]">{memberIdentity.name}</p>
              <p className="break-all text-sm text-[#6b5e52]">{memberIdentity.email}</p>
            </div>
          ) : null}

          <div
            ref={scheduleRef}
            className="grid scroll-mt-28 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6"
          >
            <div>
              <label
                htmlFor="reservation-time"
                className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2"
              >
                <Clock className="inline w-4 h-4 mr-1" />
                Time
              </label>
              <ReservationSelect
                id="reservation-time"
                name="time"
                buttonRef={timeSelectRef}
                value={formData.time}
                options={availableTimeOptions}
                onChange={handleTimeSelect}
                disabled={
                  reservationControlsDisabled ||
                  configurationLoading ||
                  Boolean(configurationError) ||
                  selectedDateUnavailable
                }
                describedBy={
                  !isIdentityLoading && !memberIdentity ? "reservation-sign-in-notice" : undefined
                }
                placeholder="Select time"
                listboxLabel="Available reservation times"
                emptyMessage="No times are available for this date."
                separateNextDay
              />
              <p className="mt-2 text-xs text-[#8b7355]">
                {selectedClosure
                  ? `Closed: ${selectedClosure.name}`
                  : selectedDayClosed
                    ? "Closed on this day based on the regular operating schedule."
                    : selectedDayHours
                      ? `${formatHoursRange(selectedDayHours)} · Past times are unavailable.`
                      : "Loading current operating hours…"}
              </p>
              {!configurationLoading &&
                !configurationError &&
                !selectedDateUnavailable &&
                availableTimeOptions.length === 0 && (
                  <p
                    role="status"
                    className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                  >
                    {formData.date === getManilaDateString(currentTime)
                      ? "No more booking times are available today. Please select another date."
                      : "No booking times are available for this date. Please select another date."}
                  </p>
                )}
            </div>
            <div>
              <label
                htmlFor="reservation-duration"
                className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2"
              >
                Duration
              </label>
              <ReservationSelect
                id="reservation-duration"
                name="duration"
                value={formData.duration}
                options={availableDurationOptions}
                onChange={handleDurationSelect}
                disabled={reservationControlsDisabled || !formData.time}
                describedBy={
                  !isIdentityLoading && !memberIdentity ? "reservation-sign-in-notice" : undefined
                }
                placeholder={formData.time ? "Select duration" : "Select a time first"}
                listboxLabel="Available reservation durations"
                emptyMessage="No durations are available for this time."
              />
              {formData.time && (
                <p className="mt-2 text-xs text-[#8b7355]">
                  {hoursUntilClosing} hour{hoursUntilClosing === 1 ? "" : "s"} available before
                  closing.
                </p>
              )}
            </div>
          </div>

          {selectedCount > 0 && (
            <div className="mb-6 p-4 bg-[#fef3dc] rounded-xl">
              <div className="mb-2 flex items-center justify-between gap-4">
                <p className="text-sm text-[#6b5e52] uppercase tracking-wider">Selected Seats</p>
                <button
                  type="button"
                  onClick={handleClearSelectedSeats}
                  className="rounded-full border border-[#e5a930]/50 bg-white px-3 py-1.5 text-xs font-medium text-[#8b651b] transition-colors hover:border-[#e5a930] hover:bg-[#fff8ed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e5a930] cursor-pointer"
                >
                  Clear
                </button>
              </div>
              <p className="text-lg text-[#2d2520]">
                {seats
                  .filter((s) => s.status === "selected")
                  .map((s) => s.id)
                  .join(", ")}
              </p>
            </div>
          )}

          {bookingError && (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {bookingError}
            </p>
          )}

          {configurationError && (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {configurationError}
            </p>
          )}

          <button
            type="submit"
            disabled={
              reservationControlsDisabled ||
              !formData.time ||
              !formData.duration ||
              selectedCount === 0 ||
              isSubmitting ||
              isAvailabilityLoading ||
              configurationLoading ||
              Boolean(availabilityError) ||
              Boolean(configurationError) ||
              selectedDateUnavailable
            }
            className={`w-full min-h-12 cursor-pointer bg-[#e5a930] text-white px-5 sm:px-8 py-3 sm:py-4 rounded-full transition-[background-color,box-shadow] duration-200 enabled:hover:bg-[#d69520] enabled:hover:shadow-lg ${
              reservationControlsDisabled ||
              !formData.time ||
              !formData.duration ||
              selectedCount === 0 ||
              isSubmitting ||
              isAvailabilityLoading ||
              configurationLoading ||
              availabilityError ||
              configurationError ||
              selectedDateUnavailable
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
          >
            {isSubmitting
              ? "Saving Reservation…"
              : `Confirm Reservation${selectedCount > 0 ? ` (${selectedCount} seat${selectedCount > 1 ? "s" : ""})` : ""}`}
          </button>
        </form>
      </div>

      {/* Local QR confirmation modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-2 sm:p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) paymentModalCloseRef.current?.click();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-modal-title"
            className="bg-white rounded-t-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#f3ede4] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:my-4 [&::-webkit-scrollbar-thumb]:bg-[#e5a930] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-[#d69520]"
          >
            <div className="p-5 sm:p-8">
              {confirmationStep === "pending" ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 id="payment-modal-title" className="text-2xl sm:text-3xl text-[#2d2520]">
                      Scan to Pay
                    </h2>
                    <button
                      ref={paymentModalCloseRef}
                      type="button"
                      onClick={() => void closePaymentModal()}
                      disabled={isCancellingReservation}
                      aria-label="Close payment"
                      className="p-2 hover:bg-[#f3ede4] rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X className="w-6 h-6 text-[#6b5e52]" />
                    </button>
                  </div>

                  <div className="mb-4">
                    <div className="grid gap-3 rounded-2xl border border-[#eadfce] bg-[#fff8ed] p-4 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs uppercase tracking-wider text-[#6b5e52]">
                          Reservation ID
                        </p>
                        <p className="text-lg font-semibold text-[#2d2520]">{reservationId}</p>
                      </div>
                      <div className="sm:text-right">
                        <p className="mb-1 text-xs uppercase tracking-wider text-[#6b5e52]">
                          Overall payment
                        </p>
                        <p className="text-2xl font-semibold text-[#9b6810]">
                          {formatPrice(subtotalCents)}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-3 space-y-2 text-left text-sm text-[#6b5e52]">
                      {lastSelectedSeats.length > 0 && (
                        <div>
                          <dt className="inline font-medium text-[#2d2520]">Seats: </dt>
                          <dd className="inline">{lastSelectedSeats.join(", ")}</dd>
                        </div>
                      )}
                      <div>
                        <dt className="inline font-medium text-[#2d2520]">Date: </dt>
                        <dd className="inline">
                          {formatDate(
                            reservationDateForTime(formData.date, formData.time, businessHours),
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline font-medium text-[#2d2520]">Time: </dt>
                        <dd className="inline">
                          {formatReservationTimeRange(formData.time, formData.duration)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="mb-6">
                    <div className="bg-[#f9f9f9] border-2 border-dashed border-[#d1d5db] rounded-2xl p-4 sm:p-8 flex flex-col items-center justify-center">
                      {isConfirmationLoading ? (
                        <div className="flex h-48 items-center justify-center text-sm text-[#6b5e52]">
                          Generating secure QR code…
                        </div>
                      ) : confirmationQr ? (
                        <Image
                          src={confirmationQr}
                          alt="PayMongo QR Ph payment code"
                          width={240}
                          height={240}
                          unoptimized
                          className="h-48 w-48 sm:h-60 sm:w-60"
                        />
                      ) : (
                        <QrCode className="w-36 h-36 sm:w-48 sm:h-48 text-[#9ca3af] mb-4" />
                      )}
                      <p className="mt-4 text-sm text-[#6b5e52] text-center">
                        Scan with GCash, Maya, or a QR Ph-enabled banking app. The amount is fixed
                        to this reservation.
                      </p>
                      {qrExpiresAt && (
                        <p
                          role="timer"
                          className={`mt-2 text-xs font-medium ${qrSecondsRemaining > 0 ? "text-[#9b6810]" : "text-red-700"}`}
                        >
                          {qrSecondsRemaining > 0
                            ? `Expires in ${formatCountdown(qrSecondsRemaining)}`
                            : "QR code expired"}
                        </p>
                      )}
                    </div>
                  </div>

                  {confirmationError && (
                    <div
                      role="alert"
                      className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                    >
                      <p>{confirmationError}</p>
                      {bookingId && (
                        <button
                          type="button"
                          onClick={() => void createPaymongoQr(bookingId)}
                          disabled={isConfirmationLoading}
                          className="mt-3 rounded-full bg-red-700 px-4 py-2 font-medium text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isConfirmationLoading ? "Trying again…" : "Try generating QR again"}
                        </button>
                      )}
                    </div>
                  )}

                  {cancellationError && (
                    <p
                      role="alert"
                      className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                    >
                      {cancellationError}
                    </p>
                  )}

                  <div className="mb-6 border-l-4 border-[#e5a930] bg-[#fef3dc]/30 p-4 rounded-r-xl">
                    <div className="flex items-start gap-2 mb-3">
                      <AlertCircle className="w-5 h-5 text-[#e5a930] flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-[#2d2520]">
                        <span className="font-semibold">Important Notes:</span>
                      </p>
                    </div>
                    <ul className="space-y-2 text-sm text-[#6b5e52] ml-7">
                      <li className="flex items-start gap-2">
                        <span className="text-[#e5a930] mt-1">•</span>
                        <span>
                          <strong>Single-use QR:</strong> Pay before the 15-minute QR Ph deadline.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#e5a930] mt-1">•</span>
                        <span>
                          <strong>20-Minute Grace Period:</strong> If you do not arrive within 20
                          minutes after your reservation time, your seat will be made available to
                          others.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#e5a930] mt-1">•</span>
                        <span>
                          <strong>Email Confirmation:</strong> Your kiosk access QR will be sent to{" "}
                          <strong>{formData.email}</strong> after confirmation.
                        </span>
                      </li>
                    </ul>
                  </div>

                  <p className="text-center text-sm text-[#6b5e52]">
                    Waiting to confirm your payment…
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 id="payment-modal-title" className="text-2xl sm:text-3xl text-[#2d2520]">
                      Reservation Confirmed
                    </h2>
                    <button
                      ref={paymentModalCloseRef}
                      type="button"
                      onClick={() => void closePaymentModal()}
                      aria-label="Close confirmation"
                      className="p-2 hover:bg-[#f3ede4] rounded-full transition-colors"
                    >
                      <X className="w-6 h-6 text-[#6b5e52]" />
                    </button>
                  </div>

                  <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-20 h-20 bg-[#dcfce7] rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 className="w-12 h-12 text-[#22c55e]" />
                    </div>
                    <p className="text-lg text-[#2d2520] mb-2">
                      Thank you! Your reservation has been confirmed.
                    </p>
                    <p className="text-sm text-[#6b5e52]">
                      Reservation <strong className="text-[#2d2520]">{reservationId}</strong> is
                      confirmed.
                    </p>
                    <p className="mt-2 text-base font-semibold text-[#9b6810]">
                      Overall payment: {formatPrice(subtotalCents)}
                    </p>
                  </div>

                  <div className="mb-6 rounded-2xl border border-[#f3ede4] bg-[#fffcf7] p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <Mail className="w-5 h-5 text-[#e5a930] flex-shrink-0 mt-0.5" />
                      <div className="text-left">
                        <p className="text-sm font-semibold text-[#2d2520] mb-1">
                          {isConfirmationEmailSent ? "Check your email" : "Preparing your email"}
                        </p>
                        <p className="text-sm text-[#6b5e52]">
                          {isConfirmationEmailSent ? "We sent" : "We are sending"} a booking
                          confirmation to{" "}
                          <strong className="text-[#2d2520]">{formData.email}</strong>. Open it on
                          your phone when you arrive — you will need it for self check-in.
                        </p>
                        {emailDeliveryError && (
                          <p className="mt-2 text-sm text-red-700">
                            The reservation is confirmed, but email delivery failed. Please contact
                            staff if it does not arrive.
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-[#6b5e52] uppercase tracking-wider mb-2 text-left">
                      Your email includes
                    </p>
                    <ul className="space-y-2 text-sm text-[#6b5e52] text-left">
                      <li className="flex items-start gap-2">
                        <span className="text-[#e5a930] mt-0.5">•</span>
                        <span>
                          <strong className="text-[#2d2520]">Reservation reference</strong> for your
                          confirmed booking
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#e5a930] mt-0.5">•</span>
                        <span>
                          <strong className="text-[#2d2520]">Unique check-in QR code</strong> linked
                          to reservation {reservationId}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#e5a930] mt-0.5">•</span>
                        <span>
                          <strong className="text-[#2d2520]">Reservation summary</strong> — seats{" "}
                          {lastSelectedSeats.join(", ")}, {formatDate(formData.date)}
                          {formData.time && ` at ${formatTimeLabel(formData.time)}`}
                          {formData.duration &&
                            ` (${formData.duration} hour${formData.duration === "1" ? "" : "s"})`}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#e5a930] mt-0.5">•</span>
                        <span>
                          <strong className="text-[#2d2520]">Self check-in instructions</strong> for
                          the facility kiosk at the entrance
                        </span>
                      </li>
                    </ul>
                  </div>

                  <div className="mb-6 border-l-4 border-[#e5a930] bg-[#fef3dc]/30 p-4 rounded-r-xl text-left">
                    <p className="text-sm font-semibold text-[#2d2520] mb-3">When you arrive</p>
                    <ol className="space-y-2 text-sm text-[#6b5e52] list-decimal list-inside">
                      <li>
                        Arrive within <strong>20 minutes</strong> of your scheduled time or your
                        seat may be released.
                      </li>
                      <li>
                        Head to the <strong>Facility Kiosk</strong> near the entrance (same flow as
                        our in-store demo).
                      </li>
                      <li>
                        Select <strong>Check-In</strong> and scan the QR code from your confirmation
                        email.
                      </li>
                      <li>
                        Proceed to your assigned seat{lastSelectedSeats.length > 1 ? "s" : ""}:{" "}
                        {lastSelectedSeats.join(", ")}.
                      </li>
                      <li>
                        When you leave, scan the same QR at the kiosk under{" "}
                        <strong>Check-Out</strong>.
                      </li>
                    </ol>
                    <p className="text-xs text-[#6b5e52] mt-3">
                      The check-in kiosk is available inside the facility.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void closePaymentModal()}
                    className="w-full bg-[#e5a930] text-white px-8 py-4 rounded-full hover:shadow-xl cursor-pointer"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReservePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fffcf7]" />}>
      <ReserveContent />
    </Suspense>
  );
}
