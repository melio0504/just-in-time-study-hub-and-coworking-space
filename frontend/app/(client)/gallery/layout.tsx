import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Study Space Gallery",
  description:
    "View Just In Time Study Hub's quiet zones, private study pods, open workspaces, and amenities in Mendiola, Manila.",
  path: "/gallery",
});

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
