// tests/ward-handover.test.ts
import { describe, expect, it } from "vitest";

import { handoverSnapshot, isOpen, transportLeg } from "../src/components/ward-management/ward-derivations";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import type { Movement } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const { movements, units } = seedWardFlowState();
const openMovements = movements.filter(isOpen);
const snapshot = handoverSnapshot(movements, units, NOW_ANCHOR);

type GoneWrongKind = "escalated" | "declined_by_all" | "acceptance_withdrawn";

/**
 * ⚠️ **AN INDEPENDENT ORACLE, NOT A COPY OF `handoverSnapshot`'S OWN EXPRESSION.** This test's
 * predicate used to be `movement.referredUnitIds.length === 0 && movement.declines.length > 0 &&
 * movement.acceptedUnitId === undefined` — letter-for-letter the same three clauses
 * `handoverSnapshot` computes with. A test built that way can never catch a defect IN that exact
 * expression, because the same defect is copied into the assertion: WF-23 (`ACCEPT_IN_PRINCIPLE`
 * emptying `referredUnitIds` on a movement with an earlier decline) reproduced itself here, and so
 * did item 20's later bug (`WITHDRAW_ACCEPTANCE` doing the same to `acceptedUnitId` without a
 * fresh decline). Both were caught only by fixture-pinned assertions further down this file, never
 * by this one.
 *
 * This version reasons from the record a different way: escalation wins outright; a movement
 * nobody is currently asking and nobody has accepted is stranded only once a decline is on file;
 * and when it also carries a withdrawn acceptance, the timing of the LATEST decline against the
 * LATEST withdrawal — not the current snapshot of `referredUnitIds`/`acceptedUnitId` alone —
 * decides which of the two states it is actually in.
 */
function classifyGoneWrong(movement: Movement): GoneWrongKind | undefined {
  if (movement.escalation !== undefined) return "escalated";
  if (movement.referredUnitIds.length > 0) return undefined;
  if (movement.acceptedUnitId !== undefined) return undefined;
  if (movement.declines.length === 0) return undefined;

  let lastDeclineAt = -Infinity;
  for (const decline of movement.declines) {
    if (decline.at > lastDeclineAt) lastDeclineAt = decline.at;
  }
  let lastWithdrawalAt = -Infinity;
  for (const unwind of movement.unwinds) {
    if (unwind.kind === "acceptance_withdrawn" && unwind.at > lastWithdrawalAt) lastWithdrawalAt = unwind.at;
  }

  return lastWithdrawalAt > lastDeclineAt ? "acceptance_withdrawn" : "declined_by_all";
}

describe("handoverSnapshot", () => {
  // The derivation is a pure function of `now` and stamps it as `takenAt`. It never froze —
  // the PAGE did, until OD-4 — and calling this "freezes" outlived that by one rename.
  it("stamps exactly the now it was called with", () => {
    expect(snapshot.takenAt).toBe(NOW_ANCHOR);
  });

  it("ranks every open movement by wait, strictly non-increasing, longest first", () => {
    expect(snapshot.longestWaits).toHaveLength(openMovements.length);
    expect(snapshot.longestWaits.map((entry) => entry.movement.id).sort()).toEqual(
      openMovements.map((movement) => movement.id).sort(),
    );

    const waits = snapshot.longestWaits.map((entry) => NOW_ANCHOR - entry.movement.openedAt);
    for (let index = 1; index < waits.length; index += 1) {
      expect(waits[index]).toBeLessThanOrEqual(waits[index - 1]);
    }

    const maxWait = Math.max(...openMovements.map((movement) => NOW_ANCHOR - movement.openedAt));
    expect(waits[0]).toBe(maxWait);
  });

  // A non-vacuity floor: the fixture carries 41 open movements at NOW_ANCHOR (measured, not
  // assumed). This fails the moment the fixture stops producing a real open caseload — a
  // breach-led handover with nothing left to rank would otherwise pass silently.
  it("a non-vacuity floor: the open caseload stays real, not near-empty", () => {
    expect(snapshot.longestWaits.length).toBeGreaterThan(30);
  });

  it("pulledBeds contains exactly the open movements carrying a pullExpiresAt, expired iff pullExpiresAt <= now", () => {
    const expectedIds = openMovements
      .filter((movement) => movement.pullExpiresAt !== undefined)
      .map((movement) => movement.id)
      .sort();
    expect(snapshot.pulledBeds.map((entry) => entry.movement.id).sort()).toEqual(expectedIds);

    // Measured against the real fixture at NOW_ANCHOR: 7 -> 9 beds held on 2026-09-17 (WF-024
    // pullExpiresAt +60, WF-029 pullExpiresAt +30 — both future, so the expired count is
    // unchanged). Pinned so a fixture change that silently drops a hold is caught here, not only
    // on screen.
    // 9 → 8: WF-024 removed (40-60 range), 17 Sept
    expect(snapshot.pulledBeds).toHaveLength(8);
    expect(snapshot.pulledBeds.filter((entry) => entry.expired)).toHaveLength(1);

    for (const entry of snapshot.pulledBeds) {
      const pullExpiresAt = entry.movement.pullExpiresAt;
      if (pullExpiresAt === undefined) {
        throw new Error(`${entry.movement.id} appears in pulledBeds without a pullExpiresAt`);
      }
      expect(entry.expired).toBe(pullExpiresAt <= NOW_ANCHOR);
    }
  });

  it("inTransit contains exactly the open movements carrying a transport job, each with its real leg", () => {
    const expectedIds = openMovements
      .filter((movement) => movement.transport !== undefined)
      .map((movement) => movement.id)
      .sort();
    expect(snapshot.inTransit.map((entry) => entry.movement.id).sort()).toEqual(expectedIds);

    // Measured against the real fixture at NOW_ANCHOR: 8 -> 13 on 2026-09-17 (WF-021, WF-025,
    // WF-026, WF-030, WF-031 sample-data addition — see ward-movements-derivations.test.ts for
    // each one's leg state).
    expect(snapshot.inTransit).toHaveLength(13);

    for (const entry of snapshot.inTransit) {
      expect(entry.leg).toBe(transportLeg(entry.movement.transport));
    }
  });

  it("placementGoneWrong lists an escalated, declined-by-all or acceptance-withdrawn movement exactly once each", () => {
    const expected = openMovements
      .map((movement) => ({ movement, kind: classifyGoneWrong(movement) }))
      .filter((entry): entry is { movement: Movement; kind: GoneWrongKind } => entry.kind !== undefined);
    const expectedIds = expected.map((entry) => entry.movement.id).sort();

    const actualIds = snapshot.placementGoneWrong.map((entry) => entry.movement.id);
    expect([...actualIds].sort()).toEqual(expectedIds);
    expect(new Set(actualIds).size).toBe(actualIds.length);

    const expectedKindById = new Map(expected.map((entry) => [entry.movement.id, entry.kind]));
    for (const entry of snapshot.placementGoneWrong) {
      expect(entry.kind).toBe(expectedKindById.get(entry.movement.id));
    }
  });

  // Measured against the real fixture at NOW_ANCHOR (2026-08-25): WF-009 is the only movement
  // carrying a recorded escalation, and no other movement satisfies declined-by-all once
  // WF-009's escalation claims it first. Pinned so a future fixture change that silently drops
  // the escalation, or adds a second stranded movement, is caught here rather than only in a
  // screenshot.
  //
  // 2026-09-17: WF-022 (a second escalation record, added deliberately beside WF-009's own —
  // `ward-movements.ts`'s own top comment) carries `escalation !== undefined`, so
  // `classifyGoneWrong` (this file's independent oracle, line 33 above) names it "escalated" the
  // same way it names WF-009. No other added movement (WF-021, WF-023..WF-031) carries a
  // referredUnitIds-empty, acceptedUnitId-empty, declined movement, so neither adds to this list
  // via declined_by_all or acceptance_withdrawn.
  it("matches the measured fixture: WF-009 and WF-022 escalated, nothing else stranded", () => {
    expect(
      snapshot.placementGoneWrong.map((entry) => entry.movement.id),
      "The handover's placement-gone-wrong list has changed. This is what one clinician hands the " +
        "next at shift change: the patients whose placement failed. An ADDITION means a movement " +
        "became stranded or lost its escalation record and fell through to declined-by-all - find " +
        "which before editing this. An EMPTY list is the worse failure, because the handover would " +
        "then look clean while a stranded patient exists, and nothing else in this file would be " +
        "red. Note the comment above still carries a 2026-08-25 basis date; this assertion passing " +
        "today confirms the claim, but the surrounding measurement has not been re-taken since.",
    ).toEqual(["WF-009", "WF-022"]);
    expect(
      snapshot.placementGoneWrong.map((entry) => entry.kind),
      "WF-009 and/or WF-022 are still in the handover but for a different reason, and this is the " +
        "assertion that notices. 'escalated' means somebody rang round and recorded which units " +
        "they tried; 'declined_by_all' means the network simply refused it and no one is recorded " +
        "as having acted. Both put the patient on the list, so the id assertion above stays green " +
        "while the clinical meaning changes underneath it - proven by mutation on 2026-08-30, " +
        "where deleting the escalation record left the list identical and only this line went red.",
    ).toEqual(["escalated", "escalated"]);
  });
});

describe("RECORD_HANDOVER_SIGN_OFF", () => {
  it("appends role and time and does not throw on a valid call", () => {
    const state = seedWardFlowState();
    const next = wardFlowReducer(state, {
      type: "RECORD_HANDOVER_SIGN_OFF",
      role: "coordinator",
      now: NOW_ANCHOR,
    });
    expect(next.handoverSignOffs).toEqual([{ at: NOW_ANCHOR, by: "coordinator" }]);
    expect(next.rejections).toHaveLength(0);
  });
});
