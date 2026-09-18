// Catalogue des événements produit (backlog #28, docs/specs/events/00-socle.md).
//
// Source unique, importée par le client (émission) et le serveur (allow-list de
// POST /api/events). Trois flux automatiques + trois explicites : toute
// tentation d'ajouter un nom doit d'abord répondre « un flux A/B/C ne le voit-il
// vraiment pas ? ». Le SENS (« un import a commencé ») n'est pas ici mais dans
// les vues SQL de la migration 052 — définies a posteriori sur ces faits bruts.
//
// Module pur (pas d'import Next) : utilisable depuis le client, le proxy, les tests.

export const EVENT_NAMES = [
  // Flux A — écrans (client, automatique). `route` = motif Next (`/recipes/[id]`),
  // jamais le chemin concret : les identifiants vont dans `params`.
  "screen.viewed",
  "screen.left",
  // Flux B — clics (client, automatique) sur button / a / [role=button].
  // `target` = data-track le plus proche, ou trace de secours `?tag#id`.
  "ui.clicked",
  // Flux C — appels API (serveur, automatique) : withOwnerAuth + routes publiques.
  "api.called",
  // Explicites — ce qu'aucun flux ne voit. (`recipe.cooking_started` retiré le
  // 2026-09-16 : le wake lock s'obtient à chaque ouverture de fiche, il doublait
  // screen.viewed ; « on cuisine » = durée de la fiche, vue v_cooking.)
  "ui.seen", // impression, opt-in `data-seen` (hints, CTA)
  "error.shown", // erreur affichée sans appel API derrière
  "app.opened",
  "app.resumed",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

export function isEventName(value: unknown): value is EventName {
  return typeof value === "string" && (EVENT_NAMES as readonly string[]).includes(value);
}

/** Identifiants uniquement (uuid, token, enum) — jamais de contenu. */
export type RouteParams = Record<string, string>;

/**
 * Origine d'entrée (première vue d'écran d'un chargement) : d'où vient la
 * personne, pour ce que le navigateur en dit. Le referrer est VIDE depuis les
 * navigateurs intégrés (Messenger, Instagram, WhatsApp…) et le shell natif ;
 * c'est la signature du User-Agent (`in_app`) et les UTM que TU poses dans
 * tes liens qui font foi. Hôtes et enums seulement, jamais l'URL complète.
 */
export type EntryInfo = {
  referrer_host?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  /** Navigateur intégré : instagram | facebook | messenger | whatsapp | tiktok | linkedin | x | snapchat | share-extension (iOS, `?ext=1`) */
  in_app?: string;
  /** Un identifiant de clic publicitaire est présent : fbclid | gclid | ttclid | msclkid (jamais sa valeur). */
  click_id?: string;
};

export type EventProps = {
  "screen.viewed": { route: string; params?: RouteParams; entry?: EntryInfo };
  "screen.left": { route: string; params?: RouteParams; duration_ms: number };
  "ui.clicked": { target: string; route: string; params?: RouteParams };
  "api.called": {
    route: string;
    method: string;
    status: number;
    duration_ms: number;
    /** `code` du corps JSON en erreur (INVALID_DATA, RATE_LIMIT, SITE_BLOCKED…). */
    error_code?: string;
    recipe_id?: string;
    household_id?: string;
    /** Méthode d'import (url / photo / voice) ou `source` d'une recette créée. */
    method_kind?: string;
    /** Import par URL : hôte du site importé (`marmiton.fr`) — pour savoir OÙ ça échoue. */
    site?: string;
    /** Import photo réussi : nature des images selon gpt-4o (screenshot | printed_photo | handwritten | other). */
    image_kind?: string;
  };
  "ui.seen": { target: string; route: string; params?: RouteParams };
  "error.shown": { kind: string; route: string };
  "app.opened": Record<string, never>;
  "app.resumed": Record<string, never>;
};

/** Valeur `data-track` qui désactive le flux clics sur un élément (et ses enfants). */
export const DATA_TRACK_NONE = "none";

/**
 * Identifiants `data-track` posables (§6.5 de la spec). Convention
 * `domaine.cible`, stables : on renomme un libellé, jamais un identifiant —
 * les vues SQL et les requêtes s'y réfèrent. Le test catalog.test.ts vérifie
 * que tout `data-track="…"` du code est ici, et que tout identifiant référencé
 * par une vue est encore posé dans le code.
 *
 * Les suffixes dynamiques (`home.carousel.<id>`, `library.filter.<kind>`,
 * `hint.<name>.act`) sont déclarés par leur préfixe (`*`), les valeurs étant des
 * enums existants — jamais du texte libre.
 */
export const DATA_TRACK_IDS = [
  // Navigation et états génériques
  "nav.home",
  "nav.new",
  "nav.library",
  "nav.household",
  "nav.back", // BackButton sans identifiant dédié
  "state.cta", // CenteredState sans identifiant dédié
  "dialog.close",
  "error.retry",
  "error.home",
  // Landing / onboarding
  "landing.start",
  "landing.demo",
  "landing.join",
  "landing.recover",
  "landing.recover_submit",
  "recover.resend",
  "recover.home",
  "join.confirm", // écran d'invitation : « rejoindre »
  "join.home",
  "household.join_code",
  "household.join_submit",
  "household.join_cancel",
  "household.create_submit",
  "household.create_cancel",
  // Import (/recipes/new) — conteneur par méthode, actions internes nommées
  "import.url",
  "import.photo",
  "import.voice",
  "import.manual",
  "import.submit",
  "import.sample", // « essaie celle-ci » (première recette, URL d'exemple)
  "import.back",
  "import.photo_add",
  "import.photo_remove_file",
  "import.photo_camera", // dialogue source (portail Radix)
  "import.photo_gallery",
  "import.photo_cancel",
  "import.voice_start",
  // Formulaire recette
  "recipe.save",
  "recipe.add_photo", // conteneur PhotoManager (l'ajout hérite)
  "recipe.photo_replace",
  "recipe.photo_remove",
  "recipe.photo_regenerate",
  "recipe.add_tag", // conteneur TagInput
  "recipe.remove_tag",
  "recipe.form_servings",
  "recipe.form_chip", // saison / coût / complexité
  // Vue recette
  "recipe.open", // carte (bibliothèque : library.open ; carrousels : home.carousel.<key>)
  "recipe.edit",
  "recipe.delete",
  "recipe.delete_cancel",
  "recipe.delete_confirm",
  "recipe.share",
  "recipe.move",
  "recipe.move_pick",
  "recipe.back",
  // Accueil / bibliothèque
  "home.carousel.*",
  "library.open",
  "library.search",
  "library.search_clear",
  "library.filter.*", // pilule ET panneau (portail) — les options héritent
  "library.empty_cta",
  // Foyer
  "household.open",
  "household.profile",
  "household.invite",
  "household.invite_link", // copie du lien d'invitation
  "household.invite_code", // copie du code
  "household.member",
  "household.member_role",
  "household.member_remove",
  "household.rename",
  "household.rename_save",
  "household.rename_cancel",
  "household.home_foyers",
  "household.home_foyer_toggle",
  "household.home_foyers_done",
  "household.switch_screen",
  "household.switch", // « créer un autre carnet »
  "household.leave",
  "household.leave_cancel",
  "household.leave_confirm",
  "household.delete",
  "household.logout",
  "household.logout_confirm",
  "household.logout_cancel",
  "household.email_add", // enregistrement du profil (nom + e-mail de secours)
  "household.email_resend",
  // Hints (+ data-seen sur le conteneur : impression `ui.seen`)
  "hint.*",
  "hint.*.act",
  "hint.*.dismiss",
  "hint.install_code.store",
  // Partage public /r/[token]
  "share.copy_to_mine",
  "share.go_home",
  // Pages publiques : tout lien hérite du conteneur
  "support.links",
  "legal.links",
] as const;

/** Un identifiant posé correspond-il au catalogue (préfixes `*` compris) ? */
export function isKnownDataTrack(id: string): boolean {
  for (const known of DATA_TRACK_IDS) {
    if (!known.includes("*")) {
      if (known === id) return true;
      continue;
    }
    const re = new RegExp("^" + known.split("*").map(escapeRe).join("[a-z0-9_-]+") + "$");
    if (re.test(id)) return true;
  }
  return false;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Bornes de validation de POST /api/events (§7.2). */
export const EVENTS_BATCH_MAX = 50;
export const EVENT_PROPS_MAX_BYTES = 1024;
export const EVENT_STRING_MAX = 200;
/** Écart toléré entre l'horloge du client et le serveur avant repli sur received_at. */
export const EVENT_CLOCK_SKEW_MS = 10 * 60 * 1000;

/** Cookie appareil anonyme posé par le proxy ; en-tête interne relu par le serveur. */
export const ANON_COOKIE = "mijote_aid";
export const ANON_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;
export const ANON_INTERNAL_HEADER = "x-anon-id";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Motif d'une route API depuis son chemin concret : les segments uuid
 * deviennent `[id]` (toutes les routes dynamiques de l'API sont des uuid).
 * Côté écrans, le client reconstruit le motif depuis `useParams()`.
 */
export function apiRoutePattern(pathname: string): string {
  return pathname
    .split("/")
    .map((seg) => (UUID_RE.test(seg) ? "[id]" : seg))
    .join("/");
}
