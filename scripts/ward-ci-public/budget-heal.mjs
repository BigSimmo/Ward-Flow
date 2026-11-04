/**
 * Runs from `.github/workflows/ward-flow-budget-heal.yml` after a "Ward Flow CI" run on main fails.
 *
 * Main can still go over its phone script budget: two PRs that each fit can land together, or a PR
 * can merge without its build. When main's own build measured a route over budget, this opens one
 * pull request that raises only those routes to the measured size plus HEADROOM_KB, with its own
 * `docs/script-budget-history/YYYY-MM-DD-pr<N>-budget-heal.md` file. Any earlier open heal PR is
 * closed as superseded, so there is only ever one.
 *
 * The PR goes through the normal required checks. Events made with the workflow token start no
 * workflows, so it dispatches "Ward Flow CI", "Ward Flow bot-author policy" and "Ward Flow hold" on
 * the PR branch, which reports those checks on its head commit. It arms auto-merge only when every
 * raise is within AUTO_MERGE_MAX_KB (HOW-WE-WORK section 6: up to 5 KB a screen without asking);
 * a bigger raise waits for Josh. It never lowers a budget, bypasses a check or touches another PR.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const HEADROOM_KB = 1;
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

export function canAutoMerge(raises) {
  return raises.length > 0 && raises.every(({ from, to }) => to - from <= AUTO_MERGE_MAX_KB + 1e-9);
}

export function perthDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Perth" }).format(now);
}

export function historyEntry({ date, pr, raises, sha }) {
  const lines = raises.map(({ route, from, to, kb }) => `\`${route}\` ${from} to ${to} KB (main measured ${kb} KB)`);
  return `${date}, PR #${pr} (budget heal bot). Main ${sha.slice(0, 7)} went over its phone script budget, so the bot raised ${lines.join("; ")}. Each new limit is the measured size plus ${HEADROOM_KB} KB. The growth came from PRs that each fitted alone but landed together, or merged without a build. Lower these again in a size tidy.\n`;
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

  // One heal PR at a time: an older open one measured an older main, so it is superseded.
  const open = await api(`/pulls?state=open&base=main&per_page=100`);
  for (const pr of open.filter((item) => item.head?.ref?.startsWith(BRANCH_PREFIX) && item.head.ref !== branch)) {
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
  git("push", "--force", "origin", `HEAD:refs/heads/${branch}`);

  const existing = open.find((item) => item.head?.ref === branch);
  const pr =
    existing ??
    (await post(`/pulls`, {
      title: `Budget heal: raise phone script budget to main's measured size`,
      head: branch,
      base: "main",
      body: [
        `Main ${tip.slice(0, 7)} measured over its phone script budget in run of ${runSha.slice(0, 7)}, so every route below is raised to the measured size plus ${HEADROOM_KB} KB.`,
        "",
        ...raises.map(({ route, from, to, kb }) => `- \`${route}\`: ${from} KB to ${to} KB (measured ${kb} KB)`),
        "",
        canAutoMerge(raises)
          ? `Every raise is within ${AUTO_MERGE_MAX_KB} KB, so auto-merge is armed and it merges once the required checks pass.`
          : `A raise is over ${AUTO_MERGE_MAX_KB} KB, so this waits for Josh. Open PRs are not blocked meanwhile: their build fails only routes they grew.`,
        "",
        "Opened by `.github/workflows/ward-flow-budget-heal.yml`.",
      ].join("\n"),
    }));

  const history = `docs/script-budget-history/${perthDate()}-pr${pr.number}-budget-heal.md`;
  writeFileSync(history, historyEntry({ date: perthDate(), pr: pr.number, raises, sha: tip }));
  git("add", history);
  git("commit", "--quiet", "-m", `Record the budget heal in ${history}`);
  git("push", "origin", `HEAD:refs/heads/${branch}`);
  console.log(`Heal PR #${pr.number} on ${branch}.`);

  for (const workflow of DISPATCH) {
    const inputs = workflow === "ward-flow.yml" ? {} : { pr: String(pr.number) };
    await post(`/actions/workflows/${workflow}/dispatches`, { ref: branch, inputs });
  }

  if (canAutoMerge(raises)) {
    const query =
      "mutation($id: ID!) { enablePullRequestAutoMerge(input: { pullRequestId: $id, mergeMethod: MERGE }) { clientMutationId } }";
    const result = await post("https://api.github.com/graphql", { query, variables: { id: pr.node_id } });
    if (result?.errors?.length) console.log(`::warning::Auto-merge not armed: ${result.errors[0].message}`);
    else console.log("Auto-merge armed.");
  } else {
    await post(`/issues/${pr.number}/comments`, {
      body: `A raise is over ${AUTO_MERGE_MAX_KB} KB, so this heal is not armed. Josh: check the growth, then merge or close.`,
    });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(`::error::budget heal: ${error.message}`);
    process.exitCode = 1;
  });
}
