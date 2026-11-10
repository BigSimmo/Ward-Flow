import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  collectHotspots,
  formatReport,
  isRankedFile,
  parseGitLog,
  rankHotspots,
} from "../scripts/ward-flow/hotspots.mjs";

/**
 * M142 (Tier 7 plan, 10 Nov 2026): the change-hotspot report ranks files by commits x lines. It is
 * built on a throwaway fixture repository, so the ranking, the merge skip and the shallow-boundary
 * skip are proved without the real history (which is shallow in cloud checkouts).
 */
const environment = { ...process.env };
for (const key of ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR"]) delete environment[key];
const git = (cwd: string, ...args: string[]) =>
  execFileSync(
    "git",
    ["-c", "core.hooksPath=/dev/null", "-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", ...args],
    { cwd, env: environment, encoding: "utf8", stdio: "pipe" },
  );
const lines = (count: number, tag: string) =>
  Array.from({ length: count }, (_, index) => `export const ${tag}${index} = ${index};`).join("\n") + "\n";

let root: string;
let repo: string;

function commit(message: string, files: Record<string, string | null>) {
  for (const [file, text] of Object.entries(files)) {
    const full = join(repo, file);
    if (text === null) {
      git(repo, "rm", "--quiet", file);
      continue;
    }
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
    git(repo, "add", file);
  }
  git(repo, "commit", "--quiet", "-m", message);
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "ward-hotspots-"));
  repo = join(root, "repo");
  mkdirSync(repo);
  git(repo, "init", "--quiet", "--initial-branch=main");
  commit("start", { "src/big.ts": lines(100, "b"), "src/small.ts": lines(10, "s"), "src/gone.ts": lines(50, "g") });
  commit("big 2", { "src/big.ts": lines(101, "b") });
  commit("small 2", { "src/small.ts": lines(11, "s"), "src/small.test.ts": lines(400, "t") });
  commit("small 3", { "src/small.ts": lines(12, "s"), "src/small.test.ts": lines(401, "t") });
  commit("drop gone", { "src/gone.ts": null, "docs/notes.md": "notes\n" });
  git(repo, "checkout", "--quiet", "-b", "side");
  commit("side big", { "src/big.ts": lines(102, "b") });
  git(repo, "checkout", "--quiet", "main");
  commit("small 4", { "src/small.ts": lines(13, "s") });
  git(repo, "merge", "--quiet", "--no-ff", "-m", "merge side", "side");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("change hotspots (M142)", () => {
  it("parses git log blocks into commits and their files", () => {
    const text =
      "\u0000commit aaa 2026-11-10T00:00:00+08:00\n\nsrc/a.ts\nsrc/b.ts\n\u0000commit bbb 2026-11-09T00:00:00+08:00\n\nsrc/a.ts\n";
    expect(parseGitLog(text)).toEqual([
      { sha: "aaa", date: "2026-11-10T00:00:00+08:00", files: ["src/a.ts", "src/b.ts"] },
      { sha: "bbb", date: "2026-11-09T00:00:00+08:00", files: ["src/a.ts"] },
    ]);
  });

  it("ranks source files only, leaving out tests, styles and build output", () => {
    expect(isRankedFile("src/components/ward-management/ward-flow-reducer.ts")).toBe(true);
    expect(isRankedFile("backend/ward-flow/postgres.mjs")).toBe(true);
    expect(isRankedFile("src/a.test.ts")).toBe(false);
    expect(isRankedFile("backend/ward-flow/test/store.test.mjs")).toBe(false);
    expect(isRankedFile("src/a.test.ts", { includeTests: true })).toBe(true);
    expect(isRankedFile("backend/ward-flow/dist/engine.js")).toBe(false);
    expect(isRankedFile("src/app/globals.css")).toBe(false);
  });

  it("scores commits x lines and skips excluded boundary commits", () => {
    const commits = [
      { sha: "graft", date: "2026-11-01", files: ["src/a.ts", "src/b.ts"] },
      { sha: "c1", date: "2026-11-02", files: ["src/a.ts"] },
      { sha: "c2", date: "2026-11-03", files: ["src/b.ts", "src/missing.ts"] },
      { sha: "c3", date: "2026-11-04", files: ["src/b.ts"] },
    ];
    const size: Record<string, number> = { "src/a.ts": 300, "src/b.ts": 100 };
    const report = rankHotspots(commits, (file: string) => size[file] ?? null, { excludedShas: new Set(["graft"]) });
    expect(report.commitsCounted).toBe(3);
    expect(report.commitsExcluded).toBe(1);
    expect(report.oldest).toBe("2026-11-02");
    expect(report.top).toEqual([
      { file: "src/a.ts", commits: 1, lines: 300, score: 300 },
      { file: "src/b.ts", commits: 2, lines: 100, score: 200 },
    ]);
    expect(report.mostChanged?.file).toBe("src/b.ts");
  });

  it("ranks a real repository, skipping merge commits, tests and deleted files", () => {
    const report = collectHotspots({ repo, paths: ["src"] });
    expect(report.shallow).toBe(false);
    // 7 non-merge commits; the merge commit itself is not counted.
    expect(report.commitsCounted).toBe(7);
    expect(report.top.map(({ file, commits, lines }) => ({ file, commits, lines }))).toEqual([
      { file: "src/big.ts", commits: 3, lines: 102 },
      { file: "src/small.ts", commits: 4, lines: 13 },
    ]);
    const text = formatReport(report);
    expect(text).toContain("src/big.ts");
    expect(text).not.toContain("SHALLOW HISTORY");
    expect(text).toContain("Most changed: src/small.ts (4 commits, 13 lines).");
  });

  it("leaves out the grafted snapshot of a shallow clone and says the history is shallow", () => {
    const shallow = join(root, "shallow");
    git(root, "clone", "--quiet", "--depth", "3", "--branch", "main", pathToFileURL(repo).href, shallow);
    const report = collectHotspots({ repo: shallow, paths: ["src"] });
    expect(report.shallow).toBe(true);
    // Depth 3 keeps the merge, "small 4", "side big" and the grafted "drop gone" snapshot.
    expect(report.commitsExcluded).toBe(1);
    expect(report.commitsCounted).toBe(2);
    // Without the skip, the snapshot would count every file it "adds" as one more change.
    expect(report.top.map(({ file, commits }) => ({ file, commits }))).toEqual([
      { file: "src/big.ts", commits: 1 },
      { file: "src/small.ts", commits: 1 },
    ]);
    expect(formatReport(report)).toContain("SHALLOW HISTORY");
  });
});
