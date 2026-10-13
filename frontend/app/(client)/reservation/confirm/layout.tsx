import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Confirm Reservation",
  description: "Review and confirm your Just In Time Study Hub reservation.",
  path: "/reservation/confirm",
  noIndex: true,
});

export default function ConfirmationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
