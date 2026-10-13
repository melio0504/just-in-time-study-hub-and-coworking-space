import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Reserve a Study Seat",
  description:
    "Choose your date, time, and preferred workspace, then reserve a seat online at Just In Time Study Hub in Mendiola, Manila.",
  path: "/reserve",
});

export default function ReserveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
