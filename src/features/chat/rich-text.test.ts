import { describe, expect, it } from "vitest";
import { parseRichText } from "./rich-text";

describe("parseRichText", () => {
  it("returns nothing for empty input", () => {
    expect(parseRichText("")).toEqual([]);
  });

  it("returns a single run of plain text", () => {
    expect(parseRichText("Added it.")).toEqual([{ type: "text", value: "Added it." }]);
  });

  it("splits bold runs out of surrounding text", () => {
    expect(parseRichText("Added **Dentist** for **Friday**.")).toEqual([
      { type: "text", value: "Added " },
      { type: "bold", value: "Dentist" },
      { type: "text", value: " for " },
      { type: "bold", value: "Friday" },
      { type: "text", value: "." },
    ]);
  });

  it("leaves an unclosed marker as literal text", () => {
    expect(parseRichText("Added **Dentist")).toEqual([
      { type: "text", value: "Added **Dentist" },
    ]);
  });

  it("handles bold spanning a line break", () => {
    expect(parseRichText("**two\nlines**")).toEqual([
      { type: "bold", value: "two\nlines" },
    ]);
  });

  it("does not treat an empty marker pair as bold", () => {
    expect(parseRichText("a ** ** b")).toEqual([
      { type: "text", value: "a " },
      { type: "bold", value: " " },
      { type: "text", value: " b" },
    ]);
  });
});
