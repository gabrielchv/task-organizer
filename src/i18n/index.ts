import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { enUS, type Dictionary } from "./dictionaries/en-US";
import { ptBR } from "./dictionaries/pt-BR";

export type { Dictionary, HelpTopic } from "./dictionaries/en-US";
export type { Locale } from "./config";

const dictionaries: Record<Locale, Dictionary> = {
  "en-US": enUS,
  "pt-BR": ptBR,
};

export function getDictionary(locale: string): Dictionary {
  return isLocale(locale) ? dictionaries[locale] : dictionaries[DEFAULT_LOCALE];
}

/** Fills `{placeholder}` slots in a dictionary string. */
export function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
