#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyChanges, parseNameStatus } from "./ward-ci-public/plan.mjs";
import { childProcessExitCode } from "./child-process-result.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const common = [
  "check:runtime",
  "format:changed",
  "check:diff-integrity",
  "docs:check-scripts",
  "check:ward-doc-links",
];

// `--extended` is still accepted (callers pass it), but the extended and default plans are now the
// same list: tests/ward-verification-plan.test.ts pins that equality.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for call-site compatibility
export function selectedScripts(scope, _extended = false) {
  const plan = Array.isArray(scope.entries) ? classifyChanges(scope.entries) : scope;
  const scripts = [...common];
  if (plan.full) scripts.push("check:installed-lock-parity", "check:ci-scope");
  if (plan.policy) scripts.push("check:ward-policy-contracts");
  if (scope.entries?.some(({ file }) => file.startsWith("backend/ward-flow/"))) scripts.push("check:ward-backend");
  if (plan.unit) scripts.push("lint", "typecheck", "check:ward-expected-reds");
  if (plan.browser) scripts.push("test:e2e:ward-journeys");
  return [...new Set(scripts)];
}

export function readScope({ files, base = process.env.WARD_TASK_BASE ?? "origin/main" } = {}) {
  let entries;
  if (files) {
    entries = files
      .split(",")
      .filter(Boolean)
      .map((file) => ({ file: file.replace(/\\/g, "/"), status: existsSync(path.join(root, file)) ? "M" : "D" }));
  } else {
    const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 30000 });
    try {
      entries = [
        ...parseNameStatus(git("diff", "--name-status", "--no-renames", `${base}...HEAD`)),
        ...parseNameStatus(git("diff", "--name-status", "--no-renames", "HEAD")),
        ...git("ls-files", "--others", "--exclude-standard")
          .split(/\r?\n/)
          .filter(Boolean)
          .map((file) => ({ status: "A", file })),
      ];
    } catch {
      entries = [];
    } // Missing history is unknown, therefore full selection.
  }
  return { ...classifyChanges(entries), entries, files: [...new Set(entries.map(({ file }) => file))] };
}

export function validateSelectedScripts(
  scripts,
  manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")),
) {
  const missing = scripts.filter((script) => typeof manifest.scripts?.[script] !== "string");
  if (missing.length) throw new Error(`Selected Ward command aliases are unavailable: ${missing.join(", ")}`);
}

function runNpmScript(script) {
  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", `npm run ${script}`], { cwd: root, stdio: "inherit" })
      : spawnSync("npm", ["run", script], { cwd: root, stdio: "inherit" });
  return childProcessExitCode(result);
}

export function summarizePrLocalRun(scripts, { completed = [], failedScript = null, failedExitCode = 0 } = {}) {
  const notReached = scripts.filter((script) => !completed.includes(script) && script !== failedScript);
  return [
    "PR-local verification summary:",
    `- completed: ${completed.join(", ") || "(none)"}`,
    `- failed: ${failedScript ? `${failedScript} (exit ${failedExitCode})` : "(none)"}`,
    `- not reached: ${notReached.join(", ") || "(none)"}`,
    "Local selected evidence does not establish hosted CI, publication or deployment.",
  ].join("\n");
}

export function runPrLocalScripts(
  scripts,
  { runScript = runNpmScript, log = console.log, error = console.error } = {},
) {
  const progress = { completed: [], failedScript: null, failedExitCode: 0 };
  for (const script of scripts) {
    const code = runScript(script);
    if (code !== 0) {
      progress.failedScript = script;
      progress.failedExitCode = code;
      error(summarizePrLocalRun(scripts, progress));
      return code;
    }
    progress.completed.push(script);
  }
  log(summarizePrLocalRun(scripts, progress));
  return 0;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) {
    for (const entries of [
      [{ status: "M", file: "README.md" }],
      [{ status: "M", file: "AGENTS.md" }],
      [{ status: "M", file: "src/app/page.tsx" }],
    ])
      validateSelectedScripts(selectedScripts({ entries }));
    if (selectedScripts({ entries: [{ status: "M", file: "AGENTS.md" }] }).includes("check:ward-expected-reds"))
      throw new Error("policy-only scope broadened beyond its public contract");
    console.log("Ward PR-local verification plan self-test passed.");
    return;
  }
  let files;
  let base;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--files" || args[index] === "--base") {
      const option = args[index];
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
      if (option === "--files") files = value;
      else base = value;
    } else if (!["--dry-run", "--extended", "--json"].includes(args[index]))
      throw new Error(`Unknown option: ${args[index]}`);
  }
  const scope = readScope({ files, base });
  const scripts = selectedScripts(scope, args.includes("--extended"));
  validateSelectedScripts(scripts);
  if (args.includes("--json")) {
    console.log(JSON.stringify({ scope, scripts, executed: false }, null, 2));
    return;
  }
  console.log(`Ward scope: ${scope.reason}. Changed files: ${scope.files.join(", ") || "unknown/empty"}`);
  if (args.includes("--dry-run")) {
    for (const script of scripts) console.log(`- npm run ${script}`);
    console.log("Selected only; no checks executed and no provider evidence consulted.");
    return;
  }
  process.exitCode = runPrLocalScripts(scripts);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
