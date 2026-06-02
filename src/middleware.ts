// src/middleware.ts
import { auth } from '@/lib/auth/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isOnLoginPage = req.nextUrl.pathname.startsWith('/connexion')
  const isApiAuth = req.nextUrl.pathname.startsWith('/api/auth')

  // Laisser passer les routes auth
  if (isApiAuth) return NextResponse.next()

  // Rediriger vers login si non connecté
  if (!isLoggedIn && !isOnLoginPage) {
    return NextResponse.redirect(new URL('/connexion', req.nextUrl))
  }

  // Rediriger vers dashboard si déjà connecté
  if (isLoggedIn && isOnLoginPage) {
    return NextResponse.redirect(new URL('/', req.nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
