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
  "docs:check-links",
  "docs:check-index",
  "docs:check-inventory",
];

// Default (lean) plan, Josh 31 Oct 2026 ("no excessive testing, roll PRs out rapidly"): a lane checks
// what its diff touches and leaves the whole-suite gates to hosted CI, which runs every one of them on
// each pull request into main and blocks the merge through "Ward Flow required". So the default plan
// runs the affected unit tests (`test:related`) and the backend typecheck, and `--full` adds the full
// unit suite with its expected-reds comparison, the PostgreSQL backend tests, the production build
// and the browser journeys. Use `--full` when hosted CI cannot see the branch (a PR into another PR's
// branch gets none) and the work will not reach a CI-checked PR first, or when asked.
// `--extended` is still accepted (callers pass it) and does not change the plan.
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for call-site compatibility
export function selectedScripts(scope, _extended = false, { full = false } = {}) {
  const plan = Array.isArray(scope.entries) ? classifyChanges(scope.entries) : scope;
  const scripts = [...common];
  if (plan.full) scripts.push("check:installed-lock-parity");
  if (plan.policy) scripts.push("check:ward-policy-contracts");
  if (plan.backend) scripts.push("typecheck:backend");
  if (plan.backend && full) scripts.push("test:backend");
  if (plan.frontend_static) scripts.push("lint", "typecheck");
  if (plan.unit) scripts.push(full ? "check:ward-expected-reds" : "test:related");
  if (plan.build && full) scripts.push("build");
  if (plan.browser && full) scripts.push("test:e2e:ward-journeys");
  return [...new Set(scripts)];
}

/** Gates the lean plan leaves to hosted CI for this scope; empty under `--full`. */
export function deferredToHostedCi(scope, { full = false } = {}) {
  if (full) return [];
  const plan = Array.isArray(scope.entries) ? classifyChanges(scope.entries) : scope;
  return [
    ...(plan.unit ? ["full unit suite (check:ward-expected-reds)"] : []),
    ...(plan.backend ? ["PostgreSQL backend tests (test:backend)"] : []),
    ...(plan.build ? ["production build (build)"] : []),
    ...(plan.browser ? ["browser journeys (test:e2e:ward-journeys)"] : []),
  ];
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

function runNpmScript(script, forwarded = []) {
  const suffix = forwarded.length ? ` -- ${forwarded.join(" ")}` : "";
  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", `npm run ${script}${suffix}`], { cwd: root, stdio: "inherit" })
      : spawnSync("npm", ["run", script, ...(forwarded.length ? ["--", ...forwarded] : [])], {
          cwd: root,
          stdio: "inherit",
        });
  return childProcessExitCode(result);
}

/** @param {string[]} scripts @param {{completed?:string[],failedScript?:string|null,failedExitCode?:number,deferred?:string[]}} [progress] */
export function summarizePrLocalRun(
  scripts,
  { completed = [], failedScript = null, failedExitCode = 0, deferred = [] } = {},
) {
  const notReached = scripts.filter((script) => !completed.includes(script) && script !== failedScript);
  return [
    "PR-local verification summary:",
    `- completed: ${completed.join(", ") || "(none)"}`,
    `- failed: ${failedScript ? `${failedScript} (exit ${failedExitCode})` : "(none)"}`,
    `- not reached: ${notReached.join(", ") || "(none)"}`,
    ...(scripts.includes("test:backend") && !completed.includes("test:backend")
      ? ["Backend PostgreSQL integration: NOT RUN to completion; no passing database evidence."]
      : []),
    ...(deferred.length ? [`- left to hosted CI (not run here; --full runs them): ${deferred.join(", ")}`] : []),
    "Local selected evidence does not establish hosted CI, publication or deployment.",
  ].join("\n");
}

export function runPrLocalScripts(
  scripts,
  { runScript = runNpmScript, log = console.log, error = console.error, deferred = [], base } = {},
) {
  const progress = { completed: [], failedScript: null, failedExitCode: 0, deferred };
  for (const script of scripts) {
    const code = runScript(script, script === "test:related" && base ? ["--base", base] : []);
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
      for (const full of [false, true]) validateSelectedScripts(selectedScripts({ entries }, false, { full }));
    const policyOnly = { entries: [{ status: "M", file: "AGENTS.md" }] };
    if (
      selectedScripts(policyOnly, false, { full: true }).includes("check:ward-expected-reds") ||
      selectedScripts(policyOnly).includes("test:related")
    )
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
    } else if (!["--dry-run", "--extended", "--full", "--json"].includes(args[index]))
      throw new Error(`Unknown option: ${args[index]}`);
  }
  const scope = readScope({ files, base });
  const full = args.includes("--full");
  const scripts = selectedScripts(scope, args.includes("--extended"), { full });
  const deferred = deferredToHostedCi(scope, { full });
  validateSelectedScripts(scripts);
  if (args.includes("--json")) {
    console.log(JSON.stringify({ scope, scripts, deferred, executed: false }, null, 2));
    return;
  }
  console.log(`Ward scope: ${scope.reason}. Changed files: ${scope.files.join(", ") || "unknown/empty"}`);
  if (args.includes("--dry-run")) {
    for (const script of scripts) console.log(`- npm run ${script}`);
    if (deferred.length) console.log(`Left to hosted CI (add --full to run here): ${deferred.join(", ")}`);
    console.log("Selected only; no checks executed and no provider evidence consulted.");
    return;
  }
  process.exitCode = runPrLocalScripts(scripts, { deferred, base });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
