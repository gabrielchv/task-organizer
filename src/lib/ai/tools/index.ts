import { createAppHelpTool } from "./help";
import { createWebSearchTool } from "./search";
import { taskTools } from "./tasks";
import type { ToolDefinition } from "./types";

export { defineTool, toFunctionDeclaration } from "./types";
export type { ToolContext, ToolDefinition, ToolResult } from "./types";

export interface ToolsetOptions {
  deviceType: "mobile" | "desktop";
  /** When absent, `web_search` is not registered and the prompt says so. */
  searchApiKey: string | undefined;
}

export interface Toolset {
  tools: ToolDefinition[];
  byName: Map<string, ToolDefinition>;
  searchEnabled: boolean;
}

export function buildToolset({ deviceType, searchApiKey }: ToolsetOptions): Toolset {
  const tools: ToolDefinition[] = [
    ...taskTools,
    createAppHelpTool(deviceType) as ToolDefinition,
  ];

  if (searchApiKey) tools.push(createWebSearchTool(searchApiKey));

  return {
    tools,
    byName: new Map(tools.map((tool) => [tool.name, tool])),
    searchEnabled: Boolean(searchApiKey),
  };
}
