export {};

declare global {
  type KioskScanResult = {
    action: "check-in" | "check-out";
    reservation_code: string;
    guest_name: string;
    seat_ids: string[];
    scheduled_start: string;
    scheduled_end: string;
    scanned_at: string;
    overtime_minutes: number;
    overtime_billable_hours: number;
    hourly_rate_cents: number;
    overtime_charge_cents: number;
  };

  type KioskScanResponse = { result: KioskScanResult };

  type KioskActiveSession = {
    bookingId: string;
    guestName: string;
    seats: string[];
    checkedInAt: string;
    scheduledEnd: string;
  };

  type KioskActivityEntry = {
    id: string;
    type: "check-in" | "check-out";
    bookingId: string;
    guestName: string;
    seats: string[];
    timestamp: string;
  };

  interface Window {
    kioskDesktop?: {
      isElectron: true;
      scanBookingPass: (code: string) => Promise<KioskScanResponse>;
      getActiveSessions: () => Promise<{
        sessions: KioskActiveSession[];
        activity?: KioskActivityEntry[];
      }>;
    };
  }
}
