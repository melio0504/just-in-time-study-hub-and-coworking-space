"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Banknote, Clock3, History, Loader2, Plus, ReceiptText, UserRound, X } from 'lucide-react';
import { useAdminAccess } from '../../_components/AdminShell';
import { currentBusinessDateKey } from '@/lib/business-reports';
import { createClient } from '@/lib/supabase/client';
import type { Tables } from '@/lib/supabase/database.types';

type Seat = Tables<'seats'>;
type Rate = Tables<'service_rate_plans'>;
type WalkIn = Tables<'walk_in_occupancies'> & {
  seat: Pick<Seat, 'code' | 'name' | 'zone'> | null;
};
type PaymentMethod = 'cash' | 'gcash' | 'qrph' | 'other';
type PaymentStatus = 'paid' | 'unpaid';

const peso = (centavos: number | null) => `₱${Math.round((centavos ?? 0) / 100).toLocaleString('en-PH')}`;
const formatDateTime = (value: string) => new Date(value).toLocaleString('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});
const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder}m`;
  return `${hours}h${remainder ? ` ${remainder}m` : ''}`;
};
const manilaInputValue = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
};
const manilaInputToIso = (value: string) => new Date(`${value}:00+08:00`).toISOString();
const elapsedMinutes = (startedAt: string, endedAt?: string | null) => Math.max(
  1,
  Math.ceil((new Date(endedAt ?? Date.now()).getTime() - new Date(startedAt).getTime()) / 60000),
);

export default function WalkInsPage() {
  const access = useAdminAccess();
  const searchParams = useSearchParams();
  const [walkIns, setWalkIns] = useState<WalkIn[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showStart, setShowStart] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [checkoutTarget, setCheckoutTarget] = useState<WalkIn | null>(null);
  const openedCheckoutId = useRef<string | null>(null);
  const [startForm, setStartForm] = useState({ seat: '', guest: '', notes: '' });
  const [manualForm, setManualForm] = useState(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 60 * 60000);
    return {
      seat: '', guest: '', start: manilaInputValue(start), end: manilaInputValue(end),
      amount: '', amountDirty: false, paymentMethod: 'cash' as PaymentMethod,
      paymentStatus: 'paid' as PaymentStatus, overrideReason: '', notes: '',
    };
  });
  const [checkoutForm, setCheckoutForm] = useState({
    end: '', amount: '', amountDirty: false, paymentMethod: 'cash' as PaymentMethod,
    paymentStatus: 'paid' as PaymentStatus, overrideReason: '',
  });

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const [walkInResult, seatResult, rateResult] = await Promise.all([
      supabase.from('walk_in_occupancies').select('*, seat:seats(code, name, zone)').order('started_at', { ascending: false }).limit(500),
      supabase.from('seats').select().eq('is_active', true).order('code'),
      supabase.from('service_rate_plans').select().eq('is_active', true).order('sort_order'),
    ]);
    const firstError = walkInResult.error || seatResult.error || rateResult.error;
    setError(firstError?.message ?? '');
    setWalkIns((walkInResult.data ?? []) as WalkIn[]);
    setSeats(seatResult.data ?? []);
    setRates(rateResult.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadData());
    const supabase = createClient();
    const channel = supabase.channel('walk-in-services-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'walk_in_occupancies' }, () => void loadData())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadData]);

  const active = useMemo(() => walkIns.filter((walkIn) => walkIn.status === 'active'), [walkIns]);
  const completed = useMemo(() => walkIns.filter((walkIn) => walkIn.status !== 'active'), [walkIns]);
  const activeSeatIds = useMemo(() => new Set(active.map((walkIn) => walkIn.seat_id)), [active]);
  const availableSeats = useMemo(() => seats.filter((seat) => !activeSeatIds.has(seat.id) && seat.status !== 'maintenance'), [activeSeatIds, seats]);
  const today = currentBusinessDateKey();
  const completedToday = completed.filter((walkIn) => walkIn.business_date === today && walkIn.status === 'completed');
  const revenueToday = completedToday.reduce((sum, walkIn) => sum + (walkIn.payment_status === 'paid' ? walkIn.charged_amount_cents ?? 0 : 0), 0);
  const outstandingToday = completedToday.reduce((sum, walkIn) => sum + (walkIn.payment_status === 'unpaid' ? walkIn.charged_amount_cents ?? 0 : 0), 0);

  const getRate = useCallback((minutes: number) => rates.find((rate) => (
    rate.min_minutes <= minutes && (rate.max_minutes === null || rate.max_minutes >= minutes)
  )), [rates]);

  const openCheckout = useCallback((walkIn: WalkIn) => {
    const end = manilaInputValue(new Date());
    const rate = getRate(elapsedMinutes(walkIn.started_at, manilaInputToIso(end)));
    setCheckoutTarget(walkIn);
    setCheckoutForm({
      end,
      amount: rate ? String(rate.price_cents / 100) : '',
      amountDirty: false,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      overrideReason: '',
    });
    setError('');
  }, [getRate]);

  useEffect(() => {
    const checkoutId = searchParams.get('checkout');
    if (!checkoutId || openedCheckoutId.current === checkoutId || !walkIns.length || checkoutTarget) return;
    const target = walkIns.find((walkIn) => walkIn.id === checkoutId && walkIn.status === 'active');
    if (target) {
      openedCheckoutId.current = checkoutId;
      queueMicrotask(() => openCheckout(target));
    }
  }, [checkoutTarget, openCheckout, searchParams, walkIns]);

  const startWalkIn = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    const { error: rpcError } = await createClient().rpc('start_walk_in', {
      p_seat_code: startForm.seat,
      p_guest_name: startForm.guest.trim() || undefined,
      p_notes: startForm.notes.trim() || undefined,
    });
    if (rpcError) setError(rpcError.message);
    else {
      setMessage(`Walk-in started at seat ${startForm.seat}.`);
      setShowStart(false);
      setStartForm({ seat: '', guest: '', notes: '' });
      await loadData();
    }
    setSaving(false);
  };

  const checkoutMinutes = checkoutTarget && checkoutForm.end
    ? elapsedMinutes(checkoutTarget.started_at, manilaInputToIso(checkoutForm.end)) : 0;
  const checkoutRate = getRate(checkoutMinutes);
  const checkoutAmountCents = Math.round((Number(checkoutForm.amount) || 0) * 100);
  const checkoutOverridden = Boolean(checkoutRate && checkoutAmountCents !== checkoutRate.price_cents);

  const checkoutWalkIn = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!checkoutTarget) return;
    setSaving(true); setError(''); setMessage('');
    const { error: rpcError } = await createClient().rpc('checkout_walk_in', {
      p_walk_in_id: checkoutTarget.id,
      p_ended_at: manilaInputToIso(checkoutForm.end),
      p_payment_method: checkoutForm.paymentMethod,
      p_payment_status: checkoutForm.paymentStatus,
      p_charged_amount_cents: checkoutAmountCents,
      p_override_reason: checkoutForm.overrideReason.trim() || undefined,
    });
    if (rpcError) setError(rpcError.message);
    else {
      setMessage(`${checkoutTarget.guest_name || 'Walk-in guest'} checked out. Charge recorded: ${peso(checkoutAmountCents)}.`);
      setCheckoutTarget(null);
      await loadData();
    }
    setSaving(false);
  };

  const manualMinutes = manualForm.start && manualForm.end
    ? elapsedMinutes(manilaInputToIso(manualForm.start), manilaInputToIso(manualForm.end)) : 0;
  const manualRate = getRate(manualMinutes);
  const manualAmountCents = Math.round((Number(manualForm.amount) || 0) * 100);
  const manualOverridden = Boolean(manualRate && manualAmountCents !== manualRate.price_cents);

  const updateManualTime = (field: 'start' | 'end', value: string) => {
    const next = { ...manualForm, [field]: value };
    const minutes = next.start && next.end ? elapsedMinutes(manilaInputToIso(next.start), manilaInputToIso(next.end)) : 0;
    const rate = getRate(minutes);
    setManualForm({ ...next, amount: next.amountDirty ? next.amount : rate ? String(rate.price_cents / 100) : '' });
  };

  const createManualWalkIn = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    const { error: rpcError } = await createClient().rpc('create_completed_walk_in', {
      p_seat_code: manualForm.seat,
      p_guest_name: manualForm.guest.trim(),
      p_started_at: manilaInputToIso(manualForm.start),
      p_ended_at: manilaInputToIso(manualForm.end),
      p_payment_method: manualForm.paymentMethod,
      p_payment_status: manualForm.paymentStatus,
      p_charged_amount_cents: manualAmountCents,
      p_override_reason: manualForm.overrideReason.trim() || undefined,
      p_notes: manualForm.notes.trim() || undefined,
    });
    if (rpcError) setError(rpcError.message);
    else {
      setMessage('Completed walk-in added to the business records.');
      setShowManual(false);
      await loadData();
    }
    setSaving(false);
  };

  const voidWalkIn = async (walkIn: WalkIn) => {
    const reason = window.prompt('Why should this walk-in be voided?');
    if (!reason?.trim()) return;
    setSaving(true); setError('');
    const { error: rpcError } = await createClient().rpc('void_walk_in', { p_walk_in_id: walkIn.id, p_reason: reason.trim() });
    if (rpcError) setError(rpcError.message);
    else { setMessage('Walk-in record voided.'); await loadData(); }
    setSaving(false);
  };

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-[#5f5248]"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading walk-in services…</div>;

  return <div className="mx-auto max-w-[1500px]">
    <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0"><p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-[#b47b0d]">Front-desk operations</p><h1 className="text-3xl font-semibold tracking-tight text-[#2d2520] sm:text-4xl">Walk-in services</h1><p className="mt-2 max-w-3xl text-[#5f5248]">Track actual stay time, checkout charges, payments, and manually recovered walk-in records.</p></div>
      <div className="grid w-full shrink-0 gap-3 sm:w-auto sm:grid-cols-2"><button onClick={() => setShowManual(true)} className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-[#cdbfae] bg-white px-5 py-3 text-sm font-semibold text-[#3f3630] shadow-sm hover:bg-[#fff8e8]"><History className="h-4 w-4" />Add past walk-in</button><button onClick={() => setShowStart(true)} className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#c4841a] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#a86f12]"><Plus className="h-4 w-4" />Start walk-in</button></div>
    </div>

    {message && <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{message}</div>}
    {error && <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</div>}

    <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard icon={Clock3} label="Active now" value={String(active.length)} detail="Open walk-in sessions" />
      <SummaryCard icon={UserRound} label="Completed today" value={String(completedToday.length)} detail="Walk-in customers served" />
      <SummaryCard icon={Banknote} label="Paid today" value={peso(revenueToday)} detail="Collected walk-in revenue" />
      <SummaryCard icon={ReceiptText} label="Outstanding" value={peso(outstandingToday)} detail="Unpaid completed sessions" />
    </div>

    <section className="mb-6 rounded-3xl border border-[#e8dfd4] bg-white p-5 shadow-sm">
      <div className="mb-4"><h2 className="text-xl font-semibold text-[#2d2520]">Active walk-ins</h2><p className="text-sm text-[#5f5248]">Checkout calculates the matching service tier from the actual stay.</p></div>
      {active.length === 0 ? <Empty text="No walk-in sessions are active." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{active.map((walkIn) => {
        const minutes = elapsedMinutes(walkIn.started_at);
        const rate = getRate(minutes);
        return <article key={walkIn.id} className="rounded-2xl border border-amber-200 bg-[#fffbf3] p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#9b6810]">Seat {walkIn.seat?.code ?? '—'}</p><h3 className="mt-1 text-lg font-semibold text-[#2d2520]">{walkIn.guest_name || 'Walk-in guest'}</h3></div><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Active</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><Metric label="Started" value={formatDateTime(walkIn.started_at)} /><Metric label="Current stay" value={formatDuration(minutes)} /><Metric label="Suggested plan" value={rate?.name ?? 'Review'} /><Metric label="Estimated charge" value={rate ? peso(rate.price_cents) : '—'} /></dl><button onClick={() => openCheckout(walkIn)} className="mt-4 w-full rounded-xl bg-[#2d2520] px-4 py-2.5 text-sm font-semibold text-white hover:bg-black">Checkout & record payment</button></article>;
      })}</div>}
    </section>

    <section className="rounded-3xl border border-[#e8dfd4] bg-white p-5 shadow-sm"><div className="mb-4"><h2 className="text-xl font-semibold text-[#2d2520]">Walk-in history</h2><p className="text-sm text-[#5f5248]">The latest 500 sessions, including unpaid and voided entries.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm text-[#2d2520]"><thead className="text-xs font-semibold uppercase tracking-wider text-[#3f3630]"><tr><th className="px-3 py-3">Business date</th><th className="px-3 py-3">Guest / seat</th><th className="px-3 py-3">Stay</th><th className="px-3 py-3">Service</th><th className="px-3 py-3">Charge</th><th className="px-3 py-3">Payment</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Action</th></tr></thead><tbody className="text-[#2d2520]">{completed.map((walkIn) => <tr key={walkIn.id} className="border-t border-[#eee6dc]"><td className="px-3 py-4">{walkIn.business_date}</td><td className="px-3 py-4"><p className="font-medium text-[#2d2520]">{walkIn.guest_name || 'Walk-in guest'}</p><p className="text-xs font-medium text-[#3f3630]">Seat {walkIn.seat?.code ?? '—'} · {walkIn.seat?.zone ?? 'Unknown zone'}</p></td><td className="px-3 py-4">{walkIn.billable_minutes ? formatDuration(walkIn.billable_minutes) : walkIn.ended_at ? formatDuration(elapsedMinutes(walkIn.started_at, walkIn.ended_at)) : '—'}</td><td className="px-3 py-4">{walkIn.service_name ?? 'Legacy entry'}</td><td className="px-3 py-4 font-semibold">{walkIn.charged_amount_cents === null ? 'Unpriced' : peso(walkIn.charged_amount_cents)}</td><td className="px-3 py-4 capitalize">{walkIn.payment_method ?? '—'} · {walkIn.payment_status}</td><td className="px-3 py-4"><StatusPill status={walkIn.status} /></td><td className="px-3 py-4 text-right">{access.role === 'admin' && walkIn.status !== 'voided' && <button disabled={saving} onClick={() => void voidWalkIn(walkIn)} className="text-xs font-semibold text-red-700 hover:underline">Void</button>}</td></tr>)}</tbody></table></div>{completed.length === 0 && <Empty text="No completed walk-ins yet." />}</section>

    {showStart && <Modal title="Start walk-in" subtitle="The timer begins as soon as you confirm." onClose={() => setShowStart(false)}><form onSubmit={startWalkIn} className="space-y-4"><SelectSeat value={startForm.seat} onChange={(seat) => setStartForm({ ...startForm, seat })} seats={availableSeats} /><Field label="Guest name (optional)"><input autoFocus value={startForm.guest} onChange={(event) => setStartForm({ ...startForm, guest: event.target.value })} maxLength={120} className="input" placeholder="Walk-in guest" /></Field><Field label="Notes (optional)"><textarea value={startForm.notes} onChange={(event) => setStartForm({ ...startForm, notes: event.target.value })} maxLength={1000} rows={3} className="input resize-y" /></Field><SubmitButton saving={saving} label="Start session" /></form></Modal>}

    {checkoutTarget && <Modal title={`Checkout seat ${checkoutTarget.seat?.code ?? ''}`} subtitle={`${checkoutTarget.guest_name || 'Walk-in guest'} · started ${formatDateTime(checkoutTarget.started_at)}`} onClose={() => setCheckoutTarget(null)}><form onSubmit={checkoutWalkIn} className="space-y-4"><Field label="Checkout time"><input type="datetime-local" required value={checkoutForm.end} onChange={(event) => { const end = event.target.value; const rate = getRate(elapsedMinutes(checkoutTarget.started_at, manilaInputToIso(end))); setCheckoutForm({ ...checkoutForm, end, amount: checkoutForm.amountDirty ? checkoutForm.amount : rate ? String(rate.price_cents / 100) : '' }); }} className="input" /></Field><PriceSummary minutes={checkoutMinutes} rate={checkoutRate} /><BillingFields value={checkoutForm} onChange={setCheckoutForm} overridden={checkoutOverridden} /><SubmitButton saving={saving} label={`Complete checkout · ${peso(checkoutAmountCents)}`} /></form></Modal>}

    {showManual && <Modal title="Add completed walk-in" subtitle="Recover a walk-in that was not recorded live." onClose={() => setShowManual(false)}><form onSubmit={createManualWalkIn} className="space-y-4"><SelectSeat value={manualForm.seat} onChange={(seat) => setManualForm({ ...manualForm, seat })} seats={seats} /><Field label="Guest name (optional)"><input value={manualForm.guest} onChange={(event) => setManualForm({ ...manualForm, guest: event.target.value })} maxLength={120} className="input" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Check-in"><input type="datetime-local" required value={manualForm.start} onChange={(event) => updateManualTime('start', event.target.value)} className="input" /></Field><Field label="Checkout"><input type="datetime-local" required value={manualForm.end} onChange={(event) => updateManualTime('end', event.target.value)} className="input" /></Field></div><PriceSummary minutes={manualMinutes} rate={manualRate} /><BillingFields value={manualForm} onChange={setManualForm} overridden={manualOverridden} /><Field label="Notes (optional)"><textarea value={manualForm.notes} onChange={(event) => setManualForm({ ...manualForm, notes: event.target.value })} maxLength={1000} rows={2} className="input resize-y" /></Field><SubmitButton saving={saving} label={`Add completed walk-in · ${peso(manualAmountCents)}`} /></form></Modal>}
  </div>;
}

function SummaryCard({ icon: Icon, label, value, detail }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; detail: string }) { return <div className="rounded-3xl border border-[#e8dfd4] bg-white p-5 shadow-sm"><span className="inline-flex rounded-xl bg-[#fef3dc] p-2.5 text-[#b47b0d]"><Icon className="h-5 w-5" /></span><p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[#5f5248]">{label}</p><p className="mt-1 text-3xl font-semibold text-[#2d2520]">{value}</p><p className="mt-1 text-sm text-[#5f5248]">{detail}</p></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs uppercase tracking-wider text-[#6b5e52]">{label}</dt><dd className="mt-1 font-medium text-[#2d2520]">{value}</dd></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-[#d8cec2] px-5 py-10 text-center text-sm text-[#5f5248]">{text}</div>; }
function StatusPill({ status }: { status: string }) { return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${status === 'completed' ? 'bg-emerald-100 text-emerald-700' : status === 'voided' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{status}</span>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-[#3f3630]">{label}</span>{children}</label>; }
function SelectSeat({ value, onChange, seats }: { value: string; onChange: (value: string) => void; seats: Seat[] }) { return <Field label="Seat"><select required value={value} onChange={(event) => onChange(event.target.value)} className="input"><option value="">Select a seat</option>{seats.map((seat) => <option key={seat.id} value={seat.code}>{seat.code} · {seat.zone}</option>)}</select></Field>; }
function PriceSummary({ minutes, rate }: { minutes: number; rate?: Rate }) { return <div className="grid grid-cols-3 gap-3 rounded-2xl bg-[#fff8e8] p-4 text-sm"><Metric label="Actual stay" value={minutes ? formatDuration(minutes) : '—'} /><Metric label="Suggested plan" value={rate?.name ?? 'Review'} /><Metric label="List price" value={rate ? peso(rate.price_cents) : '—'} /></div>; }
function BillingFields<T extends { amount: string; amountDirty: boolean; paymentMethod: PaymentMethod; paymentStatus: PaymentStatus; overrideReason: string }>({ value, onChange, overridden }: { value: T; onChange: (value: T) => void; overridden: boolean }) { return <><div className="grid gap-4 sm:grid-cols-3"><Field label="Amount charged"><div className="flex rounded-xl border border-[#b9aa9b] bg-white focus-within:border-[#c4841a] focus-within:ring-2 focus-within:ring-amber-100"><span className="px-3 py-3 text-[#5f5248]">₱</span><input type="number" min="0" step="0.01" required value={value.amount} onChange={(event) => onChange({ ...value, amount: event.target.value, amountDirty: true })} className="min-w-0 flex-1 rounded-r-xl py-3 pr-3 outline-none" /></div></Field><Field label="Payment method"><select value={value.paymentMethod} onChange={(event) => onChange({ ...value, paymentMethod: event.target.value as PaymentMethod })} className="input"><option value="cash">Cash</option><option value="gcash">GCash</option><option value="qrph">QRPh</option><option value="other">Other</option></select></Field><Field label="Payment status"><select value={value.paymentStatus} onChange={(event) => onChange({ ...value, paymentStatus: event.target.value as PaymentStatus })} className="input"><option value="paid">Paid</option><option value="unpaid">Unpaid</option></select></Field></div>{overridden && <Field label="Price adjustment reason"><textarea required maxLength={500} rows={2} value={value.overrideReason} onChange={(event) => onChange({ ...value, overrideReason: event.target.value })} className="input resize-y" placeholder="Discount, correction, promotion…" /></Field>}</>; }
function SubmitButton({ saving, label }: { saving: boolean; label: string }) { return <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#c4841a] px-5 py-3 font-semibold text-white hover:bg-[#a86f12] disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'Saving…' : label}</button>; }
function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#2d2520]/55 p-4 backdrop-blur-sm" onMouseDown={onClose}><div className="my-auto w-full max-w-2xl rounded-3xl bg-white p-6 text-[#2d2520] shadow-2xl sm:p-7" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true"><div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold">{title}</h2><p className="mt-1 text-sm text-[#5f5248]">{subtitle}</p></div><button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-[#f7f1e8]" aria-label="Close"><X className="h-5 w-5" /></button></div>{children}</div></div>; }
