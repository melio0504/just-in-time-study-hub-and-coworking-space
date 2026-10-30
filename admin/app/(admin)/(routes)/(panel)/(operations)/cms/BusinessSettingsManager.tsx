"use client";

import {
  AlertTriangle,
  Armchair,
  CalendarOff,
  Clock3,
  Loader2,
  PhilippinePeso,
  Plus,
  Save,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type { Tables, TablesUpdate } from "@/lib/supabase/database.types";

type BusinessHour = Tables<"business_hours">;
type BusinessClosure = Tables<"business_closures">;
type BookingSetting = Tables<"booking_settings">;
type ServiceRate = Tables<"service_rate_plans">;
type PackageRate = Tables<"package_rate_plans">;
type Seat = Pick<Tables<"seats">, "seat_type" | "hourly_rate_cents">;
type ClosureDraft = {
  name: string;
  closure_type: "holiday" | "temporary";
  starts_on: string;
  ends_on: string;
  note: string;
};
type DeleteTarget =
  | { kind: "closure"; item: BusinessClosure }
  | { kind: "package"; item: PackageRate };

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const newClosure = (): ClosureDraft => ({
  name: "",
  closure_type: "temporary",
  starts_on: today(),
  ends_on: today(),
  note: "",
});

const peso = (cents: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(cents / 100);

const centsFromInput = (value: string) => Math.max(0, Math.round((Number(value) || 0) * 100));
const labelForSeatType = (value: string) =>
  value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function BusinessSettingsManager() {
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [closures, setClosures] = useState<BusinessClosure[]>([]);
  const [settings, setSettings] = useState<BookingSetting | null>(null);
  const [serviceRates, setServiceRates] = useState<ServiceRate[]>([]);
  const [packageRates, setPackageRates] = useState<PackageRate[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [closureForm, setClosureForm] = useState(newClosure);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const [hoursResult, closureResult, settingsResult, serviceResult, packageResult, seatResult] =
      await Promise.all([
        supabase.from("business_hours").select().order("day_of_week"),
        supabase.from("business_closures").select().order("starts_on", { ascending: false }),
        supabase.from("booking_settings").select().eq("singleton", true).single(),
        supabase.from("service_rate_plans").select().order("sort_order"),
        supabase.from("package_rate_plans").select().order("sort_order"),
        supabase.from("seats").select("seat_type, hourly_rate_cents").eq("is_active", true),
      ]);
    const error =
      hoursResult.error ||
      closureResult.error ||
      settingsResult.error ||
      serviceResult.error ||
      packageResult.error ||
      seatResult.error;
    if (error) setMessage(error.message);
    setHours(hoursResult.data ?? []);
    setClosures(closureResult.data ?? []);
    setSettings(settingsResult.data ?? null);
    setServiceRates(serviceResult.data ?? []);
    setPackageRates(packageResult.data ?? []);
    setSeats(seatResult.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const seatRates = useMemo(() => {
    const grouped = new Map<string, { seatType: string; cents: number; count: number }>();
    for (const seat of seats) {
      const current = grouped.get(seat.seat_type);
      grouped.set(seat.seat_type, {
        seatType: seat.seat_type,
        cents: current?.cents ?? seat.hourly_rate_cents,
        count: (current?.count ?? 0) + 1,
      });
    }
    return [...grouped.values()].sort((left, right) => left.seatType.localeCompare(right.seatType));
  }, [seats]);

  const saveHours = async () => {
    setSaving("hours");
    setMessage("");
    const supabase = createClient();
    const results = await Promise.all(
      hours.map((item) =>
        supabase
          .from("business_hours")
          .update({ is_open: item.is_open, opens_at: item.opens_at, closes_at: item.closes_at })
          .eq("day_of_week", item.day_of_week),
      ),
    );
    const error = results.find((result) => result.error)?.error;
    setMessage(error?.message ?? "Operating hours saved.");
    setSaving("");
    if (!error) await load();
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving("settings");
    setMessage("");
    const { error } = await createClient()
      .from("booking_settings")
      .update({
        max_seats_per_booking: settings.max_seats_per_booking,
        min_duration_hours: settings.min_duration_hours,
        max_duration_hours: settings.max_duration_hours,
        minimum_notice_minutes: settings.minimum_notice_minutes,
        maximum_advance_days: settings.maximum_advance_days,
        no_show_grace_minutes: settings.no_show_grace_minutes,
      })
      .eq("singleton", true);
    setMessage(error?.message ?? "Booking limits saved.");
    setSaving("");
    if (!error) await load();
  };

  const addClosure = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving("closure");
    setMessage("");
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("business_closures").insert({
      ...closureForm,
      note: closureForm.note.trim() || null,
      name: closureForm.name.trim(),
      created_by: auth.user?.id ?? null,
    });
    setMessage(error?.message ?? "Closure added to the booking calendar.");
    setSaving("");
    if (!error) {
      setClosureForm(newClosure());
      await load();
    }
  };

  const updateClosure = async (
    closure: BusinessClosure,
    changes: TablesUpdate<"business_closures">,
  ) => {
    setSaving(`closure-${closure.id}`);
    setMessage("");
    const { error } = await createClient()
      .from("business_closures")
      .update(changes)
      .eq("id", closure.id);
    setMessage(error?.message ?? "Closure updated.");
    setSaving("");
    if (!error) await load();
  };

  const deleteClosure = async (closure: BusinessClosure) => {
    setSaving(`closure-${closure.id}`);
    setMessage("");
    const { error } = await createClient().from("business_closures").delete().eq("id", closure.id);
    if (error) {
      setDeleteError(error.message);
    } else {
      setDeleteTarget(null);
      setMessage("Closure deleted.");
    }
    setSaving("");
    if (!error) await load();
  };

  const saveServiceRate = async (rate: ServiceRate) => {
    setSaving(`service-${rate.id}`);
    setMessage("");
    const { error } = await createClient()
      .from("service_rate_plans")
      .update({
        name: rate.name,
        price_cents: rate.price_cents,
        is_active: rate.is_active,
      })
      .eq("id", rate.id);
    setMessage(error?.message ?? `${rate.name} saved.`);
    setSaving("");
    if (!error) await load();
  };

  const savePackageRate = async (rate: PackageRate) => {
    setSaving(`package-${rate.id}`);
    setMessage("");
    const { error } = await createClient()
      .from("package_rate_plans")
      .update({
        name: rate.name,
        duration_days: rate.duration_days,
        validity_days: rate.validity_days,
        price_cents: rate.price_cents,
        is_popular: rate.is_popular,
        is_active: rate.is_active,
        sort_order: rate.sort_order,
      })
      .eq("id", rate.id);
    setMessage(error?.message ?? `${rate.name} saved.`);
    setSaving("");
    if (!error) await load();
  };

  const addPackageRate = async () => {
    setSaving("new-package");
    setMessage("");
    const nextOrder = Math.max(0, ...packageRates.map((rate) => rate.sort_order)) + 10;
    const { error } = await createClient().from("package_rate_plans").insert({
      name: "New package",
      duration_days: 1,
      validity_days: 1,
      price_cents: 0,
      sort_order: nextOrder,
    });
    setMessage(error?.message ?? "New package added. Update its details below.");
    setSaving("");
    if (!error) await load();
  };

  const deletePackageRate = async (rate: PackageRate) => {
    setSaving(`package-${rate.id}`);
    setMessage("");
    const { error } = await createClient().from("package_rate_plans").delete().eq("id", rate.id);
    if (error) {
      setDeleteError(error.message);
    } else {
      setDeleteTarget(null);
      setMessage("Package deleted.");
    }
    setSaving("");
    if (!error) await load();
  };

  const requestDelete = (target: DeleteTarget) => {
    setDeleteError("");
    setDeleteTarget(target);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "closure") {
      await deleteClosure(deleteTarget.item);
    } else {
      await deletePackageRate(deleteTarget.item);
    }
  };

  const deletionBusy = deleteTarget
    ? saving ===
      `${deleteTarget.kind === "closure" ? "closure" : "package"}-${deleteTarget.item.id}`
    : false;

  const saveSeatRate = async (seatType: string, amount: string) => {
    setSaving(`seat-${seatType}`);
    setMessage("");
    const { error } = await createClient().rpc("update_seat_type_rate", {
      p_seat_type: seatType,
      p_hourly_rate_cents: centsFromInput(amount),
    });
    setMessage(error?.message ?? `${labelForSeatType(seatType)} reservation rate saved.`);
    setSaving("");
    if (!error) await load();
  };

  if (loading) {
    return (
      <div className="mx-auto flex max-w-[1500px] items-center justify-center rounded-3xl border border-[#e8dfd4] bg-white p-16 text-[#8a671a]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading business settings…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      {message && (
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-[#ecd8ad] bg-[#fff8e8] px-4 py-3 text-sm text-[#775919]">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="mb-7">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-[#b47b0d]">
          Content management
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[#2d2520] sm:text-4xl">
          Business settings
        </h1>
        <p className="mt-2 max-w-3xl text-[#5f5248]">
          Manage customer-visible hours and prices, close dates, and control reservation limits
          without changing application code.
        </p>
      </div>

      <div className="space-y-6">
        <SettingsCard
          icon={Clock3}
          title="Regular operating hours"
          description="Set each day’s schedule. A closing time earlier than opening means the hub closes the following morning."
          action={
            <SaveButton
              busy={saving === "hours"}
              onClick={() => void saveHours()}
              label="Save hours"
            />
          }>
          <div className="grid gap-3 xl:grid-cols-2">
            {hours.map((item, index) => (
              <div
                key={item.day_of_week}
                className="min-w-0 rounded-2xl border border-[#e8dfd4] bg-[#faf7f2] p-4">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <p className="min-w-0 font-semibold text-[#2d2520]">
                    {dayNames[item.day_of_week]}
                  </p>
                  <Toggle
                    checked={item.is_open}
                    onChange={(checked) =>
                      setHours((current) =>
                        current.map((hour, row) =>
                          row === index ? { ...hour, is_open: checked } : hour,
                        ),
                      )
                    }
                    label={item.is_open ? "Open" : "Closed"}
                  />
                </div>
                <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  <TimeField
                    label="Opens"
                    value={item.opens_at.slice(0, 5)}
                    disabled={!item.is_open}
                    onChange={(value) =>
                      setHours((current) =>
                        current.map((hour, row) =>
                          row === index ? { ...hour, opens_at: value } : hour,
                        ),
                      )
                    }
                  />
                  <TimeField
                    label="Closes"
                    value={item.closes_at.slice(0, 5)}
                    disabled={!item.is_open}
                    onChange={(value) =>
                      setHours((current) =>
                        current.map((hour, row) =>
                          row === index ? { ...hour, closes_at: value } : hour,
                        ),
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </SettingsCard>

        <SettingsCard
          icon={CalendarOff}
          title="Holidays and temporary closures"
          description="Active closure dates are unavailable in the reservation calendar and rejected by the booking system.">
          <div className="grid gap-5 xl:grid-cols-[minmax(300px,0.75fr)_1.4fr]">
            <form
              onSubmit={addClosure}
              className="space-y-4 rounded-2xl border border-[#e8dfd4] bg-[#faf7f2] p-5">
              <h3 className="font-semibold text-[#2d2520]">Add closure</h3>
              <Field label="Name">
                <input
                  required
                  maxLength={120}
                  value={closureForm.name}
                  onChange={(event) => setClosureForm({ ...closureForm, name: event.target.value })}
                  className="input"
                  placeholder="Christmas Day"
                />
              </Field>
              <Field label="Type">
                <select
                  value={closureForm.closure_type}
                  onChange={(event) =>
                    setClosureForm({
                      ...closureForm,
                      closure_type: event.target.value as "holiday" | "temporary",
                    })
                  }
                  className="input">
                  <option value="temporary">Temporary closure</option>
                  <option value="holiday">Holiday</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts">
                  <input
                    type="date"
                    required
                    value={closureForm.starts_on}
                    onChange={(event) =>
                      setClosureForm({
                        ...closureForm,
                        starts_on: event.target.value,
                        ends_on:
                          event.target.value > closureForm.ends_on
                            ? event.target.value
                            : closureForm.ends_on,
                      })
                    }
                    className="input"
                  />
                </Field>
                <Field label="Ends">
                  <input
                    type="date"
                    required
                    min={closureForm.starts_on}
                    value={closureForm.ends_on}
                    onChange={(event) =>
                      setClosureForm({ ...closureForm, ends_on: event.target.value })
                    }
                    className="input"
                  />
                </Field>
              </div>
              <Field label="Internal note (optional)">
                <textarea
                  maxLength={500}
                  rows={2}
                  value={closureForm.note}
                  onChange={(event) => setClosureForm({ ...closureForm, note: event.target.value })}
                  className="input resize-y"
                />
              </Field>
              <SaveButton
                type="submit"
                busy={saving === "closure"}
                label="Add closure"
                icon={Plus}
              />
            </form>
            <div className="space-y-3">
              {closures.length === 0 && (
                <Empty text="No holidays or temporary closures have been added." />
              )}
              {closures.map((closure) => (
                <article
                  key={closure.id}
                  className="flex flex-col gap-4 rounded-2xl border border-[#e8dfd4] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-[#2d2520]">{closure.name}</h3>
                      <span className="rounded-full bg-[#fef3dc] px-2.5 py-1 text-xs font-semibold capitalize text-[#8a671a]">
                        {closure.closure_type}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[#5f5248]">
                      {closure.starts_on === closure.ends_on
                        ? closure.starts_on
                        : `${closure.starts_on} – ${closure.ends_on}`}
                    </p>
                    {closure.note && <p className="mt-1 text-sm text-[#6b5e52]">{closure.note}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Toggle
                      checked={closure.is_active}
                      onChange={(checked) => void updateClosure(closure, { is_active: checked })}
                      label={closure.is_active ? "Active" : "Inactive"}
                      disabled={saving === `closure-${closure.id}`}
                    />
                    <button
                      type="button"
                      onClick={() => requestDelete({ kind: "closure", item: closure })}
                      disabled={saving === `closure-${closure.id}`}
                      className="rounded-xl border border-red-100 p-2.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      aria-label={`Delete ${closure.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          icon={PhilippinePeso}
          title="Customer pricing"
          description="Hourly walk-in plans and package deals appear on the public pricing page immediately after saving.">
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 font-semibold text-[#2d2520]">Hourly rates</h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {serviceRates.map((rate, index) => (
                  <RateEditor
                    key={rate.id}
                    title={rate.name}
                    amount={rate.price_cents}
                    active={rate.is_active}
                    busy={saving === `service-${rate.id}`}
                    onTitle={(name) =>
                      setServiceRates((current) =>
                        current.map((item, row) => (row === index ? { ...item, name } : item)),
                      )
                    }
                    onAmount={(price_cents) =>
                      setServiceRates((current) =>
                        current.map((item, row) =>
                          row === index ? { ...item, price_cents } : item,
                        ),
                      )
                    }
                    onActive={(is_active) =>
                      setServiceRates((current) =>
                        current.map((item, row) => (row === index ? { ...item, is_active } : item)),
                      )
                    }
                    onSave={() => void saveServiceRate(rate)}
                    detail={
                      rate.max_minutes
                        ? `${rate.min_minutes}–${rate.max_minutes} minutes`
                        : `${rate.min_minutes}+ minutes`
                    }
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-semibold text-[#2d2520]">Package deals</h3>
                <button
                  type="button"
                  onClick={() => void addPackageRate()}
                  disabled={saving === "new-package"}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#d8c9b9] bg-white px-3 py-2 text-sm font-semibold text-[#4f443c] hover:bg-[#fff8ed] disabled:opacity-50">
                  {saving === "new-package" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add package
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {packageRates.map((rate, index) => (
                  <div
                    key={rate.id}
                    className="rounded-2xl border border-[#e8dfd4] bg-[#faf7f2] p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Package name">
                        <input
                          value={rate.name}
                          onChange={(event) =>
                            setPackageRates((current) =>
                              current.map((item, row) =>
                                row === index ? { ...item, name: event.target.value } : item,
                              ),
                            )
                          }
                          className="input"
                        />
                      </Field>
                      <MoneyField
                        label="Price"
                        cents={rate.price_cents}
                        onChange={(price_cents) =>
                          setPackageRates((current) =>
                            current.map((item, row) =>
                              row === index ? { ...item, price_cents } : item,
                            ),
                          )
                        }
                      />
                      <Field label="Study days">
                        <input
                          type="number"
                          min="1"
                          max="365"
                          value={rate.duration_days}
                          onChange={(event) =>
                            setPackageRates((current) =>
                              current.map((item, row) =>
                                row === index
                                  ? { ...item, duration_days: Number(event.target.value) }
                                  : item,
                              ),
                            )
                          }
                          className="input"
                        />
                      </Field>
                      <Field label="Valid for days">
                        <input
                          type="number"
                          min={rate.duration_days}
                          max="730"
                          value={rate.validity_days}
                          onChange={(event) =>
                            setPackageRates((current) =>
                              current.map((item, row) =>
                                row === index
                                  ? { ...item, validity_days: Number(event.target.value) }
                                  : item,
                              ),
                            )
                          }
                          className="input"
                        />
                      </Field>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex gap-4">
                        <Toggle
                          checked={rate.is_active}
                          onChange={(is_active) =>
                            setPackageRates((current) =>
                              current.map((item, row) =>
                                row === index ? { ...item, is_active } : item,
                              ),
                            )
                          }
                          label="Active"
                        />
                        <Toggle
                          checked={rate.is_popular}
                          onChange={(is_popular) =>
                            setPackageRates((current) =>
                              current.map((item, row) =>
                                row === index ? { ...item, is_popular } : item,
                              ),
                            )
                          }
                          label="Best value"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => requestDelete({ kind: "package", item: rate })}
                          className="rounded-xl border border-red-100 p-2.5 text-red-600 hover:bg-red-50"
                          aria-label={`Delete ${rate.name}`}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <SaveButton
                          busy={saving === `package-${rate.id}`}
                          onClick={() => void savePackageRate(rate)}
                          label="Save"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SettingsCard>

        <SettingsCard
          icon={Armchair}
          title="Reservation seat rates"
          description="These hourly rates calculate the online reservation total. Saving a category updates every active seat in it.">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            {seatRates.map((rate) => (
              <SeatRateEditor
                key={`${rate.seatType}-${rate.cents}`}
                rate={rate}
                busy={saving === `seat-${rate.seatType}`}
                onSave={saveSeatRate}
              />
            ))}
          </div>
        </SettingsCard>

        {settings && (
          <SettingsCard
            icon={Settings2}
            title="Booking limits"
            description="These rules are enforced by the database for new reservations and schedule changes."
            action={
              <SaveButton
                busy={saving === "settings"}
                onClick={() => void saveSettings()}
                label="Save limits"
              />
            }>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <NumberSetting
                label="Maximum seats"
                min={1}
                max={5}
                value={settings.max_seats_per_booking}
                onChange={(value) => setSettings({ ...settings, max_seats_per_booking: value })}
                suffix="per booking"
              />
              <NumberSetting
                label="Minimum duration"
                min={1}
                max={24}
                value={settings.min_duration_hours}
                onChange={(value) => setSettings({ ...settings, min_duration_hours: value })}
                suffix="hours"
              />
              <NumberSetting
                label="Maximum duration"
                min={settings.min_duration_hours}
                max={24}
                value={settings.max_duration_hours}
                onChange={(value) => setSettings({ ...settings, max_duration_hours: value })}
                suffix="hours"
              />
              <NumberSetting
                label="Minimum notice"
                min={0}
                max={10080}
                value={settings.minimum_notice_minutes}
                onChange={(value) => setSettings({ ...settings, minimum_notice_minutes: value })}
                suffix="minutes"
              />
              <NumberSetting
                label="Advance booking"
                min={1}
                max={365}
                value={settings.maximum_advance_days}
                onChange={(value) => setSettings({ ...settings, maximum_advance_days: value })}
                suffix="days"
              />
              <NumberSetting
                label="No-show grace"
                min={5}
                max={240}
                value={settings.no_show_grace_minutes}
                onChange={(value) => setSettings({ ...settings, no_show_grace_minutes: value })}
                suffix="minutes after start"
              />
            </div>
          </SettingsCard>
        )}
      </div>
      {deleteTarget && (
        <DeleteConfirmationModal
          target={deleteTarget}
          busy={deletionBusy}
          error={deleteError}
          onClose={() => {
            if (!deletionBusy) setDeleteTarget(null);
          }}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}

function DeleteConfirmationModal({
  target,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  target: DeleteTarget;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isClosure = target.kind === "closure";
  const itemType = isClosure
    ? target.item.closure_type === "holiday"
      ? "holiday"
      : "temporary closure"
    : "package deal";
  const description = isClosure
    ? `Deleting this ${itemType} will make its dates available again unless another closure or closed weekday applies.`
    : "Deleting this package deal removes it from the customer pricing page. This action cannot be undone.";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#2d2520]/55 p-4 backdrop-blur-sm"
      onMouseDown={() => {
        if (!busy) onClose();
      }}>
      <div
        className="my-auto w-full max-w-md rounded-3xl bg-white p-6 text-[#2d2520] shadow-2xl sm:p-7"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-setting-title"
        aria-describedby="delete-setting-description">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-red-700">
                Permanent deletion
              </p>
              <h2 id="delete-setting-title" className="mt-1 text-2xl font-semibold">
                Delete {itemType}?
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl p-2 text-[#4f443c] hover:bg-[#f7f1e8] disabled:opacity-50"
            aria-label="Close delete dialog">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="rounded-2xl border border-[#e8dfd4] bg-[#faf7f2] p-4">
          <p className="font-semibold">{target.item.name}</p>
          {isClosure && (
            <p className="mt-1 text-sm text-[#574b42]">
              {target.item.starts_on === target.item.ends_on
                ? target.item.starts_on
                : `${target.item.starts_on} – ${target.item.ends_on}`}
            </p>
          )}
        </div>
        <p id="delete-setting-description" className="mt-4 text-sm leading-6 text-[#574b42]">
          {description}
        </p>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-[#b9aa9b] bg-white px-5 py-3 font-semibold text-[#3f3630] hover:bg-[#f7f1e8] disabled:opacity-50">
            Keep {itemType}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-3 font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Deleting…" : `Delete ${itemType}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[#e8dfd4] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#fef3dc] text-[#a27621]">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-xl font-semibold text-[#2d2520]">{title}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[#5f5248]">{description}</p>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-[#4f443c]">
      <span className="mb-2 block">{label}</span>
      {children}
    </label>
  );
}
function TimeField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="time"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="input disabled:cursor-not-allowed disabled:bg-[#eee9e2] disabled:text-[#94887d]"
      />
    </Field>
  );
}
function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[#4f443c]">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="relative h-6 w-11 rounded-full bg-[#d8cfc5] transition peer-checked:bg-[#e5a930] peer-disabled:opacity-50 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
      <span>{label}</span>
    </label>
  );
}
function SaveButton({
  busy,
  label,
  onClick,
  type = "button",
  icon: Icon = Save,
}: {
  busy: boolean;
  label: string;
  onClick?: () => void;
  type?: "button" | "submit";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy}
      className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2d2520] px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}
function MoneyField({
  label,
  cents,
  onChange,
}: {
  label: string;
  cents: number;
  onChange: (cents: number) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex rounded-xl border border-[#b9aa9b] bg-white focus-within:border-[#c4841a] focus-within:ring-2 focus-within:ring-amber-100">
        <span className="px-3 py-3 text-[#5f5248]">₱</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={cents / 100}
          onChange={(event) => onChange(centsFromInput(event.target.value))}
          className="min-w-0 flex-1 rounded-r-xl py-3 pr-3 outline-none"
        />
      </div>
    </Field>
  );
}
function RateEditor({
  title,
  amount,
  active,
  detail,
  busy,
  onTitle,
  onAmount,
  onActive,
  onSave,
}: {
  title: string;
  amount: number;
  active: boolean;
  detail: string;
  busy: boolean;
  onTitle: (value: string) => void;
  onAmount: (value: number) => void;
  onActive: (value: boolean) => void;
  onSave: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#e8dfd4] bg-[#faf7f2] p-4">
      <Field label="Display name">
        <input value={title} onChange={(event) => onTitle(event.target.value)} className="input" />
      </Field>
      <p className="mt-2 text-xs text-[#6b5e52]">{detail}</p>
      <div className="mt-3">
        <MoneyField label="Price" cents={amount} onChange={onAmount} />
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Toggle checked={active} onChange={onActive} label="Active" />
        <SaveButton busy={busy} onClick={onSave} label="Save" />
      </div>
    </div>
  );
}
function SeatRateEditor({
  rate,
  busy,
  onSave,
}: {
  rate: { seatType: string; cents: number; count: number };
  busy: boolean;
  onSave: (seatType: string, amount: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(rate.cents / 100));
  return (
    <div className="min-w-0 rounded-2xl border border-[#e8dfd4] bg-[#faf7f2] p-4">
      <p className="font-semibold text-[#2d2520]">{labelForSeatType(rate.seatType)}</p>
      <p className="mt-1 break-words text-xs text-[#6b5e52]">
        {rate.count} active seats · currently {peso(rate.cents)}/hour
      </p>
      <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row">
        <div className="flex min-w-0 flex-1 rounded-xl border border-[#b9aa9b] bg-white">
          <span className="px-3 py-2.5 text-[#5f5248]">₱</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full min-w-0 flex-1 rounded-r-xl pr-2 outline-none"
          />
        </div>
        <SaveButton busy={busy} onClick={() => void onSave(rate.seatType, amount)} label="Save" />
      </div>
    </div>
  );
}
function NumberSetting({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="input"
      />
      <span className="mt-1 block text-xs font-normal text-[#6b5e52]">{suffix}</span>
    </Field>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d8c9b9] p-8 text-center text-sm text-[#6b5e52]">
      {text}
    </div>
  );
}
