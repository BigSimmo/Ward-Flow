import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * 🔴 **THIS GUARD EXISTS BECAUSE TWO TEST CASES IN THIS REPOSITORY CAN NEVER FAIL.**
 * `tests/ward-screen-overview-and-entry.dom.test.tsx` carried, until this file's own commit,
 * `expect(true).toBe(true)` at two places (near lines 110-112 and 169-171) — each one labelled
 * "[contract record]" / "[mutation record]" and dressed in a doc comment that reads as though it
 * proves something. It proves nothing: the assertion passes for every possible state of the
 * screen it sits under, including a screen that has been deleted. A reader counting green ticks
 * over that file sees two extra passing cases; a coordinator's browser sees no extra protection
 * at all.
 *
 * ⚠️ **THE STALE COMMENT WAS PART OF THE SAME DEFECT.** The doc comment on the second case quoted
 * `container.querySelectorAll(...)` and the title `"renders no form control anywhere on the
 * page"` — neither is the real code. The real query is `main.querySelectorAll(...)` (scoped to
 * `#main-content`, not the whole render) and the real title is `"renders no form control anywhere
 * in its own content"`. A comment that misquotes its own neighbour is not a small error: it is
 * the thing a reader trusts instead of opening the test above it, so it was corrected in the same
 * change that turned the tautology into a real assertion.
 *
 * ## What this guard checks, over `tests/ward-*.test.ts(x)` and `tests/ui-ward-*.spec.ts`
 *
 * A case is flagged when, after comments are stripped, it contains:
 *
 *   - `expect(<literal>[, <message>]).toBe(<literal>)`, `.toEqual(...)` or `.toStrictEqual(...)`
 *     — a fixed value compared against a fixed value, where "fixed value" is a boolean (`true`,
 *     `false`, or either negated with a single `!`), a number, `null`, `undefined`, a quoted
 *     string, or a template literal with no `${...}` interpolation, and the two VALUES the two
 *     sides denote are equal — `!false` and `true` are two different spellings of one value and
 *     both count, exactly as `'x'`, `"x"` and `` `x` `` do. The optional `<message>` is `expect`'s
 *     own second argument (this repository's normal `expect(actual, "why")` style), which does not
 *     change what is being compared and must not let a case slip past by adding it;
 *   - `expect(true).toBeTruthy()` or `expect(false).toBeFalsy()`, with the same optional message
 *     argument allowed — a hard-coded boolean asked whether it is truthy/falsy, which is a
 *     property of the literal, not of the system.
 *
 * `expect(value).toBe(true)` is NOT flagged — `value` is a variable (or a member expression like
 * `result.ok`), so the check can fail depending on what the code under test actually returned.
 * `expect(1).toBe(2)` is NOT flagged either: the two sides denote different values, so the
 * assertion is not a tautology (it is either a bug that fails every run, which shows up on its
 * own, or a check this guard has no business second-guessing). The population is exactly "both
 * sides are fixed values that are equal", never "asserts a boolean" or "asserts two literals" in
 * general.
 *
 * ⚠️ **COMMENTS ARE STRIPPED WITH NEWLINES PRESERVED, NOT COLLAPSED**, unlike the shared
 * `withoutComments` idiom used elsewhere in this repository's guards (which replaces a whole
 * comment with one space and shifts every line number after it). This guard's own failure
 * message names a line, so the stripped text has to keep exactly the line layout of the file it
 * came from — every removed comment character becomes a space, never a removed newline.
 *
 * ⚠️ **THE STRIPPER IS STRING-AWARE.** A naive `//` scan reads a URL inside a string —
 * `"https://example.com"` — as a comment start and blanks out everything after it on that line,
 * including a real assertion sitting on the same line. The stripper below walks the source one
 * character at a time, tracking whether it is currently inside a single- or double-quoted string,
 * a template literal, or a `${...}` substitution inside one, and only treats `/` as the start of a
 * comment while in plain code. String and template contents pass through completely unchanged, so
 * the literal-matching regexes below still see exactly the source text they need to.
 *
 * ⚠️ **THE FLOOR IS ON THE POPULATION, NEVER ON THE VIOLATIONS** — see
 * `ward-component-reachability.test.ts` and `ward-coverage-pointer-integrity.test.ts` for the
 * same discipline. A floor on violations goes red the moment somebody fixes them all, which
 * teaches the next person to delete the guard. This floor asks only whether the scan still sees
 * what it scans: 491 files matched this population when this guard was written (479
 * `ward-*.test.ts(x)` + 12 `ui-ward-*.spec.ts`), so 200 is a floor with real headroom, not a
 * number copied from today's count.
 */

const ROOT = process.cwd();
const TESTS_DIR = join(ROOT, "tests");
const CANDIDATE_FILE_PATTERN = /^(ward-.*\.test\.tsx?|ui-ward-.*\.spec\.ts)$/;
const MIN_EXPECTED_FILES = 200;

// This guard's own file is excluded: its header quotes the exact tautology it hunts for, in
// prose, and that prose would otherwise be misread as a violation of itself.
const SELF = "ward-no-tautological-cases.test.ts";

/**
 * Replaces every comment character with a space, preserving newlines and column positions, and
 * never mistaking a `//` inside a string or template literal for a comment start. See the header
 * comment above for why this needs to be a small hand-written scanner (it needs STATE — currently
 * inside a string or not — that a pair of independent regexes has no memory of) rather than a
 * smarter pattern. Regex literals containing `//` are not specially handled, matching this
 * function's pre-existing behaviour for that case; only quoted strings and template literals are.
 */
function withoutComments(source: string): string {
  const out: string[] = [];
  type Mode = "code" | "line-comment" | "block-comment" | "single-quote" | "double-quote" | "template";
  let mode: Mode = "code";
  // Tracks `{` nesting so a `${` substitution inside a template literal knows which matching `}`
  // returns it to template mode, rather than to plain code — a substitution can itself contain
  // object literals with their own unrelated braces.
  const braceStack: Array<"code" | "template-substitution"> = [];

  const n = source.length;
  for (let i = 0; i < n; i++) {
    const ch = source[i];
    const next = i + 1 < n ? source[i + 1] : "";

    if (mode === "line-comment") {
      if (ch === "\n") {
        out.push("\n");
        mode = "code";
      } else {
        out.push(" ");
      }
      continue;
    }

    if (mode === "block-comment") {
      if (ch === "*" && next === "/") {
        out.push("  ");
        i++;
        mode = "code";
      } else {
        out.push(ch === "\n" ? "\n" : " ");
      }
      continue;
    }

    if (mode === "single-quote" || mode === "double-quote") {
      const closing = mode === "single-quote" ? "'" : '"';
      if (ch === "\\" && next !== "") {
        out.push(ch, next);
        i++;
        continue;
      }
      out.push(ch);
      if (ch === closing) mode = "code";
      continue;
    }

    if (mode === "template") {
      if (ch === "\\" && next !== "") {
        out.push(ch, next);
        i++;
        continue;
      }
      if (ch === "`") {
        out.push(ch);
        mode = "code";
        continue;
      }
      if (ch === "$" && next === "{") {
        out.push(ch, next);
        i++;
        braceStack.push("template-substitution");
        mode = "code";
        continue;
      }
      out.push(ch);
      continue;
    }

    // mode === "code"
    if (ch === "/" && next === "/") {
      out.push("  ");
      i++;
      mode = "line-comment";
      continue;
    }
    if (ch === "/" && next === "*") {
      out.push("  ");
      i++;
      mode = "block-comment";
      continue;
    }
    if (ch === "'") {
      out.push(ch);
      mode = "single-quote";
      continue;
    }
    if (ch === '"') {
      out.push(ch);
      mode = "double-quote";
      continue;
    }
    if (ch === "`") {
      out.push(ch);
      mode = "template";
      continue;
    }
    if (ch === "{") {
      braceStack.push("code");
      out.push(ch);
      continue;
    }
    if (ch === "}") {
      const top = braceStack.pop();
      out.push(ch);
      if (top === "template-substitution") mode = "template";
      continue;
    }
    out.push(ch);
  }

  return out.join("");
}

// Each piece is written as a real regex literal (so it gets ordinary, single-level backslash
// escaping) and only its `.source` is kept — building the same pattern as one hand-escaped string
// is exactly the kind of thing that silently miscounts a backslash and no reviewer catches by eye.
const BOOLEAN_LITERAL = /!?\s*(?:true|false)/u.source;
const NUMBER_LITERAL = /-?\d+(?:\.\d+)?/u.source;
const NULLISH_LITERAL = /null|undefined/u.source;
const STRING_LITERAL = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/u.source;
// A template literal with NO `${...}` interpolation — a `$` is allowed only when it is not
// immediately followed by `{`, so `` `${x}` `` (a real, variable-dependent expression) never
// matches and is correctly left alone, same as a bare identifier.
const TEMPLATE_LITERAL = /`(?:\\.|[^`\\$]|\$(?!\{))*`/u.source;

/** A literal this guard treats as a fixed value: boolean (optionally negated with a single `!`),
 *  number, `null`, `undefined`, a quoted string, or an interpolation-free template literal. */
const LITERAL = [BOOLEAN_LITERAL, NUMBER_LITERAL, NULLISH_LITERAL, STRING_LITERAL, TEMPLATE_LITERAL]
  .map((piece) => `(?:${piece})`)
  .join("|");

/** `expect`'s own optional second argument — this repository's normal `expect(actual, "why")`
 *  message style. Only a quoted string or a template literal is accepted (never an arbitrary
 *  expression), which is the shape this repository actually writes and keeps the pattern from
 *  having to balance arbitrary nested parentheses. */
const MESSAGE_ARG = `(?:\\s*,\\s*(?:${STRING_LITERAL}|${TEMPLATE_LITERAL}))?`;

/** `expect(<literal>[, <message>]).toBe/toEqual/toStrictEqual(<literal>)` — TWO independent
 *  captures, not a backreference, because the two sides no longer have to be the same SPELLING
 *  (`!false` and `true`) to be the same VALUE. `findTautologies` below normalizes both captures
 *  and only counts the match when the values are equal. */
const SAME_LITERAL_CALL = new RegExp(
  `expect\\(\\s*(${LITERAL})\\s*${MESSAGE_ARG}\\s*\\)\\s*\\.\\s*(?:toBe|toEqual|toStrictEqual)\\s*\\(\\s*(${LITERAL})\\s*\\)`,
  "gu",
);
const TRUE_TOBE_TRUTHY = new RegExp(
  `expect\\(\\s*true\\s*${MESSAGE_ARG}\\s*\\)\\s*\\.\\s*toBeTruthy\\s*\\(\\s*\\)`,
  "gu",
);
const FALSE_TOBE_FALSY = new RegExp(
  `expect\\(\\s*false\\s*${MESSAGE_ARG}\\s*\\)\\s*\\.\\s*toBeFalsy\\s*\\(\\s*\\)`,
  "gu",
);

type LiteralValue = boolean | number | string | null | undefined;

/**
 * The value a captured LITERAL's source text denotes, so two different SPELLINGS of one value
 * (`!false` and `true`; `'x'`, `"x"` and `` `x` ``) are recognised as the same value without
 * requiring identical source text. Only ever called on text the LITERAL pattern above matched, so
 * the shape is always one of these cases — there is no "unrecognised literal" fallthrough to get
 * wrong.
 */
function normalizeLiteral(raw: string): LiteralValue {
  const trimmed = raw.trim();
  if (/^!\s*true$/u.test(trimmed)) return false;
  if (/^!\s*false$/u.test(trimmed)) return true;
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (trimmed === "undefined") return undefined;
  if (/^-?\d+(?:\.\d+)?$/u.test(trimmed)) return Number(trimmed);
  // A quoted string or an interpolation-free template literal: strip the outer quote/backtick and
  // unescape `\x` -> `x`, so 'x', "x" and `x` all normalize to the identical bare value "x".
  return trimmed.slice(1, -1).replace(/\\(.)/gsu, "$1");
}

type Violation = { line: number; snippet: string };

function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (source.charCodeAt(i) === 10 /* \n */) line++;
  return line;
}

/** Pure — scans one file's raw source text and returns every tautological case it finds. */
export function findTautologies(rawSource: string): Violation[] {
  const stripped = withoutComments(rawSource);
  const found: Violation[] = [];

  SAME_LITERAL_CALL.lastIndex = 0;
  let sameLiteralMatch: RegExpExecArray | null;
  while ((sameLiteralMatch = SAME_LITERAL_CALL.exec(stripped))) {
    const [snippet, actual, expected] = sameLiteralMatch;
    if (Object.is(normalizeLiteral(actual), normalizeLiteral(expected))) {
      found.push({ line: lineAt(stripped, sameLiteralMatch.index), snippet: snippet.replace(/\s+/gu, " ").trim() });
    }
  }

  for (const pattern of [TRUE_TOBE_TRUTHY, FALSE_TOBE_FALSY]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(stripped))) {
      found.push({ line: lineAt(stripped, match.index), snippet: match[0].replace(/\s+/gu, " ").trim() });
    }
  }
  return found.sort((a, b) => a.line - b.line);
}

function listCandidateFiles(): string[] {
  return readdirSync(TESTS_DIR)
    .filter(
      (entry) => entry !== SELF && CANDIDATE_FILE_PATTERN.test(entry) && statSync(join(TESTS_DIR, entry)).isFile(),
    )
    .map((entry) => join(TESTS_DIR, entry));
}

describe("built-in sentinels — the scan can actually fail, in both directions", () => {
  it("flags the exact known tautology, expect(true).toBe(true)", () => {
    const violations = findTautologies('it("x", () => {\n  expect(true).toBe(true);\n});');
    expect(violations).toEqual([{ line: 2, snippet: "expect(true).toBe(true)" }]);
  });

  it("does NOT flag expect(value).toBe(true) — a variable is not a literal-against-itself", () => {
    const violations = findTautologies('it("x", () => { expect(value).toBe(true); });');
    expect(violations).toEqual([]);
  });

  it("does NOT flag expect(result.ok).toBe(true) — a member expression is not a literal", () => {
    const violations = findTautologies('it("x", () => { expect(result.ok).toBe(true); });');
    expect(violations).toEqual([]);
  });

  it("does NOT flag expect(a).toBe(b) when the two literals differ", () => {
    const violations = findTautologies("expect(1).toBe(2); expect('a').toBe('b');");
    expect(violations).toEqual([]);
  });

  it("flags expect(true).toBeTruthy() and expect(false).toBeFalsy(), but not a variable form", () => {
    const violations = findTautologies(
      "expect(true).toBeTruthy();\nexpect(false).toBeFalsy();\nexpect(value).toBeTruthy();",
    );
    expect(violations.map((v) => v.snippet)).toEqual(["expect(true).toBeTruthy()", "expect(false).toBeFalsy()"]);
  });

  it("ignores a mention of the exact pattern inside a comment", () => {
    const violations = findTautologies('// expect(true).toBe(true) would be a tautology\nit("x", () => {});');
    expect(violations).toEqual([]);
  });

  it("also flags toEqual and toStrictEqual, not only toBe", () => {
    const violations = findTautologies('expect("x").toEqual("x");\nexpect(3).toStrictEqual(3);');
    expect(violations).toHaveLength(2);
  });

  it('flags expect(<literal>, "message").toBe(<literal>) — this repository\'s normal message style', () => {
    const violations = findTautologies('expect(true, "always true").toBe(true);');
    expect(violations).toEqual([{ line: 1, snippet: 'expect(true, "always true").toBe(true)' }]);
  });

  it('does NOT let a message argument hide expect(value, "msg").toBe(true) — value is not a literal', () => {
    const violations = findTautologies('expect(value, "msg").toBe(true);');
    expect(violations).toEqual([]);
  });

  it("flags a negated boolean literal against its equal non-negated form: expect(!false).toBe(true)", () => {
    const violations = findTautologies("expect(!false).toBe(true); expect(!true).toBe(false);");
    expect(violations).toHaveLength(2);
  });

  it("flags a no-interpolation template literal against itself: expect(`x`).toBe(`x`)", () => {
    const violations = findTautologies("expect(`x`).toBe(`x`);");
    expect(violations).toEqual([{ line: 1, snippet: "expect(`x`).toBe(`x`)" }]);
  });

  it("flags the same string value spelled with a different quote style: expect('x').toBe(`x`)", () => {
    const violations = findTautologies("expect('x').toBe(`x`);");
    expect(violations).toHaveLength(1);
  });

  it("does NOT flag a template literal WITH interpolation — it depends on a variable", () => {
    const violations = findTautologies("expect(`${value}`).toBe(`${value}`);");
    expect(violations).toEqual([]);
  });

  it("flags expect(null).toBe(null) and expect(undefined).toBe(undefined)", () => {
    const violations = findTautologies("expect(null).toBe(null); expect(undefined).toBe(undefined);");
    expect(violations).toHaveLength(2);
  });

  it('flags toBeTruthy/toBeFalsy with a message argument too: expect(true, "msg").toBeTruthy()', () => {
    const violations = findTautologies('expect(true, "msg").toBeTruthy(); expect(false, "msg").toBeFalsy();');
    expect(violations).toHaveLength(2);
  });

  it("does not let a // inside a same-line string swallow a real assertion after it", () => {
    // The old two-regex stripper had no notion of "inside a string": it read the URL's // as a
    // comment start and blanked out the rest of the line, including the real tautology below.
    const source = 'const doubled = "http://example.com//x"; expect(true).toBe(true);';
    const violations = findTautologies(source);
    expect(violations.map((v) => v.snippet)).toEqual(["expect(true).toBe(true)"]);
  });

  it("does not let a // inside a same-line string cause a false positive on real code after it", () => {
    const source = 'const doubled = "http://example.com//x"; expect(result.ok).toBe(true);';
    expect(findTautologies(source)).toEqual([]);
  });

  it("still strips a genuine // comment that follows a string on the same line", () => {
    const source = 'const url = "https://example.com"; // not code\nexpect(value).toBe(true);';
    expect(findTautologies(source)).toEqual([]);
  });
});

describe("no case in the ward test population asserts a tautology", () => {
  const files = listCandidateFiles();

  it(`scans at least ${MIN_EXPECTED_FILES} files, so this cannot pass by measuring nothing`, () => {
    expect(
      files.length,
      files.length === 0
        ? "found zero files under tests/ward-*.test.ts(x) or tests/ui-ward-*.spec.ts — the glob or " +
            "the tests/ directory itself changed underneath this guard, and it is now checking nothing"
        : `found ${files.length}`,
    ).toBeGreaterThanOrEqual(MIN_EXPECTED_FILES);
  });

  it("contains no expect(x[, msg]).toBe/toEqual/toStrictEqual(y) where x and y are the same fixed value, and no literal toBeTruthy()/toBeFalsy()", () => {
    const violations = files.flatMap((file) => {
      const relPath = relative(ROOT, file).replaceAll("\\", "/");
      return findTautologies(readFileSync(file, "utf8")).map((v) => `${relPath}:${v.line} — ${v.snippet}`);
    });

    expect(
      violations,
      "a tautological assertion can never fail, so a case built only from one reports green " +
        "regardless of what the code under test does. Replace it with a real assertion against the " +
        "rendered output, or delete the case.",
    ).toEqual([]);
  });
});
