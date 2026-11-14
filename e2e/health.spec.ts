import { expect, test } from "@playwright/test";

test("the built server answers its health check", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(await response.json()).toStrictEqual({ status: "ok" });
});
