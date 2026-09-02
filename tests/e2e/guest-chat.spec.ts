import { expect, test } from "@playwright/test";
import { stubChat, stubChatError } from "./helpers";

/** Scoped so a title matching both a chat bubble and the list is unambiguous. */
const taskList = (page: import("@playwright/test").Page) =>
  page.getByRole("complementary", { name: "Tasks" });

test.describe("guest chat", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en-US/chat");
  });

  test("adds a task from a typed message and keeps it after a reload", async ({
    page,
  }) => {
    await stubChat(page, "Added **Buy milk**.", [{ id: "t1", title: "Buy milk" }]);

    await page.getByLabel("Type a task...").fill("buy milk");
    await page.getByLabel("Type a task...").press("Enter");

    await expect(page.getByText("Added Buy milk.")).toBeVisible();
    await expect(taskList(page).getByText("Buy milk")).toBeVisible();

    await page.reload();
    await expect(taskList(page).getByText("Buy milk")).toBeVisible();
  });

  test("completes and deletes a task", async ({ page }) => {
    await stubChat(page, "Added **Gym**.", [{ id: "t1", title: "Gym" }]);
    await page.getByLabel("Type a task...").fill("gym");
    await page.getByLabel("Type a task...").press("Enter");

    const toggle = page.getByRole("checkbox", { name: /Toggle task: Gym/ });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: /Delete task: Gym/ }).click();
    await expect(taskList(page).getByText("No tasks yet.")).toBeVisible();
  });

  test("does not lose existing tasks when a later turn only adds one", async ({
    page,
  }) => {
    await stubChat(page, "Added **Milk**.", [{ id: "t1", title: "Milk" }]);
    await page.getByLabel("Type a task...").fill("milk");
    await page.getByLabel("Type a task...").press("Enter");
    await expect(taskList(page).getByText("Milk")).toBeVisible();

    await stubChat(page, "Added **Bread**.", [
      { id: "t1", title: "Milk" },
      { id: "t2", title: "Bread" },
    ]);
    await page.getByLabel("Type a task...").fill("bread");
    await page.getByLabel("Type a task...").press("Enter");

    await expect(taskList(page).getByText("Bread")).toBeVisible();
    await expect(taskList(page).getByText("Milk")).toBeVisible();
  });

  test("tells the user when it has been rate limited", async ({ page }) => {
    await stubChatError(page, 429, "rate_limited");

    await page.getByLabel("Type a task...").fill("hello");
    await page.getByLabel("Type a task...").press("Enter");

    await expect(page.getByRole("status")).toContainText("Too many requests");
  });
});
