// Sondes (backlog #26) : appareils d'Anthony et agents (curl, Playwright) qui
// testent la prod. Marquées explicitement, jamais comptées dans les stats.
//
//   - cookie `mijote_probe=1` (1 an), posé par le proxy quand la landing est
//     appelée avec `?probe=1` (une fois par appareil) ;
//   - en-tête `x-mijote-probe: 1`, équivalent pour les scripts ;
//   - le proxy traduit les deux en `x-probe: 1` sur la requête interne : tout le
//     code serveur lit CET en-tête et rien d'autre.
//
// Effets : pas d'affectation A/B comptée, pas de compteur stats_daily, owner et
// foyer créés marqués `is_probe`, pas de ping d'activité ni de vue de recette.
// Module pur (pas d'import Next) : utilisable depuis le proxy et les tests.

export const PROBE_COOKIE = "mijote_probe";
export const PROBE_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;
/** En-tête posé par les scripts et agents (équivaut au cookie). */
export const PROBE_REQUEST_HEADER = "x-mijote-probe";
/** En-tête interne injecté par le proxy ; seul lu par le code serveur. */
export const PROBE_INTERNAL_HEADER = "x-probe";
/** Paramètre de la landing qui pose le cookie. */
export const PROBE_QUERY_PARAM = "probe";

/** Décision du proxy : la requête vient-elle d'une sonde ? */
export function detectProbe(input: {
  cookie: string | undefined;
  header: string | null;
  /** `?probe=1` sur la landing. */
  queryParam: string | null;
}): { probe: boolean; setCookie: boolean } {
  const fromParam = input.queryParam === "1";
  const probe = fromParam || input.cookie === "1" || input.header === "1";
  return { probe, setCookie: fromParam && input.cookie !== "1" };
}

/** Lecture côté serveur (routes, composants) : uniquement l'en-tête interne. */
export function isProbeHeaders(headers: Headers): boolean {
  return headers.get(PROBE_INTERNAL_HEADER) === "1";
}
