import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  budgetMainFromAnnotations,
  decide,
  listOpenPullRequests,
  withBudgetMainReceipt,
} from "../scripts/ward-ci-public/budget-recheck.mjs";
import { mergeLatestMain } from "../scripts/ward-ci-public/merge-latest-main.mjs";

const since = Date.parse("2026-10-21T06:00:00Z");
const armed = { draft: false, auto_merge: { merge_method: "merge" } };
const build = (fields: Record<string, unknown>) => ({ id: 7, name: "Ward Flow production build", ...fields });
const done = { status: "completed" };
const mainSha = "a".repeat(40);

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

  it("never re-runs a run for an older head, which would cancel the current head's run", () => {
    const finished = [build({ status: "completed", conclusion: "success", started_at: "2026-10-21T05:00:00Z" })];
    expect(decide({ ...armed, head: { sha: "new" } }, { ...done, head_sha: "old" }, finished, since)).toEqual({
      action: "skip",
      reason: "run is for an older head",
    });
    expect(decide({ ...armed, head: { sha: "new" } }, { ...done, head_sha: "new" }, finished, since)).toEqual({
      action: "rerun",
      jobId: 7,
    });
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

  it("does not repeat a build that recorded this exact main before a delayed recheck started", () => {
    expect(
      decide(armed, done, [build({ budgetMainSha: mainSha, started_at: "2026-10-21T05:00:00Z" })], since, mainSha),
    ).toEqual({
      action: "skip",
      reason: "build already measured the current main",
    });
  });

  it("does not let a later start time override a different recorded main", () => {
    const jobs = [build({ budgetMainSha: "b".repeat(40), started_at: "2026-10-21T06:01:00Z" })];
    expect(decide(armed, done, jobs, since, mainSha)).toEqual({ action: "rerun", jobId: 7 });
    expect(decide(armed, { status: "in_progress" }, jobs, since, mainSha)).toEqual({ action: "wait" });
  });

  it.each(
    [undefined, null, "", "not-a-sha", mainSha.toUpperCase(), [mainSha]].map((budgetMainSha) => ({ budgetMainSha })),
  )("keeps the legacy timestamp fallback for an unusable receipt %j", ({ budgetMainSha }) => {
    expect(
      decide(armed, done, [build({ budgetMainSha, started_at: "2026-10-21T05:00:00Z" })], since, mainSha).action,
    ).toBe("rerun");
    expect(decide(armed, done, [build({ budgetMainSha, started_at: "2026-10-21T06:01:00Z" })], since, mainSha)).toEqual(
      {
        action: "skip",
        reason: "build started after main moved",
      },
    );
  });

  it("does not let matching main evidence bypass draft, auto-merge or current-head ownership", () => {
    const jobs = [build({ budgetMainSha: mainSha, started_at: "2026-10-21T05:00:00Z" })];
    expect(decide({ ...armed, draft: true }, done, jobs, since, mainSha).reason).toBe("draft");
    expect(decide({ ...armed, auto_merge: null }, done, jobs, since, mainSha).reason).toBe("auto-merge not armed");
    expect(decide({ ...armed, head: { sha: "new" } }, { ...done, head_sha: "old" }, jobs, since, mainSha).reason).toBe(
      "run is for an older head",
    );
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

describe("budget recheck measured-main evidence", () => {
  const notice = (message = mainSha) => ({ title: "Ward budget main", annotation_level: "notice", message });

  it("reads one exact measured-main notice and ignores unrelated annotations", () => {
    expect(budgetMainFromAnnotations([notice(), { ...notice(), title: "Unrelated notice" }])).toBe(mainSha);
  });

  it.each(
    [
      null,
      [],
      [notice("not-a-sha")],
      [{ ...notice(), annotation_level: "warning" }],
      [{ ...notice(), message: null }],
      [notice(), notice()],
      [notice(), notice("b".repeat(40))],
    ].map((annotations) => ({ annotations })),
  )("refuses missing, malformed or ambiguous notices %j", ({ annotations }) => {
    expect(budgetMainFromAnnotations(annotations)).toBeNull();
  });

  it("reads annotations only from the latest build whose producer step actually succeeded", async () => {
    const jobs = [build({ steps: [{ name: "Record the measured main", conclusion: "success" }] })];
    const paths: string[] = [];
    const result = await withBudgetMainReceipt(jobs, async (path: string) => {
      paths.push(path);
      return [notice()];
    });
    expect(paths).toEqual(["/check-runs/7/annotations?per_page=100"]);
    expect(result[0]).toMatchObject({ budgetMainSha: mainSha });
    expect(jobs[0]).not.toHaveProperty("budgetMainSha");
  });

  it.each(["skipped", "failure", undefined])(
    "does not read an annotation when the producer step is %s",
    async (conclusion) => {
      const jobs = [build({ steps: [{ name: "Record the measured main", conclusion }] })];
      let calls = 0;
      expect(
        await withBudgetMainReceipt(jobs, async () => {
          calls++;
          return [notice()];
        }),
      ).toEqual(jobs);
      expect(calls).toBe(0);
    },
  );

  it("does not accept a possibly truncated annotation page as exact evidence", async () => {
    const jobs = [build({ steps: [{ name: "Record the measured main", conclusion: "success" }] })];
    const annotations = [notice(), ...Array.from({ length: 99 }, () => ({ title: "Unrelated notice" }))];
    const result = await withBudgetMainReceipt(jobs, async () => annotations);
    expect(result[0].budgetMainSha).toBeNull();
  });

  it("cannot claim a match when reading the annotation API fails", async () => {
    const jobs = [build({ steps: [{ name: "Record the measured main", conclusion: "success" }] })];
    await expect(
      withBudgetMainReceipt(jobs, async () => {
        throw new Error("Synthetic annotation API failure");
      }),
    ).rejects.toThrow("Synthetic annotation API failure");
  });
});

describe("budget recheck workflow", () => {
  const workflow = readFileSync(new URL("../.github/workflows/ward-flow-budget-recheck.yml", import.meta.url), "utf8");

  it("runs on pushes to main and auto-merge arming only, with main's own script and no write access beyond re-running jobs", () => {
    expect(workflow).toMatch(
      /^on:\n {2}push:\n {4}branches: \[main\]\n {4}paths:\n(?: {6}- "[^"\n]+"\n)+ {2}pull_request_target:\n {4}types: \[auto_merge_enabled\]\n {4}branches: \[main\]\n\n/mu,
    );
    // pull_request_target must only ever run main's script: no PR ref, head or repository checkout.
    expect(workflow).toMatch(/^ {10}ref: main$/mu);
    expect(workflow).not.toMatch(/github\.event\.pull_request\.head|github\.head_ref|repository: \$\{\{/u);
    const permissions = /^permissions:\n((?: {2}[^\n]+\n)+)/mu.exec(workflow)?.[1] ?? "";
    for (const permission of ["contents: read", "actions: write", "pull-requests: read", "checks: read"])
      expect(permissions).toContain(`  ${permission}\n`);
    expect(workflow).not.toMatch(/contents: write|pull-requests: write|secrets\./u);
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow).toContain("run: node scripts/ward-ci-public/budget-recheck.mjs");
  });

  it("re-measures on a main push only when it touched what the build or its budget reads", () => {
    const paths = [
      ...(/^ {4}paths:\n((?: {6}- "[^"\n]+"\n)+)/mu.exec(workflow)?.[1] ?? "").matchAll(/"([^"]+)"/gu),
    ].map((match) => match[1]);
    for (const required of [
      "src/**",
      "package.json",
      "package-lock.json",
      "next.config.ts",
      "script-budget.json",
      "scripts/check-script-budget.mjs",
      "scripts/ward-ci-public/**",
      ".github/workflows/ward-flow.yml",
    ])
      expect(paths).toContain(required);
    // Docs-only merges must not re-run armed PRs' builds; no catch-all and no negation patterns.
    expect(paths.some((entry) => entry.startsWith("docs") || entry.startsWith("!") || entry === "**")).toBe(false);
    // The pull_request_target arming trigger stays unfiltered.
    expect(workflow).toMatch(
      / {2}pull_request_target:\n {4}types: \[auto_merge_enabled\]\n {4}branches: \[main\]\n\n/u,
    );
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

describe("conflicts fail in the scope plan job", () => {
  const ci = readFileSync(new URL("../.github/workflows/ward-flow.yml", import.meta.url), "utf8");
  const job = (name: string) => {
    const start = ci.indexOf(`\n  ${name}:\n`);
    const next = ci.slice(start + 1).search(/\n {2}[a-z][a-z0-9_-]*:\n/u);
    return ci.slice(start, next < 0 ? undefined : start + 1 + next);
  };

  it("merges the current main as the plan job's last step on pull requests, before any other job starts", () => {
    const plan = job("plan");
    const steps = [...plan.matchAll(/^ {6}- (?:name|uses): ([^\n]+)$/gmu)].map((match) => match[1]);
    expect(steps.at(-1)).toBe("Fail early when this pull request conflicts with main");
    expect(plan).toContain(
      "      - name: Fail early when this pull request conflicts with main\n        if: ${{ github.event_name == 'pull_request' }}\n        run: node scripts/ward-ci-public/merge-latest-main.mjs",
    );
    // Every other job needs the plan (directly or through it), so a conflict stops them all, and
    // Ward Flow required fails because the plan did not succeed.
    expect(job("required")).toContain('test "$PLAN_RESULT" = success');
    for (const name of ["static", "backend", "unit", "browser-build", "release-gate", "build", "coverage"])
      expect(job(name)).toMatch(/^ {4}needs: (?:plan|\[plan\b[^\n]*\])$/mu);
  });

  it("still measures the production build's script budget on the PR merged with the current main", () => {
    const build = job("build");
    const merge = build.indexOf("run: node scripts/ward-ci-public/merge-latest-main.mjs");
    expect(merge).toBeGreaterThan(0);
    // The budget step is budget-gate.mjs (it runs check-script-budget.mjs on the merged build).
    expect(merge).toBeLessThan(build.indexOf("run: node scripts/ward-ci-public/budget-gate.mjs"));
  });
});
