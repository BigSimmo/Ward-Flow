/**
 * Runs from `.github/workflows/ward-flow-nightly-browsers.yml` when a scheduled nightly run fails.
 *
 * The nightly browser checks (image baselines and the iPad tablet layout) never block a merge, and
 * the 6 am release does not read them, so a failure used to sit unseen in an artifact. This opens
 * one issue saying the nightly failed, or refreshes the one already open, following the budget over
 * issue (`budget-heal.mjs`): same bot-created title dedupe, a label with a no-label fallback, and a
 * body rewritten with the latest failing run. A comment is added for each further failing night so
 * watchers hear about it. A person closes the issue once the nightly is green again.
 * It reads and writes issues only. It never touches a branch, a pull request or the baselines.
 */
import { pathToFileURL } from "node:url";

export const ISSUE_TITLE = "Nightly browsers failed: image baselines or tablet checks";
export const ISSUE_LABEL = "nightly-browsers";

/**
 * @param {{ sha: string, runUrl?: string }} run
 */
export function issueBody({ sha, runUrl }) {
  return [
    `The scheduled Ward Flow nightly browsers run failed on main ${sha.slice(0, 7)}.`,
    "",
    "It compares the image baselines for ten key screens (desktop Chromium 1440, phone WebKit 390)",
    "and runs the 834px iPad WebKit checks. It never blocks a merge, and the daily release does not",
    "read it, so this issue is the signal.",
    "",
    "**Ask:** open the run, download the `ward-nightly-browser-failures-<run id>` artifact and read",
    "the picture diffs. Fix a real regression in a pull request. If the change was intended, run the",
    "workflow by hand with `update_baselines` ticked and commit the new baselines in a pull request.",
    "",
    "This issue is rewritten on each failing scheduled run. Close it once the nightly is green again.",
    "",
    runUrl ? `Latest failing run: ${runUrl}` : "",
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n")
    .trimEnd();
}

async function main() {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, WARD_RUN_SHA: runSha, WARD_RUN_URL: runUrl } = process.env;
  if (!token || !repo || !runSha) throw new Error("GITHUB_TOKEN, GITHUB_REPOSITORY and WARD_RUN_SHA are required");
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

  const body = issueBody({ sha: runSha, runUrl });
  let existing;
  for (let page = 1; !existing; page += 1) {
    const open = await api(
      `/issues?state=open&creator=${encodeURIComponent("github-actions[bot]")}&per_page=100&page=${page}`,
    );
    existing = open.find((item) => !item.pull_request && item.title === ISSUE_TITLE);
    if (open.length < 100) break;
  }
  if (!existing) {
    const issue = await send(`/issues`, { title: ISSUE_TITLE, body, labels: [ISSUE_LABEL] }).catch(() =>
      // The label may not exist yet; an issue without it is still the signal.
      send(`/issues`, { title: ISSUE_TITLE, body }),
    );
    console.log(`Opened nightly failure issue #${issue.number}.`);
    return;
  }
  await send(`/issues/${existing.number}`, { body }, "PATCH");
  await send(`/issues/${existing.number}/comments`, {
    body: `The nightly failed again on main ${runSha.slice(0, 7)}.${runUrl ? ` Run: ${runUrl}` : ""}`,
  });
  console.log(`Refreshed nightly failure issue #${existing.number} and commented.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(`::error::nightly failure issue: ${error.message}`);
    process.exitCode = 1;
  });
}
