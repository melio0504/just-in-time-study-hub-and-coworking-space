import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Admin | Just In Time Study Hub",
    template: "%s | Just In Time Admin",
  },
};

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="min-h-dvh">{children}</div>;
}
