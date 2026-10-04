import { readFileSync, readdirSync } from "node:fs";
import { extname, join, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Owner rule D5, `docs/ward-flow/plans/2026-09-16-fix-plan-clinical-and-legal.md`: Ward Flow shows
 * no Mental Health Act section numbers. The owner's own legal questions about these figures are
 * still open, and a correction on 17 September 2026 found citations already written into the model,
 * a test file and the drawings did not survive being checked against the stored copy of the Act in
 * this repository (some existed under a different heading than the one the product gave them; others
 * were not in the stored copy at all — see `docs/ward-flow/owner-decisions-2026-09-16-rulings.md`,
 * the "Correction (17 September 2026)" paragraph under Ruling 1). So no section number may appear in
 * product code, product comments, test comments or drawings until the owner settles those questions.
 *
 * REVISION HISTORY, STATED PLAINLY. A first version of this guard (17 September, first pass) used a
 * same-line "the line must also name the Act" rule for EVERY shape, including the plain word
 * ("section 34") and the bare abbreviation ("s34") — with no numeric floor, and with a scan scope
 * limited to `ward-management`, the mockups app and a non-recursive `docs/ward-flow/mockups/*.html`.
 * That combination is why it missed most of what was on the tree: `ward-model.ts`'s own comment
 * named a section two lines below the one sentence that named the Act, so the same-line rule never
 * saw them together; the drawings' table cells, dropdown options and `inspectForm()` JS arguments
 * carried a form code and a bare "Section NN" in separate cells or separate arguments, never both in
 * one string; and the abbreviation check had no case-insensitive flag, so the capital "S." in the
 * three "WAPOL S.112" lines never matched. Replaying that first version's own detector, against its
 * own narrower scope, on the parent commit `531c74440e` (independently reproduced for this change)
 * caught 9 of the real citations there. Replaying THIS file's current detector and scope against the
 * same commit finds 67 — the true count once the ward test suite is included, on top of the 61 that
 * were in the first version's own three roots. Exact figures are also recorded in this change's
 * commit message; both replays are reproducible from `scannedFiles()`/`citesActSection()` below (the
 * current version) against any commit's checked-out files, or from this change's own diff for the
 * first version's now-superseded detector and scope.
 *
 * WHAT COUNTS AS A CITATION. A bare mention of "the Mental Health Act", "MHA" or "WAPOL" is fine —
 * the product says whose authority a form carries constantly, and D5 was never about hiding a name.
 * What is banned is a SECTION NUMBER: the word "section"/"sections", the abbreviation "s"/"ss", or
 * the "§" symbol, each followed by digits, or a subsection reference like "(1)(b)".
 *
 * THE DETECTOR, IN PLAIN WORDS — see `citesActSection` below for the exact regexes.
 *   - A subsection reference ("section 59(1)(b)", "s.45(4)", or a bare "(1)(b)" beside an Act/MHA/
 *     WAPOL/form-code mention) is always flagged. Nothing legitimate in this codebase produces that
 *     shape: the design standard's own numbering never carries a second parenthesised letter, and
 *     neither does a CSS scale or an HTML anchor ID.
 *   - "section NN" or "sNN"/"ssNN" (no separator) is flagged if the line also names the Act/MHA/
 *     WAPOL or a form code ("Form 1A"), OR if NN is 20 or higher. This numeric floor is what the
 *     first version was missing: every real citation found on this tree numbered 26 or higher (the
 *     WA MHA 2014's own numbering), while the design standard's internal "section N" references and
 *     the digit after a borrowed CSS `--sN` scale stay under 20. A number at or above 20 is therefore
 *     treated as citation-shaped on its own; one below 20 still needs the same-line context.
 *   - "s NN" / "s.NN" / "ss NN" (a real separator — space or dot — between the letter and the digits)
 *     is flagged under the same 20-or-higher floor as the shapes above. ⚠️ **ONE DEVIATION FROM THE
 *     REVIEWER'S PATTERN, STATED HERE BECAUSE THE BRIEF ASKS FOR IT.** The pattern as given used NO
 *     floor for this shape (any number, always flagged) on the reasoning that nothing else writes a
 *     number in that specific separated form. Widening the scan to `docs/ward-flow/mockups/third-
 *     edition-kit/inputs/SHELL-SPEC.md` found a real exception: that document numbers its own steps
 *     "**S.1 The announce helper**", "**S.2 The appearance control**" — a separated "S." shape with
 *     no Act/MHA/WAPOL/form-code context, and no digit anywhere near the Act's own range. The 20
 *     floor already applied to the other three shapes fits this one too, and safely: the stored copy
 *     of the Act in this repository (`data/mha-2014-sections.json`) has no section numbered below
 *     26, so a floor of 20 cannot exclude a real citation to anything that copy actually contains.
 *   - A short lookbehind on the abbreviation forms excludes anything immediately preceded by a word
 *     character, quote, `#`, `"`, `=`, `-`, `.` or `/` — the shapes an HTML `id`/`href` attribute, a
 *     CSS custom property, or a version-looking token like "S2015" actually take.
 *   - HTML entities are normalised first (`&nbsp;` to a space, `&sect;` to "§") so a citation spelled
 *     with an entity instead of a literal character is not invisible to the text scan.
 *
 * KNOWN LIMIT, STATED PLAINLY. A section number BELOW 20 with neither an Act/MHA/WAPOL mention nor a
 * form code on the same line is still missed — for example a bare "section 15" with nothing else on
 * that line would pass. This is a deliberate trade, not an oversight: without it, the design
 * standard's own "section 5.6", "section 6", "section 14.1" prose (over a hundred occurrences across
 * the drawings) would all read as violations, and a guard that cries wolf on legitimate content gets
 * disabled. A future citation to a low-numbered section, should the owner ever settle these
 * questions and the product genuinely need one, would need to be written where a human reading it
 * would also expect to see the Act named — which is exactly the case this guard cannot see.
 *
 * WHAT THIS GUARD CANNOT SEE, beyond the numeric-floor limit above. It is a per-line text scan, not a
 * parser: a citation assembled across two lines (a section number on one line, "Act"/"MHA"/"WAPOL"/a
 * form code on another) is invisible to the same-line rule, though a number of 20 or more, or a
 * subsection reference, is still caught regardless of what line it is on. It does not understand
 * JSX, template-literal interpolation, or CSS at a structural level. It has no allowlist: a
 * legitimate future need to discuss a section number must be reworded, not exempted here.
 */

const WARD_MANAGEMENT_DIR = "src/components/ward-management";
const MOCKUPS_APP_DIR = "src/app/mockups/ward-flow";
const SIGN_IN_COMPONENT_DIR = "src/components/ward-flow-sign-in";
const SIGN_IN_APP_DIR = "src/app/mockups/ward-flow-sign-in";
const DIGEST_APP_DIR = "src/app/mockups/ward-flow-digest";
const DRAWINGS_DIR = "docs/ward-flow/mockups";
const TEST_DIR = "tests";
const GUARD_FILE_NAME = "ward-act-section-citation-guard.test.ts";

/**
 * Owner ruling, 4 October 2026 (Josh, item 13): the synthetic demo may show Act periods with their
 * section references, labelled "Synthetic demo, not legally checked". Exactly these two files may
 * carry section numbers — the one table that holds them and its own test. Every other file in every
 * scanned root stays under D5. Adding a path here needs the owner's word, recorded beside it.
 */
const OWNER_APPROVED_CITATION_FILES = new Set([
  join(WARD_MANAGEMENT_DIR, "legal-forms", "act-periods-demo.ts"),
  join(TEST_DIR, "ward-act-periods-demo.test.ts"),
]);

/**
 * Named exemption: `docs/ward-flow/mockups/reference/` holds Gemini reference copies that nothing
 * in the product is built from — 53 citation lines live there, left in place deliberately as a
 * historical artefact of what an earlier pass produced, not as a drawing this repository ships.
 * `docs/ward-flow/mockups/third-edition-kit/` is a sibling directory under the same drawings root
 * and is NOT exempt — it carries build tooling and handover notes for the drawings and is scanned
 * like any other subfolder.
 */
const DRAWINGS_EXEMPT_DIR = join(DRAWINGS_DIR, "reference");

/** Text-bearing extensions across every scanned root; binary assets (the `third-edition-kit/fonts`
 *  `.woff2` files) are excluded by simply not being in this set. */
const TEXT_EXTENSIONS = new Set([".html", ".md", ".ts", ".tsx", ".css", ".js", ".mjs", ".json", ".sh", ".txt"]);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

/** Every file this guard reads, gathered the same way regardless of which root it came from. */
function scannedFiles(): string[] {
  const srcAndAppRoots = [
    WARD_MANAGEMENT_DIR,
    MOCKUPS_APP_DIR,
    SIGN_IN_COMPONENT_DIR,
    SIGN_IN_APP_DIR,
    DIGEST_APP_DIR,
  ].flatMap((dir) => walk(dir).filter((path) => TEXT_EXTENSIONS.has(extname(path))));

  const exemptPrefix = DRAWINGS_EXEMPT_DIR + sep;
  const drawings = walk(DRAWINGS_DIR).filter(
    (path) => !path.startsWith(exemptPrefix) && TEXT_EXTENSIONS.has(extname(path)),
  );

  const wardTests = readdirSync(TEST_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^ward-.*\.test\.tsx?$/.test(entry.name) && entry.name !== GUARD_FILE_NAME)
    .map((entry) => join(TEST_DIR, entry.name));

  return [...srcAndAppRoots, ...drawings, ...wardTests].filter((path) => !OWNER_APPROVED_CITATION_FILES.has(path));
}

// ---------------------------------------------------------------------------------------------
// THE DETECTOR — see the file-header comment above for what each piece is for in plain words.
// ---------------------------------------------------------------------------------------------

function normalise(raw: string): string {
  return raw.replace(/&(?:nbsp|#160|#x0*a0);/gi, " ").replace(/&(?:sect|#167|#x0*a7);/gi, "§");
}

/** A line names the Act, or the one other body (WA Police) this prototype has cited a section of,
 *  or names a form code — any of which is enough to treat a low-numbered "section N"/"sN" on the
 *  same line as citation-shaped rather than the design standard's own numbering. */
const CONTEXT = /\b(?:mental\s+health\s+act|mha|wapol)\b|\bform\s*\d{1,2}[a-z]\b/i;

const WORD = /\bsections?\s+(\d{1,3})\b(?!\.\d)/gi;
const SYMBOL = /§\s?(\d{1,3})\b(?!\.\d)/g;
const ABBR_BARE = /(?<![\w'’#"=\-./])ss?(\d{2,3})\b(?!\.\d)/gi;
const ABBR_SPACED = /(?<![\w'’#"=\-./])ss?(?:\.\s?|\s)(\d{1,3})\b(?!\.\d)/gi;
const SUBSECTION = /\b(?:sections?\s+|ss?\.\s?)\d{1,4}\s*\(\d+\)/i;
const BARE_SUB = /\(\d{1,4}\)\(\s*[a-z]\s*\)/i;

/**
 * True when `raw` cites an Act (or WAPOL) section number.
 *
 * A subsection reference (`SUBSECTION`) is always citation-shaped. A bare parenthesised subsection
 * (`BARE_SUB`, e.g. "(1)(b)") needs the line to name the Act/MHA/WAPOL/a form code first — unlike a
 * numbered "section"/"s" prefix, "(1)(b)" alone carries no legal marker of its own.
 *
 * For the remaining shapes (the plain word, the "§" symbol, the bare abbreviation, and the
 * separated abbreviation), a match is citation-shaped if EITHER the line already carries context,
 * OR the captured number is 20 or higher — see the file-header comment for why 20, and for the
 * separated abbreviation specifically, why it shares that floor rather than matching at any number.
 */
function citesActSection(raw: string): boolean {
  const line = normalise(raw);
  if (SUBSECTION.test(line)) return true;
  const ctx = CONTEXT.test(line);
  if (ctx && BARE_SUB.test(line)) return true;
  for (const [re, min] of [
    [WORD, 20],
    [SYMBOL, 20],
    [ABBR_BARE, 20],
    [ABBR_SPACED, 20],
  ] as const) {
    for (const m of line.matchAll(re)) {
      if (ctx || Number(m[1]) >= min) return true;
    }
  }
  return false;
}

type Violation = { path: string; line: number; text: string };

function findViolations(): Violation[] {
  const violations: Violation[] = [];
  for (const path of scannedFiles()) {
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    lines.forEach((text, index) => {
      if (citesActSection(text)) {
        violations.push({ path, line: index + 1, text: text.trim() });
      }
    });
  }
  return violations;
}

describe("no Mental Health Act section citations in product code, comments, tests or drawings (D5)", () => {
  it("scans a real number of files — the anti-vacuity floor", () => {
    // A path that resolved to nothing would report a clean pass for the wrong reason.
    // `src/components/ward-management` alone carries 260+ files and `tests/` carries 500+
    // `ward-*.test.ts(x)` files; 50 is a floor far below any root emptying out on its own.
    expect(scannedFiles().length).toBeGreaterThan(50);
  });

  it("exempts only the owner-approved Act period table and its test, and both still exist", () => {
    expect(OWNER_APPROVED_CITATION_FILES.size).toBe(2);
    for (const path of OWNER_APPROVED_CITATION_FILES) {
      expect(readFileSync(path, "utf8").length, `${path} is exempt but missing`).toBeGreaterThan(0);
    }
  });

  it("finds no Act or WAPOL section citation outside the reference exemption", () => {
    const violations = findViolations();
    const report = violations.map((v) => `${v.path}:${v.line}: ${v.text}`).join("\n");
    expect(violations, `Act/WAPOL section citations found (owner rule D5):\n${report}`).toEqual([]);
  });

  describe("positive sentinels — the literal pre-correction shapes that must be caught", () => {
    it.each([
      [
        "the ward-model.ts comment, missed by the first version of this guard",
        "* Form 1A (Referral for examination by psychiatrist - s34/s36):",
      ],
      [
        "a drawing table cell, missed by the first version of this guard",
        "<td>Section 61 &mdash; Order Authorising Transport</td>",
      ],
      [
        "a drawing KPI sub-label using the dotted abbreviation",
        '<span class="kpiSub">s. 34 &bull; 72h max period</span>',
      ],
      [
        "the WAPOL line, missed by the first version for lacking a case-insensitive flag",
        "Police Escort (WAPOL S.112 Involuntary)",
      ],
      ["the section symbol beside a subsection reference", "§34(1)(b)"],
      ["the plural abbreviation with MHA context", "Valid under ss 34-36 of the WA MHA 2014."],
      ["a citation spelled with an HTML non-breaking-space entity", "Section&nbsp;34 Form 1A"],
    ])("catches %s", (_label, line) => {
      expect(citesActSection(line)).toBe(true);
    });
  });

  describe("negative sentinels — shapes that must not be caught", () => {
    it.each([
      "transition: opacity 0.2s",
      "5s timeout",
      "Form 1A",
      "Form 3D",
      "72 hours",
      // The design standard's own numbering (always below the 20 floor, and never beside an
      // Act/MHA/WAPOL/form-code mention) — real content across the drawings, not a citation.
      'id="s15"',
      "section 15 of the standard",
      "Section 15 is the build order. Section 16",
      // An owner-ruling-document section reference, not an Act one.
      "§7",
      // A version-looking token and a bare identifier, both excluded by the abbreviation forms'
      // lookbehind (preceded by nothing citation-shaped) and by the sub-20 floor.
      "S2015",
      "const s10",
      // SHELL-SPEC.md's own step numbering — the real false positive that moved ABBR_SPACED onto
      // the same 20-floor as the other shapes. See the file-header comment's deviation note.
      "**S.1 The announce helper**, which is the zero-width space rule of 3.6 in code",
      "**S.2 The appearance control**, three states remembered for this browser only",
    ])("does not flag %j", (line) => {
      expect(citesActSection(line)).toBe(false);
    });
  });

  it("catches a reintroduced citation — mutation proof", () => {
    // The real shape this line held before the 17 September correction (legal-forms-third-edition
    // .html, one of the table rows fixed in that change): a form code in one cell, a bare "Section
    // NN — <name>" in the next. Kept here as a permanent regression check.
    expect(citesActSection("<td>Section 61 &mdash; Order Authorising Transport</td>")).toBe(true);
  });
});
