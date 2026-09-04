import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, DM_Mono } from "next/font/google";
import { getLocale, getT } from "@/lib/i18n/server";
import { LOCALE_TAGS, readI18nFlags } from "@/lib/i18n/locale";
import { LocalePreviewSwitch, LocaleProvider } from "@/lib/i18n/client";
import SWRProvider from "@/components/providers/SWRProvider";
import VersionWatcher from "@/components/VersionWatcher";
import DeepLinkHandler from "@/components/DeepLinkHandler";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-dm-mono",
  weight: ["500"],
});

export const viewport: Viewport = {
  themeColor: "#F5F1E8", /* DS_UPDATE 2026-05-23: was #F8FAF7 — keep in sync with --background */
  // Required for env(safe-area-inset-*) to resolve to non-zero values on
  // notched iPhones — without it the WebView ignores all safe-area padding.
  viewportFit: "cover",
};

// Locale-aware (chantier « Version EN ») : lit Accept-Language / cookie de
// prévisualisation via getLocale() — voir docs/specs/i18n/00-socle.md.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getT();
  const description = t.landing.tagline + ", " + t.landing.subtitle.toLowerCase();
  return {
    metadataBase: new URL("https://mijote.anthonykocken.fr"),
    title: t.appName,
    description,
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "Mijote",
    },
    icons: {
      icon: "/icons/icon-192.png",
      shortcut: "/icons/icon-192.png",
      apple: "/icons/icon-192.png",
    },
    openGraph: {
      title: t.appName,
      description,
      siteName: t.appName,
      locale: LOCALE_TAGS[locale].replace("-", "_"),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const { previewEnabled } = readI18nFlags();
  return (
    <html lang={locale}>
      <body className={`${inter.variable} ${fraunces.variable} ${dmMono.variable} font-sans antialiased`}>
        <LocaleProvider locale={locale}>
          {previewEnabled && <LocalePreviewSwitch />}
          <VersionWatcher />
          <DeepLinkHandler />
          <SWRProvider>{children}</SWRProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
