import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

// Imported untyped, exactly as its two sibling suites import `compareFailingSet`, `floorBreaches`
// and `validateEntry` from this same script. A `@ts-expect-error` was written here first and the
// TYPECHECK rejected it as unused — the directive doing its own job, since the import resolves.
import {
  isDirectInvocation,
  parseGateShard,
  selectGateShard,
  summariseRun,
} from "../scripts/check-ward-expected-reds.mjs";

/**
 * 🔴 **THE GATE SAID "OK" OVER A COUNT IT COULD NOT TAKE, AND THE COUNT WAS THE ONE THING IT EXISTS
 * TO REPORT.**
 *
 * Measured 2026-09-12 on a real run of `check:ward-expected-reds`:
 *
 *     check:ward-expected-reds OK — 414 files, 4974 tests, undefined failing,
 *     all 0 manifest entries accounted for.
 *
 * ⚠️ **`failingFiles` is an ARRAY and the summary asked it for `.size`.** Arrays carry `.length`;
 * `.size` belongs to `Map` and `Set` — and the very same line asked `expected.size`, correctly,
 * because `expected` IS a Map. **One line, two collections, two different count properties, and
 * nothing in JavaScript objects to asking an array for the wrong one: it returns `undefined` and the
 * template interpolates it as the word.**
 *
 * 🔴 **WHY THIS IS WORSE THAN A COSMETIC BUG.** The word "OK" in that line is what a reader takes
 * away, and it was printed by a code path that had genuinely compared the sets — so the verdict was
 * right and the evidence beside it was missing. **A tool that reports "OK" over an uncounted
 * population will eventually report "OK" over a real red**, and nobody rereads a line that has said
 * OK a hundred times.
 *
 * ✅ **So the repair is not `.size` → `.length`.** That fixes this instance and leaves the class.
 * **`summariseRun` derives every number itself from the collection it is handed, and REFUSES —
 * throws, rather than returning a cheerful string — if a count cannot be taken.** A caller can no
 * longer pick the wrong property, because a caller no longer picks one.
 */
describe("the expected-reds gate's own summary line", () => {
  it("reports the failing count from an ARRAY, which is the shape that produced 'undefined failing'", () => {
    const line = summariseRun({
      files: 414,
      tests: 4974,
      failing: [
        { file: "a.test.ts", count: 1 },
        { file: "b.test.ts", count: 2 },
      ],
      expected: new Map([["a.test.ts", {}]]),
    });

    expect(line).toContain("2 failing");
    expect(line).not.toMatch(/undefined|NaN/);
  });

  it("reports a MAP's entries too, since the same line counts both kinds", () => {
    const line = summariseRun({
      files: 414,
      tests: 4974,
      failing: [],
      expected: new Map([
        ["a.test.ts", {}],
        ["b.test.ts", {}],
      ]),
    });

    expect(line).toContain("0 failing");
    expect(line).toContain("2 manifest entries");
  });

  it("says entry, singular, for one — because a gate line is read by people", () => {
    const line = summariseRun({ files: 1, tests: 1, failing: [], expected: new Map([["a", {}]]) });
    expect(line).toContain("1 manifest entry");
  });

  /**
   * 🔴 **THE FLOOR, AND IT IS THE HALF THAT OUTLIVES THIS BUG.** A count that is not a count must
   * stop the gate, not decorate it. ⚠️ **Every case below is one a caller could reach by handing over
   * the wrong thing — which is exactly what happened.**
   */
  it.each([
    ["a plain object, which has neither length nor size", {}],
    ["undefined", undefined],
    ["null", null],
    ["a number, as though the caller had already counted", 3],
  ])("REFUSES rather than reporting OK when the failing set is %s", (_label, failing) => {
    expect(() => summariseRun({ files: 1, tests: 1, failing, expected: new Map() })).toThrow(/count/i);
  });

  it("refuses a files or tests figure that is not a whole number", () => {
    expect(() => summariseRun({ files: Number.NaN, tests: 1, failing: [], expected: new Map() })).toThrow(/count/i);
    expect(() => summariseRun({ files: 1, tests: -4, failing: [], expected: new Map() })).toThrow(/count/i);
  });

  /**
   * ⚠️ **The anti-vacuity case.** Every assertion above would pass on a function that threw at every
   * input, which would be a gate that never reports at all.
   */
  it("does return a line for an ordinary sound run", () => {
    const line = summariseRun({ files: 414, tests: 4974, failing: [], expected: new Map() });
    expect(line).toContain("OK");
    expect(line).toContain("414 files");
    expect(line).toContain("4974 tests");
  });
});

/**
 * 🔴 **A RAW `path.resolve(argv1) === fileURLToPath(moduleUrl)` STRING COMPARE FAILS SILENTLY ON
 * WINDOWS** — same defect, same fix, as `scripts/run-ward-tests.mjs`'s own `isDirectInvocation`
 * (see `tests/ward-run-ward-tests-skips.test.ts`). Two spellings of the same file — a different
 * drive-letter case, or one side resolved through a junction the other doesn't go through —
 * compare as UNEQUAL even though both correctly name this script, so the whole `else` branch that
 * actually runs the gate never executes and the process exits 0 with no output.
 */
describe("isDirectInvocation — surviving a Windows drive-letter-case or junction mismatch", () => {
  // Built through the SAME native path/url resolution the real code uses, rather than a
  // hand-written "D:/..." string, so this test passes on both this repo's Windows dev machines and
  // its Ubuntu CI runners. The OS-specific quirks under test are injected entirely through
  // `resolveRealPath`/`platform` below, never through this path text.
  const REAL_PATH = path.resolve(process.cwd(), "scripts", "check-ward-expected-reds.mjs");
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
    const CANONICAL = "\\\\?\\D:\\real-repo\\scripts\\check-ward-expected-reds.mjs";
    const invoked = isDirectInvocation(
      path.join(process.cwd(), "ward-junction-alias", "check-ward-expected-reds.mjs"),
      MODULE_URL,
      { resolveRealPath: () => CANONICAL, platform: "win32" },
    );
    expect(invoked).toBe(true);
  });

  it("stays false when a junction-resolved path genuinely differs from the module's own real path", () => {
    const resolveRealPath = (p: string): string => (p === REAL_PATH ? REAL_PATH : "D:\\other-repo\\unrelated.mjs");
    const invoked = isDirectInvocation(OTHER_PATH, MODULE_URL, { resolveRealPath, platform: "win32" });
    expect(invoked).toBe(false);
  });

  it("falls back to the raw resolved path, rather than throwing, when realpath cannot resolve it", () => {
    const throwing = () => {
      throw new Error("ENOENT: no such file");
    };
    const invoked = isDirectInvocation(REAL_PATH, MODULE_URL, { resolveRealPath: throwing, platform: "win32" });
    expect(invoked).toBe(true);
  });
});

describe("WARD_GATE_SHARD splits the population without losing or repeating a file", () => {
  const population = Array.from({ length: 23 }, (_, index) => `tests/f-${String(index).padStart(2, "0")}.test.ts`);

  it("runs everything when unset", () => {
    expect(parseGateShard(undefined)).toBeNull();
    expect(parseGateShard("")).toBeNull();
  });

  it("refuses a malformed or out-of-range shard rather than guessing", () => {
    for (const value of ["1", "0/4", "5/4", "1/0", "1/17", "a/b", "1/4 ", "-1/4"]) {
      expect(() => parseGateShard(value), value).toThrow(/WARD_GATE_SHARD/);
    }
  });

  it("gives disjoint shards whose union is exactly the population, in any input order", () => {
    for (const count of [1, 2, 3, 4, 7]) {
      const shuffled = [...population].reverse();
      const shards = Array.from({ length: count }, (_, index) =>
        selectGateShard(shuffled, parseGateShard(`${index + 1}/${count}`)),
      );
      const all = shards.flat();
      expect(new Set(all).size).toBe(all.length);
      expect([...all].sort()).toEqual([...population].sort());
      expect(Math.max(...shards.map((s) => s.length)) - Math.min(...shards.map((s) => s.length))).toBeLessThanOrEqual(
        1,
      );
    }
  });
});
