#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import { childProcessExitCode } from "./child-process-result.mjs";
import { providerFreeCloudLiveTestGap, requireProviderTestPermission } from "./test-environment.mjs";
import { acquireHeavyRunLock } from "./test-run-lock.mjs";
import { runOwnedChild } from "./owned-child.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vitestBin = path.join(projectRoot, "node_modules", "vitest", "vitest.mjs");
const { loadEnvConfig } = nextEnv;
const providerTestPermission = process.env.ALLOW_PROVIDER_TESTS;
loadEnvConfig(projectRoot);

try {
  requireProviderTestPermission({ ALLOW_PROVIDER_TESTS: providerTestPermission });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const providerCapabilityGap = providerFreeCloudLiveTestGap(process.env);
if (providerCapabilityGap) {
  console.error(providerCapabilityGap);
  process.exit(2);
}

const lock = acquireHeavyRunLock({ projectRoot, command: "vitest live provider tests" });
let exitCode = 1;
try {
  const result = await runOwnedChild(process.execPath, [vitestBin, "run", ...process.argv.slice(2)], {
    cwd: projectRoot,
    env: { ...lock.environment, NODE_ENV: "test" },
    stdio: "inherit",
  });
  exitCode = childProcessExitCode(result);
} finally {
  lock.release();
}
process.exit(exitCode);
