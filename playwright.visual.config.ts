import { defineConfig, devices } from "playwright/test";
import { stableProjectPort } from "./src/lib/local-server-utils.mjs";
import { getPlaywrightBaseUrl } from "./scripts/playwright-base-url";

process.env.PORT = process.env.PORT || String(stableProjectPort(process.cwd()));
const baseURL = getPlaywrightBaseUrl({ allowEnsure: false });

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*(?:visual|snapshots).*\.spec\.ts/,
  snapshotDir: "./tests/__snapshots__",
  timeout: 45_000,
  retries: 0,
  forbidOnly: !!process.env.CI,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
