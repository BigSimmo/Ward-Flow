// v10 pass 2 (Josh, 10 Oct 2026): the engine half of the build guide's "Toast with Undo", the ward
// Bed board's pick up and place, the synthetic governance entries and Add patient's "added at".
import { describe, expect, it } from "vitest";

import { governanceAuditEvents, readGovernanceAuditEvents } from "../src/components/ward-management/ward-audit";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "../src/components/ward-management/ward-flow-storage-validation";
import { REFERRAL_DECLINE_REASONS, type Referral } from "../src/components/ward-management/ward-model";
import { patientAddedOnDayOf } from "../src/components/ward-management/ward-patients";
import { referralState } from "../src/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { UNDO_WINDOW_MINUTES } from "../src/components/ward-management/ward-undo";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

const NOW = NOW_ANCHOR;
const UNIT = "scgh-adult-open";

const run = (state: WardFlowState, ...events: WardFlowEvent[]) => events.reduce(wardFlowReducer, state);
const stored = (state: WardFlowState) => JSON.parse(JSON.stringify({ ...state, rejections: [] })) as unknown;

function withQueuedReferral(): { state: WardFlowState; referralId: string } {
  const state = wardFlowReducer(seedWardFlowState(), {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW,
    ageBand: "Adult",
    destinations: [
      {
        kind: "psychiatric_ward",
        sex: "Female",
        gender: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "SCGH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  });
  expect(state.rejections).toEqual([]);
  return { state, referralId: state.referrals.at(-1)!.id };
}

const accept = (referralId: string, role: WardFlowEvent["role"] = "ward", now = NOW, bedNumber?: number) =>
  ({
    type: "ACCEPT_REFERRAL",
    role,
    now,
    referralId,
    destinationKind: "psychiatric_ward",
    unitId: UNIT,
    ...(bedNumber === undefined ? {} : { bedNumber }),
  }) as WardFlowEvent;

const undoDecision = (referralId: string, role: WardFlowEvent["role"], now = NOW + 1, actingUnitId?: string) =>
  ({
    type: "UNDO_REFERRAL_DECISION",
    role,
    now,
    referralId,
    ...(actingUnitId === undefined ? {} : { actingUnitId }),
  }) as WardFlowEvent;

function referralOf(state: WardFlowState, id: string): Referral {
  return state.referrals.find((candidate) => candidate.id === id)!;
}

/** Everything except the append-only audit log and the undo bookkeeping. */
function world(state: WardFlowState) {
  const { auditEvents: _a, auditSequence: _s, undoRecords: _u, ...rest } = state;
  void _a;
  void _s;
  void _u;
  return rest;
}

describe("UNDO_REFERRAL_DECISION", () => {
  it("restores the referral and its notices exactly after a ward's accept, and audits the undo", () => {
    const { state: before, referralId } = withQueuedReferral();
    const accepted = wardFlowReducer(before, accept(referralId));
    expect(referralState(referralOf(accepted, referralId))).toBe("accepted");
    expect(accepted.notices.length).toBeGreaterThan(before.notices.length);

    const undone = wardFlowReducer(accepted, undoDecision(referralId, "ward", NOW + 1, UNIT));
    expect(undone.rejections).toEqual([]);
    expect(referralOf(undone, referralId)).toEqual(referralOf(before, referralId));
    expect(undone.notices).toEqual(before.notices);
    expect(undone.undoRecords).toEqual([]);
    expect(world(undone)).toEqual(world(before));
    expect(undone.auditEvents.at(-1)).toMatchObject({
      category: "undo",
      action: "UNDO_REFERRAL_DECISION",
      outcome: "accepted",
      subject: { kind: "referral", referralId },
      details: { undoneAction: "ACCEPT_REFERRAL", decidedAt: NOW },
    });
  });

  it("restores a decline exactly, back to the queue", () => {
    const { state: before, referralId } = withQueuedReferral();
    const declined = wardFlowReducer(before, {
      type: "DECLINE_REFERRAL",
      role: "ward",
      now: NOW,
      referralId,
      destinationKind: "psychiatric_ward",
      unitId: UNIT,
      reason: REFERRAL_DECLINE_REASONS[0],
    });
    expect(declined.rejections).toEqual([]);
    // The ward names itself to undo; one that does not is refused (site review, 12 Oct 2026).
    const anyWard = wardFlowReducer(declined, undoDecision(referralId, "ward"));
    expect(anyWard.rejections.at(-1)?.reason).toBe(
      "Only the ward that made this decision, or the coordinator, can undo it",
    );
    const undone = wardFlowReducer(declined, undoDecision(referralId, "ward", NOW + 1, UNIT));
    expect(undone.rejections).toEqual([]);
    expect(referralState(referralOf(undone, referralId))).toBe("queued");
    expect(world(undone)).toEqual(world(before));
  });

  it("lets the coordinator undo a ward's decision, and the ward undo the coordinator's never", () => {
    const { state: before, referralId } = withQueuedReferral();
    const byWard = wardFlowReducer(before, accept(referralId, "ward"));
    expect(world(wardFlowReducer(byWard, undoDecision(referralId, "coordinator")))).toEqual(world(before));

    const byCoordinator = wardFlowReducer(before, accept(referralId, "coordinator"));
    const refused = wardFlowReducer(byCoordinator, undoDecision(referralId, "ward", NOW + 1, UNIT));
    expect(refused.rejections.at(-1)?.reason).toBe(
      "Only the role that made this decision, or the coordinator, can undo it",
    );
    expect(referralOf(refused, referralId)).toEqual(referralOf(byCoordinator, referralId));
  });

  it("refuses, with a reason, another ward, another role and a role with no seat", () => {
    const { state, referralId } = withQueuedReferral();
    const accepted = wardFlowReducer(state, accept(referralId));
    const otherWard = wardFlowReducer(accepted, undoDecision(referralId, "ward", NOW + 1, "rph-adult-open"));
    expect(otherWard.rejections.at(-1)?.reason).toBe(
      "Only the ward that made this decision, or the coordinator, can undo it",
    );
    const ed = wardFlowReducer(accepted, undoDecision(referralId, "ed"));
    expect(ed.rejections.at(-1)?.reason).toMatch(/Only the role that made this decision/);
    const officer = wardFlowReducer(accepted, undoDecision(referralId, "officer"));
    expect(officer.rejections.at(-1)?.reason).toMatch(/requires role/);
    for (const refused of [otherWard, ed, officer])
      expect(referralOf(refused, referralId)).toEqual(referralOf(accepted, referralId));
  });

  it("refuses after the window, once the referral has changed, and when there is nothing to undo", () => {
    const { state, referralId } = withQueuedReferral();
    const accepted = wardFlowReducer(state, accept(referralId));
    const late = wardFlowReducer(accepted, undoDecision(referralId, "coordinator", NOW + UNDO_WINDOW_MINUTES + 1));
    expect(late.rejections.at(-1)?.reason).toBe(
      `Undo is only possible within ${UNDO_WINDOW_MINUTES} minutes of the decision`,
    );
    expect(
      wardFlowReducer(accepted, undoDecision(referralId, "coordinator", NOW + UNDO_WINDOW_MINUTES)).rejections,
    ).toEqual([]);

    const changed: WardFlowState = {
      ...accepted,
      referrals: accepted.referrals.map((candidate) =>
        candidate.id === referralId ? { ...candidate, urgency: 1 } : candidate,
      ),
    };
    expect(wardFlowReducer(changed, undoDecision(referralId, "coordinator")).rejections.at(-1)?.reason).toBe(
      "This referral has changed since the decision, so it cannot be undone",
    );

    const once = wardFlowReducer(accepted, undoDecision(referralId, "coordinator"));
    expect(wardFlowReducer(once, undoDecision(referralId, "coordinator")).rejections.at(-1)?.reason).toBe(
      "There is no decision on this referral to undo",
    );
  });

  it("keeps no undo record for a refused decision", () => {
    const { state, referralId } = withQueuedReferral();
    const refused = wardFlowReducer(state, accept(referralId, "officer"));
    expect(refused.undoRecords).toBeUndefined();
  });

  it("survives a save and restore: the restored state validates and the undo still applies", () => {
    const { state: before, referralId } = withQueuedReferral();
    const accepted = wardFlowReducer(before, accept(referralId));
    const restored = stored(accepted);
    expect(isValidStoredWardFlowState(restored)).toBe(true);
    const undone = wardFlowReducer(restored as WardFlowState, undoDecision(referralId, "ward", NOW + 1, UNIT));
    expect(undone.rejections).toEqual([]);
    expect(referralOf(undone, referralId)).toEqual(JSON.parse(JSON.stringify(referralOf(before, referralId))));
  });
});

describe("ACCEPT_REFERRAL with a bed (Bed board Place here)", () => {
  it("holds the named bed on the accepted ward, and Undo returns both", () => {
    const { state: before, referralId } = withQueuedReferral();
    const placed = wardFlowReducer(before, accept(referralId, "ward", NOW, 3));
    expect(placed.rejections).toEqual([]);
    const arm = referralOf(placed, referralId).destinations[0];
    expect(arm).toMatchObject({ state: "accepted", acceptedUnitId: UNIT, heldBedNumber: 3 });
    expect(world(wardFlowReducer(placed, undoDecision(referralId, "ward", NOW + 1, UNIT)))).toEqual(world(before));
  });

  it("refuses a bed that is out of range or already taken", () => {
    const { state, referralId } = withQueuedReferral();
    const unit = state.units.find((candidate) => candidate.id === UNIT)!;
    expect(wardFlowReducer(state, accept(referralId, "ward", NOW, unit.beds + 1)).rejections.at(-1)?.reason).toMatch(
      /is not one of/,
    );
    const occupant = state.admissions.find((a) => a.unitId === UNIT && a.state === "occupied")!;
    const taken = run(state, {
      type: "PLACE_IN_BED",
      role: "coordinator",
      now: NOW,
      admissionId: occupant.id,
      bedNumber: 2,
    });
    expect(wardFlowReducer(taken, accept(referralId, "ward", NOW, 2)).rejections.at(-1)?.reason).toMatch(
      /already taken/,
    );
  });
});

describe("a ward answers only its own referrals (B1, site review 12 Oct 2026)", () => {
  it("refuses a ward acting for another ward, and lets the coordinator answer for any ward", () => {
    const { state, referralId } = withQueuedReferral();
    const otherWard = wardFlowReducer(state, {
      ...accept(referralId, "ward"),
      actingUnitId: "rph-adult-open",
    } as WardFlowEvent);
    expect(otherWard.rejections.at(-1)?.reason).toMatch(/acting as unit rph-adult-open .* a ward answers only its own/);
    const declineOther = wardFlowReducer(state, {
      type: "DECLINE_REFERRAL",
      role: "ward",
      now: NOW,
      referralId,
      destinationKind: "psychiatric_ward",
      unitId: UNIT,
      actingUnitId: "rph-adult-open",
      reason: REFERRAL_DECLINE_REASONS[0],
    });
    expect(declineOther.rejections.at(-1)?.reason).toMatch(/a ward answers only its own/);
    const own = wardFlowReducer(state, { ...accept(referralId, "ward"), actingUnitId: UNIT } as WardFlowEvent);
    expect(own.rejections).toEqual(state.rejections);
    const byCoordinator = wardFlowReducer(state, accept(referralId, "coordinator"));
    expect(byCoordinator.rejections).toEqual(state.rejections);
    expect(referralOf(byCoordinator, referralId).destinations[0]?.decidedBy).toBe("Flow coordinator");
  });
});

describe("PLACE_IN_BED and UNDO_PLACE_IN_BED", () => {
  const seededStay = (state: WardFlowState, index = 0) =>
    state.admissions.filter((a) => a.unitId === UNIT && a.state === "occupied")[index]!;
  const place = (admissionId: string, bedNumber: number, role: WardFlowEvent["role"] = "ward", actingUnitId = UNIT) =>
    ({ type: "PLACE_IN_BED", role, now: NOW, admissionId, bedNumber, actingUnitId }) as WardFlowEvent;
  const undoPlace = (admissionId: string, role: WardFlowEvent["role"] = "ward", now = NOW + 1, actingUnitId = UNIT) =>
    ({ type: "UNDO_PLACE_IN_BED", role, now, admissionId, actingUnitId }) as WardFlowEvent;

  it("moves a stay to a free bed on its own ward and Undo restores it exactly (no bed number again)", () => {
    const before = seedWardFlowState();
    const stay = seededStay(before);
    expect("bedNumber" in stay).toBe(false);
    const placed = wardFlowReducer(before, place(stay.id, 4));
    expect(placed.rejections).toEqual([]);
    expect(placed.admissions.find((a) => a.id === stay.id)?.bedNumber).toBe(4);
    expect(placed.auditEvents.at(-1)).toMatchObject({
      category: "bed-placement",
      action: "PLACE_IN_BED",
      outcome: "accepted",
      actor: { role: "ward", actingUnitId: UNIT },
      details: { fromBed: null, toBed: 4 },
    });
    const undone = wardFlowReducer(placed, undoPlace(stay.id));
    expect(undone.rejections).toEqual([]);
    expect(undone.admissions).toEqual(before.admissions);
    expect(world(undone)).toEqual(world(before));
    expect(undone.auditEvents.at(-1)).toMatchObject({
      action: "UNDO_PLACE_IN_BED",
      outcome: "accepted",
      details: { fromBed: 4, toBed: null },
    });
  });

  it("undoes only the newest move, back to the bed before it", () => {
    const state = seedWardFlowState();
    const stay = seededStay(state);
    const twice = run(state, place(stay.id, 4), place(stay.id, 6));
    const undone = wardFlowReducer(twice, undoPlace(stay.id));
    expect(undone.admissions.find((a) => a.id === stay.id)?.bedNumber).toBe(4);
  });

  it("refuses another ward, a ward that does not name itself, and a role with no seat, each with a reason", () => {
    const state = seedWardFlowState();
    const stay = seededStay(state);
    expect(wardFlowReducer(state, place(stay.id, 4, "ward", "rph-adult-open")).rejections.at(-1)?.reason).toBe(
      "A ward may only move patients between its own beds",
    );
    const unnamed = wardFlowReducer(state, {
      type: "PLACE_IN_BED",
      role: "ward",
      now: NOW,
      admissionId: stay.id,
      bedNumber: 4,
    });
    expect(unnamed.rejections.at(-1)?.reason).toBe("A ward may only move patients between its own beds");
    expect(wardFlowReducer(state, place(stay.id, 4, "ed")).rejections.at(-1)?.reason).toMatch(/requires role/);
  });

  it("lets the coordinator place on any ward and undo a ward's move; a ward cannot undo the coordinator's", () => {
    const state = seedWardFlowState();
    const stay = seededStay(state);
    const byCoordinator = wardFlowReducer(state, place(stay.id, 5, "coordinator", "ignored"));
    expect(byCoordinator.rejections).toEqual([]);
    expect(wardFlowReducer(byCoordinator, undoPlace(stay.id)).rejections.at(-1)?.reason).toBe(
      "Only the role that made this decision, or the coordinator, can undo it",
    );
    const byWard = wardFlowReducer(state, place(stay.id, 5));
    expect(wardFlowReducer(byWard, undoPlace(stay.id, "coordinator")).admissions).toEqual(state.admissions);
  });

  it("refuses an Undo that would put the patient back in a bed held since for somebody else (B9)", () => {
    const { state, referralId } = withQueuedReferral();
    const stay = seededStay(state);
    const moved = run(state, place(stay.id, 3), place(stay.id, 5));
    expect(moved.rejections).toEqual([]);
    // Within the Undo window the coordinator accepts a referral into bed 3, which holds it.
    const held = wardFlowReducer(moved, accept(referralId, "coordinator", NOW, 3));
    expect(held.rejections).toEqual(moved.rejections);
    const refused = wardFlowReducer(held, undoPlace(stay.id));
    expect(refused.rejections.at(-1)?.reason).toMatch(/held.*so the move cannot be undone$/);
    expect(refused.admissions.find((a) => a.id === stay.id)?.bedNumber).toBe(5);
  });

  it("refuses a taken bed, a bed off the ward, the same bed, and an Undo out of time or after a change", () => {
    const state = seedWardFlowState();
    const [first, second] = [seededStay(state, 0), seededStay(state, 1)];
    const unit = state.units.find((candidate) => candidate.id === UNIT)!;
    const oneIn = wardFlowReducer(state, place(first.id, 2));
    expect(wardFlowReducer(oneIn, place(second.id, 2)).rejections.at(-1)?.reason).toBe(
      `Bed 2 on ${unit.name} is already taken`,
    );
    expect(wardFlowReducer(state, place(first.id, 0)).rejections.at(-1)?.reason).toMatch(/is not one of/);
    expect(wardFlowReducer(oneIn, place(first.id, 2)).rejections.at(-1)?.reason).toBe(
      "This stay is already recorded in bed 2",
    );
    expect(
      wardFlowReducer(oneIn, undoPlace(first.id, "coordinator", NOW + UNDO_WINDOW_MINUTES + 1)).rejections.at(-1)
        ?.reason,
    ).toBe(`Undo is only possible within ${UNDO_WINDOW_MINUTES} minutes of the decision`);
    const moved: WardFlowState = {
      ...oneIn,
      admissions: oneIn.admissions.map((a) => (a.id === first.id ? { ...a, bedNumber: 7 } : a)),
    };
    expect(wardFlowReducer(moved, undoPlace(first.id, "coordinator")).rejections.at(-1)?.reason).toBe(
      "This stay has changed since the bed move, so it cannot be undone",
    );
  });

  it("validates a stored bed number and undo record, and refuses a bed off the ward", () => {
    const state = seedWardFlowState();
    const stay = seededStay(state);
    const placed = wardFlowReducer(state, place(stay.id, 4));
    expect(isValidStoredWardFlowState(stored(placed))).toBe(true);
    const tampered = {
      ...placed,
      admissions: placed.admissions.map((a) => (a.id === stay.id ? { ...a, bedNumber: 999 } : a)),
    };
    expect(isValidStoredWardFlowState(stored(tampered))).toBe(false);
    const badRecord = { ...placed, undoRecords: [{ kind: "bed-placement", admissionId: "nope" }] };
    expect(isValidStoredWardFlowState(stored(badRecord as unknown as WardFlowState))).toBe(false);
  });
});

describe("governance: synthetic seed entries and UNDO_AUDIT_REVIEW", () => {
  const review = (eventId: string, expectedReviewCount = 0, now = NOW, expectedGeneration = 0) =>
    ({
      type: "REVIEW_AUDIT_EVENT",
      role: "coordinator",
      now,
      eventId,
      expectedGeneration,
      expectedReviewCount,
      decision: "reviewed",
    }) as WardFlowEvent;
  const undoReview = (reviewId: string, role: WardFlowEvent["role"] = "coordinator", now = NOW + 1) =>
    ({ type: "UNDO_AUDIT_REVIEW", role, now, reviewId, expectedGeneration: 0 }) as WardFlowEvent;

  // The seeded referral entry's id names the referral it is about.
  const REFERRAL_ENTRY = governanceAuditEvents(seedWardFlowState()).find((entry) =>
    entry.id.startsWith("audit-seed-referral-override:"),
  )!.id;

  it("opens a fresh seed with clearly synthetic entries, without touching the captured log", () => {
    const state = seedWardFlowState();
    expect(state.auditEvents).toEqual([]);
    const seeded = governanceAuditEvents(state);
    expect(seeded.length).toBeGreaterThanOrEqual(5);
    for (const entry of seeded) {
      expect(entry.origin).toBe("synthetic-seed");
      expect(entry.id).toMatch(/^audit-seed-[a-z-]+:.+$/);
      expect(entry.generation).toBe(0);
      expect(entry.at!).toBeLessThan(state.auditCaptureStartedAt);
    }
    expect(readGovernanceAuditEvents(state, { role: "coordinator" })).toMatchObject({ status: "allowed" });
    expect(readGovernanceAuditEvents(state, { role: "ward", actingUnitId: UNIT })).toEqual({ status: "denied" });
    const reset = wardFlowReducer(seedWardFlowStateAt(30), { type: "RESET_SCENARIO", role: "demo", now: NOW + 30 });
    expect(governanceAuditEvents(reset).map((entry) => entry.generation)).toEqual(
      seeded.map(() => reset.worldGeneration),
    );
    for (const scenario of ["scarce", "emhs-demo", "emhs-surge"] as const)
      expect(governanceAuditEvents(seedWardFlowState(scenario)).length).toBeGreaterThan(0);
  });

  it("reviews a synthetic entry, and Undo takes the review back exactly", () => {
    const before = seedWardFlowState();
    const reviewed = wardFlowReducer(before, review(REFERRAL_ENTRY));
    expect(reviewed.auditReviews).toHaveLength(1);
    expect(isValidStoredWardFlowState(stored(reviewed))).toBe(true);
    const reviewId = reviewed.auditReviews[0].id;
    const undone = wardFlowReducer(reviewed, undoReview(reviewId));
    expect(undone.rejections).toEqual([]);
    expect(undone.auditReviews).toEqual(before.auditReviews);
    expect(undone.auditEvents.map((entry) => entry.action)).toEqual(["REVIEW_AUDIT_EVENT", "UNDO_AUDIT_REVIEW"]);
    expect(undone.auditEvents.at(-1)).toMatchObject({
      category: "review",
      outcome: "accepted",
      subject: { kind: "audit-event", eventId: REFERRAL_ENTRY },
      details: { decision: null, undoneReviewId: reviewId, undoneDecision: "reviewed" },
    });
    // The same event can be reviewed again afterwards, from a count of none.
    expect(wardFlowReducer(undone, review(REFERRAL_ENTRY, 0, NOW + 2)).auditReviews).toHaveLength(1);
  });

  it("refuses a non-coordinator with a reason, a later review, an old review and an unknown one", () => {
    const reviewed = wardFlowReducer(seedWardFlowState(), review(REFERRAL_ENTRY));
    const reviewId = reviewed.auditReviews[0].id;
    const ward = wardFlowReducer(reviewed, undoReview(reviewId, "ward"));
    expect(ward.rejections.at(-1)?.reason).toBe("Coordinator only");
    expect(ward.auditReviews).toEqual(reviewed.auditReviews);
    const twice = wardFlowReducer(reviewed, review(REFERRAL_ENTRY, 1));
    expect(wardFlowReducer(twice, undoReview(reviewId)).rejections.at(-1)?.reason).toBe(
      "A later review of this event is on record; undo that one first",
    );
    expect(
      wardFlowReducer(reviewed, undoReview(reviewId, "coordinator", NOW + UNDO_WINDOW_MINUTES + 1)).rejections.at(-1)
        ?.reason,
    ).toBe(`Undo is only possible within ${UNDO_WINDOW_MINUTES} minutes of the decision`);
    expect(wardFlowReducer(reviewed, undoReview("audit-review-99")).rejections.at(-1)?.reason).toBe(
      "That review is not on record, so it cannot be undone",
    );
  });
});

describe("ADD_PATIENT added at", () => {
  it("records when the patient was added, so Added today can count it", () => {
    const state = wardFlowReducer(seedWardFlowState(), {
      type: "ADD_PATIENT",
      role: "coordinator",
      now: NOW + 5,
      umrn: "UM999123",
      givenName: "Synthetic",
      familyName: "Person",
      dateOfBirth: "1990-01-01",
    });
    const added = state.patients.at(-1)!;
    expect(added.addedAt).toBe(NOW + 5);
    expect(patientAddedOnDayOf(added, NOW + 5)).toBe(true);
    expect(patientAddedOnDayOf(added, NOW + 5 + 1440)).toBe(false);
    expect(seedWardFlowState().patients.some((patient) => patient.addedAt !== undefined)).toBe(false);
    expect(isValidStoredWardFlowState(stored(state))).toBe(true);
    const tampered = {
      ...state,
      patients: state.patients.map((p) => (p.id === added.id ? { ...p, addedAt: "today" } : p)),
    };
    expect(isValidStoredWardFlowState(stored(tampered as unknown as WardFlowState))).toBe(false);
  });
});
