#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { childProcessExitCode } from "./child-process-result.mjs";
import { offlineTestEnvironment } from "./test-environment.mjs";
import { acquireHeavyRunLock } from "./test-run-lock.mjs";
import { runOwnedChild } from "./owned-child.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function parseBackendTestArguments(args) {
  for (const argument of args)
    if (!["--offline", "--integration", "--coverage"].includes(argument))
      throw new Error(`Unknown backend test option: ${argument}`);
  if (args.includes("--offline") && args.includes("--integration"))
    throw new Error("Backend tests cannot combine --offline and --integration");
  return {
    offline: args.includes("--offline"),
    requireDatabase: args.includes("--integration"),
    coverage: args.includes("--coverage"),
  };
}

/**
 * Discover the backend's actual test population, including future nested suites.
 * @param {{root?:string,environment?:Record<string,string|undefined>,offline?:boolean,requireDatabase?:boolean,coverage?:boolean}} [options]
 */
export function backendTestPlan({
  root = projectRoot,
  environment = process.env,
  offline = false,
  requireDatabase = false,
  coverage = false,
} = {}) {
  if (offline && requireDatabase) throw new Error("Backend tests cannot combine offline and required integration");
  const cwd = path.join(root, "backend/ward-flow");
  const files = [];
  function walk(directory, prefix = "") {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || ["node_modules", "dist"].includes(entry.name)) continue;
      const relative = `${prefix}${entry.name}`;
      if (entry.isDirectory()) walk(path.join(directory, entry.name), `${relative}/`);
      else if (entry.isFile() && entry.name.endsWith(".test.mjs")) files.push(relative);
    }
  }
  if (!existsSync(cwd)) throw new Error("Ward backend test directory is missing");
  walk(cwd);
  files.sort();
  if (!files.length) throw new Error("No backend test files were discovered");
  const databaseUrl = offline ? "" : (environment.WARD_TEST_DATABASE_URL?.trim() ?? "");
  if (requireDatabase && !databaseUrl)
    throw new Error("Backend integration requires an explicit loopback WARD_TEST_DATABASE_URL");
  if (databaseUrl) {
    let url;
    try {
      url = new URL(databaseUrl);
    } catch {
      throw new Error("WARD_TEST_DATABASE_URL must be a valid PostgreSQL URL on loopback");
    }
    if (!["postgres:", "postgresql:"].includes(url.protocol))
      throw new Error("WARD_TEST_DATABASE_URL must use PostgreSQL");
    if (!loopback.has(url.hostname))
      throw new Error("Backend integration requires an isolated loopback PostgreSQL server");
  }
  const reportDirectory = path.join(root, "coverage/backend");
  const args = ["--test"];
  if (coverage)
    args.push(
      "--experimental-test-coverage",
      "--test-coverage-include=**/*.mjs",
      "--test-coverage-exclude=**/node_modules/**",
      "--test-coverage-exclude=**/dist/**",
      "--test-coverage-exclude=**/*.test.mjs",
      "--test-coverage-exclude=**/*.test-support.mjs",
      "--test-reporter=spec",
      "--test-reporter-destination=stdout",
      "--test-reporter=lcov",
      `--test-reporter-destination=${path.join(reportDirectory, "lcov.info")}`,
    );
  args.push("--", ...files.map((file) => path.join(cwd, file)));
  return {
    cwd,
    files,
    args,
    integration: Boolean(databaseUrl),
    reportDirectory: coverage ? reportDirectory : null,
    environment: /** @type {Record<string,string|undefined>} */ (
      offlineTestEnvironment(environment, {
        NODE_ENV: "test",
        WARD_TEST_DATABASE_URL: databaseUrl,
        WARD_E2E_DATABASE_URL: "",
      })
    ),
    summary: databaseUrl
      ? "PostgreSQL integration: selected against an explicit loopback database; the test verdict is still required."
      : "PostgreSQL integration: NOT RUN (no explicit loopback WARD_TEST_DATABASE_URL); backend unit evidence only.",
  };
}

/** @param {Parameters<typeof backendTestPlan>[0] & {run?:typeof runOwnedChild,log?:(message:string)=>void}} [options] */
export async function runBackendTests({
  root = projectRoot,
  environment = process.env,
  offline = false,
  requireDatabase = false,
  coverage = false,
  run = runOwnedChild,
  log = console.log,
} = {}) {
  const plan = backendTestPlan({ root, environment, offline, requireDatabase, coverage });
  log(`Backend tests: ${plan.files.length} discovered files. ${plan.summary}`);
  if (plan.reportDirectory) mkdirSync(plan.reportDirectory, { recursive: true });
  const result = await run(process.execPath, plan.args, { cwd: plan.cwd, env: plan.environment, stdio: "inherit" });
  return childProcessExitCode(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let admission;
  try {
    const options = parseBackendTestArguments(process.argv.slice(2));
    // Validate mode and target before reserving the shared machine's test capacity.
    backendTestPlan(options);
    admission = acquireHeavyRunLock({ projectRoot, mode: "exclusive", command: "Ward backend tests" });
    process.exitCode = await runBackendTests({ ...options, environment: admission.environment });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    admission?.release();
  }
}
