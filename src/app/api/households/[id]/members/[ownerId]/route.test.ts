import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { PATCH, DELETE } from './route'
import { createServerClient } from '@/lib/supabase/server'
import { getOwnerContext } from '@/lib/auth/owner-context'
import { createSupabaseMock, type SupabaseMock } from '@/test/supabase-mock'

vi.mock('@/lib/supabase/server')
vi.mock('next/headers', () => ({ headers: vi.fn() }))
vi.mock('@/lib/auth/owner-context', async () => {
  const { ownerContextFromTestHeaders } = await import('@/test/owner-context-mock')
  return { getOwnerContext: vi.fn(ownerContextFromTestHeaders) }
})

const mockHeaders = headers as unknown as Mock

let supa: SupabaseMock

beforeEach(() => {
  supa = createSupabaseMock()
  vi.mocked(createServerClient).mockReturnValue(supa.client)
  // Viewer = membre de household-1 (owner-test), via headers mockés.
  mockHeaders.mockResolvedValue(
    new Headers({ 'x-household-id': 'household-1', 'x-session-id': 'session-1' }),
  )
})

// Contexte de route : /households/[id]/members/[ownerId]
const ctx = (ownerId = 'owner-2', id = 'household-1') => ({
  params: Promise.resolve({ id, ownerId }),
})

function patchReq(role: string): NextRequest {
  return new NextRequest('https://test.local/api/households/household-1/members/owner-2', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role }),
  })
}
function deleteReq(): NextRequest {
  return new NextRequest('https://test.local/api/households/household-1/members/owner-2', {
    method: 'DELETE',
  })
}

function asGuestViewer() {
  vi.mocked(getOwnerContext).mockResolvedValueOnce({
    ownerId: 'owner-test',
    ownerName: null,
    ownerAlias: null,
    recoveryEmail: null,
    sessionId: 'session-1',
    memberships: [{ householdId: 'household-1', role: 'guest', isDemo: false }],
  })
}
function asDemoViewer() {
  vi.mocked(getOwnerContext).mockResolvedValueOnce({
    ownerId: 'owner-test',
    ownerName: null,
    ownerAlias: null,
    recoveryEmail: null,
    sessionId: 'session-1',
    memberships: [{ householdId: 'household-1', role: 'member', isDemo: true }],
  })
}

describe('PATCH /api/households/[id]/members/[ownerId]', () => {
  it('passe un membre en invité quand il reste d’autres membres', async () => {
    supa.queueResults([
      { data: { id: 'm2', role: 'member' }, error: null }, // SELECT target
      { count: 2, error: null }, // countMembers
      { error: null }, // UPDATE
    ])
    const res = await PATCH(patchReq('guest'), ctx())
    expect(res.status).toBe(200)
    expect(
      supa.calls.some(
        (c) => c.table === 'memberships' && c.ops.some((o) => o.method === 'update'),
      ),
    ).toBe(true)
  })

  it('refuse de rétrograder le DERNIER membre (409, pas d’update)', async () => {
    supa.queueResults([
      { data: { id: 'm2', role: 'member' }, error: null },
      { count: 1, error: null },
    ])
    const res = await PATCH(patchReq('guest'), ctx())
    expect(res.status).toBe(409)
    expect(
      supa.calls.some(
        (c) => c.table === 'memberships' && c.ops.some((o) => o.method === 'update'),
      ),
    ).toBe(false)
  })

  it('refuse une action sur soi-même hors dernier membre (403)', async () => {
    supa.queueResults([
      { data: { id: 'm-self', role: 'member' }, error: null },
      { count: 2, error: null },
    ])
    const res = await PATCH(patchReq('guest'), ctx('owner-test'))
    expect(res.status).toBe(403)
  })

  it('se rétrograder en tant que DERNIER membre → 409 (pas 403)', async () => {
    supa.queueResults([
      { data: { id: 'm-self', role: 'member' }, error: null },
      { count: 1, error: null },
    ])
    const res = await PATCH(patchReq('guest'), ctx('owner-test'))
    expect(res.status).toBe(409)
  })

  it('refuse un viewer invité (403, requireMember)', async () => {
    asGuestViewer()
    const res = await PATCH(patchReq('guest'), ctx())
    expect(res.status).toBe(403)
    expect(supa.calls).toHaveLength(0)
  })

  it('refuse en démo (403, garde central)', async () => {
    asDemoViewer()
    const res = await PATCH(patchReq('guest'), ctx())
    expect(res.status).toBe(403)
    expect(supa.calls).toHaveLength(0)
  })

  it('404 si la cible n’est pas membre du foyer', async () => {
    supa.queueResult({ data: null, error: null })
    const res = await PATCH(patchReq('guest'), ctx())
    expect(res.status).toBe(404)
  })

  it('rejette un rôle invalide (400)', async () => {
    const res = await PATCH(patchReq('admin'), ctx())
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/households/[id]/members/[ownerId]', () => {
  it('retire un invité (200, pas de garde dernier membre)', async () => {
    supa.queueResults([
      { data: { id: 'm2', role: 'guest' }, error: null }, // SELECT target
      { error: null }, // DELETE
    ])
    const res = await DELETE(deleteReq(), ctx())
    expect(res.status).toBe(200)
    expect(
      supa.calls.some(
        (c) => c.table === 'memberships' && c.ops.some((o) => o.method === 'delete'),
      ),
    ).toBe(true)
  })

  it('retire un membre quand d’autres membres restent (200)', async () => {
    supa.queueResults([
      { data: { id: 'm2', role: 'member' }, error: null },
      { count: 3, error: null },
      { error: null },
    ])
    const res = await DELETE(deleteReq(), ctx())
    expect(res.status).toBe(200)
  })

  it('refuse de retirer le DERNIER membre (409)', async () => {
    supa.queueResults([
      { data: { id: 'm2', role: 'member' }, error: null },
      { count: 1, error: null },
    ])
    const res = await DELETE(deleteReq(), ctx())
    expect(res.status).toBe(409)
    expect(
      supa.calls.some(
        (c) => c.table === 'memberships' && c.ops.some((o) => o.method === 'delete'),
      ),
    ).toBe(false)
  })

  it('refuse de se retirer soi-même hors dernier membre (403 — « Quitter »)', async () => {
    supa.queueResults([
      { data: { id: 'm-self', role: 'member' }, error: null },
      { count: 2, error: null },
    ])
    const res = await DELETE(deleteReq(), ctx('owner-test'))
    expect(res.status).toBe(403)
  })

  it('se retirer en tant que DERNIER membre → 409 (pas 403)', async () => {
    supa.queueResults([
      { data: { id: 'm-self', role: 'member' }, error: null },
      { count: 1, error: null },
    ])
    const res = await DELETE(deleteReq(), ctx('owner-test'))
    expect(res.status).toBe(409)
  })

  it('refuse un viewer invité (403)', async () => {
    asGuestViewer()
    const res = await DELETE(deleteReq(), ctx())
    expect(res.status).toBe(403)
  })

  it('404 si la cible n’est pas membre du foyer', async () => {
    supa.queueResult({ data: null, error: null })
    const res = await DELETE(deleteReq(), ctx())
    expect(res.status).toBe(404)
  })
})
