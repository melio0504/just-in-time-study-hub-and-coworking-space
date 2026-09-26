"use client";

import { Suspense, useCallback, useState, useRef, useEffect } from 'react';
import { Calendar, Clock, ChevronLeft, ChevronRight, X, QrCode, AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { SeatingPlan } from '@/app/components/SeatingPlan';
import { allSeatIds, getReservedSeatsForDate } from '@/lib/seats';
import { createBooking } from '@/lib/supabase/bookings';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';

type SeatStatus = 'available' | 'reserved' | 'selected';

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

const RESERVATION_DRAFT_KEY = 'jit-reservation-draft';
const VALID_RESERVATION_TIMES = new Set([
  '8:00', '9:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00',
]);
const VALID_RESERVATION_DURATIONS = new Set(['1', '2', '3', '4', '6', '8']);

const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isPastDate = (date: Date) => startOfDay(date) < startOfDay(new Date());

function ReserveContent() {
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    date: getTodayString(),
    time: '',
    duration: '',
    space: '',
  });

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const calendarRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'pending' | 'success'>('pending');
  const [reservationId, setReservationId] = useState('');
  const [lastSelectedSeats, setLastSelectedSeats] = useState<string[]>([]);
  const [hasAppliedSeatParam, setHasAppliedSeatParam] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberIdentity, setMemberIdentity] = useState<MemberIdentity | null>(null);
  const [isIdentityLoading, setIsIdentityLoading] = useState(isSupabaseConfigured);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

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
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const email = user.email ?? '';
      const metadataName = typeof user.user_metadata.full_name === 'string'
        ? user.user_metadata.full_name.trim()
        : '';
      const name = profile?.full_name.trim()
        || metadataName
        || email.split('@')[0]
        || 'Member';

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

  const closePaymentModal = () => {
    setIsModalOpen(false);
    setPaymentStep('pending');
  };

  const formatTimeLabel = (time: string) => {
    if (!time) return '';
    const [hourStr] = time.split(':');
    const hour = parseInt(hourStr, 10);
    if (hour === 0) return '12:00 AM';
    if (hour < 12) return `${hour}:00 AM`;
    if (hour === 12) return '12:00 PM';
    return `${hour - 12}:00 PM`;
  };

  const initializeSeats = useCallback((date: string, selectedSeats: string[] = []): Seat[] => {
    const reservedSeats = getReservedSeatsForDate(date);
    return allSeatIds.map(id => ({
      id,
      status: reservedSeats.includes(id) ? 'reserved' : (selectedSeats.includes(id) ? 'selected' : 'available')
    }));
  }, []);

  const [seats, setSeats] = useState<Seat[]>(initializeSeats(getTodayString()));

  useEffect(() => {
    const restoreDraft = window.setTimeout(() => {
      try {
        const storedDraft = window.localStorage.getItem(RESERVATION_DRAFT_KEY);
        if (!storedDraft) return;

        const draft = JSON.parse(storedDraft) as Partial<ReservationDraft>;
        const parsedDate = typeof draft.date === 'string'
          ? new Date(`${draft.date}T00:00:00`)
          : null;
        const date = parsedDate
          && !Number.isNaN(parsedDate.getTime())
          && !isPastDate(parsedDate)
          ? draft.date as string
          : getTodayString();
        const time = typeof draft.time === 'string' && VALID_RESERVATION_TIMES.has(draft.time)
          ? draft.time
          : '';
        const duration = typeof draft.duration === 'string'
          && VALID_RESERVATION_DURATIONS.has(draft.duration)
          ? draft.duration
          : '';
        const seatIds = Array.isArray(draft.seatIds)
          ? draft.seatIds
            .filter((seatId): seatId is string => (
              typeof seatId === 'string' && allSeatIds.includes(seatId)
            ))
            .slice(0, 5)
          : [];

        setFormData((current) => ({ ...current, date, time, duration }));
        setCurrentMonth(new Date(`${date}T00:00:00`));
        setSeats(initializeSeats(date, seatIds));
      } catch {
        window.localStorage.removeItem(RESERVATION_DRAFT_KEY);
      } finally {
        setHasRestoredDraft(true);
      }
    }, 0);

    return () => window.clearTimeout(restoreDraft);
  }, [initializeSeats]);

  useEffect(() => {
    if (!hasRestoredDraft) return;

    const draft: ReservationDraft = {
      date: formData.date,
      time: formData.time,
      duration: formData.duration,
      seatIds: seats
        .filter((seat) => seat.status === 'selected')
        .map((seat) => seat.id),
    };

    window.localStorage.setItem(RESERVATION_DRAFT_KEY, JSON.stringify(draft));
  }, [formData.date, formData.duration, formData.time, hasRestoredDraft, seats]);

  useEffect(() => {
    if (!hasRestoredDraft || hasAppliedSeatParam) {
      return;
    }

    const seatParam = searchParams.get('seat');
    if (!seatParam) {
      return;
    }

    const applySeatParam = window.setTimeout(() => {
      const normalizedSeat = seatParam.trim().toUpperCase();
      if (allSeatIds.includes(normalizedSeat)) {
        const reservedSeats = getReservedSeatsForDate(formData.date);
        if (!reservedSeats.includes(normalizedSeat)) {
          setSeats((currentSeats) => {
            const selectedSeatIds = currentSeats
              .filter((seat) => seat.status === 'selected')
              .map((seat) => seat.id);
            const mergedSeatIds = Array.from(new Set([...selectedSeatIds, normalizedSeat])).slice(0, 5);
            return initializeSeats(formData.date, mergedSeatIds);
          });
        }
      }
      setHasAppliedSeatParam(true);
    }, 0);

    return () => window.clearTimeout(applySeatParam);
  }, [formData.date, hasAppliedSeatParam, hasRestoredDraft, initializeSeats, searchParams]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });

    if (name === 'date') {
      const currentSelected = seats.filter(s => s.status === 'selected').map(s => s.id);
      setSeats(initializeSeats(value, currentSelected));
    }
  };

  const handleDateSelect = (date: Date) => {
    if (isPastDate(date)) return;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    setFormData({
      ...formData,
      date: dateString,
    });

    const currentSelected = seats.filter(s => s.status === 'selected').map(s => s.id);
    setSeats(initializeSeats(dateString, currentSelected));
    setIsCalendarOpen(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Select Date';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
    const month = String(date1.getMonth() + 1).padStart(2, '0');
    const day = String(date1.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}` === date2String;
  };

  const canGoToPreviousMonth = () => {
    const today = new Date();
    const viewYear = currentMonth.getFullYear();
    const viewMonth = currentMonth.getMonth();
    return viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth());
  };

  const handleSeatClick = (seatId: string) => {
    const seat = seats.find(s => s.id === seatId);
    if (!seat || seat.status === 'reserved') return;

    const selectedCount = seats.filter(s => s.status === 'selected').length;

    setSeats(seats.map(s => {
      if (s.id === seatId) {
        if (s.status === 'selected') {
          return { ...s, status: 'available' };
        } else if (selectedCount < 5) {
          return { ...s, status: 'selected' };
        }
      }
      return s;
    }));
  };

  const handleClearSelectedSeats = () => {
    setSeats(initializeSeats(formData.date));
  };

  const getSeatStatus = (seatId: string): SeatStatus => {
    return seats.find(s => s.id === seatId)?.status || 'available';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookingError('');

    if (!isSupabaseConfigured) {
      setBookingError('Supabase is not configured. Add your project values to .env.');
      return;
    }

    const selectedSeats = seats.filter(s => s.status === 'selected').map(s => s.id);

    setIsSubmitting(true);
    try {
      const booking = await createBooking({
        guestName: formData.name,
        guestEmail: formData.email,
        bookingDate: formData.date,
        startTime: formData.time,
        durationHours: Number(formData.duration),
        space: formData.space || 'study-seat',
        seatCodes: selectedSeats,
      });
      setReservationId(booking.reservation_code);
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Unable to create booking.');
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setLastSelectedSeats(selectedSeats);
    setPaymentStep('pending');
    setIsModalOpen(true);
  };

  const handleDemoPaid = () => {
    setPaymentStep('success');
  };

  const renderSeatButton = (id: string) => {
    const status = getSeatStatus(id);
    const colors = {
      available: 'bg-[#e8e8e8] hover:bg-[#d0d0d0] cursor-pointer text-[#2d2520]',
      reserved: 'bg-[#9ca3af] cursor-not-allowed text-white',
      selected: 'bg-[#3b82f6] cursor-pointer text-white'
    };

    return (
      <button
        key={id}
        type="button"
        onClick={() => handleSeatClick(id)}
        className={`w-14 h-14 shrink-0 rounded-xl ${colors[status]} transition-all text-xs font-medium flex items-center justify-center`}
        disabled={status === 'reserved'}
      >
        {id}
      </button>
    );
  };

  const selectedCount = seats.filter(s => s.status === 'selected').length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fffcf7] to-[#fff8ed] pt-20 sm:pt-24">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 sm:py-16">
        <div className="mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-5xl mb-3 sm:mb-4 text-[#2d2520]">Reserve Your Desk</h1>
          <p className="text-base sm:text-lg text-[#6b5e52] max-w-xl">
            Select your preferred seat from the floor plan below. You can choose up to 5 seats.
          </p>
        </div>

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
                  <span className="text-[#6b5e52]">Selected ({selectedCount}/5)</span>
                </div>
              </div>
            </div>
            <div className="w-full sm:w-72 lg:w-64 relative" ref={calendarRef}>
              <label className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Select Date
              </label>
              <button
                type="button"
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                className="w-full px-4 py-3 rounded-xl border border-[#f3ede4] bg-white focus:outline-none focus:ring-2 focus:ring-[#e5a930] transition-all text-left flex items-center justify-between"
              >
                <span className="text-[#2d2520]">{formatDate(formData.date)}</span>
                <Calendar className="w-4 h-4 text-[#6b5e52]" />
              </button>

              {isCalendarOpen && (
                <div className="absolute top-full mt-2 inset-x-0 bg-white rounded-2xl shadow-2xl border border-[#f3ede4] p-3 sm:p-4 z-50 w-full sm:w-80 sm:left-auto sm:right-0">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      type="button"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                      disabled={!canGoToPreviousMonth()}
                      className="p-2 hover:bg-[#f3ede4] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    >
                      <ChevronLeft className="w-5 h-5 text-[#6b5e52]" />
                    </button>
                    <span className="text-lg text-[#2d2520]">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                      className="p-2 hover:bg-[#f3ede4] rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-[#6b5e52]" />
                    </button>
                  </div>

                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                      <div key={day} className="text-center text-xs text-[#6b5e52] py-2">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {getDaysInMonth(currentMonth).map((day, index) => {
                      const past = day ? isPastDate(day) : false;
                      return (
                        <div key={index}>
                          {day ? (
                            <button
                              type="button"
                              onClick={() => handleDateSelect(day)}
                              disabled={past}
                              className={`w-full aspect-square rounded-lg text-sm transition-all ${past
                                ? 'text-[#c4b8ab] cursor-not-allowed'
                                : isSameDay(day, formData.date)
                                  ? 'bg-[#e5a930] text-white'
                                  : 'hover:bg-[#f3ede4] text-[#2d2520]'
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
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl sm:rounded-2xl border border-[#e8e0d4] bg-[#f3f0eb] p-2 sm:p-6">
            <p className="text-sm text-[#6b5e52] mb-1 sm:mb-4 px-1 sm:px-0">
              Layout follows the in-store floor plan — tap a seat to select (up to 5).
            </p>
            <p className="text-xs text-[#8b7355] mb-3 px-1 sm:hidden">
              Swipe sideways to explore the full floor plan.
            </p>
            <SeatingPlan renderSeat={renderSeatButton} />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/70 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-lg">
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

          <div className="grid md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div>
              <label className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2">
                <Clock className="inline w-4 h-4 mr-1" />
                Time
              </label>
              <select
                name="time"
                value={formData.time}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-xl border border-[#f3ede4] bg-white focus:outline-none focus:ring-2 focus:ring-[#e5a930] transition-all text-[#2d2520]"
              >
                <option value="">Select time</option>
                <option value="8:00">8:00 AM</option>
                <option value="9:00">9:00 AM</option>
                <option value="10:00">10:00 AM</option>
                <option value="11:00">11:00 AM</option>
                <option value="12:00">12:00 PM</option>
                <option value="13:00">1:00 PM</option>
                <option value="14:00">2:00 PM</option>
                <option value="15:00">3:00 PM</option>
                <option value="16:00">4:00 PM</option>
                <option value="17:00">5:00 PM</option>
                <option value="18:00">6:00 PM</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2">
                Duration
              </label>
              <select
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 rounded-xl border border-[#f3ede4] bg-white focus:outline-none focus:ring-2 focus:ring-[#e5a930] transition-all text-[#2d2520]"
              >
                <option value="">Select duration</option>
                <option value="1">1 hour</option>
                <option value="2">2 hours</option>
                <option value="3">3 hours</option>
                <option value="4">4 hours</option>
                <option value="6">6 hours</option>
                <option value="8">Full day (8 hours)</option>
              </select>
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
                {seats.filter(s => s.status === 'selected').map(s => s.id).join(', ')}
              </p>
            </div>
          )}

          {bookingError && (
            <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {bookingError}
            </p>
          )}

          <button
            type="submit"
            disabled={selectedCount === 0 || isSubmitting}
            className={`w-full min-h-12 cursor-pointer bg-[#e5a930] text-white px-5 sm:px-8 py-3 sm:py-4 rounded-full transition-[background-color,box-shadow] duration-200 enabled:hover:bg-[#d69520] enabled:hover:shadow-lg ${selectedCount === 0 || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
          >
            {isSubmitting
              ? 'Saving Reservation…'
              : `Confirm Reservation${selectedCount > 0 ? ` (${selectedCount} seat${selectedCount > 1 ? 's' : ''})` : ''}`}
          </button>
        </form>
      </div>

      {/* Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#f3ede4] [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:my-4 [&::-webkit-scrollbar-thumb]:bg-[#e5a930] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-[#d69520]">
            <div className="p-5 sm:p-8">
              {paymentStep === 'pending' ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl sm:text-3xl text-[#2d2520]">Complete Payment</h2>
                    <button
                      type="button"
                      onClick={closePaymentModal}
                      className="p-2 hover:bg-[#f3ede4] rounded-full transition-colors"
                    >
                      <X className="w-6 h-6 text-[#6b5e52]" />
                    </button>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-[#6b5e52] mb-1">Reservation ID</p>
                    <p className="text-lg text-[#2d2520] mb-2">{reservationId}</p>
                    {lastSelectedSeats.length > 0 && (
                      <p className="text-sm text-[#6b5e52]">Seats: {lastSelectedSeats.join(', ')}</p>
                    )}
                  </div>

                  <div className="mb-6">
                    <p className="text-sm text-[#6b5e52] uppercase tracking-wider mb-3">GCash Payment QR Code</p>
                    <div className="bg-[#f9f9f9] border-2 border-dashed border-[#d1d5db] rounded-2xl p-4 sm:p-8 flex flex-col items-center justify-center">
                      <QrCode className="w-36 h-36 sm:w-48 sm:h-48 text-[#6b5e52] mb-4" />
                      <p className="text-sm text-[#6b5e52] text-center">Scan this QR code with your GCash app to complete payment</p>
                    </div>
                  </div>

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
                        <span><strong>No Refund:</strong> All reservations are non-refundable once confirmed.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#e5a930] mt-1">•</span>
                        <span><strong>20-Minute Grace Period:</strong> If you do not arrive within 20 minutes after your reservation time, your seat will be made available to others.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#e5a930] mt-1">•</span>
                        <span><strong>Email Confirmation:</strong> Payment confirmation will be sent to <strong>{formData.email}</strong> with your Reservation ID.</span>
                      </li>
                    </ul>
                  </div>

                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={handleDemoPaid}
                      className="w-full bg-[#22c55e] text-white px-8 py-4 rounded-full hover:shadow-xl font-medium cursor-pointer"
                    >
                      I&apos;ve Paid
                      <span className="ml-2 text-xs font-normal opacity-90">(demo)</span>
                    </button>
                    <button
                      type="button"
                      onClick={closePaymentModal}
                      className="w-full border border-[#f3ede4] text-[#6b5e52] px-8 py-3 rounded-full hover:bg-[#f3ede4] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl sm:text-3xl text-[#2d2520]">Payment Successful</h2>
                    <button
                      type="button"
                      onClick={closePaymentModal}
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
                      Thank you! Your GCash payment has been recorded.
                    </p>
                    <p className="text-sm text-[#6b5e52]">
                      Reservation <strong className="text-[#2d2520]">{reservationId}</strong> is confirmed.
                    </p>
                  </div>

                  <div className="mb-6 rounded-2xl border border-[#f3ede4] bg-[#fffcf7] p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <Mail className="w-5 h-5 text-[#e5a930] flex-shrink-0 mt-0.5" />
                      <div className="text-left">
                        <p className="text-sm font-semibold text-[#2d2520] mb-1">Check your email</p>
                        <p className="text-sm text-[#6b5e52]">
                          We sent a booking confirmation to{' '}
                          <strong className="text-[#2d2520]">{formData.email}</strong>.
                          Open it on your phone when you arrive — you will need it for self check-in.
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-[#6b5e52] uppercase tracking-wider mb-2 text-left">Your email includes</p>
                    <ul className="space-y-2 text-sm text-[#6b5e52] text-left">
                      <li className="flex items-start gap-2">
                        <span className="text-[#e5a930] mt-0.5">•</span>
                        <span><strong className="text-[#2d2520]">Official receipt number</strong> for your GCash payment</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#e5a930] mt-0.5">•</span>
                        <span><strong className="text-[#2d2520]">Unique check-in QR code</strong> linked to reservation {reservationId}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#e5a930] mt-0.5">•</span>
                        <span>
                          <strong className="text-[#2d2520]">Reservation summary</strong> — seats{' '}
                          {lastSelectedSeats.join(', ')}, {formatDate(formData.date)}
                          {formData.time && ` at ${formatTimeLabel(formData.time)}`}
                          {formData.duration && ` (${formData.duration} hour${formData.duration === '1' ? '' : 's'})`}
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#e5a930] mt-0.5">•</span>
                        <span><strong className="text-[#2d2520]">Self check-in instructions</strong> for the facility kiosk at the entrance</span>
                      </li>
                    </ul>
                  </div>

                  <div className="mb-6 border-l-4 border-[#e5a930] bg-[#fef3dc]/30 p-4 rounded-r-xl text-left">
                    <p className="text-sm font-semibold text-[#2d2520] mb-3">When you arrive</p>
                    <ol className="space-y-2 text-sm text-[#6b5e52] list-decimal list-inside">
                      <li>Arrive within <strong>20 minutes</strong> of your scheduled time or your seat may be released.</li>
                      <li>Head to the <strong>Facility Kiosk</strong> near the entrance (same flow as our in-store demo).</li>
                      <li>Select <strong>Check-In</strong> and scan the QR code from your confirmation email.</li>
                      <li>Proceed to your assigned seat{lastSelectedSeats.length > 1 ? 's' : ''}: {lastSelectedSeats.join(', ')}.</li>
                      <li>When you leave, scan the same QR at the kiosk under <strong>Check-Out</strong>.</li>
                    </ol>
                    <p className="text-xs text-[#6b5e52] mt-3">
                      The check-in kiosk is available inside the facility.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closePaymentModal}
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
