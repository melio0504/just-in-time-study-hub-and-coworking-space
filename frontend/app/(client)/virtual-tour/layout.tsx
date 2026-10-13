import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Virtual Tour",
  description:
    "Explore Just In Time Study Hub online and find the quiet zone, study pod, or coworking seat that fits your next productive session.",
  path: "/virtual-tour",
});

export default function VirtualTourLayout({ children }: { children: React.ReactNode }) {
  return children;
}
