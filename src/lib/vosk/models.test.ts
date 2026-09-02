import { describe, expect, it } from "vitest";
import { languageFor, WAKE_GRAMMARS, WAKE_PHRASES } from "./models";

describe("languageFor", () => {
  it.each([
    ["pt-BR", "pt"],
    ["pt", "pt"],
    ["PT-pt", "pt"],
    ["en-US", "en"],
    ["de-DE", "en"],
  ])("maps %s to the %s model", (locale, expected) => {
    expect(languageFor(locale)).toBe(expected);
  });
});

describe("wake grammars", () => {
  it("restricts recognition to the phrase and the unknown token", () => {
    expect(JSON.parse(WAKE_GRAMMARS.pt)).toEqual([WAKE_PHRASES.pt, "[unk]"]);
    expect(JSON.parse(WAKE_GRAMMARS.en)).toEqual([WAKE_PHRASES.en, "[unk]"]);
  });
});
