import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { decide, listOpenPullRequests } from "../scripts/ward-ci-public/budget-recheck.mjs";
import { mergeLatestMain } from "../scripts/ward-ci-public/merge-latest-main.mjs";

const since = Date.parse("2026-10-21T06:00:00Z");
const armed = { draft: false, auto_merge: { merge_method: "merge" } };
const build = (fields: Record<string, unknown>) => ({ id: 7, name: "Ward Flow production build", ...fields });
const done = { status: "completed" };

describe("budget recheck: which pull requests re-measure when main moves", () => {
  it("reads every page of open pull requests, not just the first 100", async () => {
    const paths: string[] = [];
    const api = async (path: string) => {
      paths.push(path);
      const page = Number(new URL(path, "https://example.invalid").searchParams.get("page"));
      const size = page === 1 ? 100 : page === 2 ? 3 : 0;
      return Array.from({ length: size }, (_, index) => ({ number: page * 1000 + index }));
    };
    const prs = await listOpenPullRequests(api);
    expect(prs).toHaveLength(103);
    expect(paths).toEqual([
      "/pulls?state=open&base=main&per_page=100&page=1",
      "/pulls?state=open&base=main&per_page=100&page=2",
    ]);
  });

  it("re-runs a finished build that measured an older main", () => {
    expect(
      decide(
        armed,
        done,
        [build({ status: "completed", conclusion: "success", started_at: "2026-10-21T05:00:00Z" })],
        since,
      ),
    ).toEqual({ action: "rerun", jobId: 7 });
  });

  it("re-runs a failed build too, so the verdict is about the current main", () => {
    expect(
      decide(
        armed,
        done,
        [build({ status: "completed", conclusion: "failure", started_at: "2026-10-21T05:00:00Z" })],
        since,
      ).action,
    ).toBe("rerun");
  });

  it("leaves a build that started after main moved", () => {
    expect(
      decide(
        armed,
        done,
        [build({ status: "completed", conclusion: "success", started_at: "2026-10-21T06:01:00Z" })],
        since,
      ).action,
    ).toBe("skip");
  });

  it("waits for a run whose build started before main moved", () => {
    expect(
      decide(
        armed,
        { status: "in_progress" },
        [build({ status: "in_progress", started_at: "2026-10-21T05:59:00Z" })],
        since,
      ),
    ).toEqual({ action: "wait" });
  });

  it("leaves a run whose build has not started (it will fetch the new main)", () => {
    expect(
      decide(armed, { status: "in_progress" }, [build({ status: "queued", started_at: null })], since).action,
    ).toBe("skip");
  });

  it("leaves drafts, unarmed PRs and out-of-scope builds alone", () => {
    const old = [build({ status: "completed", conclusion: "success", started_at: "2026-10-21T05:00:00Z" })];
    expect(decide({ ...armed, draft: true }, done, old, since).action).toBe("skip");
    expect(decide({ draft: false, auto_merge: null }, done, old, since).action).toBe("skip");
    expect(
      decide(armed, done, [build({ status: "completed", conclusion: "skipped", started_at: null })], since).action,
    ).toBe("skip");
    expect(decide(armed, undefined, [], since).action).toBe("skip");
  });
});

describe("budget recheck workflow", () => {
  const workflow = readFileSync(new URL("../.github/workflows/ward-flow-budget-recheck.yml", import.meta.url), "utf8");

  it("runs on pushes to main and auto-merge arming only, with main's own script and no write access beyond re-running jobs", () => {
    expect(workflow).toMatch(
      /^on:\n {2}push:\n {4}branches: \[main\]\n {2}pull_request_target:\n {4}types: \[auto_merge_enabled\]\n {4}branches: \[main\]\n\n/mu,
    );
    // pull_request_target must only ever run main's script: no PR ref, head or repository checkout.
    expect(workflow).toMatch(/^ {10}ref: main$/mu);
    expect(workflow).not.toMatch(/github\.event\.pull_request\.head|github\.head_ref|repository: \$\{\{/u);
    expect(workflow).toMatch(/^permissions:\n {2}contents: read\n {2}actions: write\n {2}pull-requests: read\n\n/mu);
    expect(workflow).not.toMatch(/contents: write|pull-requests: write|secrets\./u);
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("run: node scripts/ward-ci-public/budget-recheck.mjs");
  });

  it("never touches auto-merge state", () => {
    const script = readFileSync(new URL("../scripts/ward-ci-public/budget-recheck.mjs", import.meta.url), "utf8");
    expect(script).not.toMatch(
      /auto_merge"?\s*[:=]\s*|enablePullRequestAutoMerge|disablePullRequestAutoMerge|\/merge"/u,
    );
    expect(script).toMatch(/\/actions\/jobs\/\$\{verdict\.jobId\}\/rerun/u);
  });
});

describe("merge-latest-main", () => {
  const script = path.resolve("scripts/ward-ci-public/merge-latest-main.mjs");
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, encoding: "utf8" }).trim();

  function repos(conflict: boolean) {
    const root = mkdtempSync(path.join(tmpdir(), "ward-merge-main-"));
    const origin = path.join(root, "origin");
    git(root, "init", "-q", "-b", "main", origin);
    writeFileSync(path.join(origin, "a.txt"), "base\n");
    git(origin, "add", ".");
    git(origin, "commit", "-qm", "base");
    const pr = path.join(root, "pr");
    git(root, "clone", "-q", origin, pr);
    git(pr, "checkout", "-qb", "feature");
    writeFileSync(path.join(pr, conflict ? "a.txt" : "b.txt"), "feature\n");
    git(pr, "add", ".");
    git(pr, "commit", "-qm", "feature");
    writeFileSync(path.join(origin, "a.txt"), "main moved\n");
    git(origin, "commit", "-qam", "main moved");
    return { origin, pr };
  }

  it("measures on the PR merged with main as it is now", () => {
    const { origin, pr } = repos(false);
    const result = mergeLatestMain(pr);
    expect(result).toEqual({ main: git(origin, "rev-parse", "HEAD"), merged: true });
    expect(readFileSync(path.join(pr, "a.txt"), "utf8")).toBe("main moved\n");
    expect(readFileSync(path.join(pr, "b.txt"), "utf8")).toBe("feature\n");
  });

  it("fails the build when the PR conflicts with main", () => {
    const { pr } = repos(true);
    expect(() => mergeLatestMain(pr)).toThrow(/conflicts with main/u);
  });

  it("fails the CI step (exit 1) on a conflict", () => {
    const { pr } = repos(true);
    const result = spawnSync(process.execPath, [script], { cwd: pr, encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/::error::This pull request conflicts with main/u);
  });
});
