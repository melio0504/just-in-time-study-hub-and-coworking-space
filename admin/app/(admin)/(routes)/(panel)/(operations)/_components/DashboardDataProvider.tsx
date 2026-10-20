"use client";

import { createContext, useContext } from "react";

import type { Tables } from "@/lib/supabase/database.types";

export type DashboardAuditLog = Tables<"audit_logs"> & {
  profile?: { full_name: string; email: string | null } | null;
};

export type DashboardInitialData = {
  bookings: Tables<"bookings">[];
  checkIns: Tables<"check_in_sessions">[];
  seats: Tables<"seats">[];
  walkIns: Tables<"walk_in_occupancies">[];
  announcements: Tables<"announcements">[];
  logs: DashboardAuditLog[];
  error: string;
};

const DashboardDataContext = createContext<DashboardInitialData | null>(null);

export function DashboardDataProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData: DashboardInitialData;
}) {
  return (
    <DashboardDataContext.Provider value={initialData}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardInitialData() {
  const data = useContext(DashboardDataContext);
  if (!data) {
    throw new Error("useDashboardInitialData must be used inside DashboardDataProvider.");
  }
  return data;
}
