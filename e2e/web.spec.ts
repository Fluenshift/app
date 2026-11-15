import { expect, test } from "@playwright/test";

test("the built server serves the web application", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.headers()["cache-control"]).toBe("no-cache");
  await expect(
    page.getByRole("heading", { level: 1, name: "Writing Desk" })
  ).toBeVisible();
});

test("the built server answers a direct browser route with the web application", async ({
  request,
}) => {
  const response = await request.get("/evaluations/evaluation-1");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/html");
  expect(await response.text()).toContain('<div id="app"></div>');
});
