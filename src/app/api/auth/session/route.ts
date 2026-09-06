import { NextRequest, NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth/session'
import { getRequestOrigin } from '@/lib/request-origin'

export async function DELETE(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/', getRequestOrigin(request)), {
    status: 303,
  })
  clearSessionCookie(response)
  return response
}
