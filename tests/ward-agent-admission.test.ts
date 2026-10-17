import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { devNull, tmpdir } from "node:os";
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
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: devNull };
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
    { WARD_SIGNOUT_FILE: path.join(f.dir, "absent.md"), WARD_FLOW_LOGS: path.dirname(f.env.WARD_SIGNOUT_FILE ?? "") },
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

test("merge admission excludes unchanged upstream files from task ownership", (t) => {
  const f = mergeFixture(t);
  const admitted = f.run();
  assert.equal(admitted.status, 0, admitted.stderr);
  f.write("coordination/sign-out.md", "## Active sign-outs\n");
  const unsigned = f.run();
  assert.equal(unsigned.status, 1);
  assert.match(unsigned.stderr, /without your sign-out/);
});

test("merge admission still scans upstream changes for secrets", (t) => {
  const f = mergeFixture(t, "docs/ward-flow/upstream.md", `key ${"AKIA" + "QWERTYUIOPASDFGH"}\n`);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AWS access key/);
});

test("merge ownership preserves NUL-delimited paths with whitespace and non-ASCII names", (t) => {
  const f = mergeFixture(t);
  const special = ["space name.md", "tab\tname.md", "line\nname.md", "é.md"].map(
    (name) => `docs/ward-flow/special/${name}`,
  );
  for (const name of special) f.stage("synthetic task addition\n", name);
  const unsigned = f.run();
  assert.equal(unsigned.status, 1);
  for (const name of special) assert.ok(unsigned.stderr.includes(name), name);
  // The legacy log cannot quote arbitrary exact paths, but its supported
  // directory-claim syntax covers this synthetic, expressly owned subtree.
  f.claims([file, "docs/ward-flow/special/"]);
  const admitted = f.run();
  assert.equal(admitted.status, 0, admitted.stderr);
});

test("type-only changes require ownership admission", (t) => {
  const f = fixture(t);
  f.stageSymlink("synthetic-target");
  assert.match(f.git("diff", "--cached", "--name-status", "-z"), /^T\0/);
  f.write("coordination/sign-out.md", "## Active sign-outs\n");
  const unsigned = f.run();
  assert.equal(unsigned.status, 1);
  assert.match(unsigned.stderr, /without your sign-out/);
  f.claims();
  const admitted = f.run();
  assert.equal(admitted.status, 0, admitted.stderr);
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

test("missing logs have no implicit host waiver and public root claims use isolated fixture history", async (t) => {
  assert.equal(signOutLogOptional(), false);
  const f = fixture(t);
  const checker = await f.makePublic();
  assert.equal(checker.isPublicWardFlowCheckout(f.dir), true);
  assert.deepEqual(checker.unsignedWardFiles(["AGENTS.md"], "", branch, f.dir), ["AGENTS.md"]);
  f.stage("synthetic root rule\n", "AGENTS.md");
  const unsigned = f.run();
  assert.equal(unsigned.status, 1);
  assert.match(unsigned.stderr, /without your sign-out/);
  f.claims(["AGENTS.md"]);
  const admitted = f.run();
  assert.equal(admitted.status, 0, admitted.stderr);
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
  assert.match(nested, /@\.\.\/\.\.\/\.\.\/AGENTS\.md/);
  assert.doesNotMatch(nested, /where\s+they differ, they win/);
  assert.match(agents, /git-publication\.md#bare-pr-publication-is-not-readiness-work/);
  assert.match(publication, /SKIP_PRECOMMIT_READINESS=1 git commit/);
  assert.match(publication, /Never use `git commit --no-verify`/);
  assert.doesNotMatch(publication, /publish with `git commit --no-verify`/);
});
