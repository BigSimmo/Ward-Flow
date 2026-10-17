import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { devNull, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { signOutLogOptional, unsignedWardFiles } from "../scripts/pre-commit-checks.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const hook = path.join(root, ".githooks/pre-commit");
const file = "docs/ward-flow/admission-probe.md";
const branch = "ward/admission-fixture";
const gitBash = "C:/Program Files/Git/bin/bash.exe";
const bash = process.platform === "win32" && existsSync(gitBash) ? gitBash : "bash";

function fixture(t) {
  const dir = mkdtempSync(path.join(tmpdir(), "ward-admission-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: devNull };
  for (const key of Object.keys(env)) {
    if (key.startsWith("GIT_") && !["GIT_CONFIG_NOSYSTEM", "GIT_CONFIG_GLOBAL"].includes(key)) delete env[key];
    if (key.startsWith("WARD_") || key.startsWith("SKIP_") || key === "CONFIRM_WARD_FLOW_FOLD_TO_MAIN") delete env[key];
  }
  const git = (...args) => execFileSync("git", args, { cwd: dir, env, encoding: "utf8", stdio: "pipe" }).trim();
  const write = (name, content) => {
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
  const stage = (content, name = file) => {
    write(name, content);
    git("add", "--", name);
  };
  const run = (overrides = {}) =>
    spawnSync(bash, [hook], {
      cwd: dir,
      env: { ...env, SKIP_PRECOMMIT_READINESS: "1", ...overrides },
      encoding: "utf8",
    });
  return { dir, env, git, write, claims, stage, run };
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

test("unsigned files and peers' claims still block publication", (t) => {
  const f = fixture(t);
  f.stage("synthetic change\n");
  f.write("coordination/sign-out.md", "## Active sign-outs\n");
  assert.match(f.run().stderr, /without your sign-out/);
  f.claims([file], "Peer fixture", "ward/peer", path.join(f.dir, "peer-checkout"));
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /signed out by another session/);
  assert.match(result.stderr, /Peer fixture/);
});

test("explicit file and directory configurations fail closed when unavailable", (t) => {
  const f = fixture(t);
  f.stage("synthetic change\n");
  for (const overrides of [
    { WARD_SIGNOUT_FILE: path.join(f.dir, "absent.md"), WARD_FLOW_LOGS: path.dirname(f.env.WARD_SIGNOUT_FILE) },
    { WARD_SIGNOUT_FILE: "", WARD_FLOW_LOGS: path.join(f.dir, "absent-logs") },
    { WARD_SIGNOUT_FILE: f.dir },
  ]) {
    const result = f.run(overrides);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /log unavailable|checks crashed/);
  }
});

test("an implicit missing Cloud log also fails closed", { skip: process.platform === "win32" }, (t) => {
  const f = fixture(t);
  f.stage("synthetic change\n");
  // Only this child sees a synthetic home; the host's home and logs are untouched.
  const result = f.run({ HOME: f.dir, WARD_SIGNOUT_FILE: "", WARD_FLOW_LOGS: "" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /sign-out log unavailable/);
});

test("bare admission rejects the single-user ownership waiver", (t) => {
  const f = fixture(t);
  f.stage("synthetic change\n");
  const result = f.run({ SKIP_SIGNOUT_GUARD: "1" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot skip ownership admission/);
});

test("bare admission checks ownership during a merge", (t) => {
  const f = fixture(t);
  f.stage("synthetic change\n");
  f.write(".git/MERGE_HEAD", `${f.git("rev-parse", "HEAD")}\n`);
  f.write("coordination/sign-out.md", "## Active sign-outs\n");
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /without your sign-out/);
});

test("deletions require ownership admission as well", (t) => {
  const f = fixture(t);
  f.git("rm", "--", file);
  f.write("coordination/sign-out.md", "## Active sign-outs\n");
  const blocked = f.run();
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /without your sign-out/);
  f.claims();
  const admitted = f.run();
  assert.equal(admitted.status, 0, admitted.stderr);
});

test("renames require claims for both the source and target paths", (t) => {
  const f = fixture(t);
  const target = "docs/ward-flow/renamed-probe.md";
  f.git("mv", "--", file, target);
  f.claims([target]);
  const blocked = f.run();
  assert.equal(blocked.status, 1);
  assert.match(blocked.stderr, /without your sign-out/);
  assert.match(blocked.stderr, /admission-probe\.md/);
  f.claims([file, target]);
  const admitted = f.run();
  assert.equal(admitted.status, 0, admitted.stderr);
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

test("missing logs have no implicit host waiver and real Ward claims include root files", () => {
  for (const platform of ["linux", "darwin", "win32"]) assert.equal(signOutLogOptional({}, platform), false);
  assert.deepEqual(unsignedWardFiles(["AGENTS.md"], "", "codex/fixture", root), ["AGENTS.md"]);
});

test("instruction adapters and policy pointers preserve one authority and scoped publication", () => {
  const agents = readFileSync(path.join(root, "AGENTS.md"), "utf8");
  const publication = readFileSync(path.join(root, "docs/agents/git-publication.md"), "utf8");
  const nested = readFileSync(path.join(root, "src/components/ward-management/CLAUDE.md"), "utf8");
  assert.match(nested, /@\.\.\/\.\.\/\.\.\/AGENTS\.md/);
  assert.doesNotMatch(nested, /where\s+they differ, they win/);
  assert.match(agents, /git-publication\.md#bare-pr-publication-is-not-readiness-work/);
  assert.match(publication, /SKIP_PRECOMMIT_READINESS=1 git commit/);
  assert.match(publication, /Never use `git commit --no-verify`/);
  assert.doesNotMatch(publication, /publish with `git commit --no-verify`/);
});
