// Stats App Store (042) : type des lignes app_store_daily et libellés des
// sources Apple (valeurs stockées telles quelles, jamais traduites en base).
// L'assemblage est dans v3/assemble.ts.

export type AppStoreDailyRow = {
  day: string;
  source_type: string;
  source_info: string;
  dl_first_time: number;
  dl_redownload: number;
  dl_update: number;
  eng_impressions: number;
  eng_impressions_uniq: number;
  eng_page_views: number;
  eng_page_views_uniq: number;
  eng_taps: number;
};

/** Libellés des sources Apple (valeurs stockées telles quelles, jamais traduites en base). */
const SOURCE_LABELS: Record<string, string> = {
  "App Store search": "Recherche App Store",
  "App Store browse": "Navigation App Store",
  "App referrer": "Depuis une app",
  "Web referrer": "Depuis le web",
  "Institutional purchase": "Achat institutionnel",
  Unavailable: "Indéterminé",
};

/** Referrers connus (bundle id / domaine → nom lisible). */
const REFERRER_LABELS: Record<string, string> = {
  "com.openai.chat": "ChatGPT",
  "com.apple.mobilesafari": "Safari",
  "com.google.chrome.ios": "Chrome",
  "com.apple.MobileSMS": "Messages",
  "com.burbn.instagram": "Instagram",
  "com.facebook.Messenger": "Messenger",
  "net.whatsapp.WhatsApp": "WhatsApp",
};

export function sourceLabel(sourceType: string, sourceInfo: string): string {
  const base = SOURCE_LABELS[sourceType] ?? sourceType;
  if (!sourceInfo) return base;
  const ref = REFERRER_LABELS[sourceInfo] ?? sourceInfo;
  return `${base} · ${ref}`;
}
