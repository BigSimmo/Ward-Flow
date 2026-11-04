/**
 * Runs from `.github/workflows/ward-flow-ci-tidy.yml` when a pull request closes, and hourly. It frees shared runner slots held by runs nobody will use:
 *
 * - any pull-request run whose branch no longer has an open pull request (merged or closed), and
 * - a run for an older head of an open pull request, but only while none of its jobs is running.
 *
 * Running work on the current head is never cancelled. Ward Flow CI's own superseded PR runs are
 * cancelled by its concurrency group (cancel-in-progress on pull requests, 4 Nov 2026). Runs on main, scheduled and manual runs, and the
 * budget heal bot's dispatched runs are never touched. It reads and cancels runs through the API only.
 */
import { pathToFileURL } from "node:url";

const ACTIVE = ["queued", "in_progress", "waiting", "pending", "requested"];
const PR_EVENTS = new Set(["pull_request", "pull_request_target"]);
const SELF = "Ward Flow CI tidy";

/**
 * Decides one active run. `openHeads` maps an open PR's head branch to its head SHA.
 * `jobs` is the run's latest-attempt jobs (only read for superseded runs).
 */
export function decideRun(run, openHeads, jobs = []) {
  if (!PR_EVENTS.has(run.event)) return { cancel: false, reason: "not a pull-request run" };
  if (run.name === SELF) return { cancel: false, reason: "this workflow" };
  if (run.head_repository && run.repository && run.head_repository.full_name !== run.repository.full_name)
    return { cancel: false, reason: "fork" };
  const head = openHeads.get(run.head_branch);
  if (head === undefined) return { cancel: true, reason: "pull request is merged or closed" };
  if (run.event === "pull_request_target") return { cancel: false, reason: "base-context check on an open PR" };
  if (head === run.head_sha) return { cancel: false, reason: "current head" };
  if (jobs.some((job) => job.status === "in_progress")) return { cancel: false, reason: "older head, still running" };
  return { cancel: true, reason: "older head, nothing running" };
}

async function main() {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo } = process.env;
  if (!token || !repo) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required");
  const api = async (path, init = {}) => {
    const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", ...init.headers },
    });
    if (!response.ok && response.status !== 409)
      throw new Error(`${init.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`);
    return response.status === 202 || response.status === 204 || response.status === 409 ? null : response.json();
  };
  const openHeads = new Map();
  for (let page = 1; ; page += 1) {
    const batch = await api(`/pulls?state=open&per_page=100&page=${page}`);
    for (const pr of batch) openHeads.set(pr.head.ref, pr.head.sha);
    if (batch.length < 100) break;
  }
  let cancelled = 0;
  for (const status of ACTIVE) {
    for (let page = 1; page <= 5; page += 1) {
      const { workflow_runs: runs } = await api(`/actions/runs?status=${status}&per_page=100&page=${page}`);
      for (const run of runs) {
        let decision = decideRun(run, openHeads);
        if (decision.cancel && !openHeads.has(run.head_branch)) {
          // A PR opened after the list above was read: look again before cancelling its first run.
          const owner = repo.split("/")[0];
          const fresh = await api(`/pulls?state=open&head=${owner}:${encodeURIComponent(run.head_branch)}&per_page=1`);
          if (fresh.length) openHeads.set(run.head_branch, fresh[0].head.sha);
          decision = decideRun(run, openHeads);
        }
        if (decision.cancel && openHeads.has(run.head_branch)) {
          const { jobs } = await api(`/actions/runs/${run.id}/jobs?filter=latest&per_page=100`);
          decision = decideRun(run, openHeads, jobs);
        }
        if (!decision.cancel) continue;
        await api(`/actions/runs/${run.id}/cancel`, { method: "POST" });
        cancelled += 1;
        console.log(`Cancelled ${run.name} run ${run.id} on ${run.head_branch}: ${decision.reason}.`);
      }
      if (runs.length < 100) break;
    }
  }
  console.log(`CI tidy: cancelled ${cancelled} run(s).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(`::error::CI tidy: ${error.message}`);
    process.exitCode = 1;
  });
}
