"use client";

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowUpRight,
  DollarSign,
  Lightbulb,
  Target,
  TrendingUp,
  Users,
  Armchair,
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/app/components/chart';
import { getOccupancyRateForDate, TOTAL_SEATS } from '@/lib/seats';

const revenueChartConfig = {
  revenue: { label: 'Revenue', color: '#e5a930' },
  bookings: { label: 'Bookings', color: '#6b5e52' },
};

const planChartConfig = {
  amount: { label: 'Income', color: '#e5a930' },
};

const occupancyChartConfig = {
  rate: { label: 'Occupancy', color: '#c4841a' },
};

const peakHoursChartConfig = {
  sessions: { label: 'Check-ins', color: '#6b5e52' },
};

const monthlyRevenue = [
  { month: 'Dec', revenue: 118400, bookings: 412 },
  { month: 'Jan', revenue: 124600, bookings: 438 },
  { month: 'Feb', revenue: 131200, bookings: 451 },
  { month: 'Mar', revenue: 128900, bookings: 445 },
  { month: 'Apr', revenue: 142300, bookings: 478 },
  { month: 'May', revenue: 148750, bookings: 502 },
];

const revenueByPlan = [
  { plan: 'Hourly', amount: 42800 },
  { plan: 'Daily Pass', amount: 35600 },
  { plan: 'Monthly', amount: 70350 },
];

const peakHours = [
  { hour: '8 AM', sessions: 12 },
  { hour: '9 AM', sessions: 28 },
  { hour: '10 AM', sessions: 34 },
  { hour: '11 AM', sessions: 31 },
  { hour: '12 PM', sessions: 22 },
  { hour: '1 PM', sessions: 18 },
  { hour: '2 PM', sessions: 26 },
  { hour: '3 PM', sessions: 29 },
  { hour: '4 PM', sessions: 24 },
  { hour: '5 PM', sessions: 19 },
];

const insights = [
  {
    title: 'Expand monthly memberships',
    detail:
      'Monthly plans grew 18% this quarter and deliver the highest margin. Consider a limited-time upgrade offer for daily-pass regulars.',
    impact: 'High',
    trend: 'up' as const,
  },
  {
    title: 'Friday afternoon gap',
    detail:
      'Occupancy drops ~40% after 2 PM on Fridays. A “Focus Friday” block discount could smooth utilization without cutting peak rates.',
    impact: 'Medium',
    trend: 'down' as const,
  },
  {
    title: 'Staff for morning peak',
    detail:
      '9–11 AM accounts for 38% of daily check-ins. Align front-desk coverage with this window to reduce wait times at kiosk check-in.',
    impact: 'High',
    trend: 'up' as const,
  },
  {
    title: 'Section B headroom',
    detail:
      'Section B runs 22% below capacity on Tue–Thu while Section A is near full. Route new bookings to B via default seat suggestions.',
    impact: 'Medium',
    trend: 'up' as const,
  },
];

function formatPeso(value: number) {
  return `₱${value.toLocaleString('en-PH')}`;
}

function KpiCard({
  label,
  value,
  subtext,
  change,
  icon: Icon,
}: {
  label: string;
  value: string;
  subtext: string;
  change: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const isPositive = change >= 0;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#f3ede4]">
      <div className="flex items-start justify-between mb-4">
        <div className="p-2.5 rounded-xl bg-[#fef3dc]">
          <Icon className="w-5 h-5 text-[#e5a930]" />
        </div>
        <span
          className={`inline-flex items-center gap-1 text-sm px-2 py-1 rounded-full ${
            isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {isPositive ? (
            <ArrowUpRight className="w-3.5 h-3.5" />
          ) : (
            <ArrowDownRight className="w-3.5 h-3.5" />
          )}
          {Math.abs(change)}%
        </span>
      </div>
      <p className="text-sm text-[#6b5e52] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl text-[#2d2520] mb-1">{value}</p>
      <p className="text-sm text-[#6b5e52]">{subtext}</p>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const weeklyOccupancy = useMemo(() => {
    const base = new Date();
    const day = base.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(base);
    monday.setDate(base.getDate() + mondayOffset);

    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return labels.map((label, index) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + index);
      const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { day: label, rate: getOccupancyRateForDate(dateString) };
    });
  }, []);

  const currentMonth = monthlyRevenue[monthlyRevenue.length - 1];
  const previousMonth = monthlyRevenue[monthlyRevenue.length - 2];
  const revenueChange = Math.round(
    ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue) * 100,
  );
  const avgDailyIncome = Math.round(currentMonth.revenue / 30);
  const todayOccupancy = getOccupancyRateForDate(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
  );

  return (
      <div>
        <div className="mb-8">
          <h2 className="text-4xl text-[#2d2520] mb-2">Analytics & Insights</h2>
          <p className="text-[#6b5e52]">
            Revenue, occupancy, and recommendations to guide pricing and operations.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <KpiCard
            label="Monthly Revenue"
            value={formatPeso(currentMonth.revenue)}
            subtext={`${currentMonth.bookings} bookings in May`}
            change={revenueChange}
            icon={DollarSign}
          />
          <KpiCard
            label="Avg. Daily Income"
            value={formatPeso(avgDailyIncome)}
            subtext="Based on current month"
            change={6}
            icon={TrendingUp}
          />
          <KpiCard
            label="Today’s Occupancy"
            value={`${todayOccupancy}%`}
            subtext={`${TOTAL_SEATS} total seats`}
            change={todayOccupancy > 0 ? 4 : -2}
            icon={Armchair}
          />
          <KpiCard
            label="Active Members"
            value="186"
            subtext="52 on monthly plans"
            change={12}
            icon={Users}
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#f3ede4]">
            <h3 className="text-xl text-[#2d2520] mb-1">Business Income Trend</h3>
            <p className="text-sm text-[#6b5e52] mb-4">Last 6 months — revenue & booking volume</p>
            <ChartContainer config={revenueChartConfig} className="h-[280px] w-full aspect-auto">
              <LineChart data={monthlyRevenue} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        if (name === 'revenue') {
                          return [formatPeso(Number(value)), 'Revenue'];
                        }
                        return [value, 'Bookings'];
                      }}
                    />
                  }
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--color-revenue)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--color-revenue)', r: 4 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="bookings"
                  stroke="var(--color-bookings)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#f3ede4]">
            <h3 className="text-xl text-[#2d2520] mb-1">Income by Plan Type</h3>
            <p className="text-sm text-[#6b5e52] mb-4">Current month breakdown</p>
            <ChartContainer config={planChartConfig} className="h-[280px] w-full aspect-auto">
              <BarChart data={revenueByPlan} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="plan" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => [formatPeso(Number(value)), 'Income']}
                    />
                  }
                />
                <Bar dataKey="amount" fill="var(--color-amount)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#f3ede4]">
            <h3 className="text-xl text-[#2d2520] mb-1">Weekly Occupancy</h3>
            <p className="text-sm text-[#6b5e52] mb-4">Seat utilization from live reservation data</p>
            <ChartContainer config={occupancyChartConfig} className="h-[260px] w-full aspect-auto">
              <AreaChart data={weeklyOccupancy} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent formatter={(value) => [`${value}%`, 'Occupancy']} />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="var(--color-rate)"
                  fill="var(--color-rate)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#f3ede4]">
            <h3 className="text-xl text-[#2d2520] mb-1">Peak Session Hours</h3>
            <p className="text-sm text-[#6b5e52] mb-4">Check-ins by hour (weekday average)</p>
            <ChartContainer config={peakHoursChartConfig} className="h-[260px] w-full aspect-auto">
              <BarChart data={peakHours} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="sessions" fill="var(--color-sessions)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#f3ede4]">
          <div className="flex items-center gap-2 mb-6">
            <Target className="w-6 h-6 text-[#e5a930]" />
            <div>
              <h3 className="text-2xl text-[#2d2520]">Decision Support</h3>
              <p className="text-sm text-[#6b5e52]">
                Actionable recommendations based on trends and occupancy patterns
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {insights.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-[#f3ede4] p-5 bg-[#fffcf7] hover:border-[#e5a930]/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-[#e5a930] shrink-0" />
                    <h4 className="text-[#2d2520] font-medium">{item.title}</h4>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      item.impact === 'High'
                        ? 'bg-[#fef3dc] text-[#8a6914]'
                        : 'bg-[#f3ede4] text-[#6b5e52]'
                    }`}
                  >
                    {item.impact} impact
                  </span>
                </div>
                <p className="text-sm text-[#6b5e52] leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
  );
}
