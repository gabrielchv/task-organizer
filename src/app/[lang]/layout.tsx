import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { getDictionary } from "@/i18n";
import { isLocale, LOCALES } from "@/i18n/config";
import "../globals.css";

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = getDictionary(lang);

  return {
    title: dictionary.title,
    description: dictionary.heroSubtitle,
    // The locale is in the path, so each language is its own indexable URL.
    alternates: {
      canonical: `/${lang}`,
      languages: Object.fromEntries(LOCALES.map((locale) => [locale, `/${locale}`])),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html lang={lang}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
