/**
 * Main-push reuse check for .github/workflows/ward-flow.yml.
 *
 * Reuse each independently proven PR gate on the exact tree that landed on main. A scoped-out
 * legal sweep, for example, requires fresh unit/coverage work without discarding browser proof.
 * Static checks and the secret scan still run on every main commit.
 *
 * It verifies, all of which must hold (anything else, including any API or git error, prints the
 * reason and reports every gate false, so fresh work runs):
 *   1. exactly one merged same-repository PR into main has this push's commit as its merge commit;
 *   2. the newest completed pull_request run on that PR head and its "Ward Flow required" job
 *      succeeded; incomplete bounded history or ambiguous run ordering refuses every gate.
 *   3. each reused test gate executed all its real work on this exact tree. The scope plan's
 *      tested-tree notices must agree across attempts. Without a notice, an exact PR head tree
 *      containing the previous main commit also proves its merge tree. A contradictory notice
 *      is never replaced by that fallback.
 *   4. build reuse additionally needs exact built-tree and strict-budget notices from the latest
 *      production-build attempt, even when the head was up to date. A previous attempt's notices
 *      cannot excuse a latest build that only warned about its budget.
 * Missing gate evidence is never filled from older green runs. Unit and coverage outputs are
 * coupled so a fresh coverage merge always receives fresh unit shard blobs, except that a run
 * which left only the legal-figure sweep out lets main run just the sweep (mainReuseOutputs).
 *
 * Discovery errors return false flags; the workflow then runs fresh gates.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";

import { reusableGateEvidence } from "./gate-reuse.mjs";

const SHA = /^[0-9a-f]{40}$/u;
const WORKFLOW = "ward-flow.yml";
const GATES = ["unit", "coverage", "browser", "release", "build", "backend"];

function refuse(reason) {
  return {
    verified: false,
    backendVerified: false,
    reason,
    gates: Object.fromEntries([...GATES, "unitExceptSweep"].map((gate) => [gate, false])),
    reasons: Object.fromEntries(GATES.map((gate) => [gate, reason])),
  };
}
/** The notice title the scope plan job uses to record the tree a pull request run tested. */
export const TESTED_TREE_TITLE = "Ward tested tree";

/** Jobs whose real work must have run and passed on the PR head, keyed by the step that does it. */
export const EVIDENCE = [
  { label: "unit shard", job: /^Ward Flow unit shard (\d+)$/u, steps: ["Run reconciled unit suite shard"] },
  // A pull request run that left the legal-figure sweep out (legal-sweep-scope.mjs) proves less than main needs.
  {
    label: "legal-figure sweep",
    job: /^Ward Flow unit shard (\d+)$/u,
    steps: ["Confirm the legal-figure sweep ran"],
  },
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
  // Its matrix is not counted from the workflow: the run tested this exact tree, so it ran this
  // workflow's matrix, and its own Ward Flow required job needed every leg. At least one must have run.
  {
    label: "release gate",
    job: /^Ward Flow release gate (.+)$/u,
    steps: ["Run the release-gate journeys"],
  },
];

/** The backend proof, reused only when the PR run really ran it (it is scoped separately). */
export const BACKEND_EVIDENCE = {
  job: "Ward Flow backend and shared production proof",
  step: "Run Ward backend tests",
};

/** The notice title the production build uses to record the tree it built (after merging main). */
export const BUILT_TREE_TITLE = "Ward built tree";
/** Written only after a production build proves the current strict phone budget. */
export const STRICT_BUDGET_TREE_TITLE = "Ward strict budget tree";

/** The unit shard and browser group counts declared by the workflow, so a run with fewer is refused. */
export function workflowCounts(source) {
  const shards = Number(/WARD_GATE_SHARD: \$\{\{ matrix\.shard \}\}\/(\d+)/u.exec(source)?.[1]);
  const groups = Number(/WARD_JOURNEY_GROUP: \$\{\{ matrix\.group \}\}\/(\d+)/u.exec(source)?.[1]);
  if (!(shards >= 1) || !(groups >= 1)) throw new Error("workflow shard or group count not found");
  return {
    "unit shard": shards,
    "legal-figure sweep": shards,
    "browser group": groups,
    coverage: 1,
    "production build": 1,
    "release gate": "at least one",
  };
}

/** Legacy all-jobs diagnostic. Reuse decisions use the stronger independent gate evidence below. */
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
    if (counts[label] === "at least one") {
      if (passed.size < 1) return `no ${label} job proved`;
    } else if (passed.size !== counts[label]) return `${passed.size} of ${counts[label]} ${label} job(s) proved`;
  }
  return null;
}

function owningPulls(pulls, repo, sha) {
  return (Array.isArray(pulls) ? pulls : []).filter(
    (pull) =>
      pull?.merged_at &&
      pull.merge_commit_sha === sha &&
      pull.base?.ref === "main" &&
      pull.head?.repo?.full_name === repo &&
      SHA.test(pull.head?.sha ?? ""),
  );
}

function newestCompletedRun(runs, headSha) {
  const relevant = (Array.isArray(runs) ? runs : []).filter(
    (run) =>
      run?.head_sha === headSha &&
      run.event === "pull_request" &&
      (run.status === undefined || run.status === "completed"),
  );
  // A rerun keeps its original run ID and creation time. Its latest attempt's update time,
  // rather than API list order or run ID, determines whether it discredits an earlier green.
  if (relevant.length > 1) {
    const times = relevant.map((run) => Date.parse(run.updated_at));
    if (times.some((time) => !Number.isFinite(time)) || new Set(times).size !== times.length)
      return { reason: "completed run ordering is unavailable or ambiguous" };
    relevant.sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at));
  }
  return { run: relevant[0] };
}

/** The global ownership and newest-run checks precede every independent gate decision. */
export function decideMainReuse({ repo, sha, before, mainTree, pulls, headTree, compare, runs, counts }) {
  if (typeof sha !== "string" || !SHA.test(sha) || typeof mainTree !== "string" || !SHA.test(mainTree))
    return refuse("push commit or tree unavailable");
  if (typeof before !== "string" || !SHA.test(before) || /^0+$/u.test(before)) return refuse("no previous main commit");
  const merged = owningPulls(pulls, repo, sha);
  if (merged.length !== 1) return refuse(`${merged.length} merged pull requests own this commit`);
  const [pull] = merged;
  const latest = newestCompletedRun(runs, pull.head.sha);
  if (latest.reason) return refuse(latest.reason);
  const run = latest.run;
  if (!run) return refuse(`no qualifying green run on PR #${pull.number} head`);
  if (run.conclusion !== "success") return refuse(`newer completed run ${run.id} concluded ${run.conclusion}`);
  const jobs = Array.isArray(run.jobs) ? run.jobs : [];
  const required = jobs.filter((job) => job?.name === "Ward Flow required");
  if (required.length !== 1 || required[0].conclusion !== "success")
    return refuse("Ward Flow required did not succeed");
  const upToDate =
    headTree === mainTree &&
    Boolean(compare) &&
    compare.behind_by === 0 &&
    ["ahead", "identical"].includes(compare.status);
  const { reasons, ...gates } = reusableGateEvidence({
    jobs,
    counts,
    mainTree,
    testedTree: run.testedTree === undefined && upToDate ? mainTree : run.testedTree,
    builtTree: run.builtTree,
    strictBudgetTree: run.strictBudgetTree,
  });
  const verified = GATES.filter((gate) => gate !== "backend").every((gate) => gates[gate]);
  const reused = GATES.filter((gate) => gates[gate]);
  return {
    verified,
    backendVerified: gates.backend,
    gates,
    reasons,
    reason: `PR #${pull.number} newest successful run proves ${reused.join(", ") || "no reusable gates"} on this exact tree`,
    pr: pull.number,
    runUrl: run.html_url,
  };
}

/** Both backend tests and the authenticated shared-mode journey must have executed. */
export function backendProved(jobs) {
  const backend = jobs.filter((job) => job.name === BACKEND_EVIDENCE.job);
  if (backend.length !== 1 || backend[0].conclusion !== "success") return false;
  return [BACKEND_EVIDENCE.step, "Run the shared-mode browser journey"].every((name) => {
    const steps = (backend[0].steps ?? []).filter((step) => step.name === name);
    return steps.length === 1 && steps[0].conclusion === "success";
  });
}

/**
 * Workflow flags keep unit shards and their coverage merge together when either needs fresh work.
 * One exception (D-166): a pull request run that left only the legal-figure sweep out proved every
 * other unit file and the coverage floors on this tree, so main reuses its coverage and runs just
 * the sweep files in the shards (`sweep_only`). Coverage can only rise with the sweep added.
 */
export function mainReuseOutputs(decision) {
  const gates = decision.gates ?? {};
  const unitCoverage = gates.unit === true && gates.coverage === true;
  const sweepOnly = !unitCoverage && gates.unitExceptSweep === true && gates.coverage === true;
  return {
    verified: decision.verified === true,
    unit_verified: unitCoverage,
    coverage_verified: unitCoverage || sweepOnly,
    sweep_only: sweepOnly,
    browser_verified: gates.browser === true,
    release_verified: gates.release === true,
    build_verified: gates.build === true,
    backend_verified: gates.backend === true,
  };
}

/** The trees recorded under `title` in a check run's annotations (any count, unvalidated). */
function recordedTrees(annotations, title) {
  return (Array.isArray(annotations) ? annotations : [])
    .filter((annotation) => annotation?.title === title && annotation?.annotation_level === "notice")
    .map((annotation) => String(annotation.message ?? "").trim());
}

/** The one recorded tested tree among a check run's annotations, or null when absent or ambiguous. */
export function testedTreeFromAnnotations(annotations, title = TESTED_TREE_TITLE) {
  const trees = recordedTrees(annotations, title);
  return trees.length === 1 && SHA.test(trees[0]) ? trees[0] : null;
}

/**
 * The single tree recorded under `title` across every attempt of one job (one annotation list per
 * attempt's check run), or null. Attempts that recorded nothing are ignored (a re-run can carry no
 * annotation for an unchanged notice); any malformed or disagreeing record refuses.
 * @param {unknown[]} annotationLists
 */
export function treeAcrossAttempts(annotationLists, title) {
  const trees = annotationLists.flatMap((annotations) => recordedTrees(annotations, title));
  if (trees.length === 0 || trees.some((tree) => !SHA.test(tree))) return null;
  return new Set(trees).size === 1 ? trees[0] : null;
}

/**
 * The tree one job name recorded across every attempt of a run. Undefined means no matching
 * notice exists; null means unreadable, malformed or conflicting evidence. Only absence allows
 * an independently proven up-to-date head to supply the tested tree. A job's id is its check run id.
 * @param {Array<{ name?: string, id?: number }>} allJobs @param {(path: string) => Promise<any>} api
 */
async function recordedTreeOf(allJobs, name, title, api) {
  const attempts = allJobs.filter((job) => job.name === name);
  if (attempts.length === 0) return undefined;
  if (attempts.some((job) => !Number.isInteger(job.id))) return null;
  const lists = [];
  for (const job of attempts) lists.push(await annotationsOf(job, api));
  if (!lists.some((annotations) => annotations.some((annotation) => annotation?.title === title))) return undefined;
  return treeAcrossAttempts(lists, title);
}

async function annotationsOf(job, api) {
  const annotations = await api(`/check-runs/${job.id}/annotations?per_page=50`);
  if (!Array.isArray(annotations) || annotations.length >= 50)
    throw new Error("check annotation history is unavailable or exceeds the bounded lookup");
  return annotations;
}

function completeJobs(response) {
  if (!Array.isArray(response?.jobs) || response.total_count !== response.jobs.length)
    throw new Error("job history is unavailable or exceeds the bounded lookup");
  return response.jobs;
}

async function gather({
  env = process.env,
  api: suppliedApi,
  git = (args) => execFileSync("git", args, { encoding: "utf8", timeout: 10_000 }).trim(),
} = {}) {
  const repo = env.GITHUB_REPOSITORY ?? "";
  const sha = env.GITHUB_SHA ?? "";
  const before = env.WARD_BEFORE_SHA ?? "";
  const token = env.GH_TOKEN ?? "";
  if (env.GITHUB_EVENT_NAME !== "push" || env.GITHUB_REF !== "refs/heads/main") return refuse("not a push to main");
  if (!token || !/^[\w.-]+\/[\w.-]+$/u.test(repo)) return refuse("repository or token unavailable");
  if (!SHA.test(sha) || !SHA.test(before) || /^0+$/u.test(before))
    return refuse("push or previous main commit unavailable");
  const api =
    suppliedApi ??
    (async (path) => {
      const response = await fetch(`${env.GITHUB_API_URL ?? "https://api.github.com"}/repos/${repo}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`GET ${path} returned ${response.status}`);
      return response.json();
    });
  const mainTree = git(["rev-parse", "HEAD^{tree}"]);
  const head = git(["rev-parse", "HEAD"]);
  if (head !== sha) return refuse("checked-out commit is not the pushed commit");
  const counts = workflowCounts(readFileSync(new URL(`../../.github/workflows/${WORKFLOW}`, import.meta.url), "utf8"));
  const pulls = await api(`/commits/${sha}/pulls`);
  const merged = owningPulls(pulls, repo, sha);
  if (merged.length !== 1) return decideMainReuse({ repo, sha, before, mainTree, pulls, counts });
  const [candidate] = merged;
  const headSha = candidate.head.sha;
  const headTree = (await api(`/git/commits/${headSha}`))?.tree?.sha;
  const compare = SHA.test(before) ? await api(`/compare/${before}...${headSha}?per_page=1`) : null;
  const listed = await api(
    `/actions/workflows/${WORKFLOW}/runs?event=pull_request&status=completed&head_sha=${headSha}&per_page=10`,
  );
  const completed = listed?.workflow_runs;
  if (!Array.isArray(completed) || listed.total_count !== completed.length)
    return refuse("completed run history is unavailable or exceeds the bounded lookup");
  const latest = newestCompletedRun(completed, headSha);
  if (latest.reason) return refuse(latest.reason);
  const run = latest.run;
  if (!run || run.conclusion !== "success")
    return decideMainReuse({ repo, sha, before, mainTree, pulls, headTree, compare, runs: completed, counts });
  const jobs = completeJobs(await api(`/actions/runs/${run.id}/jobs?filter=latest&per_page=100`));
  const all = completeJobs(await api(`/actions/runs/${run.id}/jobs?filter=all&per_page=100`));
  const builds = jobs.filter((job) => job.name === "Ward Flow production build");
  const buildAnnotations =
    builds.length === 1 && Number.isInteger(builds[0].id) && builds[0].conclusion === "success"
      ? await annotationsOf(builds[0], api)
      : [];
  const enriched = {
    ...run,
    jobs,
    testedTree: await recordedTreeOf(all, "Ward Flow scope plan", TESTED_TREE_TITLE, api),
    builtTree: testedTreeFromAnnotations(buildAnnotations, BUILT_TREE_TITLE),
    strictBudgetTree: testedTreeFromAnnotations(buildAnnotations, STRICT_BUDGET_TREE_TITLE),
  };
  const runs = completed.map((candidate) => (candidate === run ? enriched : candidate));
  return decideMainReuse({ repo, sha, before, mainTree, pulls, headTree, compare, runs, counts });
}

/** Dependency injection permits offline API/history checks; runtime failures refuse every gate. */
export async function gatherAndDecide(options = {}) {
  try {
    return await gather(options);
  } catch (error) {
    return refuse(`check failed (${error?.message ?? error}); running fresh gates`);
  }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("/scripts/ward-ci-public/main-reuse.mjs")) {
  let decision;
  try {
    decision = await gatherAndDecide();
  } catch (error) {
    decision = refuse(`check failed (${error?.message ?? error}); running fresh gates`);
  }
  const outputs = mainReuseOutputs(decision);
  const reused = GATES.filter((gate) => outputs[`${gate}_verified`]);
  const fresh = GATES.filter((gate) => !outputs[`${gate}_verified`]);
  const sweepNote = outputs.sweep_only
    ? "The pull request run left the legal-figure sweep out, so the unit shards run only the sweep files. "
    : "";
  const line = `Ward main reuse: ${reused.length ? `verified ${reused.join(", ")}` : "none verified"}. ${decision.reason}${decision.runUrl ? `: ${decision.runUrl}` : ""}. ${fresh.length ? `Running fresh ${fresh.join(", ")}. ` : ""}${sweepNote}Static checks and the secret scan still run.`;
  console.log(line);
  try {
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `${Object.entries(outputs)
          .map(([name, value]) => `${name}=${value}`)
          .join("\n")}\n`,
      );
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
  } catch (error) {
    console.log(`Could not record the decision (${error?.message ?? error}); the full suite runs.`);
  }
}
