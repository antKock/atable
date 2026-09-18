// ---------------------------------------------------------------------------
// Lecture directe d'une publication Instagram publique (chantier « Instagram
// sans Apify », 2026-09-18). Deux pages publiques, sans connexion :
//   1. /p/{code}/embed/captioned/ — légende complète dans `.Caption` (<br> conservés) ;
//   2. /reel/{code}/              — légende complète dans `og:description`, précédée
//      de « N likes, N comments - compte on date: "… ».
// Aucun appel payant ici : import.ts enchaîne lecture directe → Apify en secours,
// et met la légende en cache court (lecture partagée entre tous les imports du
// même reel — contenu public, sans lien avec la personne qui importe).
//
// Module pur côté lecture (`extract*` testables sur des fixtures HTML) ; le
// réseau passe par `fetch` global, les hôtes sont fixés (jamais l'URL fournie),
// donc pas de garde SSRF à rejouer.
// ---------------------------------------------------------------------------

const IG_ORIGIN = "https://www.instagram.com";

// Safari iPhone : la page embed et la page du reel répondent 200 avec la légende
// complète (vérifié le 2026-09-18 depuis le Mac et le VPS).
const IG_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
  Accept: "text/html,application/xhtml+xml",
};

/** Délai par page : deux lectures au pire (≈ 10 s), le budget d'import URL est de 55 s. */
export const IG_PAGE_TIMEOUT_MS = 5_000;

/**
 * En dessous, la « légende » lue n'est pas crédible (mur de connexion, page
 * tronquée) : on tente la voie suivante, en gardant ce texte comme dernier recours.
 */
export const MIN_CAPTION_LENGTH = 20;

const INSTAGRAM_HOST = /(?:^|\.)(instagram\.com|instagr\.am)$/i;
const SHORTCODE = /^[A-Za-z0-9_-]{5,40}$/;
// Segments qui précèdent l'identifiant d'une publication, avec ou sans compte
// devant (`/marmiton_org/reel/{code}/`).
const POST_SEGMENTS = new Set(["p", "reel", "reels", "tv"]);

export function isInstagramUrl(url: string): boolean {
  try {
    return INSTAGRAM_HOST.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export type InstagramTarget =
  | { kind: "post"; code: string }
  // Lien de partage court (`/share/reel/{jeton}/`) : redirige vers la publication.
  | { kind: "share"; path: string }
  | null;

/**
 * Identifiant de la publication à partir d'une URL partagée : `/p/`, `/reel/`,
 * `/reels/`, `/tv/`, `/{compte}/reel/`, paramètres (`igsh`, `utm_*`) ignorés.
 * `null` pour tout le reste (profil, story…) : la lecture directe ne s'y essaie pas.
 */
export function parseInstagramUrl(url: string): InstagramTarget {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!INSTAGRAM_HOST.test(u.hostname)) return null;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts[0] === "share" && parts.length >= 2) {
    return { kind: "share", path: `/${parts.join("/")}/` };
  }
  const i = parts.findIndex((p) => POST_SEGMENTS.has(p));
  // Le segment est en tête, ou juste après le nom du compte.
  if (i < 0 || i > 1) return null;
  const code = parts[i + 1];
  return code && SHORTCODE.test(code) ? { kind: "post", code } : null;
}

// ---------- extraction (pure) ----------

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return NAMED_ENTITIES[e.toLowerCase()] ?? m;
  });
}

function tidy(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Légende de la page embed (`<div class="Caption">`), retours à la ligne conservés. */
export function extractEmbedCaption(html: string): string | null {
  const start = html.indexOf('<div class="Caption">');
  if (start < 0) return null;
  let end = html.indexOf('<div class="CaptionComments"', start);
  if (end < 0) end = html.indexOf("</div>", start);
  if (end < 0) return null;
  const text = html
    .slice(start, end)
    // Le nom du compte ouvre la légende : ce n'est pas du contenu.
    .replace(/<a class="CaptionUsername"[\s\S]*?<\/a>/, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  const caption = tidy(decodeEntities(text));
  return caption || null;
}

function metaContent(html: string, property: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    if (!new RegExp(`(?:property|name)="${property}"`, "i").test(tag)) continue;
    const m = tag.match(/content="([^"]*)"/i);
    if (m) return m[1];
  }
  return null;
}

/**
 * Légende de la page du reel, depuis `og:description` : « 1,433 likes,
 * 6 comments - marmiton_org on November 9, 2024: "…". » → le texte entre
 * guillemets. Sans ce motif (page générique, mur de connexion), `null`.
 */
export function extractOgCaption(html: string): string | null {
  const raw = metaContent(html, "og:description");
  if (!raw) return null;
  const decoded = decodeEntities(raw);
  const m = decoded.match(/^[^"\n]{0,300}?:\s*"([\s\S]*)"\s*\.?\s*$/);
  if (!m) return null;
  const caption = tidy(m[1]);
  return caption || null;
}

// ---------- lecture réseau ----------

/** Raison courte (enum, jamais de contenu) de l'abandon d'une voie — pour le journal. */
export type DirectFailure =
  | "timeout"
  | "network"
  | "login_wall"
  | `http_${number}`
  | "no_caption"
  | "too_short"
  | "unsupported_url";

export type DirectPage = "embed" | "og";

export type DirectResult = {
  /** Raison d'abandon par page tentée (`embed` puis `og`) ; vide si la première a suffi. */
  reasons: Partial<Record<DirectPage, DirectFailure>>;
} & (
  | { ok: true; caption: string; page: DirectPage }
  | {
      ok: false;
      /** Légende lue mais trop courte : dernier recours si le secours échoue aussi. */
      short?: { caption: string; page: DirectPage };
    }
);

/** Raisons d'abandon dans l'ordre des pages (`no_caption/login_wall`) — enum, jamais de contenu. */
export function directFailureLabel(reasons: DirectResult["reasons"]): string | undefined {
  return [reasons.embed, reasons.og].filter(Boolean).join("/") || undefined;
}

async function fetchPage(
  path: string,
): Promise<{ ok: true; html: string } | { ok: false; reason: DirectFailure }> {
  try {
    const res = await fetch(`${IG_ORIGIN}${path}`, {
      headers: IG_HEADERS,
      redirect: "manual",
      signal: AbortSignal.timeout(IG_PAGE_TIMEOUT_MS),
    });
    // Instagram renvoie vers /accounts/login quand il refuse la lecture anonyme.
    if (res.status >= 300 && res.status < 400) return { ok: false, reason: "login_wall" };
    if (res.status !== 200) return { ok: false, reason: `http_${res.status}` };
    return { ok: true, html: await res.text() };
  } catch (err) {
    const name = (err as { name?: string } | null)?.name;
    return {
      ok: false,
      reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "network",
    };
  }
}

/**
 * Lien de partage court → identifiant de la publication, en lisant la
 * redirection (sans la suivre). `null` si Instagram ne redirige pas vers une
 * publication (mur de connexion…).
 */
export async function resolveShareLink(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${IG_ORIGIN}${path}`, {
      headers: IG_HEADERS,
      redirect: "manual",
      signal: AbortSignal.timeout(IG_PAGE_TIMEOUT_MS),
    });
    const location = res.headers.get("location");
    if (!location) return null;
    const target = parseInstagramUrl(new URL(location, IG_ORIGIN).toString());
    return target?.kind === "post" ? target.code : null;
  } catch {
    return null;
  }
}

/** Page embed d'abord, page du reel (`og:description`) ensuite. Ne lève jamais. */
export async function readInstagramDirect(code: string): Promise<DirectResult> {
  const reasons: Partial<Record<DirectPage, DirectFailure>> = {};
  let short: { caption: string; page: DirectPage } | undefined;
  const pages: Array<[DirectPage, string, (html: string) => string | null]> = [
    ["embed", `/p/${code}/embed/captioned/`, extractEmbedCaption],
    ["og", `/reel/${code}/`, extractOgCaption],
  ];
  for (const [page, path, extract] of pages) {
    const fetched = await fetchPage(path);
    if (!fetched.ok) {
      reasons[page] = fetched.reason;
      continue;
    }
    const caption = extract(fetched.html);
    if (!caption) {
      reasons[page] = "no_caption";
      continue;
    }
    if (caption.length < MIN_CAPTION_LENGTH) {
      reasons[page] = "too_short";
      short ??= { caption, page };
      continue;
    }
    return { ok: true, caption, page, reasons };
  }
  return { ok: false, reasons, short };
}
