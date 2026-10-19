import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  EVIDENCE_RUN_DIR_PATTERN,
  KEPT_EVIDENCE_RUNS,
  pruneEvidenceRuns,
} from "../scripts/ward-flow/prune-evidence-runs.mjs";

const uuid = (n: number) => `${String(n).padStart(8, "0")}-1111-4222-8333-${String(n).padStart(12, "0")}`;
const roots: string[] = [];

function makeRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), "wf-prune-"));
  roots.push(root);
  return root;
}

function runDir(root: string, name: string, ageSeconds: number) {
  const dir = path.join(root, name);
  mkdirSync(dir);
  writeFileSync(path.join(dir, "journeys.json"), "{}");
  const when = new Date(Date.now() - ageSeconds * 1000);
  utimesSync(dir, when, when);
  return dir;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true, maxRetries: 5 });
});

describe("pruneEvidenceRuns", () => {
  it("matches only the runner's own run-folder names", () => {
    expect(EVIDENCE_RUN_DIR_PATTERN.test(`1234-1760000000000-${uuid(1)}`)).toBe(true);
    expect(EVIDENCE_RUN_DIR_PATTERN.test(`ci-shard-2-${uuid(1)}`)).toBe(true);
    expect(EVIDENCE_RUN_DIR_PATTERN.test(uuid(1))).toBe(false);
    expect(EVIDENCE_RUN_DIR_PATTERN.test("shard-1")).toBe(false);
    expect(EVIDENCE_RUN_DIR_PATTERN.test(`1234-${uuid(1)}.json`)).toBe(false);
    expect(EVIDENCE_RUN_DIR_PATTERN.test(`../1234-${uuid(1)}`)).toBe(false);
  });

  it("keeps the newest five run folders including the current run, and nothing else is touched", () => {
    const root = makeRoot();
    const current = runDir(root, `999-1-${uuid(99)}`, 10_000); // oldest mtime, still kept
    for (let i = 1; i <= 7; i += 1) runDir(root, `100-${i}-${uuid(i)}`, i * 10);
    mkdirSync(path.join(root, "playwright-artifacts"));
    writeFileSync(path.join(root, `100-0-${uuid(50)}`), "a file, not a folder");
    writeFileSync(path.join(root, ".last-run.json"), "{}");

    const removed = pruneEvidenceRuns({ resultsParent: root, currentRunDir: current });

    expect(KEPT_EVIDENCE_RUNS).toBe(5);
    expect(removed.sort()).toEqual([5, 6, 7].map((i) => `100-${i}-${uuid(i)}`));
    expect(existsSync(current)).toBe(true);
    expect(readdirSync(root).sort()).toEqual(
      [
        ".last-run.json",
        "playwright-artifacts",
        `100-0-${uuid(50)}`,
        ...[1, 2, 3, 4].map((i) => `100-${i}-${uuid(i)}`),
        `999-1-${uuid(99)}`,
      ].sort(),
    );
  });

  it("removes nothing when five or fewer run folders exist", () => {
    const root = makeRoot();
    const current = runDir(root, `1-1-${uuid(9)}`, 0);
    for (let i = 1; i <= 4; i += 1) runDir(root, `2-${i}-${uuid(i)}`, i);
    expect(pruneEvidenceRuns({ resultsParent: root, currentRunDir: current })).toEqual([]);
    expect(readdirSync(root)).toHaveLength(5);
  });

  it("skips a folder it cannot remove with a warning instead of failing the run", () => {
    const root = makeRoot();
    const current = runDir(root, `1-1-${uuid(9)}`, 0);
    for (let i = 1; i <= 6; i += 1) runDir(root, `2-${i}-${uuid(i)}`, i);
    const warnings: string[] = [];
    const removed = pruneEvidenceRuns({
      resultsParent: root,
      currentRunDir: current,
      remove: (target: string) => {
        if (target.includes(uuid(5))) throw new Error("EBUSY: resource busy or locked");
        rmSync(target, { recursive: true, force: true, maxRetries: 5 });
      },
      warn: (message: string) => warnings.push(message),
    });
    expect(removed).toEqual([`2-6-${uuid(6)}`]);
    expect(warnings).toEqual([expect.stringMatching(/2-5-.*EBUSY/)]);
    expect(existsSync(path.join(root, `2-5-${uuid(5)}`))).toBe(true);
  });

  it("tolerates a missing test-results folder and rejects a non-positive keep", () => {
    const root = makeRoot();
    const missing = path.join(root, "absent");
    expect(pruneEvidenceRuns({ resultsParent: missing, currentRunDir: path.join(missing, "x") })).toEqual([]);
    expect(() => pruneEvidenceRuns({ resultsParent: root, currentRunDir: root, keep: 0 })).toThrow(/positive/);
  });
});
