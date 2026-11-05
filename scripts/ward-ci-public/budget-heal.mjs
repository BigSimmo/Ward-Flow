/**
 * Runs from `.github/workflows/ward-flow-budget-heal.yml` after a "Ward Flow CI" run on main fails.
 *
 * Main can still go over its phone script budget: two PRs that each fit can land together, or a PR
 * can merge without its build. When main's own build measured a route over budget, this opens one
 * issue asking for a trim, or refreshes the one already open. It never raises a budget: a person
 * decides any raise (Josh, 5 November 2026, bird's eye review item 6). Before that it opened a PR
 * raising the limit to the measured size, which made the budget a one-way ratchet.
 *
 * Fair blame is unchanged: while main is over, an open PR's build fails only routes that PR grew
 * (`budget-gate.mjs`), so nobody is blocked while the trim waits. The issue body is rewritten with
 * main's latest measurements on every failing main run; a comment is added only when a route newly
 * goes over or grows past the last report, so a run of failing main pushes does not spam it.
 * It reads and writes issues only. It never touches a branch, a pull request or script-budget.json.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const ISSUE_TITLE = "Phone script budget: main is over, trim needed";
export const ISSUE_LABEL = "script-budget";
const MARKER = "ward-flow-budget-over";
/** Growth past the last report that earns a new comment. Matches budget-gate's build noise. */
export const NOTIFY_GROWTH_KB = 1.5;

const round = (kb) => Math.round(kb * 10) / 10;

/** Routes main measured over their budget. Never changes a budget. */
export function overBudget(measured, budgets) {
  const over = [];
  for (const [route, limit] of Object.entries(budgets)) {
    const kb = measured?.[route];
    if (typeof kb !== "number" || !Number.isFinite(kb) || kb <= limit) continue;
    over.push({ route, limit, kb: round(kb), by: round(kb - limit) });
  }
  return over;
}

/** The routes in `over` that the last report did not show, or that grew past it by NOTIFY_GROWTH_KB. */
export function newlyWorse(over, previous = []) {
  const before = new Map(previous.map(({ route, kb }) => [route, kb]));
  return over.filter(({ route, kb }) => !before.has(route) || kb - before.get(route) > NOTIFY_GROWTH_KB);
}

/** Reads the measurements a previous run embedded in the issue body. */
export function readReport(body = "") {
  const match = body.match(new RegExp(`<!-- ${MARKER} (\\[.*?\\]) -->`));
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

export function issueBody({ over, sha, runUrl }) {
  return [
    `Main ${sha.slice(0, 7)} measured over its phone first-load script budget (\`script-budget.json\`).`,
    "",
    ...over.map(({ route, limit, kb, by }) => `- \`${route}\`: ${kb} KB gzipped against ${limit} KB (${by} KB over)`),
    "",
    "**Ask:** trim these routes back under their limit. Start with the bundle analysis steps in",
    "`docs/ward-flow/PUBLIC-CI.md#phone-script-budget-on-a-moving-main`. If a raise is truly needed,",
    "a person decides it in a PR with its own `docs/script-budget-history/` file. This bot never raises",
    "a budget.",
    "",
    "Open PRs are not blocked meanwhile: their build fails only routes they grew (`budget-gate.mjs`).",
    "This issue is rewritten on each failing main run. Close it once main is back within budget.",
    "",
    runUrl ? `Latest measuring run: ${runUrl}` : "",
    `<!-- ${MARKER} ${JSON.stringify(over.map(({ route, kb }) => ({ route, kb })))} -->`,
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");
}

async function main() {
  const {
    GITHUB_TOKEN: token,
    GITHUB_REPOSITORY: repo,
    WARD_MEASURED: file,
    WARD_RUN_SHA: runSha,
    WARD_RUN_URL: runUrl,
  } = process.env;
  if (!token || !repo || !file || !runSha)
    throw new Error("GITHUB_TOKEN, GITHUB_REPOSITORY, WARD_MEASURED and WARD_RUN_SHA are required");
  const api = async (path, init = {}) => {
    const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", ...init.headers },
    });
    if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`);
    return response.status === 204 ? null : response.json();
  };
  const send = (path, body, method = "POST") =>
    api(path, { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });

  const { measured } = JSON.parse(readFileSync(file, "utf8"));
  const { budgets } = JSON.parse(readFileSync(join(process.cwd(), "script-budget.json"), "utf8"));
  const over = overBudget(measured, budgets);
  if (over.length === 0) {
    console.log("Main is within every phone script budget. Nothing to report.");
    return;
  }
  for (const { route, kb, limit } of over) console.log(`::warning::${route} is ${kb} KB against ${limit} KB on main.`);

  const body = issueBody({ over, sha: runSha, runUrl });
  const open = await api(`/issues?state=open&creator=${encodeURIComponent("github-actions[bot]")}&per_page=100`);
  const existing = open.find((item) => !item.pull_request && item.title === ISSUE_TITLE);
  if (!existing) {
    const issue = await send(`/issues`, { title: ISSUE_TITLE, body, labels: [ISSUE_LABEL] }).catch(() =>
      // The label may not exist yet; an issue without it is still the ask.
      send(`/issues`, { title: ISSUE_TITLE, body }),
    );
    console.log(`Opened trim issue #${issue.number}.`);
    return;
  }
  const worse = newlyWorse(over, readReport(existing.body ?? ""));
  await send(`/issues/${existing.number}`, { body }, "PATCH");
  if (worse.length > 0)
    await send(`/issues/${existing.number}/comments`, {
      body: `Main ${runSha.slice(0, 7)} is further over: ${worse.map(({ route, kb, limit }) => `\`${route}\` ${kb} KB against ${limit} KB`).join("; ")}.`,
    });
  console.log(`Refreshed trim issue #${existing.number}${worse.length ? " and commented" : ""}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(`::error::budget over issue: ${error.message}`);
    process.exitCode = 1;
  });
}
