import type { MetadataRoute } from "next";
import { metadataBase } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/"],
    },
    sitemap: new URL("/sitemap.xml", metadataBase).toString(),
    host: metadataBase.origin,
  };
}
