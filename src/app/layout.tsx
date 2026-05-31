import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, DM_Mono } from "next/font/google";
import { t } from "@/lib/i18n/fr";
import SWRProvider from "@/components/providers/SWRProvider";
import VersionWatcher from "@/components/VersionWatcher";
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

export const metadata: Metadata = {
  metadataBase: new URL("https://mijote.anthonykocken.fr"),
  title: t.appName,
  description: "Tes recettes, réunies comme par magie",
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
    description: "Tes recettes, réunies comme par magie",
    siteName: t.appName,
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} ${fraunces.variable} ${dmMono.variable} font-sans antialiased`}>
        <VersionWatcher />
        <SWRProvider>{children}</SWRProvider>
      </body>
    </html>
  );
}
