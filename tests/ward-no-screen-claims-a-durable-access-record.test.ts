/** @vitest-environment node */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * NO WARD SCREEN CLAIMS A DURABLE RECORD OF WHO LOOKED — THE PROPERTY, NOT THE STRING.
 *
 * Ward Lead asked for this rather than a test pinning one sentence: *"a test asserting the exact new
 * sentence is fine as far as it goes, but the thing that actually matters is that no ward screen
 * claims a durable record of who looked."* A string test passes a screen that makes the same false
 * promise in different words.
 *
 * Background: `D-4` in `docs/ward-flow/owner-decisions-2026-09-1x.md`, and §E of
 * `docs/ward-flow/plans/2026-09-1x-lane-c-drawing-facts.md`. The Access record panel is session-only
 * by design — a durable record of who looked at whom is a privacy surface nobody authorised — and a
 * screen promising one invites a clinician to rely on a trace that does not exist.
 *
 * 🔴 **THE OBVIOUS PROPERTY IS THE WRONG ONE, AND FINDING THAT OUT IS THIS FILE'S DESIGN.**
 *
 * The first draft failed any sentence claiming searches are recorded. **That reddens the panel's
 * empty-state sentence, which is CORRECT and was explicitly ruled to be kept** — it says searches
 * are recorded *here*, and in the same breath that nothing is sent anywhere and that it covers this
 * session. So the property is not "never says recorded". It is:
 *
 *     Any sentence claiming access is recorded must, IN THE SAME SENTENCE,
 *     say for how long it lasts or where it does not go.
 *
 * **A qualifier that travels with the claim is the whole point.** §E exists because a qualifier
 * living in a state that disappears — the empty state, replaced the moment a row arrives — is not a
 * qualifier at all.
 *
 * ⚠️ **INCOMPLETE BY CONSTRUCTION, AND SAID SO RATHER THAN IMPLIED.** `CLAIM` is a list of shapes.
 * A paraphrase nobody anticipated escapes it, exactly as the invented-figure marker's own
 * `RETRACTED` list is incomplete and says so. **Widen it by adding a shape AND its self-test case
 * below — never a shape on its own, which is a widening nobody can see.**
 *
 * ⚠️ **The false header note this exists to prevent is named by LOCATOR and never quoted**, here or
 * anywhere else: a file that contains the bad string makes every later search report it as present.
 */

/** Sentences that assert access is kept. Shapes, never bare words — "recorded" alone is innocent. */
const CLAIM = [
  /\b(every|each|all)\s+(search|look-?up|view|access)\w*\b[^.;]*\b(is|are)\s+(recorded|logged|kept|stored|saved|retained)\b/i,
  /\b(searches|look-?ups|views|accesses)\b[^.;]*\b(are|is)\s+(recorded|logged|kept|stored|saved|retained)\b/i,
  /\bwe\s+(record|log|keep|store|retain)\b[^.;]*\b(every|each|all|your)\b/i,
  // ⚠️ NARROWED ON ITS FIRST RUN, AND THE NARROWING IS THE INTERESTING PART. This was originally a
  // bare /audit (trail|log)/ and it fired on two TRUE sentences in the movement console — "Both are
  // recorded on this movement's audit trail" and the correction-reason note. A movement DOES carry
  // a recorded decision trail (`OVERRIDE_REASONS`, `ward-change-reasons.ts`, `override-register`),
  // so those claims are honest. **A trail of DECISIONS is not a record of who LOOKED**, and this
  // property is only ever about the second. The shape now needs an access subject in the same
  // sentence, and its self-test case sits below beside the others — a narrowing without its own
  // case is a widening nobody can see.
  /\baudit\s+(trail|log)\b[^.;]*\b(search|look-?up|view|access)\w*\b|\b(search|look-?up|view|access)\w*\b[^.;]*\baudit\s+(trail|log)\b/i,
];

/** What makes such a claim honest: a bound on how long, or a statement of where it does not go. */
const QUALIFIER =
  /\bthis session\b|\bfor this session only\b|\bnone is sent\b|\bnot\s+(sent|kept|stored|retained)\b|\bnothing is (sent|kept|stored)\b/i;

function claims(sentence: string): boolean {
  return CLAIM.some((shape) => shape.test(sentence));
}

/**
 * ⚠️ A SEMICOLON ENDS A SENTENCE AND A NAIVE SPLITTER DOES NOT KNOW IT. This repository has already
 * had a claim-shaped predicate pass because the claim was true of the first clause and the figure
 * sat in the second. Split on both, and on line breaks, so a qualifier two sentences away cannot
 * launder a claim.
 */
function sentences(text: string): string[] {
  return text
    .split(/[.;]\s|\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Comment lines are excluded: a comment explaining this rule would otherwise trip it — the shape
 *  where writing a defect down breaks its own check. Imperfect and deliberately stated. */
function renderedCopy(source: string): string {
  return source
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      return !(t.startsWith("*") || t.startsWith("//") || t.startsWith("/*"));
    })
    .join("\n");
}

function wardSourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) wardSourceFiles(full, found);
    else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) found.push(full);
  }
  return found;
}

describe("no ward screen claims a durable record of who looked", () => {
  /**
   * 🔴 THE ANTI-VACUITY FLOOR, AND IT IS FIRST FOR A REASON. A text guard whose predicate matches
   * nothing passes perfectly against a screen full of false promises. These cases prove the
   * predicate can fire, that it does not fire on innocent prose, and — the case that shaped the
   * whole file — that it accepts a claim which carries its own qualifier.
   */
  it("the predicate fires on an unqualified claim", () => {
    for (const bad of [
      "Every search is kept.",
      "All lookups are logged.",
      "We keep every search you run.",
      "This panel is an audit trail of every search.",
    ]) {
      expect(claims(bad), `predicate missed: ${bad}`).toBe(true);
      expect(QUALIFIER.test(bad), `unexpectedly qualified: ${bad}`).toBe(false);
    }
  });

  it("the predicate does NOT fire on innocent prose", () => {
    for (const fine of [
      "Search does not return a risk or acuity score or a best match.",
      "Who looked, and when.",
      "Nothing matches what you typed.",
      // 🔴 THE NARROWING'S OWN CASE. A DECISION trail on a movement is honest, and is not this
      // property's subject. This is the sentence that caused the audit shape to be narrowed; without
      // it here, a later reader would widen the shape back and nothing would tell them why not.
      "Both are recorded on this movement's audit trail",
    ]) {
      expect(claims(fine), `false positive: ${fine}`).toBe(false);
    }
  });

  it("a claim that carries its own qualifier passes — the case that defines the property", () => {
    // The Access record panel's empty state, reconstructed here in shape rather than copied, so this
    // file does not become a second home for that sentence.
    const qualified =
      "Every search run from the bar is recorded here with the role and when, and none is sent anywhere";
    expect(claims(qualified)).toBe(true);
    expect(QUALIFIER.test(qualified)).toBe(true);
  });

  it("every recording claim in ward source carries its qualifier in the same sentence", () => {
    const files = wardSourceFiles("src/components/ward-management");
    // Floor: if the sweep ever reads no files, it would pass by measuring nothing.
    expect(files.length, "no ward source files read — this guard would prove nothing").toBeGreaterThan(20);

    const offenders: string[] = [];
    for (const file of files) {
      for (const sentence of sentences(renderedCopy(readFileSync(file, "utf8")))) {
        if (claims(sentence) && !QUALIFIER.test(sentence)) {
          offenders.push(`${file}: ${sentence.slice(0, 120)}`);
        }
      }
    }

    expect(
      offenders,
      "a ward screen claims access is recorded without saying, in the same sentence, how long it " +
        "lasts or where it does not go. See D-4 and drawing-facts §E: the Access record is " +
        "session-only, and a promise of audit is what a clinician relies on when deciding whether " +
        "looking is safe.",
    ).toEqual([]);
  });
});
