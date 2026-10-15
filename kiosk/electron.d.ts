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
  };

  type KioskScanResponse = { result: KioskScanResult };

  type KioskActiveSession = {
    bookingId: string;
    guestName: string;
    seats: string[];
    checkedInAt: string;
    scheduledEnd: string;
  };

  interface Window {
    kioskDesktop?: {
      isElectron: true;
      scanBookingPass: (code: string) => Promise<KioskScanResponse>;
      getActiveSessions: () => Promise<{ sessions: KioskActiveSession[] }>;
    };
  }
}
