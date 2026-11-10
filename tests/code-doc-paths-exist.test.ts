import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Doc paths cited in code exist (D-121 item 5, audit F-45, 10 Nov 2026).
 *
 * Code, tests and scripts cite `docs/...md` pages as the source of a rule or a figure. When a page
 * moves (PR #1503 moved the dated owner notes into docs/history/) the citation silently points at
 * nothing, and the next reader cannot find the ruling. This scans the source, test and script
 * trees for every `docs/<path>.md` mention and fails on a path that does not exist.
 *
 * Two kinds of missing path are allowed, each named below with its reason:
 * - FIXTURE_PATHS: made-up paths a test feeds to a checker on purpose (a temporary repo, a path
 *   classifier, a self-test). They are never meant to exist.
 * - REMOVED_PAGES: pages deleted outright (most in the 15 Oct 2026 history trim, PR #296, or never
 *   carried over from the old Database repo). The citation records where an old fact came from;
 *   git history holds the page. Do not add to this list for a page that moved: fix the path.
 */
const root = join(__dirname, "..");
const TREES = ["src", "tests", "scripts"];
const SCANNED = /\.(?:[cm]?[jt]sx?|json|css|sh|ps1|ya?ml)$/u;
const SKIP_DIRS = new Set(["node_modules", ".next", "coverage", "test-results"]);
const DOC_PATH = /(?<![\w/.-])(?:\.\.\/)*(docs\/[A-Za-z0-9_./-]*?\.md)\b/gu;

const FIXTURE_PATHS = new Set([
  // Synthetic inputs to checker tests and self-tests (temporary repos, path classifiers, diff parsers).
  "docs/a.md",
  "docs/b.md",
  "docs/x.md",
  "docs/only.md",
  "docs/note.md",
  "docs/notes.md",
  "docs/guide.md",
  "docs/log.md",
  "docs/proof.md",
  "docs/current.md",
  "docs/example.md",
  "docs/other-policy.md",
  "docs/archive/old.md",
  "docs/branch-review-records/record.md",
  "docs/guides/alias.md",
  "docs/guides/live.md",
  "docs/guides/real.md",
  "docs/guides/sentinel.md",
  "docs/agents/custom-shortcut.md",
  "docs/agents/review.md",
  "docs/history/lessons/a.md",
  "docs/history/lessons/example.md",
  "docs/history/lessons/nested/example.md",
  "docs/ward-flow/a.md",
  "docs/ward-flow/b.md",
  "docs/ward-flow/x.md",
  "docs/ward-flow/old.md",
  "docs/ward-flow/new.md",
  "docs/ward-flow/other.md",
  "docs/ward-flow/current.md",
  "docs/ward-flow/deleted.md",
  "docs/ward-flow/incoming.md",
  "docs/ward-flow/last.md",
  "docs/ward-flow/probe.md",
  "docs/ward-flow/renamed-probe.md",
  "docs/ward-flow/admission-probe.md",
  "docs/ward-flow/upstream.md",
  "docs/ward-flow/shared.md",
  "docs/ward-flow/notes.md",
  "docs/ward-flow/guide.md",
  "docs/ward-flow/new-guide.md",
  "docs/ward-flow/additional-owner-ruling.md",
  "docs/ward-flow/owner-decisions-2026-09-16.md", // owner-index CI scope classifier input
  "docs/ward-flow/plans/new-plan.md",
  "docs/ward-flow/plans/sentinel.md",
  "docs/ward-flow/reports/review-2026-10-08.md",
  "docs/ward-flow/governance/unfiled-clinical-safety-note.md", // suggested path a classifier returns
  // PsychSift-era paths the push guard must classify as not Ward Flow.
  "docs/database-drift-detection.md",
  "docs/rag-behaviour/README.md",
]);

const REMOVED_PAGES: Record<string, string> = {
  "docs/claude-cloud.md": "PsychSift-era page, never carried into Ward Flow; the comment explains MCP rule naming.",
  "docs/error-tracking.md": "PsychSift-era page, never carried into Ward Flow; the comment explains the CSP choice.",
  "docs/outstanding-issues.md": "Retired issue list; the issue numbers cited are history.",
  "docs/ward-flow/NEW-CHAT-PROMPTS-2026-09-05.md": "Deleted in PR #296; cited as the origin of a counting rule.",
  "docs/ward-flow/bed-figure-wording-census-2026-09-04.md": "Deleted in PR #296; cited as provenance.",
  "docs/ward-flow/fields-with-no-producer-2026-09-01.md":
    "Census never carried into this repository; the lesson lives at docs/history/lessons/fields-with-no-producer.md.",
  "docs/ward-flow/owner-decisions-2026-09-03.md": "Never carried into this repository; cited as provenance.",
  "docs/ward-flow/parked-debt-2026-09-04.md": "Deleted in PR #296; cited as provenance.",
  "docs/ward-flow/ratchet-slack-proposal-2026-09-06.md": "Deleted in PR #296; cited as provenance.",
  "docs/ward-flow/retired-browser-journeys-2026-09-06.md": "Deleted in PR #296; cited as provenance.",
  "docs/ward-flow/reword-arms-ed-and-morning-2026-09-09.md": "Deleted in PR #296; cited as provenance.",
  "docs/ward-flow/scanner-floor-survey-2026-09-12.md": "Deleted in PR #296; cited as provenance.",
  "docs/ward-flow/skipped-tests-census-2026-09-12.md": "Deleted in PR #296; cited as provenance.",
  "docs/ward-flow/unreachable-ward-screens-2026-09-06.md": "Deleted in PR #296; cited as provenance.",
  "docs/history/archive/retired-tests/2026-09-26-forced-colours-ward-border-probe.md":
    "Deleted in PR #296; cited as provenance.",
};

function codeFiles(): string[] {
  const files: string[] = [];
  const walk = (directory: string) => {
    for (const name of readdirSync(directory)) {
      if (SKIP_DIRS.has(name)) continue;
      const path = join(directory, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (SCANNED.test(name)) files.push(path);
    }
  };
  for (const tree of TREES) walk(join(root, tree));
  return files;
}

function citedDocPaths(text: string): { path: string; line: number }[] {
  const out: { path: string; line: number }[] = [];
  text.split("\n").forEach((line, index) => {
    for (const match of line.matchAll(DOC_PATH)) out.push({ path: match[1], line: index + 1 });
  });
  return out;
}

function exists(path: string): boolean {
  return existsSync(join(root, path));
}

describe("doc paths cited in code exist (D-121 item 5)", () => {
  it("finds doc citations, including relative ones, and ignores lookalikes", () => {
    expect(citedDocPaths("// see `docs/ward-flow/decisions.md` and ../../docs/a/b.md")).toEqual([
      { path: "docs/ward-flow/decisions.md", line: 1 },
      { path: "docs/a/b.md", line: 1 },
    ]);
    expect(citedDocPaths("const x = 'mydocs/a.md'; // node_modules/next/dist/docs/readme.md")).toEqual([]);
  });

  it("keeps each allowance in use, so a fixed citation leaves the list", () => {
    const cited = new Set(
      codeFiles()
        .filter((file) => !file.endsWith("code-doc-paths-exist.test.ts"))
        .flatMap((file) => citedDocPaths(readFileSync(file, "utf8")).map(({ path }) => path)),
    );
    const unused = [...FIXTURE_PATHS, ...Object.keys(REMOVED_PAGES)].filter((path) => !cited.has(path));
    expect(unused, "no longer cited anywhere; remove from the allowance").toEqual([]);
    const nowExisting = [...FIXTURE_PATHS, ...Object.keys(REMOVED_PAGES)].filter((path) => exists(path));
    expect(nowExisting, "these exist now; remove them from the allowance").toEqual([]);
  });

  it("cites no missing doc page from src, tests or scripts", () => {
    const missing: string[] = [];
    for (const file of codeFiles()) {
      if (file.endsWith("code-doc-paths-exist.test.ts")) continue;
      for (const { path, line } of citedDocPaths(readFileSync(file, "utf8"))) {
        if (path.includes("*") || FIXTURE_PATHS.has(path) || path in REMOVED_PAGES) continue;
        if (!exists(path)) missing.push(`${relative(root, file).split("\\").join("/")}:${line} cites ${path}`);
      }
    }
    expect(missing, "fix the path (moved pages are usually under docs/history/)").toEqual([]);
  });
});
