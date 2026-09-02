import { describe, expect, it } from "vitest";
import { toTask } from "./mapping";

describe("toTask", () => {
  it("reads a well-formed document", () => {
    const task = toTask("a", {
      title: "Dentist",
      status: "completed",
      category: "health",
      date: "2026-03-12T14:00",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
    });

    expect(task).toEqual({
      id: "a",
      title: "Dentist",
      status: "completed",
      category: "health",
      date: "2026-03-12T14:00",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
    });
  });

  it("maps a legacy localized category onto a slug", () => {
    expect(toTask("a", { title: "Consulta", category: "Saúde" }).category).toBe("health");
  });

  it("falls back to 'general' for an unrecognised category", () => {
    expect(toTask("a", { title: "x", category: "Bricolage" }).category).toBe("general");
  });

  it("drops a malformed date rather than surfacing it", () => {
    expect(toTask("a", { title: "x", date: "12/03/2026" }).date).toBeNull();
    expect(toTask("a", { title: "x", date: 1741651200000 }).date).toBeNull();
  });

  it("treats any status other than completed as pending", () => {
    expect(toTask("a", { title: "x", status: "archived" }).status).toBe("pending");
  });

  it("backfills timestamps missing from a pre-rewrite document", () => {
    const task = toTask("a", { title: "x" });

    expect(task.createdAt).toBe("1970-01-01T00:00:00.000Z");
    expect(task.updatedAt).toBe(task.createdAt);
  });
});
