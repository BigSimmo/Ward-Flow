import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { gateBatchArgs, gateBatchBlobPath } from "../scripts/check-ward-expected-reds.mjs";
import { decideMainReuse, runEvidenceGap, workflowCounts } from "../scripts/ward-ci-public/main-reuse.mjs";

const workflow = readFileSync(new URL("../.github/workflows/ward-flow.yml", import.meta.url), "utf8");
const counts = workflowCounts(workflow);
const repo = "BigSimmo/Ward-Flow";
const sha = "a".repeat(40);
const before = "b".repeat(40);
const head = "c".repeat(40);
const tree = "d".repeat(40);

const passedJob = (name: string, step: string) => ({
  name,
  conclusion: "success",
  steps: [{ name: step, conclusion: "success" }],
});
function greenJobs() {
  return [
    ...Array.from({ length: counts["unit shard"] }, (_, i) =>
      passedJob(`Ward Flow unit shard ${i + 1}`, "Run reconciled unit suite shard"),
    ),
    ...Array.from({ length: counts["browser group"] }, (_, i) =>
      passedJob(`Ward Flow browser journeys ${i + 1}`, "Run Ward browser journeys"),
    ),
    passedJob("Ward Flow coverage", "Merge shard coverage and enforce thresholds"),
    passedJob("Ward Flow production build", "Build for production (Railway build command)"),
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
    expect(counts).toEqual({ "unit shard": 5, "browser group": 3, coverage: 1, "production build": 1 });
  });

  it("verifies only an identical, up-to-date tree whose PR run really ran every reusable job", () => {
    expect(decideMainReuse(evidence())).toMatchObject({ verified: true, pr: 75 });
    // The single-job coverage run that preceded the shard merge is equally strong evidence.
    const legacy = greenJobs().map((job) =>
      job.name === "Ward Flow coverage" ? passedJob(job.name, "Run unit suite with coverage thresholds") : job,
    );
    expect(decideMainReuse(evidence({ runs: [{ ...evidence().runs[0], jobs: legacy }] })).verified).toBe(true);
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
      if (jobs[index].name === "Ward Flow required") continue;
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
    ).toMatch(/4 of 5 unit shard/u);
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
    expect(gateBatchBlobPath(args)).toBe("/blobs/blob-shard-2-of-5-batch-001.json");
    expect(args.slice(-2)).toEqual(files);
  });

  it("refuses coverage blobs outside a shard", () => {
    expect(() =>
      gateBatchArgs({ files, batchReport: "/r.json", coverageBlobDir: "/blobs", shard: null, batchIndex: 0 }),
    ).toThrow(/WARD_GATE_SHARD/u);
  });

  it("drops the thresholds only for a shard's slice, never for the merging coverage job", () => {
    const config = readFileSync(new URL("../vitest.config.mts", import.meta.url), "utf8");
    expect(config).toMatch(/thresholds: process\.env\.WARD_COVERAGE_BLOB_DIR\s*\?\s*undefined\s*:\s*\{/u);
    const coverageJob = workflow.slice(workflow.indexOf("\n  coverage:\n"), workflow.indexOf("\n  required:\n"));
    expect(coverageJob).not.toContain("WARD_COVERAGE_BLOB_DIR");
    expect(coverageJob).toContain('--merge-reports="$WARD_SHARD_BLOBS" --coverage');
  });
});
