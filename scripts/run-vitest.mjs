#!/usr/bin/env node
import { globSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { childProcessExitCode } from "./child-process-result.mjs";
import { offlineTestEnvironment } from "./test-environment.mjs";
import { acquireHeavyRunLock } from "./test-run-lock.mjs";
import { vitestLeaseMode } from "./test-run-selection.mjs";
import { runOwnedChild } from "./owned-child.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vitestBin = path.join(projectRoot, "node_modules", "vitest", "vitest.mjs");
const rawArgs = process.argv.slice(2);
const args = rawArgs.flatMap((arg) => {
  if (arg.startsWith("-") || !/[*?]/.test(arg)) return [arg];
  try {
    const matched = globSync(arg.replace(/\\/g, "/"), { cwd: projectRoot });
    return matched.length > 0 ? matched : [arg];
  } catch {
    return [arg];
  }
});

export const VITEST_BUILTIN_REPORTERS = new Set([
  "default",
  "agent",
  "minimal",
  "blob",
  "verbose",
  "dot",
  "json",
  "tap",
  "tap-flat",
  "junit",
  "tree",
  "hanging-process",
  "github-actions",
]);

export function isValidReporter(reporter) {
  if (VITEST_BUILTIN_REPORTERS.has(reporter)) return true;
  if (reporter.includes("/") || reporter.includes("\\") || /\.[mc]?[jt]sx?$/.test(reporter)) {
    return true;
  }
  return false;
}

export function extractReporters(argumentList) {
  const reporters = [];
  for (let i = 0; i < argumentList.length; i++) {
    const arg = argumentList[i];
    if (/^--reporters?=/.test(arg)) {
      const val = arg.slice(arg.indexOf("=") + 1);
      reporters.push(
        ...val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } else if (arg === "--reporter" || arg === "--reporters" || arg === "-r") {
      const next = argumentList[i + 1];
      if (next && !next.startsWith("-")) {
        reporters.push(
          ...next
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        );
        i++;
      }
    } else if (arg.startsWith("-r=")) {
      const val = arg.slice("-r=".length);
      reporters.push(
        ...val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
  }
  return reporters;
}

export function validateReporters(argumentList) {
  const reporters = extractReporters(argumentList);
  const invalid = reporters.filter((r) => !isValidReporter(r));
  if (invalid.length > 0) {
    return {
      valid: false,
      invalidReporters: invalid,
      error: `Unrecognized Vitest reporter(s): ${invalid.join(", ")}. Valid built-in reporters: ${Array.from(VITEST_BUILTIN_REPORTERS).join(", ")}. Custom reporters must be valid file paths.`,
    };
  }
  return { valid: true, invalidReporters: [], error: null };
}

export async function main() {
  const reporterValidation = validateReporters(args);
  if (!reporterValidation.valid) {
    console.error(`[run-vitest] ERROR: ${reporterValidation.error}`);
    process.exit(1);
  }

  const mode = vitestLeaseMode(args);

  const lock = acquireHeavyRunLock({ projectRoot, command: `vitest ${args.join(" ")}`, mode });
  const configuredWorkers = Number(process.env.VITEST_MAX_WORKERS);
  const sharedWorkers =
    Number.isFinite(configuredWorkers) && configuredWorkers > 0 ? Math.min(configuredWorkers, 2) : 2;
  const environment = offlineTestEnvironment(lock.environment, {
    NODE_ENV: "test",
    ...(mode === "shared" ? { VITEST_MAX_WORKERS: String(sharedWorkers) } : {}),
  });

  async function runVitest() {
    const result = await runOwnedChild(process.execPath, [vitestBin, ...args], {
      cwd: projectRoot,
      env: environment,
      stdio: "inherit",
    });
    return childProcessExitCode(result);
  }

  let exitCode = 1;
  try {
    exitCode = await runVitest();
  } finally {
    lock.release();
  }

  process.exit(exitCode);
}

const isEntrypoint = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isEntrypoint) {
  await main();
}
