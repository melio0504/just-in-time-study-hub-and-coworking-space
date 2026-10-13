import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "About Our Study Hub",
  description:
    "Meet Just In Time Study Hub, a focused study and coworking community serving students and professionals in Manila's University Belt since 2019.",
  path: "/about",
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
