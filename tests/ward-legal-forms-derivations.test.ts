import { describe, expect, it } from "vitest";

import { elapsedLabel, isOpen } from "@/components/ward-management/ward-derivations";
import {
  isLegalDeadlineBreached,
  legalDeadlineText,
  legalFormBreakdown,
  legalFormGroupOf,
  legalFormGroupRows,
  legalFormHasClockConcept,
  legalFormOrdered,
  legalFormPopulation,
  legalFormRowClassification,
} from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardMovements } from "@/components/ward-management/ward-movements";

const NOW = NOW_ANCHOR;

/**
 * `wardMovements` is real seeded data — cloned rather than authored fresh, so a synthetic case
 * still carries every field `Movement` requires. Overrides below are the ONLY thing that makes
 * each synthetic case what it is; everything else comes from a real, open, legal-form-carrying
 * movement (`WF-001`), so a synthetic case cannot accidentally pass by being closed or voluntary.
 */
const templateMovement = wardMovements.find((movement) => movement.id === "WF-001");
if (!templateMovement) {
  throw new Error("WF-001 is not in the fixture any more — this test's synthetic template needs a new base");
}

function synthetic(overrides: Partial<Movement>): Movement {
  return { ...templateMovement, ...overrides } as Movement;
}

describe("legalFormPopulation (anti-vacuity floor)", () => {
  it("is non-empty on the real fixture, and contains both a structurally clockless form and a real dueAt", () => {
    const population = legalFormPopulation(wardMovements);
    expect(population.length).toBeGreaterThan(0);
    expect(population.some((movement) => movement.legalForm?.dueAt === undefined)).toBe(true);
    expect(population.some((movement) => movement.legalForm?.dueAt !== undefined)).toBe(true);
  });

  it("equals exactly the open movements that carry a legal form — nothing more, nothing fewer", () => {
    const expected = new Set(
      wardMovements
        .filter(isOpen)
        .filter((movement) => movement.legalForm !== undefined)
        .map((movement) => movement.id),
    );
    const actual = new Set(legalFormPopulation(wardMovements).map((movement) => movement.id));
    expect(actual).toEqual(expected);
  });

  it("never includes a closed movement, even one that carries a legal form", () => {
    const closedWithForm = synthetic({
      id: "WF-TEST-CLOSED",
      stage: "arrived",
      legalForm: { code: "3B", kind: "detention" },
    });
    expect(isOpen(closedWithForm)).toBe(false);
    const ids = legalFormPopulation([...wardMovements, closedWithForm]).map((movement) => movement.id);
    expect(ids).not.toContain("WF-TEST-CLOSED");
  });
});

describe("legalFormOrdered (sort order)", () => {
  const rows = legalFormOrdered(wardMovements, NOW);

  it("is the same set of movements as legalFormPopulation, just reordered", () => {
    const orderedIds = new Set(rows.map((movement) => movement.id));
    const populationIds = new Set(legalFormPopulation(wardMovements).map((movement) => movement.id));
    expect(orderedIds).toEqual(populationIds);
  });

  it("never lets a later row's key sort before an earlier row's key (passed deadlines first, then soonest, then none)", () => {
    function key(movement: Movement): number {
      const dueAt = movement.legalForm?.dueAt;
      return dueAt === undefined ? Infinity : dueAt - NOW;
    }
    for (let i = 1; i < rows.length; i++) {
      expect(
        key(rows[i]),
        `row ${i} (${rows[i].id}) sorted before row ${i - 1} (${rows[i - 1].id})`,
      ).toBeGreaterThanOrEqual(key(rows[i - 1]));
    }
  });

  it("breaks a tie (typically: several rows with no deadline recorded) by longest wait first", () => {
    function key(movement: Movement): number {
      const dueAt = movement.legalForm?.dueAt;
      return dueAt === undefined ? Infinity : dueAt - NOW;
    }
    for (let i = 1; i < rows.length; i++) {
      if (key(rows[i]) !== key(rows[i - 1])) continue;
      const waitedPrev = NOW - rows[i - 1].openedAt;
      const waitedCurr = NOW - rows[i].openedAt;
      expect(
        waitedCurr,
        `tied rows ${rows[i - 1].id} then ${rows[i].id} are not ordered by longest wait`,
      ).toBeLessThanOrEqual(waitedPrev);
    }
  });

  it("puts a synthetic breached deadline ahead of every real row (mutation target: `<` vs `<=`, ascending vs descending)", () => {
    const breached = synthetic({
      id: "WF-TEST-BREACHED",
      legalForm: { code: "4A", kind: "transport", dueAt: NOW - 500 },
    });
    const ordered = legalFormOrdered([...wardMovements, breached], NOW);
    expect(ordered[0].id).toBe("WF-TEST-BREACHED");
  });
});

describe("legalFormHasClockConcept", () => {
  it("is true only for transport (4A) and transfer (4C) kinds", () => {
    expect(legalFormHasClockConcept({ code: "4A", kind: "transport" })).toBe(true);
    expect(legalFormHasClockConcept({ code: "4C", kind: "transfer" })).toBe(true);
    expect(legalFormHasClockConcept({ code: "1A", kind: "examination" })).toBe(false);
    expect(legalFormHasClockConcept({ code: "3B", kind: "detention" })).toBe(false);
  });

  it("fails closed to false for an unclassified form (3D carries no `kind` at all)", () => {
    expect(legalFormHasClockConcept({ code: "3D" })).toBe(false);
  });
});

describe("isLegalDeadlineBreached", () => {
  it("is false for every form with no dueAt, never treating absence as a breach", () => {
    const noClock = synthetic({ id: "WF-TEST-NOCLOCK", legalForm: { code: "1A", kind: "examination" } });
    expect(isLegalDeadlineBreached(noClock, NOW)).toBe(false);
  });

  it("is true once the real fixture's own dueAt has passed, false one minute before", () => {
    const almostBreached = synthetic({ legalForm: { code: "4A", kind: "transport", dueAt: NOW + 1 } });
    const justBreached = synthetic({ legalForm: { code: "4A", kind: "transport", dueAt: NOW - 1 } });
    expect(isLegalDeadlineBreached(almostBreached, NOW)).toBe(false);
    expect(isLegalDeadlineBreached(justBreached, NOW)).toBe(true);
  });
});

describe("legalDeadlineText (byte-for-byte — the wording the build contract's §5 pins)", () => {
  it("states a real, upcoming deadline", () => {
    const movement = synthetic({ legalForm: { code: "4A", kind: "transport", dueAt: NOW + 90 } });
    expect(legalDeadlineText(movement, NOW)).toBe("Form expires in 1h 30m");
  });

  it("states a real, passed deadline", () => {
    const movement = synthetic({ legalForm: { code: "4C", kind: "transfer", dueAt: NOW - 45 } });
    expect(legalDeadlineText(movement, NOW)).toBe("Form expiry passed 45m ago");
  });

  it("uses the shortlist panel's exact wording for a structurally clockless form (1A, 3B, 3D), always paired with real elapsed time", () => {
    const oneA = synthetic({ legalForm: { code: "1A", kind: "examination" } });
    expect(legalDeadlineText(oneA, NOW)).toBe(
      `No deadline recorded; ${elapsedLabel(oneA, NOW)} in the emergency department`,
    );
    // Never the bare phrase alone — the build contract's central rule.
    expect(legalDeadlineText(oneA, NOW)).not.toBe("No deadline recorded");
  });

  /**
   * 🔴 THIS CASE IS REVERSED FROM WHAT IT ASSERTED, BY RULING — Ward Lead, 2026-09-12.
   *
   * It required a SECOND wording for a clock-bearing form (4A/4C) whose `dueAt` was merely
   * unrecorded, saying the form type "is usually given one". ⚠️ **That asserts what a form type
   * usually gets — a statutory-adjacent claim this prototype makes nowhere else — and its branch
   * is UNREACHABLE on today's seed, where every 4A and 4C carries a real deadline.** So it bought
   * nothing and carried a claim.
   *
   * ✅ **The distinction it was reaching for is now STRUCTURAL**: the screen groups by what the
   * record holds, so a reader sees the difference without the screen asserting anything. A design
   * that shows the difference beats a sentence that claims it, because a sentence can be edited
   * back and a group cannot be collapsed without the grouping test going red.
   *
   * So this now pins the opposite: ONE wording for an absent deadline, whatever the form's kind.
   */
  it("uses ONE wording for an absent deadline, whatever the form's kind, and asserts nothing about what a type usually gets", () => {
    const clockBearing = synthetic({ legalForm: { code: "4A", kind: "transport" } });
    const structural = synthetic({ legalForm: { code: "1A", kind: "examination" } });

    expect(legalDeadlineText(clockBearing, NOW)).toBe(
      `No deadline recorded; ${elapsedLabel(clockBearing, NOW)} in the emergency department`,
    );
    for (const movement of [clockBearing, structural]) {
      const text = legalDeadlineText(movement, NOW);
      expect(text, "an absent deadline is stated bare - it must be paired with real elapsed time").toMatch(
        /in the emergency department/,
      );
      expect(
        text,
        "the sentence asserts something about what a form type usually gets, or about statute. It may " +
          "report what THIS RECORD holds and nothing more.",
      ).not.toMatch(/usually|statutory|never carries|does not expire/i);
    }
  });

  it("throws rather than guessing for a movement with no legal form at all", () => {
    const noForm = synthetic({ legalForm: undefined });
    expect(() => legalDeadlineText(noForm, NOW)).toThrow();
  });
});

describe("the group split reads the record, never the form code", () => {
  /**
   * 🔴 THIS CASE EXISTS BECAUSE EIGHT CAREFULLY-WRITTEN ONES COULD NOT TELL THE DIFFERENCE, AND A
   * MUTATION PROVED IT. Carried across from lane C's own build at Ward Lead's instruction.
   *
   * Keying the split on the form CODE instead of the record — `code === "1A" || code === "3B" ?
   * undefined : dueAt` — left every case green. ⚠️ **Not because the assertions were weak, but
   * because the two readings COINCIDE in this fixture**: every seeded 1A and 3B genuinely has no
   * `dueAt`, so "what the record holds" and "what the code implies" return the same answer for
   * every row that exists.
   *
   * **A property whose two sides agree on every available case cannot discriminate, however
   * carefully it is written.** The remedy is not a stronger assertion — it is CONSTRUCTING the
   * specimen that separates them, which the seed does not contain.
   *
   * ⚠️ **This asserts nothing about whether a Form 1A SHOULD carry a deadline.** The owner's
   * instruction of 2026-08-23 is that it does not. It asserts where the code must READ that from:
   * the day the model gains such a record is the day a code-keyed split starts HIDING a real legal
   * deadline.
   *
   * 🔴 **DO NOT "SIMPLIFY" THIS CASE. It is the ONLY one in this codebase that can separate a
   * record-keyed split from a code-keyed one.** It looks like a duplicate of the cases around it
   * because it asserts the same shape of thing — and it is not, because every OTHER case runs
   * against seeded rows where the two readings agree, and therefore passes under both. Delete this
   * and the distinction becomes untestable while the suite stays green, which is the exact state
   * it was written to end.
   */
  it("puts a Form 1A that DOES carry a deadline in the with-deadline group", () => {
    const specimen = synthetic({ legalForm: { code: "1A", kind: "examination", dueAt: NOW + 45 } });

    expect(legalFormGroupOf(specimen), "grouped by the form code rather than by the record").toBe("with-deadline");
    expect(
      legalFormGroupRows([specimen], NOW, "with-deadline").map((movement) => movement.id),
      "a Form 1A carrying a real deadline was filed as having none - the split is reading the form code " +
        "rather than the record, and would hide a genuine legal deadline the day one exists",
    ).toEqual([specimen.id]);
    expect(legalFormGroupRows([specimen], NOW, "no-deadline"), "the specimen appears in both groups").toEqual([]);
  });

  it("puts a 4A with no recorded deadline in the no-deadline group, by the same rule", () => {
    const specimen = synthetic({ legalForm: { code: "4A", kind: "transport" } });
    expect(legalFormGroupOf(specimen)).toBe("no-deadline");
  });
});

describe("legalFormRowClassification (the visibly-different-row requirement)", () => {
  it("gives a breached deadline danger tone and a naming chip", () => {
    const movement = synthetic({ legalForm: { code: "4C", kind: "transfer", dueAt: NOW - 10 } });
    const classification = legalFormRowClassification(movement, NOW);
    expect(classification.tone).toBe("danger");
    expect(classification.chip).toEqual({ level: "urgent", text: "Form expiry passed" });
    expect(classification.reasonLevel).toBe("danger");
  });

  it("gives an unrecorded clock-bearing gap warning tone and a DIFFERENT chip from a breach", () => {
    const movement = synthetic({ legalForm: { code: "4A", kind: "transport" } });
    const classification = legalFormRowClassification(movement, NOW);
    expect(classification.tone).toBe("warning");
    expect(classification.chip).toEqual({ level: "stalled", text: "No deadline recorded" });
    // ⚠️ The chip may not say anything about the TYPE. This branch fires only for 4A/4C, which DO
    // normally carry a deadline, so a claim about the type here states the opposite of the truth.
    expect(classification.chip?.text, "the chip asserts something about the form type").not.toMatch(
      /form type|usually|statutory/i,
    );
    expect(classification.chip?.text).not.toBe("Form expiry passed");
  });

  it("gives a structurally clockless form neutral tone and NO chip — the only case WardRecordRow allows one", () => {
    const movement = synthetic({ legalForm: { code: "1A", kind: "examination" } });
    const classification = legalFormRowClassification(movement, NOW);
    expect(classification.tone).toBe("neutral");
    expect(classification.chip).toBeUndefined();
    expect(classification.reasonLevel).toBe("ok");
  });

  it("gives a real, not-yet-due deadline neutral tone and no chip too — only a breach or a gap earns one", () => {
    const movement = synthetic({ legalForm: { code: "4A", kind: "transport", dueAt: NOW + 500 } });
    const classification = legalFormRowClassification(movement, NOW);
    expect(classification.tone).toBe("neutral");
    expect(classification.chip).toBeUndefined();
  });
});

describe("legalFormBreakdown (cannot disagree structurally with the rows it describes)", () => {
  const rows = legalFormOrdered(wardMovements, NOW);
  const breakdown = legalFormBreakdown(rows, NOW);

  it("is non-empty on the real fixture (anti-vacuity floor)", () => {
    expect(breakdown.length).toBeGreaterThan(0);
  });

  it("sums its open counts back to exactly the row count it was given", () => {
    const total = breakdown.reduce((sum, form) => sum + form.openCount, 0);
    expect(total).toBe(rows.length);
  });

  it("gives each form's open and breached counts that agree with counting the same rows directly", () => {
    for (const form of breakdown) {
      const matching = rows.filter((movement) => movement.legalForm?.code === form.code);
      expect(form.openCount, `openCount for ${form.code}`).toBe(matching.length);
      expect(form.breachedCount, `breachedCount for ${form.code}`).toBe(
        matching.filter((movement) => isLegalDeadlineBreached(movement, NOW)).length,
      );
      expect(form.name).toBe(legalFormName(matching[0].legalForm!));
    }
  });
});
