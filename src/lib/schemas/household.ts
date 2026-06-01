import { z } from 'zod'

export const HouseholdCreateSchema = z.string().min(1).max(50)

// Join codes display as WORD-NNNN but are entered forgivingly: any case, with
// or without the dash, with stray spaces. Normalize to the canonical form
// (UPPERCASE, single dash before the 4 digits) before validating — so the dash
// never has to be typed on a mobile keyboard. Anything that doesn't reduce to
// WORD + 4 digits stays as-is and fails the regex (still rejected).
function normalizeJoinCode(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const match = cleaned.match(/^([A-Z]+)(\d{4})$/)
  return match ? `${match[1]}-${match[2]}` : cleaned
}

export const JoinCodeSchema = z.preprocess(
  normalizeJoinCode,
  z.string().regex(/^[A-Z]+-\d{4}$/),
)
