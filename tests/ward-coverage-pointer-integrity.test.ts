import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 🔴 **THIS GUARD EXISTS BECAUSE A "COVERAGE SURVIVES ELSEWHERE" COMMENT CAN BE WRONG, AND TWO OF
 * THEM WERE.** `docs/ward-flow/skipped-tests-census-2026-09-12.md` (Findings 1 and 2) found that
 * the Morning screen's Playwright spec and its paused-tour DOM test (both later retired outright,
 * item 41, owner-approved 2026-09-17) each named
 * another test file as the place the coverage they were dropping "still" lived — and in both cases
 * the named file was ITSELF `describe.skip`, so nothing was actually covering the gap. The
 * reassurance read as safety. It was the opposite: a skip whose stated safety net was not there.
 * Both comments are corrected as part of the same change that added this guard. This file is what
 * stops the correction from being the only thing keeping the next one honest.
 *
 * ## The marker convention (documented here, not left for the guard to infer from English)
 *
 * Anywhere in `tests/ward-*.test.ts(x)` or `tests/ui-ward-*.spec.ts` that a comment claims another
 * test file provides surviving/replacement coverage for something this file no longer runs, write
 * this exact tag on its own comment line:
 *
 *     WARD-COVERAGE-POINTER: <path/relative/to/repo-root>
 *
 * e.g. `WARD-COVERAGE-POINTER: tests/ward-capacity-absorbed-morning-coverage.dom.test.tsx`. This guard does not try to parse
 * the surrounding prose — it greps for this literal tag, so a claim that is not tagged is simply
 * not checked, and untagged commentary (mentioning a sibling file for any other reason — mirroring,
 * a shared fixture, a shared guard that watches for drift) is correctly left alone.
 *
 * ## What this guard checks, for every marker found
 *
 * 1. The named path must exist on disk.
 * 2. The named file must NOT be entirely skipped — i.e. it must contain at least one `it(...)` or
 *    `test(...)` case that is not itself `.skip`/`.todo`/`.fixme`, not nested inside a
 *    `describe.skip(...)` (vitest) or `test.describe.skip(...)` (Playwright) block, and does not
 *    open with a runtime `test.skip(true, ...)` escape hatch (the belt-and-braces pattern this repo
 *    uses in `tests/ui-document-canvas.spec.ts`). A pointer at a file with no running case whatsoever
 *    is exactly the defect this guard exists to catch.
 * 3. A POPULATION FLOOR (`MIN_EXPECTED_POINTERS` below): the walk must find at least the number of
 *    markers known to exist today, so a broken glob, a renamed tag, or an accidentally-deleted
 *    marker cannot silently reduce this file to checking nothing while still reporting green.
 *
 * ⚠️ **Comments are searched in their RAW form (the marker is meant to live inside a comment), but
 * the TARGET file's skip status is computed after stripping its comments** — otherwise prose that
 * merely mentions `describe.skip(` (as this very file's header does, and as the corrected comments
 * in the successor to the Morning Playwright spec now do) would be misread as an actual skip call.
 *
 * ⚠️ **Known, accepted limitation:** the comment/call detection below is a text scan, not a real
 * parser. It correctly handles every file in this population as measured on 2026-09-12 (verified
 * directly — see this task's own report), but a sufficiently unusual construct (a `//` inside a
 * string literal that survives stripping, a test title split across multiple template-literal
 * lines) could confuse it. If this guard ever reports a verdict that looks wrong for a specific
 * file, read that file's actual skip state by hand before trusting either this guard or your
 * instinct — and prefer tightening the scan over disabling the check.
 */

const ROOT = process.cwd();
const TESTS_DIR = join(ROOT, "tests");
const CANDIDATE_FILE_PATTERN = /^(ward-.*\.test\.tsx?|ui-ward-.*\.spec\.ts)$/;
const MARKER = /WARD-COVERAGE-POINTER:\s*(\S+)/g;

/**
 * The exact count of `WARD-COVERAGE-POINTER` markers in this repository as of 2026-09-17: one, in
 * `tests/ui-ward-capacity-morning-moved.spec.ts` (renamed from the original Morning Playwright spec),
 * naming `tests/ward-capacity-absorbed-morning-coverage.dom.test.tsx` (marked partial: 3 of its 20
 * cases). This is the surviving half of the claim the Morning family census found still true — the
 * other half, the Morning print-CSS test's own pointer, was retired in the same change that deleted
 * its target (item 41, owner-approved 2026-09-17), so the pointer naming it was removed rather than
 * left pointing at a file that no longer exists. LOWERED from 2 to 1 for exactly that reason, per
 * this comment's own standing instruction: a human deliberately lowering this constant and saying
 * why. Raising this number by adding a genuine new pointer is fine and expected; it must never fall
 * to zero without the same deliberate act, which is the anti-vacuity property the population floor
 * test below enforces.
 */
const MIN_EXPECTED_POINTERS = 1;

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, " ").replace(/\/\/[^\n]*/gu, " ");
}

type Block = { start: number; end: number; skip: boolean };

/**
 * Finds every `<name>(...)`, `<name>.skip(...)`, `<name>.only(...)`, `<name>.todo(...)` or
 * `<name>.fixme(...)` call whose FIRST argument is a string title (a real test/describe title,
 * never a runtime call like `test.skip(true, someReasonVariable)`, whose first argument is the
 * literal `true`) and that carries a `{ ... }` callback body, returning the brace-matched span of
 * that body. Word-boundary + optional-whitespace-around-the-dot matching means `describe` also
 * matches Playwright's `test.describe(` / `test.describe\n  .skip(` chains without a second regex,
 * while `test.describe.configure({...})` is correctly rejected (no recognised modifier follows
 * `.describe`, so the call head never matches at all).
 */
function findCallBlocks(src: string, name: string): Block[] {
  const blocks: Block[] = [];
  const head = new RegExp(`\\b${name}(?:\\s*\\.\\s*(skip|only|todo|fixme))?\\s*\\(`, "g");
  let match: RegExpExecArray | null;
  while ((match = head.exec(src))) {
    const afterParen = match.index + match[0].length;
    if (!/^\s*["'`]/.test(src.slice(afterParen))) continue; // not a titled test/describe call
    const braceIdx = src.indexOf("{", afterParen);
    if (braceIdx === -1) continue;
    if (braceIdx - afterParen > 400) continue; // the brace found belongs to something else entirely
    let depth = 1;
    let i = braceIdx + 1;
    while (i < src.length && depth > 0) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") depth--;
      i++;
    }
    blocks.push({ start: braceIdx, end: i, skip: match[1] === "skip" || match[1] === "todo" || match[1] === "fixme" });
  }
  return blocks;
}

/** True if `body`'s own first statement is a runtime `test.skip(true, ...)` / `it.skip(true, ...)`. */
function bodyOpensWithRuntimeSkip(src: string, block: Block): boolean {
  const body = src.slice(block.start + 1, block.end - 1).trimStart();
  return /^\w+\.skip\(\s*true\b/.test(body);
}

/**
 * A file is entirely skipped when it has NO live case: every `it`/`test` is itself `.skip`, sits
 * inside a skipped `describe`, or opens with the runtime `test.skip(true, ...)` escape hatch.
 */
function isEntirelySkipped(rawSource: string): boolean {
  const src = withoutComments(rawSource);
  const skipDescribeRanges = findCallBlocks(src, "describe").filter((b) => b.skip);
  const isWithinSkippedDescribe = (pos: number) => skipDescribeRanges.some((b) => pos >= b.start && pos < b.end);

  const testBlocks = [...findCallBlocks(src, "it"), ...findCallBlocks(src, "test")];
  const hasLiveCase = testBlocks.some(
    (b) => !b.skip && !isWithinSkippedDescribe(b.start) && !bodyOpensWithRuntimeSkip(src, b),
  );
  return !hasLiveCase;
}

// This guard's own file is excluded from the walk: its header documents the marker syntax in
// prose and its own source defines the MARKER regex literal, both of which would otherwise match
// themselves and be misread as a pointer to a nonsense path.
const SELF = "ward-coverage-pointer-integrity.test.ts";

function listCandidateFiles(): string[] {
  return readdirSync(TESTS_DIR)
    .filter(
      (entry) => entry !== SELF && CANDIDATE_FILE_PATTERN.test(entry) && statSync(join(TESTS_DIR, entry)).isFile(),
    )
    .map((entry) => join(TESTS_DIR, entry));
}

type Pointer = { sourceFile: string; targetSpec: string; targetPath: string };

function findPointers(): Pointer[] {
  const pointers: Pointer[] = [];
  for (const file of listCandidateFiles()) {
    const raw = readFileSync(file, "utf8");
    for (const match of raw.matchAll(MARKER)) {
      pointers.push({
        sourceFile: relative(ROOT, file).replaceAll("\\", "/"),
        targetSpec: match[1],
        targetPath: join(ROOT, match[1]),
      });
    }
  }
  return pointers;
}

describe("a WARD-COVERAGE-POINTER comment names a file that actually still covers the gap", () => {
  const pointers = findPointers();

  it(`finds at least ${MIN_EXPECTED_POINTERS} WARD-COVERAGE-POINTER marker(s), so a walk that finds zero cannot pass`, () => {
    /*
     * ⚠️ THE FLOOR IS ON THE POPULATION, NEVER ON THE VIOLATIONS — see ward-component-reachability's
     * own comment on the same point. This asks only whether the scan still sees what it scans.
     */
    expect(
      pointers.length,
      pointers.length === 0
        ? "no WARD-COVERAGE-POINTER markers were found anywhere in tests/ward-*.test.ts(x) or " +
            "tests/ui-ward-*.spec.ts. Either every 'coverage survives elsewhere' claim has genuinely " +
            "been removed from this population (in which case lower MIN_EXPECTED_POINTERS to 0 and " +
            "say so in this file's header), or the marker text, the file glob, or the tests/ directory " +
            "itself changed underneath this guard and it is now silently checking nothing."
        : `found ${pointers.length}: ${pointers.map((p) => `${p.sourceFile} -> ${p.targetSpec}`).join(", ")}`,
    ).toBeGreaterThanOrEqual(MIN_EXPECTED_POINTERS);
  });

  it("names a file that exists", () => {
    const missing = pointers.filter((p) => !existsSync(p.targetPath));
    expect(
      missing.map((p) => `${p.sourceFile} points at ${p.targetSpec}, which does not exist`),
      "a WARD-COVERAGE-POINTER names a file that is not on disk. Either the target was renamed or " +
        "deleted and the pointer comment was never updated, or the path was typed wrong.",
    ).toEqual([]);
  });

  it("names a file that is not itself entirely skipped", () => {
    const hollow = pointers
      .filter((p) => existsSync(p.targetPath))
      .filter((p) => isEntirelySkipped(readFileSync(p.targetPath, "utf8")))
      .map(
        (p) =>
          `${p.sourceFile} claims surviving coverage in ${p.targetSpec}, but every case in ${p.targetSpec} is itself skipped`,
      );

    expect(
      hollow,
      "a WARD-COVERAGE-POINTER claims coverage survives in a file that cannot fail, because nothing " +
        "in it runs. This is the exact defect docs/ward-flow/skipped-tests-census-2026-09-12.md found " +
        "twice in the Morning family: a reassurance that reads as safety while covering nothing. " +
        "Either the named file needs to be un-skipped (a decision, not a default), or the pointing " +
        "comment must stop claiming this coverage survives and say plainly that it does not.",
    ).toEqual([]);
  });
});
