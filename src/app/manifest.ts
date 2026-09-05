import type { MetadataRoute } from "next";
import { getT } from "@/lib/i18n/server";

// Manifest PWA servi dans la langue de l'appareil (chantier Version EN,
// Lot 3) — remplace public/manifest.json (statique, FR). Le layout racine
// pointe sur /manifest.webmanifest.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getT();
  return {
    name: t.appName,
    short_name: t.appName,
    description: `${t.landing.tagline}, ${t.landing.subtitle.toLowerCase()}`,
    start_url: "/home",
    display: "standalone",
    theme_color: "#F5F1E8",
    background_color: "#F5F1E8",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
