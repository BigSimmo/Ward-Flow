// Top 25 item 2 (owner ruling 15 Oct 2026): other requests are withdrawn when one ward accepts,
// and a chosen reason for asking past the referral cap is kept in the audit trail. Finding 188
// (Josh, 27 Oct 2026): the cap is a warning everywhere, so a ward past it is asked without a reason.

import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { REFERRAL_CAP_REASONS } from "../src/components/ward-management/ward-change-reasons";

const NOW = NOW_ANCHOR;
const MOVEMENT_ID = "WF-009";
const UNITS = ["rph-adult-secure", "fsh-adult-secure", "rgh-adult-secure", "gry-adult-secure"];

function seeded(): WardFlowState {
  const state = seedWardFlowState();
  return {
    ...state,
    movements: state.movements.map((candidate) =>
      candidate.id === MOVEMENT_ID ? { ...candidate, gender: "Male" } : candidate,
    ),
  };
}

function movement(state: WardFlowState) {
  const found = state.movements.find((candidate) => candidate.id === MOVEMENT_ID);
  if (!found) throw new Error("missing movement");
  return found;
}

describe("referral cap warns and keeps a chosen reason (Top 25 item 2, finding 188)", () => {
  it("the seeded cap is three wards", () => {
    expect(seeded().configuration.parallelReferralCap).toBe(3);
  });

  it("asks a fourth ward with no reason, since the cap is a warning (finding 188)", () => {
    const s0 = seeded();
    const s1 = wardFlowReducer(s0, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW + 1,
      movementId: MOVEMENT_ID,
      unitIds: UNITS,
    });
    expect(s1.rejections.length).toBe(s0.rejections.length);
    expect(movement(s1).referredUnitIds).toEqual(UNITS);
    expect((s1.auditEvents.at(-1)?.details as { overCapReason?: string }).overCapReason).toBeUndefined();
  });

  it("asks a fourth ward when a reason is chosen and keeps the reason in the audit trail", () => {
    const s0 = seeded();
    const reason = REFERRAL_CAP_REASONS[0];
    const s1 = wardFlowReducer(s0, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW + 1,
      movementId: MOVEMENT_ID,
      unitIds: UNITS,
      overCapReason: reason,
    });
    expect(s1.rejections.length).toBe(s0.rejections.length);
    expect(movement(s1).referredUnitIds).toEqual(UNITS);
    const audit = s1.auditEvents.at(-1);
    expect(audit?.action).toBe("REFER_TO_UNITS");
    expect((audit?.details as { overCapReason?: string }).overCapReason).toBe(reason);
  });

  it("keeps no cap reason in the audit trail when the referral stays within the cap", () => {
    const s1 = wardFlowReducer(seeded(), {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW + 1,
      movementId: MOVEMENT_ID,
      unitIds: UNITS.slice(0, 2),
      overCapReason: REFERRAL_CAP_REASONS[1],
    });
    expect(movement(s1).referredUnitIds).toEqual(UNITS.slice(0, 2));
    expect((s1.auditEvents.at(-1)?.details as { overCapReason?: string }).overCapReason).toBeUndefined();
  });

  it("refuses a reason that is not on the list", () => {
    const s0 = seeded();
    const s1 = wardFlowReducer(s0, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW + 1,
      movementId: MOVEMENT_ID,
      unitIds: UNITS,
      overCapReason: "typed text" as never,
    });
    expect(s1.rejections.length).toBe(s0.rejections.length + 1);
    expect(movement(s1).referredUnitIds).toEqual([]);
  });

  it("withdraws the other open requests when one ward accepts, recorded on the movement", () => {
    const s1 = wardFlowReducer(seeded(), {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: NOW + 1,
      movementId: MOVEMENT_ID,
      unitIds: UNITS,
      overCapReason: REFERRAL_CAP_REASONS[2],
    });
    const s2 = wardFlowReducer(s1, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "coordinator",
      now: NOW + 2,
      movementId: MOVEMENT_ID,
      unitId: UNITS[0],
    });
    expect(s2.rejections.length).toBe(s1.rejections.length);
    expect(movement(s2).referredUnitIds).toEqual([]);
    expect(movement(s2).acceptedUnitId).toBe(UNITS[0]);
    expect(
      movement(s2)
        .withdrawnReferrals.filter((record) => record.reason === "another_unit_accepted")
        .map((record) => record.unitId),
    ).toEqual(UNITS.slice(1));
  });
});
