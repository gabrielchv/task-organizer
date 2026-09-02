import { describe, expect, it } from "vitest";
import { getDictionary, interpolate } from "../index";
import { enUS } from "./en-US";
import { ptBR } from "./pt-BR";

/**
 * Structural completeness is enforced by the `Dictionary` type at compile time.
 * These tests cover what the type cannot: empty strings, copy-paste leftovers
 * and placeholder drift between locales.
 */
function flatten(value: unknown, prefix = ""): Array<[string, string]> {
  if (typeof value === "string") return [[prefix, value]];
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    flatten(child, prefix ? `${prefix}.${key}` : key),
  );
}

const english = flatten(enUS);
const portuguese = new Map(flatten(ptBR));

describe("dictionaries", () => {
  it("has no empty strings", () => {
    const empty = [...english, ...portuguese].filter(([, text]) => text.trim().length === 0);
    expect(empty).toEqual([]);
  });

  it("uses the same placeholders in every locale", () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

    for (const [key, text] of english) {
      const translated = portuguese.get(key);
      expect(translated, `missing key: ${key}`).toBeDefined();
      expect(placeholders(translated ?? ""), `placeholders differ for ${key}`).toEqual(
        placeholders(text),
      );
    }
  });

  it("does not leave English text in the Portuguese locale for translated copy", () => {
    // Product names are intentionally identical; everything else should differ.
    const identical = english
      .filter(([key, text]) => portuguese.get(key) === text)
      .map(([key]) => key);

    expect(identical).toEqual(["title"]);
  });
});

describe("getDictionary", () => {
  it("falls back to English for an unknown locale", () => {
    expect(getDictionary("de-DE")).toBe(enUS);
    expect(getDictionary("pt-BR")).toBe(ptBR);
  });
});

describe("interpolate", () => {
  it("substitutes named values", () => {
    expect(interpolate("Exported {count} tasks.", { count: 3 })).toBe("Exported 3 tasks.");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(interpolate("Hello {name}", {})).toBe("Hello {name}");
  });
});
