import { NextRequest, NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth/session'

export async function DELETE(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/', request.url), {
    status: 303,
  })
  clearSessionCookie(response)
  return response
}
