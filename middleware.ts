import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 1. Define supported locales
const locales = ['en-US', 'pt-BR']
const defaultLocale = 'en-US'

export function middleware(request: NextRequest) {
  // 2. Check if the path already has a locale
  const { pathname } = request.nextUrl
  const pathnameIsMissingLocale = locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  )

  // 3. Redirect if no locale found (e.g. "/" -> "/en-US")
  if (pathnameIsMissingLocale) {
    const locale = defaultLocale // You could add logic here to detect browser language
    return NextResponse.redirect(
      new URL(`/${locale}${pathname}`, request.url)
    )
  }
}

export const config = {
  matcher: [
    // Skip all internal paths (_next, api, assets)
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg).*)',
  ],
}