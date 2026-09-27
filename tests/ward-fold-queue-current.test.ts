import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { activeStewardClaims, currentReadyEntries } from "../scripts/ward-flow/fold-queue-current.mjs";

const script = path.resolve(__dirname, "../scripts/ward-flow/fold-queue-current.mjs");

const git = (cwd: string, args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

describe("current Ward fold queue", () => {
  it("keeps the last state for each branch without treating old READY rows as work", () => {
    const queue = [
      "READY | owner | ward/a | aaaaaaa | old",
      "READY | owner | ward/b | bbbbbbb | old",
      "NOT READY | owner | ward/b | bbbbbbb | blocked",
      "READY-FAST | owner | ward/a | ccccccc | corrected",
      "READY | owner | ward/c | ddddddd | current",
    ].join("\n");
    expect(currentReadyEntries(queue).map(({ branch, sha, lane }) => ({ branch, sha, lane }))).toEqual([
      { branch: "ward/a", sha: "ccccccc", lane: "READY-FAST" },
      { branch: "ward/c", sha: "ddddddd", lane: "READY" },
    ]);
  });

  it("keeps ordinary notes and malformed lines from creating a READY entry", () => {
    expect(currentReadyEntries("`nSTEWARD IN PROGRESS | owner | ward/a\nREADY | missing | ward/b | x")).toEqual([]);
    expect(activeStewardClaims("`nSTEWARD IN PROGRESS | owner | no branches | line").unscoped).toEqual(["owner"]);
  });

  it("keeps the first claim on each branch until its owner releases it", () => {
    const queue = [
      "STEWARD IN PROGRESS | first | ward/a, ward/b | line",
      "STEWARD IN PROGRESS | second | ward/b, ward/c | line",
      "STEWARD RELEASED | second | standing down",
    ].join("\n");
    expect(activeStewardClaims(queue.split("\n").slice(0, 2).join("\n"))).toEqual({
      claims: [
        { branch: "ward/a", owner: "first" },
        { branch: "ward/b", owner: "first" },
        { branch: "ward/c", owner: "second" },
      ],
      conflicts: [{ branch: "ward/b", first: "first", later: "second" }],
      unscoped: [],
    });
    expect(activeStewardClaims(queue).conflicts).toEqual([]);
    expect(activeStewardClaims(`${queue}\nSTEWARD RELEASED | first | folded`).claims).toEqual([]);
    expect(activeStewardClaims(`${queue}\nFREE | first | folded`).claims).toEqual([]);
    expect(
      activeStewardClaims("`nSTEWARD IN PROGRESS | owner | no branches | line\nFREE | owner | folded").unscoped,
    ).toEqual([]);
  });

  it("shows only an existing branch at its recorded tip that has not folded", () => {
    const root = mkdtempSync(path.join(tmpdir(), "ward-current-queue-"));
    git(root, ["init", "--quiet"]);
    git(root, [
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
    const base = git(root, ["rev-parse", "HEAD"]);
    git(root, ["switch", "-q", "-c", "ward/one"]);
    writeFileSync(path.join(root, "one.txt"), "one\n");
    git(root, ["add", "one.txt"]);
    git(root, ["-c", "user.name=Ward Test", "-c", "user.email=ward@example.invalid", "commit", "--quiet", "-m", "one"]);
    const first = git(root, ["rev-parse", "HEAD"]);
    writeFileSync(path.join(root, "one.txt"), "two\n");
    git(root, ["add", "one.txt"]);
    git(root, ["-c", "user.name=Ward Test", "-c", "user.email=ward@example.invalid", "commit", "--quiet", "-m", "two"]);
    const tip = git(root, ["rev-parse", "HEAD"]);
    const queue = path.join(root, "queue.md");
    writeFileSync(queue, `READY | owner | ward/one | ${first} | stale\n`);
    const run = (line: string) =>
      spawnSync(process.execPath, [script, "--queue", queue, "--line", line, "--json"], {
        cwd: root,
        encoding: "utf8",
        timeout: 15000,
      });
    expect(JSON.parse(run(base).stdout).ready).toEqual([]);
    writeFileSync(queue, `READY | owner | ward/one | ${tip} | current\n`);
    expect(JSON.parse(run(base).stdout).ready.map((entry: { branch: string }) => entry.branch)).toEqual(["ward/one"]);
    expect(JSON.parse(run(tip).stdout).ready).toEqual([]);
  });
});
