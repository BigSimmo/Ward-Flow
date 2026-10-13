#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const playwrightBin = path.join(projectRoot, "node_modules", "playwright", "cli.js");

const rawUrl =
  process.env.PREVIEW_URL || process.argv.find((arg) => arg.startsWith("http://") || arg.startsWith("https://"));

if (rawUrl) {
  const previewUrl = rawUrl.trim().replace(/\/+$/, "");
  console.log(`[preview-smoke] Running Playwright smoke tests against preview deploy: ${previewUrl}`);

  const args = [
    playwrightBin,
    "test",
    "tests/ui-ward-journey-preview-smoke.spec.ts",
    "--project=chromium-mockups",
    "--reporter=list",
  ];

  if (process.env.CI) {
    args.push("--trace=on-first-retry");
  }

  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    env: {
      ...process.env,
      PREVIEW_URL: previewUrl,
      PLAYWRIGHT_BASE_URL: previewUrl,
      ALLOW_REMOTE_BASE_URL: "1",
    },
    stdio: "inherit",
  });

  child.on("close", (code) => {
    process.exit(code ?? 1);
  });
} else {
  console.log("[preview-smoke] No PREVIEW_URL provided; running smoke tests against local server.");
  const child = spawn(
    process.execPath,
    [
      path.join(projectRoot, "scripts", "run-playwright.mjs"),
      "--project=chromium-mockups",
      "tests/ui-ward-journey-preview-smoke.spec.ts",
      ...process.argv.slice(2),
    ],
    {
      cwd: projectRoot,
      env: process.env,
      stdio: "inherit",
    },
  );

  child.on("close", (code) => {
    process.exit(code ?? 1);
  });
}
