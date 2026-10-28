"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { FunctionsHttpError } from '@supabase/supabase-js';
import {
  AlertTriangle,
  Armchair,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  Loader2,
  Mail,
  Pencil,
  RotateCcw,
  X,
} from 'lucide-react';
import { SeatingPlan } from '@/app/components/SeatingPlan';
import {
  closureForDate,
  DEFAULT_BOOKING_SETTINGS,
  hoursAvailableFrom,
  maximumBookingDate,
  meetsMinimumNotice,
  operatingDateForBooking,
  reservationDateForTime,
  reservationTimeOptions,
  type BookingSettings,
  type BusinessClosure,
  type BusinessHours,
} from '@/lib/business-config';
import { createClient } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/database.types';

type Booking = Tables<'bookings'>;
type Seat = Tables<'seats'>;
type PaymentSummary = Pick<
  Tables<'payments'>,
  'id' | 'method' | 'status' | 'amount_cents' | 'currency' | 'provider_payment_id' | 'paid_at' | 'created_at'
>;
type PassSummary = Pick<Tables<'qr_access_passes'>, 'id' | 'expires_at' | 'revoked_at'>;
type CheckInSummary = Pick<
  Tables<'check_in_sessions'>,
  'id' | 'status' | 'checked_in_at' | 'checked_out_at' | 'overtime_minutes' | 'overtime_charge_cents'
>;
type RefundSummary = Pick<
  Tables<'payment_refunds'>,
  'id' | 'status' | 'amount_cents' | 'provider_refund_id' | 'failure_message' | 'created_at' | 'updated_at' | 'finalized_at'
>;
type ManagedBooking = Booking & {
  payments: PaymentSummary[];
  payment_refunds: RefundSummary | RefundSummary[] | null;
  qr_access_passes: PassSummary | PassSummary[] | null;
  check_in_sessions: CheckInSummary | CheckInSummary[] | null;
};
type BookingFilter = 'upcoming' | 'past' | 'cancelled' | 'all';
type EditDraft = { date: string; time: string; seats: string[] };

const pageSize = 5;
const terminalStatuses = new Set(['completed', 'cancelled', 'declined', 'no_show']);

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value));
}

function formatPeso(cents: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(cents / 100);
}

function formatPdfPesoAmount(cents: number) {
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function createPesoSignImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The Philippine peso sign could not be rendered.');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#2d2520';
  context.font = '700 96px Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('₱', 64, 67);
  return canvas.toDataURL('image/png');
}

function firstRelation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The business logo could not be loaded.'));
    image.src = source;
  });
}

async function functionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof FunctionsHttpError) {
    const payload = await error.context.json().catch(() => null) as { error?: unknown } | null;
    if (typeof payload?.error === 'string') return payload.error;
  }
  return error instanceof Error ? error.message : fallback;
}

function statusClass(status: string) {
  if (status === 'confirmed' || status === 'checked_in' || status === 'completed') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (status === 'cancelled' || status === 'declined' || status === 'no_show') {
    return 'bg-red-100 text-red-700';
  }
  return 'bg-amber-100 text-amber-800';
}

function manilaWindow(date: string, time: string, durationHours: number) {
  const startsAt = new Date(`${date}T${time}:00+08:00`);
  return {
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + durationHours * 60 * 60 * 1000).toISOString(),
  };
}

function canChangeBooking(booking: ManagedBooking, now: number) {
  return booking.status === 'confirmed'
    && new Date(booking.starts_at).getTime() > now + 2 * 60 * 60 * 1000;
}

function canCancelBooking(booking: ManagedBooking, now: number) {
  return ['pending', 'confirmed'].includes(booking.status)
    && new Date(booking.starts_at).getTime() > now;
}

function canResendPass(booking: ManagedBooking, now: number) {
  const pass = firstRelation(booking.qr_access_passes);
  return ['confirmed', 'checked_in'].includes(booking.status)
    && booking.payment_status === 'paid'
    && Boolean(pass && !pass.revoked_at && new Date(pass.expires_at).getTime() > now);
}

async function fetchManagedBookings() {
  return createClient()
    .from('bookings')
    .select(`
      *,
      payments(id, method, status, amount_cents, currency, provider_payment_id, paid_at, created_at),
      payment_refunds(id, status, amount_cents, provider_refund_id, failure_message, created_at, updated_at, finalized_at),
      qr_access_passes(id, expires_at, revoked_at),
      check_in_sessions(id, status, checked_in_at, checked_out_at, overtime_minutes, overtime_charge_cents)
    `)
    .order('starts_at', { ascending: false });
}

async function downloadReceipt(booking: ManagedBooking, qrImage: string, qrExpiresAt: string) {
  const [{ jsPDF }, logo] = await Promise.all([
    import('jspdf'),
    loadImage('/images/logo.png'),
  ]);
  const payment = [...booking.payments].sort((left, right) =>
    new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0];
  const pesoSign = createPesoSignImage();
  const document = new jsPDF();
  document.setFillColor(255, 255, 255);
  document.rect(0, 0, 210, 297, 'F');
  document.addImage(logo, 'PNG', 16, 8, 43, 21);
  document.setTextColor(45, 37, 32);
  document.setFont('helvetica', 'bold');
  document.setFontSize(14);
  document.text('Just In Time Study Hub and', 67, 14);
  document.text('Coworking Space', 67, 22);
  document.setFont('helvetica', 'normal');
  document.setFontSize(9);
  document.setTextColor(138, 103, 26);
  document.text('Official reservation receipt', 67, 29);
  document.setFillColor(229, 169, 48);
  document.rect(16, 36, 178, 2, 'F');
  document.setTextColor(45, 37, 32);
  document.setFontSize(12);
  const rows: Array<[string, string]> = [
    ['Receipt number', payment?.provider_payment_id || booking.reservation_code],
    ['Reservation', booking.reservation_code],
    ['Customer', booking.guest_name],
    ['Email', booking.guest_email],
    ['Schedule', formatDateTime(booking.starts_at)],
    ['Duration', `${booking.duration_hours} hour${booking.duration_hours === 1 ? '' : 's'}`],
    ['Seats', booking.seat_ids.join(', ')],
    ['Payment method', payment ? titleCase(payment.method) : titleCase(booking.payment_status)],
    ['Payment date', payment?.paid_at ? formatDateTime(payment.paid_at) : 'Recorded with reservation'],
  ];
  let y = 51;
  for (const [label, value] of rows) {
    document.setFont('helvetica', 'bold');
    document.text(label, 16, y);
    document.setFont('helvetica', 'normal');
    document.text(value, 62, y, { maxWidth: 70 });
    y += 10;
  }
  document.setDrawColor(229, 169, 48);
  document.roundedRect(137, 47, 58, 75, 3, 3, 'S');
  document.addImage(qrImage, 'PNG', 140, 51, 52, 52);
  document.setFont('helvetica', 'bold');
  document.setFontSize(10);
  document.text('Kiosk QR pass', 166, 109, { align: 'center' });
  document.setFont('helvetica', 'normal');
  document.setFontSize(7.5);
  document.setTextColor(107, 94, 82);
  const expiryLines = document.splitTextToSize(`Valid through ${formatDateTime(qrExpiresAt)}`, 50);
  document.text(expiryLines, 166, 114, { align: 'center' });
  document.setTextColor(45, 37, 32);
  document.setDrawColor(229, 169, 48);
  document.line(16, y + 2, 194, y + 2);
  document.setFont('helvetica', 'bold');
  document.setFontSize(15);
  document.text('Total paid', 16, y + 15);
  const totalAmount = formatPdfPesoAmount(booking.subtotal_cents);
  document.text(totalAmount, 194, y + 15, { align: 'right' });
  const totalAmountWidth = document.getTextWidth(totalAmount);
  document.addImage(pesoSign, 'PNG', 188.5 - totalAmountWidth, y + 10.2, 5, 5);
  document.setFont('helvetica', 'normal');
  document.setFontSize(9);
  document.setTextColor(107, 94, 82);
  document.text(`Generated ${formatDateTime(new Date().toISOString())}`, 16, y + 29);
  document.text('Keep this receipt together with your reservation confirmation.', 16, y + 36);
  document.save(`receipt-${booking.reservation_code}.pdf`);
}

export function ReservationManager() {
  const [now] = useState(() => Date.now());
  const [bookings, setBookings] = useState<ManagedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<BookingFilter>('upcoming');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [seatCatalog, setSeatCatalog] = useState<Seat[]>([]);
  const [availableSeatCodes, setAvailableSeatCodes] = useState<Set<string>>(new Set());
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [action, setAction] = useState<'cancel' | 'save' | 'resend' | 'receipt' | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([]);
  const [closures, setClosures] = useState<BusinessClosure[]>([]);
  const [bookingSettings, setBookingSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS);
  const [configurationLoading, setConfigurationLoading] = useState(true);
  const [configurationError, setConfigurationError] = useState('');

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await fetchManagedBookings();
    if (queryError) setError(queryError.message);
    setBookings((data ?? []) as unknown as ManagedBooking[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchManagedBookings().then(({ data, error: queryError }) => {
      if (!active) return;
      if (queryError) setError(queryError.message);
      setBookings((data ?? []) as unknown as ManagedBooking[]);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const loadConfiguration = async () => {
      const client = createClient();
      const [hoursResult, closuresResult, settingsResult] = await Promise.all([
        client.from('business_hours').select('day_of_week, is_open, opens_at, closes_at').order('day_of_week'),
        client.from('business_closures').select('id, name, starts_on, ends_on, closure_type, is_active').eq('is_active', true),
        client.from('booking_settings').select('max_seats_per_booking, min_duration_hours, max_duration_hours, minimum_notice_minutes, maximum_advance_days').eq('singleton', true).single(),
      ]);
      if (!active) return;
      const queryError = hoursResult.error || closuresResult.error || settingsResult.error;
      setConfigurationError(queryError ? `Unable to load current business hours: ${queryError.message}` : '');
      setBusinessHours(hoursResult.data ?? []);
      setClosures(closuresResult.data ?? []);
      if (settingsResult.data) setBookingSettings(settingsResult.data);
      setConfigurationLoading(false);
    };
    void loadConfiguration();
    return () => { active = false; };
  }, []);

  const selected = bookings.find((booking) => booking.id === selectedId) ?? null;
  const selectedRefund = selected ? firstRelation(selected.payment_refunds) : null;
  const rescheduleTimes = selected && draft?.date
    ? reservationTimeOptions(draft.date, businessHours)
      .filter(([time]) => (
        selected.duration_hours <= hoursAvailableFrom(draft.date, time, businessHours)
        && meetsMinimumNotice(
          reservationDateForTime(draft.date, time, businessHours),
          time,
          bookingSettings.minimum_notice_minutes,
        )
      ))
    : [];
  const selectedClosure = draft ? closureForDate(draft.date, closures) : undefined;
  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      if (filter === 'all') return true;
      if (filter === 'cancelled') return ['cancelled', 'declined'].includes(booking.status);
      if (filter === 'past') {
        return new Date(booking.ends_at).getTime() <= now
          || ['completed', 'no_show'].includes(booking.status);
      }
      return new Date(booking.ends_at).getTime() > now && !terminalStatuses.has(booking.status);
    });
  }, [bookings, filter, now]);
  const pageCount = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleBookings = filteredBookings.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    if (!editing || !selected || !draft?.date || !draft.time) return;
    const timer = window.setTimeout(async () => {
      setAvailabilityLoading(true);
      const bookingDate = reservationDateForTime(draft.date, draft.time, businessHours);
      const windowRange = manilaWindow(bookingDate, draft.time, selected.duration_hours);
      const client = createClient();
      const [catalogResult, availabilityResult] = await Promise.all([
        client.from('seats').select('*').eq('is_active', true).order('code'),
        client.rpc('get_available_seats_for_booking', {
          p_booking_id: selected.id,
          p_starts_at: windowRange.startsAt,
          p_ends_at: windowRange.endsAt,
        }),
      ]);
      if (catalogResult.error || availabilityResult.error) {
        setError(catalogResult.error?.message || availabilityResult.error?.message || 'Unable to check seat availability.');
        setSeatCatalog([]);
        setAvailableSeatCodes(new Set());
      } else {
        setSeatCatalog(catalogResult.data ?? []);
        const availableCodes = new Set((availabilityResult.data ?? []).map((seat) => seat.code));
        setAvailableSeatCodes(availableCodes);
        setDraft((current) => current
          ? { ...current, seats: current.seats.filter((code) => availableCodes.has(code)) }
          : current);
      }
      setAvailabilityLoading(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [businessHours, draft?.date, draft?.time, editing, selected]);

  useEffect(() => {
    if (!selectedId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !action) {
        setSelectedId(null);
        setEditing(false);
        setDraft(null);
        setConfirmingCancel(false);
        setError('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedId, action]);

  const openDetails = (booking: ManagedBooking) => {
    setSelectedId(booking.id);
    setEditing(false);
    setDraft(null);
    setConfirmingCancel(false);
    setError('');
    setNotice('');
  };

  const closeDetails = () => {
    if (action) return;
    setSelectedId(null);
    setEditing(false);
    setDraft(null);
    setConfirmingCancel(false);
    setError('');
  };

  const beginEdit = () => {
    if (!selected) return;
    const currentTime = selected.start_time.slice(0, 5);
    const operatingDate = operatingDateForBooking(
      selected.booking_date,
      currentTime,
      businessHours,
    );
    const validTimes = reservationTimeOptions(operatingDate, businessHours)
      .filter(([time]) => (
        selected.duration_hours <= hoursAvailableFrom(operatingDate, time, businessHours)
        && meetsMinimumNotice(
          reservationDateForTime(operatingDate, time, businessHours),
          time,
          bookingSettings.minimum_notice_minutes,
        )
      ));
    setDraft({
      date: operatingDate,
      time: validTimes.some(([time]) => time === currentTime) ? currentTime : validTimes[0]?.[0] ?? '',
      seats: [...selected.seat_ids].sort(),
    });
    setEditing(true);
    setError('');
  };

  const toggleSeat = (code: string) => {
    if (!draft || !selected) return;
    const paidSeatLimit = selected.seat_ids.length;
    const seats = draft.seats.includes(code)
      ? draft.seats.filter((seat) => seat !== code)
      : draft.seats.length < paidSeatLimit ? [...draft.seats, code].sort() : draft.seats;
    setDraft({ ...draft, seats });
  };

  const saveChanges = async () => {
    if (!selected || !draft) return;
    if (configurationError || selectedClosure || !draft.time) {
      setError(selectedClosure
        ? `${selectedClosure.name} is marked as a closure. Please choose another date.`
        : configurationError || 'Choose an available start time.');
      return;
    }
    setAction('save');
    setError('');
    const bookingDate = reservationDateForTime(draft.date, draft.time, businessHours);
    const { error: updateError } = await createClient().rpc('customer_update_booking', {
      p_booking_id: selected.id,
      p_booking_date: bookingDate,
      p_start_time: draft.time,
      p_seat_codes: draft.seats,
    });
    if (updateError) {
      setError(updateError.message);
    } else {
      setNotice('Reservation updated. Resend your QR pass to receive the revised details.');
      setEditing(false);
      setDraft(null);
      await loadBookings();
    }
    setAction(null);
  };

  const cancelBooking = async () => {
    if (!selected) return;
    setAction('cancel');
    setError('');
    const wasPaid = selected.payment_status === 'paid';
    const { data, error: cancelError } = await createClient().functions.invoke('cancel-customer-booking', {
      body: { bookingId: selected.id },
    });
    if (cancelError || data?.error) {
      setError(typeof data?.error === 'string'
        ? data.error
        : await functionErrorMessage(cancelError, 'Unable to cancel the reservation.'));
    } else {
      const refundMessage = data?.simulated
        ? ' The refund was simulated for test mode; no real funds were moved.'
        : data?.refundStatus === 'succeeded'
          ? ' The full refund was submitted to your original payment method.'
        : data?.refundStatus
          ? ' Your full refund is being processed by PayMongo.'
          : '';
      setNotice(`Reservation cancelled and its seats were released.${wasPaid ? refundMessage : ''}`);
      setConfirmingCancel(false);
      await loadBookings();
    }
    setAction(null);
  };

  const resendPass = async () => {
    if (!selected) return;
    setAction('resend');
    setError('');
    const { data, error: resendError } = await createClient().functions.invoke('resend-booking-pass', {
      body: { bookingId: selected.id },
    });
    if (resendError || data?.error) {
      setError(data?.error || resendError?.message || 'Unable to resend the QR pass.');
    } else {
      setNotice(`QR pass sent to ${data.email}.`);
      await loadBookings();
    }
    setAction(null);
  };

  const createReceipt = async () => {
    if (!selected) return;
    setAction('receipt');
    setError('');
    try {
      const { data, error: passError } = await createClient().functions.invoke('get-booking-pass', {
        body: { bookingId: selected.id },
      });
      if (passError || data?.error || !data?.qrImage || !data?.expiresAt) {
        throw new Error(data?.error || passError?.message || 'Kiosk QR pass unavailable.');
      }
      await downloadReceipt(selected, data.qrImage, data.expiresAt);
      setNotice('Receipt downloaded as a PDF.');
    } catch (receiptError) {
      setError(receiptError instanceof Error ? receiptError.message : 'The receipt could not be generated. Please try again.');
    }
    setAction(null);
  };

  const selectedSeatTotal = draft
    ? seatCatalog
      .filter((seat) => draft.seats.includes(seat.code))
      .reduce((total, seat) => total + seat.hourly_rate_cents * (selected?.duration_hours ?? 0), 0)
    : 0;
  const editHasChanges = Boolean(selected && draft && (
    reservationDateForTime(draft.date, draft.time, businessHours) !== selected.booking_date
    || draft.time !== selected.start_time.slice(0, 5)
    || draft.seats.join(',') !== [...selected.seat_ids].sort().join(',')
  ));
  const seatByCode = useMemo(() => new Map(seatCatalog.map((seat) => [seat.code, seat])), [seatCatalog]);
  const renderEditSeat = (code: string) => {
    const seat = seatByCode.get(code);
    const isSelected = Boolean(draft?.seats.includes(code));
    const isAvailable = Boolean(seat && availableSeatCodes.has(code) && seat.status !== 'maintenance');
    const isAtPaidSeatLimit = Boolean(
      selected && draft && isAvailable && !isSelected && draft.seats.length >= selected.seat_ids.length,
    );
    const disabled = availabilityLoading || !isAvailable || isAtPaidSeatLimit;
    const appearance = availabilityLoading
      ? 'animate-pulse cursor-wait bg-[#d1d5db] text-white'
      : isSelected
        ? 'cursor-pointer bg-[#3b82f6] text-white ring-2 ring-[#1d4ed8] ring-offset-2'
        : isAtPaidSeatLimit
          ? 'cursor-not-allowed bg-[#ede7df] text-[#9b8c7d]'
        : isAvailable
          ? 'cursor-pointer bg-[#e8e8e8] text-[#2d2520] hover:bg-[#d0d0d0]'
          : 'cursor-not-allowed bg-[#9ca3af] text-white';
    return (
      <button
        key={code}
        type="button"
        onClick={() => toggleSeat(code)}
        disabled={disabled}
        aria-pressed={isSelected}
        aria-label={`${code}: ${isSelected ? 'selected' : isAtPaidSeatLimit ? 'seat limit reached' : isAvailable ? 'available' : 'reserved'}`}
        title={isSelected ? 'Selected' : isAtPaidSeatLimit ? 'Remove a selected seat before choosing another' : isAvailable ? 'Available' : 'Reserved for this time'}
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xs font-semibold transition-all ${appearance}`}
      >
        {code}
      </button>
    );
  };

  return (
    <section className="rounded-3xl border border-[#f3ede4] bg-white/70 p-6 shadow-lg backdrop-blur-sm sm:p-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#b47b0d]">Self-service</p>
          <h2 className="text-3xl text-[#2d2520]">My Reservations</h2>
          <p className="mt-2 text-sm text-[#6b5e52]">View details, manage eligible bookings, and retrieve your passes and receipts.</p>
        </div>
        <button type="button" onClick={() => void loadBookings()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#e5d8c8] bg-white px-4 py-2.5 text-sm font-medium text-[#4f443c] hover:bg-[#fff8ed] disabled:opacity-50">
          <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="mb-5 flex flex-wrap gap-2" aria-label="Reservation filters">
        {(['upcoming', 'past', 'cancelled', 'all'] as BookingFilter[]).map((value) => (
          <button key={value} type="button" onClick={() => { setFilter(value); setPage(1); }} aria-pressed={filter === value} className={`rounded-full border px-4 py-2 text-sm font-semibold ${filter === value ? 'border-[#2d2520] bg-[#2d2520] text-white' : 'border-[#ded2c5] bg-white text-[#574b42] hover:bg-[#fff8ed]'}`}>
            {titleCase(value)}
          </button>
        ))}
      </div>

      {error && !selected && <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {loading && bookings.length === 0 && <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[#e5d8c8] p-10 text-[#6b5e52]"><Loader2 className="h-5 w-5 animate-spin" /> Loading reservations…</div>}
      {!loading && visibleBookings.length === 0 && <div className="rounded-2xl border border-dashed border-[#e5d8c8] p-8 text-center text-[#6b5e52]"><CalendarDays className="mx-auto mb-3 h-7 w-7 text-[#b47b0d]" /><p>No {filter === 'all' ? '' : `${filter} `}reservations found.</p></div>}

      <div className="space-y-4">
        {visibleBookings.map((booking) => (
          <article key={booking.id} className="rounded-2xl border border-[#eee4d7] bg-white p-5 transition hover:border-[#e5a930]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold tracking-wide text-[#8a671a]">{booking.reservation_code}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(booking.status)}`}>{titleCase(booking.status)}</span>
                </div>
                <h3 className="text-lg font-semibold text-[#2d2520]">{formatDateTime(booking.starts_at)}</h3>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#6b5e52]">
                  <span className="flex items-center gap-1.5"><Armchair className="h-4 w-4" />{booking.seat_ids.join(', ')}</span>
                  <span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{booking.duration_hours} hour{booking.duration_hours === 1 ? '' : 's'}</span>
                  <span className="font-semibold text-[#4f443c]">{formatPeso(booking.subtotal_cents)}</span>
                </div>
              </div>
              <button type="button" onClick={() => openDetails(booking)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#e5a930] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#d69520]">
                <Eye className="h-4 w-4" /> View details
              </button>
            </div>
          </article>
        ))}
      </div>

      {pageCount > 1 && <nav aria-label="Reservation pages" className="mt-6 flex items-center justify-between gap-3"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-full border border-[#ded2c5] bg-white px-4 py-2 text-sm font-semibold text-[#574b42] disabled:opacity-40">Previous</button><span className="text-sm text-[#6b5e52]">Page {currentPage} of {pageCount}</span><button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="rounded-full border border-[#ded2c5] bg-white px-4 py-2 text-sm font-semibold text-[#574b42] disabled:opacity-40">Next</button></nav>}

      {selected && createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#211b17]/70 p-3 backdrop-blur-md sm:p-6" onMouseDown={closeDetails}>
        <div role="dialog" aria-modal="true" aria-labelledby="reservation-title" className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-white/60 bg-white p-5 shadow-[0_30px_100px_rgba(0,0,0,0.45)] sm:p-8" onMouseDown={(event) => event.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <div><p className="font-mono text-xs font-semibold tracking-wide text-[#9b6810]">{selected.reservation_code}</p><h2 id="reservation-title" className="mt-1 text-3xl text-[#2d2520]">Reservation details</h2></div>
            <button type="button" onClick={closeDetails} disabled={Boolean(action)} aria-label="Close reservation details" className="rounded-full p-2 text-[#5f5248] hover:bg-[#f7f1e8] disabled:opacity-50"><X className="h-5 w-5" /></button>
          </div>

          {notice && <p className="mt-5 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</p>}
          {error && <p role="alert" className="mt-5 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}

          {!editing ? <>
            <div className="mt-6 grid gap-4 rounded-2xl bg-[#faf7f2] p-5 sm:grid-cols-2">
              <Detail label="Status" value={titleCase(selected.status)} />
              <Detail label="Payment" value={titleCase(selected.payment_status)} />
              <Detail label="Customer" value={selected.guest_name} />
              <Detail label="Email" value={selected.guest_email} />
              <Detail label="Starts" value={formatDateTime(selected.starts_at)} />
              <Detail label="Ends" value={formatDateTime(selected.ends_at)} />
              <Detail label="Duration" value={`${selected.duration_hours} hour${selected.duration_hours === 1 ? '' : 's'}`} />
              <Detail label="Seats" value={selected.seat_ids.join(', ')} />
              <Detail label="Space" value={titleCase(selected.space)} />
              <Detail label="Total" value={formatPeso(selected.subtotal_cents)} />
              <Detail label="Booked" value={formatDateTime(selected.created_at)} />
              <Detail label="QR email" value={selected.confirmation_email_sent_at ? formatDateTime(selected.confirmation_email_sent_at) : 'Not sent'} />
              {selected.cancelled_at && <Detail label="Cancelled" value={formatDateTime(selected.cancelled_at)} />}
              {selected.cancellation_reason && <Detail label="Cancellation reason" value={selected.cancellation_reason} />}
            </div>

            {firstRelation(selected.check_in_sessions) && <div className="mt-4 rounded-2xl border border-[#eee4d7] p-5"><h3 className="font-semibold text-[#2d2520]">Visit activity</h3><p className="mt-2 text-sm text-[#6b5e52]">Checked in {formatDateTime(firstRelation(selected.check_in_sessions)!.checked_in_at)}{firstRelation(selected.check_in_sessions)!.checked_out_at ? ` · Checked out ${formatDateTime(firstRelation(selected.check_in_sessions)!.checked_out_at!)}` : ''}</p></div>}

            {['paid', 'processing', 'refunded'].includes(selected.payment_status) && <div className="mt-4 rounded-2xl border border-[#eee4d7] p-5"><h3 className="font-semibold text-[#2d2520]">Payment record</h3><p className="mt-2 text-sm text-[#6b5e52]">{selected.payments[0]?.paid_at ? `Paid ${formatDateTime(selected.payments[0].paid_at!)}` : 'Payment recorded'} via {selected.payments[0] ? titleCase(selected.payments[0].method) : 'QR PH'}.</p></div>}

            {selectedRefund && (
              <div className={`mt-4 rounded-2xl border p-5 ${selectedRefund.status === 'failed' ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-[#2d2520]">Refund</h3>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#4f443c]">{titleCase(selectedRefund.status)}</span>
                </div>
                <p className="mt-2 text-sm text-[#6b5e52]">
                  Full refund: {formatPeso(selectedRefund.amount_cents)}
                  {selectedRefund.status === 'succeeded'
                    ? ' · Submitted to your original payment method.'
                    : selectedRefund.status === 'failed'
                      ? ' · Please contact the front desk for assistance.'
                      : ' · PayMongo is processing the request.'}
                </p>
                {selectedRefund.failure_message && <p className="mt-2 text-sm text-red-700">{selectedRefund.failure_message}</p>}
              </div>
            )}

            {confirmingCancel && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5"><h3 className="font-semibold text-red-900">Cancel this reservation?</h3><p className="mt-2 text-sm leading-6 text-red-800">{selected.payment_status === 'paid' ? `We will request a full ${formatPeso(selected.subtotal_cents)} refund from PayMongo. The seats are released only after PayMongo accepts the request. Refund arrival time depends on your payment provider.` : 'The seats will be released immediately. This action cannot be undone.'}</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={() => setConfirmingCancel(false)} disabled={Boolean(action)} className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-800">Keep reservation</button><button type="button" onClick={() => void cancelBooking()} disabled={Boolean(action)} className="inline-flex items-center gap-2 rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{action === 'cancel' && <Loader2 className="h-4 w-4 animate-spin" />}{selected.payment_status === 'paid' ? 'Cancel and refund' : 'Confirm cancellation'}</button></div></div>}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={beginEdit} disabled={!canChangeBooking(selected, now) || Boolean(action)} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d8c9b9] bg-white px-4 py-3 text-sm font-semibold text-[#4f443c] hover:bg-[#fff8ed] disabled:cursor-not-allowed disabled:opacity-45"><Pencil className="h-4 w-4" />Reschedule or change seats</button>
              <button type="button" onClick={() => void resendPass()} disabled={!canResendPass(selected, now) || Boolean(action)} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d8c9b9] bg-white px-4 py-3 text-sm font-semibold text-[#4f443c] hover:bg-[#fff8ed] disabled:cursor-not-allowed disabled:opacity-45">{action === 'resend' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}Resend QR pass</button>
              <button type="button" onClick={() => void createReceipt()} disabled={selected.payment_status !== 'paid' || Boolean(action)} className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d8c9b9] bg-white px-4 py-3 text-sm font-semibold text-[#4f443c] hover:bg-[#fff8ed] disabled:cursor-not-allowed disabled:opacity-45">{action === 'receipt' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download receipt</button>
              <button type="button" onClick={() => setConfirmingCancel(true)} disabled={!canCancelBooking(selected, now) || Boolean(action)} className="inline-flex items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-45"><X className="h-4 w-4" />Cancel reservation</button>
            </div>
            {selected.status === 'confirmed' && !canChangeBooking(selected, now) && new Date(selected.starts_at).getTime() > now && <p className="mt-2 text-sm leading-6 text-[#6b5e52]">Online schedule and seat changes close two hours before check-in.</p>}
          </> : draft && <>
            <div className="mt-6 rounded-2xl border border-[#eee4d7] bg-[#faf7f2] p-5">
              <h3 className="text-xl font-semibold text-[#2d2520]">Change schedule or seats</h3>
              <p className="mt-2 text-sm leading-6 text-[#6b5e52]">The duration and paid total stay unchanged. You may select up to {selected.seat_ids.length} seat{selected.seat_ids.length === 1 ? '' : 's'}, matching the number originally paid for.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-[#4f443c]">Date<input type="date" min={new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })} max={maximumBookingDate(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }), bookingSettings.maximum_advance_days)} value={draft.date} onChange={(event) => { const date = event.target.value; const validTimes = reservationTimeOptions(date, businessHours).filter(([time]) => selected.duration_hours <= hoursAvailableFrom(date, time, businessHours) && meetsMinimumNotice(reservationDateForTime(date, time, businessHours), time, bookingSettings.minimum_notice_minutes)); setDraft({ ...draft, date, time: validTimes.some(([time]) => time === draft.time) ? draft.time : validTimes[0]?.[0] ?? '' }); }} disabled={configurationLoading} className="mt-2 w-full rounded-xl border border-[#d8c9b9] bg-white px-4 py-3 font-normal text-[#2d2520] outline-none focus:border-[#e5a930] disabled:opacity-60" /></label>
                <label className="text-sm font-semibold text-[#4f443c]">Start time<select value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} disabled={configurationLoading || Boolean(selectedClosure) || rescheduleTimes.length === 0} className="mt-2 w-full rounded-xl border border-[#d8c9b9] bg-white px-4 py-3 font-normal text-[#2d2520] outline-none focus:border-[#e5a930] disabled:opacity-60"><option value="">Choose a time</option>{rescheduleTimes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              </div>
              {selectedClosure && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>{selectedClosure.name}:</strong> This date is closed. Please choose another date.</p>}
              {!selectedClosure && !configurationLoading && rescheduleTimes.length === 0 && <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">The selected date does not have enough operating hours for this reservation.</p>}
              {configurationError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{configurationError}</p>}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><h4 className="font-semibold text-[#4f443c]">Choose seats from the floor plan</h4>{availabilityLoading && <span className="flex items-center gap-1.5 text-xs text-[#8a671a]"><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking live availability…</span>}</div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#6b5e52]"><span className="flex items-center gap-2"><span className="h-5 w-5 rounded-md bg-[#e8e8e8]" />Available</span><span className="flex items-center gap-2"><span className="h-5 w-5 rounded-md bg-[#9ca3af]" />Reserved</span><span className="flex items-center gap-2"><span className="h-5 w-5 rounded-md bg-[#3b82f6]" />Selected ({draft.seats.length}/{selected.seat_ids.length})</span></div>
              <div className="mt-4 rounded-2xl border border-[#e2d8ca] bg-[#f3f0eb] p-2 sm:p-4"><p className="mb-3 px-1 text-xs text-[#7b6b5d] sm:hidden">Swipe sideways to explore the full floor plan.</p><SeatingPlan renderSeat={renderEditSeat} /></div>
              {!availabilityLoading && availableSeatCodes.size === 0 && <p className="mt-3 text-sm text-[#6b5e52]">No seats are available for this time.</p>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-sm"><span className="text-[#6b5e52]">Selected: {draft.seats.join(', ') || 'None'}</span><span className={selectedSeatTotal === selected.subtotal_cents ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>{formatPeso(selectedSeatTotal)} / {formatPeso(selected.subtotal_cents)}</span></div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => { setEditing(false); setDraft(null); setError(''); }} disabled={Boolean(action)} className="rounded-full border border-[#d8c9b9] bg-white px-5 py-3 text-sm font-semibold text-[#4f443c]">Discard changes</button><button type="button" onClick={() => void saveChanges()} disabled={Boolean(action) || configurationLoading || Boolean(configurationError) || Boolean(selectedClosure) || !draft.time || availabilityLoading || !editHasChanges || draft.seats.length === 0 || selectedSeatTotal !== selected.subtotal_cents} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#e5a930] px-5 py-3 text-sm font-semibold text-white hover:bg-[#d69520] disabled:cursor-not-allowed disabled:opacity-45">{action === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}Save reservation</button></div>
          </>}
        </div>
      </div>, document.body)}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wider text-[#7b6b5d]">{label}</p><p className="mt-1 break-words text-sm font-medium text-[#2d2520]">{value}</p></div>;
}
