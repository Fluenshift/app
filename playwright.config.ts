import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  forbidOnly: true,
  fullyParallel: false,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: [["list"]],
  testDir: "./e2e",
  use: { baseURL: "http://127.0.0.1:4173" },
  webServer: {
    command: "node apps/server/dist/index.mjs",
    env: { SERVER_HOST: "127.0.0.1", SERVER_PORT: "4173" },
    reuseExistingServer: false,
    url: "http://127.0.0.1:4173/api/health",
  },
});
