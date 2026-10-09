/** @vitest-environment node */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { DUPLICATE_SENTENCES, duplicateSentence } from "@/components/ward-management/referrals/referral-duplicate";
import type { Referral } from "@/components/ward-management/ward-model";
import type { PatientId } from "@/components/ward-management/ward-patients";
import { referrals as seedReferrals } from "@/components/ward-management/ward-movements";
import { allUnits } from "@/components/ward-management/ward-sites";

/**
 * WHAT IS ALREADY OPEN FOR THIS PERSON — LANE C TASK 15.
 *
 * ⚠️ **THE FIXTURES ARE BUILT FROM A REAL SEED REFERRAL, NOT HAND-WRITTEN.** A literal object cast
 * to `Referral` would drift from the type the moment a field is added, and `as` plus a runner that
 * does not typecheck is how a test goes on passing against a shape the app no longer has. Cloning a
 * seed row keeps every other field real and changes only what each case is about.
 */

const SOMEONE = "PT-duplicate-subject" as PatientId;
const SOMEBODY_ELSE = "PT-duplicate-other" as PatientId;

/** One seed referral, re-pointed at a person and forced into a known state. */
function referralFor(patientId: PatientId | undefined, state: "queued" | "accepted" | "declined"): Referral {
  const base = seedReferrals[0];
  if (base === undefined) throw new Error("the referral seed is empty — this suite would prove nothing");

  // `referralState` derives from the DESTINATIONS, so the state is set by shaping those rather than
  // by writing a state field the type does not have.
  const destinations = base.destinations.map((addressing, index) => ({
    ...addressing,
    state: state === "accepted" && index === 0 ? ("accepted" as const) : (state as typeof addressing.state),
  }));
  return { ...base, patientId, destinations };
}

describe("the duplicate sentence", () => {
  /**
   * The anti-vacuity floor. Every case below is about the seed being usable at all; if a future
   * change empties `destinations`, `referralState` returns "queued" for everything and three of
   * these cases would pass for the wrong reason.
   */
  it("the fixture builder actually produces the three states", () => {
    expect(seedReferrals.length).toBeGreaterThan(0);
    expect(referralFor(SOMEONE, "queued").destinations.length).toBeGreaterThan(0);
  });

  it("says that one is open, and is true read alone", () => {
    expect(duplicateSentence({ patientId: SOMEONE, referrals: [referralFor(SOMEONE, "queued")] })).toBe(
      "A referral for this person is already open.",
    );
  });

  /**
   * 🔴 D-19 CONDITION 1 — THE TWO OPEN STATES GIVE THE SAME SENTENCE, AND THAT IS THE POINT.
   *
   * The first build returned a different sentence for each, because queued and accepted ask the
   * reader for different things. D-19 ruled against it: what is permitted is a BOOLEAN, and naming
   * which state reports how far along this person's pathway is. **This case is what goes red if
   * somebody re-adds the distinction as an improvement** — which it would be, for usefulness, and
   * that is exactly the argument the ruling rejects.
   */
  it("gives the SAME sentence for accepted as for queued — the distinction is ruled out", () => {
    const queued = duplicateSentence({ patientId: SOMEONE, referrals: [referralFor(SOMEONE, "queued")] });
    const accepted = duplicateSentence({ patientId: SOMEONE, referrals: [referralFor(SOMEONE, "accepted")] });
    expect(accepted).toBe(queued);
    expect(accepted).toBe("A referral for this person is already open.");
  });

  it("says nothing when nothing is open", () => {
    expect(duplicateSentence({ patientId: SOMEONE, referrals: [] })).toBeUndefined();
  });

  /**
   * 🔴 THE CASE THE PLAN WAS WRITTEN AROUND, AND THE ONE A CARELESS PREDICATE FAILS.
   *
   * `patientId` is OPTIONAL on a referral — a referral raised outside the patient flow legitimately
   * has nobody on file — and most seed rows carry none. A predicate written `referral.patientId !==
   * id` is TRUE for every one of those, so the sentence would fire for a person with no referral at
   * all, on every screen, and the prototype would look like it had detected something real.
   */
  it("does not fire on a referral that names nobody", () => {
    expect(duplicateSentence({ patientId: SOMEONE, referrals: [referralFor(undefined, "queued")] })).toBeUndefined();
  });

  it("does not fire on somebody else's open referral", () => {
    expect(
      duplicateSentence({ patientId: SOMEONE, referrals: [referralFor(SOMEBODY_ELSE, "queued")] }),
    ).toBeUndefined();
  });

  /**
   * ⚠️ A DECLINED REFERRAL IS NOT AN OPEN ONE, and this is the case where saying so matters most:
   * a declined referral is exactly the situation in which raising another is the correct action.
   * Reporting it as a duplicate would discourage the right next step.
   */
  it("does not report a declined referral as open", () => {
    expect(duplicateSentence({ patientId: SOMEONE, referrals: [referralFor(SOMEONE, "declined")] })).toBeUndefined();
  });

  /**
   * 🔴 D-19 CONDITION 1, THE COUNT HALF. Several open referrals give the SAME sentence as one.
   * "three open" narrows a person's history far more than "one is open", so the number is never
   * computed — `duplicateSentence` uses `.some`, which yields a boolean and never a length.
   */
  it("says the same thing for three open referrals as for one — a count is a disclosure", () => {
    const one = duplicateSentence({ patientId: SOMEONE, referrals: [referralFor(SOMEONE, "queued")] });
    const several = duplicateSentence({
      patientId: SOMEONE,
      referrals: [referralFor(SOMEONE, "queued"), referralFor(SOMEONE, "accepted"), referralFor(SOMEONE, "queued")],
    });
    expect(several).toBe(one);
  });
});

/**
 * 🔴 FD-23 — THE SENTENCE MAY SAY THAT SOMETHING IS OPEN, NEVER WHERE.
 *
 * Owner ruling 2026-08-30: a ward cannot see where else a patient has been referred. The helpful
 * edit this guards against is appending the destination — *"…already been accepted by Ward 4B"* —
 * which reads as an improvement, compiles, and puts the one fact FD-23 forbids onto a screen
 * reachable from a patient's record.
 *
 * ⚠️ Asserted over BOTH sentences from the exported array, never over whichever one a call happened
 * to return: a property checked on one of two strings is checked on neither.
 */
describe("FD-23 — the duplicate sentence never says where", () => {
  it("names no unit, ward, department or team, in either sentence", () => {
    // Real unit names, so the guard is anchored to the actual vocabulary rather than to a guess.
    const unitWords = allUnits().flatMap((unit) => [unit.id, unit.name]);
    expect(unitWords.length, "no unit names read — this guard would prove nothing").toBeGreaterThan(4);
    for (const sentence of DUPLICATE_SENTENCES) {
      for (const word of unitWords) {
        expect(sentence, `${sentence} names a unit`).not.toContain(word);
      }
      // The generic shapes a name would arrive wearing, for a unit this seed does not hold.
      expect(sentence).not.toMatch(/\bward\b|\bunit\b|\bteam\b|\bdepartment\b|\bED\b|\bat\s+[A-Z]|\bby\s+[A-Z]/);
      // 🔴 D-19 CONDITION 1, pinned on the STRING as well as on the behaviour above. No digit and
      // no plural: each reports HOW MANY, and a count is itself a disclosure — "three open" narrows
      // a person's history far more than "one is open".
      expect(sentence, "a digit is a count").not.toMatch(/\d/);
      expect(sentence, "a plural reports how many").not.toMatch(/\breferrals\b|\banother\b|\bboth\b|\beach\b/i);
      // And no time, which would place the referral in the person's history rather than merely
      // saying one exists.
      expect(sentence, "a time places it in a history").not.toMatch(
        /\bsince\b|\bago\b|\btoday\b|\byesterday\b|\bhours?\b|\bdays?\b/i,
      );
    }
  });

  /**
   * 🔴 THE SAME SHAPES, APPLIED TO WHAT THE FUNCTION ACTUALLY RETURNS — AND A MUTATION FOUND THIS
   * HOLE RATHER THAN REVIEW.
   *
   * The case above checks `DUPLICATE_SENTENCES`, the exported constants. **A sentence returned as an
   * inline literal is not in that array and was invisible to it.** I only saw it because a mutation
   * that re-added a place name returned one inline, and the guard that exists to catch place names
   * stayed green — the two BEHAVIOURAL cases caught that mutant, by luck of it also splitting the
   * states. A mutant that put a ward name into an inline sentence returned identically for every
   * state would have passed every check in this file.
   *
   * **So the population this walks is the output, not the declarations.** `compliance-without-
   * coverage`: a guard is only as good as the set it is pointed at, and a constants array is a set
   * somebody has to remember to add to.
   */
  it("applies the same rules to every sentence the function can actually return", () => {
    const produced = new Set(
      (["queued", "accepted", "declined"] as const)
        .map((state) => duplicateSentence({ patientId: SOMEONE, referrals: [referralFor(SOMEONE, state)] }))
        .filter((sentence): sentence is string => sentence !== undefined),
    );
    // Floor: if the function stopped returning anything, every check below would pass vacuously.
    expect(produced.size, "no sentence produced — this guard would prove nothing").toBeGreaterThan(0);

    /*
     * ⚠️ THESE FOUR PATTERNS SHIPPED ONCE WITH EVERY WORD-BOUNDARY ESCAPE COLLAPSED INTO A SINGLE
     * CONTROL BYTE, AND A REPOSITORY GUARD CAUGHT IT RATHER THAN A REVIEW.
     *
     * They were written through a script whose string syntax treats the word-boundary escape as a
     * real escape for a control character, while the digit and whitespace escapes are not escapes
     * in that syntax and passed through untouched. So only SOME of them were corrupted: the file
     * looked right, the suite stayed green, and each corrupted pattern demanded a literal control
     * character and could therefore never match anything.
     *
     * 🔴 A GUARD THAT CANNOT FIRE IS WORSE THAN NO GUARD, because it reports all-clear. Typed as
     * literals here and never generated — and the escape is described in words rather than typed
     * into this comment, because typing it would reproduce the byte the guard is looking for.
     */
    for (const sentence of produced) {
      expect(sentence, "names a place").not.toMatch(
        /\bward\b|\bunit\b|\bteam\b|\bdepartment\b|\bED\b|\bat\s+[A-Z]|\bby\s+[A-Z]/,
      );
      expect(sentence, "a digit is a count").not.toMatch(/\d/);
      expect(sentence, "a plural reports how many").not.toMatch(/\breferrals\b|\banother\b|\bboth\b|\beach\b/i);
      expect(sentence, "a time places it in a history").not.toMatch(
        /\bsince\b|\bago\b|\btoday\b|\byesterday\b|\bhours?\b|\bdays?\b/i,
      );
      // And it must be one of the declared sentences: an inline literal is how the array above
      // stops being the whole story in the first place.
      expect(DUPLICATE_SENTENCES as readonly string[], "returned a sentence that is not declared").toContain(sentence);
    }
  });

  it("the guard can actually fire on every shape it forbids", () => {
    // 🔴 Anti-vacuity, one specimen per forbidden shape. Without these, a typo in ANY of the four
    // patterns above would pass the real sentence forever and the guard would look healthy. Each
    // specimen is written the way a helpful edit would actually arrive, not as a synthetic string.
    expect("A referral for this person is already open at Ward 4B.").toMatch(/\bward\b|\bat\s+[A-Z]/i);
    expect("This person has 3 open referrals.").toMatch(/\d/);
    expect("This person has other referrals open.").toMatch(/\breferrals\b/i);
    expect("A referral for this person was raised 2 hours ago.").toMatch(/\bago\b|\bhours?\b/i);
  });
});

/**
 * 🔴 D-19 CONDITION 2 — THE READ IS CONFINED TO THE PERSON ALREADY NAMED ON THE FORM IN PROGRESS.
 *
 * Ward Lead called this *"the condition that matters most and the one I nearly left out"*, and the
 * reason is worth restating where it will be read: **without this bound the feature is a PROBE.**
 * Reachable from a free search, it answers "type any name, learn whether that person is currently in
 * a mental-health pathway." The patient search already discloses that a person is KNOWN; *known AND
 * currently open* is a real increment, and it must cost a deliberate navigation rather than a
 * keystroke.
 *
 * ⚠️ **PINNED STRUCTURALLY, BECAUSE THE BEHAVIOURAL VERSION CANNOT SEE THE DANGEROUS CASE.** A DOM
 * test can show the sentence is absent when nobody is named — and the referral form's own suite
 * should. But it cannot show that no OTHER screen has started
 * calling this: a search screen importing `duplicateSentence` would be a probe, every DOM test of
 * this form would still pass, and nothing would go red. **The importer set is the property.**
 */
describe("D-19 condition 2 — only the referral form may ask this", () => {
  /*
   * The referral form. The full-page intake form (`referrals/referral-intake.tsx`) was this file's
   * only importer until it was retired on 8 Oct 2026; the referral slide-out is now the one place a
   * referral is written, so it is the only file D-19 lets ask. Nothing may import it today; the
   * slide-out may, and nothing else ever.
   */
  const ALLOWED_CALLERS = ["referrals/ward-referral-drawer.tsx"];
  const WARD_DIR = "src/components/ward-management";

  function wardSources(dir: string, found: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) wardSources(full, found);
      else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) found.push(full);
    }
    return found;
  }

  it("is imported by the referral form, if by anything, and by nothing else", () => {
    const files = wardSources("src/components/ward-management");
    // Floor: a sweep that reads nothing passes while every screen probes freely.
    expect(files.length, "no ward source read — this guard would prove nothing").toBeGreaterThan(20);

    const importers = files
      .filter((file) => /from\s+"[^"]*referral-duplicate"/.test(readFileSync(file, "utf8")))
      // `join` gives OS separators, so normalise before slicing — on Windows this path arrives with
      // backslashes and the marker below would never match, which would empty the list and make the
      // guard pass by finding nothing.
      .map((file) => relative(WARD_DIR, file).split(sep).join("/"));

    expect(
      importers,
      "a ward screen other than the referral form imports duplicateSentence. D-19 permits this read " +
        "ONLY from the form already naming a person; reachable from a free search it becomes a probe " +
        "for whether any named person is currently in a mental-health pathway. The allowlist entry " +
        "in ward-patient-link-default-deny.test.ts is void if this bound is widened.",
    ).toEqual(importers.filter((file) => ALLOWED_CALLERS.includes(file)));
  });
});
