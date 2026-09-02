import { publicEnv } from "@/lib/env";

export type VoskLanguage = "en" | "pt";

export const WAKE_PHRASES: Record<VoskLanguage, string> = {
  en: "hey organizer",
  pt: "olá organizador",
};

/** Kaldi grammars restrict recognition to the wake phrase plus "unknown". */
export const WAKE_GRAMMARS: Record<VoskLanguage, string> = {
  en: JSON.stringify([WAKE_PHRASES.en, "[unk]"]),
  pt: JSON.stringify([WAKE_PHRASES.pt, "[unk]"]),
};

export function languageFor(locale: string): VoskLanguage {
  return locale.toLowerCase().startsWith("pt") ? "pt" : "en";
}

export function modelUrl(language: VoskLanguage): string {
  return `${publicEnv().voskBucketUrl}/${language}/model.tar.gz`;
}
