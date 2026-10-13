import type { MetadataRoute } from "next";
import { metadataBase } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: Array<{
    path: string;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    priority: number;
  }> = [
    { path: "/", changeFrequency: "weekly", priority: 1 },
    { path: "/pricing", changeFrequency: "monthly", priority: 0.9 },
    { path: "/reserve", changeFrequency: "weekly", priority: 0.9 },
    { path: "/about", changeFrequency: "yearly", priority: 0.7 },
    { path: "/gallery", changeFrequency: "monthly", priority: 0.7 },
    { path: "/virtual-tour", changeFrequency: "monthly", priority: 0.7 },
    { path: "/announcements", changeFrequency: "weekly", priority: 0.7 },
    { path: "/privacy-policy", changeFrequency: "yearly", priority: 0.2 },
  ];

  return pages.map(({ path, changeFrequency, priority }) => ({
    url: new URL(path, metadataBase).toString(),
    changeFrequency,
    priority,
  }));
}
