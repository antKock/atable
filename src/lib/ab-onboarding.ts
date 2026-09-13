// A/B test onboarding (backlog #25) : bras A = landing actuelle (démo en
// primaire), bras B = « Commencer » en primaire (carnet en un tap → première
// recette). Affectation par appareil au premier rendu de la landing (proxy),
// cookie 1 an ; persistée sur la personne à la création de l'owner.
//
// Module pur (pas d'import Next) : testable, importable depuis le proxy, les
// routes et les composants serveur.

export const AB_ONBOARDING_COOKIE = "mijote_ab_onboarding";
export const AB_ONBOARDING_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;
/** Bras de la requête courante, injecté par le proxy pour la landing (a | b). */
export const AB_ONBOARDING_HEADER = "x-ab-onboarding";
/** « 1 » quand le proxy vient de tirer le bras (cookie posé sur cette réponse). */
export const AB_ONBOARDING_FRESH_HEADER = "x-ab-onboarding-fresh";

export type OnboardingVariant = "a" | "b";

/**
 * Écran « Ta première recette » (bras B) : recette d'exemple proposée en pied
 * (« Pas de recette sous la main ? Essaie avec celle-ci »), importée par le
 * chemin URL normal. Vérifiées à l'import sur staging le 2026-09-13 (≈ 3-5 s).
 */
export const FIRST_RECIPE_SAMPLE_URL: Record<"fr" | "en", string> = {
  fr: "https://www.marmiton.org/recettes/recette_crepes-faciles_12372.aspx",
  en: "https://www.bbcgoodfood.com/recipes/easy-pancakes",
};

export function isOnboardingVariant(value: unknown): value is OnboardingVariant {
  return value === "a" || value === "b";
}

// Même grammaire que I18N_EN_ENABLED : `1` / `true` = actif, tout le reste éteint.
export function isAbOnboardingEnabled(
  env: { [key: string]: string | undefined } = process.env,
): boolean {
  const v = env.AB_ONBOARDING_ENABLED?.trim().toLowerCase();
  return v === "1" || v === "true";
}

// Robots d'indexation : pas d'affectation (ils gonfleraient le dénominateur).
// Les crawlers sociaux sont déjà court-circuités en amont par le proxy.
const CRAWLER_UA = /bot|crawl|spider|slurp|preview|fetch|monitor|lighthouse|pingdom/i;

export function isCrawlerUa(ua: string): boolean {
  return CRAWLER_UA.test(ua);
}

// Shell natif iOS : UA Capacitor `MijoteNative/…` sur iPhone/iPad (le proxy ne
// connaît pas Capacitor ; voir capacitor.config.ts pour l'UA).
export function isIosNativeUa(ua: string): boolean {
  return ua.includes("MijoteNative") && /iPhone|iPad|iPod/i.test(ua);
}

export type Assignment = {
  variant: OnboardingVariant;
  /** Tirage effectué sur cette requête : poser le cookie, compter l'affectation. */
  fresh: boolean;
};

/**
 * Décision d'affectation pour un rendu de la landing sans session.
 * - flag éteint → A, rien n'est posé ni compté ;
 * - cookie valide → on le respecte (stable par appareil) ;
 * - crawler → A sans cookie ;
 * - sinon tirage 50/50.
 */
export function resolveAssignment(input: {
  enabled: boolean;
  cookie: string | undefined;
  ua: string;
  random?: () => number;
}): Assignment | null {
  if (!input.enabled) return null;
  if (isOnboardingVariant(input.cookie)) return { variant: input.cookie, fresh: false };
  if (isCrawlerUa(input.ua)) return null;
  const draw = (input.random ?? Math.random)();
  return { variant: draw < 0.5 ? "a" : "b", fresh: true };
}

/**
 * Bras à écrire sur un owner créé par cette requête (réel ou démo) : le cookie
 * si le test est actif, sinon null (arrivée hors test).
 */
export function variantForNewOwner(
  cookie: string | undefined,
  enabled: boolean = isAbOnboardingEnabled(),
): OnboardingVariant | null {
  if (!enabled) return null;
  return isOnboardingVariant(cookie) ? cookie : null;
}
