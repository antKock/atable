import type { SupabaseClient } from '@supabase/supabase-js'
import type { MembershipRole } from '@/lib/auth/owner-context'

export type ResolvedInvite = {
  householdId: string
  householdName: string
  role: MembershipRole
}

/**
 * Résout un code d'invitation (déjà validé au format WORD-NNNN par
 * JoinCodeSchema) contre les DEUX liens stables d'un foyer (Lot 3, #15a,
 * décision n°3 du socle) :
 *   - join_code       → rôle `member` (consulte + modifie) ;
 *   - guest_join_code → rôle `guest`  (lecture seule, en direct).
 * La démo est exclue (is_demo = false), comme lookup/join l'ont toujours fait.
 *
 * Renvoie `null` si aucun foyer ne correspond. Propage une vraie erreur DB
 * (l'appelant décide : 500 côté API, error boundary côté page).
 *
 * Invariant d'unicité globale (cf. migration 030 + génération applicative) : un
 * code ne désigne qu'un seul foyer. Si une collision cross-colonne résiduelle
 * survenait (deux foyers distincts, ~1/500k), on privilégie l'interprétation
 * `member` : on ne fabrique jamais un invité là où le porteur a diffusé un lien
 * membre, et on ne dépend pas de l'ordre de tri PostgREST.
 *
 * Sûreté d'interpolation : `code` ne contient que [A-Z0-9-] (garanti par
 * JoinCodeSchema) → aucune injection possible dans le filtre `.or()`.
 */
export async function resolveInviteCode(
  supabase: SupabaseClient,
  code: string,
): Promise<ResolvedInvite | null> {
  const { data, error } = await supabase
    .from('households')
    .select('id, name, join_code, guest_join_code')
    .or(`join_code.eq.${code},guest_join_code.eq.${code}`)
    .eq('is_demo', false)
    .limit(2)

  if (error) throw error
  if (!data || data.length === 0) return null

  const memberRow = data.find((h) => h.join_code === code)
  const row = memberRow ?? data[0]
  const role: MembershipRole = row.join_code === code ? 'member' : 'guest'

  return { householdId: row.id, householdName: row.name, role }
}
