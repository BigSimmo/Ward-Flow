import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve(__dirname, "../scripts/ward-flow/fold-lock.mjs");
const preflightScript = path.resolve(__dirname, "../scripts/ward-flow/fold-preflight.mjs");
const readyScript = path.resolve(__dirname, "../scripts/ward-flow/ready-check.mjs");

function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), "ward-fold-lock-"));
  const git = (args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  git(["init", "--quiet"]);
  git([
    "-c",
    "user.name=Ward Test",
    "-c",
    "user.email=ward@example.invalid",
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    "base",
  ]);
  const lock = path.resolve(root, git(["rev-parse", "--git-common-dir"]), "ward-fold.lock");
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: root,
      encoding: "utf8",
      timeout: 15000,
      env: {
        ...process.env,
        WARD_FLOW_LOGS: path.join(root, "notes"),
        WARD_FOLD_WORKTREE: root,
        WARD_FOLD_LINE: "HEAD",
      },
    });
  return { root, git, lock, run };
}

describe("Ward fold lock recovery", () => {
  it("refuses every configured remote, including a non-origin remote, before mutation", () => {
    const { git, root, lock } = fixture();
    git(["remote", "add", "upstream", "https://github.com/example/ward-flow.git"]);
    for (const target of [script, preflightScript, readyScript]) {
      const result = spawnSync(process.execPath, [target, "acquire", "owner"], {
        cwd: root,
        encoding: "utf8",
        timeout: 15000,
      });
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("retired in a linked repository");
      expect(existsSync(lock)).toBe(false);
    }
  });

  it("fails closed when Git cannot verify remotes", () => {
    const root = mkdtempSync(path.join(tmpdir(), "ward-fold-not-a-repository-"));
    for (const target of [script, preflightScript, readyScript]) {
      const result = spawnSync(process.execPath, [target, "acquire", "owner"], {
        cwd: root,
        encoding: "utf8",
        timeout: 15000,
      });
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("Cannot verify repository remotes");
      expect(existsSync(path.join(root, ".git"))).toBe(false);
    }
  });

  it("refuses the retired fold workflow in a repository with a remote", () => {
    const { git, lock, run, root } = fixture();
    git(["remote", "add", "origin", "https://github.com/example/ward-flow.git"]);
    const status = run("status");
    expect(status.status).toBe(2);
    expect(status.stderr).toContain("retired in a linked repository");
    expect(existsSync(lock)).toBe(false);

    const preflight = spawnSync(
      process.execPath,
      [preflightScript, "--branch", "HEAD", "--create-backup", "test", "--ward-lead", root],
      { cwd: root, encoding: "utf8", timeout: 15000 },
    );
    expect(preflight.status).toBe(2);
    expect(preflight.stderr).toContain("retired in a linked repository");
  });

  it("refuses a fold target from another Git repository", () => {
    const { root, lock } = fixture();
    const other = mkdtempSync(path.join(tmpdir(), "other-fold-repo-"));
    execFileSync("git", ["init", "--quiet"], { cwd: other });
    const otherLock = path.join(other, ".git", "ward-fold.lock");

    const acquire = spawnSync(process.execPath, [script, "acquire", "owner"], {
      cwd: root,
      encoding: "utf8",
      timeout: 15000,
      env: { ...process.env, WARD_FOLD_WORKTREE: other, WARD_FOLD_LINE: "HEAD" },
    });
    expect(acquire.status).toBe(2);
    expect(acquire.stderr).toContain("different Git repository");
    expect(existsSync(lock)).toBe(false);
    expect(existsSync(otherLock)).toBe(false);

    const preflight = spawnSync(
      process.execPath,
      [preflightScript, "--branch", "HEAD", "--create-backup", "test", "--ward-lead", other],
      { cwd: root, encoding: "utf8", timeout: 15000 },
    );
    expect(preflight.status).toBe(2);
    expect(preflight.stderr).toContain("different Git repository");
    expect(existsSync(otherLock)).toBe(false);
  });

  it("does not release a lock with missing ownership data", () => {
    const { lock, run } = fixture();
    mkdirSync(lock);
    expect(run("release", "anyone").status).toBe(1);
    expect(existsSync(lock)).toBe(true);
  });

  it("recovers an old lock only while the line remains clean and unchanged", () => {
    const { git, lock, run } = fixture();
    expect(run("acquire", "owner").status).toBe(0);
    const ownerPath = path.join(lock, "owner.json");
    const owner = JSON.parse(readFileSync(ownerPath, "utf8"));
    writeFileSync(ownerPath, JSON.stringify({ ...owner, at: "2020-01-01T00:00:00.000Z" }));
    expect(run("release", "--stale").status).toBe(0);
    expect(existsSync(lock)).toBe(false);
    expect(git(["status", "--porcelain"])).toBe("");
  });

  it("does not let two stewards claim the fold lock", () => {
    const { lock, run } = fixture();
    expect(run("acquire", "first").status).toBe(0);
    expect(run("acquire", "second").status).toBe(1);
    expect(JSON.parse(readFileSync(path.join(lock, "owner.json"), "utf8")).who).toBe("first");
  });

  it("admits exactly one of four simultaneous claimants", async () => {
    const { root, lock } = fixture();
    const outcomes = await Promise.all(
      ["one", "two", "three", "four"].map(
        (who) =>
          new Promise<number>((resolve, reject) => {
            const child = spawn(process.execPath, [script, "acquire", who], {
              cwd: root,
              stdio: "ignore",
              env: {
                ...process.env,
                WARD_FLOW_LOGS: path.join(root, "notes"),
                WARD_FOLD_WORKTREE: root,
                WARD_FOLD_LINE: "HEAD",
              },
            });
            child.once("error", reject);
            child.once("close", (code) => resolve(code ?? 1));
          }),
      ),
    );
    expect(outcomes.filter((code) => code === 0)).toHaveLength(1);
    expect(existsSync(path.join(lock, "owner.json"))).toBe(true);
  });

  it("refuses stale recovery if the checkout changed after the claim", () => {
    const { root, lock, run } = fixture();
    expect(run("acquire", "owner").status).toBe(0);
    const ownerPath = path.join(lock, "owner.json");
    const owner = JSON.parse(readFileSync(ownerPath, "utf8"));
    writeFileSync(ownerPath, JSON.stringify({ ...owner, at: "2020-01-01T00:00:00.000Z" }));
    writeFileSync(path.join(root, "untracked.txt"), "work\n");
    expect(run("release", "--stale").status).toBe(1);
    expect(existsSync(lock)).toBe(true);
  });

  it("refuses stale recovery while the owner has a recorded gate running", () => {
    const { root, lock, run } = fixture();
    expect(run("acquire", "owner").status).toBe(0);
    const ownerPath = path.join(lock, "owner.json");
    const owner = JSON.parse(readFileSync(ownerPath, "utf8"));
    writeFileSync(ownerPath, JSON.stringify({ ...owner, at: "2020-01-01T00:00:00.000Z" }));
    mkdirSync(path.join(root, "notes"));
    writeFileSync(path.join(root, "notes", "gate-running.md"), "GATE RUNNING | owner | started\n");
    expect(run("release", "--stale").status).toBe(1);
    expect(existsSync(lock)).toBe(true);
  });

  it("refuses stale recovery after the Ward line advances", () => {
    const { git, lock, run } = fixture();
    expect(run("acquire", "owner").status).toBe(0);
    const ownerPath = path.join(lock, "owner.json");
    const owner = JSON.parse(readFileSync(ownerPath, "utf8"));
    writeFileSync(ownerPath, JSON.stringify({ ...owner, at: "2020-01-01T00:00:00.000Z" }));
    git([
      "-c",
      "user.name=Ward Test",
      "-c",
      "user.email=ward@example.invalid",
      "commit",
      "--quiet",
      "--allow-empty",
      "-m",
      "line advanced",
    ]);
    expect(run("release", "--stale").status).toBe(1);
    expect(existsSync(lock)).toBe(true);
  });
});
