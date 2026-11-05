import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { gateBatchArgs, gateBatchBlobPath } from "../scripts/check-ward-expected-reds.mjs";
import {
  backendProved,
  BUILT_TREE_TITLE,
  decideMainReuse,
  gatherAndDecide,
  mainReuseOutputs,
  runEvidenceGap,
  STRICT_BUDGET_TREE_TITLE,
  TESTED_TREE_TITLE,
  testedTreeFromAnnotations,
  treeAcrossAttempts,
  workflowCounts,
} from "../scripts/ward-ci-public/main-reuse.mjs";

const workflow = readFileSync(new URL("../.github/workflows/ward-flow.yml", import.meta.url), "utf8");
const counts = workflowCounts(workflow);
const repo = "BigSimmo/Ward-Flow";
const sha = "a".repeat(40);
const before = "b".repeat(40);
const head = "c".repeat(40);
const tree = "d".repeat(40);
const allGates = { unit: true, coverage: true, browser: true, release: true, build: true, backend: true };
const noGates = { unit: false, coverage: false, browser: false, release: false, build: false, backend: false };

const passedJob = (name: string, ...steps: string[]) => ({
  name,
  conclusion: "success",
  steps: steps.map((step) => ({ name: step, conclusion: "success" })),
});
function greenJobs() {
  return [
    ...Array.from({ length: counts["unit shard"] }, (_, i) =>
      passedJob(
        `Ward Flow unit shard ${i + 1}`,
        "Run reconciled unit suite shard",
        "Confirm the legal-figure sweep ran",
      ),
    ),
    ...Array.from({ length: counts["browser group"] }, (_, i) =>
      passedJob(`Ward Flow browser journeys ${i + 1}`, "Run Ward browser journeys"),
    ),
    passedJob("Ward Flow coverage", "Merge shard coverage and enforce thresholds"),
    passedJob("Ward Flow production build", "Build for production (Railway build command)"),
    ...["desktop", "phone"].map((device) =>
      passedJob(
        `Ward Flow release gate ${device} journeys, referrals and checks`,
        "Run the release-gate journeys",
        "Run the second release-gate suite",
        "Run the third release-gate suite",
      ),
    ),
    passedJob(
      "Ward Flow backend and shared production proof",
      "Run Ward backend tests",
      "Run the shared-mode browser journey",
    ),
    { name: "Ward Flow required", conclusion: "success", steps: [] },
  ];
}
function evidence(overrides: Record<string, unknown> = {}) {
  return {
    repo,
    sha,
    before,
    mainTree: tree,
    headTree: tree,
    counts,
    pulls: [
      {
        number: 75,
        merged_at: "2026-10-06T01:00:00Z",
        merge_commit_sha: sha,
        base: { ref: "main" },
        head: { sha: head, repo: { full_name: repo } },
      },
    ],
    compare: { status: "ahead", behind_by: 0 },
    runs: [
      {
        id: 1,
        html_url: "https://example.invalid/run/1",
        head_sha: head,
        event: "pull_request",
        conclusion: "success",
        builtTree: tree,
        strictBudgetTree: tree,
        jobs: greenJobs(),
      },
    ],
    ...overrides,
  };
}

describe("main-push reuse decision", () => {
  it("reads the shard and group counts the workflow declares", () => {
    expect(counts).toEqual({
      "unit shard": 4,
      "legal-figure sweep": 4,
      "browser group": 2,
      coverage: 1,
      "production build": 1,
      "release gate": "at least one",
    });
  });

  it("retains other gates when a pull request run left the legal-figure sweep out", () => {
    const withoutSweep = greenJobs().map((job) =>
      job.name === "Ward Flow unit shard 3"
        ? {
            ...job,
            steps: [
              { name: "Run reconciled unit suite shard", conclusion: "success" },
              { name: "Confirm the legal-figure sweep ran", conclusion: "skipped" },
            ],
          }
        : job,
    );
    expect(decideMainReuse(evidence({ runs: [{ ...evidence().runs[0], jobs: withoutSweep }] }))).toMatchObject({
      verified: false,
      gates: { ...allGates, unit: false, coverage: false },
    });
    expect(runEvidenceGap(withoutSweep, counts)).toBe("Ward Flow unit shard 3 did not run its checks (scope-skipped)");
  });

  it("verifies only an identical, up-to-date tree whose PR run really ran every reusable job", () => {
    expect(decideMainReuse(evidence())).toMatchObject({ verified: true, pr: 75 });
    // The current workflow needs merged shard coverage; an older single-job step does not prove it.
    const legacy = greenJobs().map((job) =>
      job.name === "Ward Flow coverage" ? passedJob(job.name, "Run unit suite with coverage thresholds") : job,
    );
    expect(decideMainReuse(evidence({ runs: [{ ...evidence().runs[0], jobs: legacy }] }))).toMatchObject({
      verified: false,
      gates: { ...allGates, coverage: false },
    });
  });

  it("reuses a head that was behind main when its run tested exactly this tree", () => {
    const behind = { headTree: "e".repeat(40), compare: { status: "diverged", behind_by: 2 } };
    const run = { ...evidence().runs[0], testedTree: tree, builtTree: tree };
    expect(decideMainReuse(evidence({ ...behind, runs: [run] }))).toMatchObject({ verified: true, pr: 75 });
    // The production build merges the then-current main; it must have built this same tree.
    expect(decideMainReuse(evidence({ ...behind, runs: [{ ...run, builtTree: "f".repeat(40) }] }))).toMatchObject({
      verified: false,
      gates: { ...allGates, build: false },
      reasons: { build: expect.stringContaining("built tree") },
    });
    expect(decideMainReuse(evidence({ ...behind, runs: [{ ...run, builtTree: null }] }))).toMatchObject({
      verified: false,
      gates: { ...allGates, build: false },
      reasons: { build: expect.stringContaining("built tree") },
    });
    // Main moved after the run: its merge ref was a different tree, so the suite runs again.
    expect(decideMainReuse(evidence({ ...behind, runs: [{ ...run, testedTree: "f".repeat(40) }] }))).toMatchObject({
      verified: false,
      gates: { ...noGates, build: true },
      reasons: { unit: expect.stringContaining("tested tree") },
    });
    // A run from before the notice existed proves nothing for a head that was behind.
    expect(decideMainReuse(evidence({ ...behind, runs: [{ ...run, testedTree: null }] })).verified).toBe(false);
    // The recorded tree never excuses missing job evidence.
    const jobs = greenJobs().filter((job) => job.name !== "Ward Flow coverage");
    expect(decideMainReuse(evidence({ ...behind, runs: [{ ...run, jobs }] })).verified).toBe(false);
  });

  it("reads a run's recorded tree across every attempt, so a re-run that wrote no notice still counts", () => {
    const notice = { title: TESTED_TREE_TITLE, annotation_level: "notice", message: tree };
    // 4 Nov 2026 (PR #1329): the budget recheck re-ran the run; attempt 2's plan job had no annotation.
    expect(treeAcrossAttempts([[notice], []], TESTED_TREE_TITLE)).toBe(tree);
    expect(treeAcrossAttempts([[], [notice]], TESTED_TREE_TITLE)).toBe(tree);
    // Attempts that disagree, or any malformed record, refuse.
    expect(treeAcrossAttempts([[notice], [{ ...notice, message: "e".repeat(40) }]], TESTED_TREE_TITLE)).toBeNull();
    expect(treeAcrossAttempts([[notice], [{ ...notice, message: "nope" }]], TESTED_TREE_TITLE)).toBeNull();
    expect(treeAcrossAttempts([[], []], TESTED_TREE_TITLE)).toBeNull();
    expect(treeAcrossAttempts([[notice]], BUILT_TREE_TITLE)).toBeNull();
    expect(treeAcrossAttempts([[{ ...notice, title: BUILT_TREE_TITLE }]], BUILT_TREE_TITLE)).toBe(tree);
  });

  it("reports backend reuse only when the PR run really ran the backend tests", () => {
    expect(decideMainReuse(evidence())).toMatchObject({ verified: true, backendVerified: true });
    const withoutBackend = greenJobs().filter((job) => job.name !== "Ward Flow backend and shared production proof");
    const verdict = decideMainReuse(evidence({ runs: [{ ...evidence().runs[0], jobs: withoutBackend }] }));
    expect(verdict).toMatchObject({ verified: true, backendVerified: false });
    expect(
      backendProved(
        greenJobs().map((job) =>
          job.name.startsWith("Ward Flow backend")
            ? { ...job, steps: [{ name: "Run Ward backend tests", conclusion: "skipped" }] }
            : job,
        ),
      ),
    ).toBe(false);
    expect(decideMainReuse(evidence({ runs: [] }))).not.toHaveProperty("backendVerified", true);
  });

  it("requires at least one release-gate leg that really ran", () => {
    const noGate = greenJobs().filter((job) => !job.name.startsWith("Ward Flow release gate"));
    expect(runEvidenceGap(noGate, counts)).toBe("no release gate job proved");
    const failedGate = greenJobs().map((job) =>
      job.name.startsWith("Ward Flow release gate") ? { ...job, conclusion: "failure" } : job,
    );
    expect(runEvidenceGap(failedGate, counts)).toMatch(/release gate .* did not succeed/u);
  });

  it("reads the tested tree only from one notice with the exact title", () => {
    const notice = { title: TESTED_TREE_TITLE, annotation_level: "notice", message: `${tree}\n` };
    expect(testedTreeFromAnnotations([notice])).toBe(tree);
    expect(testedTreeFromAnnotations([notice, { ...notice, message: "e".repeat(40) }])).toBeNull();
    expect(testedTreeFromAnnotations([{ ...notice, annotation_level: "warning" }])).toBeNull();
    expect(testedTreeFromAnnotations([{ ...notice, title: "Other" }])).toBeNull();
    expect(testedTreeFromAnnotations([{ ...notice, message: "not-a-tree" }])).toBeNull();
    expect(testedTreeFromAnnotations(null)).toBeNull();
  });

  it("refuses an older green contradicted by a newer completed failure", () => {
    const green = { ...evidence().runs[0], updated_at: "2026-10-06T01:00:00Z" };
    const failed = { ...green, id: 2, conclusion: "failure", updated_at: "2026-10-06T02:00:00Z" };
    for (const runs of [
      [green, failed],
      [failed, green],
    ]) {
      expect(decideMainReuse(evidence({ runs }))).toMatchObject({
        verified: false,
        reason: "newer completed run 2 concluded failure",
      });
    }
  });

  it("accepts a later complete green after an earlier failure", () => {
    const green = { ...evidence().runs[0], updated_at: "2026-10-06T02:00:00Z" };
    const failed = { ...green, id: 2, conclusion: "failure", updated_at: "2026-10-06T01:00:00Z" };
    expect(decideMainReuse(evidence({ runs: [failed, green] })).verified).toBe(true);
  });

  it("orders reruns by the latest attempt update rather than run ID or creation time", () => {
    const green = {
      ...evidence().runs[0],
      id: 20,
      created_at: "2026-10-06T02:00:00Z",
      updated_at: "2026-10-06T02:00:00Z",
    };
    const failedRerun = {
      ...green,
      id: 10,
      run_attempt: 2,
      conclusion: "failure",
      created_at: "2026-10-06T01:00:00Z",
      updated_at: "2026-10-06T03:00:00Z",
    };
    expect(decideMainReuse(evidence({ runs: [green, failedRerun] })).verified).toBe(false);
    const recoveredRerun = { ...failedRerun, run_attempt: 3, conclusion: "success", jobs: greenJobs() };
    expect(decideMainReuse(evidence({ runs: [green, recoveredRerun] })).verified).toBe(true);
  });

  it("fails closed when completed runs cannot be ordered reliably", () => {
    const green = { ...evidence().runs[0], updated_at: "2026-10-06T01:00:00Z" };
    for (const updated_at of [undefined, "invalid", green.updated_at]) {
      const failed = { ...green, id: 2, conclusion: "failure", updated_at };
      expect(decideMainReuse(evidence({ runs: [green, failed] }))).toMatchObject({
        verified: false,
        reason: "completed run ordering is unavailable or ambiguous",
      });
    }
  });

  it("does not treat other heads, other events or unfinished runs as completed contradictions", () => {
    const green = evidence().runs[0];
    const failed = { ...green, id: 2, conclusion: "failure" };
    for (const unrelated of [
      { ...failed, head_sha: "f".repeat(40) },
      { ...failed, event: "workflow_dispatch" },
      { ...failed, status: "in_progress", conclusion: null },
    ]) {
      expect(decideMainReuse(evidence({ runs: [unrelated, green] })).verified).toBe(true);
    }
  });

  it.each([
    ["a different tree", { headTree: "e".repeat(40) }],
    ["a head that did not contain the previous main", { compare: { status: "diverged", behind_by: 1 } }],
    ["no compare result", { compare: null }],
    ["no previous main commit", { before: "0".repeat(40) }],
    ["no owning pull request", { pulls: [] }],
    ["a fork head", { pulls: [{ ...evidence().pulls[0], head: { sha: head, repo: { full_name: "x/y" } } }] }],
    ["an unmerged pull request", { pulls: [{ ...evidence().pulls[0], merged_at: null }] }],
    ["a pull request into another branch", { pulls: [{ ...evidence().pulls[0], base: { ref: "other" } }] }],
    ["no green run", { runs: [] }],
    ["a failed run", { runs: [{ ...evidence().runs[0], conclusion: "failure" }] }],
    ["a run on another head", { runs: [{ ...evidence().runs[0], head_sha: "f".repeat(40) }] }],
  ])("refuses %s", (_label, overrides) => {
    expect(decideMainReuse(evidence(overrides)).verified).toBe(false);
  });

  it("refuses a run whose scope planner skipped any reusable job's real work", () => {
    for (const index of greenJobs().keys()) {
      const jobs = greenJobs();
      if (jobs[index].name === "Ward Flow required" || jobs[index].name.startsWith("Ward Flow backend")) continue;
      jobs[index] = { ...jobs[index], steps: [{ name: jobs[index].steps[0].name, conclusion: "skipped" }] };
      expect(runEvidenceGap(jobs, counts), jobs[index].name).toMatch(/did not run its checks/u);
    }
  });

  it("refuses a run missing a shard or group, or whose required job did not pass", () => {
    expect(
      runEvidenceGap(
        greenJobs().filter((job) => job.name !== "Ward Flow unit shard 3"),
        counts,
      ),
    ).toMatch(/3 of 4 unit shard/u);
    expect(
      runEvidenceGap(
        greenJobs().filter((job) => job.name !== "Ward Flow browser journeys 2"),
        counts,
      ),
    ).toMatch(/1 of 2 browser group/u);
    // A run recorded under the old six-shard, three-group layout proves a different split: run fresh.
    const oldLayout = [
      ...greenJobs(),
      ...[5, 6].map((shard) =>
        passedJob(
          `Ward Flow unit shard ${shard}`,
          "Run reconciled unit suite shard",
          "Confirm the legal-figure sweep ran",
        ),
      ),
    ];
    expect(runEvidenceGap(oldLayout, counts)).toMatch(/6 of 4 unit shard/u);
    const jobs = greenJobs().map((job) =>
      job.name === "Ward Flow required" ? { ...job, conclusion: "failure" } : job,
    );
    expect(runEvidenceGap(jobs, counts)).toMatch(/required did not succeed/u);
  });

  it("reuses mixed evidence independently and couples unit/coverage only in workflow outputs", () => {
    const jobs = greenJobs().filter(
      (job) => job.name !== "Ward Flow coverage" && job.name !== "Ward Flow browser journeys 2",
    );
    jobs.find((job) => job.name.startsWith("Ward Flow release gate phone"))!.steps[1].conclusion = "skipped";
    jobs.find((job) => job.name.startsWith("Ward Flow backend"))!.steps.pop();
    const result = decideMainReuse(evidence({ runs: [{ ...evidence().runs[0], jobs }] }));
    expect(result).toMatchObject({
      verified: false,
      gates: { unit: true, coverage: false, browser: false, release: false, backend: false, build: true },
    });
    expect(mainReuseOutputs(result)).toEqual({
      verified: false,
      unit_verified: false,
      coverage_verified: false,
      browser_verified: false,
      release_verified: false,
      backend_verified: false,
      build_verified: true,
    });
  });

  it.each([undefined, null, "e".repeat(40)])(
    "requires strict-budget proof even for an up-to-date head (%s)",
    (strictBudgetTree) => {
      const result = decideMainReuse(evidence({ runs: [{ ...evidence().runs[0], strictBudgetTree }] }));
      expect(result).toMatchObject({ verified: false, gates: { ...allGates, build: false } });
      expect(result.reasons.build).toMatch(/strict budget/iu);
    },
  );

  it("requires recorded build-tree proof even for an up-to-date head", () => {
    const result = decideMainReuse(evidence({ runs: [{ ...evidence().runs[0], builtTree: null }] }));
    expect(result).toMatchObject({ verified: false, gates: { ...allGates, build: false } });
  });

  it.each([null, "f".repeat(40)])(
    "does not overwrite invalid or contradictory tested-tree evidence with the up-to-date fallback (%s)",
    (testedTree) => {
      const result = decideMainReuse(evidence({ runs: [{ ...evidence().runs[0], testedTree }] }));
      expect(result.gates).toEqual({ ...noGates, build: true });
    },
  );

  it("never fills missing evidence on the newest green from an older complete green", () => {
    const older = { ...evidence().runs[0], updated_at: "2026-10-06T01:00:00Z" };
    const jobs = greenJobs();
    jobs[0].steps.pop();
    const newest = { ...older, id: 2, updated_at: "2026-10-06T02:00:00Z", strictBudgetTree: null, jobs };
    for (const runs of [
      [older, newest],
      [newest, older],
    ]) {
      expect(decideMainReuse(evidence({ runs }))).toMatchObject({
        verified: false,
        gates: { ...allGates, unit: false, coverage: false, build: false },
      });
    }
  });

  it("requires a successful required job before any partial reuse, without falling back to older green", () => {
    const older = { ...evidence().runs[0], updated_at: "2026-10-06T01:00:00Z" };
    const newest = {
      ...older,
      id: 2,
      updated_at: "2026-10-06T02:00:00Z",
      jobs: greenJobs().filter((job) => job.name !== "Ward Flow required"),
    };
    const result = decideMainReuse(evidence({ runs: [older, newest] }));
    expect(result).toMatchObject({ verified: false, gates: noGates });
    expect(mainReuseOutputs(result)).toEqual({
      verified: false,
      unit_verified: false,
      coverage_verified: false,
      browser_verified: false,
      release_verified: false,
      backend_verified: false,
      build_verified: false,
    });
  });

  it("clears every gate on an ownership refusal", () => {
    const result = decideMainReuse(evidence({ pulls: [{ ...evidence().pulls[0], merge_commit_sha: "f".repeat(40) }] }));
    expect(result.gates).toEqual(noGates);
  });
});

async function gatherSynthetic(
  overrides: {
    incomplete?: "runs" | "latest jobs" | "all jobs";
    latestStrict?: boolean;
    warningStrict?: boolean;
    testedAnnotations?: "absent" | "malformed" | "conflicting";
    apiError?: boolean;
  } = {},
) {
  const jobs = greenJobs().map((job, index) => ({ ...job, id: 200 + index }));
  const build = jobs.find((job) => job.name === "Ward Flow production build")!;
  const all = [
    { name: "Ward Flow scope plan", id: 100 },
    ...(overrides.testedAnnotations === "conflicting" ? [{ name: "Ward Flow scope plan", id: 110 }] : []),
    { ...build, id: 101 },
    ...jobs,
  ];
  const notice = (title: string, annotation_level = "notice") => ({ title, annotation_level, message: tree });
  const api = async (path: string) => {
    if (overrides.apiError) throw new Error("synthetic API failure");
    if (path === `/commits/${sha}/pulls`) return evidence().pulls;
    if (path === `/git/commits/${head}`) return { tree: { sha: tree } };
    if (path.startsWith("/compare/")) return evidence().compare;
    if (path.startsWith("/actions/workflows/"))
      return { total_count: overrides.incomplete === "runs" ? 2 : 1, workflow_runs: evidence().runs };
    if (path === "/actions/runs/1/jobs?filter=latest&per_page=100")
      return { total_count: jobs.length + Number(overrides.incomplete === "latest jobs"), jobs };
    if (path === "/actions/runs/1/jobs?filter=all&per_page=100")
      return { total_count: all.length + Number(overrides.incomplete === "all jobs"), jobs: all };
    if (path === "/check-runs/100/annotations?per_page=50") {
      if (overrides.testedAnnotations === "absent") return [];
      return [
        { ...notice(TESTED_TREE_TITLE), message: overrides.testedAnnotations === "malformed" ? "not-a-tree" : tree },
      ];
    }
    if (path === "/check-runs/110/annotations?per_page=50")
      return [{ ...notice(TESTED_TREE_TITLE), message: "e".repeat(40) }];
    // An older attempt's strong build/budget proof must never fill gaps in the latest attempt.
    if (path === "/check-runs/101/annotations?per_page=50")
      return [notice(BUILT_TREE_TITLE), notice(STRICT_BUDGET_TREE_TITLE)];
    if (path === `/check-runs/${build.id}/annotations?per_page=50`)
      return [
        notice(BUILT_TREE_TITLE),
        ...(overrides.latestStrict === false
          ? []
          : [notice(STRICT_BUDGET_TREE_TITLE, overrides.warningStrict ? "warning" : "notice")]),
      ];
    throw new Error(`unexpected synthetic API path: ${path}`);
  };
  return gatherAndDecide({
    env: {
      GITHUB_EVENT_NAME: "push",
      GITHUB_REF: "refs/heads/main",
      GITHUB_REPOSITORY: repo,
      GITHUB_SHA: sha,
      WARD_BEFORE_SHA: before,
      GH_TOKEN: "synthetic-test-token",
    },
    api,
    git: (args: string[]) => (args.includes("HEAD^{tree}") ? tree : sha),
  });
}

describe("bounded offline main reuse gathering", () => {
  it("gathers the latest successful build's exact strict-budget receipt", async () => {
    expect(await gatherSynthetic()).toMatchObject({ verified: true, gates: allGates });
  });

  it("uses the up-to-date fallback only when the complete attempt history contains no tested-tree notice", async () => {
    expect(await gatherSynthetic({ testedAnnotations: "absent" })).toMatchObject({ verified: true, gates: allGates });
  });

  it.each(["malformed", "conflicting"] as const)(
    "retains only independent build proof when tested-tree annotations are %s",
    async (testedAnnotations) => {
      expect(await gatherSynthetic({ testedAnnotations })).toMatchObject({
        verified: false,
        gates: { ...noGates, build: true },
      });
    },
  );

  it.each([{ latestStrict: false }, { warningStrict: true }])(
    "does not reuse a warning-only or historical strict-budget receipt (%s)",
    async (overrides) => {
      expect(await gatherSynthetic(overrides)).toMatchObject({ verified: false, gates: { ...allGates, build: false } });
    },
  );

  it.each(["runs", "latest jobs", "all jobs"] as const)("refuses incomplete bounded %s history", async (incomplete) => {
    expect(await gatherSynthetic({ incomplete })).toMatchObject({ verified: false, gates: noGates });
  });

  it("returns all gates false after an API error", async () => {
    expect(await gatherSynthetic({ apiError: true })).toMatchObject({
      verified: false,
      gates: noGates,
      reason: expect.stringContaining("synthetic API failure"),
    });
  });
});

describe("unit shard coverage blobs", () => {
  const files = ["tests/a.test.ts", "tests/b.test.ts"];

  it("keeps the gate's JSON-only run unchanged without a blob directory", () => {
    expect(gateBatchArgs({ files, batchReport: "/r.json", coverageBlobDir: "", shard: null, batchIndex: 0 })).toEqual([
      "run",
      "--pool=forks",
      "--reporter=json",
      "--outputFile=/r.json",
      ...files,
    ]);
  });

  it("adds coverage and a uniquely named blob per shard batch, keeping the gate's JSON report", () => {
    const args = gateBatchArgs({
      files,
      batchReport: "/r.json",
      coverageBlobDir: "/blobs",
      shard: { index: 2, count: 5 },
      batchIndex: 0,
    });
    expect(args).toContain("--reporter=json");
    expect(args).toContain("--outputFile.json=/r.json");
    expect(args).toContain("--reporter=blob");
    expect(args).toContain("--coverage.enabled=true");
    expect(gateBatchBlobPath(args)).toBe(join("/blobs", "blob-shard-2-of-5-batch-001.json"));
    expect(args.slice(-2)).toEqual(files);
  });

  it("refuses coverage blobs outside a shard", () => {
    expect(() =>
      gateBatchArgs({ files, batchReport: "/r.json", coverageBlobDir: "/blobs", shard: null, batchIndex: 0 }),
    ).toThrow(/WARD_GATE_SHARD/u);
  });

  it("drops the thresholds only for a shard's slice, never for the merging coverage job", () => {
    const config = readFileSync(new URL("../vitest.config.mts", import.meta.url), "utf8");
    expect(config).toContain(
      "if (process.env.WARD_COVERAGE_BLOB_DIR) delete (config.test.coverage as { thresholds?: unknown }).thresholds;",
    );
    const coverageJob = workflow.slice(workflow.indexOf("\n  coverage:\n"), workflow.indexOf("\n  required:\n"));
    expect(coverageJob).not.toContain("WARD_COVERAGE_BLOB_DIR");
    expect(coverageJob).toContain('--merge-reports="$WARD_SHARD_BLOBS" --coverage');
  });
});
