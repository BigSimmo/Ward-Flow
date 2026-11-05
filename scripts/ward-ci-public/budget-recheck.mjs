/**
 * Runs from `.github/workflows/ward-flow-budget-recheck.yml` on every push to main.
 *
 * Main has no merge queue and its ruleset does not require branches to be up to date, so a pull
 * request's last "Ward Flow production build" may have measured the phone script budget against an
 * older main. For each open, non-draft pull request into main with auto-merge armed, this re-runs
 * that job on the PR's latest Ward Flow CI run. The build merges the current main before measuring
 * (`merge-latest-main.mjs`), and GitHub re-runs the jobs that depend on it, so the required
 * "Ward Flow required" check goes back to pending and the PR cannot merge until the budget holds
 * against the main it would land on.
 *
 * With WARD_PR_NUMBER set (auto-merge was just armed on that PR), it checks only that PR, against
 * the time main last moved, so a PR armed after a push that skipped it is still re-measured.
 *
 * It only re-runs jobs. It never changes auto-merge, reviews, branches or labels.
 */
import { pathToFileURL } from "node:url";

const BUILD_JOB = "Ward Flow production build";
const WORKFLOW = "ward-flow.yml";
const MEASURED_MAIN_STEP = "Record the measured main";
const MEASURED_MAIN_TITLE = "Ward budget main";
const isSha = (value) => typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);

/** One complete, unambiguous notice from this build attempt, or no exact evidence. */
export function budgetMainFromAnnotations(annotations) {
  if (!Array.isArray(annotations) || annotations.length >= 100) return null;
  const notices = annotations.filter(
    (annotation) => annotation?.title === MEASURED_MAIN_TITLE && annotation?.annotation_level === "notice",
  );
  if (notices.length !== 1 || typeof notices[0].message !== "string") return null;
  const sha = notices[0].message.trim();
  return isSha(sha) ? sha : null;
}

/** Read only the latest build's own executed producer, never an earlier attempt's annotations. */
export async function withBudgetMainReceipt(jobs, api) {
  const builds = jobs.filter((job) => job.name === BUILD_JOB);
  if (builds.length !== 1) return jobs;
  const [build] = builds;
  const producers = (build.steps ?? []).filter((step) => step.name === MEASURED_MAIN_STEP);
  if (producers.length !== 1 || producers[0].conclusion !== "success") return jobs;
  if (!Number.isInteger(build.id) || build.id < 1) throw new Error("Measured-main build has no valid check-run ID");
  // A full page cannot prove that a conflicting annotation is not on the next page. Keep the
  // legacy timestamp fallback instead of adding unbounded API fanout for optional deduplication.
  const annotations = await api(`/check-runs/${build.id}/annotations?per_page=100`);
  return jobs.map((job) => (job === build ? { ...job, budgetMainSha: budgetMainFromAnnotations(annotations) } : job));
}

/**
 * Decides what to do for one pull request from its latest CI run and that run's latest-attempt jobs.
 * Exact measured-main identity wins over timing. Without it, retain the legacy `since` cutoff:
 * a build that started after main moved already fetched the new main.
 * Returns { action: "rerun", jobId } | { action: "wait" } | { action: "skip", reason }.
 */
export function decide(pr, run, jobs, since, mainSha = "") {
  if (pr.draft) return { action: "skip", reason: "draft" };
  if (!pr.auto_merge) return { action: "skip", reason: "auto-merge not armed" };
  if (!run) return { action: "skip", reason: "no Ward Flow CI run on the head yet" };
  // A push during the wait moves the head: re-running the old head's run cancels the new one.
  if (run.head_sha && pr.head?.sha && run.head_sha !== pr.head.sha)
    return { action: "skip", reason: "run is for an older head" };
  const build = jobs.find((job) => job.name === BUILD_JOB);
  const exactMain = isSha(mainSha) && isSha(build?.budgetMainSha);
  if (exactMain && build.budgetMainSha === mainSha)
    return { action: "skip", reason: "build already measured the current main" };
  const started = build?.started_at ? Date.parse(build.started_at) : NaN;
  if (build && !exactMain && started > since) return { action: "skip", reason: "build started after main moved" };
  if (run.status !== "completed") {
    if (!build || (!exactMain && !build.started_at))
      return { action: "skip", reason: "build not started; it will fetch the new main" };
    return { action: "wait" };
  }
  if (!build) return { action: "skip", reason: "no production build job in the run" };
  if (build.conclusion === "skipped") return { action: "skip", reason: "build out of scope for this PR" };
  return { action: "rerun", jobId: build.id };
}

/**
 * Every open pull request into main, across all pages (GitHub returns at most 100 per page).
 * `api(path)` resolves to the parsed JSON for a repository-relative path.
 */
export async function listOpenPullRequests(api) {
  const prs = [];
  for (let page = 1; ; page += 1) {
    const batch = await api(`/pulls?state=open&base=main&per_page=100&page=${page}`);
    prs.push(...batch);
    if (batch.length < 100) return prs;
  }
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const only = Number(process.env.WARD_PR_NUMBER || 0);
  if (!token || !repo) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required");
  const api = async (path, init = {}) => {
    const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", ...init.headers },
    });
    if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path}: ${response.status} ${await response.text()}`);
    return response.status === 204 || response.status === 201 ? null : response.json();
  };
  const latest = async (pr) => {
    const { workflow_runs: runs } = await api(
      `/actions/workflows/${WORKFLOW}/runs?event=pull_request&head_sha=${pr.head.sha}&per_page=20`,
    );
    const run = runs.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
    if (!run) return { run: undefined, jobs: [] };
    const { jobs } = await api(`/actions/runs/${run.id}/jobs?filter=latest&per_page=100`);
    return { run, jobs: pr.draft || !pr.auto_merge ? jobs : await withBudgetMainReceipt(jobs, api) };
  };

  // On a push this job starts seconds after main moved; a build that started just before it is
  // re-run once more. When auto-merge is armed, main last moved when its head commit was committed.
  const main = await api("/commits/main");
  if (!isSha(main.sha)) throw new Error("Current main has no valid commit identity");
  const since = only ? Date.parse(main.commit.committer.date) : Date.now();
  const prs = only
    ? [await api(`/pulls/${only}`)].filter((pr) => pr.state === "open" && pr.base.ref === "main")
    : await listOpenPullRequests(api);
  let pending = prs;
  let failures = 0;
  // Runs still building when main moved cannot have a job re-run until they finish; wait up to 10 min.
  for (let round = 0; pending.length > 0 && round < 10; round++) {
    if (round > 0) await new Promise((resolve) => setTimeout(resolve, 60_000));
    const next = [];
    for (const listed of pending) {
      // Re-read the pull request each round, so a head pushed while waiting is the one measured.
      const pr = round > 0 || !only ? await api(`/pulls/${listed.number}`).catch(() => listed) : listed;
      try {
        if (pr.state !== "open") {
          console.log(`#${pr.number}: skipped (no longer open)`);
          continue;
        }
        const { run, jobs } = await latest(pr);
        const verdict = decide(pr, run, jobs, since, main.sha);
        if (verdict.action === "wait") next.push(pr);
        else if (verdict.action === "skip") console.log(`#${pr.number}: skipped (${verdict.reason})`);
        else {
          await api(`/actions/jobs/${verdict.jobId}/rerun`, { method: "POST" });
          console.log(`#${pr.number}: re-running "${BUILD_JOB}" on run ${run.id} against the new main`);
        }
      } catch (error) {
        failures++;
        console.error(`::error::#${pr.number}: ${error.message}`);
      }
    }
    pending = next;
  }
  for (const pr of pending) console.error(`::warning::#${pr.number}: its run was still in progress after 10 minutes`);
  if (failures > 0) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
