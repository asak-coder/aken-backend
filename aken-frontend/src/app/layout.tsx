import "./globals.css";
import Script from "next/script";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import AttributionTracker from "@/components/AttributionTracker";
import GA4PageTracker from "@/components/GA4PageTracker";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import RevealOnScroll from "@/components/RevealOnScroll";
import { getEnvWarnings, getPublicGaId, getPublicGoogleAdsId } from "@/lib/env";

const SITE_URL = "https://aken.firm.in";
const SITE_NAME = "A K ENGINEERING";
const DEFAULT_TITLE = "Industrial EPC Contractor in India";
const DEFAULT_DESCRIPTION =
  "A K ENGINEERING delivers Industrial EPC, PEB structures, structural steel fabrication, and erection services across India.";

const GOOGLE_SITE_VERIFICATION = (
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || ""
).trim();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${DEFAULT_TITLE} | ${SITE_NAME}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  keywords: [
    "Industrial EPC contractor",
    "PEB structures",
    "steel fabrication",
    "industrial erection",
    "A K ENGINEERING",
  ],
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: `${DEFAULT_TITLE} | ${SITE_NAME}`,
    description: DEFAULT_DESCRIPTION,
    siteName: SITE_NAME,
    locale: "en_IN",
  },
  twitter: {
    card: "summary",
    title: `${DEFAULT_TITLE} | ${SITE_NAME}`,
    description: DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  verification: GOOGLE_SITE_VERIFICATION
    ? {
        google: GOOGLE_SITE_VERIFICATION,
      }
    : undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const GA_ID = getPublicGaId();
  const ADS_ID = getPublicGoogleAdsId();
  const GTAG_BOOTSTRAP_ID = GA_ID || ADS_ID;
  const envWarnings = getEnvWarnings();
  const isProduction = process.env.NODE_ENV === "production";

  if (envWarnings.length > 0 && !isProduction) {
    for (const warning of envWarnings) {
      console.warn(`[env-warning] ${warning}`);
    }
  }

  return (
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        {GTAG_BOOTSTRAP_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GTAG_BOOTSTRAP_ID}`}
              strategy="afterInteractive"
            />
            <Script id="gtag" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                ${GA_ID ? `
                gtag('config', '${GA_ID}', {
                  send_page_view: false,
                  anonymize_ip: true
                });
                ` : ""}
                ${ADS_ID ? `
                gtag('config', '${ADS_ID}');
                ` : ""}
              `}
            </Script>
          </>
        )}
      </head>
      <body className="min-h-screen antialiased">
        <RevealOnScroll />
        <AttributionTracker />
        <Suspense fallback={null}>
          <GA4PageTracker />
        </Suspense>
        <SiteHeader />
        <div id="app-root">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
