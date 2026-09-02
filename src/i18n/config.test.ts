import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, isLocale, matchLocale } from "./config";

describe("matchLocale", () => {
  it("returns the default when the header is absent", () => {
    expect(matchLocale(null)).toBe(DEFAULT_LOCALE);
  });

  it("matches an exact tag", () => {
    expect(matchLocale("pt-BR")).toBe("pt-BR");
  });

  it("matches on the language subtag", () => {
    expect(matchLocale("pt-PT,pt;q=0.9")).toBe("pt-BR");
    expect(matchLocale("en-GB")).toBe("en-US");
  });

  it("honours quality values rather than header order", () => {
    expect(matchLocale("en-US;q=0.2,pt-BR;q=0.9")).toBe("pt-BR");
  });

  it("falls back for an unsupported language", () => {
    expect(matchLocale("ja-JP,ko;q=0.8")).toBe(DEFAULT_LOCALE);
  });
});

describe("isLocale", () => {
  it("narrows only known locales", () => {
    expect(isLocale("en-US")).toBe(true);
    expect(isLocale("de-DE")).toBe(false);
  });
});
