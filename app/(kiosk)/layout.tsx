import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Facility Kiosk | Just In Time Study Hub",
  description:
    "QR check-in and check-out kiosk for Just In Time Study Hub and Coworking Space.",
};

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-dvh overflow-hidden">{children}</div>;
}
