export const LOCALES = ["en-US", "pt-BR"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en-US";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Picks a locale from an `Accept-Language` header, falling back to the default.
 * Matches on the language subtag too, so `pt-PT` resolves to `pt-BR`.
 */
export function matchLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  const requested = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag = "", quality] = part.trim().split(";q=");
      return { tag: tag.trim(), quality: quality ? Number(quality) : 1 };
    })
    .filter((entry) => entry.tag.length > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of requested) {
    if (isLocale(tag)) return tag;
    const primary = tag.split("-")[0]?.toLowerCase();
    if (!primary) continue;
    const prefixMatch = LOCALES.find((locale) => locale.toLowerCase().startsWith(primary));
    if (prefixMatch) return prefixMatch;
  }

  return DEFAULT_LOCALE;
}
