import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  createPageMetadata,
  metadataBase,
  siteConfig,
} from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase,
  ...createPageMetadata({
    title: siteConfig.defaultTitle,
    description: siteConfig.description,
    path: "/",
  }),
  title: {
    default: siteConfig.defaultTitle,
    template: `%s | ${siteConfig.shortName}`,
  },
  applicationName: siteConfig.shortName,
  keywords: [
    "study hub Manila",
    "coworking space Manila",
    "study space Mendiola",
    "study place Quiapo",
    "workspace near University Belt",
    "seat reservation study hub",
  ],
  authors: [{ name: siteConfig.name, url: "/" }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  category: "education",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
  appleWebApp: {
    capable: true,
    title: siteConfig.shortName,
    statusBarStyle: "default",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fffcf7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${metadataBase.origin}/#website`,
        url: `${metadataBase.origin}/`,
        name: siteConfig.name,
        description: siteConfig.description,
        inLanguage: "en-PH",
        publisher: { "@id": `${metadataBase.origin}/#business` },
      },
      {
        "@type": "LocalBusiness",
        "@id": `${metadataBase.origin}/#business`,
        name: siteConfig.name,
        alternateName: siteConfig.shortName,
        description: siteConfig.description,
        url: `${metadataBase.origin}/`,
        logo: `${metadataBase.origin}/icon.png`,
        image: `${metadataBase.origin}/opengraph-image`,
        email: siteConfig.email,
        telephone: siteConfig.telephone,
        priceRange: "₱",
        address: {
          "@type": "PostalAddress",
          streetAddress:
            "2nd Floor, Mendiola Square Building, 2138 C.M. Recto Avenue",
          addressLocality: "Manila",
          addressRegion: "Metro Manila",
          postalCode: "1001",
          addressCountry: "PH",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: 14.6004718,
          longitude: 120.987938,
        },
        sameAs: Object.values(siteConfig.social),
      },
    ],
  };

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
      </body>
    </html>
  );
}
