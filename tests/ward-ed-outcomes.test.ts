// tests/ward-ed-outcomes.test.ts
//
// RB3, item 19 (owner answers 2026-09-17): "'For discharge' and 'For community follow-up' are
// recorded outcomes." `RECORD_ED_OUTCOME` is the department recording that a patient no longer
// needs a psychiatric bed search — this file pins the reducer's own unwind, the same shape
// `WITHDRAW_REFERRAL`'s pre-collection path already holds to: live ward requests are withdrawn, a
// pulled bed and its admission are released once, and an uncollected transport job is cancelled —
// then the movement closes `did_not_proceed`, with the outcome as the reason.
import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

function recordOutcome(
  state: WardFlowState,
  movementId: string,
  outcome: "for_discharge" | "for_community_follow_up",
  now = NOW_ANCHOR + 10,
) {
  return wardFlowReducer(state, {
    type: "RECORD_ED_OUTCOME",
    role: "ed",
    now,
    movementId,
    outcome,
  });
}

describe("RECORD_ED_OUTCOME — withdraws live requests", () => {
  it("moves WF-002's live referral into withdrawnReferrals and clears referredUnitIds", () => {
    const before = seedWardFlowState();
    const wf002 = before.movements.find((m) => m.id === "WF-002")!;
    expect(wf002.referredUnitIds, "fixture drifted: WF-002 no longer carries a live request").toEqual([
      "fsh-older-adult",
    ]);

    const after = recordOutcome(before, "WF-002", "for_discharge");
    expect(after.rejections.slice(before.rejections.length)).toEqual([]);

    const updated = after.movements.find((m) => m.id === "WF-002")!;
    expect(updated.referredUnitIds).toEqual([]);
    // `ed_outcome_recorded`, not `referrer_withdrew` (`ward-flow-reducer.ts`, 2026-09-17
    // truthfulness fix): the department recording an outcome is not the referrer withdrawing —
    // `ward-change-reasons.ts`'s own doc comment on the two reasons names this exact distinction.
    expect(updated.withdrawnReferrals).toContainEqual(
      expect.objectContaining({ unitId: "fsh-older-adult", reason: "ed_outcome_recorded" }),
    );
    expect(updated.edOutcome).toBe("for_discharge");
    expect(updated.closure).toEqual({ at: NOW_ANCHOR + 10, outcome: "did_not_proceed", reason: "For discharge" });
  });
});

describe("RECORD_ED_OUTCOME — releases a pulled bed exactly once", () => {
  it("restores WF-004's held bed and clears its admission", () => {
    const before = seedWardFlowState();
    const wf004 = before.movements.find((m) => m.id === "WF-004")!;
    expect(wf004.stage, "fixture drifted: WF-004 is no longer at a bed-holding stage").toBe("pulled");
    expect(wf004.acceptedUnitId).toBe("bty-adult-secure");
    const unitBefore = before.units.find((u) => u.id === "bty-adult-secure")!;

    const after = recordOutcome(before, "WF-004", "for_community_follow_up");
    expect(after.rejections.slice(before.rejections.length)).toEqual([]);

    const unitAfter = after.units.find((u) => u.id === "bty-adult-secure")!;
    expect(unitAfter.allocatable.value).toBe(unitBefore.allocatable.value + 1);

    const updated = after.movements.find((m) => m.id === "WF-004")!;
    expect(updated.admissionId).toBeUndefined();
    expect(updated.edOutcome).toBe("for_community_follow_up");
    expect(updated.closure?.reason).toBe("For community follow-up");

    // Calling it again on the now-closed movement must not refund the same bed a second time.
    const again = recordOutcome(after, "WF-004", "for_discharge", NOW_ANCHOR + 20);
    expect(again.rejections.slice(after.rejections.length)).toHaveLength(1);
    const unitStillAfter = again.units.find((u) => u.id === "bty-adult-secure")!;
    expect(unitStillAfter.allocatable.value).toBe(unitAfter.allocatable.value);
  });
});

describe("RECORD_ED_OUTCOME — P1-4 (Ward Lead audit, 2026-09-17): tells the ward and the officer", () => {
  it("clears acceptedUnitId and notifies the ward at accepted_awaiting_bed (no bed pulled, no transport job)", () => {
    const before = seedWardFlowState();
    const wf003 = before.movements.find((m) => m.id === "WF-003")!;
    expect(wf003.stage, "fixture drifted: WF-003 is no longer accepted_awaiting_bed").toBe("accepted_awaiting_bed");
    expect(wf003.acceptedUnitId, "fixture drifted: WF-003 no longer has an accepting ward").toBe("rph-adult-secure");

    const after = recordOutcome(before, "WF-003", "for_discharge");
    expect(after.rejections.slice(before.rejections.length)).toEqual([]);

    const updated = after.movements.find((m) => m.id === "WF-003")!;
    expect(
      updated.acceptedUnitId,
      "P1-4: left set, the ED outbox would go on showing this discharged patient as still going to the ward",
    ).toBeUndefined();

    const wardNotice = after.notices.find(
      (n) => n.kind === "referral_revoked_ward" && n.to.placeId === "rph-adult-secure",
    );
    expect(wardNotice, "P1-4: the accepting ward must be told the patient is no longer coming").toBeDefined();
    expect(wardNotice?.about).toEqual({ movementId: "WF-003", unitId: "rph-adult-secure" });

    // No bed was ever pulled, so no transport job ever existed — nobody to tell.
    expect(after.notices.some((n) => n.kind === "transport_cancelled_officer")).toBe(false);
  });

  it("tells the officer a booked, uncollected job is cancelled, and clears acceptedUnitId, walking raise -> refer -> accept -> pull -> book -> handover -> officer accepts -> outcome", () => {
    let state = seedWardFlowState();
    // T11 (item 8): gender must be recorded before a referral can reach a single-gender ward —
    // the same local patch `tests/ward-flow-reducer.test.ts`'s own `seeded()` applies for the same
    // reason, kept local here rather than in the shared seed for the same reason that file gives.
    state = {
      ...state,
      movements: state.movements.map((candidate) =>
        candidate.id === "WF-009" ? { ...candidate, gender: "Male" as const } : candidate,
      ),
    };
    for (const event of [
      { type: "REFER_TO_UNITS", role: "coordinator", unitIds: ["rph-adult-secure"] },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: "rph-adult-secure" },
      { type: "PULL_PATIENT", role: "ward", unitId: "rph-adult-secure" },
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
      state = wardFlowReducer(state, { ...event, now: NOW_ANCHOR, movementId: "WF-009" } as never);
    }
    expect(state.rejections, "the walk itself must succeed, or this test proves nothing").toEqual([]);
    const walked = state.movements.find((m) => m.id === "WF-009")!;
    expect(walked.acceptedUnitId).toBe("rph-adult-secure");
    expect(walked.transport?.collectedAt).toBeUndefined();

    const after = recordOutcome(state, "WF-009", "for_discharge", NOW_ANCHOR + 10);
    expect(after.rejections.slice(state.rejections.length)).toEqual([]);

    const updated = after.movements.find((m) => m.id === "WF-009")!;
    expect(updated.acceptedUnitId).toBeUndefined();
    expect(updated.transport?.cancelledAt).toBe(NOW_ANCHOR + 10);

    const wardNotice = after.notices.find(
      (n) => n.kind === "referral_revoked_ward" && n.to.placeId === "rph-adult-secure",
    );
    expect(wardNotice, "the accepting ward must be told").toBeDefined();

    const officerNotice = after.notices.find((n) => n.kind === "transport_cancelled_officer");
    expect(officerNotice, "the transport officer must be told the booked job is cancelled").toBeDefined();
    expect(officerNotice?.to).toEqual({ role: "officer" });
    expect(officerNotice?.about).toEqual({ movementId: "WF-009" });
  });

  it("tells a ward still holding a live, unaccepted request that it has been dropped", () => {
    const before = seedWardFlowState();
    const wf002 = before.movements.find((m) => m.id === "WF-002")!;
    expect(wf002.referredUnitIds, "fixture drifted: WF-002 no longer carries a live request").toEqual([
      "fsh-older-adult",
    ]);

    const after = recordOutcome(before, "WF-002", "for_community_follow_up");
    const notice = after.notices.find((n) => n.kind === "ward_request_withdrawn" && n.to.placeId === "fsh-older-adult");
    expect(
      notice,
      "P1-4: a ward whose live request was dropped must be told, not just have the record updated",
    ).toBeDefined();
    expect(notice?.about).toEqual({ movementId: "WF-002", unitId: "fsh-older-adult" });
  });
});

describe("RECORD_ED_OUTCOME — for_discharge refused on a legal form until examined (owner answer 1, second round, 2026-09-17)", () => {
  it("refuses 'for_discharge' for a movement on a legal form with no examination outcome recorded", () => {
    const before = seedWardFlowState();
    const wf001 = before.movements.find((m) => m.id === "WF-001")!;
    expect(wf001.examination, "fixture drifted: WF-001 is no longer un-examined").toBeUndefined();
    expect(wf001.legalForm?.code, "fixture drifted: WF-001 is no longer on a legal form").toBe("1A");

    const after = recordOutcome(before, "WF-001", "for_discharge");
    expect(after.rejections.slice(before.rejections.length)).toHaveLength(1);
    expect(after.rejections.at(-1)?.reason).toContain("examination outcome");
    expect(after.movements.find((m) => m.id === "WF-001")!.edOutcome).toBeUndefined();
  });

  it("accepts 'for_discharge' once a conclusive examination outcome is recorded", () => {
    const before = seedWardFlowState();
    const examined = wardFlowReducer(before, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW_ANCHOR + 5,
      movementId: "WF-001",
      outcome: "inpatient_order",
    });
    expect(examined.rejections.slice(before.rejections.length)).toEqual([]);

    const after = recordOutcome(examined, "WF-001", "for_discharge", NOW_ANCHOR + 10);
    expect(after.rejections.slice(examined.rejections.length)).toEqual([]);
    expect(after.movements.find((m) => m.id === "WF-001")!.edOutcome).toBe("for_discharge");
  });

  it("does not refuse 'for_community_follow_up' on the same unexamined legal-form movement", () => {
    const before = seedWardFlowState();
    const after = recordOutcome(before, "WF-001", "for_community_follow_up");
    expect(after.rejections.slice(before.rejections.length)).toEqual([]);
    expect(after.movements.find((m) => m.id === "WF-001")!.edOutcome).toBe("for_community_follow_up");
  });
});

describe("RECORD_ED_OUTCOME — refusals", () => {
  it("refuses a movement whose patient has already been collected, naming STOP_TRANSPORT", () => {
    const before = seedWardFlowState();
    const wf006 = before.movements.find((m) => m.id === "WF-006")!;
    expect(wf006.transport?.collectedAt, "fixture drifted: WF-006 is no longer collected").not.toBeUndefined();

    const after = recordOutcome(before, "WF-006", "for_discharge");
    expect(after.rejections.slice(before.rejections.length)).toHaveLength(1);
    expect(after.rejections.at(-1)?.reason).toContain("STOP_TRANSPORT");
    const unchanged = after.movements.find((m) => m.id === "WF-006")!;
    expect(unchanged.edOutcome).toBeUndefined();
  });

  it("refuses a movement that has already closed", () => {
    const before = seedWardFlowState();
    const once = recordOutcome(before, "WF-002", "for_discharge");
    const twice = recordOutcome(once, "WF-002", "for_community_follow_up", NOW_ANCHOR + 20);
    expect(twice.rejections.slice(once.rejections.length)).toHaveLength(1);
    expect(twice.rejections.at(-1)?.reason).toContain("closed movement");
    const stillFirst = twice.movements.find((m) => m.id === "WF-002")!;
    expect(stillFirst.edOutcome).toBe("for_discharge");
  });
});
