"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, XAxis, YAxis } from 'recharts';
import { Armchair, CalendarRange, Download, Loader2, ReceiptText, TrendingUp, UserRoundCheck, Users } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/app/components/chart';
import {
  currentBusinessDateKey,
  formatReportPeriod,
  getReportRange,
  summarizeReport,
  type ReportBooking,
  type ReportMetric,
  type ReportPeriod,
  type ReportWalkIn,
} from '@/lib/business-reports';
import { createClient } from '@/lib/supabase/client';

const chartConfigs = {
  revenue: {
    reservationRevenue: { label: 'Reservations', color: '#6b5e52' },
    walkInRevenue: { label: 'Walk-ins', color: '#e5a930' },
  },
  visits: {
    reservations: { label: 'Reservations', color: '#6b5e52' },
    walkIns: { label: 'Walk-ins', color: '#e5a930' },
  },
  occupancy: { rate: { label: 'Occupancy', color: '#c4841a' } },
  payments: { amount: { label: 'Revenue', color: '#e5a930' } },
};
const peso = (centavos: number) => `₱${Math.round(centavos / 100).toLocaleString('en-PH')}`;
const dateLabel = (value: string, yearly: boolean) => new Date(`${value}T00:00:00Z`).toLocaleDateString('en-PH', {
  timeZone: 'UTC', month: yearly ? 'short' : undefined, day: yearly ? undefined : 'numeric', weekday: yearly ? undefined : 'short',
});
const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<ReportPeriod>('monthly');
  const [anchorDate, setAnchorDate] = useState(currentBusinessDateKey);
  const [metrics, setMetrics] = useState<ReportMetric[]>([]);
  const [bookings, setBookings] = useState<ReportBooking[]>([]);
  const [walkIns, setWalkIns] = useState<ReportWalkIn[]>([]);
  const [activeMembers, setActiveMembers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const range = useMemo(() => getReportRange(period, anchorDate), [anchorDate, period]);

  const loadReport = useCallback(async () => {
    setLoading(true); setError('');
    const supabase = createClient();
    const metricResult = await supabase.rpc('get_business_report', {
      p_start_date: range.startDate,
      p_end_date: range.endDate,
    });
    if (metricResult.error) {
      setError(metricResult.error.message); setLoading(false); return;
    }

    const allBookings: ReportBooking[] = [];
    const allWalkIns: ReportWalkIn[] = [];
    for (let from = 0; ; from += 1000) {
      const result = await supabase.from('bookings')
        .select('id, reservation_code, booking_date, guest_name, status, payment_status, subtotal_cents, duration_hours, seat_ids')
        .gte('booking_date', range.startDate).lte('booking_date', range.endDate)
        .order('booking_date', { ascending: false }).range(from, from + 999);
      if (result.error) { setError(result.error.message); setLoading(false); return; }
      allBookings.push(...(result.data ?? []));
      if ((result.data?.length ?? 0) < 1000) break;
    }
    for (let from = 0; ; from += 1000) {
      const result = await supabase.from('walk_in_occupancies')
        .select('id, business_date, guest_name, started_at, ended_at, billable_minutes, service_name, charged_amount_cents, payment_method, payment_status, status, seat:seats(code, zone)')
        .gte('business_date', range.startDate).lte('business_date', range.endDate)
        .order('business_date', { ascending: false }).range(from, from + 999);
      if (result.error) { setError(result.error.message); setLoading(false); return; }
      allWalkIns.push(...((result.data ?? []) as ReportWalkIn[]));
      if ((result.data?.length ?? 0) < 1000) break;
    }
    const memberResult = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer').eq('is_active', true);
    if (memberResult.error) { setError(memberResult.error.message); setLoading(false); return; }

    setMetrics(metricResult.data ?? []);
    setBookings(allBookings);
    setWalkIns(allWalkIns);
    setActiveMembers(memberResult.count ?? 0);
    setLoading(false);
  }, [range.endDate, range.startDate]);

  useEffect(() => { queueMicrotask(() => void loadReport()); }, [loadReport]);

  const analysis = useMemo(() => summarizeReport(metrics), [metrics]);
  const completedWalkIns = walkIns.filter((walkIn) => walkIn.status === 'completed');
  const averageStayMinutes = completedWalkIns.length
    ? Math.round(completedWalkIns.reduce((sum, walkIn) => sum + (walkIn.billable_minutes ?? 0), 0) / completedWalkIns.length)
    : 0;
  const averageTicket = analysis.visits ? analysis.revenue / analysis.visits : 0;

  const chartData = useMemo(() => {
    if (period !== 'yearly') return metrics.map((metric) => ({
      label: dateLabel(metric.report_date, false),
      reservationRevenue: metric.reservation_revenue_cents,
      walkInRevenue: metric.walk_in_revenue_cents,
      reservations: metric.reservation_count,
      walkIns: metric.walk_in_count,
      rate: metric.available_seat_hours ? Math.round((Number(metric.occupied_seat_hours) / Number(metric.available_seat_hours)) * 100) : 0,
    }));
    const months = new Map<string, { label: string; reservationRevenue: number; walkInRevenue: number; reservations: number; walkIns: number; occupied: number; available: number; rate: number }>();
    for (const metric of metrics) {
      const key = metric.report_date.slice(0, 7);
      const item = months.get(key) ?? { label: dateLabel(`${key}-01`, true), reservationRevenue: 0, walkInRevenue: 0, reservations: 0, walkIns: 0, occupied: 0, available: 0, rate: 0 };
      item.reservationRevenue += metric.reservation_revenue_cents;
      item.walkInRevenue += metric.walk_in_revenue_cents;
      item.reservations += metric.reservation_count;
      item.walkIns += metric.walk_in_count;
      item.occupied += Number(metric.occupied_seat_hours);
      item.available += Number(metric.available_seat_hours);
      item.rate = item.available ? Math.round((item.occupied / item.available) * 100) : 0;
      months.set(key, item);
    }
    return [...months.values()];
  }, [metrics, period]);

  const paymentData = [
    { method: 'Cash', amount: analysis.cash },
    { method: 'GCash', amount: analysis.gcash },
    { method: 'QRPh', amount: analysis.qrph },
    { method: 'Other', amount: analysis.other },
  ];

  const exportPdf = async () => {
    setExporting(true); setError('');
    try {
      const { exportBusinessReportPdf } = await import('@/lib/export-business-report');
      await exportBusinessReportPdf({ period, ...range, metrics, bookings, walkIns, activeMembers });
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'The PDF could not be generated.');
    } finally {
      setExporting(false);
    }
  };

  return <div className="mx-auto max-w-[1500px]">
    <div className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-[#b47b0d]">Live business analytics</p><h1 className="text-3xl font-semibold tracking-tight text-[#2d2520] sm:text-4xl">Performance & owner reports</h1><p className="mt-2 max-w-3xl text-[#5f5248]">Reservations and walk-ins are combined into one operational and financial view.</p><p className="mt-1 text-xs font-medium text-[#6b5e52]">{formatReportPeriod(period, range.startDate, range.endDate)} · business day starts at 8:00 AM</p></div>
      <div className="grid w-full gap-2 rounded-2xl border border-[#e8dfd4] bg-white px-2 py-4 shadow-sm sm:grid-cols-[minmax(145px,1fr)_minmax(155px,1fr)_auto] xl:w-auto"><label className="min-w-0"><span className="mb-1 block px-1 text-[11px] font-semibold uppercase tracking-wider text-[#5f5248]">Report type</span><select value={period} onChange={(event) => setPeriod(event.target.value as ReportPeriod)} className="h-11 w-full rounded-xl border border-[#cfc3b6] bg-white px-3 text-sm font-semibold text-[#2d2520]"><option value="daily">Daily report</option><option value="weekly">Weekly report</option><option value="monthly">Monthly report</option><option value="yearly">Yearly report</option></select></label><label className="min-w-0"><span className="mb-1 block px-1 text-[11px] font-semibold uppercase tracking-wider text-[#5f5248]">Business date</span><input type="date" value={anchorDate} onChange={(event) => setAnchorDate(event.target.value)} className="h-11 w-full rounded-xl border border-[#cfc3b6] px-3 text-sm text-[#2d2520]" /></label><button onClick={() => void exportPdf()} disabled={loading || exporting} className="inline-flex h-11 items-center justify-center gap-2 self-end whitespace-nowrap rounded-xl bg-[#c4841a] px-4 text-sm font-semibold text-white hover:bg-[#a86f12] disabled:opacity-60">{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{exporting ? 'Creating PDF…' : 'Export PDF'}</button></div>
    </div>

    {error && <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{error}</div>}
    {loading ? <div className="flex min-h-[55vh] items-center justify-center text-[#5f5248]"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Calculating live business report…</div> : <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total revenue" value={peso(analysis.revenue)} detail={`${peso(analysis.reservationRevenue)} reservations · ${peso(analysis.walkInRevenue)} walk-ins`} icon={TrendingUp} />
        <Kpi label="Customers served" value={String(analysis.visits)} detail={`${analysis.reservations} reservations · ${analysis.walkIns} walk-ins`} icon={UserRoundCheck} />
        <Kpi label="Seat utilization" value={`${analysis.occupancy}%`} detail={`${analysis.occupiedHours.toFixed(1)} occupied seat-hours`} icon={Armchair} />
        <Kpi label="Outstanding" value={peso(analysis.outstanding)} detail="Unpaid completed walk-ins" icon={ReceiptText} />
        <Kpi label="Average daily income" value={peso(analysis.averageDailyRevenue)} detail={`${metrics.length} reporting day${metrics.length === 1 ? '' : 's'}`} icon={CalendarRange} />
        <Kpi label="Average ticket" value={peso(averageTicket)} detail="Revenue per recorded visit" icon={ReceiptText} />
        <Kpi label="Average walk-in stay" value={`${Math.floor(averageStayMinutes / 60)}h ${averageStayMinutes % 60}m`} detail={`${completedWalkIns.length} completed walk-ins`} icon={Users} />
        <Kpi label="Active members" value={String(activeMembers)} detail="Current customer accounts" icon={Users} />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <ChartCard title="Revenue by customer source" subtitle={formatReportPeriod(period, range.startDate, range.endDate)}><ChartContainer config={chartConfigs.revenue} className="h-[300px] w-full aspect-auto"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis tickFormatter={(value) => `₱${Math.round(value / 10000) / 10}k`} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent formatter={(value, name) => [peso(Number(value)), name === 'reservationRevenue' ? 'Reservations' : 'Walk-ins']} />} /><Legend /><Bar name="Reservations" dataKey="reservationRevenue" stackId="revenue" fill="var(--color-reservationRevenue)" /><Bar name="Walk-ins" dataKey="walkInRevenue" stackId="revenue" fill="var(--color-walkInRevenue)" radius={[6, 6, 0, 0]} /></BarChart></ChartContainer></ChartCard>
        <ChartCard title="Customer visits" subtitle="Reservations compared with walk-ins"><ChartContainer config={chartConfigs.visits} className="h-[300px] w-full aspect-auto"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Legend /><Bar name="Reservations" dataKey="reservations" stackId="visits" fill="var(--color-reservations)" /><Bar name="Walk-ins" dataKey="walkIns" stackId="visits" fill="var(--color-walkIns)" radius={[6, 6, 0, 0]} /></BarChart></ChartContainer></ChartCard>
      </div>
      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <ChartCard title="Seat utilization" subtitle="Actual reservation check-ins and walk-in stays"><ChartContainer config={chartConfigs.occupancy} className="h-[270px] w-full aspect-auto"><AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} /><YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent formatter={(value) => [`${value}%`, 'Utilization']} />} /><Area dataKey="rate" stroke="var(--color-rate)" fill="var(--color-rate)" fillOpacity={0.18} strokeWidth={3} /></AreaChart></ChartContainer></ChartCard>
        <ChartCard title="Walk-in payment mix" subtitle="Paid walk-in revenue"><ChartContainer config={chartConfigs.payments} className="h-[270px] w-full aspect-auto"><BarChart data={paymentData} layout="vertical"><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tickFormatter={(value) => `₱${Math.round(value / 100)}`} tickLine={false} axisLine={false} /><YAxis dataKey="method" type="category" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent formatter={(value) => [peso(Number(value)), 'Revenue']} />} /><Bar dataKey="amount" fill="var(--color-amount)" radius={[0, 7, 7, 0]} /></BarChart></ChartContainer></ChartCard>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <DetailCard title="Reservation activity" subtitle={`${bookings.length} records in this report`}><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm text-[#2d2520]"><thead className="text-xs font-semibold uppercase tracking-wider text-[#3f3630]"><tr><th className="px-2 py-3">Date</th><th className="px-2 py-3">Reservation</th><th className="px-2 py-3">Customer</th><th className="px-2 py-3">Status</th><th className="px-2 py-3 text-right">Amount</th></tr></thead><tbody className="text-[#2d2520]">{bookings.slice(0, 50).map((booking) => <tr key={booking.id} className="border-t border-[#eee6dc]"><td className="px-2 py-3">{booking.booking_date}</td><td className="px-2 py-3 font-mono text-xs font-semibold text-[#6f5010]">{booking.reservation_code}</td><td className="px-2 py-3">{booking.guest_name}</td><td className="px-2 py-3">{titleCase(booking.status)}</td><td className="px-2 py-3 text-right font-semibold">{peso(booking.subtotal_cents)}</td></tr>)}</tbody></table></div>{bookings.length > 50 && <p className="mt-3 text-xs text-[#6b5e52]">Showing 50 of {bookings.length}. The PDF contains every record.</p>}</DetailCard>
        <DetailCard title="Walk-in activity" subtitle={`${walkIns.length} records in this report`}><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm text-[#2d2520]"><thead className="text-xs font-semibold uppercase tracking-wider text-[#3f3630]"><tr><th className="px-2 py-3">Date</th><th className="px-2 py-3">Customer</th><th className="px-2 py-3">Seat</th><th className="px-2 py-3">Service</th><th className="px-2 py-3 text-right">Amount</th></tr></thead><tbody className="text-[#2d2520]">{walkIns.slice(0, 50).map((walkIn) => <tr key={walkIn.id} className="border-t border-[#eee6dc]"><td className="px-2 py-3">{walkIn.business_date}</td><td className="px-2 py-3">{walkIn.guest_name || 'Walk-in guest'}</td><td className="px-2 py-3">{walkIn.seat?.code ?? '—'}</td><td className="px-2 py-3">{walkIn.service_name ?? titleCase(walkIn.status)}</td><td className="px-2 py-3 text-right font-semibold">{peso(walkIn.charged_amount_cents ?? 0)}</td></tr>)}</tbody></table></div>{walkIns.length > 50 && <p className="mt-3 text-xs text-[#6b5e52]">Showing 50 of {walkIns.length}. The PDF contains every record.</p>}</DetailCard>
      </div>
    </>}
  </div>;
}

function Kpi({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: React.ComponentType<{ className?: string }> }) { return <div className="rounded-3xl border border-[#e8dfd4] bg-white p-5 shadow-sm"><span className="inline-flex rounded-xl bg-[#fef3dc] p-2.5 text-[#b47b0d]"><Icon className="h-5 w-5" /></span><p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[#5f5248]">{label}</p><p className="mt-1 text-3xl font-semibold text-[#2d2520]">{value}</p><p className="mt-1 text-sm leading-5 text-[#5f5248]">{detail}</p></div>; }
function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-[#e8dfd4] bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-[#2d2520]">{title}</h2><p className="mb-4 text-sm text-[#5f5248]">{subtitle}</p>{children}</section>; }
function DetailCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-[#e8dfd4] bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-[#2d2520]">{title}</h2><p className="mb-3 text-sm text-[#5f5248]">{subtitle}</p>{children}</section>; }
