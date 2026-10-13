import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "My Account",
  description: "Manage your Just In Time Study Hub account and reservations.",
  path: "/account",
  noIndex: true,
});

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
