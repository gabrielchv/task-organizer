import { describe, expect, it } from "vitest";
import {
  describeNow,
  formatDue,
  isAllDay,
  isValidDue,
  isValidTimeZone,
  localDateKey,
  safeTimeZone,
} from "./dates";

describe("timezone handling", () => {
  it("accepts a real IANA zone", () => {
    expect(isValidTimeZone("America/Sao_Paulo")).toBe(true);
  });

  it("rejects junk instead of letting Intl throw", () => {
    expect(isValidTimeZone("Nowhere/Fake")).toBe(false);
    expect(isValidTimeZone("'); DROP TABLE--")).toBe(false);
    expect(isValidTimeZone("A".repeat(200))).toBe(false);
  });

  it("falls back to UTC for missing or invalid input", () => {
    expect(safeTimeZone(undefined)).toBe("UTC");
    expect(safeTimeZone("Nowhere/Fake")).toBe("UTC");
    expect(safeTimeZone("Europe/Lisbon")).toBe("Europe/Lisbon");
  });
});

describe("describeNow", () => {
  it("names the local weekday, not the UTC one", () => {
    // 02:30 UTC on the 11th is still the evening of the 10th in São Paulo.
    const instant = new Date("2026-03-11T02:30:00.000Z");

    expect(describeNow(instant, "America/Sao_Paulo")).toContain("March 10");
    expect(describeNow(instant, "UTC")).toContain("March 11");
  });
});

describe("localDateKey", () => {
  it("resolves today in the user's zone", () => {
    const instant = new Date("2026-03-11T02:30:00.000Z");

    expect(localDateKey(instant, "America/Sao_Paulo")).toBe("2026-03-10");
    expect(localDateKey(instant, "UTC")).toBe("2026-03-11");
  });
});

describe("isValidDue", () => {
  it.each(["2026-03-10", "2026-03-10T14:00"])("accepts %s", (due) => {
    expect(isValidDue(due)).toBe(true);
  });

  it.each(["2026-02-30", "2026-13-01", "10/03/2026", "2026-03-10T14:00:00", ""])(
    "rejects %s",
    (due) => {
      expect(isValidDue(due)).toBe(false);
    },
  );
});

describe("isAllDay", () => {
  it("distinguishes a bare date from a timed one", () => {
    expect(isAllDay("2026-03-10")).toBe(true);
    expect(isAllDay("2026-03-10T14:00")).toBe(false);
  });
});

describe("formatDue", () => {
  it("keeps the same calendar day regardless of the runtime zone", () => {
    expect(formatDue("2026-03-10", "en-US")).toContain("10");
    expect(formatDue("2026-03-10T14:00", "en-US")).toContain("10");
  });
});
