import { expect, test } from "@playwright/test";

test.describe("Cairn guided tour (playground)", () => {
  test("starts and advances through the steps", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Start/ }).click();

    await expect(page.getByRole("heading", { name: /Welcome to Acme/ })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByRole("heading", { name: "Search anything" })).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByRole("heading", { name: "Your profile" })).toBeVisible();
  });

  test("branches to the invite step when hasTeam is toggled on", async ({ page }) => {
    await page.goto("/");
    // start() resets context to its initial value, so flip the branch *after*
    // the flow is running (the playground steps are synchronous — no run/race).
    await page.getByRole("button", { name: /Start/ }).click();
    await page.getByLabel(/hasTeam/).check();

    await page.getByRole("button", { name: "Next" }).click(); // welcome → search
    await page.getByRole("button", { name: "Next" }).click(); // search → profile
    await page.getByRole("button", { name: "Next" }).click(); // profile → invite (hasTeam)

    await expect(page.getByRole("heading", { name: /Invite your team/ })).toBeVisible();
  });

  test("completes (no popover) when hasTeam stays off", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Start/ }).click();
    await page.getByRole("button", { name: "Next" }).click(); // search
    await page.getByRole("button", { name: "Next" }).click(); // profile
    await page.getByRole("button", { name: "Next" }).click(); // profile.next → null → complete

    await expect(page.getByRole("heading", { name: "Your profile" })).toHaveCount(0);
  });
});
