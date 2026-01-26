import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const locales = ['en-US', 'pt-BR']
const defaultLocale = 'en-US'
const COOKIE_NAME = 'NEXT_LOCALE'

// Helper to detect language
function getLocale(request: NextRequest): string {
  // 1. Check for a cookie first (so users can switch language)
  const cookieLocale = request.cookies.get(COOKIE_NAME)?.value
  if (cookieLocale && locales.includes(cookieLocale)) {
    return cookieLocale
  }

  // 2. Check Accept-Language header
  const acceptLanguage = request.headers.get('accept-language')
  if (!acceptLanguage) return defaultLocale

  const preferredLocales = acceptLanguage
    .split(',')
    .map(lang => lang.split(';')[0].trim())

  for (const lang of preferredLocales) {
    if (locales.includes(lang)) return lang
    
    // Check prefix (e.g. "pt" matches "pt-BR")
    const prefixMatch = locales.find(l => l.startsWith(lang.split('-')[0]))
    if (prefixMatch) return prefixMatch
  }

  return defaultLocale
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/model')) {
    return NextResponse.next()
  }
  
  // Check if the path is missing the locale prefix
  const pathnameIsMissingLocale = locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  )

  // If the path is just "/" or "/dashboard" (no locale)
  if (pathnameIsMissingLocale) {
    const locale = getLocale(request)

    // REWRITE instead of Redirect
    // The user sees: /dashboard
    // The server processes: /en-US/dashboard
    return NextResponse.rewrite(
      new URL(`/${locale}${pathname}`, request.url)
    )
  }
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|model).*)',
  ],
}