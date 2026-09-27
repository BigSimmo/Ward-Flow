import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

// Imported untyped, exactly as the check-ward-expected-reds.mjs sibling suites import their own
// script's pure helpers (see tests/ward-expected-reds-summary.test.ts).
import { isDirectInvocation, summariseSkips } from "../scripts/run-ward-tests.mjs";

/**
 * 🔴 **`run-ward-tests.mjs` REFUSES A DROPPED FILE, A NON-ZERO EXIT, AND AN EMPTY SUITE — AND
 * SAYS NOTHING ABOUT A FILE WHERE EVERY CASE IS SKIPPED.** `ward-ed-home.dom.test.tsx` is a real,
 * committed `describe.skip` suite (12 cases, all reported `status: "skipped"` by vitest's own JSON
 * reporter — checked directly, not assumed). Handed to this tool alongside ordinary passing
 * files, the summary line reads `all N handed-in file(s) ran, M test(s) passed` and a reader has
 * no way to see that one of those files ran zero live assertions. That is not the P1-05 failure
 * this tool already guards (a file producing NO result) — it is the opposite shape: a file
 * produces a result, every case in it is skipped, and the tool's own summary treats that exactly
 * like a file that ran and passed.
 *
 * `summariseSkips` is the pure counting step, tested here against vitest's own JSON-reporter shape
 * rather than by running vitest — this test only proves the counting is right; the acceptance
 * check that `run-ward-tests.mjs` actually PRINTS these numbers when invoked for real is
 * `node scripts/run-ward-tests.mjs tests/ward-ed-home.dom.test.tsx
 * tests/ward-governance-thin-sample.test.ts`, which must exit 0 and list `ward-ed-home` as wholly
 * skipped.
 */
describe("summariseSkips — counts skipped/todo assertions and files with no live case", () => {
  it("counts assertions whose status is neither passed nor failed as skipped/todo", () => {
    const testResults = [
      {
        name: "tests/ward-a.test.ts",
        assertionResults: [{ status: "passed" }, { status: "skipped" }, { status: "todo" }, { status: "failed" }],
      },
    ];
    expect(summariseSkips(testResults).skippedOrTodo).toBe(2);
  });

  it("lists a file as wholly skipped only when EVERY one of its assertions is skipped/todo", () => {
    const testResults = [
      { name: "tests/ward-partial.test.ts", assertionResults: [{ status: "passed" }, { status: "skipped" }] },
      { name: "tests/ward-ed-home.dom.test.tsx", assertionResults: Array(12).fill({ status: "skipped" }) },
    ];
    const summary = summariseSkips(testResults);
    expect(summary.whollySkippedFiles).toEqual(["ward-ed-home.dom.test.tsx"]);
  });

  it("reports the basename, not the full path, matching this tool's own `base()` reconciliation", () => {
    const testResults = [
      {
        name: "D:/Worktrees/Database/ward-w6-test-guards/tests/ward-ed-home.dom.test.tsx",
        assertionResults: [{ status: "skipped" }],
      },
    ];
    expect(summariseSkips(testResults).whollySkippedFiles).toEqual(["ward-ed-home.dom.test.tsx"]);
  });

  it("does NOT treat a file with zero assertions as wholly skipped — that is a different, already-refused failure", () => {
    // A file with no assertions at all is the pre-existing "ran but contains no test" refusal
    // (EXIT_COVERAGE_DISCREPANCY, the `empty` check in main()). Folding it into "wholly skipped"
    // would hide a broken/empty file inside an otherwise-benign skip count.
    const testResults = [{ name: "tests/ward-broken.test.ts", assertionResults: [] }];
    const summary = summariseSkips(testResults);
    expect(summary.whollySkippedFiles).toEqual([]);
    expect(summary.skippedOrTodo).toBe(0);
  });

  it("reports zero and an empty list for an ordinary all-passing run — the anti-vacuity case", () => {
    const testResults = [
      { name: "tests/ward-governance-thin-sample.test.ts", assertionResults: Array(6).fill({ status: "passed" }) },
    ];
    const summary = summariseSkips(testResults);
    expect(summary.skippedOrTodo).toBe(0);
    expect(summary.whollySkippedFiles).toEqual([]);
  });

  it("handles an empty testResults array without throwing", () => {
    expect(summariseSkips([])).toEqual({ skippedOrTodo: 0, whollySkippedFiles: [] });
  });
});

/**
 * 🔴 **A RAW `path.resolve(argv1) === fileURLToPath(moduleUrl)` STRING COMPARE FAILS SILENTLY ON
 * WINDOWS.** Two spellings of the same file — a different drive-letter case, or one side resolved
 * through a junction the other doesn't go through — compare as UNEQUAL even though both correctly
 * name this script. `main()` then never runs and the process exits 0 with no output, which reads
 * exactly like "nothing was asked of it, cleanly" rather than like a bug. `isDirectInvocation`
 * resolves both sides through `fs.realpathSync` and compares case-insensitively on win32, and takes
 * `resolveRealPath`/`platform` as injectable so both the junction and the drive-letter-case case can
 * be proved here without a real junction or a second OS.
 */
describe("isDirectInvocation — surviving a Windows drive-letter-case or junction mismatch", () => {
  // Built through the SAME native path/url resolution the real code uses (path.resolve,
  // pathToFileURL/fileURLToPath), rather than a hand-written "D:/..." string, so this test passes
  // on both this repo's Windows dev machines and its Ubuntu CI runners: on POSIX, a Windows-style
  // drive path is not a real absolute path, and path.resolve/fileURLToPath would not treat it and
  // this fixture consistently. The OS-specific quirks under test (drive-letter case, a junction)
  // are injected entirely through `resolveRealPath`/`platform` below, never through this path text.
  const REAL_PATH = path.resolve(process.cwd(), "scripts", "run-ward-tests.mjs");
  const MODULE_URL = pathToFileURL(REAL_PATH).href;
  const OTHER_PATH = path.resolve(process.cwd(), "scripts", "run-vitest.mjs");
  const identity = (p: string): string => p;

  it("is true for an ordinary direct invocation (argv1 names this module, no OS quirks)", () => {
    expect(isDirectInvocation(REAL_PATH, MODULE_URL, { resolveRealPath: identity })).toBe(true);
  });

  it("is false when imported for its pure helpers (argv1 names a different entrypoint)", () => {
    expect(isDirectInvocation(OTHER_PATH, MODULE_URL, { resolveRealPath: identity })).toBe(false);
  });

  it("is false for argv1 undefined — the module was imported, not run from the command line", () => {
    expect(isDirectInvocation(undefined, MODULE_URL, { resolveRealPath: identity })).toBe(false);
  });

  it("survives a drive-letter-case mismatch on win32, even when realpath does not itself normalize it", () => {
    // realpath is deliberately a pass-through here, so the true/false verdict below can only be
    // coming from the case-insensitive compare, not from realpath quietly fixing the case first.
    // Flipping the WHOLE path's case stands in for a real "d:\..." vs "D:\..." drive-letter
    // mismatch without depending on Windows path parsing to reproduce it.
    const invoked = isDirectInvocation(REAL_PATH.toUpperCase(), MODULE_URL, {
      resolveRealPath: identity,
      platform: "win32",
    });
    expect(invoked).toBe(true);
  });

  it("does NOT case-fold on a case-sensitive platform — the same mismatch is a real difference there", () => {
    const invoked = isDirectInvocation(REAL_PATH.toUpperCase(), MODULE_URL, {
      resolveRealPath: identity,
      platform: "linux",
    });
    expect(invoked).toBe(false);
  });

  it("collapses a junction path to the same real target as the module's own path", () => {
    // Simulates argv1 arriving through a junction alias (e.g. a worktree mounted at a different
    // path) that still points at the exact same file on disk as import.meta.url: both the invoked
    // path and this module's own path resolve, through realpath, to one identical canonical path.
    const CANONICAL = "\\\\?\\D:\\real-repo\\scripts\\run-ward-tests.mjs";
    const invoked = isDirectInvocation(
      path.join(process.cwd(), "ward-junction-alias", "run-ward-tests.mjs"),
      MODULE_URL,
      {
        resolveRealPath: () => CANONICAL,
        platform: "win32",
      },
    );
    expect(invoked).toBe(true);
  });

  it("stays false when a junction-resolved path genuinely differs from the module's own real path", () => {
    // The "self" side (this module, resolved through fileURLToPath) collapses to REAL_PATH exactly
    // as usual; the "invoked" side (a different script entirely) collapses to something else. Two
    // genuinely different real targets must not read as a match just because both went through
    // realpath.
    const resolveRealPath = (p: string): string => (p === REAL_PATH ? REAL_PATH : "D:\\other-repo\\unrelated.mjs");
    const invoked = isDirectInvocation(OTHER_PATH, MODULE_URL, { resolveRealPath, platform: "win32" });
    expect(invoked).toBe(false);
  });

  it("falls back to the raw resolved path, rather than throwing, when realpath cannot resolve it", () => {
    const throwing = () => {
      throw new Error("ENOENT: no such file");
    };
    // Same raw path on both sides, so even with realpath unusable the fallback still agrees.
    const invoked = isDirectInvocation(REAL_PATH, MODULE_URL, { resolveRealPath: throwing, platform: "win32" });
    expect(invoked).toBe(true);
  });
});
