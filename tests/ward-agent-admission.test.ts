import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { it, onTestFinished } from "vitest";
import { signOutLogOptional } from "../scripts/pre-commit-checks.mjs";

// Spawned git/bash fixtures; formerly a node:test file under scripts/tests, run here so the
// whole-suite runner collects it and the scripts/ coverage inventory stays complete.
type Cleanup = { after: (fn: () => void) => void };
type Body = (t: Cleanup) => unknown;
function test(name: string, optionsOrBody: { skip?: boolean } | Body, maybeBody?: Body) {
  const options = typeof optionsOrBody === "function" ? {} : optionsOrBody;
  const body = (typeof optionsOrBody === "function" ? optionsOrBody : maybeBody) as Body;
  (options.skip ? it.skip : it)(name, { timeout: 120_000 }, () => body({ after: (fn) => onTestFinished(fn) }));
}

const root = fileURLToPath(new URL("../", import.meta.url));
const hook = path.join(root, ".githooks", "pre-commit").replace(/\\/g, "/");
const file = "docs/ward-flow/admission-probe.md";
const branch = "ward/admission-fixture";
const gitBash = "C:/Program Files/Git/bin/bash.exe";
const bash = process.platform === "win32" && existsSync(gitBash) ? gitBash : "bash";
if (process.platform === "win32") {
  const probe = spawnSync(bash, ["-c", 'uname -s && test -f "$1"', "ward-admission-shell-probe", hook], {
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.ok(
    probe.status === 0 && /^(?:MINGW|MSYS)/.test(probe.stdout ?? ""),
    `Windows admission fixtures require Git Bash (MINGW/MSYS) with access to the native hook path; selected ${bash}. WSL or unavailable Bash cannot run these fixtures. ${probe.error?.message ?? probe.stderr?.trim() ?? ""}`,
  );
}

function fixture(t: Cleanup) {
  const dir = mkdtempSync(path.join(tmpdir(), "ward-admission-"));
  t.after(() => rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  const globalGitConfig = path.join(dir, ".gitconfig-global");
  writeFileSync(globalGitConfig, "");
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: globalGitConfig };
  for (const key of Object.keys(env)) {
    if (key.startsWith("GIT_") && !["GIT_CONFIG_NOSYSTEM", "GIT_CONFIG_GLOBAL"].includes(key)) delete env[key];
    if (key.startsWith("WARD_") || key.startsWith("SKIP_") || key === "CONFIRM_WARD_FLOW_FOLD_TO_MAIN") delete env[key];
  }
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: "pipe" }).trim();
  const write = (name: string, content: string) => {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), content);
  };
  git("init", "--quiet", "--initial-branch", branch);
  git("config", "user.name", "Synthetic fixture");
  git("config", "user.email", "synthetic@example.invalid");
  write(file, "synthetic baseline\n");
  git("add", file);
  git("commit", "--quiet", "-m", "synthetic baseline");
  mkdirSync(path.join(dir, "scripts"), { recursive: true });
  copyFileSync(path.join(root, "scripts/pre-commit-checks.mjs"), path.join(dir, "scripts/pre-commit-checks.mjs"));
  const log = path.join(dir, "coordination/sign-out.md");
  env.WARD_SIGNOUT_FILE = log;
  const claims = (paths = [file], owner = "Fixture owner", taskBranch = branch, checkout = dir) =>
    write(
      "coordination/sign-out.md",
      `## Active sign-outs\n- 2026-10-17 | ${owner} | ${taskBranch} | ${checkout} | ${paths.join(", ")}\n`,
    );
  claims();
  const stage = (content: string, name = file) => {
    write(name, content);
    git("add", "--", name);
  };
  // Write a synthetic symlink blob to the fixture index without OS symlink privileges.
  const stageSymlink = (content: string, name = file) => {
    const oid = execFileSync("git", ["hash-object", "-w", "--stdin"], {
      cwd: dir,
      env,
      input: content,
      encoding: "utf8",
    }).trim();
    git("update-index", "--add", "--cacheinfo", "120000", oid, name);
  };
  const makePublic = async () => {
    const checker = path.join(dir, "scripts/pre-commit-checks.mjs");
    const source = readFileSync(checker, "utf8");
    // Only this disposable copy uses its own minted history anchor. No real
    // repository objects, remotes or origin/main ref are required by the test.
    const synthetic = source.replace(
      /(export const WARD_FLOW_IDENTITY_ANCHOR = ")[a-f0-9]{40}(";)/,
      `$1${git("rev-parse", "HEAD")}$2`,
    );
    assert.notEqual(synthetic, source);
    writeFileSync(checker, synthetic);
    git("remote", "add", "origin", "https://github.com/BigSimmo/Ward-Flow.git");
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    return import(pathToFileURL(checker).href);
  };
  const run = (overrides: Record<string, string | undefined> = {}) =>
    spawnSync(bash, [hook], {
      cwd: dir,
      env: { ...env, SKIP_PRECOMMIT_READINESS: "1", ...overrides } as NodeJS.ProcessEnv,
      encoding: "utf8",
    });
  return { dir, env, git, write, claims, stage, stageSymlink, makePublic, run };
}

function mergeFixture(t: Cleanup, upstreamFile = "docs/ward-flow/upstream.md", upstreamText = "synthetic upstream\n") {
  const f = fixture(t);
  f.git("switch", "--quiet", "-c", "synthetic-upstream");
  f.stage(upstreamText, upstreamFile);
  f.git("commit", "--quiet", "-m", "synthetic upstream change");
  f.git("switch", "--quiet", branch);
  f.stage("synthetic task change\n");
  f.git("commit", "--quiet", "-m", "synthetic task change");
  f.git("merge", "--quiet", "--no-commit", "--no-ff", "synthetic-upstream");
  return f;
}

test("publication skips readiness only after clean staged admission", (t) => {
  const f = fixture(t);
  f.stage("synthetic change\n");
  f.write("scripts/check-staged-docs.mjs", "throw new Error('readiness must remain unrun');\n");
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /admission ok/);
  assert.match(result.stderr, /readiness checks unrun/);
  assert.doesNotMatch(result.stderr, /readiness must remain unrun/);
});

test("normal commits retain their readiness checks", (t) => {
  const f = fixture(t);
  f.stage("synthetic change\n");
  f.write("scripts/check-staged-docs.mjs", "throw new Error('normal readiness sentinel');\n");
  const result = f.run({ SKIP_PRECOMMIT_READINESS: "" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /normal readiness sentinel/);
});

test("readiness skip still rejects a secret in the staged index after the worktree is cleaned", (t) => {
  const f = fixture(t);
  f.stage(`key ${"AKIA" + "QWERTYUIOPASDFGH"}\n`);
  f.write(file, "clean unstaged worktree\n");
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AWS access key/);
  assert.doesNotMatch(result.stderr, /admission ok/);
});

test("an unstaged secret is not mistaken for staged content", (t) => {
  const f = fixture(t);
  f.stage("clean staged text\n");
  f.write(file, `key ${"AKIA" + "QWERTYUIOPASDFGH"}\n`);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
});

test("readiness skip still rejects checksum-valid synthetic patient identifiers", (t) => {
  const f = fixture(t);
  f.stage(`Medicare ${["2123", "45670", "1"].join(" ")}\n`);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Medicare/);
});

// Q374: the branch or PR is the claim. Only a peer's active hold blocks.
test("own unclaimed files are admitted but peers' claims still block publication", (t) => {
  const f = fixture(t);
  f.stage("synthetic change\n");
  f.write("coordination/sign-out.md", "## Active sign-outs\n");
  const own = f.run();
  assert.equal(own.status, 0, own.stderr);
  assert.doesNotMatch(own.stderr, /without your sign-out/);
  f.claims([file], "Peer fixture", "ward/peer", path.join(f.dir, "peer-checkout"));
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /signed out by another session/);
  assert.match(result.stderr, /Peer fixture/);
});

test("a missing explicit log admits own files; an unreadable log or claims folder fails closed", (t) => {
  const f = fixture(t);
  f.stage("synthetic change\n");
  for (const overrides of [
    { WARD_SIGNOUT_FILE: path.join(f.dir, "absent.md"), WARD_FLOW_LOGS: path.dirname(f.env.WARD_SIGNOUT_FILE ?? "") },
    { WARD_SIGNOUT_FILE: "", WARD_FLOW_LOGS: path.join(f.dir, "absent-logs") },
  ]) {
    const result = f.run(overrides);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /no shared sign-out log: no logged peer holds/);
  }
  const directory = f.run({ WARD_SIGNOUT_FILE: f.dir });
  assert.equal(directory.status, 1);
  assert.match(directory.stderr, /checks crashed/);
  // A file where the claims folder should be may hide peer holds, so it never reads as empty.
  f.write("unreadable-logs/claims", "not a folder\n");
  const claims = f.run({ WARD_SIGNOUT_FILE: path.join(f.dir, "unreadable-logs/sign-out.md") });
  assert.equal(claims.status, 1);
  assert.match(claims.stderr, /claims folder unreadable/);
});

test("a peer's claim file still blocks when the log itself is missing", (t) => {
  const f = fixture(t);
  f.stage("synthetic change\n");
  f.write(
    "peer-logs/claims/20261017T0100Z-peer.md",
    `- 2026-10-17T01:00Z | Peer fixture | ward/peer | ${path.join(f.dir, "peer-checkout")} | ${file}\n`,
  );
  const result = f.run({ WARD_SIGNOUT_FILE: path.join(f.dir, "peer-logs/sign-out.md") });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /signed out by another session/);
  assert.match(result.stderr, /Peer fixture/);
});

test("an implicit missing Cloud log admits own files", { skip: process.platform === "win32" }, (t) => {
  const f = fixture(t);
  f.stage("synthetic change\n");
  // Only this child sees a synthetic home; the host's home and logs are untouched.
  const result = f.run({ HOME: f.dir, WARD_SIGNOUT_FILE: "", WARD_FLOW_LOGS: "" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /no shared sign-out log: no logged peer holds/);
});

test("bare admission rejects the single-user ownership waiver", (t) => {
  const f = fixture(t);
  f.stage("synthetic change\n");
  const result = f.run({ SKIP_SIGNOUT_GUARD: "1" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot skip ownership admission/);
});

test("bare admission checks peer ownership during a merge", (t) => {
  const f = fixture(t);
  f.stage("synthetic change\n");
  f.write(".git/MERGE_HEAD", `${f.git("rev-parse", "HEAD")}\n`);
  f.write("coordination/sign-out.md", "## Active sign-outs\n");
  const own = f.run();
  assert.equal(own.status, 0, own.stderr);
  f.claims([file], "Peer fixture", "ward/peer", path.join(f.dir, "peer-checkout"));
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /signed out by another session/);
});

test("merge admission needs no own claim but checks peers on manual resolutions", (t) => {
  const f = mergeFixture(t);
  const admitted = f.run();
  assert.equal(admitted.status, 0, admitted.stderr);
  // A manual merge resolution changes HEAD-to-index: it needs no own sign-out,
  // but a peer's active hold on that path still blocks.
  f.stage("synthetic manual merge resolution\n");
  f.write("coordination/sign-out.md", "## Active sign-outs\n");
  const unsigned = f.run();
  assert.equal(unsigned.status, 0, unsigned.stderr);
  f.claims([file], "Peer fixture", "ward/peer", path.join(f.dir, "peer-checkout"));
  const blocked = f.run();
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /signed out by another session/);
});

test("merge admission still scans upstream changes for secrets", (t) => {
  const f = mergeFixture(t, "docs/ward-flow/upstream.md", `key ${"AKIA" + "QWERTYUIOPASDFGH"}\n`);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AWS access key/);
});

test("merge ownership preserves NUL-delimited paths with whitespace and non-ASCII names", (t) => {
  const f = mergeFixture(t);
  const special = (
    process.platform === "win32"
      ? ["space name.md", "é.md"]
      : ["space name.md", "tab\tname.md", "line\nname.md", "é.md"]
  ).map((name) => `docs/ward-flow/special/${name}`);
  for (const name of special) f.stage("synthetic task addition\n", name);
  const admitted = f.run();
  assert.equal(admitted.status, 0, admitted.stderr);
  // The legacy log cannot quote arbitrary exact paths, but a peer's directory
  // claim covers this synthetic subtree and must name every special path.
  f.claims(["docs/ward-flow/special/"], "Peer fixture", "ward/peer", path.join(f.dir, "peer-checkout"));
  const blocked = f.run();
  assert.equal(blocked.status, 1);
  for (const name of special) assert.ok(blocked.stderr.includes(name), name);
});

test("type-only changes go through ownership admission", (t) => {
  const f = fixture(t);
  f.stageSymlink("synthetic-target");
  assert.match(f.git("diff", "--cached", "--name-status", "-z"), /^T\0/);
  f.write("coordination/sign-out.md", "## Active sign-outs\n");
  const admitted = f.run();
  assert.equal(admitted.status, 0, admitted.stderr);
  f.claims([file], "Peer fixture", "ward/peer", path.join(f.dir, "peer-checkout"));
  const blocked = f.run();
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /signed out by another session/);
});

test("type-only changes remain inside the staged secret scan", (t) => {
  const f = fixture(t);
  f.stageSymlink("AKIA" + "QWERTYUIOPASDFGH");
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AWS access key/);
});

test("a type-only change cannot evade the main-branch guard", (t) => {
  const f = fixture(t);
  f.git("branch", "-m", "main");
  f.stageSymlink("synthetic-target");
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /admission ok/);
  assert.match(result.stderr, /COMMITTING WARD FLOW TO LOCAL MAIN IS BLOCKED/);
});

test("deletions go through ownership admission as well", (t) => {
  const f = fixture(t);
  f.git("rm", "--", file);
  f.write("coordination/sign-out.md", "## Active sign-outs\n");
  const admitted = f.run();
  assert.equal(admitted.status, 0, admitted.stderr);
  f.claims([file], "Peer fixture", "ward/peer", path.join(f.dir, "peer-checkout"));
  const blocked = f.run();
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /signed out by another session/);
});

test("renames check peer claims on both the source and target paths", (t) => {
  const f = fixture(t);
  const target = "docs/ward-flow/renamed-probe.md";
  f.git("mv", "--", file, target);
  f.write("coordination/sign-out.md", "## Active sign-outs\n");
  const admitted = f.run();
  assert.equal(admitted.status, 0, admitted.stderr);
  // A peer holding only the source path still blocks the rename.
  f.claims([file], "Peer fixture", "ward/peer", path.join(f.dir, "peer-checkout"));
  const blocked = f.run();
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /signed out by another session/);
  assert.match(blocked.stderr, /admission-probe\.md/);
});

test("the main-branch confirmation guard survives a readiness skip", (t) => {
  const f = fixture(t);
  f.git("branch", "-m", "main");
  f.stage("synthetic change\n");
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /admission ok/);
  assert.match(result.stderr, /COMMITTING WARD FLOW TO LOCAL MAIN IS BLOCKED/);
});

test("missing admission tooling blocks even a readiness-only publication", (t) => {
  const f = fixture(t);
  f.stage("synthetic change\n");
  rmSync(path.join(f.dir, "scripts/pre-commit-checks.mjs"));
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /required for staged safety\/ownership admission/);
});

test("older or incompatible checkers cannot silently accept publication mode", (t) => {
  const f = fixture(t);
  f.stage("synthetic task change\n");
  for (const response of ["older checker", "admission-mode=v2", "noise\nadmission-mode=v1"]) {
    f.write("scripts/pre-commit-checks.mjs", `console.log(${JSON.stringify(response)});\n`);
    const result = f.run();
    assert.equal(result.status, 1, response);
    assert.match(result.stderr, /did not confirm admission-only support/);
    assert.doesNotMatch(result.stderr, /readiness checks unrun by explicit publication scope/);
  }
});

test("checker modes reject unknown, mixed and duplicate flags", (t) => {
  const f = fixture(t);
  const checker = path.join(f.dir, "scripts/pre-commit-checks.mjs");
  const supported = spawnSync(process.execPath, [checker, "--supports-admission-only"], {
    cwd: f.dir,
    env: f.env,
    encoding: "utf8",
  });
  assert.equal(supported.status, 0, supported.stderr);
  assert.equal(supported.stdout.trim(), "admission-mode=v1");
  for (const args of [
    ["--unknown-mode"],
    ["--supports-admission-only", "--admission-only"],
    ["--typecheck-child", "--admission-only"],
    ["--admission-only", "--admission-only"],
  ]) {
    const result = spawnSync(process.execPath, [checker, ...args], { cwd: f.dir, env: f.env, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown option|cannot be combined/);
    assert.doesNotMatch(result.stdout, /admission-mode=v1/);
  }
});

test("public root files need no own claim, and a peer's public claim uses isolated fixture history", async (t) => {
  assert.equal(signOutLogOptional(), true);
  const f = fixture(t);
  const checker = await f.makePublic();
  assert.equal(checker.isPublicWardFlowCheckout(f.dir), true);
  // The informational helper still reports the file; admission no longer blocks on it.
  assert.deepEqual(checker.unsignedWardFiles(["AGENTS.md"], "", branch, f.dir), ["AGENTS.md"]);
  f.stage("synthetic root rule\n", "AGENTS.md");
  f.write("coordination/sign-out.md", "## Active sign-outs\n");
  const admitted = f.run();
  assert.equal(admitted.status, 0, admitted.stderr);
  f.write(
    "coordination/sign-out.md",
    `## Active sign-outs\n- 2026-10-17 | Peer fixture | ward/peer | ${path.join(f.dir, "peer-checkout")} | AGENTS.md; repo=BigSimmo/Ward-Flow\n`,
  );
  const blocked = f.run();
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /signed out by another session/);
});

test("explicit relative claims support extensionless root files and branch-wide releases", async (t) => {
  const f = fixture(t);
  const checker = await f.makePublic();
  f.stage("synthetic licence\n", "LICENSE");
  const claim = `- 2026-10-17 | Fixture owner | ${branch} | ${f.dir} | ./LICENSE, ./Dockerfile; repo=BigSimmo/Ward-Flow\n`;
  f.write("coordination/sign-out.md", `## Active sign-outs\n${claim}`);
  assert.deepEqual(
    checker.unsignedWardFiles(["LICENSE", "Dockerfile"], `## Active sign-outs\n${claim}`, branch, f.dir),
    [],
  );
  const admitted = f.run();
  assert.equal(admitted.status, 0, admitted.stderr);
  const released = `## Active sign-outs\n${claim}RELEASED 2026-10-17 | Other description | ${branch} | LICENSE only; repo=BigSimmo/Ward-Flow\n`;
  // Release semantics are branch-wide, even if the human-readable reason
  // mentions one file or the owner field differs.
  assert.deepEqual(checker.unsignedWardFiles(["LICENSE", "Dockerfile"], released, branch, f.dir), [
    "LICENSE",
    "Dockerfile",
  ]);
});

test("instruction adapters and policy pointers preserve one authority and scoped publication", () => {
  const agents = readFileSync(path.join(root, "AGENTS.md"), "utf8");
  const publication = readFileSync(path.join(root, "docs/agents/git-publication.md"), "utf8");
  const nested = readFileSync(path.join(root, "src/components/ward-management/CLAUDE.md"), "utf8");
  // The root CLAUDE.md already imports AGENTS.md; the nested adapter links to it instead of importing it twice (10 Nov 2026 audit).
  assert.match(nested, /\[AGENTS\.md\]\(\.\.\/\.\.\/\.\.\/AGENTS\.md\)/);
  assert.doesNotMatch(nested, /^@\.\.\/\.\.\/\.\.\/AGENTS\.md/m);
  assert.doesNotMatch(nested, /where\s+they differ, they win/);
  assert.match(agents, /git-publication\.md#bare-pr-publication-is-not-readiness-work/);
  assert.match(publication, /SKIP_PRECOMMIT_READINESS=1 git commit/);
  assert.match(publication, /Never use `git commit --no-verify`/);
  assert.doesNotMatch(publication, /publish with `git commit --no-verify`/);
});
