// tests/ward-capacity-derivations.test.ts
//
// The merged Capacity screen (MERGE 02) answers "where is the mismatch" in aggregate — never
// "where could this person go". These tests assert that shape directly (a source scan for the
// per-patient surface it must never import) alongside the arithmetic, because a helper that quietly
// grew a per-patient branch would still pass every numeric assertion below.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  countCellText,
  freeingCellText,
  bedKindGaps,
  bedKindTotals,
  networkTotals,
  networkWardRows,
  releasesBeyondToday,
  type BedKindId,
} from "@/components/ward-management/capacity/capacity-derivations";
import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { lockedBedsFree, openBedsFree } from "@/components/ward-management/ward-bed-designation";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";
import { bedIsOccupied, type Admission } from "@/components/ward-management/ward-admissions";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import type { BedRelease, Cohort, Security } from "@/components/ward-management/ward-model";

const NOW = NOW_ANCHOR;

/** A minimal release fixture, mirroring `ward-bed-availability.test.ts`'s own factory so the two
 *  suites cannot silently drift on what a "normal" release looks like. */
function release(unitId: string, overrides: Partial<BedRelease>): BedRelease {
  return {
    id: "WR-CAP-T01",
    unitId,
    admissionId: "AD-TEST-01",
    state: "confirmed",
    expectedAt: NOW_ANCHOR,
    waitingOn: null,
    blocker: null,
    blockedBy: null,
    preparing: false,
    preparationNote: null,
    confirmedAt: NOW_ANCHOR,
    confirmedBy: "NUM Test Unit",
    ...overrides,
  };
}

/** A release carrying the blocked flag, with the role that recorded it — the two always move
 *  together, same discipline `ward-bed-availability.test.ts`'s own `blockedRelease` holds to. */
function blockedRelease(unitId: string, overrides: Partial<BedRelease>): BedRelease {
  return release(unitId, { blocker: BED_RELEASE_BLOCKERS[0], blockedBy: "NUM Test Unit", ...overrides });
}

/** Independent of `bedKindOfMovement` in the module under test — re-derives the mapping from the
 *  real `Cohort`/`Security` values so a bug shared between the module and this test cannot hide. */
function expectedKind(cohort: Cohort, security: Security): BedKindId {
  if (cohort === "Older adult") return "older_adult";
  if (cohort === "Youth") return "youth";
  return security === "Secure" ? "locked_adult" : "open_adult";
}

describe("bedKindGaps", () => {
  const units = allUnits();
  const open = wardMovements.filter(isOpen);

  it("walks a non-empty population of open movements and units, or every assertion below is vacuous", () => {
    expect(open.length, "no open movement in the fixture").toBeGreaterThan(0);
    expect(units.length, "no unit in the fixture").toBeGreaterThan(0);
  });

  it("returns exactly the four bed kinds, in the locked order", () => {
    const rows = bedKindGaps(wardMovements, units, NOW);
    expect(rows.map((row) => row.id)).toEqual(["locked_adult", "open_adult", "older_adult", "youth"]);
  });

  it("counts `waiting` as open movements of that kind, matching an independently derived mapping", () => {
    const rows = bedKindGaps(wardMovements, units, NOW);
    for (const row of rows) {
      const expected = open.filter((movement) => expectedKind(movement.cohort, movement.security) === row.id).length;
      expect(row.waiting, row.id).toBe(expected);
    }
  });

  it("never counts a closed movement", () => {
    const closed = wardMovements.filter((movement) => !isOpen(movement));
    expect(closed.length, "the fixture has no closed movement to prove exclusion with").toBeGreaterThan(0);

    const rows = bedKindGaps(wardMovements, units, NOW);
    const totalWaiting = rows.reduce((sum, row) => sum + row.waiting, 0);
    // Every open movement lands in exactly one kind (the mapping above is total), so the sum of
    // `waiting` across all four rows must equal the open count exactly — not merely be no larger.
    expect(totalWaiting).toBe(open.length);
  });

  it("sums `bedsThatFit` from the real locked/open free-bed split, per cohort", () => {
    const rows = bedKindGaps(wardMovements, units, NOW);
    const byId = new Map(rows.map((row) => [row.id, row]));

    const adultUnits = units.filter((unit) => unit.cohort === "Adult");
    const olderAdultUnits = units.filter((unit) => unit.cohort === "Older adult");
    const youthUnits = units.filter((unit) => unit.cohort === "Youth");
    expect(adultUnits.length, "no Adult-cohort unit in the fixture").toBeGreaterThan(0);
    expect(olderAdultUnits.length, "no Older-adult-cohort unit in the fixture").toBeGreaterThan(0);
    expect(youthUnits.length, "no Youth-cohort unit in the fixture").toBeGreaterThan(0);

    expect(byId.get("locked_adult")?.bedsThatFit).toBe(adultUnits.reduce((sum, unit) => sum + lockedBedsFree(unit), 0));
    expect(byId.get("open_adult")?.bedsThatFit).toBe(adultUnits.reduce((sum, unit) => sum + openBedsFree(unit), 0));
    expect(byId.get("older_adult")?.bedsThatFit).toBe(
      olderAdultUnits.reduce((sum, unit) => sum + lockedBedsFree(unit) + openBedsFree(unit), 0),
    );
    expect(byId.get("youth")?.bedsThatFit).toBe(
      youthUnits.reduce((sum, unit) => sum + lockedBedsFree(unit) + openBedsFree(unit), 0),
    );
  });

  it("sets gap to bedsThatFit minus waiting, on every row", () => {
    const rows = bedKindGaps(wardMovements, units, NOW);
    for (const row of rows) {
      expect(row.gap, row.id).toBe(row.bedsThatFit - row.waiting);
    }
  });

  /**
   * 🔴 Design lock §5.7 / `tests/ward-locked-not-authorised.test.ts`: a locked ward and a ward
   * that may lawfully detain are different facts. This screen must count an unauthorised locked
   * unit's locked beds as locked beds — the kind is about doors, not statute — so a shortfall does
   * not quietly hide behind a bed nobody may actually place a detained patient in.
   */
  it("counts a locked-but-unauthorised unit's locked beds toward locked_adult, never filtering on authorised", () => {
    const lockedUnauthorisedAdultUnits = units.filter(
      (unit) => unit.cohort === "Adult" && lockedBedsFree(unit) > 0 && !unit.authorised,
    );
    expect(
      lockedUnauthorisedAdultUnits.length,
      "the fixture carries no locked-but-unauthorised Adult unit with a free locked bed — this test would " +
        "otherwise be vacuous. See tests/ward-locked-not-authorised.test.ts for the unit the fixture uses.",
    ).toBeGreaterThan(0);

    const withoutFiltering = units.reduce(
      (sum, unit) => (unit.cohort === "Adult" ? sum + lockedBedsFree(unit) : sum),
      0,
    );
    const rows = bedKindGaps(wardMovements, units, NOW);
    expect(rows.find((row) => row.id === "locked_adult")?.bedsThatFit).toBe(withoutFiltering);
  });

  it("never returns a negative bedsThatFit — the underlying functions are already clamped at zero", () => {
    for (const row of bedKindGaps(wardMovements, units, NOW)) {
      expect(row.bedsThatFit, row.id).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("bedKindTotals", () => {
  it("sums the rows rather than recomputing independently", () => {
    const rows = bedKindGaps(wardMovements, allUnits(), NOW);
    const totals = bedKindTotals(rows);
    expect(totals).toEqual({
      waiting: rows.reduce((sum, row) => sum + row.waiting, 0),
      bedsThatFit: rows.reduce((sum, row) => sum + row.bedsThatFit, 0),
      gap: rows.reduce((sum, row) => sum + row.gap, 0),
    });
  });

  it("keeps gap consistent with bedsThatFit minus waiting at the total level too", () => {
    const rows = bedKindGaps(wardMovements, allUnits(), NOW);
    const totals = bedKindTotals(rows);
    expect(totals.gap).toBe(totals.bedsThatFit - totals.waiting);
  });
});

describe("networkWardRows", () => {
  const units = allUnits();

  it("returns exactly one row per unit, in the same order", () => {
    const rows = networkWardRows(units, NOW);
    expect(rows.length).toBe(units.length);
    expect(rows.map((row) => row.unit.id)).toEqual(units.map((unit) => unit.id));
  });

  it("computes ready and lockedReady from the real locked/open free-bed split", () => {
    for (const row of networkWardRows(units, NOW)) {
      expect(row.ready, row.unit.id).toBe(lockedBedsFree(row.unit) + openBedsFree(row.unit));
      expect(row.lockedReady, row.unit.id).toBe(lockedBedsFree(row.unit));
      expect(row.lockedReady, row.unit.id).toBeLessThanOrEqual(row.ready);
    }
  });

  it("reads confirmedAt from the ward's own allocatable figure, not the feed's empty count", () => {
    for (const row of networkWardRows(units, NOW)) {
      expect(row.confirmedAt, row.unit.id).toBe(row.unit.allocatable.confirmedAt);
    }
  });

  /**
   * ⚠️ HONESTY GUARD, NOT A PLACEHOLDER. "Expected to free today" needs a `BedRelease[]` list —
   * reducer state, not a fact on `Unit` — and this function's fixed signature takes only `units`
   * and `now`. There is no honest number to put here, so this pins `undefined` rather than letting
   * a future edit quietly start returning `0` (a specific, false "nothing is freeing" claim) to
   * satisfy a type. See the field's own doc comment in capacity-derivations.ts.
   */
  it("leaves freeing undefined rather than fabricating a count it has no data for", () => {
    for (const row of networkWardRows(units, NOW)) {
      expect(row.freeing, row.unit.id).toBeUndefined();
    }
  });

  /**
   * WLQ-10, owner ruling 2026-09-15: a discharge held up for several days keeps counting in its
   * ward's held-up figure, and the screen says since when. Measured directly (see
   * `releasesBeyondToday`'s own corrected comment) that `blockedToday` — what `row.blocked` reads —
   * already kept counting a stale blocked release; the defect was a SEPARATE, page-level figure
   * (`releasesBeyondToday`) falsely claiming the same release was excluded. These two cases pin the
   * population `row.blocked`/`row.oldestBlockedSince` must have, so a future change cannot narrow
   * either back toward "today only" without going red here.
   */
  it("keeps a discharge held up since two days ago in its ward's blocked figure, and names since when", () => {
    const unit = units[0];
    const stale = blockedRelease(unit.id, { id: "WR-STALE", expectedAt: NOW - 2 * MINUTES_PER_DAY });
    const rows = networkWardRows(units, NOW, [stale]);
    const row = rows.find((candidate) => candidate.unit.id === unit.id)!;

    expect(row.blocked, "a discharge still held up must still count, however long ago it was expected").toBe(1);
    expect(row.oldestBlockedSince, "the screen must be able to say since when this release was blocked").toBe(
      stale.expectedAt,
    );
    // And it must not ALSO be reported as excluded — a release counted once must never be excluded
    // from the same screen's own figures, which is the false pair this ruling exists to prevent.
    expect(row.excludedBeyondToday).toBe(0);
  });

  it("drops oldestBlockedSince once a release is no longer held up, and takes the EARLIEST of several", () => {
    const unit = units[0];
    const noLongerBlocked = release(unit.id, { id: "WR-CLEAR", blocker: null, expectedAt: NOW - MINUTES_PER_DAY });
    const oldest = blockedRelease(unit.id, { id: "WR-OLDEST", expectedAt: NOW - 3 * MINUTES_PER_DAY });
    const newer = blockedRelease(unit.id, { id: "WR-NEWER", expectedAt: NOW - 1 * MINUTES_PER_DAY });

    const clearOnly = networkWardRows(units, NOW, [noLongerBlocked]).find(
      (candidate) => candidate.unit.id === unit.id,
    )!;
    expect(clearOnly.blocked, "a release with no blocker is not held up").toBe(0);
    expect(clearOnly.oldestBlockedSince, "nothing is held up, so there is no since-when to state").toBeUndefined();

    const bothBlocked = networkWardRows(units, NOW, [oldest, newer]).find(
      (candidate) => candidate.unit.id === unit.id,
    )!;
    expect(bothBlocked.blocked).toBe(2);
    expect(bothBlocked.oldestBlockedSince, "the OLDEST blocked release sets since-when, not the newest").toBe(
      oldest.expectedAt,
    );
  });
});

/**
 * WLQ-10, owner ruling 2026-09-15. `releasesBeyondToday` used to flag any release whose day
 * differed from today's AT ALL, which wrongly caught a still-blocked release from days ago as
 * "excluded from today's figures" — a false claim, since `capacityBreakdown`/`networkWardRows`
 * never excluded it. Corrected to agree with `releaseBand`, the same line `capacityBreakdown` and
 * `groupDischarges` (`discharge-board.tsx`) already draw.
 */
describe("releasesBeyondToday", () => {
  const unit = allUnits()[0];

  it("no longer counts a discharge that is still held up from days ago", () => {
    const stale = blockedRelease(unit.id, { expectedAt: NOW - 2 * MINUTES_PER_DAY });
    expect(
      releasesBeyondToday([stale], NOW),
      "a release still counted in this ward's blocked figure must not also be reported as excluded",
    ).toBe(0);
  });

  it("still counts a release genuinely beyond tomorrow", () => {
    const farFuture = release(unit.id, { expectedAt: NOW + 2 * MINUTES_PER_DAY });
    expect(releasesBeyondToday([farFuture], NOW)).toBe(1);
  });

  it("does not count a release expected tomorrow — tomorrow is its own band, not beyond today", () => {
    const tomorrow = release(unit.id, { expectedAt: NOW + MINUTES_PER_DAY });
    expect(releasesBeyondToday([tomorrow], NOW)).toBe(0);
  });

  it("never counts a discharged release, whatever its expected day was", () => {
    const discharged = release(unit.id, { state: "discharged", expectedAt: NOW - 5 * MINUTES_PER_DAY });
    expect(releasesBeyondToday([discharged], NOW)).toBe(0);
  });
});

/**
 * ⚠️ THIS SUITE EXISTS BECAUSE THE SCREEN CANNOT REACH THE ABSENCE BRANCH. `CapacityScreen` reads
 * `bedReleases` from `useWardFlow()`, typed `BedRelease[]` and never `undefined`, so
 * `networkWardRows` always gets releases and every row comes back with a real number — measured
 * 2026-09-05 on the live fixture: 23 rows, 0 untracked. The DOM test's untracked arm therefore
 * never runs, and until now the only thing standing behind it was a `/not tracked/i` match on
 * copy. Here both answers are directly constructible, so the property is proved rather than
 * assumed.
 *
 * 🔴 **THE PROPERTY, NOT THE PHRASE.** The owner is redesigning many pages, and a guard that goes
 * red when "Not tracked here" becomes "No figure recorded" is one somebody deletes — taking the
 * honest guards with it in the same tidy-up. What must survive any rewording is that the absence
 * reads as a SENTENCE and never as a FIGURE, because the two fabrications the field's own doc
 * comment names are the literal word "undefined" and a false "0".
 *
 * ⚠️ AND NOT A BAN ON DIGITS, which is the over-broad version of the same idea and would forbid the
 * correct fix. "Not reported by this ward (see the discharge board)" is honest and may one day
 * carry a numeral; what is forbidden is text that READS as the figure itself.
 */
describe("freeingCellText", () => {
  /**
   * 🔴 **RE-POINTED 2026-09-06: THE OWNER RULED THAT A KNOWN ZERO IS THE WORD "none" (census §8).**
   * This case was called *"including a measured zero"* and required `freeingCellText(0) === "0"` —
   * the exact claim the ruling reverses. **It is re-pointed, not weakened and not deleted:** the
   * property it protects is untouched and is asserted below.
   *
   * ⚠️ **THE PROPERTY WAS NEVER "a zero prints as a digit". It was "`0` and `undefined` must stay
   * distinguishable".** Those are two different statements, and only the second one matters: `0` is
   * a ward reporting none, `undefined` is a ward not reporting. A `?? 0` anywhere on this path
   * collapses the second into the first, which is the false claim with the most confidence behind
   * it. **Spelling the known zero as a word keeps them further apart, not closer** — "none" and
   * "Not tracked here" cannot be confused for one another, where "0" and a blank can.
   */
  it("keeps a reported zero and an unreported figure distinguishable, and states the zero in words", () => {
    expect(freeingCellText(0), "a known zero must read as the ward's answer, not as a digit").toBe("none");
    for (const value of [1, 3, 12, 100]) {
      expect(freeingCellText(value)).toBe(String(value));
    }
    // The two must never converge — this is the property the old case existed for.
    expect(freeingCellText(0)).not.toBe(freeingCellText(undefined));
  });

  /**
   * 🔴 **THE DEFERRAL ITSELF, AND WITHOUT THIS NOTHING ASSERTS IT.** `countCellText` is the single
   * place this screen decides how a count is spelled, and `Ready`, `Locked` and `freeingCellText`
   * all route through it so the three columns cannot disagree. **That structural guarantee was
   * asserted by zero test files** until this case existed.
   *
   * ⚠️ **PROVEN AS A FAILURE, NOT SUSPECTED.** Un-wiring `freeingCellText` from `countCellText` and
   * hardcoding the word — `freeing === 0 ? "none" : String(freeing)` — left `Ready` and `Locked`
   * deferring while `freeing` no longer did, and **55 tests across four files stayed green**
   * (`scripts/ward-flow/mutation-run.mjs`, mutant SURVIVED). The behaviour is identical today; the
   * guarantee is gone, and the three columns are one edit from disagreeing again by exactly the
   * mechanism that produced `none · 0 · 0` — three copies of one rule with only one updated.
   *
   * ⚠️ **THE SECOND ASSERTION IS WHAT STOPS THIS BEING A TAUTOLOGY.** "Both sides agree" is
   * satisfied by both sides being wrong in the same way. So the shared decision is also required to
   * DO something — to differ from the naive `String(value)` at zero and only at zero. Without it,
   * replacing `countCellText` with `String` would satisfy the deferral and reverse the ruling.
   */
  it("routes the freeing figure through the shared count spelling rather than repeating the rule", () => {
    for (const value of [0, 1, 3, 12, 100]) {
      expect(
        freeingCellText(value),
        `freeingCellText(${value}) no longer agrees with countCellText — the freeing column has ` +
          "stopped deferring to the shared decision, so the three count columns can drift apart again",
      ).toBe(countCellText(value));
    }
    expect(countCellText(0), "the shared decision must state a zero in words").toBe("none");
    for (const value of [1, 3, 12, 100]) {
      expect(countCellText(value), "a real count must still be the numeral").toBe(String(value));
    }
  });

  it("states an absent figure as words, never as a figure and never as the word undefined", () => {
    const text = freeingCellText(undefined);
    expect(text, "the absence rendered the literal word undefined").not.toMatch(/undefined/iu);
    expect(text, "the absence carries no words at all — a blank or a dash says nothing").toMatch(/\p{L}/u);
    expect(
      Number(text.trim()),
      `"${text}" reads as a figure, so a coordinator cannot tell it from a real count`,
    ).toBeNaN();
  });

  it("never gives the absence the same text as any figure it could print", () => {
    // The discriminating half: a coordinator must be able to tell "no data" from every real count.
    const absent = freeingCellText(undefined);
    for (let value = 0; value <= 60; value += 1) {
      expect(freeingCellText(value), `the absence is indistinguishable from a count of ${value}`).not.toBe(absent);
    }
  });
});

describe("networkTotals", () => {
  it("sums wards, beds and ready from the rows rather than recomputing independently", () => {
    const units = allUnits();
    const rows = networkWardRows(units, NOW);
    const totals = networkTotals(rows);
    expect(totals).toEqual({
      wards: rows.length,
      beds: units.reduce((sum, unit) => sum + unit.beds, 0),
      ready: rows.reduce((sum, row) => sum + row.ready, 0),
    });
  });
});

describe("the module answers aggregate mismatch, never a per-patient suggestion", () => {
  // A numeric assertion cannot catch a per-patient branch added beside the aggregate ones — the
  // totals above would still balance. Scanning the source for the one surface this module must
  // never reach for is the only guard that actually fails when that boundary is crossed.
  const source = readFileSync(
    new URL("../src/components/ward-management/capacity/capacity-derivations.ts", import.meta.url),
    "utf8",
  );

  it("never imports from ward-eligibility.ts", () => {
    // Matches an actual `import ... from ".../ward-eligibility"` line, not prose that merely
    // names the file — this module's own doc comments explain the rule by naming what they avoid.
    expect(source).not.toMatch(/from\s+["'][^"']*ward-eligibility["']/);
  });

  it("never calls the per-patient shortlist or eligibility functions", () => {
    expect(source).not.toMatch(/\bshortlistCandidates\s*\(/);
    expect(source).not.toMatch(/\beligibility\s*\(/);
    expect(source).not.toMatch(/\beligibleCandidatesAmong\s*\(/);
  });
});

/**
 * 🔴 **SPECIALLING HEADROOM ON THE NETWORK VIEW — owner ruling 2026-09-06.**
 *
 * `ward-flow-reducer.ts` refuses `PULL_PATIENT` outright when
 * `remainingSpeciallingCapacity(unit, admissions) <= 0`. Until this ruling the board showed nothing
 * about it, so a coordinator planned against a rule the software enforces and the screen hid.
 */
describe("specialling headroom on the network rows", () => {
  const units = allUnits();

  /**
   * ⚠️ **THE DANGEROUS DIRECTION, AND IT IS THE DEFAULT ONE.**
   * `remainingSpeciallingCapacity(unit, [])` returns the ward's FULL authored capacity, because it
   * subtracts the occupied specialling beds it can see and an empty list shows none. So a caller who
   * simply forgot to pass admissions would render **"2 free" for a ward with none** — a fabricated
   * claim of headroom, in the direction that sends a patient to a ward that must refuse them.
   * `undefined` is what "nobody told this screen" has to look like, exactly as `freeing` does.
   */
  it("reports undefined rather than full capacity when no admissions list is supplied", () => {
    const rows = networkWardRows(units, NOW);
    expect(rows.length, "no rows — the assertion below would be vacuous").toBeGreaterThan(0);
    expect(rows.every((row) => row.speciallingFree === undefined)).toBe(true);
    // The denominator is authored on the unit, so it is knowable either way and must NOT go missing.
    expect(rows.some((row) => row.speciallingStaffable > 0)).toBe(true);
  });

  it("counts a ward's remaining one-to-one slots, and only that ward's", () => {
    const withAdmissions = networkWardRows(units, NOW, [], wardAdmissions);
    const subject = withAdmissions.find((row) => row.speciallingStaffable > 0 && (row.speciallingFree ?? 0) > 0);
    expect(subject, "no ward can staff a specialling bed — this guard would prove nothing").toBeDefined();

    const occupied = wardAdmissions.find(
      (admission) => admission.unitId === subject!.unit.id && bedIsOccupied(admission) && !admission.specialling,
    );
    expect(occupied, "the subject ward has no occupied non-specialling bed to convert").toBeDefined();

    /*
     * One occupant starts being specialled. Nothing else changes — same ward, same bed, same person.
     * The headroom must fall by exactly one, and no other ward may move: a figure derived from a
     * whole-network scan is easy to write in a way that leaks between wards, and a coordinator
     * reading a neighbouring ward's headroom would be reading a number about somebody else.
     */
    const mutated: Admission[] = wardAdmissions.map((admission) =>
      admission.id === occupied!.id ? { ...admission, specialling: true } : admission,
    );
    const after = networkWardRows(units, NOW, [], mutated);

    const before = subject!.speciallingFree!;
    const now = after.find((row) => row.unit.id === subject!.unit.id)!.speciallingFree!;
    expect(now, `${subject!.unit.id}'s headroom did not fall when one of its beds began specialling`).toBe(before - 1);

    for (const row of after) {
      if (row.unit.id === subject!.unit.id) continue;
      const original = withAdmissions.find((r) => r.unit.id === row.unit.id)!;
      expect(
        row.speciallingFree,
        `${row.unit.id}'s specialling headroom moved when a bed on a DIFFERENT ward began specialling`,
      ).toBe(original.speciallingFree);
    }
  });

  it("never reports more headroom than the ward is authored to staff, and never a negative", () => {
    for (const row of networkWardRows(units, NOW, [], wardAdmissions)) {
      expect(row.speciallingFree!).toBeGreaterThanOrEqual(0);
      expect(row.speciallingFree!).toBeLessThanOrEqual(row.speciallingStaffable);
    }
  });
});
