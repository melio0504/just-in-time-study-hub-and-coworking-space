import type { Database, Tables } from './supabase/database.types';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ReportMetric = Database['public']['Functions']['get_business_report']['Returns'][number];
export type ReportBooking = Pick<Tables<'bookings'>,
  'id' | 'reservation_code' | 'booking_date' | 'guest_name' | 'status' |
  'payment_status' | 'subtotal_cents' | 'duration_hours' | 'seat_ids'
>;
export type ReportWalkIn = Pick<Tables<'walk_in_occupancies'>,
  'id' | 'business_date' | 'guest_name' | 'started_at' | 'ended_at' |
  'billable_minutes' | 'service_name' | 'charged_amount_cents' |
  'payment_method' | 'payment_status' | 'status'
> & { seat: { code: string; zone: string } | null };

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function currentBusinessDateKey(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' })
    .format(new Date(now.getTime() - 8 * 60 * 60 * 1000));
}

export function getReportRange(period: ReportPeriod, anchor: string) {
  const date = parseDateKey(anchor);
  const start = new Date(date);
  const end = new Date(date);

  if (period === 'weekly') {
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    start.setUTCDate(date.getUTCDate() - mondayOffset);
    end.setUTCDate(start.getUTCDate() + 6);
  } else if (period === 'monthly') {
    start.setUTCDate(1);
    end.setUTCMonth(date.getUTCMonth() + 1, 0);
  } else if (period === 'yearly') {
    start.setUTCMonth(0, 1);
    end.setUTCMonth(11, 31);
  }

  return { startDate: dateKey(start), endDate: dateKey(end) };
}

export function formatReportPeriod(period: ReportPeriod, startDate: string, endDate: string) {
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  const date = (value: Date, options: Intl.DateTimeFormatOptions) => value.toLocaleDateString('en-PH', { timeZone: 'UTC', ...options });

  if (period === 'daily') return date(start, { dateStyle: 'long' });
  if (period === 'monthly') return date(start, { month: 'long', year: 'numeric' });
  if (period === 'yearly') return String(start.getUTCFullYear());
  return `${date(start, { month: 'short', day: 'numeric', year: 'numeric' })} – ${date(end, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export function summarizeReport(metrics: ReportMetric[]) {
  const totals = metrics.reduce((result, metric) => ({
    revenue: result.revenue + metric.revenue_cents,
    reservationRevenue: result.reservationRevenue + metric.reservation_revenue_cents,
    walkInRevenue: result.walkInRevenue + metric.walk_in_revenue_cents,
    reservations: result.reservations + metric.reservation_count,
    walkIns: result.walkIns + metric.walk_in_count,
    visits: result.visits + metric.total_visits,
    checkins: result.checkins + metric.checkins_count,
    occupiedHours: result.occupiedHours + Number(metric.occupied_seat_hours),
    availableHours: result.availableHours + Number(metric.available_seat_hours),
    outstanding: result.outstanding + metric.outstanding_walk_in_cents,
    cash: result.cash + metric.cash_revenue_cents,
    gcash: result.gcash + metric.gcash_revenue_cents,
    qrph: result.qrph + metric.qrph_revenue_cents,
    other: result.other + metric.other_revenue_cents,
  }), {
    revenue: 0, reservationRevenue: 0, walkInRevenue: 0, reservations: 0,
    walkIns: 0, visits: 0, checkins: 0, occupiedHours: 0, availableHours: 0,
    outstanding: 0, cash: 0, gcash: 0, qrph: 0, other: 0,
  });

  const busiest = [...metrics].sort((a, b) => b.total_visits - a.total_visits)[0];
  return {
    ...totals,
    occupancy: totals.availableHours ? Math.round((totals.occupiedHours / totals.availableHours) * 100) : 0,
    averageDailyRevenue: metrics.length ? Math.round(totals.revenue / metrics.length) : 0,
    busiest,
  };
}
