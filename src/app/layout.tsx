import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import Navigation from "@/components/layout/Navigation";
import DeviceTokenProvider from "@/components/layout/DeviceTokenProvider";
import { t } from "@/lib/i18n/fr";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: t.appName,
  description: "Votre bibliothèque de recettes personnelle",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} font-sans antialiased`}>
        <DeviceTokenProvider />
        <div className="lg:pl-56">
          <main className="min-h-screen pb-20 lg:pb-0">{children}</main>
        </div>
        <Navigation />
        <Toaster />
      </body>
    </html>
  );
}
