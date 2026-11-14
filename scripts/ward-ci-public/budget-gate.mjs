/**
 * The phone script budget step of "Ward Flow production build" (`.github/workflows/ward-flow.yml`).
 *
 * It measures the built app with `scripts/check-script-budget.mjs --write`. On main (and manual runs)
 * an over-budget route fails the step exactly as before, and the measurements are saved for the
 * budget over workflow (`ward-flow-budget-heal.yml`), which opens an issue asking for a trim.
 *
 * On a pull request the build is already this PR merged with the latest main
 * (`merge-latest-main.mjs`). When that is over budget, this builds and measures main alone in a
 * separate worktree and fails only the routes this PR grew (`judgeAgainstMain`). Before 4 November
 * 2026 one over-budget merge to main failed every open PR's required build until someone raised the
 * budget by hand. A PR that pushes a route over, or grows an already-over route by more than
 * MAIN_TOLERANCE_KB, still fails. In the merge queue the checkout is already the group head, so it is
 * judged the same way against the group's base (WARD_BUDGET_MAIN_SHA = merge_group.base_sha). The extra build runs only when the merged result is over budget,
 * and never for a PR that changes package.json, package-lock.json or .nvmrc (judged strictly).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const OVER_BUDGET = 2;

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, stdio: "inherit", env: process.env }).status ?? 1;
}

// Always this checkout's measuring script: main's own copy may predate `--write`. It reads
// script-budget.json and starts the built app from `cwd`.
const MEASURE = join(import.meta.dirname, "../check-script-budget.mjs");

function measure(cwd, out) {
  return run(process.execPath, [MEASURE, "--write", out], cwd);
}

/**
 * Checks `mainSha` out in its own worktree at `tree`, reusing this checkout's installed packages.
 *
 * It deliberately does NOT copy this checkout's `.next/cache`. Webpack's saved cache records absolute
 * paths, so a copied cache made Next resolve `src/instrumentation-client.ts` in this checkout instead
 * of the worktree, outside the TypeScript loader. Main alone then never built ("Module parse failed:
 * Unexpected token" at `declare const __WARD_RELEASE__`), and every over-budget route failed (audit
 * Deep-DP5-6, 14 November 2026). It also meant a PR's own source could leak into the "main" figures.
 * A cold build is slower but measures only main.
 */
export function prepareMainTree(root, mainSha, tree) {
  execFileSync("git", ["worktree", "add", "--detach", "--force", tree, mainSha], { cwd: root, stdio: "inherit" });
  symlinkSync(join(root, "node_modules"), join(tree, "node_modules"), "dir");
}

/** Builds and measures `mainSha` in its own worktree. Returns the measurement file, or undefined. */
function measureMain(root, mainSha, outDir) {
  const tree = join(outDir, "main-tree");
  try {
    prepareMainTree(root, mainSha, tree);
    const built = run(
      process.execPath,
      ["--max-old-space-size=8192", "node_modules/next/dist/bin/next", "build", "--webpack"],
      tree,
    );
    if (built !== 0) {
      console.error(
        "::error title=Ward budget main build failed::Main alone did not build, so it cannot be compared. Every over-budget route is judged without main figures.",
      );
      return undefined;
    }
    const file = join(outDir, "main.json");
    const status = measure(tree, file);
    return (status === 0 || status === OVER_BUDGET) && existsSync(file) ? file : undefined;
  } catch (error) {
    console.error(`::error title=Ward budget main build failed::Main alone could not be measured: ${error.message}`);
    return undefined;
  }
}

/**
 * Main's own push run already measured this exact commit when main was over budget, so reuse its
 * saved `script-budget-measured` artifact (main-measured.mjs) instead of a second production build.
 * Returns the file, or undefined to fall back to building main.
 */
function savedMain(root, mainSha, outDir) {
  const file = join(outDir, "main.json");
  const status = run(process.execPath, [join(import.meta.dirname, "main-measured.mjs"), mainSha, file], root);
  return status === 0 && existsSync(file) ? file : undefined;
}

/** @param {{root?:string,event?:string,outDir?:string}} [options] */
export function gate({ root = process.cwd(), event = process.env.GITHUB_EVENT_NAME, outDir } = {}) {
  const dir = resolve(outDir ?? join(process.env.RUNNER_TEMP ?? root, "script-budget"));
  mkdirSync(dir, { recursive: true });
  const merged = join(dir, "measured.json");
  const status = measure(root, merged);
  // Inherited-overage PR warnings may pass the comparative judgement below, but only
  // a strictly compliant measurement can supply reusable main acceptance evidence.
  if (status === 0) {
    const tree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { cwd: root, encoding: "utf8" }).trim();
    if (!/^[0-9a-f]{40}$/u.test(tree)) throw new Error("Strict budget measurement has no valid tree identity");
    console.log(`::notice title=Ward strict budget tree::${tree}`);
  }
  if (status !== OVER_BUDGET || (event !== "pull_request" && event !== "merge_group")) return status;
  const mainRef = (event === "merge_group" && process.env.WARD_BUDGET_MAIN_SHA) || "refs/remotes/origin/main";
  const mainSha = execFileSync("git", ["rev-parse", mainRef], { cwd: root, encoding: "utf8" }).trim();
  console.log(`Over budget merged with main ${mainSha}. Measuring main alone to see whose growth it is.`);
  // Main alone reuses this checkout's installed packages, which are only main's when the
  // dependency inputs match. A PR that changes them is judged strictly, as before.
  const sameDependencies =
    spawnSync("git", ["diff", "--quiet", mainSha, "HEAD", "--", "package.json", "package-lock.json", ".nvmrc"], {
      cwd: root,
    }).status === 0;
  if (!sameDependencies) console.error("This PR changes dependencies, so main alone cannot be measured fairly here.");
  const mainFile = sameDependencies ? (savedMain(root, mainSha, dir) ?? measureMain(root, mainSha, dir)) : undefined;
  const args = [join(root, "scripts/check-script-budget.mjs"), "--judge", merged];
  if (mainFile) args.push(mainFile);
  return run(process.execPath, args, root);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    process.exitCode = gate();
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
