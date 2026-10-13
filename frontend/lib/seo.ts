import type { Metadata } from "next";

export const siteConfig = {
  name: "Just In Time Study Hub and Coworking Space",
  shortName: "Just In Time Study Hub",
  defaultTitle: "Just In Time Study Hub and Coworking Space",
  description:
    "Study, work, and stay productive at Just In Time Study Hub and Coworking Space in Mendiola, Manila. Explore affordable rates, focused workspaces, and online seat reservations.",
  url: "https://jit-studyhub.com",
  email: "jit.studyhub@gmail.com",
  telephone: "+639062885570",
  social: {
    facebook: "https://www.facebook.com/jit.studyhub/",
    instagram: "https://www.instagram.com/jitstudyhub/",
    tiktok: "https://www.tiktok.com/@jitstudyhubandcoworking",
  },
} as const;

function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;

  try {
    const url = new URL(configuredUrl || siteConfig.url);

    // Local development URLs must never leak into canonical tags or sitemaps.
    return url.protocol === "https:" ? url : new URL(siteConfig.url);
  } catch {
    return new URL(siteConfig.url);
  }
}

export const metadataBase = getSiteUrl();

type PageMetadata = {
  title: string;
  description: string;
  path: `/${string}` | "/";
  noIndex?: boolean;
};

export function createPageMetadata({
  title,
  description,
  path,
  noIndex = false,
}: PageMetadata): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      url: path,
      title,
      description,
      siteName: siteConfig.name,
      locale: "en_PH",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: `${siteConfig.shortName} in Manila`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
    ...(noIndex
      ? {
          robots: {
            index: false,
            follow: false,
            noarchive: true,
          },
        }
      : {}),
  };
}
