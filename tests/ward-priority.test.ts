// tests/ward-priority.test.ts
import { describe, expect, it } from "vitest";

import {
  FORM_TIMING_FACTOR_LABEL,
  operationalScore,
  queueOrder,
} from "../src/components/ward-management/ward-priority";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { isOpen } from "../src/components/ward-management/ward-derivations";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import type { Movement } from "../src/components/ward-management/ward-model";
import type { Instant } from "../src/components/ward-management/ward-clock";

function movementById(id: string) {
  const found = wardMovements.find((movement) => movement.id === id);
  if (!found) throw new Error(`fixture is missing ${id}`);
  return found;
}

describe("operational score", () => {
  it("never reads urgency — two movements differing only in tier score identically", () => {
    const base = movementById("WF-001");
    const tierOne: Movement = { ...base, urgency: 1 };
    const tierThree: Movement = { ...base, urgency: 3 };
    expect(operationalScore(tierOne, NOW_ANCHOR).score).toBe(operationalScore(tierThree, NOW_ANCHOR).score);
  });

  it("scores a longer wait above a shorter one, all else equal", () => {
    const base = movementById("WF-001");
    const waitedLonger: Movement = { ...base, openedAt: base.openedAt - 240 };
    expect(operationalScore(waitedLonger, NOW_ANCHOR).score).toBeGreaterThan(operationalScore(base, NOW_ANCHOR).score);
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
    const { factors } = operationalScore(waited, NOW_ANCHOR);
    const waitFactor = factors.find((factor) => factor.label === "Time waiting");
    expect(waitFactor, "fixture assumption: a 240-minute-older openedAt scores Time waiting points").toBeDefined();
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
  it("scores a breached legal deadline above a clear one", () => {
    const base = movementById("WF-001");
    const breached: Movement = {
      ...base,
      legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR - 30 },
    };
    const clear: Movement = {
      ...base,
      legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR + 400 },
    };
    expect(operationalScore(breached, NOW_ANCHOR).score).toBeGreaterThan(operationalScore(clear, NOW_ANCHOR).score);

    // Fix wave 1, finding 7: before this, `"passed its deadline"` (ward-priority.ts) was pinned
    // by no unit test at all — deleting or renaming it would have gone undetected, because the
    // only test that mentioned the string was the new whole-page ABSENCE assertion in Playwright,
    // which a deletion makes *more* likely to pass. Assert the rendered factor positively here.
    const breachFactor = operationalScore(breached, NOW_ANCHOR).factors.find(
      (factor) => factor.label === FORM_TIMING_FACTOR_LABEL,
    );
    expect(breachFactor, "a past-due form must produce a Form due time factor").toBeDefined();
    expect(breachFactor?.detail).toBe("Form 4A passed its deadline 30m ago");
    // Fix wave 2, finding 6. Closing the gap disclosed in fix wave 1: the comparison above is an
    // ORDERING claim against a form scoring zero, so any positive value satisfied it and dropping
    // the breached tier from 30 to 10 survived as a mutation. This pins the statutory tiers
    // outright. No clinical or statutory figure is involved — these are the model's own
    // operational priority weights.
    expect(breachFactor?.points).toBe(30);

    // A +400 deadline is "clear" under `clockState` (>= 180 min remaining), which scores zero
    // points and so pushes no factor at all. Pinning that explicitly is the honest assertion —
    // and it is what makes the comparison above meaningful rather than a comparison of two
    // scored states.
    const clearFactor = operationalScore(clear, NOW_ANCHOR).factors.find(
      (factor) => factor.label === FORM_TIMING_FACTOR_LABEL,
    );
    expect(clearFactor, "a deadline still 400 min away must score no Form due time points").toBeUndefined();

    // The forward-counting branch of the same line. 90 min remaining is "due" under `clockState`
    // (remaining < 180 is "due"; < 60 is "critical"; < 0 is "breached"), which scores 10 points
    // and therefore renders. 90 is arbitrary test scaffolding on a transport order, not a legal
    // figure.
    const approaching: Movement = {
      ...base,
      legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR + 90 },
    };
    const approachingFactor = operationalScore(approaching, NOW_ANCHOR).factors.find(
      (factor) => factor.label === FORM_TIMING_FACTOR_LABEL,
    );
    expect(approachingFactor?.detail).toBe("Form 4A due in 1h 30m");
    expect(approachingFactor?.points).toBe(10);
  });

  it("awards no Form due time points to a legal form with no dueAt", () => {
    // Task 6A: a Form 3B carries no dueAt — the clinician settled that the post-examination
    // clock counts up, so none is recorded. This must never score as breached, critical or due — the
    // patient's priority rides on "Time waiting" alone, which is precisely the clinician's rule,
    // and this must never gain a compensating bonus for being detained instead.
    const base = movementById("WF-003");
    const noDeadline: Movement = {
      ...base,
      legalForm: { code: "3B", kind: "detention" },
    };
    const { factors } = operationalScore(noDeadline, NOW_ANCHOR);
    expect(factors.find((factor) => factor.label === FORM_TIMING_FACTOR_LABEL)).toBeUndefined();
  });

  it("awards no Form due time points to a legal form with no dueAt", () => {
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
    const { factors } = operationalScore(noDeadline, NOW_ANCHOR);
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
      for (const factor of operationalScore(movement, NOW_ANCHOR).factors) {
        expect(factor.label, `${movement.id} scored a factor labelled for review: ${factor.label}`).not.toMatch(
          forbidden,
        );
      }
    }

    // The fixture only carries `inpatient_order`, so drive the other two outcomes explicitly.
    const base = movementById("WF-001");
    for (const outcome of ["inpatient_order", "community_order", "revoked"] as const) {
      const examined: Movement = { ...base, examination: { at: NOW_ANCHOR - 30, outcome } };
      for (const factor of operationalScore(examined, NOW_ANCHOR).factors) {
        expect(factor.label, `outcome ${outcome} scored a factor labelled for review`).not.toMatch(forbidden);
      }
    }
  });

  it("scores an examined movement exactly as it scores the same movement unexamined", () => {
    const unexamined = movementById("WF-001");
    expect(unexamined.examination, "fixture assumption: WF-001 carries no examination").toBeUndefined();
    const before = operationalScore(unexamined, NOW_ANCHOR);

    for (const outcome of ["inpatient_order", "community_order", "revoked"] as const) {
      const examined: Movement = { ...unexamined, examination: { at: NOW_ANCHOR - 30, outcome } };
      const after = operationalScore(examined, NOW_ANCHOR);
      expect(after.score, `recording ${outcome} must not move the score`).toBe(before.score);
      expect(after.factors, `recording ${outcome} must not add or alter a factor`).toEqual(before.factors);
    }

    // The same identity from the other direction: WF-009 carries a real `inpatient_order`
    // examination in the fixture, and stripping it must leave its score untouched.
    const examinedFixture = movementById("WF-009");
    expect(examinedFixture.examination?.outcome, "fixture assumption: WF-009 was examined").toBe("inpatient_order");
    const stripped: Movement = { ...examinedFixture, examination: undefined };
    expect(operationalScore(stripped, NOW_ANCHOR).score).toBe(operationalScore(examinedFixture, NOW_ANCHOR).score);
  });

  it("explains itself — every point scored is attributed to a named factor", () => {
    for (const movement of wardMovements) {
      const { score, factors } = operationalScore(movement, NOW_ANCHOR);
      expect(factors.reduce((sum, factor) => sum + factor.points, 0)).toBe(score);
      for (const factor of factors) {
        expect(factor.label.length).toBeGreaterThan(0);
        expect(factor.detail.length).toBeGreaterThan(0);
      }
    }
  });

  it("stays inside its stated range so it cannot be read as a percentage of anything", () => {
    for (const movement of wardMovements) {
      const { score } = operationalScore(movement, NOW_ANCHOR);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it("does not report a blocker for a movement whose blocker field says there is none", () => {
    for (const id of ["WF-006", "WF-007", "WF-014"]) {
      const movement = movementById(id);
      const { factors } = operationalScore(movement, NOW_ANCHOR);
      expect(factors.find((factor) => factor.label === "Active blocker")).toBeUndefined();
    }
  });

  it("does not report a blocker for a value that only happens to start with 'None'", () => {
    const base = movementById("WF-001");
    const realBlocker: Movement = { ...base, blocker: "None of the secure units can take him" };
    const { factors } = operationalScore(realBlocker, NOW_ANCHOR);
    expect(factors.find((factor) => factor.label === "Active blocker")).toBeDefined();
  });

  it("states the decline count without a self-contradictory fraction against the parallel cap", () => {
    const movement = movementById("WF-009");
    const { factors } = operationalScore(movement, NOW_ANCHOR);
    const declineFactor = factors.find((factor) => factor.label === "Destinations declined");
    expect(declineFactor).toBeDefined();
    expect(declineFactor?.detail).not.toContain(" of 3");
    expect(declineFactor?.detail).toContain("5");
  });

  it("does not claim a transport delay for a movement already en route", () => {
    for (const movement of wardMovements) {
      if (movement.transport?.enRouteAt === undefined) continue;
      const { factors } = operationalScore(movement, NOW_ANCHOR);
      expect(factors.find((factor) => factor.label === "Transport delay")).toBeUndefined();
    }
  });

  it("still claims a transport delay for a movement accepted but not yet departed", () => {
    for (const id of ["WF-005", "WF-015"]) {
      const movement = movementById(id);
      const { factors } = operationalScore(movement, NOW_ANCHOR);
      expect(factors.find((factor) => factor.label === "Transport delay")).toBeDefined();
    }
  });
});

describe("queue order", () => {
  /**
   * Narrowed to the UNFLAGGED on 2026-08-30, when the urgent flag landed above the tiers. It read
   * "every tier 1 above every tier 2" over the whole queue, and a flagged tier-3 patient leading
   * the board is exactly what the flag is for.
   *
   * Narrowed rather than removed: the tier ladder still governs everyone without a flag, and
   * deleting this would have left that unasserted at the moment something was placed above it.
   */
  it("keeps every tier 1 above every tier 2 and every tier 2 above every tier 3, among the unflagged", () => {
    const ordered = queueOrder(wardMovements, NOW_ANCHOR).filter((movement) => !movement.flaggedUrgent);
    expect(ordered.length, "the fixture must still hold unflagged movements to order").toBeGreaterThan(1);
    const tiers = ordered.map((movement) => movement.urgency);
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers);
  });

  /**
   * ITEM 37, RESOLVED 2026-09-17. This used to read "orders by operational score within a tier,
   * highest first" -- `queueOrder`'s third key is no longer `operationalScore`. The owner's fuller
   * ruling, named as deferred at the time, was "otherwise go by time for the main level of
   * urgency", and that is what the third key is now: the wait itself, uncapped. See
   * `queueOrder`'s own doc comment (`ward-priority.ts`) for what changed and what did not.
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
  it("orders tier 1 on wait alone, now that operational score no longer orders the queue", () => {
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
   * patients changes nothing". `queueOrder`'s comparator reads only the flag, `urgency` and
   * `openedAt` -- `legalStatus` and `legalForm` never appear in it -- so two movements tied on all
   * three of those must keep their INPUT order (a stable sort touching nothing) no matter what
   * either one's legal status or form says.
   */
  it("swapping legal status and form between two equal-tier, equal-wait patients changes nothing", () => {
    const base = movementById("WF-001");
    const a: Movement = { ...base, id: "WF-EQ-A", legalStatus: "Voluntary", legalForm: undefined };
    const b: Movement = {
      ...base,
      id: "WF-EQ-B",
      legalStatus: "Involuntary inpatient",
      // Breached, per the "scores a breached legal deadline above a clear one" test above -- if
      // this comparator read legal form at all, a breached one is the value most likely to move it.
      legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR - 30 },
    };

    const order1 = queueOrder([a, b], NOW_ANCHOR).map((movement) => movement.id);
    expect(order1, "a and b tie on flag, tier and wait, so array order must survive").toEqual(["WF-EQ-A", "WF-EQ-B"]);

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
   * used to tie in `queueOrder` because its third key was `operationalScore`, which stops counting
   * a wait at ten hours (`Math.min(40, ...)`). `queueOrder`'s third key is no longer that score --
   * see `waitedMinutesUncapped` (`ward-priority.ts`) -- so the two must now separate.
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
 * THE URGENT FLAG -- who gets the next bed, and the ranking decision the owner deferred and has now
 * partly built on.
 *
 * Owner, 2026-08-30: "A long wait always is prioritised... however... in certain cases patients can be
 * marked as urgent for many reasons which outranks everything." Asked how far to take it, he scoped
 * it small on purpose: "For now just have a feature that flags the patient. I will build on it
 * later."
 *
 * WARNING: ITEM 37 (2026-09-17) IS THAT "LATER", IN PART. The ranking below the flag -- three tiers,
 * then a composite operational score -- used to be an explicitly deferred stage, pinned here so a
 * reader could not mistake it for settled. The owner's fuller ruling, "otherwise go by time for the
 * main level of urgency", is now what `queueOrder` does beneath the flag: tier, then the wait
 * itself, uncapped. `operationalScore` and its factor breakdown are UNCHANGED and still render on
 * the coordinator queue as an explanation of how badly a movement is going operationally -- they
 * simply no longer decide the order.
 *
 * The flag itself also gained provenance this task: `FLAG_MOVEMENT_URGENT` now requires a reason
 * from `URGENT_MARK_REASONS` and records who raised it and when, on `Movement.urgentFlag`. See
 * `tests/ward-urgent-flag.test.ts` for that half; this file stays scoped to ordering.
 */
describe("the urgent flag, and the ranking decision partly resolved beneath it", () => {
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

  it("puts a flagged patient above an unflagged one with a higher tier and twenty times the wait", () => {
    const { flaggedButNewer, unflaggedButOlder } = pairAround(NOW_ANCHOR);
    expect(
      queueOrder([unflaggedButOlder, flaggedButNewer], NOW_ANCHOR).map((movement) => movement.id),
      "the flag outranks everything: a tier-3 patient thirty minutes in must lead a tier-1 patient " + "ten hours in",
    ).toEqual(["WF-FLAGGED-NEW", "WF-UNFLAGGED-OLD"]);
  });

  it("REVERSES when the flag is taken off, which is what proves the flag did the work", () => {
    const { flaggedButNewer, unflaggedButOlder } = pairAround(NOW_ANCHOR);
    const noLongerFlagged: Movement = { ...flaggedButNewer, flaggedUrgent: false };
    expect(
      queueOrder([noLongerFlagged, unflaggedButOlder], NOW_ANCHOR).map((movement) => movement.id),
      "with the flag off, the old ranking returns and tier 1 leads tier 3. If this does not flip, " +
        "the assertion above was passing on argument order, sort stability, or the tier comparator " +
        "-- anything but the flag.",
    ).toEqual(["WF-UNFLAGGED-OLD", "WF-FLAGGED-NEW"]);
  });

  // T2r fix round, finding 5 (2026-09-17 sample-data pass): WF-030 joined WF-018 as a second
  // `flaggedUrgent: true` row (see that row's own comment in ward-movements.ts — "clinically
  // ordinary rather than contrived, same reasoning as WF-018's own"). Queue order is flag, then
  // tier, then uncapped wait — both are tier 3, so between the two flagged movements the longer
  // wait leads: WF-030 at 60 minutes beats WF-018 at 40. The flag still did the work (both sit
  // above every tier-1 patient who has waited hours); it is just no longer the only flagged row.
  it("leads the real fixture with WF-030, which nothing but the flag (and its longer wait than WF-018) could have put there", () => {
    const ordered = queueOrder(wardMovements, NOW_ANCHOR);
    const leader = ordered[0];
    expect(leader.id, "the flagged movement must lead the live queue").toBe("WF-030");
    expect(leader.flaggedUrgent).toBe(true);

    // And it could not have arrived there any other way: lowest tier, shortest wait of any seeded
    // movement. Asserted rather than asserted-in-a-comment, so a fixture edit that made WF-030
    // ordinarily top of the queue would fail here instead of hollowing out the test above.
    expect(leader.urgency, "WF-030 must stay the LOWEST tier or it could lead on tier alone").toBe(3);
    const others = ordered.filter((movement) => movement.id !== "WF-030");
    expect(others.every((movement) => movement.openedAt >= leader.openedAt || !movement.flaggedUrgent)).toBe(true);
    expect(
      others.some((movement) => movement.urgency === 1),
      "the queue must contain tier-1 patients for leading it to mean anything",
    ).toBe(true);
  });

  it("changes NOTHING beneath the flag -- the tiers and the wait still order the rest", () => {
    // The additive half of the ruling, asserted directly: strip the flag from the fixture and the
    // queue must still order everyone by tier, then wait -- exactly the ranking `queueOrder` uses
    // beneath the flag today (item 37 replaced the operational-score tie-break this used to check
    // with the wait itself; see that function's own doc comment).
    const unflagged = wardMovements.map((movement) => ({ ...movement, flaggedUrgent: false, urgentFlag: undefined }));
    const ordered = queueOrder(unflagged, NOW_ANCHOR);
    const tiers = ordered.map((movement) => movement.urgency);
    expect(
      [...tiers].sort((a, b) => a - b),
      "with no flags, tier order must be intact -- the flag was supposed to sit ABOVE the existing " +
        "ranking, not replace it",
    ).toEqual(tiers);

    for (let index = 1; index < ordered.length; index += 1) {
      if (ordered[index].urgency !== ordered[index - 1].urgency) continue;
      const earlierWait = NOW_ANCHOR - ordered[index - 1].openedAt;
      const laterWait = NOW_ANCHOR - ordered[index].openedAt;
      expect(earlierWait).toBeGreaterThanOrEqual(laterWait);
    }
  });

  /**
   * WARNING: WHAT ITEM 37 DELIBERATELY DID NOT TOUCH. `operationalScore` itself -- the factor
   * breakdown `priority-queue.tsx` still renders beside every row -- keeps its own ten-hour cap on
   * the "Time waiting" factor (`Math.min(40, ...)`). That cap now has nothing to do with ordering
   * (see `tests/ward-priority.test.ts`'s "waits beyond ten hours now separate the queue" above,
   * in the `queueOrder`-only describe block): it is purely a display choice about how a wait is
   * SCORED for the factor a coordinator reads, scoped as "The factors below explain a wait; they
   * do not order the queue." Pinned here so a future change to `operationalScore`'s own cap is a
   * deliberate, visible edit rather than a side effect of touching ordering.
   */
  it("operationalScore's own ten-hour cap is untouched, and is no longer about ordering", () => {
    const base = movementById("WF-001");
    const tenHours: Movement = { ...base, openedAt: NOW_ANCHOR - 600 };
    const thirtyHours: Movement = { ...base, openedAt: NOW_ANCHOR - 1800 };
    expect(
      operationalScore(tenHours, NOW_ANCHOR).score,
      "operationalScore's own wait cap has moved. If that was deliberate, say so here and check " +
        "whether the factor breakdown priority-queue.tsx renders still reads honestly.",
    ).toBe(operationalScore(thirtyHours, NOW_ANCHOR).score);
  });
});
