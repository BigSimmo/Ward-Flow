import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve(__dirname, "../scripts/ward-flow/fold-lock.mjs");

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
