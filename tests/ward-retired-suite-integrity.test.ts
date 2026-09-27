import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 🔴 **TWELVE `describe.skip` SUITES ARE RECORDED, AND TWELVE ARE DECLARED UNREACHABLE, AND
 * NOTHING TIES THE THREE FACTS TOGETHER.** `docs/ward-flow/retired-coverage-record-2026-09-06.md`
 * writes down what each retired suite covered, in its own words, before anything was retired —
 * that is the recoverability contract. `tests/ward-component-reachability.test.ts`'s
 * `DECLARED_UNREACHABLE` separately says which components a coordinator's browser cannot reach.
 * Both are correct today, measured independently. **Neither one currently checks the other**, and
 * a `describe.skip` file that is simply forgotten to be added to the record, or whose component
 * comes back reachable without its `describe.skip` ever being reconsidered, would leave the two
 * documents silently agreeing with nothing.
 *
 * This guard is what makes those three facts — the retired suite, its record entry, and the
 * reachability declaration for the component it renders — a single checked triangle instead of
 * three things a reader has to trust separately.
 *
 * ## Population: every retired suite in `tests/ward-*.test.ts(x)`
 *
 * Found the same way `ward-no-tautological-cases.test.ts` finds its population: comments are
 * stripped with newlines preserved, then the stripped source is tested against any of
 * `\bdescribe\s*\.\s*skip\s*\(`, `\bit\s*\.\s*skip\s*\(`, `\btest\s*\.\s*skip\s*\(`,
 * `\bdescribe\s*\.\s*skipIf\s*\(`, `\bdescribe\s*\.\s*todo\s*\(`, or
 * `\bdescribe\s*\.\s*runIf\s*\(\s*false\s*\)` — every shape this repository can use to retire a
 * suite, not only the one it happened to use first. `describe.runIf(someRuntimeCondition)` is
 * deliberately NOT matched: unlike a literal `false`, a runtime condition is not statically
 * always-off, so it is not this guard's population.
 *
 * **12 files matched this population when this guard was written.** ⚠️ **THE FLOOR USED TO SIT AT
 * EXACTLY 12 — THE MEASURED COUNT ITSELF — AND THAT WAS THE BUG, NOT A FEATURE.** A floor equal to
 * today's count has zero headroom: fixing and un-skipping even one retired suite (a real, welcome
 * change) drops the count to 11 and turns THIS guard red over work that has nothing to do with it.
 * The floor below is 8, four below the measured 12, so a legitimate suite or two leaving the
 * population does not by itself make this guard lie about being broken. It is still nowhere near
 * zero: this population is a short, named list (the exact files this guard exists to police), not
 * an open corpus like the tautology scan's 491, so 8 still only clears on a real, mostly-intact
 * population — a broken walk or an empty `tests/` directory still trips it exactly as before.
 *
 * ## What is checked, for every file in the population
 *
 * 1. **Named in the record, as its own path token.** The file's own basename must appear in
 *    `docs/ward-flow/retired-coverage-record-2026-09-06.md` bounded by anything OTHER than a
 *    filename-continuation character (a word character, `.`, or `-`) — not a bare
 *    `recordText.includes(file)`, which would count `old-ward-x.test.tsx` or
 *    `ward-x.test.tsx.bak` as naming `ward-x.test.tsx` when neither one actually does. A `/`
 *    immediately before the match is fine (`tests/ward-x.test.tsx` still names it); a word
 *    character, `.`, or `-` is not, because those are exactly the characters that continue one
 *    filename into a different one.
 * 2. **Linked to a live reachability declaration.** At least one of the file's own
 *    `@/components/ward-management/...` imports must resolve to a `module: "..."` entry parsed
 *    directly out of `DECLARED_UNREACHABLE` in `tests/ward-component-reachability.test.ts` — not a
 *    second, hand-maintained list of the same paths, which would drift from the real one the day
 *    either file changed alone.
 *
 * ⚠️ **THE FLOOR ON `DECLARED_UNREACHABLE` ITSELF IS THE SAME DISCIPLINE, ONE LEVEL UP.** Parsing
 * zero `module: "..."` entries (a rename of the field, a moved array, a deleted file) would make
 * check 2 vacuously fail every file the same way — indistinguishable from "nothing links" without
 * a floor that says the parse itself still works. 13 entries exist today; the floor is 10.
 *
 * ⚠️ **THIS FILE DECLARES; IT DOES NOT RETIRE OR REWRITE.** Same posture as
 * `ward-component-reachability.test.ts`'s own header: nothing here deletes a test, un-skips a
 * suite, or edits the record. A red here names a fact to go fix by hand — add the missing record
 * entry, add the missing `DECLARED_UNREACHABLE` line, or explain why the file should leave the
 * population — never a reason to widen this guard until it passes.
 */

const ROOT = process.cwd();
const TESTS_DIR = join(ROOT, "tests");
const REACHABILITY_TEST = join(TESTS_DIR, "ward-component-reachability.test.ts");
const RETIRED_RECORD = existsSync(
  join(ROOT, "docs", "ward-flow", "archive", "dated-notes", "retired-coverage-record-2026-09-06.md"),
)
  ? join(ROOT, "docs", "ward-flow", "archive", "dated-notes", "retired-coverage-record-2026-09-06.md")
  : join(ROOT, "docs", "ward-flow", "retired-coverage-record-2026-09-06.md");

const CANDIDATE_FILE_PATTERN = /^ward-.*\.test\.tsx?$/;
// Every shape this repository can use to retire a suite. `describe.runIf(false)` is matched only
// with a LITERAL `false` — a runtime condition (`describe.runIf(isCi)`) is not statically
// always-off and is deliberately left out of this population.
const RETIRED_SUITE_PATTERNS = [
  /\bdescribe\s*\.\s*skip\s*\(/u,
  /\bit\s*\.\s*skip\s*\(/u,
  /\btest\s*\.\s*skip\s*\(/u,
  /\bdescribe\s*\.\s*skipIf\s*\(/u,
  /\bdescribe\s*\.\s*todo\s*\(/u,
  /\bdescribe\s*\.\s*runIf\s*\(\s*false\s*\)/u,
];
const WARD_MANAGEMENT_IMPORT = /from\s*["'](@\/components\/ward-management\/[^"']+)["']/gu;
const DECLARED_MODULE_ENTRY = /module:\s*"([^"]+)"/gu;

// Four below the measured 12 (see the header comment): a floor with real headroom for a
// legitimate suite or two leaving the population, never a floor set at today's exact count.
const MIN_EXPECTED_RETIRED_FILES = 8;
const MIN_EXPECTED_DECLARED_MODULES = 10;

// This guard's own file is excluded from the population walk: its header quotes
// `describe.skip(` and `module: "..."` in prose, which would otherwise be misread as the very
// things it is scanning for.
const SELF = "ward-retired-suite-integrity.test.ts";

/** Replaces every comment character with a space, preserving newlines — same idiom as the
 *  tautology guard, kept identical here so both guards report line-stable positions. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replace(/[^\n]/gu, " "))
    .replace(/\/\/[^\n]*/gu, (comment) => comment.replace(/[^\n]/gu, " "));
}

/** True when `rawSource`, with comments stripped, opens a real retired-suite call — any of
 *  `describe.skip(`, `it.skip(`, `test.skip(`, `describe.skipIf(`, `describe.todo(`, or
 *  `describe.runIf(false)`. */
export function isRetiredSuite(rawSource: string): boolean {
  const stripped = withoutComments(rawSource);
  return RETIRED_SUITE_PATTERNS.some((pattern) => pattern.test(stripped));
}

/**
 * True when `file` (a bare basename such as `ward-x.test.tsx`) appears in `recordText` as its own
 * path token, not merely as a substring of a different, longer filename. A bare
 * `recordText.includes(file)` would count `old-ward-x.test.tsx` or `ward-x.test.tsx.bak` as
 * naming `ward-x.test.tsx`, when neither actually does. A `/` immediately before the match is
 * accepted (a path-prefixed reference like `tests/ward-x.test.tsx` still names the file); a word
 * character, `.`, or `-` immediately before or after is not, because those are exactly the
 * characters that continue one filename into a different one.
 */
export function namesFileExactly(recordText: string, file: string): boolean {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const pattern = new RegExp(`(?<![\\w.-])${escaped}(?![\\w.-])`, "u");
  return pattern.test(recordText);
}

/** Every `@/components/ward-management/<p>` import specifier, mapped to the `.tsx` module path
 *  `DECLARED_UNREACHABLE` entries use (`src/components/ward-management/<p>.tsx`). A specifier
 *  that names a `.ts` (non-component) module is mapped the same way and simply will not match any
 *  declared entry — declared entries are components (`.tsx`) only, by this guard's own design. */
export function wardManagementImportsOf(rawSource: string): string[] {
  const stripped = withoutComments(rawSource);
  const modules: string[] = [];
  for (const match of stripped.matchAll(WARD_MANAGEMENT_IMPORT)) {
    modules.push(`${match[1].replace(/^@\//u, "src/")}.tsx`);
  }
  return modules;
}

/** Parses every `module: "..."` entry out of `DECLARED_UNREACHABLE`'s raw source text, with
 *  comments stripped first — so a historical entry left only inside a comment (this repository has
 *  at least one: `statistics-primitives.tsx`'s "came back" note) is correctly not parsed as live. */
export function parseDeclaredModules(reachabilitySource: string): Set<string> {
  const stripped = withoutComments(reachabilitySource);
  const modules = new Set<string>();
  for (const match of stripped.matchAll(DECLARED_MODULE_ENTRY)) modules.add(match[1]);
  return modules;
}

/** True if at least one of `imports` names a module in `declaredModules`. */
export function hasDeclaredImport(imports: string[], declaredModules: Set<string>): boolean {
  return imports.some((module) => declaredModules.has(module));
}

function listRetiredSuiteFiles(): string[] {
  return readdirSync(TESTS_DIR)
    .filter(
      (entry) => entry !== SELF && CANDIDATE_FILE_PATTERN.test(entry) && statSync(join(TESTS_DIR, entry)).isFile(),
    )
    .filter((entry) => isRetiredSuite(readFileSync(join(TESTS_DIR, entry), "utf8")))
    .sort();
}

describe("built-in sentinels — the scan can actually fail, in both directions", () => {
  it("treats a describe.skip( call as a retired suite", () => {
    expect(isRetiredSuite('describe.skip("x", () => { it("y", () => {}); });')).toBe(true);
  });

  it("does NOT treat a comment mentioning describe.skip( as a retired suite", () => {
    const source = '// this file talks about describe.skip( in prose but never calls it\ndescribe("x", () => {});';
    expect(isRetiredSuite(source)).toBe(false);
  });

  it("treats it.skip( and test.skip( as a retired suite too, not only describe.skip(", () => {
    expect(isRetiredSuite('it.skip("y", () => {});')).toBe(true);
    expect(isRetiredSuite('test.skip("y", () => {});')).toBe(true);
  });

  it("treats describe.skipIf( and describe.todo( as a retired suite", () => {
    expect(isRetiredSuite('describe.skipIf(isCi)("x", () => {});')).toBe(true);
    expect(isRetiredSuite('describe.todo("x");')).toBe(true);
  });

  it("treats describe.runIf(false) as a retired suite, but NOT a runtime condition", () => {
    expect(isRetiredSuite('describe.runIf(false)("x", () => {});')).toBe(true);
    expect(isRetiredSuite('describe.runIf(isCi)("x", () => {});')).toBe(false);
  });

  it("flags a fixture skip suite whose only ward-management import is NOT declared unreachable", () => {
    const fixture = [
      'describe.skip("a retired suite", () => { it("y", () => {}); });',
      'import { SomethingLive } from "@/components/ward-management/some-live-module";',
    ].join("\n");
    const declared = new Set(["src/components/ward-management/ed/ed-home.tsx"]);
    expect(isRetiredSuite(fixture)).toBe(true);
    const imports = wardManagementImportsOf(fixture);
    expect(imports).toEqual(["src/components/ward-management/some-live-module.tsx"]);
    expect(hasDeclaredImport(imports, declared)).toBe(false);
  });

  it("does NOT flag a fixture skip suite that imports a declared-unreachable module", () => {
    const fixture = [
      'describe.skip("a retired suite", () => { it("y", () => {}); });',
      'import { EdHome } from "@/components/ward-management/ed/ed-home";',
    ].join("\n");
    const declared = new Set(["src/components/ward-management/ed/ed-home.tsx"]);
    const imports = wardManagementImportsOf(fixture);
    expect(hasDeclaredImport(imports, declared)).toBe(true);
  });

  it("parses module: entries from real code but not from a comment mentioning the same shape", () => {
    const fixture = [
      "const DECLARED_UNREACHABLE = [",
      '  { module: "src/components/ward-management/ed/ed-home.tsx", why: "..." },',
      '  /* a retired entry used to read module: "src/components/ward-management/old.tsx" */',
      "];",
    ].join("\n");
    expect(parseDeclaredModules(fixture)).toEqual(new Set(["src/components/ward-management/ed/ed-home.tsx"]));
  });

  it("names a file that appears path-prefixed or backtick-wrapped in the record", () => {
    expect(namesFileExactly("See `ward-x.test.tsx` for detail.", "ward-x.test.tsx")).toBe(true);
    expect(namesFileExactly("covered by tests/ward-x.test.tsx directly.", "ward-x.test.tsx")).toBe(true);
  });

  it("does NOT count a file as named when it is only a substring of a DIFFERENT filename", () => {
    expect(namesFileExactly("see `old-ward-x.test.tsx` instead.", "ward-x.test.tsx")).toBe(false);
    expect(namesFileExactly("see `ward-x.test.tsx.bak` instead.", "ward-x.test.tsx")).toBe(false);
  });
});

describe("a retired describe.skip suite is tied to its record and to the reachability list", () => {
  const retiredFiles = listRetiredSuiteFiles();
  const recordText = existsSync(RETIRED_RECORD) ? readFileSync(RETIRED_RECORD, "utf8") : "";
  const declaredModules = parseDeclaredModules(readFileSync(REACHABILITY_TEST, "utf8"));

  it(
    `finds at least ${MIN_EXPECTED_RETIRED_FILES} retired suite(s) and at least ` +
      `${MIN_EXPECTED_DECLARED_MODULES} declared-unreachable module(s), so this cannot pass by measuring nothing`,
    () => {
      expect(retiredFiles.length, retiredFiles.join(", ") || "(none found)").toBeGreaterThanOrEqual(
        MIN_EXPECTED_RETIRED_FILES,
      );
      expect(declaredModules.size, [...declaredModules].join(", ") || "(none parsed)").toBeGreaterThanOrEqual(
        MIN_EXPECTED_DECLARED_MODULES,
      );
    },
  );

  it("names every retired suite in the retired-coverage record, as its own path token", () => {
    const missing = retiredFiles.filter((file) => !namesFileExactly(recordText, file));
    expect(
      missing,
      `not named anywhere in ${relative(ROOT, RETIRED_RECORD).replaceAll("\\", "/")}: ${missing.join(", ")}. Add ` +
        "a record entry before retiring further, or this suite's coverage is not recoverable from the record " +
        "alone.",
    ).toEqual([]);
  });

  it("imports at least one module the reachability test declares unreachable", () => {
    const unlinked = retiredFiles.filter((file) => {
      const imports = wardManagementImportsOf(readFileSync(join(TESTS_DIR, file), "utf8"));
      return !hasDeclaredImport(imports, declaredModules);
    });
    expect(
      unlinked,
      `no ward-management import resolves to a DECLARED_UNREACHABLE entry: ${unlinked.join(", ")}. Either the ` +
        "component this suite renders was never declared unreachable (add the entry), or it has come back " +
        "reachable and this suite's describe.skip needs reconsidering — not this guard.",
    ).toEqual([]);
  });
});
