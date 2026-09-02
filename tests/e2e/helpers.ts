import type { Page, Route } from "@playwright/test";

export interface StubTask {
  id: string;
  title: string;
  status?: "pending" | "completed";
  category?: string;
  date?: string | null;
}

function sse(events: object[]): string {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
}

function fullTask(task: StubTask) {
  return {
    id: task.id,
    title: task.title,
    status: task.status ?? "pending",
    category: task.category ?? "general",
    date: task.date ?? null,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: new Date().toISOString(),
  };
}

/** Replies to `/api/chat` with a scripted stream, as the real route would. */
export async function stubChat(
  page: Page,
  reply: string,
  tasks: StubTask[],
): Promise<void> {
  await page.route("**/api/chat", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: sse([
        { type: "text", delta: reply },
        { type: "tasks", tasks: tasks.map(fullTask) },
        { type: "done", text: reply },
      ]),
    });
  });
}

export async function stubChatError(
  page: Page,
  status: number,
  code: string,
): Promise<void> {
  await page.route("**/api/chat", async (route: Route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      headers: { "Retry-After": "30" },
      body: JSON.stringify({ error: { code, message: "nope" } }),
    });
  });
}
