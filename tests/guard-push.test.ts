import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ACTIVE_CI_RUN_STATES,
  autoMergeVerdict,
  touchesProductionMigrations,
  changedFilesForRange,
  defaultRunsFetch,
  findInFlightCiRuns,
  findPrettierBin,
  forcePushedBranchNames,
  formatGuard,
  guardBaseForRange,
  HEAVY_RUN_ADMISSION_BUSY_EXIT,
  HEAVY_RUN_ADMISSION_BUSY_MARKER,
  inFlightCiGuard,
  isNeverLaunchedFailure,
  inFlightCiVerdict,
  isCoordinatorBusyOutput,
  isCoordinatorBusyResult,
  isEslintPolicyFile,
  isForcePushRange,
  isRequiredCiWorkflow,
  isTypecheckExcludedPath,
  lintableFiles,
  needsRepoWideLint,
  needsTypecheck,
  parsePushRanges,
  pushedBranchNames,
  pushedTipMatchesHead,
  staticGuard,
  cleanupFormatCheckout,
  unlinkDependencyLink,
  isMainBranch,
  isWardFlowBranch,
  isWardFlowFile,
  wardFlowPushVerdict,
  wardFlowPushGuard,
  derivesFromUnpushedWardLine,
  WARD_LINE_BRANCH,
} from "../scripts/guard-push.mjs";

const ZERO = "0".repeat(40);
const created: string[] = [];

afterEach(() => {
  for (const root of created.splice(0)) rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function dependencyFixture(lockMarker: string, withPrettier = false) {
  const root = mkdtempSync(join(tmpdir(), "guard-push-dependencies-"));
  created.push(root);
  const lock = JSON.stringify({
    lockfileVersion: 3,
    marker: lockMarker,
    packages: { "node_modules/prettier": { version: "3.9.6" } },
  });
  writeFileSync(join(root, "package-lock.json"), lock);
  if (withPrettier) {
    mkdirSync(join(root, "node_modules", "prettier", "bin"), { recursive: true });
    writeFileSync(join(root, "node_modules", "prettier", "package.json"), JSON.stringify({ version: "3.9.6" }));
    writeFileSync(join(root, "node_modules", "prettier", "bin", "prettier.cjs"), "");
  }
  return root;
}

function gitFixture() {
  const root = mkdtempSync(join(tmpdir(), "guard-push-git-"));
  created.push(root);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  git("init", "--quiet", "--initial-branch=main");
  git("config", "user.name", "Guard Push Test");
  git("config", "user.email", "guard-push@example.invalid");
  writeFileSync(join(root, "README.md"), "base\n");
  git("add", "README.md");
  git("commit", "--quiet", "-m", "base");
  return { root, git, baseSha: git("rev-parse", "HEAD") };
}

describe("auto-merge verdict", () => {
  it("does not block a fast-forward push to a PR branch with armed auto-merge, but warns", () => {
    const v = autoMergeVerdict("codex/x", { autoMergeRequest: { enabledAt: "t" }, state: "OPEN", number: 6 });
    expect(v.block).toBe(false);
    expect(v.warn).toBe(true);
  });

  it("blocks a force-push to a claude/* branch with armed auto-merge on an open PR", () => {
    const v = autoMergeVerdict("claude/x", { autoMergeRequest: { enabledAt: "t" }, state: "OPEN", number: 7 }, true);
    expect(v.block).toBe(true);
    expect(v.number).toBe(7);
  });

  it("does not warn or block a force-push when auto-merge is not armed", () => {
    const v = autoMergeVerdict("claude/x", { autoMergeRequest: null, state: "OPEN" }, true);
    expect(v.block).toBe(false);
    expect(v.warn).toBe(false);
  });

  it("does not block when there is no open PR", () => {
    expect(autoMergeVerdict("claude/x", null).block).toBe(false);
  });

  it("does not block when the PR is not OPEN", () => {
    expect(autoMergeVerdict("claude/x", { autoMergeRequest: {}, state: "MERGED" }).block).toBe(false);
  });
});

describe("force-push detection", { timeout: 60_000 }, () => {
  it("does not flag a fast-forward push", () => {
    const { root, git } = gitFixture();
    writeFileSync(join(root, "one.md"), "one\n");
    git("add", "one.md");
    git("commit", "--quiet", "-m", "one");
    const remoteSha = git("rev-parse", "HEAD");
    writeFileSync(join(root, "two.md"), "two\n");
    git("add", "two.md");
    git("commit", "--quiet", "-m", "two");
    const localSha = git("rev-parse", "HEAD");

    expect(isForcePushRange({ localSha, remoteSha, remoteRef: "refs/heads/feature" }, root)).toBe(false);
    expect(forcePushedBranchNames([{ localSha, remoteSha, remoteRef: "refs/heads/feature" }], root)).toEqual(new Set());
  });

  it("flags a push that abandons the remote tip (history rewrite)", () => {
    const { root, git, baseSha } = gitFixture();
    writeFileSync(join(root, "abandoned.md"), "abandoned\n");
    git("add", "abandoned.md");
    git("commit", "--quiet", "-m", "abandoned");
    const remoteSha = git("rev-parse", "HEAD");

    git("reset", "--quiet", "--hard", baseSha);
    writeFileSync(join(root, "rebuilt.md"), "rebuilt\n");
    git("add", "rebuilt.md");
    git("commit", "--quiet", "-m", "rebuilt");
    const localSha = git("rev-parse", "HEAD");

    expect(isForcePushRange({ localSha, remoteSha, remoteRef: "refs/heads/feature" }, root)).toBe(true);
    expect(forcePushedBranchNames([{ localSha, remoteSha, remoteRef: "refs/heads/feature" }], root)).toEqual(
      new Set(["feature"]),
    );
  });

  it("never flags a brand-new branch (zero remote sha) as a force-push", () => {
    expect(isForcePushRange({ localSha: "abc123", remoteSha: ZERO, remoteRef: "refs/heads/feature" })).toBe(false);
  });
});

describe("manual auto-merge ownership policy", () => {
  it("keeps active agent policies aligned on preserving an armed PR", () => {
    const policyFiles = [
      "../AGENTS.md",
      "../.claude/skills/run-pr/SKILL.md",
      "../.claude/skills/handoff/SKILL.md",
    ].filter((file) => existsSync(new URL(file, import.meta.url)));
    expect(policyFiles).toContain("../AGENTS.md");

    for (const file of policyFiles) {
      // Public Ward-Flow ships AGENTS.md; the old private Claude skills may be absent.
      if (file !== "../AGENTS.md" && !existsSync(new URL(file, import.meta.url))) continue;
      const policy = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(policy, file).toContain("auto-merge state is user-owned");
      expect(policy, file).toContain("must not disable");
    }
  });
});

describe("push-range parsing", { timeout: 60_000 }, () => {
  it("parses a new-branch push (zero remote sha)", () => {
    const ranges = parsePushRanges(`refs/heads/x abc123 refs/heads/x ${ZERO}\n`);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].remoteRef).toBe("refs/heads/x");
    expect(ranges[0].remoteSha).toBe(ZERO);
  });

  it("guards the remote branch even when a different branch is checked out", () => {
    const ranges = parsePushRanges(`refs/heads/local abc123 refs/heads/pr-head ${ZERO}\n`);
    expect(pushedBranchNames(ranges, "main")).toEqual(["pr-head"]);
  });

  it("skips a branch-deletion push (zero local sha)", () => {
    expect(parsePushRanges(`refs/heads/x ${ZERO} refs/heads/x abc\n`)).toHaveLength(0);
  });

  it("ignores blank lines", () => {
    expect(parsePushRanges("\n  \n")).toHaveLength(0);
  });

  it("compares a fast-forward push from its remote tip", () => {
    const { root, git } = gitFixture();
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    git("switch", "--quiet", "-c", "feature");
    writeFileSync(join(root, "one.md"), "one\n");
    git("add", "one.md");
    git("commit", "--quiet", "-m", "one");
    const remoteSha = git("rev-parse", "HEAD");
    writeFileSync(join(root, "two.md"), "two\n");
    git("add", "two.md");
    git("commit", "--quiet", "-m", "two");
    const localSha = git("rev-parse", "HEAD");

    // Ordinary push: the remote tip is reachable, so it stays the base and only
    // the newly pushed commit is in scope.
    expect(guardBaseForRange({ localSha, remoteSha }, root)).toBe(remoteSha);
    expect(changedFilesForRange({ localSha, remoteSha }, root)).toEqual(["two.md"]);
  });

  it("scopes a fast-forward main merge to the resulting PR delta", () => {
    const { root, git } = gitFixture();
    git("switch", "--quiet", "-c", "feature");
    writeFileSync(join(root, "feature.md"), "feature\n");
    git("add", "feature.md");
    git("commit", "--quiet", "-m", "feature");
    const remoteSha = git("rev-parse", "HEAD");

    git("switch", "--quiet", "main");
    writeFileSync(join(root, "main-only.md"), "main only\n");
    git("add", "main-only.md");
    git("commit", "--quiet", "-m", "advance main");
    const mainSha = git("rev-parse", "HEAD");
    git("update-ref", "refs/remotes/origin/main", mainSha);

    git("switch", "--quiet", "feature");
    git("merge", "--quiet", "--no-edit", "main");
    writeFileSync(join(root, "post-merge.md"), "post merge\n");
    git("add", "post-merge.md");
    git("commit", "--quiet", "-m", "post merge");
    const localSha = git("rev-parse", "HEAD");

    expect(guardBaseForRange({ localSha, remoteSha }, root)).toBe(mainSha);
    expect(changedFilesForRange({ localSha, remoteSha }, root)).toEqual(["feature.md", "post-merge.md"]);
  });

  it("resolves against merge-base when main advanced after the branch merged an earlier commit", () => {
    const { root, git } = gitFixture();
    git("switch", "--quiet", "-c", "feature");
    writeFileSync(join(root, "feature.md"), "feature\n");
    git("add", "feature.md");
    git("commit", "--quiet", "-m", "feature");
    const remoteSha = git("rev-parse", "HEAD");

    git("switch", "--quiet", "main");
    writeFileSync(join(root, "main-1.md"), "main 1\n");
    git("add", "main-1.md");
    git("commit", "--quiet", "-m", "advance main 1");
    const mergedMainSha = git("rev-parse", "HEAD");

    git("switch", "--quiet", "feature");
    git("merge", "--quiet", "--no-edit", "main");
    writeFileSync(join(root, "post-merge.md"), "post merge\n");
    git("add", "post-merge.md");
    git("commit", "--quiet", "-m", "post merge");
    const localSha = git("rev-parse", "HEAD");

    // Main advances again before the push:
    git("switch", "--quiet", "main");
    writeFileSync(join(root, "main-2.md"), "main 2\n");
    git("add", "main-2.md");
    git("commit", "--quiet", "-m", "advance main 2");
    const latestMainSha = git("rev-parse", "HEAD");
    git("update-ref", "refs/remotes/origin/main", latestMainSha);

    expect(guardBaseForRange({ localSha, remoteSha }, root)).toBe(mergedMainSha);
    expect(changedFilesForRange({ localSha, remoteSha }, root)).toEqual(["feature.md", "post-merge.md"]);
  });

  it("prevents false-red CI runs on merge commits by resolving git merge-base HEAD origin/main", () => {
    const { root, git } = gitFixture();
    git("switch", "--quiet", "-c", "feature");
    writeFileSync(join(root, "feature.md"), "feature\n");
    git("add", "feature.md");
    git("commit", "--quiet", "-m", "feature commit");
    const featureCommitSha = git("rev-parse", "HEAD");

    git("switch", "--quiet", "main");
    writeFileSync(join(root, "main-advance.md"), "main\n");
    git("add", "main-advance.md");
    git("commit", "--quiet", "-m", "advance main");
    const mainSha = git("rev-parse", "HEAD");
    git("update-ref", "refs/remotes/origin/main", mainSha);

    git("switch", "--quiet", "feature");
    git("merge", "--quiet", "--no-edit", "main");
    const mergeCommitSha = git("rev-parse", "HEAD");

    const resolvedBase = guardBaseForRange({ localSha: mergeCommitSha, remoteSha: featureCommitSha }, root);
    expect(resolvedBase).toBe(mainSha);

    const changed = changedFilesForRange({ localSha: mergeCommitSha, remoteSha: featureCommitSha }, root);
    expect(changed).toEqual(["feature.md"]);
    expect(changed).not.toContain("main-advance.md");
  });

  // A force-push abandons the old remote tip. Comparing against it makes every
  // file the discarded history carried look deleted, which is unanswerable for
  // transaction guards; the merge base is the question CI actually asks.
  it("falls back to the merge base when the remote tip was discarded by a force-push", () => {
    const { root, git, baseSha } = gitFixture();
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    git("switch", "--quiet", "-c", "feature");
    writeFileSync(join(root, "abandoned.md"), "abandoned\n");
    git("add", "abandoned.md");
    git("commit", "--quiet", "-m", "abandoned");
    const discardedSha = git("rev-parse", "HEAD");

    git("reset", "--quiet", "--hard", baseSha);
    writeFileSync(join(root, "rebuilt.md"), "rebuilt\n");
    git("add", "rebuilt.md");
    git("commit", "--quiet", "-m", "rebuilt");
    const localSha = git("rev-parse", "HEAD");

    expect(discardedSha).not.toBe(localSha);
    expect(guardBaseForRange({ localSha, remoteSha: discardedSha }, root)).toBe(baseSha);
    // abandoned.md must not read as a deletion introduced by this push.
    expect(changedFilesForRange({ localSha, remoteSha: discardedSha }, root)).toEqual(["rebuilt.md"]);
  });

  it("keeps a Windows new-branch static command scoped to the PR side of an advanced main", () => {
    const { root, git, baseSha } = gitFixture();
    git("switch", "--quiet", "-c", "feature");
    mkdirSync(join(root, "scripts"), { recursive: true });
    writeFileSync(join(root, "scripts", "feature.mjs"), "export const feature = true;\n");
    git("add", "scripts/feature.mjs");
    git("commit", "--quiet", "-m", "feature");
    const featureSha = git("rev-parse", "HEAD");

    git("switch", "--quiet", "main");
    mkdirSync(join(root, "src"), { recursive: true });
    for (let index = 0; index < 360; index += 1) {
      const name = `main-only-${String(index).padStart(3, "0")}-${"x".repeat(96)}.ts`;
      writeFileSync(join(root, "src", name), `export const value${index} = ${index};\n`);
    }
    git("add", "src");
    git("commit", "--quiet", "-m", "advance main");
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    git("branch", "origin/main", baseSha);

    const twoDotFiles = git("diff", "--name-only", `refs/remotes/origin/main..${featureSha}`).split("\n");
    expect(lintableFiles(twoDotFiles).join(" ").length).toBeGreaterThan(32_767);
    expect(changedFilesForRange({ localSha: featureSha, remoteSha: ZERO }, root)).toEqual(["scripts/feature.mjs"]);
    expect(guardBaseForRange({ localSha: featureSha, remoteSha: ZERO }, root)).toBe(baseSha);
  });
});

describe("format dependency resolution", () => {
  it("reuses Prettier only from a byte-identical sibling lockfile", () => {
    const project = dependencyFixture("current");
    const stale = dependencyFixture("stale", true);
    const exact = dependencyFixture("current", true);

    expect(findPrettierBin(project, [stale, exact])).toBe(
      join(exact, "node_modules", "prettier", "bin", "prettier.cjs"),
    );
  });

  it("fails closed when no exact-lock Prettier installation is available", () => {
    const result = formatGuard([{ sha: "abc123", file: "README.md" }], () => {
      throw new Error("missing fixture dependency");
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("npm ci --include=dev");
    expect(result.message).toContain("SKIP_FORMAT_GUARD=1");
  });
});

describe("static guard scope selection", () => {
  it("lints lint-root sources and eslint-rules, not docs or public assets", () => {
    expect(lintableFiles(["src/components/a.tsx", "docs/x.md", "package-lock.json"])).toEqual(["src/components/a.tsx"]);
    expect(lintableFiles(["eslint-rules/require-button-wiring.mjs"])).toEqual([
      "eslint-rules/require-button-wiring.mjs",
    ]);
    expect(lintableFiles(["public/demo/x.js"])).toEqual([]);
  });

  it("normalizes backslash paths before filtering", () => {
    expect(lintableFiles(["src\\components\\a.tsx"])).toEqual(["src/components/a.tsx"]);
  });

  it("triggers typecheck only for extensions the source-only config includes", () => {
    expect(needsTypecheck(["src/lib/a.ts"])).toBe(true);
    expect(needsTypecheck(["src/lib/a.tsx", "src/lib/a.mts"])).toBe(true);
    expect(needsTypecheck(["docs/a.md", "x.png"])).toBe(false);
    expect(needsTypecheck(["src/lib/a.cts"])).toBe(false);
  });

  it("skips typecheck for paths excluded by tsconfig.typecheck.json", () => {
    expect(isTypecheckExcludedPath("supabase/functions/foo/index.ts")).toBe(true);
    expect(isTypecheckExcludedPath("scripts/archive/old.ts")).toBe(true);
    expect(isTypecheckExcludedPath("src/lib/a.ts")).toBe(false);
    expect(needsTypecheck(["supabase/functions/foo/index.ts"])).toBe(false);
    expect(needsTypecheck(["scripts/archive/old.ts", "scratch/x.tsx", "worktrees/a/b.ts"])).toBe(false);
    expect(needsTypecheck(["supabase/functions/foo/index.ts", "src/lib/a.ts"])).toBe(true);
  });

  it("treats shared-slot exhaustion as coordinator busy, not a typecheck failure", () => {
    expect(isCoordinatorBusyOutput("Database focused-test capacity is full (current owner PID 1)")).toBe(true);
    expect(isCoordinatorBusyOutput("Another Database heavyweight command is active (PID 1)")).toBe(true);
    expect(isCoordinatorBusyOutput("A Database heavyweight coordinator is being initialized; retry shortly.")).toBe(
      true,
    );
    expect(isCoordinatorBusyOutput("error TS2322: Type 'string' is not assignable")).toBe(false);
  });

  it("prefers structured admission-busy exit/marker over prose that tsc can quote", () => {
    expect(isCoordinatorBusyResult({ status: HEAVY_RUN_ADMISSION_BUSY_EXIT })).toBe(true);
    expect(isCoordinatorBusyResult({ status: 1, stderr: `${HEAVY_RUN_ADMISSION_BUSY_MARKER}\nbusy` })).toBe(true);
    expect(
      isCoordinatorBusyResult({
        status: 1,
        stderr: "error TS2304: Another Database heavyweight command is active",
      }),
    ).toBe(false);
  });

  it("escalates to repo-wide lint when eslint policy changes", () => {
    expect(isEslintPolicyFile("eslint.config.mjs")).toBe(true);
    expect(isEslintPolicyFile("eslint-rules/no-hardcoded-hex.mjs")).toBe(true);
    expect(isEslintPolicyFile("src/lib/a.ts")).toBe(false);
    expect(needsRepoWideLint(["eslint.config.mjs"])).toBe(true);
    expect(needsRepoWideLint(["eslint-rules/x.mjs"])).toBe(true);
    expect(needsRepoWideLint(["src/lib/a.ts"])).toBe(false);
  });

  it("fails closed when the pushed tip is not HEAD", () => {
    expect(pushedTipMatchesHead([{ localSha: "aaa" }], "aaa").ok).toBe(true);
    expect(pushedTipMatchesHead([{ localSha: "aaa", localRef: "refs/heads/other" }], "bbb")).toEqual({
      ok: false,
      headSha: "bbb",
      tipSha: "aaa",
      localRef: "refs/heads/other",
    });
    expect(pushedTipMatchesHead([{ localSha: "tagobj", localRef: "refs/tags/v1" }], "bbb").ok).toBe(true);

    // ready-check exports a gitless tree; this assertion needs its own real HEAD.
    const { root } = gitFixture();
    const originalGitDir = process.env.GIT_DIR;
    try {
      process.env.GIT_DIR = join(root, ".git");
      const result = staticGuard(["src/lib/a.ts"], {
        ranges: [{ localSha: "deadbeef", localRef: "refs/heads/other" }],
      });
      expect(result.ok).toBe(false);
      expect(result.message).toContain("SKIP_STATIC_GUARD=1");
      expect(result.message).toContain("deadbeef");
    } finally {
      if (originalGitDir === undefined) delete process.env.GIT_DIR;
      else process.env.GIT_DIR = originalGitDir;
    }
  });

  it("does not tip-check docs-only or tag pushes that need no static work", () => {
    const docsOnly = staticGuard(["docs/only.md"], {
      ranges: [{ localSha: "deadbeef", localRef: "refs/heads/docs-branch" }],
    });
    expect(docsOnly.ok).toBe(true);
    expect(docsOnly.message).toBeUndefined();

    const tagPush = staticGuard(["README.md"], {
      ranges: [{ localSha: "tagobj", localRef: "refs/tags/v1.2.3" }],
    });
    expect(tagPush.ok).toBe(true);
  });

  it("skips with SKIP_STATIC_GUARD=1 and is a no-op for docs-only pushes", () => {
    const previous = process.env.SKIP_STATIC_GUARD;
    process.env.SKIP_STATIC_GUARD = "1";
    try {
      const skipped = staticGuard(["src/lib/a.ts"]);
      expect(skipped.ok).toBe(true);
      expect(skipped.skipped).toBe("SKIP_STATIC_GUARD=1");
    } finally {
      if (previous === undefined) delete process.env.SKIP_STATIC_GUARD;
      else process.env.SKIP_STATIC_GUARD = previous;
    }

    const docsOnly = staticGuard(["docs/only.md"]);
    expect(docsOnly.ok).toBe(true);
    expect(docsOnly.message).toBeUndefined();
  });
});

describe("in-flight CI push guard (#HSSHRG)", () => {
  it("recognizes active workflow runs for required CI only", () => {
    expect(isRequiredCiWorkflow({ name: "Ward Flow CI" })).toBe(true);
    expect(isRequiredCiWorkflow({ workflowName: "Ward Flow CI" })).toBe(true);
    expect(isRequiredCiWorkflow({ path: ".github/workflows/ward-flow.yml" })).toBe(true);
    expect(isRequiredCiWorkflow({ path: ".github\\workflows\\ward-flow.yml" })).toBe(true);
    expect(isRequiredCiWorkflow({ name: "Nightly Security Scan" })).toBe(false);

    expect(ACTIVE_CI_RUN_STATES.has("in_progress")).toBe(true);
    expect(ACTIVE_CI_RUN_STATES.has("queued")).toBe(true);
    expect(ACTIVE_CI_RUN_STATES.has("completed")).toBe(false);

    const runs = [
      { databaseId: 1, name: "Ward Flow CI", status: "in_progress", conclusion: null },
      { databaseId: 2, name: "Ward Flow CI", status: "queued", conclusion: "" },
      { databaseId: 3, name: "Ward Flow CI", status: "completed", conclusion: "success" },
      { databaseId: 4, name: "Deploy", status: "in_progress", conclusion: null },
    ];
    const inFlight = findInFlightCiRuns(runs);
    expect(inFlight).toHaveLength(2);
    expect(inFlight.map((r: Record<string, unknown>) => r.databaseId)).toEqual([1, 2]);

    const objPayload = {
      workflow_runs: [
        { id: 10, path: ".github/workflows/ward-flow.yml", status: "waiting", conclusion: null },
        { id: 11, path: ".github/workflows/ward-flow.yml", status: "completed", conclusion: "failure" },
      ],
    };
    expect(findInFlightCiRuns(objPayload).map((r: Record<string, unknown>) => r.id)).toEqual([10]);
  });

  it("blocks a push to an open PR when required CI is in-flight", () => {
    const runs = [
      {
        databaseId: 101,
        name: "Ward Flow CI",
        status: "in_progress",
        conclusion: null,
        url: "https://github.com/run/101",
      },
    ];
    const verdict = inFlightCiVerdict("claude/my-fix", { state: "OPEN", number: 123 }, runs);
    expect(verdict.block).toBe(true);
    expect(verdict.number).toBe(123);
    expect(verdict.runs).toHaveLength(1);
  });

  it("is documented as blocking (not advisory) in AGENTS.md, matching the guard's behaviour", () => {
    const agents = readFileSync(join(process.cwd(), "AGENTS.md"), "utf8");
    const line = agents.split("\n").find((entry) => entry.includes("in-flight CI push check"));
    expect(line).toBeDefined();
    expect(line).toContain("is a blocking check, not an advisory one");
    expect(line).toContain("SKIP_IN_FLIGHT_CI_GUARD=1");
    expect(line).toContain("PREPUSH_CI_STRICT=1");
    expect(line).not.toMatch(/is advisory during interactive work/);
    // The guard itself still blocks, and the hook's default skip is a visible, separate choice.
    expect(readFileSync(join(process.cwd(), "scripts", "guard-push.mjs"), "utf8")).toContain("SKIP_IN_FLIGHT_CI_GUARD");
    expect(readFileSync(join(process.cwd(), ".githooks", "pre-push"), "utf8")).toContain("PREPUSH_CI_STRICT");
  });

  it("allows push when CI has completed or no runs are in-flight", () => {
    const completedRuns = [{ databaseId: 102, name: "Ward Flow CI", status: "completed", conclusion: "success" }];
    const verdict = inFlightCiVerdict("claude/my-fix", { state: "OPEN", number: 123 }, completedRuns);
    expect(verdict.block).toBe(false);
    expect(verdict.reason).toBe("no-in-flight-ci");
  });

  it("blocks an armed auto-merge when the push carries a hosted migration", () => {
    // Merging to main applies migrations to the live clinical database automatically,
    // so auto-merge on such a PR schedules an unattended production schema change.
    const armed = { autoMergeRequest: { enabledAt: "t" }, state: "OPEN", number: 88 };
    const v = autoMergeVerdict("claude/x", armed, false, true);
    expect(v.block).toBe(true);
    expect(v.reason).toBe("auto-merge-armed-migration");
    expect(v.number).toBe(88);
  });

  it("blocks a migration push even when it is an ordinary fast-forward", () => {
    // The fast-forward carve-out exists because GitHub re-validates required checks.
    // It does not make an unattended production schema change acceptable.
    const armed = { autoMergeRequest: { enabledAt: "t" }, state: "OPEN", number: 89 };
    expect(autoMergeVerdict("claude/x", armed, false, false).block).toBe(false);
    expect(autoMergeVerdict("claude/x", armed, false, true).block).toBe(true);
  });

  it("does not block a migration push when auto-merge is not armed", () => {
    // The risk is the unattended merge, not the migration itself.
    const v = autoMergeVerdict("claude/x", { autoMergeRequest: null, state: "OPEN", number: 90 }, false, true);
    expect(v.block).toBe(false);
  });

  it("counts only supabase/migrations as a production migration path", () => {
    expect(touchesProductionMigrations(["supabase/migrations/20260101_x.sql"])).toBe(true);
    expect(touchesProductionMigrations(["src/lib/a.ts", "docs/b.md"])).toBe(false);
    // schema.sql is a mirror of the chain, not a thing the integration applies.
    expect(touchesProductionMigrations(["supabase/schema.sql"])).toBe(false);
    expect(touchesProductionMigrations([])).toBe(false);
  });

  it("never blocks base branch pushes or closed PRs", () => {
    const runs = [{ databaseId: 101, name: "Ward Flow CI", status: "in_progress", conclusion: null }];
    expect(inFlightCiVerdict("main", { state: "OPEN", number: 1 }, runs).block).toBe(false);
    expect(inFlightCiVerdict("release/2.0", { state: "OPEN", number: 2 }, runs).block).toBe(false);
    expect(inFlightCiVerdict("claude/my-fix", { state: "MERGED", number: 123 }, runs).block).toBe(false);
    expect(inFlightCiVerdict("claude/my-fix", null, runs).block).toBe(false);
  });

  it("inFlightCiGuard formats actionable blocked message with PR and run details", () => {
    const runs = [{ databaseId: 555, name: "Ward Flow CI", status: "in_progress", url: "https://github.com/run/555" }];
    const result = inFlightCiGuard(["claude/my-fix"], [], {
      prViewer: () => ({ state: "OPEN", number: 77 }),
      runFetcher: () => runs,
      // Without this the guard fails open at the `gh --version` probe and never reaches the
      // formatting under test, so the case would assert nothing on any machine that has no
      // `gh` on PATH — green in CI, red in a bare container, for no product reason.
      ghAvailable: () => true,
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("PR #77 on claude/my-fix has required CI run(s) currently IN-FLIGHT");
    expect(result.message).toContain("Run 555: Ward Flow CI (in_progress) https://github.com/run/555");
    expect(result.message).toContain("SKIP_IN_FLIGHT_CI_GUARD=1 git push");
    expect(result.message).toContain("#HSSHRG");
  });

  it("inFlightCiGuard fails open when gh is unavailable", () => {
    const result = inFlightCiGuard(["claude/my-fix"], [], {
      prViewer: () => {
        throw new Error("prViewer must not be consulted without gh");
      },
      runFetcher: () => {
        throw new Error("runFetcher must not be consulted without gh");
      },
      ghAvailable: () => false,
    });
    expect(result.ok).toBe(true);
    expect(result.note).toContain("gh not available");
  });

  it("inFlightCiGuard skips when SKIP_IN_FLIGHT_CI_GUARD=1 is set", () => {
    const previous = process.env.SKIP_IN_FLIGHT_CI_GUARD;
    process.env.SKIP_IN_FLIGHT_CI_GUARD = "1";
    try {
      const result = inFlightCiGuard(["claude/my-fix"], [], {
        prViewer: () => ({ state: "OPEN", number: 77 }),
        runFetcher: () => [{ databaseId: 555, name: "Ward Flow CI", status: "in_progress" }],
      });
      expect(result.ok).toBe(true);
      expect(result.skipped).toBe("SKIP_IN_FLIGHT_CI_GUARD=1");
    } finally {
      if (previous === undefined) delete process.env.SKIP_IN_FLIGHT_CI_GUARD;
      else process.env.SKIP_IN_FLIGHT_CI_GUARD = previous;
    }
  });

  it("supports localRef === 'HEAD' in pushedTipMatchesHead", () => {
    expect(pushedTipMatchesHead([{ localSha: "sha123", localRef: "HEAD" }], "sha123").ok).toBe(true);
    expect(pushedTipMatchesHead([{ localSha: "sha123", localRef: "HEAD" }], "sha456").ok).toBe(false);
  });

  it("defaultRunsFetch scopes to ward-flow.yml and pages past the default 10-run window (#HSSHRG)", () => {
    let capturedArgs: string[] = [];
    defaultRunsFetch("claude/my-fix", ((_cmd: string, args: string[]) => {
      capturedArgs = args;
      return "[]";
    }) as unknown as typeof execFileSync);

    expect(capturedArgs).toContain("run");
    expect(capturedArgs).toContain("list");
    expect(capturedArgs).toContain("--branch");
    expect(capturedArgs).toContain("claude/my-fix");
    expect(capturedArgs).toContain("--workflow");
    expect(capturedArgs).toContain("ward-flow.yml");
    const limitIndex = capturedArgs.indexOf("--limit");
    expect(limitIndex).not.toBe(-1);
    expect(Number(capturedArgs[limitIndex + 1])).toBeGreaterThan(10);
  });
});

describe("format-checkout cleanup never deletes through the linked dependency tree", () => {
  // checkPushedCommit checks out the pushed commit into a scratch directory and
  // links a node_modules tree in so a dynamic prettier config can resolve its
  // plugins. When the pushing worktree has no dependencies of its own,
  // findPrettierBin borrows ANOTHER worktree's real node_modules, and on Windows
  // that borrow is a junction. The scratch directory is then torn down with
  // `git worktree remove --force` plus a recursive rmSync, neither of which
  // respects `git worktree lock`. These tests pin the invariant that the link is
  // unlinked-not-followed first, and that the force-deletes are skipped entirely
  // when it could not be.
  //
  // Platform note: the link below is a junction on win32 and a directory symlink
  // everywhere else, so CI (Linux) proves the symlink case and a Windows run
  // proves the junction case. Both are exercised by the same assertions.
  function linkFixture() {
    const sentinel = mkdtempSync(join(tmpdir(), "guard-push-sentinel-"));
    created.push(sentinel);
    mkdirSync(join(sentinel, "prettier", "bin"), { recursive: true });
    writeFileSync(join(sentinel, "prettier", "package.json"), '{"version":"3.9.6"}');
    const container = mkdtempSync(join(tmpdir(), "guard-push-container-"));
    created.push(container);
    const link = join(container, "node_modules");
    symlinkSync(sentinel, link, process.platform === "win32" ? "junction" : "dir");
    return { sentinel, container, link, canary: join(sentinel, "prettier", "package.json") };
  }

  it("removes the link itself and leaves the borrowed tree intact", () => {
    const { container, link, canary } = linkFixture();
    expect(existsSync(canary)).toBe(true);

    unlinkDependencyLink(link);
    expect(existsSync(link)).toBe(false);
    expect(existsSync(canary)).toBe(true);

    // The force-delete that follows in checkPushedCommit can no longer reach it.
    rmSync(container, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    expect(existsSync(canary)).toBe(true);
  });

  it("removes a DANGLING link, which existsSync reports as absent", () => {
    // Regression guard. existsSync follows the link, so once the borrowed tree
    // is gone the link reads as absent and an existsSync-gated cleanup leaves it
    // in place — for `git worktree remove --force` and a recursive rmSync to
    // interpret instead. lstat sees the link whether or not it resolves.
    const { sentinel, link } = linkFixture();
    rmSync(sentinel, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    expect(existsSync(link)).toBe(false); // the trap: it is still there

    unlinkDependencyLink(link);
    expect(() => lstatSync(link)).toThrow(/ENOENT/);
  });

  it("is tolerant of the link already being gone", () => {
    const container = mkdtempSync(join(tmpdir(), "guard-push-container-"));
    created.push(container);
    const result = unlinkDependencyLink(join(container, "node_modules"));
    expect(result.removed).toBe(false);
    expect(result.reason).toBe("absent");
  });

  it("refuses a real directory at the link path instead of deleting its contents", () => {
    // Nothing in guard-push creates a real directory here, so one means something
    // unexpected — and recursively deleting an unexpected directory is the exact
    // hazard these tests exist to prevent.
    const container = mkdtempSync(join(tmpdir(), "guard-push-container-"));
    created.push(container);
    const real = join(container, "node_modules");
    mkdirSync(join(real, "prettier"), { recursive: true });
    writeFileSync(join(real, "prettier", "package.json"), '{"version":"3.9.6"}');

    const result = unlinkDependencyLink(real);
    expect(result.removed).toBe(false);
    expect(result.reason).toBe("not-a-link");
    expect(existsSync(join(real, "prettier", "package.json"))).toBe(true);
  });

  it("SKIPS both force-deletes when the link could not be removed", () => {
    // Regression guard. Swallowing the unlink failure and continuing is the one
    // case where a force-delete runs over a directory that still holds a live
    // link into another worktree's node_modules. A leftover scratch directory is
    // cheap; that is not.
    const calls: string[] = [];
    cleanupFormatCheckout("D:/nonexistent-scratch", {
      unlink: () => ({ removed: false, reason: "failed" }) as const,
      removeWorktree: () => {
        calls.push("removeWorktree");
      },
      removeDir: () => {
        calls.push("removeDir");
      },
      log: () => {},
    });
    expect(calls).toEqual([]);
  });

  it("still tears down the checkout when the link was removed or was never there", () => {
    for (const reason of ["unlink", "absent"] as const) {
      const calls: string[] = [];
      cleanupFormatCheckout("D:/nonexistent-scratch", {
        unlink: () => ({ removed: reason === "unlink", reason }),
        removeWorktree: () => {
          calls.push("removeWorktree");
        },
        removeDir: () => {
          calls.push("removeDir");
        },
        log: () => {},
      });
      expect(calls).toEqual(["removeWorktree", "removeDir"]);
    }
  });

  it("unlinks BEFORE either force-delete, so traversal behaviour cannot matter", () => {
    const order: string[] = [];
    cleanupFormatCheckout("D:/nonexistent-scratch", {
      unlink: () => {
        order.push("unlink");
        return { removed: true, reason: "unlink" } as const;
      },
      removeWorktree: () => {
        order.push("removeWorktree");
      },
      removeDir: () => {
        order.push("removeDir");
      },
      log: () => {},
    });
    expect(order).toEqual(["unlink", "removeWorktree", "removeDir"]);
  });
});

/**
 * The static guard used to say `lint failed` when eslint had never been spawned. On 2026-09-02 a
 * 992-commit push built a 56,570-byte argument vector against Windows' 32,767-byte limit, the
 * process was refused, and the only output was "The command line is too long." Both natural
 * readings of that message are wrong: the code was not proven broken, and the guard was not noise.
 *
 * These cases pin the distinction in BOTH directions. The two controls are the point — a detector
 * that answered "never launched" to a genuine lint error would be worse than the bug it replaced,
 * because it would talk somebody past a real defect.
 */
describe("never-launched versus failed", () => {
  it("recognises a process that was refused before it could start", () => {
    expect(isNeverLaunchedFailure({ code: "ENAMETOOLONG" }, "")).toBe(true);
    expect(isNeverLaunchedFailure({ code: "E2BIG" }, "")).toBe(true);
    expect(isNeverLaunchedFailure({ code: 1 }, "The command line is too long.")).toBe(true);
    expect(isNeverLaunchedFailure({ code: 1 }, "/bin/sh: argument list too long")).toBe(true);
  });

  it("does NOT mistake a real failure for one that never ran", () => {
    expect(
      isNeverLaunchedFailure(
        { code: 1, status: 1 },
        "/src/a.tsx  12:3  error  Unexpected any  @typescript-eslint/no-explicit-any  (1 problem)",
      ),
    ).toBe(false);
    expect(
      isNeverLaunchedFailure(
        { code: 2, status: 2 },
        "src/b.ts(4,1): error TS2353: Object literal may only specify known properties",
      ),
    ).toBe(false);
    expect(isNeverLaunchedFailure(undefined, "")).toBe(false);
  });
});

describe("Ward Flow / origin:main push guard", () => {
  it("correctly classifies Ward Flow files vs clinical KB files", () => {
    expect(isWardFlowFile("src/components/ward-management/search/patient-search.tsx")).toBe(true);
    expect(isWardFlowFile("src/app/mockups/ward-flow/page.tsx")).toBe(true);
    expect(isWardFlowFile("docs/ward-flow/README.md")).toBe(true);
    expect(isWardFlowFile("scripts/ward-flow/screen-map.mjs")).toBe(true);
    expect(isWardFlowFile("scripts/run-ward-tests.mjs")).toBe(true);
    expect(isWardFlowFile("tests/ward-referrals.dom.test.tsx")).toBe(true);
    expect(isWardFlowFile("tests/ui-ward-capacity-morning-moved.spec.ts")).toBe(true);
    expect(isWardFlowFile("tests/helpers/ward-panels.ts")).toBe(true);

    // Standard clinical KB files must NOT be classified as Ward Flow
    expect(isWardFlowFile("src/lib/search.ts")).toBe(false);
    expect(isWardFlowFile("src/components/search/MasterSearchHeader.tsx")).toBe(false);
    expect(isWardFlowFile("supabase/migrations/20260804110240_restore_rag_search_health_indexes.sql")).toBe(false);
    expect(isWardFlowFile("docs/database-drift-detection.md")).toBe(false);
  });

  it("detects Ward Flow branches vs normal branches", () => {
    expect(isWardFlowBranch("codex/task-ward-flow-live-state-20260831")).toBe(true);
    expect(isWardFlowBranch("ward-lead")).toBe(true);
    expect(isWardFlowBranch("refs/heads/ward-flow")).toBe(true);
    expect(isWardFlowBranch("feature-auth-refactor")).toBe(false);
    expect(isWardFlowBranch("codex/rag-ranking-fix")).toBe(false);
  });

  it("detects main and master branches", () => {
    expect(isMainBranch("main")).toBe(true);
    expect(isMainBranch("refs/heads/main")).toBe(true);
    expect(isMainBranch("master")).toBe(true);
    expect(isMainBranch("refs/heads/master")).toBe(true);
    expect(isMainBranch("feature/main-sync")).toBe(false);
  });

  it("blocks any push of Ward Flow files to origin/main unless explicitly confirmed", () => {
    const blocked = wardFlowPushVerdict({
      pushedBranches: ["main"],
      changedFiles: ["src/components/ward-management/patients/add-patient.tsx"],
      env: {},
    });
    expect(blocked.block).toBe(true);
    expect(blocked.reason).toBe("ward-flow-push-to-main");
    expect(blocked.message).toContain("WARD FLOW CANNOT BE FOLDED OR PUSHED TO ORIGIN/MAIN");
    expect(blocked.message).toContain('CONFIRM_WARD_FLOW_PUSH_TO_MAIN="I_CONFIRM_FOLD_TO_ORIGIN_MAIN"');

    const unblocked = wardFlowPushVerdict({
      pushedBranches: ["main"],
      changedFiles: ["src/components/ward-management/patients/add-patient.tsx"],
      env: { CONFIRM_WARD_FLOW_PUSH_TO_MAIN: "I_CONFIRM_FOLD_TO_ORIGIN_MAIN" },
    });
    expect(unblocked.block).toBe(false);
    expect(unblocked.warning).toContain("CONFIRM_WARD_FLOW_PUSH_TO_MAIN");
  });

  it("blocks direct push of non-ward files to origin/main without explicit confirmation", () => {
    const blocked = wardFlowPushVerdict({
      pushedBranches: ["main"],
      changedFiles: ["src/lib/clinical-guidance.ts"],
      env: {},
    });
    expect(blocked.block).toBe(true);
    expect(blocked.reason).toBe("push-to-main-direct");
    expect(blocked.message).toContain("DIRECT PUSH TO ORIGIN/MAIN IS BLOCKED");
    expect(blocked.message).toContain('CONFIRM_PUSH_TO_MAIN="I_CONFIRM_PUSH_TO_MAIN"');

    const unblocked = wardFlowPushVerdict({
      pushedBranches: ["main"],
      changedFiles: ["src/lib/clinical-guidance.ts"],
      env: { CONFIRM_PUSH_TO_MAIN: "I_CONFIRM_PUSH_TO_MAIN" },
    });
    expect(unblocked.block).toBe(false);
  });

  it("blocks pushing Ward Flow files to remote feature branches without confirmation", () => {
    const blocked = wardFlowPushVerdict({
      pushedBranches: ["codex/feature-test"],
      changedFiles: ["src/components/ward-management/search/patient-search.tsx"],
      env: {},
    });
    expect(blocked.block).toBe(true);
    expect(blocked.reason).toBe("ward-flow-push-to-remote");
    expect(blocked.message).toContain("WARD FLOW CANNOT BE PUSHED TO REMOTE");
    expect(blocked.message).toContain('CONFIRM_WARD_FLOW_REMOTE="I_CONFIRM_WARD_FLOW_REMOTE"');

    const unblocked = wardFlowPushVerdict({
      pushedBranches: ["codex/feature-test"],
      changedFiles: ["src/components/ward-management/search/patient-search.tsx"],
      env: { CONFIRM_WARD_FLOW_REMOTE: "I_CONFIRM_WARD_FLOW_REMOTE" },
    });
    expect(unblocked.block).toBe(false);
  });

  it("permits ordinary feature branch pushes with non-ward files", () => {
    const verdict = wardFlowPushVerdict({
      pushedBranches: ["codex/rag-improvement"],
      changedFiles: ["src/lib/rag/rerank.ts", "docs/rag-behaviour/README.md"],
      env: {},
    });
    expect(verdict.block).toBe(false);
    expect(verdict.reason).toBe("safe");

    const guardResult = wardFlowPushGuard(
      ["codex/rag-improvement"],
      [],
      ["src/lib/rag/rerank.ts"],
      "codex/rag-improvement",
      { env: {} },
    );
    expect(guardResult.ok).toBe(true);
  });
});

describe("Ward Flow push guard — history built on the unpushed ward line", () => {
  function wardHistoryFixture() {
    const root = mkdtempSync(join(tmpdir(), "guard-push-ward-line-"));
    created.push(root);
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const commit = (file: string) => {
      writeFileSync(join(root, file), `${file}\n`);
      git("add", file);
      git("commit", "--quiet", "--no-verify", "-m", file);
      return git("rev-parse", "HEAD");
    };
    git("init", "--quiet", "--initial-branch=main");
    git("config", "user.name", "Guard Test");
    git("config", "user.email", "guard-test@example.invalid");
    const shared = commit("shared.txt");
    git("update-ref", "refs/remotes/origin/main", shared);
    git("checkout", "--quiet", "-b", WARD_LINE_BRANCH);
    commit("ward-only.txt");
    git("checkout", "--quiet", "-b", "claude/unrelated-name");
    const onWard = commit("plain.txt");
    git("checkout", "--quiet", "-b", "claude/from-main", "main");
    const offWard = commit("other.txt");
    return { root, onWard, offWard };
  }

  it("flags a non-ward-named branch whose commits sit on the unpushed ward line", () => {
    const { root, onWard, offWard } = wardHistoryFixture();
    const range = (localSha: string) => ({
      localRef: "refs/heads/x",
      localSha,
      remoteRef: "refs/heads/x",
      remoteSha: ZERO,
    });
    expect(derivesFromUnpushedWardLine([range(onWard)], root)).toBe(true);
    expect(derivesFromUnpushedWardLine([range(offWard)], root)).toBe(false);
  });

  it("blocks the push when that history is present, whatever the branch and files", () => {
    const verdict = wardFlowPushVerdict({
      pushedBranches: ["claude/unrelated-name"],
      changedFiles: ["scripts/pre-commit-checks.mjs"],
      currentBranch: "claude/unrelated-name",
      derivesFromWardLine: true,
      env: {},
    });
    expect(verdict.block).toBe(true);
    expect(verdict.reason).toBe("ward-flow-push-to-remote");
    expect(verdict.message).toContain("sit on the local Ward Flow line");
  });
});

describe("Ward Flow push guard — remote-ref and current-branch detection paths", () => {
  // wardFlowPushVerdict's targetsMain check is `pushedBranches.some(isMainBranch) ||
  // ranges.some((r) => isMainBranch(r.remoteRef))` — two independent ways to learn a
  // push targets origin/main. Every other test in this file drives the first path via
  // `pushedBranches`. This drives ONLY the second: `pushedBranches` is deliberately
  // empty, so the verdict can only see the push targets main by reading `ranges[].remoteRef`
  // directly, exactly as `main()` passes it through in production.
  it("detects a push to origin/main via ranges[].remoteRef alone, with pushedBranches empty", () => {
    const verdict = wardFlowPushVerdict({
      pushedBranches: [],
      ranges: [{ localRef: "refs/heads/codex/formatting-fix", localSha: "abc123", remoteRef: "refs/heads/main" }],
      changedFiles: ["src/lib/search.ts"],
      currentBranch: "codex/formatting-fix",
      env: {},
    });
    expect(verdict.block).toBe(true);
    expect(verdict.reason).toBe("push-to-main-direct");
  });

  // fromWardBranch is `isWardFlowBranch(currentBranch) || pushedBranches.some(isWardFlowBranch)`.
  // This drives ONLY the currentBranch half: the pushed remote branch name and the
  // changed files are both deliberately non-ward, so the only reason this push can be
  // recognized as a Ward Flow operation is that the LOCALLY CHECKED-OUT branch (what
  // `main()` passes as `currentBranch`, from `git rev-parse --abbrev-ref HEAD`) is a
  // Ward Flow branch — e.g. pushing a differently-named branch alias or a mirror push
  // while sitting on a ward branch.
  it("blocks based on the currently checked-out branch even when the pushed branch name and files are not ward-flagged", () => {
    const blocked = wardFlowPushVerdict({
      pushedBranches: ["generic-remote-alias"],
      changedFiles: ["src/lib/unrelated-refactor.ts"],
      currentBranch: "ward-flow-integration",
      env: {},
    });
    expect(blocked.block).toBe(true);
    expect(blocked.reason).toBe("ward-flow-push-to-remote");
    expect(blocked.message).toContain("is a Ward Flow branch");

    // Sanity check: the same push from a non-ward checked-out branch is unblocked,
    // isolating currentBranch as the thing that made the difference above.
    const unblocked = wardFlowPushVerdict({
      pushedBranches: ["generic-remote-alias"],
      changedFiles: ["src/lib/unrelated-refactor.ts"],
      currentBranch: "codex/generic-fix",
      env: {},
    });
    expect(unblocked.block).toBe(false);
  });

  // Documents CURRENT behaviour only (owner has not ruled on whether this coupling is
  // wanted — see scripts/guard-push.mjs guard-0 header and CONTEXT in the brief that
  // added this test). wardFlowPushVerdict's Case 2 and Case 3 branches each accept
  // EITHER their own CONFIRM_* value OR the Case-1 value
  // (CONFIRM_WARD_FLOW_PUSH_TO_MAIN=I_CONFIRM_FOLD_TO_ORIGIN_MAIN). That means a single
  // override meant for "fold Ward Flow to origin/main" also unlocks an unrelated direct
  // push to main (Case 2) and an unrelated Ward Flow push to a feature branch (Case 3).
  // If a future owner decision narrows this, update/remove this test alongside that
  // change — do not let it silently start asserting the opposite of what it names.
  it("documents current behaviour: the Case-1 override value also unlocks Case 2 and Case 3", () => {
    // Case 2: a direct, non-ward push to origin/main — unlocked by the Case-1 value.
    const case2 = wardFlowPushVerdict({
      pushedBranches: ["main"],
      changedFiles: ["src/lib/search.ts"],
      currentBranch: "codex/generic-fix",
      env: { CONFIRM_WARD_FLOW_PUSH_TO_MAIN: "I_CONFIRM_FOLD_TO_ORIGIN_MAIN" },
    });
    expect(case2.block).toBe(false);
    expect(case2.reason).toBe("confirmed-by-env");

    // Case 3: a Ward Flow push to a remote non-main branch — unlocked by the Case-1 value.
    const case3 = wardFlowPushVerdict({
      pushedBranches: ["codex/feature-test"],
      changedFiles: ["src/components/ward-management/search/patient-search.tsx"],
      currentBranch: "codex/feature-test",
      env: { CONFIRM_WARD_FLOW_PUSH_TO_MAIN: "I_CONFIRM_FOLD_TO_ORIGIN_MAIN" },
    });
    expect(case3.block).toBe(false);
    expect(case3.reason).toBe("confirmed-by-env");
  });
});

describe("guard-push main() wiring", () => {
  // main() is not exported — it reads real stdin, calls the real currentBranch(), and
  // calls process.exit() directly, so it cannot be driven in-process without killing the
  // vitest worker. This drives it the only safe way: as a real child process, fed the
  // same "<localRef> <localSha> <remoteRef> <remoteSha>" stdin format `.githooks/pre-push`
  // feeds it, with NO real `git push` and NO remote involved anywhere.
  //
  // Other guards are neutralized so this tests only the destination refusal.
  //   - guards 2-4 (in-flight CI, format, static) via their own
  //     documented SKIP_*_GUARD=1 overrides, passed ONLY to this spawned child's env
  //     (never to this session's own shell, and never used for a real push).
  //   - guard 1 (auto-merge) has no override, so PATH is stripped of gh for this child.
  const GUARD_PUSH_SCRIPT = join(process.cwd(), "scripts", "guard-push.mjs");
  const FAKE_SHA = "1".repeat(40);

  function pathWithoutExecutable(name: string): string {
    const sep = process.platform === "win32" ? ";" : ":";
    const candidates = process.platform === "win32" ? [`${name}.exe`, `${name}.cmd`, `${name}.bat`, name] : [name];
    const dirs = (process.env.PATH ?? (process.env as Record<string, string | undefined>).Path ?? "")
      .split(sep)
      .filter(Boolean);
    return dirs.filter((dir) => !candidates.some((candidate) => existsSync(join(dir, candidate)))).join(sep);
  }

  function runGuardPushChild(stdin: string) {
    // `NodeJS.ProcessEnv`, not a plain `Record`: Next's own global augmentation adds a required
    // `NODE_ENV` to that interface, and `execFileSync`'s `env` option is typed against it —
    // `childEnv` starts as a literal copy of `process.env`, which already satisfies it.
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: pathWithoutExecutable("gh"),
      SKIP_IN_FLIGHT_CI_GUARD: "1",
      SKIP_FORMAT_GUARD: "1",
      SKIP_STATIC_GUARD: "1",
    };
    try {
      const stdout = execFileSync(
        process.execPath,
        [GUARD_PUSH_SCRIPT, "origin", "https://github.com/BigSimmo/PsychSift.git"],
        {
          input: stdin,
          encoding: "utf8",
          env: childEnv,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
      return { status: 0, stdout, stderr: "" };
    } catch (error) {
      const err = error as { status?: number | null; stdout?: string; stderr?: string };
      return { status: err.status ?? null, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
    }
  }

  it("exits non-zero when the actual push destination is not Ward-Flow", () => {
    const stdin = `refs/heads/test-wiring-branch ${FAKE_SHA} refs/heads/main ${ZERO}\n`;
    const result = runGuardPushChild(stdin);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("[guard-push] Push blocked:");
    expect(result.stderr).toContain("✖ ward-flow-remote");
    // Destination refusal happens before the other guards can contact GitHub.
    expect(result.stderr).not.toContain("gh not available");
    expect(result.stderr).not.toContain("auto-merge");
  });
});
