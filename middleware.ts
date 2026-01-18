import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const locales = ['en-US', 'pt-BR']
const defaultLocale = 'en-US'

// New function to detect language from headers
function getLocale(request: NextRequest): string {
  const acceptLanguage = request.headers.get('accept-language')
  
  // If no header, use default
  if (!acceptLanguage) return defaultLocale

  // Parse header (e.g., "pt-BR,pt;q=0.9,en-US;q=0.8")
  const preferredLocales = acceptLanguage
    .split(',')
    .map(lang => lang.split(';')[0].trim())

  for (const lang of preferredLocales) {
    // 1. Exact match (e.g. "pt-BR" matches "pt-BR")
    if (locales.includes(lang)) {
      return lang
    }
    // 2. Prefix match (e.g. "pt" matches "pt-BR")
    const prefixMatch = locales.find(l => l.startsWith(lang.split('-')[0]))
    if (prefixMatch) {
      return prefixMatch
    }
  }

  return defaultLocale
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Check if path already has a locale
  const pathnameIsMissingLocale = locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  )

  if (pathnameIsMissingLocale) {
    // Detect the correct locale based on browser settings
    const locale = getLocale(request)
    
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