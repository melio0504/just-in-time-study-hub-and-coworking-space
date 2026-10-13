import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Study Hub Rates & Packages",
  description:
    "Compare affordable hourly, whole-day, and multi-day study space rates at Just In Time Study Hub in Mendiola, Manila.",
  path: "/pricing",
});

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
