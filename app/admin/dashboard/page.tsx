"use client";

import { Suspense, useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Calendar,
  Clock,
  Users,
  Armchair,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from 'lucide-react';
import { SeatingPlanMini } from '../components/SeatingPlanMini';
import { AdminShell } from '../components/AdminShell';
import { allSeatIds, getReservedSeatsForDate } from '../lib/seats';

type Section = 'dashboard' | 'reservations' | 'content' | 'logs';

const sectionFromParam = (param: string | null): Section => {
  if (param === 'reservations' || param === 'content' || param === 'logs') {
    return param;
  }
  return 'dashboard';
};

const getTodayString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const activeSection = sectionFromParam(searchParams.get('section'));
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleDateSelect = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    setSelectedDate(dateString);
    setIsCalendarOpen(false);
  };

  const seatPlanData = useMemo(() => {
    const reservedSeats = getReservedSeatsForDate(selectedDate);
    return allSeatIds.map(id => ({
      id,
      status: reservedSeats.includes(id) ? 'reserved' as const : 'available' as const
    }));
  }, [selectedDate]);

  // Mock data
  const recentBookings = [
    { id: 1, customer: 'John Smith', date: '2026-04-20', time: '09:00 AM', seat: 'A-12', status: 'Confirmed' },
    { id: 2, customer: 'Sarah Johnson', date: '2026-04-20', time: '10:30 AM', seat: 'B-05', status: 'Confirmed' },
    { id: 3, customer: 'Mike Chen', date: '2026-04-20', time: '02:00 PM', seat: 'C-08', status: 'Pending' },
    { id: 4, customer: 'Emma Wilson', date: '2026-04-21', time: '11:00 AM', seat: 'A-15', status: 'Confirmed' },
    { id: 5, customer: 'David Lee', date: '2026-04-21', time: '03:30 PM', seat: 'B-10', status: 'Confirmed' },
  ];

  const seatingLayout = [
    { section: 'A', total: 20, occupied: 15, available: 5 },
    { section: 'B', total: 20, occupied: 12, available: 8 },
    { section: 'C', total: 15, occupied: 8, available: 7 },
  ];

  const accessLogs = [
    { id: 1, admin: 'jit@admin.com', action: 'Login', date: '2026-04-19', time: '08:30 AM' },
    { id: 2, admin: 'jit@admin.com', action: 'Updated Pricing', date: '2026-04-19', time: '09:15 AM' },
    { id: 3, admin: 'jit@admin.com', action: 'Viewed Reservations', date: '2026-04-19', time: '10:00 AM' },
    { id: 4, admin: 'jit@admin.com', action: 'Modified Hours', date: '2026-04-18', time: '02:45 PM' },
    { id: 5, admin: 'jit@admin.com', action: 'Login', date: '2026-04-18', time: '08:00 AM' },
  ];

  return (
    <>
        {activeSection === 'dashboard' && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <h2 className="text-4xl text-[#2d2520]">Dashboard Overview</h2>
              <Link
                href="/admin/analytics"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#e5a930] text-white text-sm hover:shadow-lg transition-all"
              >
                <BarChart3 className="w-4 h-4" />
                View Analytics
              </Link>
            </div>

            {/* Seating Layout Stats */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#f3ede4] mb-6">
              <h3 className="text-2xl text-[#2d2520] mb-4 flex items-center gap-2">
                <Armchair className="w-6 h-6 text-[#e5a930]" />
                Seating Overview
              </h3>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {seatingLayout.map((section) => (
                  <div key={section.section} className="bg-[#fef3dc] rounded-xl p-4 border border-[#e5a930]/30">
                    <p className="text-sm text-[#6b5e52] uppercase tracking-wider mb-2">Section {section.section}</p>
                    <p className="text-3xl text-[#2d2520] mb-2">{section.available}/{section.total}</p>
                    <p className="text-sm text-[#6b5e52]">
                      {section.occupied} Occupied • {section.available} Available
                    </p>
                  </div>
                ))}
              </div>

              {/* Seating Plan Visual */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-[#6b5e52] uppercase tracking-wider">Current Seating Plan</p>
                  <div className="relative" ref={calendarRef}>
                    <button
                      type="button"
                      onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#f3ede4] bg-white focus:outline-none focus:ring-2 focus:ring-[#e5a930] text-sm hover:bg-[#fef3dc]/30 transition-colors"
                    >
                      <Calendar className="w-4 h-4 text-[#6b5e52]" />
                      <span className="text-[#2d2520]">{formatDate(selectedDate)}</span>
                    </button>

                    {isCalendarOpen && (
                      <div className="absolute top-full mt-2 right-0 bg-white rounded-2xl shadow-2xl border border-[#f3ede4] p-4 z-50 w-80">
                        <div className="flex items-center justify-between mb-4">
                          <button
                            type="button"
                            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                            className="p-2 hover:bg-[#f3ede4] rounded-lg transition-colors"
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
                          {getDaysInMonth(currentMonth).map((day, index) => (
                            <div key={index}>
                              {day ? (
                                <button
                                  type="button"
                                  onClick={() => handleDateSelect(day)}
                                  className={`w-full aspect-square rounded-lg text-sm transition-all ${
                                    isSameDay(day, selectedDate)
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
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#e8e8e8] rounded"></div>
                    <span className="text-[#6b5e52]">Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-[#9ca3af] rounded"></div>
                    <span className="text-[#6b5e52]">Reserved</span>
                  </div>
                  <span className="text-[#6b5e52]">• Viewing: {formatDate(selectedDate)}</span>
                </div>
                <SeatingPlanMini seats={seatPlanData} />
              </div>
            </div>

            {/* Recent Bookings */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#f3ede4]">
              <h3 className="text-2xl text-[#2d2520] mb-4 flex items-center gap-2">
                <Users className="w-6 h-6 text-[#e5a930]" />
                Recent Bookings
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#f3ede4]">
                      <th className="text-left py-3 px-4 text-sm text-[#6b5e52] uppercase tracking-wider">Customer</th>
                      <th className="text-left py-3 px-4 text-sm text-[#6b5e52] uppercase tracking-wider">Date</th>
                      <th className="text-left py-3 px-4 text-sm text-[#6b5e52] uppercase tracking-wider">Time</th>
                      <th className="text-left py-3 px-4 text-sm text-[#6b5e52] uppercase tracking-wider">Seat</th>
                      <th className="text-left py-3 px-4 text-sm text-[#6b5e52] uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map((booking) => (
                      <tr key={booking.id} className="border-b border-[#f3ede4] hover:bg-[#fef3dc]/30">
                        <td className="py-3 px-4 text-[#2d2520]">{booking.customer}</td>
                        <td className="py-3 px-4 text-[#6b5e52]">{booking.date}</td>
                        <td className="py-3 px-4 text-[#6b5e52]">{booking.time}</td>
                        <td className="py-3 px-4 text-[#2d2520]">{booking.seat}</td>
                        <td className="py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-sm ${
                            booking.status === 'Confirmed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {booking.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Reservations Section */}
        {activeSection === 'reservations' && (
          <div>
            <h2 className="text-4xl text-[#2d2520] mb-8">Reservation Management</h2>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#f3ede4]">
              <div className="mb-6 flex gap-4">
                <input
                  type="text"
                  placeholder="Search by customer name..."
                  className="flex-1 px-4 py-3 rounded-xl border border-[#f3ede4] bg-white text-[#2d2520] placeholder:text-[#6b5e52] focus:outline-none focus:ring-2 focus:ring-[#e5a930]"
                />
                <select className="px-4 py-3 rounded-xl border border-[#f3ede4] bg-white text-[#2d2520] focus:outline-none focus:ring-2 focus:ring-[#e5a930]">
                  <option>All Status</option>
                  <option>Confirmed</option>
                  <option>Pending</option>
                  <option>Cancelled</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#f3ede4]">
                      <th className="text-left py-3 px-4 text-sm text-[#6b5e52] uppercase tracking-wider">ID</th>
                      <th className="text-left py-3 px-4 text-sm text-[#6b5e52] uppercase tracking-wider">Customer</th>
                      <th className="text-left py-3 px-4 text-sm text-[#6b5e52] uppercase tracking-wider">Date</th>
                      <th className="text-left py-3 px-4 text-sm text-[#6b5e52] uppercase tracking-wider">Time</th>
                      <th className="text-left py-3 px-4 text-sm text-[#6b5e52] uppercase tracking-wider">Seat</th>
                      <th className="text-left py-3 px-4 text-sm text-[#6b5e52] uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 px-4 text-sm text-[#6b5e52] uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map((booking) => (
                      <tr key={booking.id} className="border-b border-[#f3ede4] hover:bg-[#fef3dc]/30">
                        <td className="py-3 px-4 text-[#6b5e52]">#{booking.id}</td>
                        <td className="py-3 px-4 text-[#2d2520]">{booking.customer}</td>
                        <td className="py-3 px-4 text-[#6b5e52]">{booking.date}</td>
                        <td className="py-3 px-4 text-[#6b5e52]">{booking.time}</td>
                        <td className="py-3 px-4 text-[#2d2520]">{booking.seat}</td>
                        <td className="py-3 px-4">
                          <span className={`px-3 py-1 rounded-full text-sm ${
                            booking.status === 'Confirmed'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {booking.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button className="text-[#e5a930] hover:underline text-sm mr-3">View</button>
                          <button className="text-red-600 hover:underline text-sm">Cancel</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Content Management Section */}
        {activeSection === 'content' && (
          <div>
            <h2 className="text-4xl text-[#2d2520] mb-8">Content Management</h2>

            {/* Opening Hours */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#f3ede4] mb-6">
              <h3 className="text-2xl text-[#2d2520] mb-4 flex items-center gap-2">
                <Clock className="w-6 h-6 text-[#e5a930]" />
                Operating Hours
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2">Opening Time</label>
                  <input
                    type="time"
                    defaultValue="08:00"
                    className="w-full px-4 py-3 rounded-xl border border-[#f3ede4] bg-white text-[#2d2520] focus:outline-none focus:ring-2 focus:ring-[#e5a930]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2">Closing Time</label>
                  <input
                    type="time"
                    defaultValue="22:00"
                    className="w-full px-4 py-3 rounded-xl border border-[#f3ede4] bg-white text-[#2d2520] focus:outline-none focus:ring-2 focus:ring-[#e5a930]"
                  />
                </div>
              </div>
              <button className="mt-4 bg-[#e5a930] text-white px-6 py-2 rounded-full hover:shadow-lg transition-all">
                Update Hours
              </button>
            </div>

            {/* Pricing */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#f3ede4] mb-6">
              <h3 className="text-2xl text-[#2d2520] mb-4 flex items-center gap-2">
                <span className="w-6 h-6 flex items-center justify-center text-[#e5a930] text-xl">₱</span>
                Pricing Configuration
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2">Hourly Rate</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b5e52]">₱</span>
                    <input
                      type="number"
                      defaultValue="15"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#f3ede4] bg-white text-[#2d2520] focus:outline-none focus:ring-2 focus:ring-[#e5a930]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2">Daily Pass</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b5e52]">₱</span>
                    <input
                      type="number"
                      defaultValue="50"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#f3ede4] bg-white text-[#2d2520] focus:outline-none focus:ring-2 focus:ring-[#e5a930]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[#6b5e52] uppercase tracking-wider mb-2">Monthly Membership</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6b5e52]">₱</span>
                    <input
                      type="number"
                      defaultValue="200"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#f3ede4] bg-white text-[#2d2520] focus:outline-none focus:ring-2 focus:ring-[#e5a930]"
                    />
                  </div>
                </div>
              </div>
              <button className="mt-4 bg-[#e5a930] text-white px-6 py-2 rounded-full hover:shadow-lg transition-all">
                Update Pricing
              </button>
            </div>

            {/* Announcements */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#f3ede4]">
              <h3 className="text-2xl text-[#2d2520] mb-4">Site Announcements</h3>
              <textarea
                rows={4}
                placeholder="Enter site-wide announcement..."
                className="w-full px-4 py-3 rounded-xl border border-[#f3ede4] bg-white text-[#2d2520] placeholder:text-[#6b5e52] focus:outline-none focus:ring-2 focus:ring-[#e5a930] resize-none"
              />
              <button className="mt-4 bg-[#e5a930] text-white px-6 py-2 rounded-full hover:shadow-lg transition-all">
                Publish Announcement
              </button>
            </div>
          </div>
        )}

        {/* Access Logs Section */}
        {activeSection === 'logs' && (
          <div>
            <h2 className="text-4xl text-[#2d2520] mb-8">Access Logs</h2>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#f3ede4]">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#f3ede4]">
                      <th className="text-left py-3 px-4 text-sm text-[#6b5e52] uppercase tracking-wider">ID</th>
                      <th className="text-left py-3 px-4 text-sm text-[#6b5e52] uppercase tracking-wider">Admin</th>
                      <th className="text-left py-3 px-4 text-sm text-[#6b5e52] uppercase tracking-wider">Action</th>
                      <th className="text-left py-3 px-4 text-sm text-[#6b5e52] uppercase tracking-wider">Date</th>
                      <th className="text-left py-3 px-4 text-sm text-[#6b5e52] uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessLogs.map((log) => (
                      <tr key={log.id} className="border-b border-[#f3ede4] hover:bg-[#fef3dc]/30">
                        <td className="py-3 px-4 text-[#6b5e52]">#{log.id}</td>
                        <td className="py-3 px-4 text-[#2d2520]">{log.admin}</td>
                        <td className="py-3 px-4 text-[#6b5e52]">{log.action}</td>
                        <td className="py-3 px-4 text-[#6b5e52]">{log.date}</td>
                        <td className="py-3 px-4 text-[#6b5e52]">{log.time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
    </>
  );
}

export default function AdminDashboard() {
  return (
    <AdminShell>
      <Suspense
        fallback={
          <div className="animate-pulse space-y-6">
            <div className="h-10 w-64 bg-[#f3ede4] rounded-xl" />
            <div className="h-48 bg-[#f3ede4] rounded-2xl" />
          </div>
        }
      >
        <AdminDashboardContent />
      </Suspense>
    </AdminShell>
  );
}
