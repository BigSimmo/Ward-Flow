import { describe, expect, it } from "vitest";

import { capacityBreakdown, releaseBand } from "../src/components/ward-management/ward-bed-availability";
import { BED_PREPARATION_NOTES, BED_RELEASE_BLOCKERS } from "../src/components/ward-management/ward-change-reasons";
import { unitCapacity } from "../src/components/ward-management/ward-derivations";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;

function seeded() {
  return seedWardFlowState();
}

function release(state: ReturnType<typeof seeded>, id: string) {
  const found = state.bedReleases.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing bed release ${id}`);
  return found;
}

function unit(state: ReturnType<typeof seeded>, id: string) {
  const found = state.units.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing unit ${id}`);
  return found;
}

/** Occupants of `unitId` who are not on leave, from state, never hard-coded (at least three). */
function occupantsNotOnLeave(state: ReturnType<typeof seeded>, unitId: string) {
  const found = state.admissions.filter(
    (a) => a.unitId === unitId && a.state === "occupied" && !state.leaveBeds.some((bed) => bed.admissionId === a.id),
  );
  if (found.length < 3) throw new Error(`the seed has fewer than three occupants on ${unitId} not on leave`);
  return found;
}

function admission(state: ReturnType<typeof seeded>, id: string) {
  const found = state.admissions.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`state is missing admission ${id}`);
  return found;
}

/**
 * CHANGED 25 September 2026: the hand-authored WR-001..WR-009 fixture releases are gone —
 * `bedReleases` is now `derivedBedReleases(wardAdmissions, NOW_ANCHOR)`: one "expected"/"confirmed"
 * release per occupied admission carrying an `expectedDischargeAt` (id
 * `derived-expected-<admissionId>` / `derived-confirmed-<admissionId>`, blocker from
 * `admission.blockReason`), plus one "discharged" release per departed stay (owner decision
 * 2026-09-25, see `ward-flow-reducer.ts`'s own comment on `FLAG_BED_RELEASE` and
 * `ward-discharge-dates.ts`'s `derivedBedReleases`). These pickers find a release with the shape a
 * test needs AT RUNTIME instead, so a fixture reshuffle can never silently point a test at the
 * wrong release the way a hard-coded id (old or newly "derived-…") would.
 */
function pickRelease(
  state: ReturnType<typeof seeded>,
  predicate: (candidate: ReturnType<typeof seeded>["bedReleases"][number]) => boolean,
  description: string,
) {
  const found = state.bedReleases.find(predicate);
  if (!found) throw new Error(`seed state carries no bed release matching: ${description}`);
  return found;
}

// `releaseBand(...) !== "beyond-today"` matters wherever a test reads `capacityBreakdown`'s
// confirmed/expected/blocked counts: `capacityBreakdown` excludes any release more than a day out
// from those counts entirely (see that function's own `excludedBeyondToday` branch), so a picker
// feeding a count-sensitive test must stay inside that horizon or the action under test would move
// nothing the test can see.
function expectedUnblockedRelease(state: ReturnType<typeof seeded>) {
  return pickRelease(
    state,
    (r) => r.state === "expected" && r.blocker === null && releaseBand(r, NOW) !== "beyond-today",
    "expected, unblocked, within today's horizon",
  );
}

function confirmedRelease(state: ReturnType<typeof seeded>) {
  return pickRelease(state, (r) => r.state === "confirmed", "confirmed");
}

function confirmedUnblockedRelease(state: ReturnType<typeof seeded>) {
  return pickRelease(
    state,
    (r) => r.state === "confirmed" && r.blocker === null && releaseBand(r, NOW) !== "beyond-today",
    "confirmed, unblocked, within today's horizon",
  );
}

function confirmedBlockedRelease(state: ReturnType<typeof seeded>) {
  return pickRelease(
    state,
    (r) => r.state === "confirmed" && r.blocker !== null && releaseBand(r, NOW) !== "beyond-today",
    "confirmed, blocked, within today's horizon",
  );
}

function dischargedRelease(state: ReturnType<typeof seeded>) {
  return pickRelease(state, (r) => r.state === "discharged", "discharged");
}

function dischargedReleaseWithSpareCapacity(state: ReturnType<typeof seeded>) {
  return pickRelease(
    state,
    (r) =>
      r.state === "discharged" &&
      !r.preparing &&
      capacityBreakdown(unit(state, r.unitId), state.bedReleases, state.leaveBeds, NOW).availableNow > 0,
    "discharged, not yet being made ready, on a unit with spare availableNow capacity",
  );
}

// Mirrors `RECORD_LEAVING`'s own in-transit guard in `ward-flow-reducer.ts` (matched here by
// `admissionId` only — never `patientId`, which `tests/ward-patient-link-default-deny.test.ts`
// default-denies reading outside an allowlisted file) so a picker never hands a test an admission
// that `RECORD_LEAVING` would refuse for an unrelated reason (an ambulance mid-transfer).
function safeToRecordLeaving(state: ReturnType<typeof seeded>, admissionId: string) {
  const linkedMovement = state.movements.find((m) => m.admissionId === admissionId);
  if (!linkedMovement) return true;
  if (linkedMovement.stage === "moving") return false;
  if (
    linkedMovement.transport?.collectedAt !== undefined &&
    linkedMovement.transport.arrivedAt === undefined &&
    linkedMovement.transport.cancelledAt === undefined
  ) {
    return false;
  }
  return true;
}

function releaseSafeToComplete(
  state: ReturnType<typeof seeded>,
  predicate: (candidate: ReturnType<typeof seeded>["bedReleases"][number]) => boolean,
  description: string,
) {
  return pickRelease(
    state,
    (r) => predicate(r) && safeToRecordLeaving(state, r.admissionId),
    `${description}, safe to RECORD_LEAVING`,
  );
}

describe("ward bed release lifecycle", () => {
  it("1. a ward confirms a expected release", () => {
    // CHANGED 25 September 2026: WR-002 no longer exists (owner decision 2026-09-25 replaced the
    // hand-authored fixture with `derivedBedReleases`) — picks a fresh expected, unblocked release
    // at runtime instead of the old hard-coded id.
    const state = seeded();
    const target = expectedUnblockedRelease(state);
    expect(target.state).toBe("expected");
    const next = wardFlowReducer(state, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
    });
    expect(next.rejections).toHaveLength(0);
    expect(release(next, target.id).state).toBe("confirmed");
    expect(release(next, target.id).waitingOn).toBeNull();
  });

  it("fix round 2 (Finding 3, P2, spec D7): confirming at a later instant moves confirmedAt to that instant, not the original flag time", () => {
    // CHANGED 25 September 2026: WR-002 no longer exists; picks a fresh expected, unblocked release
    // at runtime instead. Before the ORIGINAL fix, every accepted transition spread `...release`,
    // keeping that ORIGINAL confirmedAt forever, so `WardFreshness` on this row would report when
    // the release was first flagged rather than when its current state (confirmed) was actually
    // last reported.
    const state = seeded();
    const target = expectedUnblockedRelease(state);
    const originalConfirmedAt = target.confirmedAt;
    const laterInstant = NOW + 45;
    expect(laterInstant).not.toBe(originalConfirmedAt);

    const next = wardFlowReducer(state, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: laterInstant,
      releaseId: target.id,
      actingUnitId: target.unitId,
    });

    expect(next.rejections).toHaveLength(0);
    // ⚠️ THE CHANGE IS THE POINT OF THIS TEST, so it is asserted first. `originalConfirmedAt`
    // is pinned different from `laterInstant` at the top of this test, so once the exact
    // `.toBe` passed this line could not fail — the one assertion carrying the actual claim,
    // that the timestamp MOVED, was the one that could not report it. Ordered this way both
    // are live.
    expect(release(next, target.id).confirmedAt).not.toBe(originalConfirmedAt);
    expect(release(next, target.id).confirmedAt).toBe(laterInstant);
  });

  /**
   * Bed-model rework (2026-08-28). This used to assert `state === "blocked"` and a null
   * waiting-on value — the fourth state swallowing the row's stage. Blocking is now a FLAG: the
   * stage is untouched, so a expected release stays expected and keeps the value it was flagged
   * with, and the role that recorded the block is stored beside the reason.
   */
  it("2. a ward blocks a release with a blocker from the list — the flag goes on, the stage does not move", () => {
    // CHANGED 25 September 2026: WR-002 no longer exists; picks a fresh expected, unblocked
    // release at runtime instead, and derives the expected `blockedBy` role from the release's
    // own unit rather than the old hard-coded "NUM Mental Health Unit" (that was scgh-adult-open's
    // name, which the runtime pick is no longer guaranteed to land on).
    const state = seeded();
    const [blocker] = BED_RELEASE_BLOCKERS;
    const target = expectedUnblockedRelease(state);
    expect(target.state).toBe("expected");
    const next = wardFlowReducer(state, {
      type: "BLOCK_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
      blocker,
    });
    expect(next.rejections).toHaveLength(0);
    expect(release(next, target.id).state).toBe("expected");
    expect(release(next, target.id).blocker).toBe(blocker);
    expect(release(next, target.id).blockedBy).toBe(`NUM ${unit(state, target.unitId).name}`);
    expect(release(next, target.id).waitingOn).toBe(target.waitingOn);
  });

  /**
   * THE case the whole rework exists for, proved end to end through the reducer rather than only
   * against `capacityBreakdown`'s arithmetic. A ward confirms a discharge, then reports it stuck.
   * Under the four-stage model the second event moved the release into `"blocked"`, which
   * `capacityBreakdown` counted in neither `confirmedToday` nor `expectedToday` — so the ward's
   * confirmed count fell by one at the exact moment it got stuck, with nothing saying why.
   */
  it("2b. blocking a CONFIRMED release leaves it confirmed, still counted as confirmed, and reported as blocked", () => {
    // CHANGED 25 September 2026: WR-001 no longer exists; picks a fresh confirmed, unblocked
    // release at runtime instead.
    const state = seeded();
    const target = confirmedUnblockedRelease(state);
    expect(target.state).toBe("confirmed");
    const before = capacityBreakdown(unit(state, target.unitId), state.bedReleases, state.leaveBeds, NOW);

    const next = wardFlowReducer(state, {
      type: "BLOCK_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
      blocker: BED_RELEASE_BLOCKERS[0],
    });
    expect(next.rejections).toHaveLength(0);
    expect(release(next, target.id).state).toBe("confirmed");

    const after = capacityBreakdown(unit(next, target.unitId), next.bedReleases, next.leaveBeds, NOW);
    expect(before.confirmedToday).toBeGreaterThan(0);
    expect(after.confirmedToday).toBe(before.confirmedToday);
    expect(after.blockedToday).toBe(before.blockedToday + 1);
  });

  /** The flag comes off without touching the stage either — the mirror of 2b. */
  it("2c. clearing the block leaves the stage alone and drops the blocked count", () => {
    // CHANGED 25 September 2026: WR-001 no longer exists; picks a fresh confirmed, unblocked
    // release at runtime, and compares the blocked count against this unit's OWN baseline rather
    // than a hard-coded 0 — a derived unit can carry other, unrelated blocked releases from the
    // seed that an absolute 0 would have missed.
    const state = seeded();
    const target = confirmedUnblockedRelease(state);
    const baseline = capacityBreakdown(unit(state, target.unitId), state.bedReleases, state.leaveBeds, NOW);
    const blocked = wardFlowReducer(state, {
      type: "BLOCK_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
      blocker: BED_RELEASE_BLOCKERS[0],
    });
    const cleared = wardFlowReducer(blocked, {
      type: "CLEAR_BED_RELEASE_BLOCK",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
    });
    expect(cleared.rejections).toHaveLength(0);
    expect(release(cleared, target.id).state).toBe("confirmed");
    expect(release(cleared, target.id).blocker).toBeNull();
    expect(release(cleared, target.id).blockedBy).toBeNull();
    expect(
      capacityBreakdown(unit(cleared, target.unitId), cleared.bedReleases, cleared.leaveBeds, NOW).blockedToday,
    ).toBe(baseline.blockedToday);
  });

  /**
   * The reversal the four-stage model forbade. Forbidding it never stopped a ward reversing a
   * decision — it only stopped the ward recording it, which is worse. The blocked flag survives,
   * because reversing the discharge decision does not unstick the bed.
   */
  it("2d. a ward reverts a confirmed release back to expected, keeping any block", () => {
    // CHANGED 25 September 2026: WR-007 no longer exists; picks a fresh confirmed-AND-blocked
    // release at runtime instead — the same blocked-but-confirmed shape.
    const state = seeded();
    const target = confirmedBlockedRelease(state);
    expect(target.state).toBe("confirmed");
    expect(target.blocker).not.toBeNull();

    const next = wardFlowReducer(state, {
      type: "REVERT_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
      waitingOn: "Nothing outstanding",
    });
    expect(next.rejections).toHaveLength(0);
    expect(release(next, target.id).state).toBe("expected");
    expect(release(next, target.id).waitingOn).toBe("Nothing outstanding");
    expect(release(next, target.id).blocker).toBe(target.blocker);
  });

  it("2e. a ward may not revert a release that is not confirmed — rejected, release unchanged", () => {
    // CHANGED 25 September 2026: WR-002 no longer exists; picks a fresh expected, unblocked
    // release at runtime instead.
    const state = seeded();
    const target = expectedUnblockedRelease(state);
    expect(target.state).toBe("expected");
    const next = wardFlowReducer(state, {
      type: "REVERT_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
      waitingOn: "Awaiting ward round",
    });
    expect(next.rejections).toHaveLength(1);
    expect(release(next, target.id)).toEqual(target);
  });

  /**
   * Q4 (2026-08-28): the preparation indication is INFORMATIONAL and gates nothing. Proved
   * against the unit's own bed figures, which is where a gating implementation would have to
   * write — `capacityBreakdown`'s `availableNow` reads those and never a release.
   */
  it("2f. marking a released bed as being made ready changes no bed figure at all", () => {
    // CHANGED 25 September 2026: WR-008 no longer exists. The picker takes a released bed that is
    // not already being made ready (the seed authors one that is, at Armadale), so before and after
    // genuinely differ without a reset step. The property under test is unchanged.
    const state = seeded();
    const target = dischargedReleaseWithSpareCapacity(state);
    expect(target.state).toBe("discharged");
    expect(target.preparing).toBe(false);
    const before = capacityBreakdown(unit(state, target.unitId), state.bedReleases, state.leaveBeds, NOW);

    const next = wardFlowReducer(state, {
      type: "SET_BED_PREPARATION",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
      preparing: true,
      // List 3 (2026-08-28): a REAL note, where an earlier version of this test asserted `null`
      // because `BED_PREPARATION_NOTES` was empty and no caller could supply one. The assertion is
      // strengthened rather than dropped — the note now has to round-trip AND still change no
      // figure.
      note: "Being cleaned",
    });
    expect(next.rejections).toHaveLength(0);
    expect(release(next, target.id).preparing).toBe(true);
    expect(release(next, target.id).preparationNote).toBe("Being cleaned");

    const after = capacityBreakdown(unit(next, target.unitId), next.bedReleases, next.leaveBeds, NOW);
    expect(after).toEqual(before);
    // Non-vacuity: this unit really does have a bed to withhold, so a gating implementation had
    // somewhere to go wrong.
    expect(after.availableNow).toBeGreaterThan(0);
  });

  /**
   * List 3 (2026-08-28), the two halves the reducer has always claimed and could never be shown:
   * a note outside `BED_PREPARATION_NOTES` is REFUSED, and clearing `preparing` clears the note
   * with it. Neither was testable while the array was empty — every note was refused, so a guard
   * that refused everything and a guard that checked membership were indistinguishable.
   */
  it("2h. refuses a preparation note outside BED_PREPARATION_NOTES, and clearing the flag clears the note", () => {
    // CHANGED 25 September 2026: WR-008 no longer exists; picks a fresh discharged release at
    // runtime instead.
    const state = seeded();
    const target = dischargedRelease(state);
    const refused = wardFlowReducer(state, {
      type: "SET_BED_PREPARATION",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
      preparing: true,
      // Deliberately plausible-looking and deliberately NOT on the owner's list. A truthiness
      // check would accept it; only real membership refuses it.
      note: "Awaiting a deep clean" as unknown as (typeof BED_PREPARATION_NOTES)[number],
    });
    expect(refused.rejections).toHaveLength(1);
    expect(refused.rejections[0]?.reason).toContain("BED_PREPARATION_NOTES");
    expect(release(refused, target.id).preparationNote).toBe(release(state, target.id).preparationNote);

    const noted = wardFlowReducer(state, {
      type: "SET_BED_PREPARATION",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
      preparing: true,
      note: "Awaiting maintenance or repair",
    });
    expect(release(noted, target.id).preparationNote).toBe("Awaiting maintenance or repair");

    const cleared = wardFlowReducer(noted, {
      type: "SET_BED_PREPARATION",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
      preparing: false,
    });
    // "not being made ready, waiting on a clean" is a contradiction, so the note goes with it.
    expect(release(cleared, target.id).preparing).toBe(false);
    expect(release(cleared, target.id).preparationNote).toBeNull();
  });

  /**
   * Confirming a stuck prediction must KEEP the flag. This is the counting defect approached from
   * the other end: if confirmation quietly cleared the block, the system would assert the bed was
   * unstuck because somebody decided the discharge, and "how many confirmed discharges are stuck"
   * — the question the four-stage model structurally could not answer — would read zero forever.
   */
  it("2g. confirming a blocked prediction keeps the flag, and the bed counts as confirmed AND blocked", () => {
    // CHANGED 25 September 2026: WR-002 no longer exists; picks a fresh expected, unblocked
    // release at runtime, and asserts the counts as a DELTA off this unit's own baseline rather
    // than the absolute values 1/1 — a derived unit can carry other releases from the seed that an
    // absolute count would have missed.
    const state = seeded();
    const target = expectedUnblockedRelease(state);
    const baseline = capacityBreakdown(unit(state, target.unitId), state.bedReleases, state.leaveBeds, NOW);
    const blocked = wardFlowReducer(state, {
      type: "BLOCK_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
      blocker: BED_RELEASE_BLOCKERS[0],
    });
    const confirmed = wardFlowReducer(blocked, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
    });

    expect(confirmed.rejections).toHaveLength(0);
    expect(release(confirmed, target.id).state).toBe("confirmed");
    expect(release(confirmed, target.id).blocker).toBe(BED_RELEASE_BLOCKERS[0]);
    expect(release(confirmed, target.id).blockedBy).toBe(`NUM ${unit(state, target.unitId).name}`);

    const after = capacityBreakdown(unit(confirmed, target.unitId), confirmed.bedReleases, confirmed.leaveBeds, NOW);
    expect(after.confirmedToday).toBe(baseline.confirmedToday + 1);
    expect(after.blockedToday).toBe(baseline.blockedToday + 1);
  });

  it("3. a ward blocks with no blocker — rejected, release unchanged", () => {
    // CHANGED 25 September 2026: WR-002 no longer exists; picks a fresh expected, unblocked
    // release at runtime instead. A typed caller cannot omit `blocker` — BLOCK_BED_RELEASE
    // requires it. The invalid event is constructed only for this runtime-refusal test, never by
    // widening the event type itself.
    const state = seeded();
    const target = expectedUnblockedRelease(state);
    const invalidEvent = {
      type: "BLOCK_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
      blocker: "",
    } as unknown as WardFlowEvent;
    const next = wardFlowReducer(state, invalidEvent);
    expect(next.rejections).toHaveLength(1);
    expect(release(next, target.id)).toEqual(target);
  });

  it("3b. a ward blocks with a blocker outside BED_RELEASE_BLOCKERS — rejected, release unchanged (review Finding 1)", () => {
    // Review Finding 1: the reducer's own guard was `if (!event.blocker)`, a truthiness test —
    // it refuses only a missing or empty value, so any other non-empty string reached this far
    // and was stored verbatim. This is the case truthiness alone cannot catch: a non-empty,
    // non-member string. A typed caller cannot construct this event with such a value — the
    // invalid event is constructed only for this runtime-refusal test, never by widening the
    // event type itself, mirroring test 3 above.
    // CHANGED 25 September 2026: WR-002 no longer exists; picks a fresh expected, unblocked
    // release at runtime instead.
    const state = seeded();
    const target = expectedUnblockedRelease(state);
    const invalidEvent = {
      type: "BLOCK_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
      blocker: "Awaiting a family decision",
    } as unknown as WardFlowEvent;
    const next = wardFlowReducer(state, invalidEvent);
    expect(next.rejections).toHaveLength(1);
    expect(release(next, target.id)).toEqual(target);
  });

  it("4. RELEASE_BED is refused while its admission is occupied; recording the leaving completes the release and availableNow rises by one", () => {
    // CHANGED 25 September 2026: owner decision 2026-09-25 made a bed release complete only once
    // its named admission has actually left (RECORD_LEAVING -> `departAdmission`), never directly
    // through RELEASE_BED while the person is still occupying the bed — see the reducer's own
    // RELEASE_BED and `departAdmission` comments. This test used to dispatch RELEASE_BED straight
    // on a confirmed release and expect the bed to free immediately; that path is now refused, so
    // the test pins the refusal AND completes the discharge the new way, keeping the same
    // "availableNow rises by one" claim the test always existed to prove.
    const state = seeded();
    const target = releaseSafeToComplete(
      state,
      (r) => r.state === "confirmed" && r.blocker === null,
      "confirmed, unblocked",
    );
    const before = capacityBreakdown(unit(state, target.unitId), state.bedReleases, state.leaveBeds, NOW);

    const refused = wardFlowReducer(state, {
      type: "RELEASE_BED",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
    });
    expect(refused.rejections).toHaveLength(1);
    expect(release(refused, target.id)).toEqual(target);

    const left = wardFlowReducer(state, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW,
      admissionId: target.admissionId,
      actingUnitId: target.unitId,
      leavingDestination: "moved-to-residential-care",
    });
    expect(left.rejections).toHaveLength(0);
    expect(release(left, target.id).state).toBe("discharged");
    expect(release(left, target.id).waitingOn).toBeNull();
    expect(release(left, target.id).blocker).toBeNull();
    const after = capacityBreakdown(unit(left, target.unitId), left.bedReleases, left.leaveBeds, NOW);
    expect(after.availableNow).toBe(before.availableNow + 1);
  });

  it("fix round 1 (Critical): recording a leaving at full vacancy still reconciles to unit.beds", () => {
    // CHANGED 25 September 2026: RELEASE_BED no longer moves any bed figure at all once accepted —
    // `departureAlreadyIncremented` is now a hard-coded `true` in the reducer's RELEASE_BED case,
    // because the figure this test exists to clamp only ever moves through `departAdmission`
    // (reached via RECORD_LEAVING) now. The test is rewritten to exercise RECORD_LEAVING, which is
    // where that clamp actually runs; the reconciliation identity being proved is unchanged.
    // The picked release's unit is seeded nowhere near the ceiling — forcing it to full physical
    // vacancy (every bed already empty and allocatable) makes `departAdmission`'s own +1 writes
    // the ones that would walk `empty.value` past `unit.beds` if its clamp were ever removed — the
    // exact worked failure from the original review: beds=5, empty.value=5, allocatable.value=5 ->
    // a bare +1 gives empty.value=6, allocatable.value=6, and `unitCapacity` then reports
    // available=6, held=0, blocked=0, occupied=0 against a 5-bed unit.
    const state = seeded();
    const target = releaseSafeToComplete(
      state,
      (r) => r.state === "confirmed" && r.blocker === null,
      "confirmed, unblocked",
    );
    const targetUnit = unit(state, target.unitId);
    // Forcing a unit to full physical vacancy (every bed already empty and allocatable) while
    // someone is still recorded as departing it is a fiction the test constructs on purpose — and
    // `unitCapacity`'s `occupied` deliberately reflects true patient load off `sexMix` even past
    // that forced vacancy (see that function's own comment), which would make the reconciliation
    // identity below fail for a reason that has nothing to do with the clamp this test exists to
    // prove. The ORIGINAL fixture unit this test hard-coded (rph-adult-secure) carried a `sexMix`
    // consistent with the fiction; a unit picked at runtime is not guaranteed to, so `sexMix` is
    // zeroed here alongside `empty`/`allocatable` to keep the fiction internally consistent, the
    // same way the original fixture already was.
    const fullyVacant = {
      ...state,
      units: state.units.map((candidate) =>
        candidate.id === targetUnit.id
          ? {
              ...candidate,
              empty: { ...candidate.empty, value: candidate.beds },
              allocatable: { ...candidate.allocatable, value: candidate.beds },
              sexMix: Object.fromEntries(
                Object.keys(candidate.sexMix).map((key) => [key, 0]),
              ) as typeof candidate.sexMix,
            }
          : candidate,
      ),
    };
    // The picked release belongs to `targetUnit` and is seeded confirmed — a legal RECORD_LEAVING
    // target once its admission departs.
    expect(release(fullyVacant, target.id).state).toBe("confirmed");

    const next = wardFlowReducer(fullyVacant, {
      type: "RECORD_LEAVING",
      role: "ward",
      now: NOW,
      admissionId: target.admissionId,
      actingUnitId: target.unitId,
      leavingDestination: "moved-to-residential-care",
    });

    expect(next.rejections).toHaveLength(0);
    expect(release(next, target.id).state).toBe("discharged");
    const afterUnit = unit(next, target.unitId);
    // The reconciliation identity ruling 3 requires (see tests/ward-capacity-reconciliation.test.ts):
    // the four bed-state figures must sum to exactly the unit's own bed count, whatever the
    // unit's numbers were coming in.
    const capacity = unitCapacity(afterUnit, next.bedReleases);
    expect(capacity.available + capacity.held + capacity.blocked + capacity.occupied).toBe(afterUnit.beds);
    // And neither field was allowed to walk past the physical ceiling that produced the failure.
    expect(afterUnit.empty.value).toBeLessThanOrEqual(afterUnit.beds);
    expect(afterUnit.allocatable.value).toBeLessThanOrEqual(afterUnit.beds);
  });

  /** Spec D2, extended by the 2026-08-28 rework to the three events it added: only the ward moves
   *  a bed between stages, flags it stuck or unstuck, or says it is being made ready. */
  it("5. a coordinator may not confirm, revert, block, unblock, prepare or release a bed — six rejections, no state change (spec D2)", () => {
    // CHANGED 25 September 2026: WR-002/WR-001 no longer exist; picks two fresh releases at
    // runtime instead (an expected-unblocked one and a confirmed-unblocked one). Their exact shape
    // does not matter here, since every one of these six events is refused on ROLE alone, before
    // the reducer ever inspects the release itself.
    const state = seeded();
    const targetA = expectedUnblockedRelease(state);
    const targetB = confirmedUnblockedRelease(state);

    const afterConfirm = wardFlowReducer(state, {
      type: "CONFIRM_BED_RELEASE",
      role: "coordinator",
      now: NOW,
      releaseId: targetA.id,
      actingUnitId: targetA.unitId,
    });
    const afterBlock = wardFlowReducer(afterConfirm, {
      type: "BLOCK_BED_RELEASE",
      role: "coordinator",
      now: NOW,
      releaseId: targetA.id,
      actingUnitId: targetA.unitId,
      blocker: BED_RELEASE_BLOCKERS[0],
    });
    const afterRevert = wardFlowReducer(afterBlock, {
      type: "REVERT_BED_RELEASE",
      role: "coordinator",
      now: NOW,
      releaseId: targetB.id,
      actingUnitId: targetB.unitId,
      waitingOn: "Awaiting ward round",
    });
    const afterUnblock = wardFlowReducer(afterRevert, {
      type: "CLEAR_BED_RELEASE_BLOCK",
      role: "coordinator",
      now: NOW,
      releaseId: targetA.id,
      actingUnitId: targetA.unitId,
    });
    const afterPrepare = wardFlowReducer(afterUnblock, {
      type: "SET_BED_PREPARATION",
      role: "coordinator",
      now: NOW,
      releaseId: targetB.id,
      actingUnitId: targetB.unitId,
      preparing: true,
    });
    const afterRelease = wardFlowReducer(afterPrepare, {
      type: "RELEASE_BED",
      role: "coordinator",
      now: NOW,
      releaseId: targetB.id,
      actingUnitId: targetB.unitId,
    });

    expect(afterRelease.rejections).toHaveLength(6);
    expect(release(afterRelease, targetA.id)).toEqual(targetA);
    expect(release(afterRelease, targetB.id)).toEqual(targetB);
  });

  it("6. a ward whose actingUnitId does not match the release's unitId is rejected", () => {
    // CHANGED 25 September 2026: WR-002 no longer exists; picks a fresh release and a genuinely
    // different unit id from the seed at runtime instead of two hard-coded unit ids.
    const state = seeded();
    const target = expectedUnblockedRelease(state);
    const wrongUnit = state.units.find((candidate) => candidate.id !== target.unitId);
    if (!wrongUnit) throw new Error("seed state has only one unit");
    const before = release(state, target.id);
    const next = wardFlowReducer(state, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      // Deliberately a real but WRONG unit.
      actingUnitId: wrongUnit.id,
    });
    expect(next.rejections).toHaveLength(1);
    expect(release(next, target.id)).toEqual(before);
  });

  it("7. RECORD_LEAVE_BED adds a leave bed; END_LEAVE_BED removes it", () => {
    const state = seeded();
    const startCount = state.leaveBeds.length;
    // A leave bed names its stay (owner ruling 2026-09-25): an occupant on this ward not already on leave.
    const person = occupantsNotOnLeave(state, "fsh-older-adult")[0];
    const afterRecord = wardFlowReducer(state, {
      type: "RECORD_LEAVE_BED",
      role: "ward",
      now: NOW,
      unitId: "fsh-older-adult",
      actingUnitId: "fsh-older-adult",
      admissionId: person.id,
      expectedReturn: NOW + 200,
    });
    expect(afterRecord.rejections).toHaveLength(0);
    expect(afterRecord.leaveBeds).toHaveLength(startCount + 1);
    const created = afterRecord.leaveBeds.find((bed) => !state.leaveBeds.some((seed) => seed.id === bed.id));
    if (!created) throw new Error("no new leave bed was created");
    expect(created.unitId).toBe("fsh-older-adult");
    // Was `expect(created.usable).toBe(true)`. `LeaveBed.usable` was removed on 2026-09-06 by
    // owner ruling — a ward cannot know whether a bed is fillable while its occupant is away — so
    // what the reducer is pinned to carry through is the one fact the form still asks for, plus
    // the absence of any reinstated fillability claim.
    expect(created.expectedReturn).toBe(NOW + 200);
    expect(Object.keys(created)).not.toContain("usable");

    const afterEnd = wardFlowReducer(afterRecord, {
      type: "END_LEAVE_BED",
      role: "ward",
      now: NOW,
      leaveBedId: created.id,
      actingUnitId: "fsh-older-adult",
    });
    expect(afterEnd.rejections).toHaveLength(0);
    expect(afterEnd.leaveBeds).toHaveLength(startCount);
    expect(afterEnd.leaveBeds.some((bed) => bed.id === created.id)).toBe(false);
  });

  it("fix round 2 (Finding 2, P2): leave-bed ids never collide after one is ended — record, record, end the first, record", () => {
    // Reviewer's exact repro: before the fix, `RECORD_LEAVE_BED` derived its id from
    // `state.leaveBeds.length`. `END_LEAVE_BED` REMOVES entries, so the length falls back down
    // and a later record can be assigned an id already in use by an earlier, still-live record.
    // React then sees duplicate `key`s, and `END_LEAVE_BED`'s own id-filter removes EVERY leave
    // bed sharing that id — ending one silently deletes two.
    const state = seeded();
    const unitId = "fsh-older-adult";
    // Three different people: a stay can hold only one live leave (owner ruling 2026-09-25).
    const [personA, personB, personC] = occupantsNotOnLeave(state, unitId);

    const afterFirst = wardFlowReducer(state, {
      type: "RECORD_LEAVE_BED",
      role: "ward",
      now: NOW,
      unitId,
      actingUnitId: unitId,
      admissionId: personA.id,
      expectedReturn: NOW + 100,
    });
    const first = afterFirst.leaveBeds.find((bed) => !state.leaveBeds.some((seed) => seed.id === bed.id));
    if (!first) throw new Error("no first leave bed was created");

    const afterSecond = wardFlowReducer(afterFirst, {
      type: "RECORD_LEAVE_BED",
      role: "ward",
      now: NOW,
      unitId,
      actingUnitId: unitId,
      admissionId: personB.id,
      expectedReturn: NOW + 200,
    });
    const second = afterSecond.leaveBeds.find(
      (bed) => bed.id !== first.id && !state.leaveBeds.some((seed) => seed.id === bed.id),
    );
    if (!second) throw new Error("no second leave bed was created");
    expect(second.id).not.toBe(first.id);

    const afterEndFirst = wardFlowReducer(afterSecond, {
      type: "END_LEAVE_BED",
      role: "ward",
      now: NOW,
      leaveBedId: first.id,
      actingUnitId: unitId,
    });
    // Ending the first removes EXACTLY that one record — the second, still-live record survives.
    expect(afterEndFirst.leaveBeds.some((bed) => bed.id === first.id)).toBe(false);
    expect(afterEndFirst.leaveBeds.some((bed) => bed.id === second.id)).toBe(true);

    const afterThird = wardFlowReducer(afterEndFirst, {
      type: "RECORD_LEAVE_BED",
      role: "ward",
      now: NOW,
      unitId,
      actingUnitId: unitId,
      admissionId: personC.id,
      expectedReturn: NOW + 300,
    });
    const third = afterThird.leaveBeds.find(
      (bed) => bed.id !== second.id && !state.leaveBeds.some((seed) => seed.id === bed.id) && bed.id !== first.id,
    );
    if (!third) throw new Error("no third leave bed was created");

    // Three distinct ids across the whole sequence — the third must never reuse the first's id,
    // which is exactly what a length-based id (2 live records -> length 2 -> same id as a record
    // ended earlier) would do.
    expect(new Set([first.id, second.id, third.id]).size).toBe(3);

    // Ending the second now removes exactly that one record too — the third survives.
    const afterEndSecond = wardFlowReducer(afterThird, {
      type: "END_LEAVE_BED",
      role: "ward",
      now: NOW,
      leaveBedId: second.id,
      actingUnitId: unitId,
    });
    expect(afterEndSecond.leaveBeds.some((bed) => bed.id === second.id)).toBe(false);
    expect(afterEndSecond.leaveBeds.some((bed) => bed.id === third.id)).toBe(true);
  });

  it("fix round 1 (Minor coverage): RECORD_LEAVE_BED refuses an unknown unit, leaving leaveBeds unchanged", () => {
    const state = seeded();
    const next = wardFlowReducer(state, {
      type: "RECORD_LEAVE_BED",
      role: "ward",
      now: NOW,
      unitId: "not-a-real-unit",
      actingUnitId: "not-a-real-unit",
      admissionId: state.admissions.find((a) => a.state === "occupied")!.id,
      expectedReturn: NOW + 100,
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.leaveBeds).toEqual(state.leaveBeds);
  });

  it("fix round 1 (Minor coverage): RECORD_LEAVE_BED refuses an actingUnitId mismatch, leaving leaveBeds unchanged", () => {
    const state = seeded();
    const next = wardFlowReducer(state, {
      type: "RECORD_LEAVE_BED",
      role: "ward",
      now: NOW,
      unitId: "fsh-older-adult",
      actingUnitId: "rph-adult-secure",
      admissionId: occupantsNotOnLeave(state, "fsh-older-adult")[0].id,
      expectedReturn: NOW + 100,
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.leaveBeds).toEqual(state.leaveBeds);
  });

  it("fix round 1 (Minor coverage): END_LEAVE_BED refuses an unknown leave bed, leaving leaveBeds unchanged", () => {
    const state = seeded();
    const next = wardFlowReducer(state, {
      type: "END_LEAVE_BED",
      role: "ward",
      now: NOW,
      leaveBedId: "WL-not-real",
      actingUnitId: "rph-adult-secure",
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.leaveBeds).toEqual(state.leaveBeds);
  });

  it("fix round 1 (Minor coverage): END_LEAVE_BED refuses an actingUnitId mismatch, leaving the record unchanged", () => {
    const state = seeded();
    // WL-001 belongs to rph-adult-secure.
    const before = state.leaveBeds.find((bed) => bed.id === "WL-001");
    if (!before) throw new Error("fixture is missing WL-001");
    const next = wardFlowReducer(state, {
      type: "END_LEAVE_BED",
      role: "ward",
      now: NOW,
      leaveBedId: "WL-001",
      actingUnitId: "scgh-adult-open",
    });
    expect(next.rejections).toHaveLength(1);
    const after = next.leaveBeds.find((bed) => bed.id === "WL-001");
    expect(after).toEqual(before);
    expect(next.leaveBeds).toEqual(state.leaveBeds);
  });

  it("8. a coordinator's REQUEST_CAPACITY_REFRESH is accepted and changes no bed figure (spec D12)", () => {
    const state = seeded();
    const before = capacityBreakdown(unit(state, "rph-adult-secure"), state.bedReleases, state.leaveBeds, NOW);
    const next = wardFlowReducer(state, {
      type: "REQUEST_CAPACITY_REFRESH",
      role: "coordinator",
      now: NOW,
      unitId: "rph-adult-secure",
    });
    expect(next.rejections).toHaveLength(0);
    expect(next.refreshRequests).toHaveLength(1);
    expect(next.refreshRequests[0]).toEqual({ unitId: "rph-adult-secure", at: NOW, byRole: "coordinator" });
    const after = capacityBreakdown(unit(next, "rph-adult-secure"), next.bedReleases, next.leaveBeds, NOW);
    expect(after).toEqual(before);
  });

  // CHANGED 25 September 2026: WR-001/WR-002/WR-007/WR-008 no longer exist, so this comment's own
  // named examples are rewritten to match — the underlying point is unchanged.
  // L66: this model has only three `state` values (expected/confirmed/discharged, "Bed-model
  // rework (2026-08-28)" above) — blocking is a separate flag, not a fourth state — so the
  // untested refusal branches are CONFIRM_BED_RELEASE and RELEASE_BED on a release that is not
  // in the state the event requires, and BLOCK_BED_RELEASE on a discharged release. Every ward
  // test above only ever dispatches these against an expected or a confirmed release and never
  // asserts a refusal string, so these cases close that gap on an already-confirmed release and
  // a discharged one, and pin the exact rejection text so a future silent-transition regression
  // on the ward capacity board's counts turns red.
  it("9. CONFIRM_BED_RELEASE on an already-confirmed release is refused with the exact text, state unchanged", () => {
    const state = seeded();
    const target = confirmedRelease(state);
    const before = release(state, target.id);
    const next = wardFlowReducer(state, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0]?.reason).toBe(`cannot move release ${target.id} from confirmed to confirmed`);
    expect(release(next, target.id)).toEqual(before);
  });

  it("10. CONFIRM_BED_RELEASE on a discharged release is refused with the exact text, state unchanged", () => {
    // CHANGED 25 September 2026: WR-008 no longer exists; picks a fresh discharged release at
    // runtime instead.
    const state = seeded();
    const target = dischargedRelease(state);
    const before = release(state, target.id);
    const next = wardFlowReducer(state, {
      type: "CONFIRM_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0]?.reason).toBe(`cannot move release ${target.id} from discharged to confirmed`);
    expect(release(next, target.id)).toEqual(before);
  });

  it("11. BLOCK_BED_RELEASE on a discharged release is refused with the exact text, state unchanged", () => {
    // CHANGED 25 September 2026: WR-008 no longer exists; picks a fresh discharged release at
    // runtime instead.
    const state = seeded();
    const target = dischargedRelease(state);
    const before = release(state, target.id);
    const next = wardFlowReducer(state, {
      type: "BLOCK_BED_RELEASE",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
      blocker: BED_RELEASE_BLOCKERS[0],
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.rejections[0]?.reason).toBe(`cannot block release ${target.id} because it is already released`);
    expect(release(next, target.id)).toEqual(before);
  });

  it("12. RELEASE_BED on a discharged release is refused with the exact text, state unchanged", () => {
    // CHANGED 25 September 2026: WR-008 no longer exists; picks a fresh discharged release at
    // runtime instead.
    const state = seeded();
    const target = dischargedRelease(state);
    const before = release(state, target.id);
    const next = wardFlowReducer(state, {
      type: "RELEASE_BED",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
    });
    expect(next.rejections).toHaveLength(1);
    // Reworded 2026-09-06: the message said "to released", and `released` stopped being the third
    // stage's name on 2026-08-30 — the owner ruled it `discharged`. A rejection is the one place
    // somebody reads when something has gone wrong, so it must not name a stage that does not
    // exist. Interpolating the stage as well produced "from discharged to discharged", a tautology
    // in the one message somebody reads when something has gone wrong — so it names the state once
    // and says what is actually refused. The transition being refused is unchanged.
    expect(next.rejections[0]?.reason).toBe(`release ${target.id} is already discharged and cannot be discharged again`);
    expect(release(next, target.id)).toEqual(before);
  });

  it("13. RELEASE_BED is refused while occupied; once the admission has departed it discharges the release but moves no figure", () => {
    // CHANGED 25 September 2026: owner decision 2026-09-25 made this test's original claim false —
    // RELEASE_BED no longer accepts `expected -> discharged` (or any transition) while the named
    // admission is still occupied; it is refused outright (see the reducer's own RELEASE_BED
    // comment). Rewritten to pin that refusal, then to prove the second half of the same rule: once
    // the admission has genuinely departed, RELEASE_BED completes a still-live release but writes
    // NO bed figure — `departureAlreadyIncremented` is a hard-coded `true` in RELEASE_BED now,
    // because the figure only ever moves through `departAdmission` (RECORD_LEAVING). Constructing an
    // already-departed admission whose release is still expected has to be done by hand here
    // (spreading state directly, the same technique "fix round 1 (Critical)" above uses) because
    // dispatching RECORD_LEAVING through the reducer discharges the linked release in the very same
    // step (`departAdmission`), leaving nothing not-yet-discharged for RELEASE_BED to act on.
    const state = seeded();
    const target = expectedUnblockedRelease(state);
    const beforeAdmission = admission(state, target.admissionId);
    expect(beforeAdmission.state).toBe("occupied");

    const refused = wardFlowReducer(state, {
      type: "RELEASE_BED",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
    });
    expect(refused.rejections).toHaveLength(1);
    expect(refused.rejections[0]?.reason).toBe(
      `release ${target.id} completes when admission ${target.admissionId} is recorded as having left (RECORD_LEAVING); they are still occupied`,
    );
    expect(release(refused, target.id)).toEqual(target);

    const departedButNotReleased = {
      ...state,
      admissions: state.admissions.map((candidate) =>
        candidate.id === beforeAdmission.id
          ? {
              ...candidate,
              state: "departed" as const,
              leftAt: NOW,
              leavingDestination: "moved-to-residential-care" as const,
            }
          : candidate,
      ),
    };
    const beforeUnit = unit(departedButNotReleased, target.unitId);

    const next = wardFlowReducer(departedButNotReleased, {
      type: "RELEASE_BED",
      role: "ward",
      now: NOW,
      releaseId: target.id,
      actingUnitId: target.unitId,
    });
    expect(next.rejections).toHaveLength(0);
    expect(release(next, target.id).state).toBe("discharged");
    expect(release(next, target.id).waitingOn).toBeNull();
    expect(release(next, target.id).blocker).toBeNull();
    const afterUnit = unit(next, target.unitId);
    // The point of this second half: RELEASE_BED moved the release's own STATE but wrote no bed
    // figure at all — the unit's empty/allocatable values are exactly what they were on the
    // hand-constructed (not-yet-incremented) state above.
    expect(afterUnit.empty.value).toBe(beforeUnit.empty.value);
    expect(afterUnit.allocatable.value).toBe(beforeUnit.allocatable.value);
  });
});
