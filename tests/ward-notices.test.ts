// tests/ward-notices.test.ts
//
// Communication addendum (docs/ward-flow/plans/2026-09-1x-communication-addendum.md), §2 — the
// catcher for the model and reducer half of "the system can compute what a coordinator should do
// next, and it cannot tell anybody anything." Seven assertions, named in the addendum's own order:
//
//   1  each of the five decisions in §1.3's table produces the notice(s) it names, addressed to
//      the named role(s) — three decisions raise exactly one notice, and the two decisions the
//      table itself names two addressees for (ACCEPT_REFERRAL, CANCEL_TRANSPORT) raise exactly two
//   2  a decision NOT in the table produces none — the anti-vacuity floor
//   3  FD-23: a decline notice reaches that referral's referrer and NO other team, proved by a
//      second team in the same state reading zero
//   4  the demo role never receives a notice, over every member of WardFlowRole
//   5  buildActionInbox's output is byte-for-byte identical before and after any notice event
//   6  a notice's sentence is stored, and re-reading it after the underlying state changes returns
//      the ORIGINAL words
//   7  reducer purity: the same (state, event) twice produces identical notice ids
//
// Fix round 1 (`.superpowers/sdd/third-edition-phase1/task-1-findings-round1.md`) added, beyond
// the seven above:
//   - assertion 4 gained a second test that hands `appendNotices` a `demo`-addressed `Notice`
//     directly (Important 1 — the six reducer cases can never construct one through the public
//     API, so this is the only way to exercise the addressee-side drop rather than the acting-role
//     gate the original two tests actually covered);
//   - assertion 5's second test (previously a tautology: both `buildActionInbox` calls received
//     the same `movements`/`units` references because the "control" was a shallow spread of the
//     very state being tested) is replaced with a genuinely re-derived before/after check for
//     every one of the six notice-raising events, not just one (Important 2);
//   - a new "Important 3" block proving `DECLINE_REFERRAL`'s notice carries the curated
//     `DECLINE_REASON_LABELS` text, not a bare de-underscored enum value;
//   - a new "Important 4" block proving a referral source `referralReferrer` cannot resolve
//     (`community`) raises zero notices on decline, turning the ed_medical-only scope decision
//     (previously recorded only in a doc comment) into something a future change must argue with.
import { describe, expect, it } from "vitest";

import { buildActionInbox } from "../src/components/ward-management/ward-derivations";
import {
  appendNotices,
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS, type WardFlowRole } from "../src/components/ward-management/ward-flow-events";
import type { Notice } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

const NOW = NOW_ANCHOR;

// Every member of `WardFlowRole`, read off the one place that is already exhaustive over it
// (`WARD_FLOW_ROLE_LABELS` is a `Record<WardFlowRole, string>`) rather than hand-copied here — the
// same "reuse, never redeclare" discipline `ward-model.ts`'s own `Addressee` doc comment states for
// why `Addressee.role` imports `WardFlowRole` instead of retyping its members.
const ALL_ROLES = Object.keys(WARD_FLOW_ROLE_LABELS) as WardFlowRole[];

function seeded(): WardFlowState {
  return seedWardFlowState();
}

function noticesTo(state: WardFlowState, role: WardFlowRole, placeId?: string): Notice[] {
  return state.notices.filter((notice) => notice.to.role === role && notice.to.placeId === placeId);
}

// ── The movement walk — WF-001, exactly the fixture and unit ids
// `tests/ward-flow-contracts.test.ts`'s own WALK_EVENTS already proves reachable end to end. WF-001
// is the only hand-authored movement early enough in its journey (`placement_requested`) to carry no
// seed `declines` or `referredUnitIds`, so every notice below is caused by the event under test, not
// by fixture history the movement already carried (the same reason that file picks WF-001 over
// WF-009). `originEdId: "arm-ed"` (`ward-movements.ts`) is the referrer every movement-side test
// below expects a notice to reach. ────────────────────────────────────────────────────────────────
const MOVEMENT_ID = "WF-001";
const MOVEMENT_ORIGIN_ED_ID = "arm-ed";
const DECLINED_UNIT_ID = "scgh-adult-open";
const ACCEPTED_UNIT_ID = "fre-adult-open";

/** REFER_TO_UNITS: WF-001 from `placement_requested` to `destination_review`, referred to both
 *  units under test. Raises no notice of its own — not one of the five decisions. */
function referred(state: WardFlowState): WardFlowState {
  return wardFlowReducer(state, {
    type: "REFER_TO_UNITS",
    role: "coordinator",
    now: NOW,
    movementId: MOVEMENT_ID,
    unitIds: [DECLINED_UNIT_ID, ACCEPTED_UNIT_ID],
  });
}

function declined(state: WardFlowState, now = NOW): WardFlowState {
  return wardFlowReducer(state, {
    type: "DECLINE",
    role: "ward",
    now,
    movementId: MOVEMENT_ID,
    unitId: DECLINED_UNIT_ID,
    // Owner ruling 2026-09-25: a "no bed" decline waitlists; capability_mismatch still declines.
    reason: "capability_mismatch",
  });
}

function acceptedInPrinciple(state: WardFlowState, now = NOW): WardFlowState {
  return wardFlowReducer(state, {
    type: "ACCEPT_IN_PRINCIPLE",
    role: "ward",
    now,
    movementId: MOVEMENT_ID,
    unitId: ACCEPTED_UNIT_ID,
  });
}

function pulled(state: WardFlowState, now = NOW): WardFlowState {
  return wardFlowReducer(state, {
    type: "PULL_PATIENT",
    role: "ward",
    now,
    movementId: MOVEMENT_ID,
    unitId: ACCEPTED_UNIT_ID,
  });
}

function transportBooked(state: WardFlowState, now = NOW): WardFlowState {
  return wardFlowReducer(state, {
    type: "BOOK_TRANSPORT",
    role: "ed",
    now,
    movementId: MOVEMENT_ID,
    provider: "Ambulance service",
    escortRequired: true,
    cadNumber: "CAD-STUB-0001",
    transportLegalStatus: "voluntary",
    estimatedAt: 0,
  });
}

// ── The front-door walk — a fresh `ed_medical` referral, the only `REFERRAL_SOURCES` member that
// resolves a referrer (`referralReferrer`, `ward-flow-reducer.ts`, own doc comment). "SCGH" and
// "RPH" each hold a real emergency department (`ward-sites.ts`), so each referral's referrer
// resolves to a DIFFERENT `ed` place — exactly what FD-23's own test needs two of. ────────────────
function receiveEdReferral(state: WardFlowState, originSiteCode: string, now = NOW): WardFlowState {
  return wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now,
    ageBand: "Adult",
    destinations: [
      {
        kind: "psychiatric_ward",
        sex: "Female",
        gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "ed_medical",
    urgency: 2,
    originSiteCode,
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  });
}

describe("assertion 1 — each decision in §1.3's table raises the notice(s) it names", () => {
  it("RELEASE_PULL notifies the referrer, and only the referrer", () => {
    let state = pulled(acceptedInPrinciple(referred(seeded())));
    const before = state.notices.length;
    state = wardFlowReducer(state, {
      type: "RELEASE_PULL",
      role: "coordinator",
      now: NOW + 10,
      movementId: MOVEMENT_ID,
      reason: "patient_no_longer_coming",
    });
    expect(state.rejections).toEqual([]);
    expect(state.notices).toHaveLength(before + 1);
    const notice = state.notices.at(-1)!;
    expect(notice.kind).toBe("bed_pull_released");
    expect(notice.to).toEqual({ role: "ed", placeId: MOVEMENT_ORIGIN_ED_ID });
    expect(notice.about).toEqual({ movementId: MOVEMENT_ID, unitId: ACCEPTED_UNIT_ID });
  });

  it("DECLINE (a movement) notifies the referrer, and only the referrer", () => {
    let state = referred(seeded());
    const before = state.notices.length;
    state = declined(state);
    expect(state.rejections).toEqual([]);
    expect(state.notices).toHaveLength(before + 1);
    const notice = state.notices.at(-1)!;
    expect(notice.kind).toBe("referral_declined");
    expect(notice.to).toEqual({ role: "ed", placeId: MOVEMENT_ORIGIN_ED_ID });
    expect(notice.about).toEqual({ movementId: MOVEMENT_ID, unitId: DECLINED_UNIT_ID });
  });

  it("DECLINE_REFERRAL (a front-door referral) notifies the referrer, and only the referrer", () => {
    const received = receiveEdReferral(seeded(), "SCGH");
    const referral = received.referrals.at(-1)!;
    const before = received.notices.length;
    const after = wardFlowReducer(received, {
      type: "DECLINE_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      reason: "no_suitable_bed",
    });
    expect(after.rejections).toEqual([]);
    expect(after.notices).toHaveLength(before + 1);
    const notice = after.notices.at(-1)!;
    expect(notice.kind).toBe("referral_declined");
    expect(notice.to).toEqual({ role: "ed", placeId: "scgh-ed" });
    expect(notice.about).toEqual({ referralId: referral.id });
  });

  it("ACCEPT_IN_PRINCIPLE notifies the referrer, and only the referrer", () => {
    let state = referred(seeded());
    const before = state.notices.length;
    state = acceptedInPrinciple(state);
    expect(state.rejections).toEqual([]);
    expect(state.notices).toHaveLength(before + 1);
    const notice = state.notices.at(-1)!;
    expect(notice.kind).toBe("accepted_in_principle");
    expect(notice.to).toEqual({ role: "ed", placeId: MOVEMENT_ORIGIN_ED_ID });
    expect(notice.about).toEqual({ movementId: MOVEMENT_ID, unitId: ACCEPTED_UNIT_ID });
  });

  it("ACCEPT_REFERRAL notifies BOTH the referrer and the receiving ward — both sides of a commitment", () => {
    const received = receiveEdReferral(seeded(), "SCGH");
    const referral = received.referrals.at(-1)!;
    const before = received.notices.length;
    const after = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      unitId: "scgh-adult-open",
    });
    expect(after.rejections).toEqual([]);
    expect(after.notices).toHaveLength(before + 2);
    const raised = after.notices.slice(before);
    const toReferrer = raised.find((notice) => notice.kind === "referral_accepted_referrer");
    const toWard = raised.find((notice) => notice.kind === "referral_accepted_ward");
    expect(toReferrer?.to).toEqual({ role: "ed", placeId: "scgh-ed" });
    expect(toReferrer?.about).toEqual({ referralId: referral.id });
    expect(toWard?.to).toEqual({ role: "ward", placeId: "scgh-adult-open" });
    expect(toWard?.about).toEqual({ referralId: referral.id, unitId: "scgh-adult-open" });
  });

  /**
   * STILL-04 / R3 (`docs/ward-flow/plans/2026-09-16-fix-plan-referral-model.md`). The ward-side
   * notice used to read "… is now expected to receive the patient from referral …", which promises
   * a movement ACCEPT_REFERRAL never creates — spec D14 is explicit that acceptance decides only
   * that the network takes this referral. A ward reading that sentence could reasonably start
   * waiting for someone to arrive.
   */
  it("ACCEPT_REFERRAL's ward-side notice never promises a movement, and says plainly that none exists", () => {
    const received = receiveEdReferral(seeded(), "SCGH");
    const referral = received.referrals.at(-1)!;
    const after = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      unitId: "scgh-adult-open",
    });
    const toWard = after.notices.find((notice) => notice.kind === "referral_accepted_ward");
    expect(toWard?.sentence).toContain("No bed is pulled");
    expect(toWard?.sentence).not.toContain("expected to receive");
  });

  it("ACCEPT_REFERRAL raises only the referrer's notice when the accepting destination is not a ward", () => {
    // An emergency-department destination has no unit to name, so there is no "receiving ward" to
    // tell — addendum §1.3 names "the receiving WARD" specifically, not a receiving destination in
    // general.
    const received = wardFlowReducer(seeded(), {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW,
      ageBand: "Adult",
      destinations: [{ kind: "emergency_department", edId: "peel-ed", purpose: "psychiatric_review" }],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "ed_medical",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    });
    const referral = received.referrals.at(-1)!;
    const before = received.notices.length;
    const after = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      destinationKind: "emergency_department",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
    });
    expect(after.rejections).toEqual([]);
    expect(after.notices).toHaveLength(before + 1);
    expect(after.notices.at(-1)!.kind).toBe("referral_accepted_referrer");
    expect(after.notices.at(-1)!.to).toEqual({ role: "ed", placeId: "scgh-ed" });
  });

  it("CANCEL_TRANSPORT notifies BOTH the officer and the receiving ward", () => {
    let state = transportBooked(pulled(acceptedInPrinciple(referred(seeded()))));
    const before = state.notices.length;
    state = wardFlowReducer(state, {
      type: "CANCEL_TRANSPORT",
      role: "coordinator",
      now: NOW + 20,
      movementId: MOVEMENT_ID,
      reason: "provider_unavailable",
    });
    expect(state.rejections).toEqual([]);
    expect(state.notices).toHaveLength(before + 2);
    const raised = state.notices.slice(before);
    const toOfficer = raised.find((notice) => notice.kind === "transport_cancelled_officer");
    const toWard = raised.find((notice) => notice.kind === "transport_cancelled_ward");
    expect(toOfficer?.to).toEqual({ role: "officer" });
    expect(toOfficer?.about).toEqual({ movementId: MOVEMENT_ID });
    expect(toWard?.to).toEqual({ role: "ward", placeId: ACCEPTED_UNIT_ID });
    expect(toWard?.about).toEqual({ movementId: MOVEMENT_ID, unitId: ACCEPTED_UNIT_ID });
  });
});

describe("assertion 2 — a decision NOT in the table produces none (the anti-vacuity floor)", () => {
  it("ADVANCE_CLOCK raises no notice", () => {
    const state = seeded();
    const after = wardFlowReducer(state, { type: "ADVANCE_CLOCK", role: "demo", now: NOW, minutes: 5 });
    expect(after.notices).toEqual(state.notices);
    expect(after.notices).toEqual([]);
  });

  it("PULL_PATIENT — a real, consequential movement event — raises no notice", () => {
    // ACCEPT_IN_PRINCIPLE ahead of it DOES raise one (assertion 1's own test covers that) — the
    // sanity check here is on the DELTA `PULL_PATIENT` itself contributes, not on the array being
    // empty beforehand.
    const state = acceptedInPrinciple(referred(seeded()));
    expect(state.notices.length).toBeGreaterThan(0);
    const before = state.notices.length;
    const after = pulled(state);
    expect(after.rejections).toEqual([]); // the dispatch genuinely succeeded — this is not vacuous
    expect(after.notices).toHaveLength(before);
    expect(after.notices).toEqual(state.notices);
  });

  it("WITHDRAW_REFERRAL raises no notice, though it ends a movement's live referral", () => {
    const state = referred(seeded());
    const after = wardFlowReducer(state, {
      type: "WITHDRAW_REFERRAL",
      role: "coordinator",
      now: NOW,
      movementId: MOVEMENT_ID,
    });
    expect(after.rejections).toEqual([]);
    expect(after.notices).toEqual(state.notices);
  });
});

describe("assertion 3 — FD-23: a decline notice reaches that referral's referrer and no other team", () => {
  it("a second emergency department, in the same state, reads zero", () => {
    let state = receiveEdReferral(seeded(), "SCGH");
    const scghReferral = state.referrals.at(-1)!;
    state = receiveEdReferral(state, "RPH");
    const rphReferral = state.referrals.at(-1)!;
    expect(scghReferral.id).not.toBe(rphReferral.id);

    state = wardFlowReducer(state, {
      type: "DECLINE_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: scghReferral.id,
      reason: "no_suitable_bed",
    });
    expect(state.rejections).toEqual([]);

    // The referrer whose referral was actually declined reads exactly one notice.
    expect(noticesTo(state, "ed", "scgh-ed")).toHaveLength(1);
    // The second team — a real emergency department in the same state, holding its OWN queued
    // referral — reads zero. This is the proof, not merely an assertion of the first half: a team
    // that never made the decline can still see the notices array exists (it is non-empty overall)
    // and must still read nothing addressed to it.
    expect(noticesTo(state, "ed", "rph-ed")).toHaveLength(0);
    expect(state.notices.length).toBeGreaterThan(0);
  });
});

describe("assertion 4 — the demo role never receives a notice, over every member of WardFlowRole", () => {
  it("cycling every role through DECLINE_REFERRAL as the acting role never addresses demo", () => {
    // DECLINE_REFERRAL permits the broadest actor set of the five decisions (ward, coordinator, ed,
    // community — EVENT_ROLE.DECLINE_REFERRAL, ward-flow-events.ts), so this loop is the most
    // demanding single-event proof available: four of the six roles below succeed and genuinely
    // raise a notice (proving the loop is not vacuous), and `officer`/`demo` are refused outright by
    // the role gate before this reducer's own notice logic ever runs.
    let allNotices: Notice[] = [];
    let sawAtLeastOneNotice = false;
    for (const role of ALL_ROLES) {
      const received = receiveEdReferral(seeded(), "SCGH");
      const referral = received.referrals.at(-1)!;
      const after = wardFlowReducer(received, {
        type: "DECLINE_REFERRAL",
        destinationKind: "psychiatric_ward",
        role,
        now: NOW,
        referralId: referral.id,
        reason: "no_suitable_bed",
      });
      if (after.notices.length > 0) sawAtLeastOneNotice = true;
      allNotices = [...allNotices, ...after.notices];
    }
    expect(sawAtLeastOneNotice, "the loop must raise at least one real notice, or this test is vacuous").toBe(true);
    expect(allNotices.some((notice) => notice.to.role === "demo")).toBe(false);
  });

  it("cycling every role through CANCEL_TRANSPORT as the acting role never addresses demo", () => {
    let allNotices: Notice[] = [];
    let sawAtLeastOneNotice = false;
    for (const role of ALL_ROLES) {
      const prepared = transportBooked(pulled(acceptedInPrinciple(referred(seeded()))));
      const after = wardFlowReducer(prepared, {
        type: "CANCEL_TRANSPORT",
        role,
        now: NOW + 20,
        movementId: MOVEMENT_ID,
        reason: "provider_unavailable",
      });
      if (after.notices.length > 0) sawAtLeastOneNotice = true;
      allNotices = [...allNotices, ...after.notices];
    }
    expect(sawAtLeastOneNotice, "the loop must raise at least one real notice, or this test is vacuous").toBe(true);
    expect(allNotices.some((notice) => notice.to.role === "demo")).toBe(false);
  });

  // Fix round 1, Important 1: the two tests above cycle the ACTING role through an event and prove
  // `demo`/`officer` are refused by `EVENT_ROLE` before the reducer's own notice logic ever runs —
  // real, but not a test of the addressee-side filter `appendNotices` itself. No call site in the
  // six notice-raising cases can ever build a `demo`-addressed `Notice` (every literal `to.role` is
  // `"ed"`/`"ward"`/`"officer"`), so the only way to prove the drop branch is real is to hand
  // `appendNotices` one directly. Deleting the filter (`notice.to.role !== "demo"` in
  // `ward-flow-reducer.ts`) must turn this red; the two tests above would stay green either way.
  it("appendNotices refuses a demo-addressed notice handed to it directly, rather than merely never receiving one", () => {
    const state = seeded();
    const demoNotice: Notice = {
      id: "notice-test-demo-probe-0",
      raisedAt: NOW,
      to: { role: "demo" },
      about: { movementId: MOVEMENT_ID },
      kind: "bed_pull_released",
      sentence: "probe notice that must never reach a demo addressee",
      readAt: undefined,
    };
    const after = appendNotices(state, [demoNotice]);
    expect(after.notices).toEqual(state.notices);
    expect(after.notices).toHaveLength(0);
    expect(after.notices.some((notice) => notice.to.role === "demo")).toBe(false);
  });
});

describe("assertion 5 — buildActionInbox's output is byte-for-byte identical before and after any notice event", () => {
  it("DECLINE_REFERRAL raises a notice and touches referrals only — movements and units, and so buildActionInbox, are untouched", () => {
    const state = receiveEdReferral(seeded(), "SCGH");
    const referral = state.referrals.at(-1)!;
    const before = buildActionInbox(state.movements, NOW, state.units);

    const after = wardFlowReducer(state, {
      type: "DECLINE_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      reason: "no_suitable_bed",
    });

    // Sanity: a real notice really was raised, so this is not proving something vacuous.
    expect(after.notices.length).toBeGreaterThan(state.notices.length);
    // The extended pin: `movements` and `units` — buildActionInbox's only two inputs — are the
    // SAME reference after a notice-raising event that has no reason to touch either.
    expect(after.movements).toBe(state.movements);
    expect(after.units).toBe(state.units);
    expect(buildActionInbox(after.movements, NOW, after.units)).toEqual(before);
  });

  // Fix round 1, Important 2: the test this replaced built its "without notices" control as
  // `{ ...state, notices: [] }` — a shallow spread of the very state under test. Spreading copies
  // references, so `withoutNotices.movements` and `withoutNotices.units` were THE SAME OBJECTS as
  // `state.movements`/`state.units`; both `buildActionInbox` calls therefore received identical
  // arguments and the comparison could not fail no matter what `appendNotices` did, because a
  // corrupted `movements`/`units` would have been corrupted on both sides identically. The five
  // tests below instead capture `buildActionInbox`'s output from the state as it stood BEFORE each
  // event was dispatched — a genuinely different object, captured at a genuinely different time —
  // and compare it to the output recomputed from the state's own post-dispatch `movements`/`units`.
  // A future bug that let notice-raising code touch either would show up as a real `toEqual`
  // failure here, not a tautology.
  it("RELEASE_PULL raises a notice; buildActionInbox recomputed from the post-event state matches what it was before", () => {
    // Unlike the other three movement-touching events below, RELEASE_PULL genuinely changes
    // `units` too — releasing a held bed frees its allocatable count, which is the whole point of
    // the decision. So `after.units` is deliberately NOT asserted `.toBe(state.units)` here: that
    // would be false of correct code, not a sign anything is wrong. The real claim under test is
    // narrower and still genuine: recomputing buildActionInbox from the ACTUAL post-event
    // movements/units — freshly captured, not a spread copy of one side of the comparison —
    // matches what it was before the bed pull's own release affected nothing this derivation reads.
    const state = pulled(acceptedInPrinciple(referred(seeded())));
    const before = buildActionInbox(state.movements, NOW, state.units);
    const after = wardFlowReducer(state, {
      type: "RELEASE_PULL",
      role: "coordinator",
      now: NOW + 10,
      movementId: MOVEMENT_ID,
      reason: "patient_no_longer_coming",
    });
    expect(after.notices.length).toBeGreaterThan(state.notices.length); // not vacuous
    expect(after.units).not.toBe(state.units); // sanity: the release really did change units
    expect(buildActionInbox(after.movements, NOW, after.units)).toEqual(before);
  });

  it("DECLINE (a movement) raises a notice; buildActionInbox recomputed from the post-event state matches what it was before", () => {
    const state = referred(seeded());
    const before = buildActionInbox(state.movements, NOW, state.units);
    const after = declined(state);
    expect(after.notices.length).toBeGreaterThan(state.notices.length); // not vacuous
    expect(after.units).toBe(state.units);
    expect(buildActionInbox(after.movements, NOW, after.units)).toEqual(before);
  });

  it("ACCEPT_IN_PRINCIPLE raises a notice; buildActionInbox recomputed from the post-event state matches what it was before", () => {
    const state = referred(seeded());
    const before = buildActionInbox(state.movements, NOW, state.units);
    const after = acceptedInPrinciple(state);
    expect(after.notices.length).toBeGreaterThan(state.notices.length); // not vacuous
    expect(after.units).toBe(state.units);
    expect(buildActionInbox(after.movements, NOW, after.units)).toEqual(before);
  });

  it("ACCEPT_REFERRAL raises two notices and touches referrals only — movements and units, and so buildActionInbox, are untouched", () => {
    const state = receiveEdReferral(seeded(), "SCGH");
    const referral = state.referrals.at(-1)!;
    const before = buildActionInbox(state.movements, NOW, state.units);
    const after = wardFlowReducer(state, {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      unitId: "scgh-adult-open",
    });
    expect(after.notices.length).toBeGreaterThan(state.notices.length); // not vacuous
    // The extended pin: `movements` and `units` — buildActionInbox's only two inputs — are the
    // SAME reference after a notice-raising event that has no reason to touch either.
    expect(after.movements).toBe(state.movements);
    expect(after.units).toBe(state.units);
    expect(buildActionInbox(after.movements, NOW, after.units)).toEqual(before);
  });

  it("CANCEL_TRANSPORT raises two notices; buildActionInbox recomputed from the post-event state matches what it was before", () => {
    const state = transportBooked(pulled(acceptedInPrinciple(referred(seeded()))));
    const before = buildActionInbox(state.movements, NOW, state.units);
    const after = wardFlowReducer(state, {
      type: "CANCEL_TRANSPORT",
      role: "coordinator",
      now: NOW + 20,
      movementId: MOVEMENT_ID,
      reason: "provider_unavailable",
    });
    expect(after.notices.length).toBeGreaterThan(state.notices.length); // not vacuous
    expect(after.units).toBe(state.units);
    expect(buildActionInbox(after.movements, NOW, after.units)).toEqual(before);
  });
});

describe("assertion 6 — a notice's sentence is stored, not re-derived at render", () => {
  it("re-reading a notice after the movement it is about moves on returns the ORIGINAL words", () => {
    let state = declined(referred(seeded()));
    const notice = state.notices.find((candidate) => candidate.kind === "referral_declined")!;
    const originalSentence = notice.sentence;
    expect(originalSentence).toContain(MOVEMENT_ID);
    expect(originalSentence.toLowerCase()).toContain("declined");

    // Move the SAME movement on substantially — accepted at a different unit, changing its stage,
    // blocker and stageChanges. A sentence re-derived at read time from current state would change
    // here; a stored one cannot.
    state = acceptedInPrinciple(state);
    const sameNotice = state.notices.find((candidate) => candidate.id === notice.id)!;
    expect(sameNotice.sentence).toBe(originalSentence);
  });
});

describe("assertion 7 — reducer purity: the same (state, event) twice produces identical notice ids", () => {
  it("dispatching one identical DECLINE event against the same starting state twice mints the same id", () => {
    const state = referred(seeded());
    const event = {
      type: "DECLINE" as const,
      role: "ward" as const,
      now: NOW,
      movementId: MOVEMENT_ID,
      unitId: DECLINED_UNIT_ID,
      // Owner ruling 2026-09-25: "no bed" waitlists; capability_mismatch still declines.
      reason: "capability_mismatch" as const,
    };
    const first = wardFlowReducer(state, event);
    const second = wardFlowReducer(state, event);
    expect(first.notices).toHaveLength(1);
    expect(second.notices).toEqual(first.notices);
    expect(second.notices.map((notice) => notice.id)).toEqual(first.notices.map((notice) => notice.id));
  });

  it("dispatching one identical CANCEL_TRANSPORT event (two notices raised) against the same starting state twice mints the same ids", () => {
    // The walk to a booked transport already raises one notice of its own (ACCEPT_IN_PRINCIPLE) —
    // `before` isolates the two CANCEL_TRANSPORT raises from that earlier one.
    const state = transportBooked(pulled(acceptedInPrinciple(referred(seeded()))));
    const before = state.notices.length;
    const event = {
      type: "CANCEL_TRANSPORT" as const,
      role: "coordinator" as const,
      now: NOW + 20,
      movementId: MOVEMENT_ID,
      reason: "provider_unavailable" as const,
    };
    const first = wardFlowReducer(state, event);
    const second = wardFlowReducer(state, event);
    expect(first.notices).toHaveLength(before + 2);
    expect(second.notices).toEqual(first.notices);
  });
});

describe("Important 3 — the decline notice uses the repo's one spelling of a decline reason", () => {
  // `ward-flow-reducer.ts:3483` (before this fix) built the stored sentence with
  // `event.reason.replace(/_/g, " ")`, which for `another_reason` produces the bare "another
  // reason" — dropping the half of the curated `DECLINE_REASON_LABELS` label
  // ("Another reason — needs follow-up") that tells the referrer — the person who must do the
  // following up — that follow-up is expected. Reverting the fix to the de-underscore idiom must
  // turn this red.
  it("DECLINE_REFERRAL's notice carries the curated another_reason label, not the bare de-underscored enum value", () => {
    const received = receiveEdReferral(seeded(), "SCGH");
    const referral = received.referrals.at(-1)!;
    const after = wardFlowReducer(received, {
      type: "DECLINE_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      reason: "another_reason",
    });
    expect(after.rejections).toEqual([]);
    const notice = after.notices.at(-1)!;
    expect(notice.kind).toBe("referral_declined");
    // The curated label's own second half is the part a plain de-underscore would drop — this is
    // the substring that actually distinguishes the fix from the bug it replaces.
    expect(notice.sentence).toContain("Another reason — needs follow-up");
  });
});

describe("Important 4 — the ed_medical-only referrer scope is visible to a test, not only to a doc comment", () => {
  // `referralReferrer` (`ward-flow-reducer.ts`) resolves an addressee only for `source:
  // "ed_medical"`; the other six `REFERRAL_SOURCES` members deliberately raise no notice at all —
  // a scope decision recorded, until this fix, only in that function's own comment. Nothing went
  // red if a later change invented a `placeId` for `community`, and nothing went red if the
  // current silence were wrong. This test turns the decision into something a future change must
  // argue with: a `community`-sourced referral's decline must raise zero notices.
  it("a community-sourced referral's decline raises zero notices", () => {
    const received = wardFlowReducer(seeded(), {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW,
      ageBand: "Adult",
      destinations: [
        {
          kind: "psychiatric_ward",
          sex: "Female",
          gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
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
    const referral = received.referrals.at(-1)!;
    const before = received.notices.length;
    const after = wardFlowReducer(received, {
      type: "DECLINE_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      reason: "no_suitable_bed",
    });
    // The decision itself must genuinely succeed — this is the ed_medical-only SCOPE decision
    // producing silence, not a rejected dispatch producing silence by a different route.
    expect(after.rejections).toEqual([]);
    expect(after.notices).toHaveLength(before);
    expect(after.notices).toEqual(received.notices);
  });

  /**
   * Owner answer 25, 2026-09-17, verbatim: *"GP referrals: the GP is told by phone or letter for
   * now; add 'GP' as a referral source."* `gp` joins the other five as a `REFERRAL_SOURCES` member
   * `referralReferrer` resolves no addressee for — same test shape as `community` above, so a
   * later change that invented a `placeId` for `gp` (or silently reused another source's) goes red
   * here rather than shipping a decline notice to a GP this application has no seat to address.
   */
  it("a gp-sourced referral's decline raises zero notices", () => {
    const received = wardFlowReducer(seeded(), {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW,
      ageBand: "Adult",
      destinations: [
        {
          kind: "psychiatric_ward",
          sex: "Female",
          gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "gp",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    });
    const referral = received.referrals.at(-1)!;
    const before = received.notices.length;
    const after = wardFlowReducer(received, {
      type: "DECLINE_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      reason: "no_suitable_bed",
    });
    expect(after.rejections).toEqual([]);
    expect(after.notices).toHaveLength(before);
    expect(after.notices).toEqual(received.notices);
  });

  /**
   * The acceptance half of the same scope decision. `ACCEPT_REFERRAL` raises up to two notices —
   * one to the referrer, ONLY when `referralReferrer` resolves one, and one to the receiving ward,
   * unconditionally on a psychiatric-ward acceptance (see `ward-flow-reducer.ts`'s own comment on
   * the two-notice split). A `gp`-sourced acceptance must still tell the ward it accepted — that
   * notice has nothing to do with source — but must never invent a way to tell the GP.
   */
  it("a gp-sourced referral's acceptance raises no notice to the referrer", () => {
    const received = wardFlowReducer(seeded(), {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW,
      ageBand: "Adult",
      destinations: [
        {
          kind: "psychiatric_ward",
          sex: "Female",
          gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "gp",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    });
    const referral = received.referrals.at(-1)!;
    const before = received.notices.length;
    const after = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      destinationKind: "psychiatric_ward",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      unitId: "scgh-adult-open",
    });
    expect(after.rejections).toEqual([]);
    const raised = after.notices.slice(before);
    expect(raised.some((notice) => notice.kind === "referral_accepted_referrer")).toBe(false);
    const toWard = raised.find((notice) => notice.kind === "referral_accepted_ward");
    expect(toWard?.to).toEqual({ role: "ward", placeId: "scgh-adult-open" });
  });
});

// ── Item 48, Q3 (docs/ward-flow/plans/2026-09-17-build-plan-referrals-transport.md) — two more
// decisions join the addendum's table: WITHDRAW_ACCEPTANCE tells the ward whose acceptance was
// withdrawn, and RECORD_EXAMINATION tells the accepting ward when the outcome is `"revoked"`, in
// the wording its own branch names (bed still held, or bed already released). Neither is tested
// above: `referral_revoked_ward`/`transport_stopped_ward` (WLQ-38) live in
// `ward-withdraw-referral.test.ts`/`ward-stop-transport.test.ts` instead, and these two new kinds
// follow that same convention of a dedicated block here rather than a scattered assertion.
// `transport_stopped_officer` (item 31, T3, 2026-09-17 — the officer's own half of the same
// STOP_TRANSPORT decision, telling the officer where the patient now is) joins the same table
// entry and is proven the same way, in `ward-stop-transport.test.ts` alongside its ward half. ────
describe("Item 48, Q3 — WITHDRAW_ACCEPTANCE and a revoked examination each notify a ward", () => {
  it("WITHDRAW_ACCEPTANCE tells exactly the ward whose acceptance was withdrawn", () => {
    const state = acceptedInPrinciple(referred(seeded()));
    const before = state.notices.length;
    const after = wardFlowReducer(state, {
      type: "WITHDRAW_ACCEPTANCE",
      role: "coordinator",
      now: NOW + 5,
      movementId: MOVEMENT_ID,
      reason: "recorded_in_error",
    });
    expect(after.rejections).toEqual([]);
    expect(after.notices).toHaveLength(before + 1);
    const notice = after.notices.at(-1)!;
    expect(notice.kind).toBe("acceptance_withdrawn_ward");
    expect(notice.to).toEqual({ role: "ward", placeId: ACCEPTED_UNIT_ID });
    expect(notice.about).toEqual({ movementId: MOVEMENT_ID, unitId: ACCEPTED_UNIT_ID });
    // Exact wording, and — because it is exact — proof by itself that no step-back reason label
    // (`recorded_in_error` here) reached the ward's sentence: the 2026-09-04 ruling keeps those
    // coordinator-facing.
    expect(notice.sentence).toBe(
      `The coordinator withdrew this ward's acceptance of ${MOVEMENT_ID}. The patient is not coming unless this ward is asked again.`,
    );
    // A different ward, seeded in the same state, reads nothing — the notice is scoped to the one
    // ward whose acceptance this was.
    expect(noticesTo(after, "ward", DECLINED_UNIT_ID)).toHaveLength(0);
  });

  it("a revoked examination with transport already committed tells the accepting ward the bed stays held", () => {
    // WF-005 is seeded at handover_ready, accepted at fre-adult-open, with transport accepted —
    // exactly the WLQ-4 `transportAlreadyCommitted` branch `tests/ward-flow-reducer.test.ts`'s own
    // WLQ-4 block already proves stays open and flagged rather than closing.
    const state = seeded();
    const before = state.notices.length;
    const after = wardFlowReducer(state, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW,
      movementId: "WF-005",
      outcome: "revoked",
    });
    expect(after.rejections).toEqual([]);
    expect(after.notices).toHaveLength(before + 1);
    const notice = after.notices.at(-1)!;
    expect(notice.kind).toBe("examination_revoked_ward");
    expect(notice.to).toEqual({ role: "ward", placeId: "fre-adult-open" });
    expect(notice.about).toEqual({ movementId: "WF-005", unitId: "fre-adult-open" });
    expect(notice.sentence).toBe(
      "The examination for WF-005 was revoked after transport was booked. The bed stays held until a person decides whether to release it.",
    );
  });

  it("a revoked examination that releases the bed tells the accepting ward the bed has been released", () => {
    const state = pulled(acceptedInPrinciple(referred(seeded())));
    const beforeUnit = state.units.find((candidate) => candidate.id === ACCEPTED_UNIT_ID)!;
    const before = state.notices.length;
    const after = wardFlowReducer(state, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW + 5,
      movementId: MOVEMENT_ID,
      outcome: "revoked",
    });
    expect(after.rejections).toEqual([]);
    // Sanity: the bed really was given back, so "the bed has been released" is not a false claim.
    const afterUnit = after.units.find((candidate) => candidate.id === ACCEPTED_UNIT_ID)!;
    expect(afterUnit.allocatable.value).toBe(beforeUnit.allocatable.value + 1);
    expect(after.notices).toHaveLength(before + 1);
    const notice = after.notices.at(-1)!;
    expect(notice.kind).toBe("examination_revoked_ward");
    expect(notice.to).toEqual({ role: "ward", placeId: ACCEPTED_UNIT_ID });
    expect(notice.about).toEqual({ movementId: MOVEMENT_ID, unitId: ACCEPTED_UNIT_ID });
    expect(notice.sentence).toBe(
      `The examination for ${MOVEMENT_ID} was revoked. The patient is not coming and the bed has been released.`,
    );
  });

  it("further_examination_ordered writes no revoked-examination notice", () => {
    const state = acceptedInPrinciple(referred(seeded()));
    const before = state.notices.length;
    const after = wardFlowReducer(state, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW,
      movementId: MOVEMENT_ID,
      outcome: "further_examination_ordered",
    });
    expect(after.rejections).toEqual([]);
    expect(after.notices).toHaveLength(before);
    expect(after.notices.some((notice) => notice.kind === "examination_revoked_ward")).toBe(false);
  });

  it("community_order writes no revoked-examination notice, at the same stage a revoked outcome would raise one", () => {
    // WF-005 again — the owner named "revoked" only, not its sibling outcome, even though both
    // reach the exact same `transportAlreadyCommitted` branch.
    const state = seeded();
    const before = state.notices.length;
    const after = wardFlowReducer(state, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW,
      movementId: "WF-005",
      outcome: "community_order",
    });
    expect(after.rejections).toEqual([]);
    expect(after.notices).toHaveLength(before);
    expect(after.notices.some((notice) => notice.kind === "examination_revoked_ward")).toBe(false);
  });

  it("a revoked examination with no accepting ward raises no notice — there is nobody to tell", () => {
    const state = referred(seeded()); // destination_review: referred, never accepted
    expect(state.movements.find((candidate) => candidate.id === MOVEMENT_ID)?.acceptedUnitId).toBeUndefined();
    const before = state.notices.length;
    const after = wardFlowReducer(state, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW,
      movementId: MOVEMENT_ID,
      outcome: "revoked",
    });
    expect(after.rejections).toEqual([]);
    expect(after.notices).toHaveLength(before);
    expect(after.notices.some((notice) => notice.kind === "examination_revoked_ward")).toBe(false);
  });
});

describe("Item 18, RA1 — WITHDRAW_WARD_REQUEST notifies exactly the withdrawn ward", () => {
  it("tells exactly the one ward whose live request was withdrawn", () => {
    const state = referred(seeded()); // WF-001 referred to DECLINED_UNIT_ID and ACCEPTED_UNIT_ID
    const before = state.notices.length;
    const after = wardFlowReducer(state, {
      type: "WITHDRAW_WARD_REQUEST",
      role: "coordinator",
      now: NOW + 5,
      movementId: MOVEMENT_ID,
      unitId: DECLINED_UNIT_ID,
      reason: "bed_no_longer_available",
    });
    expect(after.rejections).toEqual([]);
    expect(after.notices).toHaveLength(before + 1);
    const notice = after.notices.at(-1)!;
    expect(notice.kind).toBe("ward_request_withdrawn");
    expect(notice.to).toEqual({ role: "ward", placeId: DECLINED_UNIT_ID });
    expect(notice.about).toEqual({ movementId: MOVEMENT_ID, unitId: DECLINED_UNIT_ID });
    expect(notice.sentence).toBe(`The request for ${MOVEMENT_ID} was withdrawn: The bed is no longer available.`);
    // The other still-live ward, seeded in the same state, reads nothing — this notice is scoped
    // to the one ward whose request this was, never every ward still holding a live referral.
    expect(noticesTo(after, "ward", ACCEPTED_UNIT_ID)).toHaveLength(0);
  });

  it("raises no notice, and no state change, when the reducer refuses the withdrawal", () => {
    const state = referred(seeded());
    const before = state.notices.length;
    const after = wardFlowReducer(state, {
      type: "WITHDRAW_WARD_REQUEST",
      role: "coordinator",
      now: NOW + 5,
      movementId: MOVEMENT_ID,
      // Never referred to this movement at all — not a live referral to withdraw.
      unitId: "rph-adult-secure",
      reason: "bed_no_longer_available",
    });
    expect(after.rejections.length).toBeGreaterThan(state.rejections.length);
    expect(after.notices).toHaveLength(before);
  });
});
