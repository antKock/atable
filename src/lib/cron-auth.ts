import { timingSafeEqual } from 'node:crypto'

/**
 * Garde commune des routes /api/cron/* : vrai si `Authorization: Bearer
 * <CRON_SECRET>` correspond. Sans CRON_SECRET posé (ou vide), TOUJOURS faux —
 * jamais de comparaison à `Bearer undefined`, qui ouvrirait le cron à quiconque
 * envoie littéralement cette chaîne. Comparaison en temps constant (buffers de
 * même longueur seulement : `timingSafeEqual` jette sinon, et la longueur du
 * secret n'est pas un secret).
 */
export function isCronAuthorized(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(authHeader ?? '')
  if (expected.length !== received.length) return false
  return timingSafeEqual(expected, received)
}
