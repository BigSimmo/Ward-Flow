/**
 * Main-push reuse check for .github/workflows/ward-flow.yml.
 *
 * Railway deploys a main commit only after this workflow succeeds on it ("Wait for CI"). Every main
 * commit arrives through a pull request that the ruleset keeps up to date with main, so the tree that
 * lands is normally byte-for-byte the tree the PR's own run already passed. This check proves that
 * for one push, and only then lets the workflow skip re-running the unit shards, browser journeys,
 * coverage and production build on main. The static checks (including the whole-tree lint that only
 * non-PR runs do) and the secret scan still run on every main commit.
 *
 * It verifies, all of which must hold (anything else, including any API or git error, prints the
 * reason and reports verified=false, so the full suite runs exactly as before):
 *   1. exactly one merged same-repository PR into main has this push's commit as its merge commit;
 *   2. the PR head's tree is identical to this commit's tree;
 *   3. the previous main commit is an ancestor of the PR head (the head was up to date), so the PR
 *      run's merge ref was that same tree;
 *   4. a successful pull_request run of this workflow on the PR head ran (not skipped) every unit
 *      shard, every browser group, the coverage thresholds and the production build, and its
 *      "Ward Flow required" job succeeded.
 *
 * It never exits non-zero: a failed job would fail the workflow run, and Railway skips the deploy of
 * a commit whose workflow failed.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";

const SHA = /^[0-9a-f]{40}$/u;
const WORKFLOW = "ward-flow.yml";

/** Jobs whose real work must have run and passed on the PR head, keyed by the step that does it. */
export const EVIDENCE = [
  { label: "unit shard", job: /^Ward Flow unit shard (\d+)$/u, steps: ["Run reconciled unit suite shard"] },
  { label: "browser group", job: /^Ward Flow browser journeys (\d+)$/u, steps: ["Run Ward browser journeys"] },
  {
    label: "coverage",
    job: /^Ward Flow coverage$/u,
    // The second name is the single-job coverage run that preceded the shard merge.
    steps: ["Merge shard coverage and enforce thresholds", "Run unit suite with coverage thresholds"],
  },
  {
    label: "production build",
    job: /^Ward Flow production build$/u,
    steps: ["Build for production (Railway build command)"],
  },
];

/** The unit shard and browser group counts declared by the workflow, so a run with fewer is refused. */
export function workflowCounts(source) {
  const shards = Number(/WARD_GATE_SHARD: \$\{\{ matrix\.shard \}\}\/(\d+)/u.exec(source)?.[1]);
  const groups = Number(/WARD_JOURNEY_GROUP: \$\{\{ matrix\.group \}\}\/(\d+)/u.exec(source)?.[1]);
  if (!(shards >= 1) || !(groups >= 1)) throw new Error("workflow shard or group count not found");
  return { "unit shard": shards, "browser group": groups, coverage: 1, "production build": 1 };
}

/** Does one run's job list prove every required job really ran and passed? Returns a reason if not. */
export function runEvidenceGap(jobs, counts) {
  const required = jobs.filter((job) => job.name === "Ward Flow required");
  if (required.length !== 1 || required[0].conclusion !== "success") return "Ward Flow required did not succeed";
  for (const { label, job: pattern, steps } of EVIDENCE) {
    const passed = new Set();
    for (const job of jobs) {
      const match = pattern.exec(job.name);
      if (!match) continue;
      if (job.conclusion !== "success") return `${job.name} did not succeed`;
      const step = (job.steps ?? []).find((candidate) => steps.includes(candidate.name));
      if (!step || step.conclusion !== "success") return `${job.name} did not run its checks (scope-skipped)`;
      passed.add(match[1] ?? label);
    }
    if (passed.size !== counts[label]) return `${passed.size} of ${counts[label]} ${label} job(s) proved`;
  }
  return null;
}

/**
 * The decision, as a pure function over the gathered evidence.
 * @returns {{ verified: boolean, reason: string, pr?: number, runUrl?: string }}
 */
export function decideMainReuse({ repo, sha, before, mainTree, pulls, headTree, compare, runs, counts }) {
  const refuse = (reason) => ({ verified: false, reason });
  if (!SHA.test(sha ?? "") || !SHA.test(mainTree ?? "")) return refuse("push commit or tree unavailable");
  if (!SHA.test(before ?? "") || /^0+$/u.test(before)) return refuse("no previous main commit");
  const merged = (pulls ?? []).filter(
    (pull) =>
      pull.merged_at &&
      pull.merge_commit_sha === sha &&
      pull.base?.ref === "main" &&
      pull.head?.repo?.full_name === repo &&
      SHA.test(pull.head?.sha ?? ""),
  );
  if (merged.length !== 1) return refuse(`${merged.length} merged pull requests own this commit`);
  const [pull] = merged;
  if (headTree !== mainTree) return refuse(`PR #${pull.number} head tree differs from the main tree`);
  if (!compare || compare.behind_by !== 0 || !["ahead", "identical"].includes(compare.status))
    return refuse(`PR #${pull.number} head did not contain the previous main commit`);
  const reasons = [];
  for (const run of runs ?? []) {
    if (run.head_sha !== pull.head.sha || run.event !== "pull_request" || run.conclusion !== "success") continue;
    const gap = runEvidenceGap(run.jobs ?? [], counts);
    if (!gap)
      return {
        verified: true,
        reason: `PR #${pull.number} run passed this exact tree`,
        pr: pull.number,
        runUrl: run.html_url,
      };
    reasons.push(`run ${run.id}: ${gap}`);
  }
  return refuse(
    `no qualifying green run on PR #${pull.number} head${reasons.length ? ` (${reasons.join("; ")})` : ""}`,
  );
}

async function gatherAndDecide() {
  const repo = process.env.GITHUB_REPOSITORY ?? "";
  const sha = process.env.GITHUB_SHA ?? "";
  const before = process.env.WARD_BEFORE_SHA ?? "";
  const token = process.env.GH_TOKEN ?? "";
  if (process.env.GITHUB_EVENT_NAME !== "push" || process.env.GITHUB_REF !== "refs/heads/main")
    return { verified: false, reason: "not a push to main" };
  if (!token || !/^[\w.-]+\/[\w.-]+$/u.test(repo))
    return { verified: false, reason: "repository or token unavailable" };
  const api = async (path) => {
    const response = await fetch(`${process.env.GITHUB_API_URL ?? "https://api.github.com"}/repos/${repo}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`GET ${path} returned ${response.status}`);
    return response.json();
  };
  const mainTree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8", timeout: 10_000 }).trim();
  const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", timeout: 10_000 }).trim();
  if (head !== sha) return { verified: false, reason: "checked-out commit is not the pushed commit" };
  const counts = workflowCounts(readFileSync(new URL(`../../.github/workflows/${WORKFLOW}`, import.meta.url), "utf8"));
  const pulls = await api(`/commits/${sha}/pulls`);
  const candidate = (pulls ?? []).find((pull) => pull.merge_commit_sha === sha && SHA.test(pull.head?.sha ?? ""));
  if (!candidate) return decideMainReuse({ repo, sha, before, mainTree, pulls, counts });
  const headSha = candidate.head.sha;
  const headTree = (await api(`/git/commits/${headSha}`))?.tree?.sha;
  const compare = SHA.test(before) ? await api(`/compare/${before}...${headSha}?per_page=1`) : null;
  const listed = await api(
    `/actions/workflows/${WORKFLOW}/runs?event=pull_request&status=success&head_sha=${headSha}&per_page=10`,
  );
  const runs = [];
  for (const run of (listed?.workflow_runs ?? []).slice(0, 3)) {
    const jobs = await api(`/actions/runs/${run.id}/jobs?filter=latest&per_page=100`);
    runs.push({ ...run, jobs: jobs?.jobs ?? [] });
  }
  return decideMainReuse({ repo, sha, before, mainTree, pulls, headTree, compare, runs, counts });
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/ward-ci-public/main-reuse.mjs")) {
  let decision;
  try {
    decision = await gatherAndDecide();
  } catch (error) {
    decision = { verified: false, reason: `check failed (${error?.message ?? error}); running the full suite` };
  }
  const line = decision.verified
    ? `Ward main reuse: VERIFIED. ${decision.reason}: ${decision.runUrl}. Unit shards, browser journeys, coverage and the production build are skipped on this commit; static checks and the secret scan still run.`
    : `Ward main reuse: not verified (${decision.reason}). Running the full suite.`;
  console.log(line);
  try {
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `verified=${decision.verified}\n`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
  } catch (error) {
    console.log(`Could not record the decision (${error?.message ?? error}); the full suite runs.`);
  }
}
