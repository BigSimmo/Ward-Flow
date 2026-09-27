// tests/ward-ed-to-community-referral.test.ts
//
// Owner ruling, 2026-09-06, on whether an emergency department may refer to a community team:
// "Yes they can if discharging a patient. Often patients don't need a ward bed but do need
// community follow-up."
//
// This pins the path itself. Whether the MEANING of such a referral is distinguishable from an
// admission request is a separate, open question — see the block at the bottom of this file.
import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { Movement, Referral } from "../src/components/ward-management/ward-model";
import { referralState } from "../src/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import {
  communityTeamOptions,
  communityTeamOptionsForSuburb,
} from "../src/components/ward-management/referrals/referral-destination-options";
import { communityTeamSlug } from "../src/components/ward-management/community/community-derivations";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

function edReferralToCommunity(state: WardFlowState, teamName = "Armadale Adult Mental Health") {
  return wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW_ANCHOR,
    ageBand: "Adult",
    destinations: [{ kind: "community_team", teamName }],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "ed_medical",
    urgency: 2,
    // Armadale has an emergency department, which `source: "ed_medical"` now requires.
    originSiteCode: "ARM",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  });
}

describe("an emergency department may refer a discharged patient to a community team", () => {
  it("is accepted by the front door, and no rejection is recorded", () => {
    const before = seedWardFlowState();
    const after = edReferralToCommunity(before);
    expect(
      after.rejections.slice(before.rejections.length),
      "the owner ruled this referral must be possible; the reducer refused it",
    ).toEqual([]);
    expect(after.referrals).toHaveLength(before.referrals.length + 1);
  });

  it("records the emergency department as the source and the team as the destination", () => {
    const created = edReferralToCommunity(seedWardFlowState()).referrals.at(-1)!;
    expect(created.source).toBe("ed_medical");
    expect(created.destinations).toHaveLength(1);
    expect(created.destinations[0].destination).toEqual({
      kind: "community_team",
      teamName: "Armadale Adult Mental Health",
    });
    expect(referralState(created)).toBe("queued");
  });

  /*
   * 🔴 THE PART THIS FILE DELIBERATELY DOES NOT ASSERT, RECORDED SO IT IS NOT MISTAKEN FOR SETTLED.
   *
   * The owner's ruling names a specific act: a patient being DISCHARGED from an emergency
   * department who does not need a ward bed but does need follow-up. **Every other referral in this
   * model asks somebody to take a patient IN. This one asks somebody to see a patient who is going
   * HOME.**
   *
   * ⚠️ **NOTHING ON THE RECORD ABOVE DISTINGUISHES THE TWO.** The `community_team` arm carries
   * `teamName` and nothing else; `ReferralPurpose` exists but is on the ED arm only, and its own
   * comment says a community destination was given none because that would mean inventing values
   * nobody had ruled on. So a team receiving this row cannot tell a discharge follow-up from a
   * request to take a patient onto its caseload.
   *
   * ⚠️ **AND THE CONSEQUENCE OF A DECLINE IS MODELLED IDENTICALLY FOR BOTH.** `referralState`
   * returns "declined" once every destination has declined, and nothing else happens. A declined
   * admission means a patient stays where they are; a declined follow-up means a patient is already
   * at home with nobody seeing them. **The model cannot currently tell those apart, and no test
   * here should imply that it can.**
   *
   * A field carrying that distinction is a change to a clinical record and belongs to the owner.
   * Until he rules, this file guards the PATH and says nothing about the MEANING.
   */
});

describe("RB4: area-first community team options", () => {
  it("orders the patient's area team first when a suburb is given", () => {
    const teams = communityTeamOptionsForSuburb("Armadale");
    expect(teams[0]).toBe("Mead Centre (Armadale)");
  });

  it("returns alphabetical list when no suburb is given or suburb cannot be placed", () => {
    const defaultTeams = communityTeamOptions();
    expect(communityTeamOptionsForSuburb(null)).toEqual(defaultTeams);
    expect(communityTeamOptionsForSuburb(undefined)).toEqual(defaultTeams);
  });
});

describe("RB4: REFER_TO_COMMUNITY_TEAM reducer handler", () => {
  /*
   * ⚠️ RETARGETED FROM WF-001 (Opus adversarial review, 2026-09-17, F4). WF-001 is on a Form 1A
   * with no examination recorded, so F4's new gate now refuses it — see "refuses a patient on a
   * legal form with no examination outcome" below, which uses WF-001 for exactly that. WF-003
   * (RPH, Form 3B, `examination.outcome: "inpatient_order"`, accepted at rph-adult-secure, no
   * linked referral) is the only seeded movement that is both examined and accepted, which makes
   * it the one candidate that can prove F5's unwind (an accepting ward losing its acceptance) and
   * F6's suburb fix (no linked referral to read a suburb from) in the same dispatch.
   */
  it("creates a real referral, records notice, releases bed, records edOutcome, and unwinds the accepted ward (F5)", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((m) => m.id === "WF-003")!;
    expect(movement.examination?.outcome, "fixture drifted: WF-003 is no longer examined").toBe("inpatient_order");
    expect(movement.acceptedUnitId, "fixture drifted: WF-003 no longer has an accepting ward").toBe("rph-adult-secure");

    const after = wardFlowReducer(state, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW_ANCHOR + 10,
      movementId: movement.id,
      team: "Mead Centre (Armadale)",
    });

    expect(after.rejections.slice(state.rejections.length)).toEqual([]);

    const updatedMovement = after.movements.find((m) => m.id === movement.id)!;
    expect(updatedMovement.edOutcome).toBe("for_community_follow_up");
    expect(updatedMovement.closure?.outcome).toBe("did_not_proceed");
    expect(updatedMovement.closure?.at).toBe(NOW_ANCHOR + 10);

    // F5: the accepted ward is unwound, not left dangling on a movement that has moved on.
    expect(
      updatedMovement.acceptedUnitId,
      "F5: acceptedUnitId must be cleared, like WITHDRAW_REFERRAL",
    ).toBeUndefined();
    const wardNotice = after.notices.find((n) => n.kind === "referral_revoked_ward");
    expect(
      wardNotice,
      "F5: the ward that had accepted must be told it is no longer getting this patient",
    ).toBeDefined();
    expect(wardNotice?.to).toEqual({ role: "ward", placeId: "rph-adult-secure" });

    // Referral is generated
    const newReferral = after.referrals.at(-1)!;
    expect(newReferral.source).toBe("ed_medical");
    expect(newReferral.destinations[0].destination).toEqual({
      kind: "community_team",
      teamName: "Mead Centre (Armadale)",
    });
    // F6: WF-003 carries no referralId, so there is no linked referral to read a suburb from.
    // The old code invented `{ kind: "named", name: <hospital name> }`; it must now state absence.
    expect(newReferral.suburb, "F6: a hospital's name is not a patient's suburb").toEqual({
      kind: "unknown",
      reason: "not_known",
    });
    // Finding 4: the same "no linked referral" case must not leave `history` as an empty string —
    // a stated absence, not a blank field a reader cannot tell from "nothing happened yet".
    expect(newReferral.history).toBe(
      "Referred from the emergency department; no written referral history was recorded.",
    );

    // Notice is generated for the destination community team
    const notice = after.notices.find((n) => n.kind === "community_referral_received");
    expect(notice).toBeDefined();
    expect(notice?.to).toEqual({
      role: "community",
      placeId: communityTeamSlug("Mead Centre (Armadale)"),
    });
  });

  it("refuses a closed movement", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((m) => m.id === "WF-003")!;
    const closed = wardFlowReducer(state, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW_ANCHOR + 10,
      movementId: movement.id,
      team: "Mead Centre (Armadale)",
    });

    const second = wardFlowReducer(closed, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW_ANCHOR + 20,
      movementId: movement.id,
      team: "Mead Centre (Armadale)",
    });

    expect(second.rejections.slice(closed.rejections.length)).toHaveLength(1);
    expect(second.rejections.at(-1)?.reason).toContain("cannot refer a closed movement");
  });

  /*
   * F4 (Opus adversarial review, 2026-09-17, owner answer 14): "a patient on a legal form cannot
   * be referred to a community team until a psychiatric examination outcome has been recorded."
   * WF-001 (Form 1A, `referralAbsence` recorded, no `examination`) and WF-005 (on a form via
   * `legalStatus`, no `examination`, but ALREADY ACCEPTED at fre-adult-open with a booked
   * transport job) are both refused. WF-005 additionally proves the refusal happens BEFORE any
   * unwind: its accepting ward keeps its acceptance and is never told anything, because the whole
   * dispatch never got past the gate.
   */
  it("refuses a patient on a legal form with no examination outcome recorded", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((m) => m.id === "WF-001")!;
    expect(movement.examination, "fixture drifted: WF-001 is no longer un-examined").toBeUndefined();

    const after = wardFlowReducer(state, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW_ANCHOR + 10,
      movementId: movement.id,
      team: "Mead Centre (Armadale)",
    });

    expect(after.rejections.slice(state.rejections.length)).toHaveLength(1);
    expect(after.rejections.at(-1)?.reason).toContain("examination outcome");
    expect(after.movements.find((m) => m.id === movement.id)!.edOutcome).toBeUndefined();
  });

  it("refuses an accepted-but-unexamined patient on a form, leaving its accepting ward untouched and untold", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((m) => m.id === "WF-005")!;
    expect(movement.examination, "fixture drifted: WF-005 is no longer un-examined").toBeUndefined();
    expect(movement.acceptedUnitId, "fixture drifted: WF-005 no longer has an accepting ward").toBe("fre-adult-open");

    const after = wardFlowReducer(state, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW_ANCHOR + 10,
      movementId: movement.id,
      team: "Mead Centre (Armadale)",
    });

    expect(after.rejections.slice(state.rejections.length)).toHaveLength(1);
    const updated = after.movements.find((m) => m.id === movement.id)!;
    expect(updated.acceptedUnitId, "WF-005 keeps its accepting ward — the dispatch never got past F4").toBe(
      "fre-adult-open",
    );
    expect(
      after.notices.some((n) => n.kind === "referral_revoked_ward" && n.to?.placeId === "fre-adult-open"),
      "WF-005's ward is never told, because nothing was ever revoked",
    ).toBe(false);
  });

  /*
   * F5 scoping: the unwind above touches ONLY the movement being referred. WF-002 (live
   * `referredUnitIds`, no acceptance) and WF-004 (accepted, bed pulled) are siblings this
   * dispatch never names, and must come through unchanged.
   */
  it("does not touch sibling movements' live requests or accepted wards", () => {
    const state = seedWardFlowState();
    const wf002Before = state.movements.find((m) => m.id === "WF-002")!;
    const wf004Before = state.movements.find((m) => m.id === "WF-004")!;
    expect(wf002Before.referredUnitIds).toEqual(["fsh-older-adult"]);
    expect(wf004Before.acceptedUnitId).toBe("bty-adult-secure");

    const after = wardFlowReducer(state, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW_ANCHOR + 10,
      movementId: "WF-003",
      team: "Mead Centre (Armadale)",
    });

    const wf002After = after.movements.find((m) => m.id === "WF-002")!;
    const wf004After = after.movements.find((m) => m.id === "WF-004")!;
    expect(wf002After.referredUnitIds, "WF-002 keeps its requests").toEqual(["fsh-older-adult"]);
    expect(wf004After.acceptedUnitId, "WF-004 keeps its accepting ward").toBe("bty-adult-secure");
    expect(after.notices.some((n) => n.kind === "referral_revoked_ward" && n.to?.placeId === "bty-adult-secure")).toBe(
      false,
    );
  });
});

describe("finding 3 (2026-09-17 review): REFER_TO_COMMUNITY_TEAM reuses a queued arm to the same team", () => {
  // WF-002 (Voluntary, no legal form, no transport, no closure) is linked to referral RF-012,
  // which addresses only fsh-ed (an emergency_department destination). Cloning both here rather
  // than raising a fresh journey through RAISE_REFERRAL, whose own referralId guard requires an
  // emergency_department addressing this test does not need to prove — the reducer behaviour
  // under test is entirely inside REFER_TO_COMMUNITY_TEAM's own handling of an already-linked
  // referral, which is unaffected by how that link was first made.
  function stateWithLinkedCommunityArm(destinations: Referral["destinations"]) {
    const seeded = seedWardFlowState();
    const baseReferral = seeded.referrals.find((r) => r.id === "RF-012")!;
    const baseMovement = seeded.movements.find((m) => m.id === "WF-002")!;
    const linkedReferral: Referral = {
      ...baseReferral,
      id: "RF-TEST-LINKED-ARM",
      destinations,
    };
    const movement: Movement = {
      ...baseMovement,
      id: "WF-TEST-LINKED-ARM",
      referralId: linkedReferral.id,
    };
    const state: WardFlowState = {
      ...seeded,
      referrals: [...seeded.referrals, linkedReferral],
      movements: [...seeded.movements, movement],
    };
    return { state, linkedReferral, movement };
  }

  it("reuses the existing queued arm rather than raising a second referral to the same team", () => {
    const { state, linkedReferral, movement } = stateWithLinkedCommunityArm([
      {
        destination: { kind: "community_team", teamName: "Mead Centre (Armadale)" },
        state: "queued",
      },
    ]);
    const referralCountBefore = state.referrals.length;
    const sequenceBefore = state.frontDoorReferralSequence;

    const after = wardFlowReducer(state, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW_ANCHOR + 10,
      movementId: movement.id,
      team: "Mead Centre (Armadale)",
    });

    expect(after.rejections.slice(state.rejections.length)).toEqual([]);
    // MUTATION TARGET: a second referral (or a duplicate arm) here means the count grew or the
    // linked referral's own destinations array gained a member — either is the duplicate this
    // finding exists to stop.
    expect(after.referrals).toHaveLength(referralCountBefore);
    expect(after.frontDoorReferralSequence).toBe(sequenceBefore);
    const stillLinkedReferral = after.referrals.find((r) => r.id === linkedReferral.id)!;
    expect(stillLinkedReferral.destinations).toHaveLength(1);

    const notice = after.notices.find((n) => n.kind === "community_referral_received");
    expect(notice).toBeDefined();
    expect(notice?.about).toEqual({ movementId: movement.id, referralId: linkedReferral.id });
    expect(notice?.sentence).toContain("reusing the existing queued referral");
    expect(notice?.sentence).toContain(linkedReferral.id);

    const updatedMovement = after.movements.find((m) => m.id === movement.id)!;
    expect(updatedMovement.edOutcome).toBe("for_community_follow_up");
    expect(updatedMovement.closure?.outcome).toBe("did_not_proceed");
  });

  it("still raises a new referral when the linked referral's queued arm is to a DIFFERENT team", () => {
    const { state, movement } = stateWithLinkedCommunityArm([
      {
        destination: { kind: "community_team", teamName: "Armadale Adult Mental Health" },
        state: "queued",
      },
    ]);
    const referralCountBefore = state.referrals.length;

    const after = wardFlowReducer(state, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW_ANCHOR + 10,
      movementId: movement.id,
      team: "Mead Centre (Armadale)",
    });

    expect(after.rejections.slice(state.rejections.length)).toEqual([]);
    expect(after.referrals).toHaveLength(referralCountBefore + 1);
    const newReferral = after.referrals.at(-1)!;
    expect(newReferral.destinations[0].destination).toEqual({
      kind: "community_team",
      teamName: "Mead Centre (Armadale)",
    });
  });

  it("still raises a new referral when the linked referral's arm to the same team is already DECLINED, not queued", () => {
    const { state, movement } = stateWithLinkedCommunityArm([
      {
        destination: { kind: "community_team", teamName: "Mead Centre (Armadale)" },
        state: "declined",
      },
    ]);
    const referralCountBefore = state.referrals.length;

    const after = wardFlowReducer(state, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW_ANCHOR + 10,
      movementId: movement.id,
      team: "Mead Centre (Armadale)",
    });

    expect(after.rejections.slice(state.rejections.length)).toEqual([]);
    expect(after.referrals).toHaveLength(referralCountBefore + 1);
  });
});

describe("RB4: RECORD_LEFT_DEPARTMENT", () => {
  it("refuses if no edOutcome has been recorded yet", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((m) => m.originEdId === "arm-ed" && !m.closure)!;

    const after = wardFlowReducer(state, {
      type: "RECORD_LEFT_DEPARTMENT",
      role: "ed",
      now: NOW_ANCHOR + 10,
      movementId: movement.id,
    });

    expect(after.rejections.slice(state.rejections.length)).toHaveLength(1);
    expect(after.rejections.at(-1)?.reason).toContain("has no ed outcome recorded");
  });

  it("records leftDepartmentAt when an outcome has been recorded", () => {
    const state = seedWardFlowState();
    // WF-003, not an "arm-ed" movement: F4 now refuses REFER_TO_COMMUNITY_TEAM for a patient on a
    // form with no examination outcome, and WF-003 is the seeded movement that has one.
    const movement = state.movements.find((m) => m.id === "WF-003")!;

    const withOutcome = wardFlowReducer(state, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW_ANCHOR + 10,
      movementId: movement.id,
      team: "Mead Centre (Armadale)",
    });

    const after = wardFlowReducer(withOutcome, {
      type: "RECORD_LEFT_DEPARTMENT",
      role: "ed",
      now: NOW_ANCHOR + 20,
      movementId: movement.id,
    });

    expect(after.rejections.slice(withOutcome.rejections.length)).toEqual([]);
    const updated = after.movements.find((m) => m.id === movement.id)!;
    expect(updated.leftDepartmentAt).toBe(NOW_ANCHOR + 20);

    // Second departure record is refused
    const second = wardFlowReducer(after, {
      type: "RECORD_LEFT_DEPARTMENT",
      role: "ed",
      now: NOW_ANCHOR + 30,
      movementId: movement.id,
    });
    expect(second.rejections.slice(after.rejections.length)).toHaveLength(1);
    expect(second.rejections.at(-1)?.reason).toContain("already been recorded as left department");
  });
});

describe("REFER_TO_COMMUNITY_TEAM — P1-4 (Ward Lead audit, 2026-09-17): tells the officer and dropped wards", () => {
  it("tells a ward still holding a live, unaccepted request that it has been dropped", () => {
    const state = seedWardFlowState();
    const wf002 = state.movements.find((m) => m.id === "WF-002")!;
    expect(wf002.referredUnitIds, "fixture drifted: WF-002 no longer carries a live request").toEqual([
      "fsh-older-adult",
    ]);
    expect(wf002.legalStatus, "fixture drifted: WF-002 is no longer voluntary").toBe("Voluntary");

    const after = wardFlowReducer(state, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW_ANCHOR + 10,
      movementId: "WF-002",
      team: "Mead Centre (Armadale)",
    });
    expect(after.rejections.slice(state.rejections.length)).toEqual([]);

    const notice = after.notices.find((n) => n.kind === "ward_request_withdrawn" && n.to.placeId === "fsh-older-adult");
    expect(
      notice,
      "P1-4: a ward whose live request was dropped must be told, not just have the record updated",
    ).toBeDefined();
    expect(notice?.about).toEqual({ movementId: "WF-002", unitId: "fsh-older-adult" });
  });

  it("tells the officer a booked, uncollected job is cancelled", () => {
    // A voluntary walk-in, so the on-form examination gate never applies — the same "no linked
    // referral" shape WF-003's own F6 test above already walks, built fresh here so the movement
    // can also carry a live, uncollected transport job by the time it is referred to community.
    let state = wardFlowReducer(seedWardFlowState(), {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW_ANCHOR,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        gender: "Female", // R7 (2026-09-25): record gender so the walk needs no coordinator review
        specialling: false,
        highAcuity: false,
        legalStatus: "Voluntary",
        urgency: 2,
        legalFormCode: null,
      },
    });
    expect(state.rejections).toEqual([]);
    const movementId = state.movements.at(-1)!.id;
    // `scgh-adult-open`: a unit REFER_TO_UNITS can name without touching any eligibility gate,
    // the same choice `tests/ward-raise-referral-uniqueness.test.ts` makes for the same reason.
    const unitId = "scgh-adult-open";
    for (const event of [
      { type: "REFER_TO_UNITS", role: "coordinator", unitIds: [unitId] },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId },
      { type: "PULL_PATIENT", role: "ward", unitId },
      {
        type: "BOOK_TRANSPORT",
        role: "ed",
        provider: "Ambulance service",
        escortRequired: true,
        cadNumber: "CAD-STUB-0001",
        transportLegalStatus: "voluntary",
        estimatedAt: 0,
      },
      { type: "HANDOVER_READY", role: "ed" },
      { type: "TRANSPORT_ACCEPTED", role: "officer" },
    ] as const) {
      state = wardFlowReducer(state, { ...event, now: NOW_ANCHOR, movementId } as never);
    }
    expect(state.rejections, "the walk itself must succeed, or this test proves nothing").toEqual([]);
    const walked = state.movements.find((m) => m.id === movementId)!;
    expect(walked.transport?.collectedAt).toBeUndefined();

    const after = wardFlowReducer(state, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW_ANCHOR + 10,
      movementId,
      team: "Mead Centre (Armadale)",
    });
    expect(after.rejections.slice(state.rejections.length)).toEqual([]);

    const updated = after.movements.find((m) => m.id === movementId)!;
    expect(updated.acceptedUnitId).toBeUndefined();
    expect(updated.transport?.cancelledAt).toBe(NOW_ANCHOR + 10);

    const officerNotice = after.notices.find((n) => n.kind === "transport_cancelled_officer");
    expect(officerNotice, "the transport officer must be told the booked job is cancelled").toBeDefined();
    expect(officerNotice?.to).toEqual({ role: "officer" });
    expect(officerNotice?.about).toEqual({ movementId });
  });
});
