import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { t } from "@/lib/i18n/fr";
import SWRProvider from "@/components/providers/SWRProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const viewport: Viewport = {
  themeColor: "#F8FAF7",
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
      <body className={`${inter.variable} font-sans antialiased`}>
        <SWRProvider>{children}</SWRProvider>
      </body>
    </html>
  );
}
