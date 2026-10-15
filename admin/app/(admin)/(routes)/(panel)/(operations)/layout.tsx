import {
  DashboardDataProvider,
  type DashboardAuditLog,
} from "./_components/DashboardDataProvider";
import { redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = await createClient();
  const [bookingResult, seatResult, walkInResult, announcementResult, logResult] = await Promise.all([
    supabase.from("bookings").select().order("created_at", { ascending: false }).limit(250),
    supabase.from("seats").select().order("code"),
    supabase.from("walk_in_occupancies").select().is("ended_at", null).order("started_at", { ascending: false }),
    supabase.from("announcements").select().order("starts_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("audit_logs").select("*, profile:profiles(full_name, email)").order("created_at", { ascending: false }).limit(200),
  ]);
  const firstError = bookingResult.error
    || seatResult.error
    || walkInResult.error
    || announcementResult.error
    || logResult.error;

  return (
    <DashboardDataProvider
      initialData={{
        bookings: bookingResult.data ?? [],
        seats: seatResult.data ?? [],
        walkIns: walkInResult.data ?? [],
        announcements: announcementResult.data ?? [],
        logs: (logResult.data ?? []) as DashboardAuditLog[],
        error: firstError?.message ?? "",
      }}
    >
      {children}
    </DashboardDataProvider>
  );
}
