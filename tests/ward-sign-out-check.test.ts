import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
let gitRoot: string;
let script: string;
let signOut: string;
const git = (...args: string[]) =>
  execFileSync("git", ["-c", "core.hooksPath=", ...args], { cwd: gitRoot, stdio: "pipe" });
const run = (...args: string[]) =>
  spawnSync(process.execPath, [script, ...args], {
    cwd: gitRoot,
    encoding: "utf8",
    env: { ...process.env, WARD_SIGNOUT_FILE: signOut },
  });
const claim = (files: string) =>
  `## Active sign-outs\n- 2026-10-02 | Fixture owner | ward/other | ${gitRoot}/other | ${files}\n`;

beforeEach(() => {
  gitRoot = mkdtempSync(path.join(tmpdir(), "ward-signout-fixture-"));
  mkdirSync(path.join(gitRoot, "scripts/ward-flow"), { recursive: true });
  for (const name of ["scripts/pre-commit-checks.mjs", "scripts/ward-flow/sign-out-check.mjs"]) {
    writeFileSync(path.join(gitRoot, name), readFileSync(path.join(root, name)));
  }
  script = path.join(gitRoot, "scripts/ward-flow/sign-out-check.mjs");
  signOut = path.join(gitRoot, "sign-out.md");
  writeFileSync(signOut, "Open sign-outs only\n");
  writeFileSync(path.join(gitRoot, "file.ts"), "export const fixture = 1;\n");
  // Remote-less legacy-line fixtures exercise the checker without touching live branches/logs.
  git("init", "-b", "codex/task-ward-flow-live-state-20260831");
  git("add", "--", "scripts", "file.ts");
  git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "fixture base");
  git("switch", "-c", "ward/current");
});

afterEach(() => rmSync(gitRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

describe("ward sign-out-check", () => {
  it("prints usage and exits 2 when no arguments are given", () => {
    const result = run();
    expect(result.status).toBe(2);
    expect(result.stdout).toContain("Usage: sign-out-check.mjs");
  });

  it("checks stale entries cleanly with --stale", () => {
    writeFileSync(signOut, claim("file.ts"));
    const result = run("--stale");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("1 stale sign-out line(s)");
  });

  it("reports no clash on a non-clashing file", () => {
    const result = run("file.ts");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("no clash for 1 file(s)");
  });

  it("blocks active claims and permits an explicit release", () => {
    writeFileSync(signOut, claim("file.ts"));
    expect(run("file.ts").status).toBe(1);
    writeFileSync(signOut, `${claim("file.ts")}RELEASED 2026-10-02 | Fixture owner | ward/other | complete\n`);
    expect(run("file.ts").status).toBe(0);
  });

  it("an approved takeover applies only to its exact file", () => {
    writeFileSync(
      signOut,
      `${claim("file.ts, other.ts")}- 2026-10-02 | Current | ward/current | ${gitRoot} | file.ts (approved takeover by Josh: synthetic test fixture only)\n`,
    );
    expect(run("file.ts").stdout).toContain("APPROVED TAKEOVER");
    expect(run("other.ts").status).toBe(1);
  });

  it("still detects dormant unmerged changes without an active claim", () => {
    git("switch", "-c", "ward/other");
    writeFileSync(path.join(gitRoot, "file.ts"), "export const fixture = 2;\n");
    git("add", "--", "file.ts");
    execFileSync(
      "git",
      [
        "-c",
        "core.hooksPath=",
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "-m",
        "old fixture change",
      ],
      {
        cwd: gitRoot,
        stdio: "pipe",
        env: { ...process.env, GIT_AUTHOR_DATE: "2020-01-01T00:00:00Z", GIT_COMMITTER_DATE: "2020-01-01T00:00:00Z" },
      },
    );
    git("switch", "ward/current");
    const result = run("file.ts");
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("ALSO CHANGED  file.ts  on unfolded branch ward/other");
  });
});
