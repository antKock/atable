import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { t } from "@/lib/i18n/fr";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://atable.anthonykocken.fr"),
  title: t.appName,
  description: "Votre bibliothèque de recettes personnelle",
  manifest: "/manifest.json",
  themeColor: "#F8FAF7",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "À Table",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    title: t.appName,
    description: "Votre bibliothèque de recettes personnelle",
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
        {children}
      </body>
    </html>
  );
}
