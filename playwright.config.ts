import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:5173",
    actionTimeout: 20000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.CHROME_BIN
      ? {
          executablePath: process.env.CHROME_BIN,
          args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        }
      : {},
  },
  webServer: [
    {
      command: "node --import tsx tests/helpers/server.ts",
      url: "http://127.0.0.1:4901/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      command: "pnpm --filter @mazate/frontend dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
      env: {
        VITE_API_URL: "http://127.0.0.1:4901/api",
        VITE_SUPABASE_URL: "http://127.0.0.1:4902",
        VITE_SUPABASE_ANON_KEY: "test-public-key",
        VITE_FALLBACK_REFRESH_MS: "5000",
      },
    },
  ],
});
