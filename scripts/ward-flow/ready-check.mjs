#!/usr/bin/env node
// Legacy merged-snapshot compatibility checks for static/policy/backend scope only.
// Broad READY approval is retired in the public repository: use npm run verify:pr-local
// for the selected normal local readiness stage. This helper never approves a queued READY.
// Defaults: --branch HEAD --onto origin/main. Exit0 selected compatibility checks;1 failure;75 retired broad route.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import os from "node:os";
import { acquireHeavyRunLock } from "../test-run-lock.mjs";
import { runOwnedChild } from "../owned-child.mjs";
import { offlineTestEnvironment } from "../test-environment.mjs";
import { removePathSync } from "../retryable-fs.mjs";
import { validatePolicyReport } from "./full-gate-recheck.mjs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { selectFoldGate } from "./select-fold-gate.mjs";

// A hook's inherited index/repository controls must never redirect snapshot writes.
const cleanGitEnvironment = { ...process.env };
for (const name of Object.keys(cleanGitEnvironment))
  if (name.toUpperCase().startsWith("GIT_")) delete cleanGitEnvironment[name];
const localGitControls = execFileSync("git", ["rev-parse", "--local-env-vars"], {
  encoding: "utf8",
  env: cleanGitEnvironment,
})
  .trim()
  .split(/\r?\n/u);
const localGitControlNames = new Set(localGitControls.map((name) => name.toUpperCase()));
if (Object.keys(process.env).some((name) => localGitControlNames.has(name.toUpperCase()))) {
  console.error(
    "Refusing readiness with inherited repository-local Git controls. Run from the verified checkout directly.",
  );
  process.exit(2);
}

let linkedRepository = false;
try {
  const remotes = execFileSync("git", ["remote"], {
    encoding: "utf8",
    env: cleanGitEnvironment,
    stdio: ["ignore", "pipe", "pipe"],
  })
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!remotes.length && process.env.WARD_FOLD_TEST_FIXTURE !== "1") throw new Error("Missing repository destination");
  for (const remote of remotes) {
    for (const push of [false, true]) {
      const args = ["remote", "get-url", "--all", ...(push ? ["--push"] : []), remote];
      const urls = execFileSync("git", args, {
        encoding: "utf8",
        env: cleanGitEnvironment,
        stdio: ["ignore", "pipe", "pipe"],
      })
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (
        !urls.length ||
        urls.some(
          (url) =>
            !/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)BigSimmo\/Ward-Flow(?:\.git)?\/?$/i.test(
              url,
            ),
        )
      )
        throw new Error("Foreign or missing repository destination");
    }
  }
  linkedRepository = remotes.length > 0;
} catch {
  console.error("Cannot verify Ward Flow fetch and push destinations. Refusing readiness check.");
  process.exit(2);
}

const LINE = linkedRepository ? "origin/main" : "main";

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const git = (argv, options = {}) =>
  execFileSync("git", argv, {
    encoding: "utf8",
    env: cleanGitEnvironment,
    stdio: ["ignore", "pipe", "ignore"],
    ...options,
  }).trim();

const branch = git(["rev-parse", opt("--branch", "HEAD")]);
const onto = git(["rev-parse", opt("--onto", LINE)]);
const merged = spawnSync("git", ["merge-tree", "--write-tree", "--name-only", onto, branch], {
  encoding: "utf8",
  env: cleanGitEnvironment,
});
const [tree, ...rest] = merged.stdout.trim().split("\n");
if (merged.status !== 0) {
  console.log(`ready-check: CLASH merging ${branch.slice(0, 10)} onto ${onto.slice(0, 10)}:`);
  for (const line of rest.filter(Boolean).slice(0, 20)) console.log(`  ${line}`);
  process.exit(1);
}
console.log(
  `ready-check: ${branch.slice(0, 10)} merges cleanly onto ${onto.slice(0, 10)} (tree ${tree.slice(0, 10)}).`,
);
const changes = git(["diff", "--name-status", `${onto}...${branch}`])
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [status, ...files] = line.split("\t");
    return { status, path: files.at(-1) };
  });
const plan = selectFoldGate(changes);
console.log(`ready-check: selected ${plan.tier} gate (${plan.reason}) on merged tree ${tree}.`);
if (plan.tier === "full") {
  console.error(
    "ready-check: RETIRED broad READY route (75). Related tests cannot satisfy it. This compatibility helper accepts no later FULL/browser receipt and gives no source-code or queued READY approval.",
  );
  console.error(
    "Use npm run verify:pr-local for the selected normal local readiness stage in BigSimmo/Ward-Flow. Its local evidence does not approve a queued READY, publication or deployment.",
  );
  process.exit(75);
}
const projectRoot = path.resolve(git(["rev-parse", "--show-toplevel"]));
const NODE_MODULES = path.join(projectRoot, "node_modules");
if (plan.installation) {
  const dependencies = realpathSync(NODE_MODULES);
  const relativeDependencies = path.relative(projectRoot, dependencies);
  if (relativeDependencies.startsWith("..") || path.isAbsolute(relativeDependencies))
    throw new Error("Ready dependencies must belong to this Ward Flow checkout");
}
// The backend has its own lockfile and install; its tests import packages that the root manifest
// does not list, so the snapshot needs that tree too. Fail closed rather than report a false red.
const BACKEND_MODULES = path.join(projectRoot, "backend/ward-flow/node_modules");
if (plan.backend) {
  if (!existsSync(BACKEND_MODULES))
    throw new Error("Backend dependencies are missing: run npm ci in backend/ward-flow before the ready check");
  const relativeBackend = path.relative(projectRoot, realpathSync(BACKEND_MODULES));
  if (relativeBackend.startsWith("..") || path.isAbsolute(relativeBackend))
    throw new Error("Backend dependencies must belong to this Ward Flow checkout");
}
const admission = acquireHeavyRunLock({
  projectRoot,
  mode: "exclusive",
  command: "ready-check merged policy/static snapshot",
});
const folder = mkdtempSync(path.join(os.tmpdir(), "ward-ready-check-"));
const unlinkModules = () => {
  for (const link of [path.join(folder, "node_modules"), path.join(folder, "backend/ward-flow/node_modules")]) {
    if (existsSync(link) && lstatSync(link).isSymbolicLink()) execFileSync("cmd.exe", ["/c", "rmdir", link]);
    if (existsSync(link)) throw new Error("Dependency junction remains; refusing recursive cleanup");
  }
};
let code = 0;
const snapshotEnvironment = offlineTestEnvironment(admission.environment);
for (const name of Object.keys(snapshotEnvironment))
  if (name.toUpperCase().startsWith("GIT_")) delete snapshotEnvironment[name];
try {
  const archive = execFileSync("git", ["archive", "--format=tar", tree], {
    env: cleanGitEnvironment,
    maxBuffer: 2 * 1024 ** 3,
  });
  const systemTar = path.join(process.env.SystemRoot ?? "C:/Windows", "System32/tar.exe");
  execFileSync(systemTar, ["-x", "-C", folder], { input: archive, stdio: ["pipe", "ignore", "inherit"] });
  // Contracts create private repositories from the reviewed history. Supply an
  // isolated index/object store for this exact merged tree; never share writable
  // metadata, branches or the original checkout's index with the snapshot.
  const objects = path.join(git(["rev-parse", "--path-format=absolute", "--git-common-dir"]), "objects");
  const snapshotGit = (...arguments_) =>
    execFileSync("git", ["--git-dir", path.join(folder, ".git"), "--work-tree", folder, ...arguments_], {
      cwd: folder,
      env: snapshotEnvironment,
    });
  snapshotGit("init", "--quiet", "-b", "merged-snapshot");
  mkdirSync(path.join(folder, ".git", "objects", "info"), { recursive: true });
  writeFileSync(path.join(folder, ".git", "objects", "info", "alternates"), `${objects.replaceAll("\\", "/")}\n`);
  snapshotGit("read-tree", tree);
  if (plan.installation)
    execFileSync("cmd.exe", ["/c", "mklink", "/J", path.join(folder, "node_modules"), NODE_MODULES], {
      stdio: "ignore",
    });
  if (plan.backend)
    execFileSync(
      "cmd.exe",
      ["/c", "mklink", "/J", path.join(folder, "backend/ward-flow/node_modules"), BACKEND_MODULES],
      {
        stdio: "ignore",
      },
    );
  const run = async (script, arguments_ = []) => {
    const result = await runOwnedChild(process.execPath, [path.join(folder, script), ...arguments_], {
      cwd: folder,
      env: snapshotEnvironment,
    });
    if (result.status !== 0 || result.signal || result.error) code = 1;
  };
  if (plan.installation) await run("scripts/check-installed-lock-parity.mjs");
  if (code === 0) await run("scripts/check-docs-script-refs.mjs");
  if (code === 0) await run("scripts/ward-flow/check-doc-links.mjs");
  if (code === 0 && plan.backend) {
    const result = await runOwnedChild(
      process.execPath,
      ["--test", path.join(folder, "backend/ward-flow/backend.test.mjs")],
      { cwd: folder, env: snapshotEnvironment },
    );
    if (result.status !== 0 || result.signal || result.error) code = 1;
  }
  if (code === 0 && plan.policy) {
    const { policyContractTests } = await import(
      pathToFileURL(path.join(folder, "scripts/ward-ci-public/plan.mjs")).href
    );
    const reportPath = path.join(folder, "ready-policy-report.json");
    const result = await runOwnedChild(
      process.execPath,
      [
        path.join(folder, "node_modules/vitest/vitest.mjs"),
        "run",
        ...policyContractTests,
        "--reporter=json",
        `--outputFile=${reportPath}`,
      ],
      { cwd: folder, env: snapshotEnvironment },
    );
    const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) : null;
    const completeness = validatePolicyReport(report, policyContractTests, folder);
    if (result.status !== 0 || result.signal || result.error || !completeness.valid || completeness.failing.length)
      code = 1;
  }
} finally {
  unlinkModules();
  removePathSync(folder, { recursive: true });
  admission.release();
}
console.log(
  code === 0
    ? `ready-check: PASSED selected ${plan.policy ? "policy contracts and static" : "static"} compatibility checks on merged tree ${tree}. No source-code, browser or queued READY approval is claimed.`
    : "ready-check: FAILED selected merged-snapshot checks; no READY approval.",
);
process.exitCode = code;
