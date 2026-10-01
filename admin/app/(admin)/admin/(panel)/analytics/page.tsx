"use client";

import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Armchair, DollarSign, Lightbulb, Loader2, Target, TrendingUp, Users } from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/app/components/chart';
import { createClient } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/database.types';

type Metric = Tables<'daily_business_metrics'>;
const chartConfigs = {
  revenue: { revenue: { label: 'Revenue', color: '#e5a930' }, bookings: { label: 'Bookings', color: '#6b5e52' } },
  plan: { amount: { label: 'Revenue', color: '#e5a930' } },
  occupancy: { rate: { label: 'Occupancy', color: '#c4841a' } },
  checkins: { checkins: { label: 'Check-ins', color: '#6b5e52' } },
};
const peso = (centavos: number) => `₱${Math.round(centavos / 100).toLocaleString('en-PH')}`;
const percentChange = (current: number, previous: number) => previous ? Math.round(((current - previous) / previous) * 100) : 0;

function Kpi({ label, value, detail, change, icon: Icon }: { label: string; value: string; detail: string; change: number; icon: React.ComponentType<{ className?: string }> }) {
  return <div className="rounded-3xl border border-[#e8dfd4] bg-white p-5 shadow-sm"><div className="mb-4 flex items-start justify-between"><span className="rounded-xl bg-[#fef3dc] p-2.5 text-[#b47b0d]"><Icon className="h-5 w-5" /></span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${change >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{change >= 0 ? '+' : ''}{change}%</span></div><p className="text-xs font-semibold uppercase tracking-wider text-[#5f5248]">{label}</p><p className="mt-1 text-3xl font-semibold text-[#2d2520]">{value}</p><p className="mt-1 text-sm text-[#5f5248]">{detail}</p></div>;
}

export default function AdminAnalyticsPage() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    void supabase.from('daily_business_metrics').select().order('metric_date').then(({ data, error: queryError }) => { setMetrics(data ?? []); setError(queryError?.message ?? ''); setLoading(false); });
  }, []);

  const analysis = useMemo(() => {
    const months = new Map<string, { month: string; revenue: number; bookings: number; checkins: number; occupancySum: number; days: number; members: number; hourly: number; daily: number; monthly: number }>();
    for (const metric of metrics) {
      const date = new Date(`${metric.metric_date}T00:00:00`);
      const key = metric.metric_date.slice(0, 7);
      const row = months.get(key) ?? { month: date.toLocaleDateString('en-US', { month: 'short' }), revenue: 0, bookings: 0, checkins: 0, occupancySum: 0, days: 0, members: 0, hourly: 0, daily: 0, monthly: 0 };
      row.revenue += metric.revenue_cents; row.bookings += metric.bookings_count; row.checkins += metric.checkins_count; row.occupancySum += Number(metric.occupied_seat_hours) / Number(metric.available_seat_hours) * 100; row.days += 1; row.members = metric.active_members; row.hourly += metric.hourly_revenue_cents; row.daily += metric.daily_pass_revenue_cents; row.monthly += metric.monthly_revenue_cents;
      months.set(key, row);
    }
    const monthly = [...months.values()].slice(-6);
    const current = monthly.at(-1) ?? { month: '—', revenue: 0, bookings: 0, checkins: 0, occupancySum: 0, days: 1, members: 0, hourly: 0, daily: 0, monthly: 0 };
    const previous = monthly.at(-2) ?? current;
    const lastSeven = metrics.slice(-7).map((metric) => ({ day: new Date(`${metric.metric_date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }), rate: Math.round(Number(metric.occupied_seat_hours) / Number(metric.available_seat_hours) * 100), checkins: metric.checkins_count }));
    const plan = [{ plan: 'Hourly', amount: current.hourly }, { plan: 'Daily pass', amount: current.daily }, { plan: 'Monthly', amount: current.monthly }];
    const occupancy = Math.round(current.occupancySum / Math.max(current.days, 1));
    const busiest = [...lastSeven].sort((a, b) => b.rate - a.rate)[0];
    return { monthly, current, previous, lastSeven, plan, occupancy, busiest };
  }, [metrics]);

  const planLeader = [...analysis.plan].sort((a, b) => b.amount - a.amount)[0];
  const insights = [
      { title: `${planLeader?.plan ?? 'Hourly'} revenue leads`, detail: `${planLeader?.plan ?? 'The leading plan'} generated ${peso(planLeader?.amount ?? 0)} this month. Use this mix when planning promotions.`, impact: 'Revenue' },
      { title: `${analysis.busiest?.day ?? 'This week'} has the highest utilization`, detail: `Peak daily occupancy reached ${analysis.busiest?.rate ?? 0}%. Schedule front-desk coverage and cleaning around the busiest days.`, impact: 'Operations' },
      { title: `${analysis.current.bookings} bookings this month`, detail: `Booking volume changed ${percentChange(analysis.current.bookings, analysis.previous.bookings)}% compared with the previous month in the current database history.`, impact: 'Demand' },
      { title: `${analysis.occupancy}% average occupancy`, detail: analysis.occupancy < 45 ? 'There is room to test off-peak packages without affecting capacity.' : 'Utilization is healthy; watch peak-day capacity before running broad discounts.', impact: 'Capacity' },
  ];

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-[#5f5248]"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Analyzing database metrics…</div>;
  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>;

  return <div className="mx-auto max-w-[1500px]"><div className="mb-7"><p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-[#b47b0d]">Database analytics</p><h1 className="text-3xl font-semibold tracking-tight text-[#2d2520] sm:text-4xl">Performance & insights</h1><p className="mt-2 text-[#5f5248]">Every chart is calculated from business metrics stored in Supabase.</p></div>
    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Monthly revenue" value={peso(analysis.current.revenue)} detail={`${analysis.current.bookings} bookings`} change={percentChange(analysis.current.revenue, analysis.previous.revenue)} icon={DollarSign} /><Kpi label="Average daily income" value={peso(analysis.current.revenue / Math.max(analysis.current.days, 1))} detail="Current reporting month" change={percentChange(analysis.current.revenue / Math.max(analysis.current.days, 1), analysis.previous.revenue / Math.max(analysis.previous.days, 1))} icon={TrendingUp} /><Kpi label="Average occupancy" value={`${analysis.occupancy}%`} detail="Occupied seat-hours" change={percentChange(analysis.occupancy, analysis.previous.occupancySum / Math.max(analysis.previous.days, 1))} icon={Armchair} /><Kpi label="Active members" value={String(analysis.current.members)} detail="Latest recorded count" change={percentChange(analysis.current.members, analysis.previous.members)} icon={Users} /></div>
    <div className="mb-6 grid gap-6 xl:grid-cols-2"><ChartCard title="Revenue and bookings" subtitle="Last six months"><ChartContainer config={chartConfigs.revenue} className="h-[290px] w-full aspect-auto"><LineChart data={analysis.monthly}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis yAxisId="left" tickFormatter={(v) => `${Math.round(v / 100000)}k`} tickLine={false} axisLine={false} /><YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent formatter={(value, name) => name === 'revenue' ? [peso(Number(value)), 'Revenue'] : [value, 'Bookings']} />} /><Line yAxisId="left" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={3} dot={false} /><Line yAxisId="right" dataKey="bookings" stroke="var(--color-bookings)" strokeWidth={2} strokeDasharray="5 5" dot={false} /></LineChart></ChartContainer></ChartCard><ChartCard title="Revenue by plan" subtitle="Current month"><ChartContainer config={chartConfigs.plan} className="h-[290px] w-full aspect-auto"><BarChart data={analysis.plan}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="plan" tickLine={false} axisLine={false} /><YAxis tickFormatter={(v) => `${Math.round(v / 100000)}k`} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent formatter={(value) => [peso(Number(value)), 'Revenue']} />} /><Bar dataKey="amount" fill="var(--color-amount)" radius={[8,8,0,0]} /></BarChart></ChartContainer></ChartCard></div>
    <div className="mb-6 grid gap-6 xl:grid-cols-2"><ChartCard title="Weekly occupancy" subtitle="Latest seven database days"><ChartContainer config={chartConfigs.occupancy} className="h-[260px] w-full aspect-auto"><AreaChart data={analysis.lastSeven}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} /><YAxis domain={[0,100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent formatter={(value) => [`${value}%`, 'Occupancy']} />} /><Area dataKey="rate" stroke="var(--color-rate)" fill="var(--color-rate)" fillOpacity={0.18} strokeWidth={3} /></AreaChart></ChartContainer></ChartCard><ChartCard title="Daily check-ins" subtitle="Latest seven database days"><ChartContainer config={chartConfigs.checkins} className="h-[260px] w-full aspect-auto"><BarChart data={analysis.lastSeven}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="checkins" fill="var(--color-checkins)" radius={[7,7,0,0]} /></BarChart></ChartContainer></ChartCard></div>
    <div className="rounded-3xl border border-[#e8dfd4] bg-white p-6 shadow-sm"><div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-[#fef3dc] p-2.5 text-[#b47b0d]"><Target className="h-5 w-5" /></span><div><h2 className="text-xl font-semibold text-[#2d2520]">Decision support</h2><p className="text-sm text-[#5f5248]">Recommendations generated from the fetched metrics</p></div></div><div className="grid gap-4 md:grid-cols-2">{insights.map((item) => <article key={item.title} className="rounded-2xl border border-[#eee5da] bg-[#fffcf8] p-5"><div className="mb-2 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold text-[#2d2520]"><Lightbulb className="h-4 w-4 text-[#e5a930]" />{item.title}</h3><span className="rounded-full bg-[#fef3dc] px-2.5 py-1 text-xs text-[#8a671a]">{item.impact}</span></div><p className="text-sm leading-6 text-[#6b5e52]">{item.detail}</p></article>)}</div></div>
  </div>;
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-[#e8dfd4] bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold text-[#2d2520]">{title}</h2><p className="mb-4 text-sm text-[#5f5248]">{subtitle}</p>{children}</section>; }
