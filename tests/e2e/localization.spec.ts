import { expect, test } from "@playwright/test";

test.describe("locale routing", () => {
  test("redirects a bare path to a locale-prefixed URL", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/(en-US|pt-BR)$/);
  });

  test("honours the Accept-Language header", async ({ browser }) => {
    const context = await browser.newContext({ locale: "pt-BR" });
    const page = await context.newPage();

    await page.goto("/");

    await expect(page).toHaveURL(/\/pt-BR$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Organize sua vida",
    );
    await context.close();
  });

  test("serves the chat in the locale named in the URL", async ({ page }) => {
    await page.goto("/pt-BR/chat");

    await expect(page.getByLabel("Digite uma tarefa...")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  });

  test("has a healthy API", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.ok()).toBe(true);
    expect(await response.json()).toMatchObject({ status: "ok" });
  });
});
