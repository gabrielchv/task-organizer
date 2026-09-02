import Link from "next/link";
import { getDictionary } from "@/i18n";

const FEATURES = [
  { titleKey: "featureVoiceTitle", descKey: "featureVoiceDesc" },
  { titleKey: "featureCatTitle", descKey: "featureCatDesc" },
  { titleKey: "featureSyncTitle", descKey: "featureSyncDesc" },
] as const;

export default async function LandingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const dictionary = getDictionary(lang);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-6 py-16 text-white">
      <div className="w-full max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          {dictionary.heroTitle}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-gray-300 md:text-lg">
          {dictionary.heroSubtitle}
        </p>

        <Link
          href={`/${lang}/chat`}
          className="mt-8 inline-block rounded-full bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-3 font-semibold shadow-lg transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-xl active:scale-95"
        >
          {dictionary.ctaStart}
        </Link>

        <ul className="mt-16 grid list-none gap-6 text-left md:grid-cols-3">
          {FEATURES.map(({ titleKey, descKey }) => (
            <li
              key={titleKey}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <h2 className="font-semibold">{dictionary[titleKey]}</h2>
              <p className="mt-2 text-sm text-gray-400">{dictionary[descKey]}</p>
            </li>
          ))}
        </ul>

        <footer className="mt-16 text-xs text-gray-500">
          {dictionary.footerBy}{" "}
          <a
            href="https://github.com/gabrielchv"
            className="underline hover:text-gray-300"
            rel="noreferrer"
          >
            gabrielchv
          </a>
        </footer>
      </div>
    </main>
  );
}
