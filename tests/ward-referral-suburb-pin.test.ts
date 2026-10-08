import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * THE SUBURB NOTE, AND THE MODEL FACT THAT IS THE ONLY REASON IT IS TRUE.
 *
 * ⚠️ **THIS FILE HAS ALREADY CAUGHT THE THING IT WAS BUILT FOR, AND THIS IS ITS SECOND POSTURE.**
 *
 * Until 2026-08-30 `Referral` carried `homeRegion` and nothing finer, so the intake form's Suburb
 * control was answered by a clinician and then deliberately dropped: it read the catchment for the
 * destination picker below it and went no further. The form SAID so, in a sentence beside the
 * control, rather than leaving a clinician to assume their answer was recorded — and this file
 * pinned that sentence against `Referral` having no `suburb` key, so that the day the model widened,
 * THIS FILE went red and sent whoever widened it straight to the sentence that had just become a
 * lie. That is exactly what happened. The note now says the opposite, because it is now the
 * opposite that is true.
 *
 * ⚠️ **THE INVERSION IS THE WHOLE POINT, AND DELETING THE ASSERTION WOULD HAVE BEEN THE WRONG FIX.**
 * A pin that can no longer fail is worse than no pin: it looks like coverage while asserting
 * nothing. So the direction flipped and the teeth stayed. The three halves, none of them worth
 * anything alone:
 *
 *   1. The note is on screen, in words a clinician can read, saying the suburb IS recorded — so it
 *      cannot be quietly deleted, leaving a control whose fate is unstated.
 *   2. `Referral` STILL carries a `suburb` key — so the day the field is removed or renamed, this
 *      file goes red and sends whoever removed it to the sentence that has just become a lie in the
 *      other direction. A false reassurance that the record holds something it does not is the same
 *      defect as the one this file already caught, pointing the other way.
 *   3. The picker offers an HONEST "not known" answer, one option per `SUBURB_UNKNOWN_REASONS`
 *      member, derived rather than hand-listed. ⚠️ A person of no fixed abode, or one police brought
 *      in at 3am with no address known, MUST be referable — they are, if anything, more likely to
 *      need a bed. A required picker with no true option is what makes a clinician choose a
 *      plausible nearby suburb to get past the form, putting an invented place into the one field
 *      whose entire defence is that it resolves against a real table. A hand-written options list
 *      silently omitted this cohort here once, which is why half 3 counts against the constant.
 *
 * ⚠️ **A SUBURB IS NOT AN ADDRESS (`PD-3`), and nothing here licenses a finer one.** `address`
 * remains UNRULED and the guard stays closed on it; a street, a number or a postcode beside this
 * picker is forbidden however natural it feels.
 *
 * **Why the anchor is asserted before anything is asserted about what it found.** Half 2 reads a
 * type declaration out of another file's SOURCE TEXT, and the failure mode of every such check is
 * that the extraction matches nothing — after a rename, a reformat, or a move to another file — and
 * a verdict about "a block I never found" then reads exactly like a result. So the anchor is a test
 * of its own: exactly one declaration found, and a positive control (`homeRegion`, the other field
 * the note's history names) proving the key matcher can match at all. Neither the anchor test nor
 * the `suburb` assertion can pass vacuously.
 *
 * The anchor is the exact full line `export type Referral = {`, never a keyword search. Two sibling
 * declarations would swallow a looser pattern: `ReferralAddressing` in the same file, and the intake
 * form's own module-private `ReferralDraft`, which carries `suburb` as a raw `string` — a pattern
 * that caught either of those would report the right verdict for the wrong reason, which is the one
 * failure this file cannot detect from its own output.
 *
 * This file is `.test.ts`, not `.dom.test.tsx`, so it collects under vitest.config.mts's "node"
 * project: half 2 is a source-text check with no DOM in it. Halves 1 and 3 rendered the full-page
 * intake form, retired on 8 Oct 2026; see the note inside the describe block below.
 */

import { SUBURB_UNKNOWN_REASONS } from "@/components/ward-management/ward-model";

/** The note's own test id, as the component sets it. */
const NOTE_TEST_ID = "ward-referral-intake-suburb-note";

const MODEL_PATH = path.join(__dirname, "..", "src", "components", "ward-management", "ward-model.ts");

/** The declaration half 2 is about. Named once, so the anchor guard below has something to fail on. */
const REFERRAL_TYPE_NAME = "Referral";

/** The other field the note's history names — the positive control proving the key matcher is not
 *  inert. `homeRegion` is the right control because the note used to end "which holds a home region
 *  and nothing finer", so it is the field this pin has always been read against. */
const FIELD_THE_NOTE_NAMES = "homeRegion";

/** The field whose DEPARTURE would make the note a lie. It arrived on 2026-08-30; the note was
 *  rewritten to match, so from here it is the field's absence that falsifies the screen. */
const FIELD_THE_NOTE_NOW_DEPENDS_ON = "suburb";

/**
 * The body of `export type <typeName> = { ... };` in `ward-model.ts`, comments stripped.
 *
 * Anchored on the exact full line, so `ReferralAddressing` and every other `Referral*` declaration
 * in the same file are excluded by construction rather than by hoping a pattern is tight enough.
 * Both the opener and the terminator are asserted, each with its own message, BEFORE the caller is
 * given anything to assert about — a block that was never found must fail loudly, never pass.
 */
function declarationBody(typeName: string): string {
  const source = readFileSync(MODEL_PATH, "utf8");
  const lines = source.split(/\r?\n/);
  const opener = `export type ${typeName} = {`;

  const openerLines = lines.flatMap((line, index) => (line === opener ? [index] : []));
  expect(
    openerLines,
    `expected exactly one line reading \`${opener}\` in ward-model.ts, found ${openerLines.length}. ` +
      `The declaration has been renamed, reformatted or moved — this pin cannot read it, and must ` +
      `not be taken to mean the type is unchanged.`,
  ).toHaveLength(1);

  const start = openerLines[0];
  // The type's own terminator is the next `};` at column zero; anything nested inside it is
  // indented, so an exact match cannot stop short.
  const end = lines.indexOf("};", start + 1);
  expect(
    end,
    `found \`${opener}\` at line ${start + 1} of ward-model.ts but no closing \`};\` at column zero ` +
      `after it — the block could not be delimited, so nothing below has been checked.`,
  ).toBeGreaterThan(start);

  return lines
    .slice(start + 1, end)
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

/** Matches `name:` or `name?:` as a declared key, never a mention of the word in prose. */
function declaresKey(body: string, name: string): boolean {
  return new RegExp(`^\\s*${name}\\??\\s*:`, "m").test(body);
}

describe("the suburb note, and the model fact that is the only reason it is true", () => {
  /*
   * Halves 1 and 3 rendered the full-page intake form, retired on 8 Oct 2026. The referral slide-out
   * (`referrals/ward-referral-drawer.tsx`) is now the one place a referral is written, so the note
   * on screen and the picker's honest "not known" answers must be pinned there, by its own suite.
   * Half 2 and the anchor below are model facts and stand unchanged.
   */

  it("the anchor finds exactly one `Referral` declaration, and it is the one the note is about", () => {
    const body = declarationBody(REFERRAL_TYPE_NAME);

    // Non-vacuity. If the key matcher could not match anything — a reformat that put every field on
    // one line, a stripping bug that ate the body — the `suburb` assertion below would report
    // "absent" for a block it never read, and half 2 would then fail for a reason that is not the
    // one it names. `homeRegion` is the control because it is the field the note used to end on
    // ("which holds a home region and nothing finer"), so it has always been read alongside this.
    expect(
      declaresKey(body, FIELD_THE_NOTE_NAMES),
      `the block extracted for \`${REFERRAL_TYPE_NAME}\` does not declare \`${FIELD_THE_NOTE_NAMES}\`. ` +
        `Either the wrong block was captured or the key matcher cannot match — either way the ` +
        `\`${FIELD_THE_NOTE_NOW_DEPENDS_ON}\` check below would be vacuous.`,
    ).toBe(true);
  });

  it("half 2 — `Referral` still carries the `suburb` key that is what makes the note on screen true", () => {
    const body = declarationBody(REFERRAL_TYPE_NAME);

    expect(
      declaresKey(body, FIELD_THE_NOTE_NOW_DEPENDS_ON),
      `\`${REFERRAL_TYPE_NAME}\` no longer declares \`${FIELD_THE_NOTE_NOW_DEPENDS_ON}\`, so the ` +
        `referral CANNOT hold a suburb. The referral form still tells clinicians it does — see the ` +
        `note at data-testid="${NOTE_TEST_ID}". Its recorded-suburb claim ` +
        `would now be false: a false reassurance that a clinician's answer was ` +
        `recorded when it was discarded. This pin has now fired in both directions; rewrite the ` +
        `note (and this test) rather than deleting either.`,
    ).toBe(true);
  });

  // Half 3's precondition, kept here so the constant the slide-out's picker must derive from can
  // never be emptied silently.
  it("`SUBURB_UNKNOWN_REASONS` still names at least one honest 'not known' answer", () => {
    expect(SUBURB_UNKNOWN_REASONS.length).toBeGreaterThan(0);
  });
});
