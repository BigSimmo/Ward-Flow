// tests/ward-priority.test.ts
import { describe, expect, it } from "vitest";

import { FORM_TIMING_FACTOR_LABEL, queueOrder, waitFactors } from "../src/components/ward-management/ward-priority";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { isOpen } from "../src/components/ward-management/ward-derivations";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import type { Movement } from "../src/components/ward-management/ward-model";
import { DEFAULT_DUE_SOON_THRESHOLDS, type Instant } from "../src/components/ward-management/ward-clock";

function movementById(id: string) {
  const found = wardMovements.find((movement) => movement.id === id);
  if (!found) throw new Error(`fixture is missing ${id}`);
  return found;
}

// Audit 1, Josh 20 Oct (CS-05): `operationalScore` became `waitFactors`. The plain reasons stay;
// the points and the 0 to 100 total are gone (never-build item 1).
describe("wait factors", () => {
  it("never reads urgency — two movements differing only in tier give identical reasons", () => {
    const base = movementById("WF-001");
    const tierOne: Movement = { ...base, urgency: 1 };
    const tierThree: Movement = { ...base, urgency: 3 };
    expect(waitFactors(tierOne, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS)).toEqual(
      waitFactors(tierThree, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS),
    );
  });

  it("carries a label and a sentence only: no points and no total", () => {
    let seen = 0;
    for (const movement of wardMovements) {
      for (const factor of waitFactors(movement, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS)) {
        seen += 1;
        expect(Object.keys(factor).sort()).toEqual(["detail", "label"]);
        expect(factor.label.length).toBeGreaterThan(0);
        expect(factor.detail.length).toBeGreaterThan(0);
      }
    }
    expect(seen, "the fixture produced no factor, so this proves nothing").toBeGreaterThan(0);
  });

  /**
   * 🔴 **"SINCE THE PLACEMENT REQUEST" NAMED AN EVENT THIS MODEL DOES NOT CLAIM `openedAt` IS.**
   * `ward-model.ts`'s own §7 access-target comment defines `Movement.openedAt` as "how long the
   * patient has been in the department" — the same figure `delays-screen.tsx`'s ED clock states in
   * exactly those words, "in ED". `ward-priority.ts` is the ONE place this figure's wording drifted:
   * it invented "since the placement request" for the same number, and `delays-screen.tsx` then
   * copied that wording to "match" it, so the drift spread from one file to two rather than being
   * caught. Pinned here so a future edit to either file's caption cannot separate them again without
   * failing a test on each side.
   */
  it("states the Time waiting factor in the model's own words, 'in ED', never 'since the placement request'", () => {
    const base = movementById("WF-001");
    const waited: Movement = { ...base, openedAt: base.openedAt - 240 };
    const factors = waitFactors(waited, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS);
    const waitFactor = factors.find((factor) => factor.label === "Time waiting");
    expect(waitFactor, "fixture assumption: a 240-minute-older openedAt gives a Time waiting reason").toBeDefined();
    expect(waitFactor?.detail).toMatch(/ in ED$/);
    expect(waitFactor?.detail).not.toMatch(/placement request/);
  });

  // Relabelled from Form 1A to Form 4A on 2026-08-23 (fix wave 1, finding 8). These two
  // movements are test scaffolding, not fixture data: they exist to prove the breach-scoring
  // path works at all, and since the product-owner correction no Form 1A or 3B carries a `dueAt`,
  // labelling them 1A contradicted the model's own doc comment and invited a future author to
  // copy the shape. A Form 4A ("Transport order") is the honest carrier — it is about moving a
  // person, not about the examination timeline, and it legitimately carries a `dueAt` in this
  // model. The -30 and +400 offsets below are arbitrary test scaffolding chosen to sit either
  // side of `NOW_ANCHOR`; they are NOT Mental Health Act figures and nothing derives them from
  // one. After this correction these two movements are the only positive proof left that the
  // breach-scoring path scores at all, which is why they are relabelled rather than deleted.
  it("reports a breached legal deadline and not a clear one", () => {
    const base = movementById("WF-001");
    const breached: Movement = {
      ...base,
      legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR - 30 },
    };
    const clear: Movement = {
      ...base,
      legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR + 400 },
    };
    // Fix wave 1, finding 7: before this, `"passed its deadline"` (ward-priority.ts) was pinned
    // by no unit test at all — deleting or renaming it would have gone undetected, because the
    // only test that mentioned the string was the new whole-page ABSENCE assertion in Playwright,
    // which a deletion makes *more* likely to pass. Assert the rendered factor positively here.
    const breachFactor = waitFactors(breached, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS).find(
      (factor) => factor.label === FORM_TIMING_FACTOR_LABEL,
    );
    expect(breachFactor, "a past-due form must produce a Form due time factor").toBeDefined();
    expect(breachFactor?.detail).toBe("Form 4A passed its deadline 30m ago");

    // A +400 deadline is "clear" under `clockState` (>= 180 min remaining), so it gives no reason.
    const clearFactor = waitFactors(clear, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS).find(
      (factor) => factor.label === FORM_TIMING_FACTOR_LABEL,
    );
    expect(clearFactor, "a deadline still 400 min away must give no Form due time reason").toBeUndefined();

    // The forward-counting branch of the same line. 90 min remaining is "due" under `clockState`
    // (remaining < 180 is "due"; < 60 is "critical"; < 0 is "breached"), so it renders. 90 is arbitrary test scaffolding on a transport order, not a legal
    // figure.
    const approaching: Movement = {
      ...base,
      legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR + 90 },
    };
    const approachingFactor = waitFactors(approaching, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS).find(
      (factor) => factor.label === FORM_TIMING_FACTOR_LABEL,
    );
    expect(approachingFactor?.detail).toBe("Form 4A due in 1h 30m");
  });

  it("gives no Form due time reason for a legal form with no dueAt", () => {
    // Task 6A: a Form 3B carries no dueAt — the clinician settled that the post-examination
    // clock counts up, so none is recorded. This must never score as breached, critical or due — the
    // patient's priority rides on "Time waiting" alone, which is precisely the clinician's rule,
    // and this must never gain a compensating bonus for being detained instead.
    const base = movementById("WF-003");
    const noDeadline: Movement = {
      ...base,
      legalForm: { code: "3B", kind: "detention" },
    };
    const factors = waitFactors(noDeadline, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS);
    expect(factors.find((factor) => factor.label === FORM_TIMING_FACTOR_LABEL)).toBeUndefined();
  });

  it("gives no Form due time reason for a legal form with no dueAt", () => {
    // Task 6A: a Form 3B honestly carries no dueAt — the clinician, asked directly, settled that
    // the post-examination clock is elapsed ED wait counting up, not a countdown, so this model
    // records no deadline for a 3B. This must never score as breached, critical or due — the
    // patient's priority rides on "Time waiting" alone, which is precisely the clinician's rule,
    // and this must never gain a compensating bonus for being detained instead.
    const base = movementById("WF-003");
    const noDeadline: Movement = {
      ...base,
      legalForm: { code: "3B", kind: "detention" },
    };
    const factors = waitFactors(noDeadline, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS);
    expect(factors.find((factor) => factor.label === FORM_TIMING_FACTOR_LABEL)).toBeUndefined();
  });

  /**
   * The 2026-08-24 product-owner instruction: whether a patient has been reviewed stops affecting
   * the queue at all — no points for it, and no gate on requesting a bed. The 25-point
   * "Bed need confirmed" factor that used to fire on `examination.outcome === "inpatient_order"`
   * is deleted, and this pins the deletion two ways so it cannot quietly come back: no factor is
   * labelled for an examination or a review, and adding an examination changes nothing at all.
   *
   * The `examination` record itself is untouched and still asserted elsewhere
   * (`ward-flow-reducer.test.ts` for RECORD_EXAMINATION, `ward-model-phase3.test.ts` for the
   * fixture shape) — only its effect on priority is gone.
   */
  it("scores no factor for having been examined or reviewed", () => {
    const forbidden = /exam|review|assess|bed need/i;
    for (const movement of wardMovements) {
      for (const factor of waitFactors(movement, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS)) {
        expect(factor.label, `${movement.id} scored a factor labelled for review: ${factor.label}`).not.toMatch(
          forbidden,
        );
      }
    }

    // The fixture only carries `inpatient_order`, so drive the other two outcomes explicitly.
    const base = movementById("WF-001");
    for (const outcome of ["inpatient_order", "community_order", "revoked"] as const) {
      const examined: Movement = { ...base, examination: { at: NOW_ANCHOR - 30, outcome } };
      for (const factor of waitFactors(examined, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS)) {
        expect(factor.label, `outcome ${outcome} scored a factor labelled for review`).not.toMatch(forbidden);
      }
    }
  });

  it("gives an examined movement exactly the reasons of the same movement unexamined", () => {
    const unexamined = movementById("WF-001");
    expect(unexamined.examination, "fixture assumption: WF-001 carries no examination").toBeUndefined();
    const before = waitFactors(unexamined, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS);

    for (const outcome of ["inpatient_order", "community_order", "revoked"] as const) {
      const examined: Movement = { ...unexamined, examination: { at: NOW_ANCHOR - 30, outcome } };
      const after = waitFactors(examined, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS);
      expect(after, `recording ${outcome} must not add or alter a factor`).toEqual(before);
    }

    // The same identity from the other direction: WF-009 carries a real `inpatient_order`
    // examination in the fixture, and stripping it must leave its reasons untouched.
    const examinedFixture = movementById("WF-009");
    expect(examinedFixture.examination?.outcome, "fixture assumption: WF-009 was examined").toBe("inpatient_order");
    const stripped: Movement = { ...examinedFixture, examination: undefined };
    expect(waitFactors(stripped, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS)).toEqual(
      waitFactors(examinedFixture, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS),
    );
  });

  it("does not report a blocker for a movement whose blocker field says there is none", () => {
    for (const id of ["WF-006", "WF-007", "WF-014"]) {
      const movement = movementById(id);
      const factors = waitFactors(movement, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS);
      expect(factors.find((factor) => factor.label === "Active blocker")).toBeUndefined();
    }
  });

  it("does not report a blocker for a value that only happens to start with 'None'", () => {
    const base = movementById("WF-001");
    const realBlocker: Movement = { ...base, blocker: "None of the secure units can take him" };
    const factors = waitFactors(realBlocker, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS);
    expect(factors.find((factor) => factor.label === "Active blocker")).toBeDefined();
  });

  it("states the decline count without a self-contradictory fraction against the parallel cap", () => {
    const movement = movementById("WF-009");
    const factors = waitFactors(movement, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS);
    const declineFactor = factors.find((factor) => factor.label === "Destinations declined");
    expect(declineFactor).toBeDefined();
    expect(declineFactor?.detail).not.toContain(" of 3");
    expect(declineFactor?.detail).toContain("5");
  });

  it("does not claim a transport delay for a movement already en route", () => {
    for (const movement of wardMovements) {
      if (movement.transport?.enRouteAt === undefined) continue;
      const factors = waitFactors(movement, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS);
      expect(factors.find((factor) => factor.label === "Transport delay")).toBeUndefined();
    }
  });

  it("still claims a transport delay for a movement accepted but not yet departed", () => {
    for (const id of ["WF-005", "WF-015"]) {
      const movement = movementById(id);
      const factors = waitFactors(movement, NOW_ANCHOR, DEFAULT_DUE_SOON_THRESHOLDS);
      expect(factors.find((factor) => factor.label === "Transport delay")).toBeDefined();
    }
  });
});

// Audit 1, Josh 20 Oct (CS-04, NB-6a), superseding D-32 of 12 Oct: the queue is wait order only.
// The flag, an act-now task and the tier are badges on the row; none of them moves it.
describe("queue order", () => {
  it("orders everyone longest wait first, with the id breaking a tie", () => {
    const ordered = queueOrder(wardMovements, NOW_ANCHOR);
    expect(ordered.length, "the fixture must still hold movements to order").toBeGreaterThan(1);
    for (let index = 1; index < ordered.length; index += 1) {
      const earlier = ordered[index - 1];
      const later = ordered[index];
      expect(earlier.openedAt).toBeLessThanOrEqual(later.openedAt);
      if (earlier.openedAt === later.openedAt) expect(earlier.id < later.id).toBe(true);
    }
    const tiers = new Set(ordered.map((movement) => movement.urgency));
    expect(tiers.size, "tiers must interleave for the wait order to mean anything").toBeGreaterThan(1);
  });

  it("breaks a tie on wait by id, never by tier", () => {
    const base = movementById("WF-001");
    const tierThree: Movement = { ...base, id: "WF-TIE-A", urgency: 3, openedAt: NOW_ANCHOR - 300 };
    const tierOne: Movement = { ...base, id: "WF-TIE-B", urgency: 1, openedAt: NOW_ANCHOR - 300 };
    expect(queueOrder([tierOne, tierThree], NOW_ANCHOR).map((movement) => movement.id)).toEqual([
      "WF-TIE-A",
      "WF-TIE-B",
    ]);
  });

  it("does not lift a flagged or act-now movement above a longer wait", () => {
    const base = movementById("WF-001");
    const longWait: Movement = { ...base, id: "WF-LONG", flaggedUrgent: false, urgency: 1, openedAt: NOW_ANCHOR - 900 };
    const actNow: Movement = { ...base, id: "WF-ACT", flaggedUrgent: false, urgency: 3, openedAt: NOW_ANCHOR - 20 };
    const flagged: Movement = { ...base, id: "WF-FLAG", flaggedUrgent: true, urgency: 3, openedAt: NOW_ANCHOR - 5 };
    expect(queueOrder([flagged, actNow, longWait], NOW_ANCHOR).map((movement) => movement.id)).toEqual([
      "WF-LONG",
      "WF-ACT",
      "WF-FLAG",
    ]);
  });

  /**
   * ITEM 37, RESOLVED 2026-09-17, then Audit 1 (20 Oct 2026): the wait leads outright, so within a
   * tier it still reads longest first.
   */
  it("orders by wait, longest first, within a tier", () => {
    const ordered = queueOrder(wardMovements, NOW_ANCHOR);
    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index].urgency !== ordered[index - 1].urgency) continue;
      const earlierWait = NOW_ANCHOR - ordered[index - 1].openedAt;
      const laterWait = NOW_ANCHOR - ordered[index].openedAt;
      expect(earlierWait).toBeGreaterThanOrEqual(laterWait);
    }
  });

  it("excludes closed and arrived movements", () => {
    const ordered = queueOrder(wardMovements, NOW_ANCHOR);
    expect(ordered.every((movement) => !movement.closure && movement.stage !== "arrived")).toBe(true);
    expect(ordered.length).toBe(wardMovements.filter(isOpen).length);
  });

  /**
   * Re-derived from the code at NOW_ANCHOR after item 37 (2026-09-17) replaced the
   * operational-score tie-break with the wait itself, uncapped. This used to read "orders tier 1
   * on waiting time, declines and blockers alone" and pin only a five-row prefix, because two rows
   * genuinely tied at an operational score of 40. Under the wait alone, every one of the sixteen
   * open tier-1 movements in this fixture has a DISTINCT wait (915, 804, 693, 582, 500, 480, 471,
   * 459, 420, 410, 400, 360, 348, 260, 126, 95 minutes) -- so the WHOLE tier can be pinned, not
   * just a prefix, and there is no tie left for sort stability to paper over.
   *
   * SIXTEEN -> SEVENTEEN, 2026-09-17 (T2r fix round, finding 5, sample-data pass): WF-023 is
   * tier 1 (urgency 1) and opened 1,500 minutes (25 hours) before the anchor — see its own comment
   * in ward-movements.ts, the fixture's one ED wait past the 24-hour access target. That is longer
   * than every existing tier-1 wait, so it leads the tier; every other id and its own wait are
   * unchanged (re-derived, not assumed).
   */
  it("orders tier 1 on wait alone", () => {
    const ordered = queueOrder(wardMovements, NOW_ANCHOR);
    const tierOneIds = ordered.filter((movement) => movement.urgency === 1).map((movement) => movement.id);
    expect(
      tierOneIds,
      "The order of tier 1 -- the most urgent queue on the board -- has changed. Every wait in this " +
        "tier is distinct, so this is a real ordering claim, not sort stability. Re-derive the " +
        "wait for every tier-1 movement from wardMovements before changing any id here.",
    ).toEqual([
      "WF-023",
      "WF-315",
      "WF-312",
      "WF-309",
      "WF-306",
      "WF-006",
      "WF-014",
      "WF-303",
      "WF-327",
      "WF-009",
      "WF-004",
      "WF-017",
      "WF-011",
      "WF-324",
      "WF-003",
      "WF-318",
      "WF-001",
    ]);
  });

  /**
   * ITEM 37's own failing-test list, verbatim: "swapping legal status and form between equal
   * patients changes nothing". `queueOrder`'s comparator reads only `openedAt` and the id --
   * `legalStatus` and `legalForm` never appear in it.
   */
  it("swapping legal status and form between two equal-tier, equal-wait patients changes nothing", () => {
    const base = movementById("WF-001");
    const a: Movement = { ...base, id: "WF-EQ-A", legalStatus: "Voluntary", legalForm: undefined };
    const b: Movement = {
      ...base,
      id: "WF-EQ-B",
      legalStatus: "Involuntary inpatient",
      // Breached, per the "reports a breached legal deadline" test above -- if
      // this comparator read legal form at all, a breached one is the value most likely to move it.
      legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR - 30 },
    };

    const order1 = queueOrder([a, b], NOW_ANCHOR).map((movement) => movement.id);
    expect(order1, "a and b tie on wait, so the id decides").toEqual(["WF-EQ-A", "WF-EQ-B"]);

    // Swap legal status and form between them, keep the same array order, and check nothing moved.
    const swappedA: Movement = { ...a, legalStatus: b.legalStatus, legalForm: b.legalForm };
    const swappedB: Movement = { ...b, legalStatus: a.legalStatus, legalForm: a.legalForm };
    const order2 = queueOrder([swappedA, swappedB], NOW_ANCHOR).map((movement) => movement.id);
    expect(
      order2,
      "the order changed after swapping only legal status and form -- queueOrder must be reading one " + "of them",
    ).toEqual(["WF-EQ-A", "WF-EQ-B"]);
  });

  /**
   * ITEM 37, RESOLVED 2026-09-17. This closes the half of D9-1 this file used to pin as a known,
   * deliberate gap: two patients on the same tier, one waiting ten hours and one waiting thirty,
   * used to tie in `queueOrder` because it read a score capped at ten hours. It reads `openedAt`
   * itself now, so the two must separate.
   */
  it("waits beyond ten hours now separate the queue -- the deferred half, resolved", () => {
    const base = movementById("WF-001");
    const tenHours: Movement = { ...base, id: "WF-TEN", openedAt: NOW_ANCHOR - 600 };
    const thirtyHours: Movement = { ...base, id: "WF-THIRTY", openedAt: NOW_ANCHOR - 1800 };
    const ordered = queueOrder([tenHours, thirtyHours], NOW_ANCHOR).map((movement) => movement.id);
    expect(
      ordered,
      "a thirty-hour wait must now outrank a ten-hour wait on the same tier -- if this ties, " +
        "queueOrder is still reading a capped score rather than the wait itself",
    ).toEqual(["WF-THIRTY", "WF-TEN"]);
  });
});

/**
 * THE URGENT FLAG. Owner, 2026-08-30: patients "can be marked as urgent for many reasons". Until
 * Audit 1 the flag lifted a patient above every tier and every wait (D-32, 12 Oct). Josh, 20 Oct
 * 2026, superseding that: the queue is wait order by default; the flag is a badge on the row and
 * moves nothing. `tests/ward-urgent-flag.test.ts` covers the flag's own provenance.
 */
describe("the urgent flag is a highlight, not an order", () => {
  function pairAround(now: Instant) {
    const base = movementById("WF-001");
    const flaggedButNewer: Movement = {
      ...base,
      id: "WF-FLAGGED-NEW",
      flaggedUrgent: true,
      urgency: 3,
      openedAt: now - 30,
    };
    const unflaggedButOlder: Movement = {
      ...base,
      id: "WF-UNFLAGGED-OLD",
      flaggedUrgent: false,
      urgency: 1,
      openedAt: now - 600,
    };
    return { flaggedButNewer, unflaggedButOlder };
  }

  it("keeps a flagged patient below an unflagged one with twenty times the wait", () => {
    const { flaggedButNewer, unflaggedButOlder } = pairAround(NOW_ANCHOR);
    expect(
      queueOrder([flaggedButNewer, unflaggedButOlder], NOW_ANCHOR).map((movement) => movement.id),
      "the longer wait leads; the flag does not move a row",
    ).toEqual(["WF-UNFLAGGED-OLD", "WF-FLAGGED-NEW"]);
  });

  it("gives the same order with the flag on or off", () => {
    const { flaggedButNewer, unflaggedButOlder } = pairAround(NOW_ANCHOR);
    const noLongerFlagged: Movement = { ...flaggedButNewer, flaggedUrgent: false };
    expect(queueOrder([noLongerFlagged, unflaggedButOlder], NOW_ANCHOR).map((movement) => movement.id)).toEqual(
      queueOrder([flaggedButNewer, unflaggedButOlder], NOW_ANCHOR).map((movement) => movement.id),
    );
  });

  it("leads the real fixture with the longest wait, not with a flagged movement", () => {
    const ordered = queueOrder(wardMovements, NOW_ANCHOR);
    const longest = Math.min(...wardMovements.filter(isOpen).map((movement) => movement.openedAt));
    expect(ordered[0].openedAt).toBe(longest);
    expect(
      wardMovements.some((movement) => isOpen(movement) && movement.flaggedUrgent),
      "the fixture must hold a flagged movement for this to mean anything",
    ).toBe(true);
  });

  it("orders the fixture identically with every flag stripped", () => {
    const unflagged = wardMovements.map((movement) => ({ ...movement, flaggedUrgent: false, urgentFlag: undefined }));
    expect(queueOrder(unflagged, NOW_ANCHOR).map((movement) => movement.id)).toEqual(
      queueOrder(wardMovements, NOW_ANCHOR).map((movement) => movement.id),
    );
  });
});
