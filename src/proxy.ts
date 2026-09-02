import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALES,
  isLocale,
  matchLocale,
} from "@/i18n/config";

/**
 * Redirects to a locale-prefixed URL.
 *
 * The previous version used `rewrite`, so `/chat` silently served `/pt-BR/chat`
 * and the locale never appeared in the address bar — links could not be shared
 * in a chosen language and search engines saw one URL for two documents.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const hasLocale = LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return NextResponse.next();

  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale =
    cookieLocale && isLocale(cookieLocale)
      ? cookieLocale
      : matchLocale(request.headers.get("accept-language"));

  const target = new URL(
    `/${locale}${pathname === "/" ? "" : pathname}${search}`,
    request.url,
  );
  const response = NextResponse.redirect(target);
  response.cookies.set(LOCALE_COOKIE, locale ?? DEFAULT_LOCALE, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
