// Préférence « foyers affichés sur l'accueil » (multi-foyer). Stockée en cookie
// (device-scoped, comme les dismiss de hints) : on mémorise les foyers À MASQUER
// — l'absence = tout afficher, et un nouveau foyer rejoint apparaît par défaut.
export const HOME_HIDDEN_FOYERS_COOKIE = 'mijote_home_hidden_foyers'

// 1 an — préférence durable, non sensible.
export const HOME_HIDDEN_FOYERS_MAX_AGE = 60 * 60 * 24 * 365

export function parseHiddenFoyers(value: string | undefined | null): string[] {
  return (value ?? '').split(',').map((s) => s.trim()).filter(Boolean)
}
