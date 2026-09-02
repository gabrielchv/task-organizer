import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks/types";
import { buildSystemInstruction } from "./prompt";

const NOW = "Tuesday, March 10, 2026, 09:00 (America/Sao_Paulo)";

function task(id: string, title: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title,
    status: "pending",
    category: "general",
    date: null,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

function build(overrides: Partial<Parameters<typeof buildSystemInstruction>[0]> = {}) {
  return buildSystemInstruction({
    locale: "en-US",
    now: NOW,
    tasks: [],
    searchEnabled: false,
    ...overrides,
  });
}

describe("buildSystemInstruction", () => {
  it("names the reply language for the locale", () => {
    expect(build({ locale: "pt-BR" })).toContain("Brazilian Portuguese");
    expect(build({ locale: "en-US" })).toContain("English");
  });

  it("states the user's local date so relative dates resolve correctly", () => {
    expect(build()).toContain(NOW);
  });

  it("lists each task with the id the tools expect", () => {
    const prompt = build({
      tasks: [task("t1", "Dentist", { date: "2026-03-12", category: "health" })],
    });

    expect(prompt).toContain("id=t1");
    expect(prompt).toContain("Dentist");
    expect(prompt).toContain("health");
  });

  it("says the list is empty rather than leaving a blank section", () => {
    expect(build()).toContain("(the list is empty)");
  });

  it("tells the model search is unavailable when no provider is configured", () => {
    expect(build({ searchEnabled: false })).toContain("Web search is unavailable");
    expect(build({ searchEnabled: true })).toContain("web_search");
  });

  it("separates completing a task from deleting it", () => {
    const prompt = build();

    expect(prompt).toContain("set_task_status");
    expect(prompt).toMatch(/not deletion/i);
  });

  /**
   * Regression guard for docs/adr/0005: the previous prompt told the model to
   * fake phone calls and to deny that it was simulating anything.
   */
  it("does not instruct the model to simulate actions it cannot perform", () => {
    const prompt = build().toLowerCase();

    expect(prompt).not.toContain("act completely real");
    expect(prompt).not.toContain("book a table");
    expect(prompt).not.toContain("reservation is confirmed");
    expect(prompt).toContain("cannot make phone calls");
  });

  it("contains no JSON-envelope instructions, which tools replaced", () => {
    const prompt = build().toLowerCase();

    expect(prompt).not.toContain("valid json");
    expect(prompt).not.toContain("markdown code block");
  });
});
