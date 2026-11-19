import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  webServer: {
    command: "npx tsx server.ts",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 10000,
  },
});