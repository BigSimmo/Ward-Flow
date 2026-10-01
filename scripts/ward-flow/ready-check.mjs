#!/usr/bin/env node
// Ward Flow READY check: before writing READY, prove your branch merges cleanly onto what it will be
// folded with, that the merged result type-checks (Ward scope, clean), and that the unit tests
// related to the branch's changed files pass on it.
//
//   node scripts/ward-flow/ready-check.mjs [--branch <ref>] [--onto <ref>]
//
// --branch defaults to HEAD; --onto defaults to the ward line (use the steward's pre-built batch
// branch when there is one). Light git (merge-tree) finds clashes without touching any branch, index
// or worktree. The merged tree is then written to a temporary folder, with node_modules as a junction
// to this worktree's own installation, and tsc runs there on tsconfig.ward-gate.json (or
// tsconfig.typecheck.json if the merged tree has no Ward-scoped config). The folder is removed
// afterwards: the junction is unlinked first, so the installed dependencies are never touched.
// Then scripts/ward-flow/related-tests.mjs selects and runs the related tests inside that folder.
// Exit 0 = clean merge, no type errors, related tests pass; 1 = any of those fails; 2 = setup problem.
// It is a narrow run: run it through run-slot (narrow) when the PC is busy.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, lstatSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { selectFoldGate } from "./select-fold-gate.mjs";

try {
  const remote = execFileSync("git", ["remote"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  if (remote) {
    console.error("The local Ward line ready check is retired in a linked repository.");
    process.exit(2);
  }
} catch {
  console.error("Cannot verify repository remotes. Refusing the retired local Ward workflow.");
  process.exit(2);
}

const LINE = "main";
const TSC_CACHE_DIR = process.env.WARD_TSC_CACHE_DIR ?? "D:/Repos/ward-flow-logs/tsc-cache";
const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const git = (argv, options = {}) =>
  execFileSync("git", argv, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], ...options }).trim();

const branch = git(["rev-parse", opt("--branch", "HEAD")]);
const onto = git(["rev-parse", opt("--onto", LINE)]);
const merged = spawnSync("git", ["merge-tree", "--write-tree", "--name-only", onto, branch], { encoding: "utf8" });
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
console.log(`ready-check: ${plan.tier} gate (${plan.reason}).`);
if (plan.tier === "static" || plan.tier === "none") {
  console.log("ready-check: PASSED. Static checks for changed documentation remain due at fold.");
  process.exit(0);
}

const projectRoot = path.resolve(git(["rev-parse", "--show-toplevel"]));
const NODE_MODULES = path.join(projectRoot, "node_modules");
let installedDependencies;
try {
  installedDependencies = realpathSync(NODE_MODULES);
} catch {
  console.error("ready-check: install dependencies in this worktree before running executable checks.");
  process.exit(2);
}
const relativeDependencies = path.relative(projectRoot, installedDependencies);
if (relativeDependencies.startsWith("..") || path.isAbsolute(relativeDependencies)) {
  console.error("ready-check: node_modules resolves outside this worktree; refusing a cross-checkout dependency link.");
  process.exit(2);
}

// Scratch stays outside the protected Worktrees tree. Only this process-owned folder is removed.
const folder = mkdtempSync(path.join("D:\\Temp", "ward-ready-check-"));
const unlinkModules = () => {
  const link = path.join(folder, "node_modules");
  try {
    if (lstatSync(link).isSymbolicLink()) execFileSync("cmd", ["/c", "rmdir", link]);
  } catch {
    // not there
  }
  if (existsSync(link)) throw new Error("node_modules link still present; not removing the folder");
};
let code = 0;
try {
  // No shell pipe: under cmd the first `tar` on PATH can be Git's MSYS tar, which reads "D:\..." as a
  // remote host and refuses (26 September). Windows' own bsdtar takes the archive on stdin instead.
  const archive = execFileSync("git", ["archive", "--format=tar", tree], { maxBuffer: 2 * 1024 ** 3 });
  const systemTar = path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
  execFileSync(systemTar, ["-x", "-C", folder], { input: archive, stdio: ["pipe", "ignore", "inherit"] });
  execFileSync("cmd", ["/c", "mklink", "/J", path.join(folder, "node_modules"), NODE_MODULES], { stdio: "ignore" });
  if (plan.typecheck) {
    const config = existsSync(path.join(folder, "tsconfig.ward-gate.json"))
      ? "tsconfig.ward-gate.json"
      : "tsconfig.typecheck.json";
    // Seeded incremental check (gate speed-up, Josh 26 September): copy in gate-tsc's cache from the
    // line's last passing run, read only, never written back. TypeScript compares every file's content
    // hash with the seed, so a stale seed costs only cache misses, never a missed error.
    const buildInfo = path.join(folder, "ready-check.tsbuildinfo");
    const seed = path.join(
      TSC_CACHE_DIR,
      config === "tsconfig.ward-gate.json" ? "latest-ward.tsbuildinfo" : "latest.tsbuildinfo",
    );
    const seeded = existsSync(seed);
    if (seeded) copyFileSync(seed, buildInfo);
    console.log(
      `ready-check: type-checking the merged result (${config}, ${seeded ? "seeded incremental" : "clean"})...`,
    );
    const started = Date.now();
    const tsc = spawnSync(
      process.execPath,
      [
        path.join(folder, "node_modules", "typescript", "bin", "tsc"),
        "-p",
        config,
        "--noEmit",
        "--incremental",
        "--tsBuildInfoFile",
        buildInfo,
      ],
      { cwd: folder, encoding: "utf8" },
    );
    const errors = `${tsc.stdout}${tsc.stderr}`.split("\n").filter((line) => line.includes("error TS"));
    code = tsc.status === 0 ? 0 : 1;
    console.log(
      `ready-check: tsc exit ${tsc.status} in ${Math.round((Date.now() - started) / 1000)}s, ${errors.length} error(s).`,
    );
    for (const line of errors.slice(0, 30)) console.log(`  ${line}`);
  } else {
    console.log("ready-check: type check not needed for this change class.");
  }
  if (code !== 0) {
    console.log("ready-check: related tests not run because type checking failed. Fix that failure first.");
  } else {
    // The unit tests related to the branch's changed files, run on the merged tree (Josh, 26
    // September: tonight's bed-release reds were only caught by the full gate, 40 minutes later).
    console.log("ready-check: running the related unit tests on the merged result...");
    const related = spawnSync(
      process.execPath,
      [
        path.join(path.dirname(fileURLToPath(import.meta.url)), "related-tests.mjs"),
        "--base",
        onto,
        "--head",
        branch,
        "--root",
        folder,
      ],
      { stdio: "inherit" },
    );
    console.log(`ready-check: related tests exit ${related.status}.`);
    if (related.status !== 0) code = 1;
    if (plan.tier === "focused" && !existsSync(path.join(folder, "related-tests-report.json"))) {
      console.log("ready-check: no focused test report; executable work needs a related contract or FULL gate.");
      code = 1;
    }
  }
} finally {
  unlinkModules();
  rmSync(folder, { recursive: true, force: true });
}
console.log(
  code === 0 ? "ready-check: PASSED. You may write READY." : "ready-check: FAILED. Fix before writing READY.",
);
process.exit(code);
