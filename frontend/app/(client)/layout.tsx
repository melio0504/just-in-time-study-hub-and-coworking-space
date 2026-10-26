import { AnnouncementNotification } from "@/app/components/AnnouncementNotification";
import { CapstoneNotice } from "@/app/components/CapstoneNotice";
import { Footer } from "@/app/components/Footer";
import { Header } from "@/app/components/Header";
import { ScrollToTop } from "@/app/components/ScrollToTop";

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <CapstoneNotice />
      <Header />
      <AnnouncementNotification />
      <main className="flex-1">{children}</main>
      <Footer />
      <ScrollToTop />
    </div>
  );
}
