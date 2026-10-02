"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, CalendarDays, Eye, Loader2, Pencil, Plus, Radio, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { SeatingPlanMini } from '../../_components/SeatingPlanMini';
import { useAdminAccess } from '../../_components/AdminShell';
import { hasAdminAccess } from '@/lib/admin-access';
import { allSeatIds } from '@/lib/seats';
import { createClient } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/database.types';

type Booking = Tables<'bookings'>;
type Seat = Tables<'seats'>;
type WalkIn = Tables<'walk_in_occupancies'>;
type Announcement = Tables<'announcements'>;
type AuditLog = Tables<'audit_logs'> & { profile?: { full_name: string; email: string | null } | null };
type Section = 'dashboard' | 'reservations' | 'content' | 'logs';
type NoticeForm = { id?: string; date: string; title: string; description: string; status: 'draft' | 'published' | 'archived' };
type AnnouncementFilter = 'all' | 'published' | 'draft' | 'archived';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const cleanForm: NoticeForm = { date: today(), title: '', description: '', status: 'published' };
const terminalStatuses = new Set(['cancelled', 'completed', 'declined', 'no_show']);

function titleCase(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatDateTime(value: string) { return new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }); }
function statusStyle(status: string) {
  if (status === 'confirmed' || status === 'checked_in' || status === 'published') return 'bg-emerald-100 text-emerald-700';
  if (status === 'cancelled' || status === 'declined' || status === 'archived') return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-800';
}

function DashboardContent() {
  const access = useAdminAccess();
  const param = useSearchParams().get('section');
  const section: Section = param === 'reservations' || param === 'content' || param === 'logs' ? param : 'dashboard';
  const canManageReservations = hasAdminAccess(access, 'reservations');
  const canViewSection = access.role === 'admin'
    || (section === 'dashboard' && hasAdminAccess(access, 'seating'))
    || (section === 'reservations' && canManageReservations)
    || (section === 'content' && hasAdminAccess(access, 'announcements'));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [walkIns, setWalkIns] = useState<WalkIn[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [announcementFilter, setAnnouncementFilter] = useState<AnnouncementFilter>('all');
  const [announcementSearch, setAnnouncementSearch] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('Cancelled by staff');
  const [cancelError, setCancelError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [busySeat, setBusySeat] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [noticeForm, setNoticeForm] = useState<NoticeForm>(cleanForm);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [bookingResult, seatResult, walkInResult, announcementResult, logResult] = await Promise.all([
      supabase.from('bookings').select().order('created_at', { ascending: false }).limit(250),
      supabase.from('seats').select().order('code'),
      supabase.from('walk_in_occupancies').select().is('ended_at', null).order('started_at', { ascending: false }),
      supabase.from('announcements').select().order('starts_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
      supabase.from('audit_logs').select('*, profile:profiles(full_name, email)').order('created_at', { ascending: false }).limit(200),
    ]);
    const firstError = bookingResult.error || seatResult.error || walkInResult.error || announcementResult.error || logResult.error;
    if (firstError) setMessage(firstError.message);
    setBookings(bookingResult.data ?? []);
    setSeats(seatResult.data ?? []);
    setWalkIns(walkInResult.data ?? []);
    setAnnouncements(announcementResult.data ?? []);
    setLogs((logResult.data ?? []) as AuditLog[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadData());
    const supabase = createClient();
    const channel = supabase.channel('admin-operations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => void loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'walk_in_occupancies' }, () => void loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => void loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => void loadData())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadData]);

  const seatCodeById = useMemo(() => new Map(seats.map((seat) => [seat.id, seat.code])), [seats]);
  const activeWalkInCodes = useMemo(() => new Set(walkIns.map((walkIn) => seatCodeById.get(walkIn.seat_id)).filter(Boolean)), [walkIns, seatCodeById]);
  const selectedBookings = useMemo(() => bookings.filter((booking) => booking.booking_date === selectedDate && !terminalStatuses.has(booking.status)), [bookings, selectedDate]);
  const reservedCodes = useMemo(() => new Set(selectedBookings.flatMap((booking) => booking.seat_ids)), [selectedBookings]);
  const seatPlan = useMemo(() => allSeatIds.map((id) => {
    const databaseSeat = seats.find((seat) => seat.code === id);
    const status = databaseSeat?.status === 'maintenance' ? 'maintenance' as const
      : selectedDate === today() && activeWalkInCodes.has(id) ? 'occupied' as const
      : reservedCodes.has(id) ? 'reserved' as const : 'available' as const;
    return { id, status };
  }), [activeWalkInCodes, reservedCodes, seats, selectedDate]);

  const seatSummary = useMemo(() => seatPlan.reduce((result, seat) => ({ ...result, [seat.status]: (result[seat.status] || 0) + 1 }), {} as Record<string, number>), [seatPlan]);
  const filteredBookings = useMemo(() => bookings.filter((booking) => {
    const needle = search.toLowerCase();
    return (statusFilter === 'all' || booking.status === statusFilter) && (!needle || `${booking.guest_name} ${booking.guest_email} ${booking.reservation_code} ${booking.seat_ids.join(' ')}`.toLowerCase().includes(needle));
  }), [bookings, search, statusFilter]);
  const filteredAnnouncements = useMemo(() => {
    const needle = announcementSearch.trim().toLowerCase();
    return announcements.filter((announcement) => {
      const matchesStatus = announcementFilter === 'all' || announcement.status === announcementFilter;
      const matchesSearch = !needle || `${announcement.title} ${announcement.body}`.toLowerCase().includes(needle);
      return matchesStatus && matchesSearch;
    });
  }, [announcementFilter, announcementSearch, announcements]);

  const toggleWalkIn = async (seatCode: string) => {
    setBusySeat(seatCode); setMessage('');
    const guestName = activeWalkInCodes.has(seatCode) ? null : window.prompt(`Optional walk-in guest name for ${seatCode}:`, '')?.trim() || null;
    const { error } = await createClient().rpc('toggle_walk_in_occupancy', { p_seat_code: seatCode, p_guest_name: guestName ?? undefined });
    if (error) setMessage(error.message); else await loadData();
    setBusySeat(null);
  };

  const requestCancellation = (booking: Booking) => {
    setSelectedBooking(null);
    setCancelTarget(booking);
    setCancelReason('Cancelled by staff');
    setCancelError('');
  };

  const closeCancellation = () => {
    if (cancelling) return;
    setCancelTarget(null);
    setCancelError('');
  };

  const confirmCancellation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cancelTarget) return;
    const reason = cancelReason.trim();
    if (!reason) { setCancelError('Please provide a cancellation reason.'); return; }
    setCancelling(true);
    setCancelError('');
    const { error } = await createClient().rpc('admin_cancel_booking', { p_booking_id: cancelTarget.id, p_reason: reason });
    if (error) {
      setCancelError(error.message);
      setCancelling(false);
      return;
    }
    setMessage(`Reservation ${cancelTarget.reservation_code} was cancelled.`);
    setCancelTarget(null);
    setCancelling(false);
    await loadData();
  };

  const editAnnouncement = (announcement: Announcement) => setNoticeForm({ id: announcement.id, date: (announcement.starts_at || announcement.created_at).slice(0, 10), title: announcement.title, description: announcement.body, status: announcement.status });
  const saveAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage('');
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const payload = { title: noticeForm.title.trim(), body: noticeForm.description.trim(), status: noticeForm.status, starts_at: `${noticeForm.date}T00:00:00+08:00`, created_by: auth.user?.id ?? null };
    const result = noticeForm.id ? await supabase.from('announcements').update(payload).eq('id', noticeForm.id) : await supabase.from('announcements').insert(payload);
    setMessage(result.error ? result.error.message : noticeForm.id ? 'Announcement updated.' : 'Announcement created.');
    if (!result.error) { setNoticeForm(cleanForm); await loadData(); }
    setSaving(false);
  };
  const archiveAnnouncement = async (announcement: Announcement) => {
    if (!window.confirm(`Archive “${announcement.title}”?`)) return;
    const { error } = await createClient().from('announcements').update({ status: 'archived' }).eq('id', announcement.id);
    setMessage(error ? error.message : 'Announcement archived.'); if (!error) await loadData();
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-[#5f5248]"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading live operations…</div>;

  if (!canViewSection) {
    return <div className="mx-auto max-w-xl rounded-3xl border border-[#e8dfd4] bg-white p-8 text-center shadow-sm"><ShieldCheck className="mx-auto h-10 w-10 text-[#b47b0d]" /><h1 className="mt-4 text-2xl font-semibold text-[#2d2520]">Access not assigned</h1><p className="mt-2 text-[#5f5248]">The owner has not granted your employee account permission to view this section.</p></div>;
  }

  return <div className="mx-auto max-w-[1500px]">
    {message && <div className="mb-5 flex items-center justify-between rounded-2xl border border-[#ecd8ad] bg-[#fff8e8] px-4 py-3 text-sm text-[#775919]"><span>{message}</span><button onClick={() => setMessage('')}><X className="h-4 w-4" /></button></div>}

    {section === 'dashboard' && <>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-emerald-700"><Radio className="h-3.5 w-3.5" />Live operations</p><h1 className="text-3xl font-semibold tracking-tight text-[#2d2520] sm:text-4xl">Seating overview</h1><p className="mt-2 text-[#5f5248]">Reservations and walk-ins update automatically from the shared database.</p></div><label className="rounded-2xl border border-[#e8dfd4] bg-white px-4 py-3 text-sm text-[#6b5e52]">Viewing date <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="ml-3 bg-transparent font-semibold text-[#2d2520] outline-none" /></label></div>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        ['Available', seatSummary.available || 0, 'bg-emerald-50 text-emerald-700'], ['Reserved', seatSummary.reserved || 0, 'bg-slate-100 text-slate-700'], ['Walk-ins now', activeWalkInCodes.size, 'bg-amber-50 text-amber-700'], ['Total active seats', seats.filter((seat) => seat.is_active).length, 'bg-white text-[#2d2520]'],
      ].map(([label, value, color]) => <div key={String(label)} className={`rounded-3xl border border-[#e8dfd4] p-5 shadow-sm ${color}`}><p className="text-xs font-semibold uppercase tracking-[.14em] opacity-70">{label}</p><p className="mt-2 text-4xl font-semibold">{value}</p></div>)}</div>
      <div className="rounded-3xl border border-[#e8dfd4] bg-white p-4 shadow-sm sm:p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-[#2d2520]">Live floor plan</h2><p className="mt-1 text-sm text-[#5f5248]">{selectedDate === today() ? 'Click an available or occupied seat to check a walk-in in or out.' : 'Return to today to manage live walk-in occupancy.'}</p></div><div className="flex flex-wrap gap-3 text-xs text-[#6b5e52]"><span>● <b className="text-emerald-600">Available</b></span><span>● Reserved</span><span className="text-amber-600">● Occupied</span></div></div><SeatingPlanMini seats={seatPlan} onSeatClick={selectedDate === today() ? toggleWalkIn : undefined} busySeatId={busySeat} /></div>
      <div className="mt-6 rounded-3xl border border-[#e8dfd4] bg-white p-5 shadow-sm"><h2 className="mb-4 text-xl font-semibold text-[#2d2520]">Recent reservations</h2><BookingTable bookings={bookings.slice(0, 8)} onView={setSelectedBooking} onCancel={canManageReservations ? requestCancellation : undefined} /></div>
    </>}

    {section === 'reservations' && <><PageHeading eyebrow="Booking operations" title="Reservations" detail="Search, inspect, and cancel customer reservations. Changes sync to seat availability immediately." /><div className="rounded-3xl border border-[#e8dfd4] bg-white p-4 shadow-sm sm:p-6"><div className="mb-5 flex flex-col gap-3 sm:flex-row"><label className="flex flex-1 items-center gap-2 rounded-xl border border-[#e8dfd4] px-4"><Search className="h-4 w-4 text-[#6b5e52]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customer, code, email, or seat" className="w-full py-3 text-[#2d2520] outline-none placeholder:text-[#6b5e52]" /></label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-[#e8dfd4] bg-white px-4 py-3 text-[#2d2520]"><option value="all">All statuses</option>{['pending','confirmed','checked_in','completed','cancelled','declined','no_show'].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></div><BookingTable bookings={filteredBookings} onView={setSelectedBooking} onCancel={requestCancellation} /></div></>}

    {section === 'content' && <><PageHeading eyebrow="Content management" title="Announcements" detail="Create, edit, publish, and archive updates shown on the customer landing page." /><div className="grid gap-6 xl:grid-cols-[minmax(320px,0.8fr)_1.5fr]"><form onSubmit={saveAnnouncement} className="h-fit self-start rounded-3xl border border-[#e8dfd4] bg-white p-6 shadow-sm xl:sticky xl:top-8"><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold text-[#2d2520]">{noticeForm.id ? 'Edit announcement' : 'New announcement'}</h2>{noticeForm.id && <button type="button" onClick={() => setNoticeForm(cleanForm)} className="text-sm text-[#9b6810]">Cancel edit</button>}</div><div className="space-y-4"><Field label="Date"><input type="date" required value={noticeForm.date} onChange={(e) => setNoticeForm({ ...noticeForm, date: e.target.value })} className="input" /></Field><Field label="Title"><input required maxLength={160} value={noticeForm.title} onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })} placeholder="Important update" className="input" /></Field><Field label="Description"><textarea required maxLength={5000} rows={6} value={noticeForm.description} onChange={(e) => setNoticeForm({ ...noticeForm, description: e.target.value })} placeholder="What should customers know?" className="input resize-y" /></Field><Field label="Publishing status"><select value={noticeForm.status} onChange={(e) => setNoticeForm({ ...noticeForm, status: e.target.value as NoticeForm['status'] })} className="input"><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></Field><button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#e5a930] px-4 py-3 font-semibold text-white disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{noticeForm.id ? 'Save changes' : 'Publish announcement'}</button></div></form><div className="space-y-3"><AnnouncementFilters search={announcementSearch} onSearch={setAnnouncementSearch} filter={announcementFilter} onFilter={setAnnouncementFilter} announcements={announcements} resultCount={filteredAnnouncements.length} />{filteredAnnouncements.map((item) => <article key={item.id} className="rounded-3xl border border-[#e8dfd4] bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="mb-2 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(item.status)}`}>{titleCase(item.status)}</span><span className="text-xs text-[#5f5248]">{new Date(item.starts_at || item.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium', timeZone: 'Asia/Manila' })}</span></div><h3 className="text-lg font-semibold text-[#2d2520]">{item.title}</h3><p className="mt-2 text-sm leading-6 text-[#6b5e52]">{item.body}</p></div><div className="flex shrink-0 gap-2"><button onClick={() => editAnnouncement(item)} className="rounded-xl border border-[#e8dfd4] p-2.5 text-[#8a671a] hover:bg-[#fff8e8]" title="Edit"><Pencil className="h-4 w-4" /></button>{item.status !== 'archived' && <button onClick={() => archiveAnnouncement(item)} className="rounded-xl border border-red-100 p-2.5 text-red-600 hover:bg-red-50" title="Archive"><Trash2 className="h-4 w-4" /></button>}</div></div></article>)}</div></div></>}

    {section === 'logs' && <><PageHeading eyebrow="Security & accountability" title="Access logs" detail="A realtime history of who accessed or changed the admin dashboard." /><div className="overflow-hidden rounded-3xl border border-[#e8dfd4] bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-[#faf7f2] text-xs uppercase tracking-wider text-[#5f5248]"><tr><th className="px-5 py-4">Name</th><th className="px-5 py-4">Email</th><th className="px-5 py-4">Action</th><th className="px-5 py-4">Resource</th><th className="px-5 py-4">Date & time</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id} className="border-t border-[#eee6dc]"><td className="px-5 py-4 font-medium text-[#2d2520]">{log.profile?.full_name || 'Former staff account'}</td><td className="px-5 py-4 text-sm text-[#6b5e52]">{log.profile?.email || '—'}</td><td className="px-5 py-4"><span className="rounded-full bg-[#fef3dc] px-3 py-1 text-sm text-[#8a671a]">{log.action}</span></td><td className="px-5 py-4 text-sm text-[#6b5e52]">{titleCase(log.entity_type)}</td><td className="px-5 py-4 text-sm text-[#6b5e52]">{formatDateTime(log.created_at)}</td></tr>)}</tbody></table></div>{logs.length === 0 && <EmptyState icon={ShieldCheck} text="No staff access has been logged yet." />}</div></>}

    {selectedBooking && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2d2520]/45 p-4 backdrop-blur-sm" onMouseDown={() => setSelectedBooking(null)}><div className="w-full max-w-lg rounded-3xl bg-white p-6 text-[#2d2520] shadow-2xl" onMouseDown={(e) => e.stopPropagation()}><div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#9b6810]">{selectedBooking.reservation_code}</p><h2 className="mt-1 text-2xl font-semibold">Reservation details</h2></div><button onClick={() => setSelectedBooking(null)} className="rounded-xl p-2 hover:bg-[#f7f1e8]" aria-label="Close reservation details"><X className="h-5 w-5" /></button></div><dl className="grid grid-cols-2 gap-4 rounded-2xl bg-[#faf7f2] p-4 text-sm"><Detail label="Guest" value={selectedBooking.guest_name} /><Detail label="Email" value={selectedBooking.guest_email} /><Detail label="Schedule" value={formatDateTime(selectedBooking.starts_at)} /><Detail label="Duration" value={`${selectedBooking.duration_hours} hour(s)`} /><Detail label="Seats" value={selectedBooking.seat_ids.join(', ')} /><Detail label="Status" value={titleCase(selectedBooking.status)} /><Detail label="Payment" value={titleCase(selectedBooking.payment_status)} /><Detail label="Amount" value={`₱${(selectedBooking.subtotal_cents / 100).toLocaleString('en-PH')}`} /></dl>{canManageReservations && !terminalStatuses.has(selectedBooking.status) && <button onClick={() => requestCancellation(selectedBooking)} className="mt-5 w-full rounded-xl bg-red-700 px-4 py-3 font-semibold text-white hover:bg-red-800">Cancel reservation</button>}</div></div>}

    {cancelTarget && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2d2520]/55 p-4 backdrop-blur-sm" onMouseDown={closeCancellation}><form onSubmit={confirmCancellation} className="w-full max-w-lg rounded-3xl bg-white p-6 text-[#2d2520] shadow-2xl sm:p-7" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cancel-reservation-title"><div className="mb-5 flex items-start justify-between gap-4"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700"><AlertTriangle className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-red-700">Permanent status change</p><h2 id="cancel-reservation-title" className="mt-1 text-2xl font-semibold">Cancel reservation?</h2></div></div><button type="button" onClick={closeCancellation} disabled={cancelling} className="rounded-xl p-2 text-[#4f443c] hover:bg-[#f7f1e8] disabled:opacity-50" aria-label="Close cancellation dialog"><X className="h-5 w-5" /></button></div><div className="mb-5 rounded-2xl border border-[#e8dfd4] bg-[#faf7f2] p-4"><p className="font-semibold">{cancelTarget.guest_name}</p><p className="mt-1 text-sm text-[#574b42]">{cancelTarget.reservation_code} · {formatDateTime(cancelTarget.starts_at)}</p><p className="mt-1 text-sm text-[#574b42]">Seats: {cancelTarget.seat_ids.join(', ')}</p></div><label className="block"><span className="mb-2 block text-sm font-semibold text-[#3f3630]">Cancellation reason</span><textarea autoFocus required maxLength={500} rows={4} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="w-full resize-y rounded-xl border border-[#b9aa9b] bg-white px-4 py-3 text-[#2d2520] outline-none placeholder:text-[#6b5e52] focus:border-red-600 focus:ring-2 focus:ring-red-100" placeholder="Explain why this reservation is being cancelled" /></label><p className="mt-2 text-sm text-[#574b42]">The seat will become available immediately and the action will be recorded in access logs.</p>{cancelError && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{cancelError}</p>}<div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={closeCancellation} disabled={cancelling} className="rounded-xl border border-[#b9aa9b] bg-white px-5 py-3 font-semibold text-[#3f3630] hover:bg-[#f7f1e8] disabled:opacity-50">Keep reservation</button><button type="submit" disabled={cancelling || !cancelReason.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-3 font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">{cancelling && <Loader2 className="h-4 w-4 animate-spin" />}{cancelling ? 'Cancelling…' : 'Confirm cancellation'}</button></div></form></div>}
  </div>;
}

function AnnouncementFilters({
  search,
  onSearch,
  filter,
  onFilter,
  announcements,
  resultCount,
}: {
  search: string;
  onSearch: (value: string) => void;
  filter: AnnouncementFilter;
  onFilter: (value: AnnouncementFilter) => void;
  announcements: Announcement[];
  resultCount: number;
}) {
  const statuses: AnnouncementFilter[] = ['all', 'published', 'draft', 'archived'];
  return (
    <div className="rounded-2xl border border-[#e8dfd4] bg-white p-4 shadow-sm">
      <label className="flex items-center gap-2 rounded-xl border border-[#cfc3b6] px-4">
        <Search className="h-4 w-4 text-[#5f5248]" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search title or description"
          className="w-full py-3 text-[#2d2520] outline-none placeholder:text-[#62554b]"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {statuses.map((status) => {
          const count = status === 'all'
            ? announcements.length
            : announcements.filter((announcement) => announcement.status === status).length;
          return (
            <button
              key={status}
              type="button"
              onClick={() => onFilter(status)}
              aria-pressed={filter === status}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${filter === status
                ? 'border-[#2d2520] bg-[#2d2520] text-white'
                : 'border-[#cfc3b6] bg-white text-[#4f443c] hover:bg-[#f7f1e8]'
              }`}
            >
              {status === 'all' ? 'All' : titleCase(status)} <span className="opacity-75">({count})</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm font-medium text-[#5f5248]">
        {resultCount} {resultCount === 1 ? 'announcement' : 'announcements'} found
      </p>
      {resultCount === 0 && (
        <p className="mt-3 rounded-xl bg-[#faf7f2] px-4 py-5 text-center text-sm text-[#4f443c]">
          No announcements match your search and filter.
        </p>
      )}
    </div>
  );
}

function PageHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) { return <div className="mb-7"><p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-[#b47b0d]">{eyebrow}</p><h1 className="text-3xl font-semibold tracking-tight text-[#2d2520] sm:text-4xl">{title}</h1><p className="mt-2 max-w-3xl text-[#5f5248]">{detail}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#5f5248]">{label}</span>{children}</label>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs uppercase tracking-wider text-[#5f5248]">{label}</dt><dd className="mt-1 break-words font-medium text-[#2d2520]">{value}</dd></div>; }
function EmptyState({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) { return <div className="flex flex-col items-center px-5 py-14 text-center text-[#5f5248]"><Icon className="mb-3 h-8 w-8" /><p>{text}</p></div>; }
function BookingTable({ bookings, onView, onCancel }: { bookings: Booking[]; onView: (booking: Booking) => void; onCancel?: (booking: Booking) => void }) { return <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="text-xs uppercase tracking-wider text-[#5f5248]"><tr><th className="px-3 py-3">Reservation</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Schedule</th><th className="px-3 py-3">Seats</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Actions</th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking.id} className="border-t border-[#eee6dc] hover:bg-[#fffcf8]"><td className="px-3 py-4 font-mono text-sm text-[#8a671a]">{booking.reservation_code}</td><td className="px-3 py-4"><p className="font-medium text-[#2d2520]">{booking.guest_name}</p><p className="text-xs text-[#5f5248]">{booking.guest_email}</p></td><td className="px-3 py-4 text-sm text-[#6b5e52]">{formatDateTime(booking.starts_at)}</td><td className="px-3 py-4 text-sm text-[#2d2520]">{booking.seat_ids.join(', ')}</td><td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(booking.status)}`}>{titleCase(booking.status)}</span></td><td className="px-3 py-4"><div className="flex justify-end gap-2"><button onClick={() => onView(booking)} className="rounded-lg border border-[#e8dfd4] p-2 text-[#6b5e52] hover:bg-[#f7f1e8]" title="View"><Eye className="h-4 w-4" /></button>{onCancel && !terminalStatuses.has(booking.status) && <button onClick={() => onCancel(booking)} className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50" title="Cancel"><Trash2 className="h-4 w-4" /></button>}</div></td></tr>)}</tbody></table>{bookings.length === 0 && <EmptyState icon={CalendarDays} text="No reservations match the current filters." />}</div>; }

export default function AdminDashboardPage() { return <Suspense fallback={<div className="p-10 text-center">Loading dashboard…</div>}><DashboardContent /></Suspense>; }
