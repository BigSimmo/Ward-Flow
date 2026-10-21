import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import * as guardPush from "../scripts/guard-push.mjs";
import {
  isCanonicalWardFlowRemote,
  isPublicWardFlowCheckout,
  scopedActiveSignOutLines,
  signOutConflicts,
  WARD_FLOW_IDENTITY_ANCHOR,
} from "../scripts/pre-commit-checks.mjs";
import { HAS_WARD_FLOW_HISTORY, NEEDS_WARD_FLOW_HISTORY } from "./helpers/ward-flow-history";

const SCRIPT = resolve("scripts/pre-commit-checks.mjs");
const SIGN_OUT_CHECK = resolve("scripts/ward-flow/sign-out-check.mjs");
const roots: string[] = [];

function git(root: string, ...args: string[]) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

// Borrow this checkout's objects so a tiny fixture can descend from the real identity anchor.
const OBJECTS = resolve(git(process.cwd(), "rev-parse", "--git-common-dir"), "objects").replace(/\\/g, "/");

function repo(parent?: string) {
  const root = mkdtempSync(join(tmpdir(), "ward-public-signout-"));
  roots.push(root);
  git(root, "init", "--quiet", "-b", "main");
  git(root, "config", "user.name", "Ward Test");
  git(root, "config", "user.email", "ward-test@example.invalid");
  mkdirSync(join(root, ".git", "objects", "info"), { recursive: true });
  writeFileSync(join(root, ".git", "objects", "info", "alternates"), `${OBJECTS}\n`);
  writeFileSync(join(root, "README.md"), "synthetic\n");
  git(root, "add", "README.md");
  const tree = git(root, "write-tree");
  const base = git(root, "commit-tree", tree, ...(parent ? ["-p", parent] : []), "-m", "base");
  git(root, "update-ref", "refs/heads/main", base);
  git(root, "remote", "add", "origin", "https://github.com/BigSimmo/Ward-Flow.git");
  git(root, "update-ref", "refs/remotes/origin/main", base);
  return root;
}

const publicRepo = () => repo(WARD_FLOW_IDENTITY_ANCHOR);

function hasIdentityObjects(): boolean {
  try {
    git(process.cwd(), "cat-file", "-e", `${WARD_FLOW_IDENTITY_ANCHOR}^{commit}`);
    return true;
  } catch {
    return false;
  }
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    expect(resolve(root).startsWith(resolve(tmpdir()))).toBe(true);
    rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

describe("public repository ownership boundary", () => {
  it("keeps the ownership identity identical to the push guard's", () => {
    expect(WARD_FLOW_IDENTITY_ANCHOR).toBe(guardPush.WARD_FLOW_IDENTITY_ANCHOR);
    for (const url of [
      "https://github.com/BigSimmo/Ward-Flow.git",
      "https://github.com/BigSimmo/Ward-Flow",
      "git@github.com:BigSimmo/Ward-Flow.git",
      "ssh://git@github.com/BigSimmo/Ward-Flow.git",
      "https://github.com/BigSimmo/Database.git",
      "https://github.com/BigSimmo/Ward-Flow.git.evil",
      "",
    ]) {
      expect(isCanonicalWardFlowRemote(url), url).toBe(guardPush.isCanonicalWardFlowRemote(url));
    }
  });

  it("recognises a verified checkout at an arbitrary path and rejects a wrong push destination", (ctx) => {
    ctx.skip(!HAS_WARD_FLOW_HISTORY, NEEDS_WARD_FLOW_HISTORY);
    const publicRoot = publicRepo();
    expect(isPublicWardFlowCheckout(publicRoot)).toBe(true);
    const wrongRoot = publicRepo();
    git(wrongRoot, "remote", "set-url", "--push", "origin", "https://github.com/BigSimmo/PsychSift.git");
    expect(isPublicWardFlowCheckout(wrongRoot)).toBe(false);
  });

  it("recognises an offline checkout with an anchored local main and retains its explicit public claims", (ctx) => {
    ctx.skip(!hasIdentityObjects(), NEEDS_WARD_FLOW_HISTORY);
    const root = publicRepo();
    const owner = publicRepo();
    git(root, "update-ref", "-d", "refs/remotes/origin/main");
    git(owner, "update-ref", "-d", "refs/remotes/origin/main");
    const claim = `- 2026-10-20 | Owner | fix/audit | ${owner} | tests/offline.test.ts; repo=BigSimmo/Ward-Flow`;
    const log = `## Active sign-outs\n${claim}\n`;
    expect(isPublicWardFlowCheckout(root)).toBe(true);
    expect(scopedActiveSignOutLines(log, root)).toContain(claim);
    expect(signOutConflicts(["tests/offline.test.ts"], log, "fix/other", root)).toEqual([
      { file: "tests/offline.test.ts", owner: "Owner", branch: "fix/audit" },
    ]);
  });

  it("does not use local main to conceal a foreign origin/main", (ctx) => {
    ctx.skip(!hasIdentityObjects(), NEEDS_WARD_FLOW_HISTORY);
    const root = publicRepo();
    const foreign = git(root, "commit-tree", git(root, "rev-parse", "HEAD^{tree}"), "-m", "foreign baseline");
    git(root, "update-ref", "refs/remotes/origin/main", foreign);
    expect(isPublicWardFlowCheckout(root)).toBe(false);
  });

  it("rejects an offline checkout when neither main baseline exists", (ctx) => {
    ctx.skip(!hasIdentityObjects(), NEEDS_WARD_FLOW_HISTORY);
    const root = publicRepo();
    git(root, "checkout", "--quiet", "-b", "fix/offline");
    git(root, "update-ref", "-d", "refs/remotes/origin/main");
    git(root, "update-ref", "-d", "refs/heads/main");
    expect(isPublicWardFlowCheckout(root)).toBe(false);
  });

  it("rejects an offline checkout with a foreign local main despite an anchored HEAD", (ctx) => {
    ctx.skip(!hasIdentityObjects(), NEEDS_WARD_FLOW_HISTORY);
    const root = publicRepo();
    const foreign = git(root, "commit-tree", git(root, "rev-parse", "HEAD^{tree}"), "-m", "foreign baseline");
    git(root, "checkout", "--quiet", "-b", "fix/offline");
    git(root, "update-ref", "-d", "refs/remotes/origin/main");
    git(root, "update-ref", "refs/heads/main", foreign);
    expect(isPublicWardFlowCheckout(root)).toBe(false);
  });

  it("rejects an offline checkout with the wrong push destination", (ctx) => {
    ctx.skip(!hasIdentityObjects(), NEEDS_WARD_FLOW_HISTORY);
    const root = publicRepo();
    git(root, "update-ref", "-d", "refs/remotes/origin/main");
    git(root, "remote", "set-url", "--push", "origin", "https://github.com/BigSimmo/PsychSift.git");
    expect(isPublicWardFlowCheckout(root)).toBe(false);
  });

  it("accepts the canonical ssh:// remote the push guard accepts", (ctx) => {
    ctx.skip(!HAS_WARD_FLOW_HISTORY, NEEDS_WARD_FLOW_HISTORY);
    const sshRoot = publicRepo();
    git(sshRoot, "remote", "set-url", "origin", "ssh://git@github.com/BigSimmo/Ward-Flow.git");
    expect(isPublicWardFlowCheckout(sshRoot)).toBe(true);
  });

  it("rejects a repointed checkout whose history does not descend from Ward-Flow main", () => {
    // HEAD and origin/main share a merge base, so only the identity anchor tells them apart.
    expect(isPublicWardFlowCheckout(repo())).toBe(false);
  });

  it("ignores a replace ref that grafts foreign history onto the identity anchor", (ctx) => {
    ctx.skip(!HAS_WARD_FLOW_HISTORY, NEEDS_WARD_FLOW_HISTORY);
    const root = repo();
    git(root, "replace", "--graft", git(root, "rev-parse", "HEAD"), WARD_FLOW_IDENTITY_ANCHOR);
    git(root, "merge-base", "--is-ancestor", WARD_FLOW_IDENTITY_ANCHOR, "HEAD");
    expect(isPublicWardFlowCheckout(root)).toBe(false);
  });

  it("ignores a legacy info/grafts file that gives foreign history the identity anchor as a parent", (ctx) => {
    ctx.skip(!HAS_WARD_FLOW_HISTORY, NEEDS_WARD_FLOW_HISTORY);
    const root = repo();
    writeFileSync(
      join(root, ".git", "info", "grafts"),
      `${git(root, "rev-parse", "HEAD")} ${WARD_FLOW_IDENTITY_ANCHOR}\n`,
    );
    git(root, "merge-base", "--is-ancestor", WARD_FLOW_IDENTITY_ANCHOR, "HEAD");
    expect(isPublicWardFlowCheckout(root)).toBe(false);
  });

  it("keeps legacy releases from closing same-named public claims", (ctx) => {
    ctx.skip(!HAS_WARD_FLOW_HISTORY, NEEDS_WARD_FLOW_HISTORY);
    const root = publicRepo();
    const owner = publicRepo();
    const publicClaim = `- 2026-09-28 | Public | ward/shared | ${owner} | AGENTS.md`;
    const legacyClaim = "- 2026-09-27 | Legacy | ward/shared | D:/Worktrees/Database/old | AGENTS.md";
    const oldRelease = "RELEASED 2026-09-28 | Legacy | ward/shared | folded old line";
    const log = ["Open sign-outs only", legacyClaim, publicClaim, oldRelease].join("\n");
    expect(scopedActiveSignOutLines(log, root)).toContain(publicClaim);
    expect(scopedActiveSignOutLines(log, root)).not.toContain(oldRelease);
    expect(signOutConflicts(["AGENTS.md"], log, "ward/mine", root)).toEqual([
      { file: "AGENTS.md", owner: "Public", branch: "ward/shared" },
    ]);
    const publicRelease = "RELEASED 2026-09-28 | Public | ward/shared | repo=BigSimmo/Ward-Flow";
    expect(signOutConflicts(["AGENTS.md"], `${log}\n${publicRelease}`, "ward/mine", root)).toEqual([]);
  });

  it("requires a sign-out for a codex branch's backend file", (ctx) => {
    ctx.skip(!HAS_WARD_FLOW_HISTORY, NEEDS_WARD_FLOW_HISTORY);
    const root = publicRepo();
    git(root, "checkout", "--quiet", "-b", "codex/backend");
    const file = "backend/ward-flow/notes.md";
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), "synthetic backend note\n");
    git(root, "add", file);
    const signOutFile = join(root, "sign-out.md");
    const run = () =>
      spawnSync(process.execPath, [SCRIPT], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, WARD_SIGNOUT_FILE: signOutFile },
      });
    // An empty log blocks an unsigned file; a missing log only warns (see pre-commit-checks.test.ts).
    writeFileSync(signOutFile, "Open sign-outs only\n");
    const blocked = run();
    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain("without your sign-out");
    writeFileSync(
      signOutFile,
      `Open sign-outs only\n- 2026-09-28 | Owner | codex/backend | ${root} | ${file}, repo=BigSimmo/Ward-Flow\n`,
    );
    const allowed = run();
    expect(allowed.status).toBe(0);
  });

  it("finds a same-file change on another codex branch", (ctx) => {
    ctx.skip(!HAS_WARD_FLOW_HISTORY, NEEDS_WARD_FLOW_HISTORY);
    const root = publicRepo();
    const file = "docs/ward-flow/shared.md";
    git(root, "checkout", "--quiet", "-b", "codex/other");
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), "other branch\n");
    git(root, "add", file);
    git(root, "commit", "--quiet", "-m", "other edit");
    git(root, "checkout", "--quiet", "main");
    git(root, "checkout", "--quiet", "-b", "codex/mine");
    mkdirSync(join(root, "scripts"), { recursive: true });
    copyFileSync(SCRIPT, join(root, "scripts/pre-commit-checks.mjs"));
    writeFileSync(join(root, "package.json"), '{"type":"module"}\n');
    const signOutFile = join(root, "sign-out.md");
    writeFileSync(signOutFile, "Open sign-outs only\n");
    const result = spawnSync(process.execPath, [SIGN_OUT_CHECK, file], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, WARD_SIGNOUT_FILE: signOutFile },
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain(`ALSO CHANGED  ${file}  on unfolded branch codex/other`);
  });
});
