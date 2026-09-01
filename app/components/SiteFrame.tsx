"use client";

import { usePathname } from "next/navigation";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ScrollToTop } from "./ScrollToTop";

export function SiteFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin");
  const isKioskRoute = pathname?.startsWith("/kiosk");

  if (isAdminRoute || isKioskRoute) {
    return (
      <>
        <main className={isKioskRoute ? "h-dvh overflow-hidden" : "flex-1"}>{children}</main>
        <ScrollToTop />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <ScrollToTop />
    </>
  );
}