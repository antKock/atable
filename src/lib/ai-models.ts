// ---------------------------------------------------------------------------
// Single source of truth for the OpenAI models used by the product. Change a
// model here (and its price in ai-cost.ts TOKEN_PRICING) to roll it out
// everywhere at once. scripts/recheck-diet-tags.mjs duplicates the text model
// (plain .mjs, can't import TS) — keep it in sync manually.
// ---------------------------------------------------------------------------

// Choix issus du banc d'essai 2026-09-02 (scripts/bench/, résultats dans le
// message de commit) : gpt-5.6-luna bat gpt-4o-mini 9 cas sur 9 en structuration
// et enrichissement ; gpt-4o-mini-transcribe divise le WER par 3 vs whisper-1 à
// moitié prix ; gpt-4o reste le meilleur rapport qualité/coût en OCR (la gamme
// 5.6 compte ~4× plus de tokens image, Terra ≈ même qualité pour 2,5× le prix).
export const AI_MODELS = {
  /** Structuration texte → JSON : imports URL/Instagram/vocal, enrichissement, image prompt. */
  text: "gpt-5.6-luna",
  /** OCR vision : import par photo / capture d'écran. */
  vision: "gpt-4o",
  /** Transcription audio : import vocal. */
  transcription: "gpt-4o-mini-transcribe",
  /** Génération d'image de plat. */
  image: "gpt-image-1.5",
} as const;

// Les gpt-5.x raisonnent par défaut et facturent ces tokens en sortie ; pour de
// l'extraction JSON on force l'effort le plus bas (0 token de raisonnement
// mesuré au bench). À spreader dans tout appel chat.completions du modèle
// texte. Vaut {} pour un modèle non-raisonneur.
// ⚠ Gamme instable côté OpenAI : le 2026-09-02, Luna acceptait « minimal » le
// matin puis a basculé sur la gamme none/low/…/xhigh dans la journée (Sentry
// 6df59580 en prod). D'où la valeur « none » ET le fallback ci-dessous.
export const TEXT_MODEL_EXTRA_PARAMS: { reasoning_effort?: "none" } =
  AI_MODELS.text.startsWith("gpt-5") ? { reasoning_effort: "none" } : {};

function isUnsupportedEffortError(err: unknown): boolean {
  return (
    (err as { status?: number })?.status === 400 &&
    String((err as Error)?.message ?? "").includes("reasoning_effort")
  );
}

/**
 * Exécute un appel chat du modèle texte en lui passant TEXT_MODEL_EXTRA_PARAMS ;
 * si l'API rejette la valeur de reasoning_effort (OpenAI a déjà renommé la gamme
 * en cours de journée), retente une fois SANS le paramètre : l'appel garde
 * l'effort par défaut du modèle — plus lent et un peu plus cher, mais il aboutit
 * au lieu de faire échouer un import ou un enrichissement utilisateur.
 */
export async function withEffortFallback<T>(
  call: (extra: typeof TEXT_MODEL_EXTRA_PARAMS) => Promise<T>,
): Promise<T> {
  try {
    return await call(TEXT_MODEL_EXTRA_PARAMS);
  } catch (err) {
    if (Object.keys(TEXT_MODEL_EXTRA_PARAMS).length > 0 && isUnsupportedEffortError(err)) {
      console.warn("[ai-models] reasoning_effort rejeté par l'API — retry sans le paramètre");
      return call({});
    }
    throw err;
  }
}
