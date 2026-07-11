import { describe, it, expect } from 'vitest'
import { resolveInviteCode } from './invite-code'
import { createSupabaseMock } from '@/test/supabase-mock'

// resolveInviteCode résout un code contre join_code (→ membre) OU
// guest_join_code (→ invité), la démo exclue. Voir la migration 030 pour
// l'invariant d'unicité globale des deux liens.

describe('resolveInviteCode', () => {
  it('résout un join_code en rôle membre', async () => {
    const supa = createSupabaseMock()
    supa.queueResult({
      data: [{ id: 'h1', name: 'Famille', join_code: 'OLIVE-4821', guest_join_code: 'THYME-0001' }],
      error: null,
    })
    const invite = await resolveInviteCode(supa.client, 'OLIVE-4821')
    expect(invite).toEqual({ householdId: 'h1', householdName: 'Famille', role: 'member' })
  })

  it('résout un guest_join_code en rôle invité', async () => {
    const supa = createSupabaseMock()
    supa.queueResult({
      data: [{ id: 'h1', name: 'Famille', join_code: 'OLIVE-4821', guest_join_code: 'THYME-0001' }],
      error: null,
    })
    const invite = await resolveInviteCode(supa.client, 'THYME-0001')
    expect(invite).toEqual({ householdId: 'h1', householdName: 'Famille', role: 'guest' })
  })

  it('renvoie null quand aucun foyer ne correspond (tableau vide)', async () => {
    const supa = createSupabaseMock()
    supa.queueResult({ data: [], error: null })
    expect(await resolveInviteCode(supa.client, 'OLIVE-4821')).toBeNull()
  })

  it('privilégie l’interprétation membre en cas de collision cross-foyer', async () => {
    const supa = createSupabaseMock()
    // Deux foyers distincts : h1 porte CODE en guest, h2 le porte en join_code.
    supa.queueResult({
      data: [
        { id: 'h1', name: 'A', join_code: 'AAAA-1111', guest_join_code: 'CODE-9999' },
        { id: 'h2', name: 'B', join_code: 'CODE-9999', guest_join_code: 'BBBB-2222' },
      ],
      error: null,
    })
    const invite = await resolveInviteCode(supa.client, 'CODE-9999')
    expect(invite).toEqual({ householdId: 'h2', householdName: 'B', role: 'member' })
  })

  it('propage une vraie erreur DB (jamais confondue avec « introuvable »)', async () => {
    const supa = createSupabaseMock()
    supa.queueResult({ data: null, error: { message: 'boom' } })
    await expect(resolveInviteCode(supa.client, 'OLIVE-4821')).rejects.toBeTruthy()
  })
})
