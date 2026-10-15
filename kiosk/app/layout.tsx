import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Facility Kiosk | Just In Time Study Hub",
  description: "Local QR check-in and check-out kiosk for the study hub front desk.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
