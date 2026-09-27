import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { edMedicalTripBedRetention, type BedRetentionBasis } from "@/components/ward-management/ward-derivations";
import { ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS } from "@/components/ward-management/ward-model";

/**
 * 🔴 **`48` IS THE OWNER'S BED-MANAGEMENT FIGURE AND A FUTURE READER WILL ASSUME IT CAME FROM THE
 * MENTAL HEALTH ACT.** That assumption is the whole risk, and it is a reasonable one to make: this
 * is a psychiatric prototype, 48 hours is the shape of a statutory period, and three separate
 * agents have already written three different invented statutory durations into this directory
 * (`tests/ward-legal-figure-guard.test.ts` exists because of them).
 *
 * Ruling `FD-19` (owner, 2026-08-30): *"a ward→ED-medical trip frees the bed ONLY IF the stay is
 * expected to exceed 48 hours, and that is overridable"*. Below it the bed stays theirs and the
 * person reads as on overnight leave. **It is permitted precisely because he supplied it.**
 *
 * ## What this file pins, and why each part needs a different kind of evidence
 *
 *   **Part 1 — the figure is named, never written as a literal.** A bare `48` in ward source is
 *   indistinguishable from a fabricated one; a reference to a constant carrying its provenance is
 *   not. Scanned through the TypeScript AST, never a regular expression, so a comment discussing
 *   the number and a string containing it cannot be mistaken for a use of it — **the failure that
 *   inflated two separate counts on this line in one night.**
 *
 *   **Part 2 — the figure is never sited beside legal material.** This is the requirement the
 *   ruling states in its own words (*"never conflated with, sited beside, or reused as a statutory
 *   period"*) and the one no existing guard covers. Proximity is the property, because conflation
 *   is what a reader does with a layout, not what a program does with a value.
 *
 *   **Part 3 — the behaviour, including the two boundary cases and the one the ruling does not
 *   decide.** Pinned over the real exported derivation, not a copy of its logic.
 *
 * ⚠️ **WHAT THIS FILE DELIBERATELY DOES NOT DO.** It does not check that the figure is *correct* —
 * that is the owner's to say and nobody else's — and it does not re-check the provenance ENTRY,
 * which `ward-legal-figure-guard.test.ts` already enforces fail-closed over every numeric export in
 * the model. Proved: removing the constant's provenance line there turns that guard red naming
 * `ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS`, before this file was written.
 *
 * ## 🔴 THE TWO WAYS A GUARD OF THIS CLASS DIES. BOTH ARMS DID ONE EACH, ON FIRST RUN.
 *
 * Recorded here rather than beside the code that fixes them, because a reader deciding whether to
 * loosen an arm meets this docblock first — **and loosening is what both failures ask you to do.**
 *
 *   **TOO WIDE — it fires on honest, unrelated work.** Part 1 first flagged EVERY `48` in ward
 *   source and went red on `ward-admissions-seed.ts:525`, a seeded occupant's day count that
 *   merely equals 48 and has nothing to do with any threshold. ⚠️ **A guard that reddens correct
 *   work is one somebody widens until it means nothing**, and the widening is done quietly, by
 *   whoever is blocked at the time, with a good reason. The fix was not a smarter pattern but a
 *   narrower QUESTION: the risk was never *"48 appears"*, it is *"48 is used AS this threshold
 *   without its provenance"* — so the literal only counts among bed-release vocabulary.
 *
 *   **TOO NARROW — it is defeated by somebody doing the right thing.** Part 2 first fired on the
 *   derivation's own disclaimer, the sentence *"not a statutory period"*, which is precisely what
 *   a careful author should write. ⚠️ **A guard that punishes the correct disclaimer teaches
 *   people to stop writing it.** Fixed by searching comment- and string-blanked source: **prose is
 *   not siting; a legal FIELD beside the value is.**
 *
 * ⚠️ **THE TWO PULL OPPOSITE WAYS, AND ONE TEST RUN SHOWS YOU ONLY ONE OF THEM.** The wide arm
 * announced itself with a red. The narrow arm announced itself ONLY because the offending prose
 * happened to be in a file this guard scans — **had that disclaimer been written anywhere else,
 * Part 2 would have been quietly unfailable on real code and green forever.** So before changing
 * either arm, answer both questions separately — *what honest work would this fire on?* and *what
 * real violation would it miss?* — and mutate for both: plant a genuine violation (must go red)
 * and a correct disclaimer (must stay green).
 */

const WARD_ROOT = "src/components/ward-management";

/** The figure, as a decimal literal — the shape a fabrication would take. */
const THRESHOLD_LITERAL = String(ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS);

/**
 * Vocabulary that makes a number read as statutory. Deliberately about the ACT and its
 * instruments, not about clinical care in general: "assessment" and "review" appear all over this
 * prototype in ordinary operational senses, and a guard that fired on them would be one somebody
 * widens until it means nothing.
 */
const STATUTORY_VOCABULARY =
  /\b(mental\s+health\s+act|statutory|legal\s+form|legalForm|detention|detained|form\s*1a|form\s*3b|dueAt|deadline)\b/iu;

/**
 * What makes a `48` read as THIS threshold rather than as a coincidence. Anchors the bare-literal
 * check on the subject, so an unrelated 48 elsewhere in ward source is not swept up.
 */
const BED_RELEASE_VOCABULARY =
  /\b(bed\s*release|releaseBed|RELEASE_BED|freesBed|bedRetention|overnight\s+leave|awayAtEmergencyDepartment|awayAtEd|leavingDestination|threshold)\b/iu;

/**
 * Comments and strings blanked, length preserved, so an offset found here can be read back out of
 * the original. **Prose is not siting.** A doc comment saying "this is NOT a statutory period" is
 * the correct disclaimer and must not be what turns the guard red — the first version of this file
 * fired on its own derivation's disclaimer, which is a guard defeated by somebody doing the right
 * thing. What matters is a legal FIELD or VALUE in the code beside the threshold.
 */
function blankCommentsAndStrings(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//gu, (match) => match.replace(/[^\n]/gu, " "))
    .replace(/(?<!:)\/\/[^\n]*/gu, (match) => " ".repeat(match.length))
    .replace(/(["'`])(?:\\.|(?!\1)[^\\\n])*\1/gu, (match) => match[0] + " ".repeat(match.length - 2) + match[0]);
}

/**
 * The one file allowed to write the literal: the constant's own declaration. Its doc comment is
 * where the provenance lives, so it is also the one place the number legitimately sits near the
 * word "statutory" — saying what it is NOT.
 */
const DECLARATION_FILE = `${WARD_ROOT}/ward-model.ts`;

function wardSourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry).replaceAll("\\", "/");
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/u.test(path)) found.push(path);
    }
  };
  walk(WARD_ROOT);
  return found;
}

/** Every numeric literal in a file, with its line — via the AST, so comments and strings are out. */
function numericLiterals(file: string, source: string): { line: number; text: string }[] {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const found: { line: number; text: string }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isNumericLiteral(node)) {
      found.push({ line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1, text: node.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return found;
}

describe("the bed-release threshold is the owner's operational figure, and is pinned apart from the Act", () => {
  const files = wardSourceFiles();
  const sources = new Map(files.map((file) => [file, readFileSync(file, "utf8")]));

  it("walks enough ward source that the verdicts below are not over an empty set", () => {
    expect(
      files.length,
      "the ward source walk collapsed, so every assertion in this file would pass over nothing",
    ).toBeGreaterThan(80);
    expect(
      sources.get(DECLARATION_FILE)?.includes("ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS"),
      "the constant is not in the file this guard believes declares it, so its exemption below " +
        "is pointing at the wrong place and the scan is not testing what it claims",
    ).toBe(true);
  });

  it("finds the figure written as a bare literal nowhere but its own declaration", () => {
    /*
     * The AST is the point. A comment explaining the ruling QUOTES 48, and so does this file's own
     * prose — a text scan would report both and be softened until it reported nothing. What
     * matters is a literal the program actually evaluates.
     */
    const offenders: string[] = [];
    for (const file of files) {
      if (file === DECLARATION_FILE) continue;
      const lines = (sources.get(file) ?? "").split("\n");
      for (const literal of numericLiterals(file, sources.get(file) ?? "")) {
        if (literal.text !== THRESHOLD_LITERAL) continue;
        /*
         * ⚠️ NARROWED, AND THE FIRST VERSION'S BREADTH IS THE REASON. Flagging EVERY 48 in ward
         * source went red on `ward-admissions-seed.ts:525` — a seeded occupant's day count that
         * happens to equal 48 and has nothing to do with any threshold. A guard that fires on
         * honest, unrelated work is one somebody widens until it means nothing, and the ward line
         * has already been warned about exactly that shape. The risk is not "the number 48
         * appears"; it is "48 is used AS this threshold without its provenance", so the literal
         * only counts when it sits among bed-release vocabulary.
         */
        const near = lines.slice(Math.max(literal.line - 4, 0), literal.line + 3).join("\n");
        if (BED_RELEASE_VOCABULARY.test(near)) offenders.push(`${file}:${literal.line}`);
      }
    }
    expect(
      offenders,
      `a bare ${THRESHOLD_LITERAL} is evaluated in ward source outside its declaration. If this is ` +
        "the bed-release threshold, import ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS so the figure " +
        "carries its provenance to the point of use; a reader who meets a bare 48 in a psychiatric " +
        "prototype will reasonably assume it came from the Mental Health Act. If it is a genuinely " +
        "different quantity that happens to equal 48, give it its own named constant saying so.",
    ).toEqual([]);
  });

  it("never sites the threshold beside statutory vocabulary", () => {
    /*
     * The ruling's own words: never conflated with, SITED BESIDE, or reused as a statutory period.
     * Proximity is the property because conflation is something a reader does with a layout. Three
     * lines either side of any mention of the constant — far enough to catch a legal field added to
     * the same object, narrow enough not to fire on a long file that discusses both subjects.
     */
    const offenders: string[] = [];
    for (const file of files) {
      if (file === DECLARATION_FILE) continue; // its doc comment says what it is NOT, by design
      const lines = (sources.get(file) ?? "").split("\n");
      const codeLines = blankCommentsAndStrings(sources.get(file) ?? "").split("\n");
      for (const [index, line] of lines.entries()) {
        if (!line.includes("ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS")) continue;
        const near = codeLines.slice(Math.max(index - 3, 0), index + 4).join("\n");
        const hit = STATUTORY_VOCABULARY.exec(near);
        if (hit !== null) offenders.push(`${file}:${index + 1} — near "${hit[0]}"`);
      }
    }
    expect(
      offenders,
      "the bed-release threshold is sited beside statutory vocabulary. FD-19 forbids exactly this: " +
        "it is a bed-management figure and must never be conflated with, sited beside, or reused " +
        "as a statutory period. Move the legal material, or move the threshold.",
    ).toEqual([]);
  });

  it("flags for review without freeing the bed when expected stay EXCEEDS the threshold, both boundaries pinned", () => {
    const basis = (hours: number | null): BedRetentionBasis =>
      edMedicalTripBedRetention({ expectedStayHours: hours }).basis;
    const frees = (hours: number | null): boolean => edMedicalTripBedRetention({ expectedStayHours: hours }).freesBed;
    const review = (hours: number | null): boolean | undefined =>
      edMedicalTripBedRetention({ expectedStayHours: hours }).requiresReview;

    expect(frees(ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS + 1)).toBe(false);
    expect(basis(ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS + 1)).toBe("above-threshold");
    expect(review(ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS + 1)).toBe(true);

    expect(
      frees(ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS),
      "a stay expected to last EXACTLY the threshold must not free the bed",
    ).toBe(false);
    expect(review(ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS)).toBeUndefined();
    expect(frees(ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS - 1)).toBe(false);
    expect(review(ED_MEDICAL_BED_RELEASE_THRESHOLD_HOURS - 1)).toBeUndefined();

    expect(
      edMedicalTripBedRetention({ expectedStayHours: 12 }).readsAsOvernightLeave,
      "below the threshold the bed stays theirs and FD-19 says the person reads as on overnight " +
        "leave, which is the half of the ruling a bed-count-only implementation would drop",
    ).toBe(true);
  });

  it("lets an override win in BOTH directions, including over the unstated expectation", () => {
    // FD-19 says overridable, not overridable-one-way. A guard asserting only the freeing
    // direction would pass on an implementation that silently refused to hold a long stay.
    expect(
      edMedicalTripBedRetention({ expectedStayHours: 4, override: { freesBed: true } }),
      "an override could not free a bed below the threshold",
    ).toEqual({ freesBed: true, basis: "override", readsAsOvernightLeave: false });

    expect(
      edMedicalTripBedRetention({ expectedStayHours: 400, override: { freesBed: false } }),
      "an override could not HOLD a bed above the threshold — the direction a one-way " +
        "implementation drops, because the threshold already agrees with it in the other",
    ).toEqual({ freesBed: false, basis: "override", readsAsOvernightLeave: true });

    expect(edMedicalTripBedRetention({ expectedStayHours: null, override: { freesBed: true } }).basis).toBe("override");
  });

  it("keeps the bed when nobody has said how long, and says so rather than inventing an expectation", () => {
    /*
     * ⚠️ THE RULING DOES NOT DECIDE THIS CASE. The default is conservative-degradation and is
     * recorded as a judgement in the derivation's doc comment: releasing a bed that should have
     * been held puts somebody else in it and leaves the patient nowhere to return to; holding one
     * that could have been released costs a visibly-held bed anybody can free. Recoverable in one
     * direction only.
     */
    const unknown = edMedicalTripBedRetention({ expectedStayHours: null });
    expect(unknown.freesBed, "an unstated expectation released the bed").toBe(false);
    expect(
      unknown.basis,
      "an unstated expectation was reported as though somebody had stated a short stay. The " +
        "screen would then tell a reader the trip is expected to be brief, which nobody said — " +
        "and this default is a judgement awaiting a ruling, so it must stay visible as one",
    ).toBe("expectation-unknown");

    expect(edMedicalTripBedRetention({ expectedStayHours: Number.NaN }).basis).toBe("expectation-unknown");
  });
});
