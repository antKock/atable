import { NextRequest, NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth/session'

/**
 * Purge le cookie de session puis renvoie à la landing. Cible du redirect des
 * layouts quand getOwnerContext() ne résout pas la session (sid inconnu/révoqué,
 * ex. cookie forgé ou session supprimée) : un Server Component ne peut pas
 * poser de cookie, et rediriger vers `/` sans purger bouclerait — le middleware
 * renvoie tout porteur d'un JWT signé de `/` vers `/home`.
 * Route publique (préfixe /api/auth/session) ; GET idempotent et sans effet
 * pour un visiteur sans cookie.
 */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/', request.url), {
    status: 303,
  })
  clearSessionCookie(response)
  return response
}
