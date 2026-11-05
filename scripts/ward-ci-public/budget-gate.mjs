/**
 * The phone script budget step of "Ward Flow production build" (`.github/workflows/ward-flow.yml`).
 *
 * It measures the built app with `scripts/check-script-budget.mjs --write`. On main (and manual runs)
 * an over-budget route fails the step exactly as before, and the measurements are saved for the
 * budget heal workflow (`ward-flow-budget-heal.yml`), which opens a PR raising the budget.
 *
 * On a pull request the build is already this PR merged with the latest main
 * (`merge-latest-main.mjs`). When that is over budget, this builds and measures main alone in a
 * separate worktree and fails only the routes this PR grew (`judgeAgainstMain`). Before 4 November
 * 2026 one over-budget merge to main failed every open PR's required build until someone raised the
 * budget by hand. A PR that pushes a route over, or grows an already-over route by more than
 * MAIN_TOLERANCE_KB, still fails. The extra build runs only when the merged result is over budget,
 * and never for a PR that changes package.json, package-lock.json or .nvmrc (judged strictly).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, symlinkSync } from "node:fs";
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

/** Builds and measures `mainSha` in its own worktree. Returns the measurement file, or undefined. */
function measureMain(root, mainSha, outDir) {
  const tree = join(outDir, "main-tree");
  try {
    execFileSync("git", ["worktree", "add", "--detach", "--force", tree, mainSha], { cwd: root, stdio: "inherit" });
    symlinkSync(join(root, "node_modules"), join(tree, "node_modules"), "dir");
    // A warm Next cache from the merged build cuts main's build to a few minutes.
    if (existsSync(join(root, ".next/cache")))
      cpSync(join(root, ".next/cache"), join(tree, ".next/cache"), { recursive: true });
    const built = run(
      process.execPath,
      ["--max-old-space-size=8192", "node_modules/next/dist/bin/next", "build", "--webpack"],
      tree,
    );
    if (built !== 0) {
      console.error("Main alone did not build, so it cannot be compared.");
      return undefined;
    }
    const file = join(outDir, "main.json");
    const status = measure(tree, file);
    return (status === 0 || status === OVER_BUDGET) && existsSync(file) ? file : undefined;
  } catch (error) {
    console.error(`Main alone could not be measured: ${error.message}`);
    return undefined;
  }
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
  if (status !== OVER_BUDGET || event !== "pull_request") return status;
  const mainSha = execFileSync("git", ["rev-parse", "refs/remotes/origin/main"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  console.log(`Over budget merged with main ${mainSha}. Measuring main alone to see whose growth it is.`);
  // Main alone reuses this checkout's installed packages, which are only main's when the
  // dependency inputs match. A PR that changes them is judged strictly, as before.
  const sameDependencies =
    spawnSync("git", ["diff", "--quiet", mainSha, "HEAD", "--", "package.json", "package-lock.json", ".nvmrc"], {
      cwd: root,
    }).status === 0;
  if (!sameDependencies) console.error("This PR changes dependencies, so main alone cannot be measured fairly here.");
  const mainFile = sameDependencies ? measureMain(root, mainSha, dir) : undefined;
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
