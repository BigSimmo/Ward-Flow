import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { gateBatchArgs, gateBatchBlobPath } from "../scripts/check-ward-expected-reds.mjs";
import {
  backendProved,
  BUILT_TREE_TITLE,
  decideMainReuse,
  runEvidenceGap,
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
    passedJob("Ward Flow release gate release-gate-desktop journeys", "Run the release-gate journeys"),
    passedJob("Ward Flow release gate release-gate-phone journeys", "Run the release-gate journeys"),
    passedJob("Ward Flow backend and shared production proof", "Run Ward backend tests"),
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
        jobs: greenJobs(),
      },
    ],
    ...overrides,
  };
}

describe("main-push reuse decision", () => {
  it("reads the shard and group counts the workflow declares", () => {
    expect(counts).toEqual({
      "unit shard": 6,
      "legal-figure sweep": 6,
      "browser group": 3,
      coverage: 1,
      "production build": 1,
      "release gate": "at least one",
    });
  });

  it("refuses a pull request run that left the legal-figure sweep out", () => {
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
    });
    expect(runEvidenceGap(withoutSweep, counts)).toBe("Ward Flow unit shard 3 did not run its checks (scope-skipped)");
  });

  it("verifies only an identical, up-to-date tree whose PR run really ran every reusable job", () => {
    expect(decideMainReuse(evidence())).toMatchObject({ verified: true, pr: 75 });
    // The single-job coverage run that preceded the shard merge is equally strong evidence.
    const legacy = greenJobs().map((job) =>
      job.name === "Ward Flow coverage" ? passedJob(job.name, "Run unit suite with coverage thresholds") : job,
    );
    expect(decideMainReuse(evidence({ runs: [{ ...evidence().runs[0], jobs: legacy }] })).verified).toBe(true);
  });

  it("reuses a head that was behind main when its run tested exactly this tree", () => {
    const behind = { headTree: "e".repeat(40), compare: { status: "diverged", behind_by: 2 } };
    const run = { ...evidence().runs[0], testedTree: tree, builtTree: tree };
    expect(decideMainReuse(evidence({ ...behind, runs: [run] }))).toMatchObject({ verified: true, pr: 75 });
    // The production build merges the then-current main; it must have built this same tree.
    expect(decideMainReuse(evidence({ ...behind, runs: [{ ...run, builtTree: "f".repeat(40) }] }))).toMatchObject({
      verified: false,
      reason: expect.stringContaining("built a different tree"),
    });
    expect(decideMainReuse(evidence({ ...behind, runs: [{ ...run, builtTree: null }] }))).toMatchObject({
      verified: false,
      reason: expect.stringContaining("recorded no single built tree"),
    });
    // Main moved after the run: its merge ref was a different tree, so the suite runs again.
    expect(decideMainReuse(evidence({ ...behind, runs: [{ ...run, testedTree: "f".repeat(40) }] }))).toMatchObject({
      verified: false,
      reason: expect.stringContaining("tested a different tree"),
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
    ).toMatch(/5 of 6 unit shard/u);
    expect(
      runEvidenceGap(
        greenJobs().filter((job) => job.name !== "Ward Flow browser journeys 2"),
        counts,
      ),
    ).toMatch(/2 of 3 browser group/u);
    const jobs = greenJobs().map((job) =>
      job.name === "Ward Flow required" ? { ...job, conclusion: "failure" } : job,
    );
    expect(runEvidenceGap(jobs, counts)).toMatch(/required did not succeed/u);
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
