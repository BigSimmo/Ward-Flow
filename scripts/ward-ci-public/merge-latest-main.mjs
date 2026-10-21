/**
 * Merges the current tip of main into the pull request checkout before the production build, so
 * the phone script budget (`scripts/check-script-budget.mjs`) is measured on what would land now,
 * not on the merge ref GitHub computed when the run was queued.
 *
 * Main has no merge queue and the ruleset does not require branches to be up to date, so two PRs
 * that each fit the budget alone could otherwise land together over it. This step makes every
 * measurement current; `.github/workflows/ward-flow-budget-recheck.yml` re-runs it on armed PRs
 * whenever main moves. A conflict with main fails the build: the PR must merge main first.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Merges origin/main into the checkout at `cwd`. Returns { main, merged } or throws on a conflict. */
export function mergeLatestMain(cwd = process.cwd()) {
  const git = (...args) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("fetch", "--no-tags", "--quiet", "origin", "+refs/heads/main:refs/remotes/origin/main");
  const main = git("rev-parse", "refs/remotes/origin/main");
  const before = git("rev-parse", "HEAD");
  try {
    git(
      "-c",
      "user.name=Ward Flow CI",
      "-c",
      "user.email=ward-flow-ci@users.noreply.github.com",
      "merge",
      "--no-edit",
      "--no-ff",
      "--quiet",
      main,
    );
  } catch {
    throw new Error(`This pull request conflicts with main ${main}. Merge main into it, then push.`);
  }
  return { main, merged: git("rev-parse", "HEAD") !== before };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const { main, merged } = mergeLatestMain();
    console.log(
      merged
        ? `Measuring on this pull request merged with main ${main}.`
        : `Main ${main} is already in this checkout; measuring as is.`,
    );
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Script budget measured against main \`${main}\`.\n`);
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }
}
