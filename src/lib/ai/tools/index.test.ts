import { describe, expect, it } from "vitest";
import { buildToolset } from "./index";
import { toFunctionDeclaration } from "./types";

describe("buildToolset", () => {
  it("always registers the task tools and the help tool", () => {
    const { tools } = buildToolset({ deviceType: "desktop", searchApiKey: undefined });

    expect(tools.map((tool) => tool.name)).toEqual([
      "add_task",
      "update_task",
      "set_task_status",
      "delete_task",
      "list_tasks",
      "get_app_help",
    ]);
  });

  it("omits web_search when no provider key is configured", () => {
    const { tools, searchEnabled } = buildToolset({
      deviceType: "mobile",
      searchApiKey: undefined,
    });

    expect(searchEnabled).toBe(false);
    expect(tools.some((tool) => tool.name === "web_search")).toBe(false);
  });

  it("registers web_search when a key is present", () => {
    const { tools, searchEnabled } = buildToolset({
      deviceType: "mobile",
      searchApiKey: "brave-key",
    });

    expect(searchEnabled).toBe(true);
    expect(tools.some((tool) => tool.name === "web_search")).toBe(true);
  });

  it("gives every tool a unique name", () => {
    const { tools } = buildToolset({ deviceType: "desktop", searchApiKey: "k" });
    const names = tools.map((tool) => tool.name);

    expect(new Set(names).size).toBe(names.length);
  });
});

describe("toFunctionDeclaration", () => {
  it("derives the model contract from the tool's own schema", () => {
    const { byName } = buildToolset({ deviceType: "desktop", searchApiKey: undefined });
    const addTask = byName.get("add_task");
    expect(addTask).toBeDefined();

    const declaration = toFunctionDeclaration(addTask!);
    const schema = declaration.parametersJsonSchema as {
      type: string;
      required?: string[];
      properties: Record<string, unknown>;
      $schema?: string;
    };

    expect(declaration.name).toBe("add_task");
    expect(schema.type).toBe("object");
    expect(schema.required).toEqual(["title"]);
    expect(Object.keys(schema.properties).sort()).toEqual(["category", "date", "title"]);
    // Gemini rejects the $schema keyword, so it must not survive conversion.
    expect(schema.$schema).toBeUndefined();
  });

  it("describes get_app_help's topics as an enum the model can pick from", () => {
    const { byName } = buildToolset({ deviceType: "mobile", searchApiKey: undefined });
    const declaration = toFunctionDeclaration(byName.get("get_app_help")!);
    const schema = declaration.parametersJsonSchema as {
      properties: { topic: { enum: string[] } };
    };

    expect(schema.properties.topic.enum).toContain("wakeWord");
  });
});
