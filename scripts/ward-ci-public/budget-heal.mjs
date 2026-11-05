/**
 * Runs from `.github/workflows/ward-flow-budget-heal.yml` after a "Ward Flow CI" run on main fails.
 *
 * Main can still go over its phone script budget: two PRs that each fit can land together, or a PR
 * can merge without its build. When main's own build measured a route over budget, this opens one
 * held pull request proposing only those routes at the measured size plus HEADROOM_KB, with its own
 * `docs/script-budget-history/YYYY-MM-DD-pr<N>-budget-heal.md` file. An earlier unarmed, unheld heal
 * PR may be superseded; existing held or armed PRs are left to their owner.
 *
 * The PR goes through the normal required checks. Events made with the workflow token start no
 * workflows, so it dispatches "Ward Flow CI", "Ward Flow bot-author policy" and "Ward Flow hold" on
 * the PR branch, which reports those checks on its head commit. Measurement alone cannot establish
 * HOW-WE-WORK section 6's diagnosis and safe-trim prerequisites. Every new proposal is held for
 * that review; the bot never arms it or changes another PR's auto-merge state.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { listOpenPullRequests } from "./budget-recheck.mjs";

export const HEADROOM_KB = 0.2;
export const AUTO_MERGE_MAX_KB = 5;
export const BRANCH_PREFIX = "ward-flow-bot/script-budget-";
const DISPATCH = ["ward-flow.yml", "bot-author-policy.yml", "pr-hold.yml"];

const roundUp = (kb) => Math.ceil(kb * 10 - 1e-9) / 10;

/** Routes measured over their budget, with the raised limit. Never lowers or adds a route. */
export function planRaise(measured, budgets, headroom = HEADROOM_KB) {
  const raises = [];
  const next = { ...budgets };
  for (const [route, limit] of Object.entries(budgets)) {
    const kb = measured?.[route];
    if (typeof kb !== "number" || !Number.isFinite(kb) || kb <= limit) continue;
    const to = roundUp(kb + headroom);
    next[route] = to;
    raises.push({ route, from: limit, to, kb: Math.round(kb * 10) / 10 });
  }
  return { budgets: next, raises };
}

/** Size eligibility only: this does not establish the diagnosis or trim required to merge. */
export function canAutoMerge(raises) {
  return raises.length > 0 && raises.every(({ from, to }) => to - from <= AUTO_MERGE_MAX_KB + 1e-9);
}

export function perthDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Perth" }).format(now);
}

export function historyEntry({ date, pr, raises, sha }) {
  const lines = raises.map(({ route, from, to, kb }) => `\`${route}\` ${from} to ${to} KB (main measured ${kb} KB)`);
  return `${date}, PR #${pr} (budget heal bot). Main ${sha.slice(0, 7)} went over its phone script budget, so the bot proposes ${lines.join("; ")}. Each proposed limit is the measured size plus ${HEADROOM_KB} KB, rounded up to 0.1 KB. The cause is not yet established. This PR is held pending per-route growth diagnosis and an attempted safe trim; its owner must document that evidence before releasing the hold and arming auto-merge. Lower a limit again when the page shrinks.\n`;
}

async function main() {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, WARD_MEASURED: file, WARD_RUN_SHA: runSha } = process.env;
  if (!token || !repo || !file || !runSha)
    throw new Error("GITHUB_TOKEN, GITHUB_REPOSITORY, WARD_MEASURED and WARD_RUN_SHA are required");
  const api = async (path, init = {}) => {
    const response = await fetch(path.startsWith("https://") ? path : `https://api.github.com/repos/${repo}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", ...init.headers },
    });
    if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`);
    return response.status === 204 ? null : response.json();
  };
  const post = (path, body, method = "POST") =>
    api(path, { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();

  const { measured } = JSON.parse(readFileSync(file, "utf8"));
  const budgetFile = join(process.cwd(), "script-budget.json");
  const config = JSON.parse(readFileSync(budgetFile, "utf8"));
  const { budgets, raises } = planRaise(measured, config.budgets);
  if (raises.length === 0) {
    console.log("Main is within every phone script budget (or a later main already raised it). Nothing to heal.");
    return;
  }
  const tip = git("rev-parse", "HEAD");
  const branch = `${BRANCH_PREFIX}${tip.slice(0, 7)}`;

  // A re-run for the same main leaves its heal PR (and that PR's commits, labels and auto-merge)
  // alone rather than rewriting it.
  const open = await listOpenPullRequests(api);
  if (open.some((item) => item.head?.ref === branch)) {
    console.log(`Heal PR for main ${tip.slice(0, 7)} is already open on ${branch}. Leaving it as it is.`);
    return;
  }
  if (runSha !== tip)
    console.log(
      `::warning::Measured main ${runSha.slice(0, 7)}; main is now ${tip.slice(0, 7)}. The heal PR's own build re-measures it.`,
    );

  // Existing held or armed PRs belong to their owner, even when they measured an older main.
  const older = open.filter((item) => item.head?.ref?.startsWith(BRANCH_PREFIX));
  const protectedPr = older.find((item) => item.auto_merge || item.labels?.some((label) => label.name === "hold"));
  if (protectedPr) {
    console.log(`::warning::Heal PR #${protectedPr.number} is held or armed, so no new heal is opened.`);
    return;
  }
  for (const pr of older) {
    await post(`/issues/${pr.number}/comments`, {
      body: `Superseded by a newer budget heal for main ${tip.slice(0, 7)}.`,
    });
    await post(`/pulls/${pr.number}`, { state: "closed" }, "PATCH");
    console.log(`Closed superseded heal PR #${pr.number}.`);
  }

  git("config", "user.name", "github-actions[bot]");
  git("config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com");
  git("switch", "--force-create", branch);
  writeFileSync(budgetFile, `${JSON.stringify({ ...config, budgets }, null, 2)}\n`);
  git("add", "script-budget.json");
  git("commit", "--quiet", "-m", `Raise phone script budget to main's measured size (budget heal)`);
  // A branch of this name with no open PR is a closed heal's leftover, so replacing it loses nothing.
  git("push", "--force", "origin", `HEAD:refs/heads/${branch}`);

  const pr = await post(`/pulls`, {
    title: `Budget heal: review proposed phone script budget increase`,
    head: branch,
    base: "main",
    body: [
      `Main ${runSha.slice(0, 7)} measured over its phone script budget. This proposal sets each route below to the measured size plus ${HEADROOM_KB} KB, rounded up to 0.1 KB. This branch starts from main ${tip.slice(0, 7)}, and its own build re-measures it.`,
      "",
      ...raises.map(({ route, from, to, kb }) => `- \`${route}\`: ${from} KB to ${to} KB (measured ${kb} KB)`),
      "",
      canAutoMerge(raises)
        ? `Every raise is within the ${AUTO_MERGE_MAX_KB} KB size allowance. This is not approval to raise a limit.`
        : `A raise is over ${AUTO_MERGE_MAX_KB} KB, so Josh's explicit approval is also required.`,
      "",
      "Held for review: diagnose why each route grew and try an easy, safe trim first. Document the cause and trim attempt in this PR and its history entry before the owner removes hold and arms auto-merge. The bot cannot establish those prerequisites from size measurements alone and will not arm this proposal.",
      "Open PRs are not blocked meanwhile: their build fails only routes they grew.",
      "",
      "Opened by `.github/workflows/ward-flow-budget-heal.yml`.",
    ].join("\n"),
  });
  // Apply the required hold before any CI dispatch. A label failure stops this run rather than
  // leaving an automatically admitted budget increase; existing PRs returned above are untouched.
  await post(`/issues/${pr.number}/labels`, { labels: ["hold"] });

  const history = `docs/script-budget-history/${perthDate()}-pr${pr.number}-budget-heal.md`;
  writeFileSync(history, historyEntry({ date: perthDate(), pr: pr.number, raises, sha: runSha }));
  git("add", history);
  git("commit", "--quiet", "-m", `Record the budget heal in ${history}`);
  git("push", "origin", `HEAD:refs/heads/${branch}`);
  console.log(`Heal PR #${pr.number} on ${branch}.`);

  for (const workflow of DISPATCH) {
    const inputs = workflow === "ward-flow.yml" ? {} : { pr: String(pr.number) };
    await post(`/actions/workflows/${workflow}/dispatches`, { ref: branch, inputs });
  }

  console.log(
    "Budget proposal remains held for diagnosis and a safe-trim attempt; its owner decides when to release it.",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(`::error::budget heal: ${error.message}`);
    process.exitCode = 1;
  });
}
