import { describe, expect, it } from "vitest";
import { OVERRIDE_REASONS } from "@/components/ward-management/ward-change-reasons";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Audit 2 (20 Oct 2026) engine rules: Josh's decisions 1, 2 and 4, plus E-04. Synthetic
 * seed data only. Each case states the finding it pins; the sequences come from the audit's own
 * probes (/mnt/project-files/audits/2026-10-20-engine-invariants/evidence/challenge/).
 */
let clock = NOW_ANCHOR;
function send(state: WardFlowState, event: Record<string, unknown>) {
  clock += 1;
  const next = wardFlowReducer(state, { now: clock, ...event } as WardFlowEvent);
  const refused = next.rejections.length > state.rejections.length;
  return { next, refused, reason: refused ? (next.rejections.at(-1)?.reason ?? "") : "" };
}
const fresh = () => seedWardFlowState();
const movement = (state: WardFlowState, id: string) => state.movements.find((candidate) => candidate.id === id)!;
const unit = (state: WardFlowState, id: string) => state.units.find((candidate) => candidate.id === id)!;
const close = (state: WardFlowState, unitId: string) =>
  send(state, { type: "CLOSE_WARD_TO_ADMISSIONS", role: "coordinator", unitId, reason: "staffing" }).next;

describe("E-02: a closed ward takes no new admission until a person reopens it", () => {
  it("refuses accept in principle at a closed ward and leaves the other wards' asks alone", () => {
    const closed = close(fresh(), "bty-older-adult");
    expect(unit(closed, "bty-older-adult").isClosed).toBe(true);
    const before = movement(closed, "WF-013");
    const accept = send(closed, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      movementId: "WF-013",
      unitId: "bty-older-adult",
      actingUnitId: "bty-older-adult",
    });
    expect(accept.refused).toBe(true);
    expect(accept.reason).toMatch(/closed to admissions \(Staffing\)/);
    expect(movement(accept.next, "WF-013")).toEqual(before);
  });

  it("holds a closed ward back in Refer to wards, per ward, and never with an override reason", () => {
    const closed = close(fresh(), "scgh-adult-open");
    const alone = send(closed, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      movementId: "WF-302",
      unitIds: ["scgh-adult-open"],
      overrideReason: OVERRIDE_REASONS[0],
    });
    expect(alone.refused).toBe(true);
    expect(alone.reason).toMatch(/closed to admissions/);
    expect(movement(alone.next, "WF-302").referredUnitIds).not.toContain("scgh-adult-open");
  });

  it("refuses a front-door acceptance at a closed ward", () => {
    const closed = close(fresh(), "alb-adult-open");
    const accept = send(closed, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      referralId: "RF-011",
      destinationKind: "psychiatric_ward",
      unitId: "alb-adult-open",
    });
    expect(accept.refused).toBe(true);
    expect(accept.reason).toMatch(/closed to admissions/);
  });

  it("reopening lets the same acceptance through", () => {
    const closed = close(fresh(), "bty-older-adult");
    const reopened = send(closed, {
      type: "REOPEN_WARD_TO_ADMISSIONS",
      role: "coordinator",
      unitId: "bty-older-adult",
    }).next;
    expect(unit(reopened, "bty-older-adult").isClosed).toBeFalsy();
    const accept = send(reopened, {
      type: "ACCEPT_IN_PRINCIPLE",
      role: "ward",
      movementId: "WF-013",
      unitId: "bty-older-adult",
      actingUnitId: "bty-older-adult",
    });
    expect(accept.reason).not.toMatch(/closed to admissions/);
  });
});

describe("E-03: a legal status change after a bed is held is re-checked before collection", () => {
  const toInvoluntary = (state: WardFlowState, movementId: string) =>
    send(state, {
      type: "CHANGE_LEGAL_STATUS",
      role: "coordinator",
      movementId,
      legalStatus: "Involuntary inpatient",
      reason: "recorded_by_treating_team",
    }).next;

  it("refuses the restore pull without a reason and records an authorisation override with one", () => {
    const stepped = send(fresh(), {
      type: "STEP_BACK_STAGE",
      role: "coordinator",
      movementId: "WF-029",
      to: "accepted_awaiting_bed",
      reason: "the_decision_changed",
    }).next;
    const changed = toInvoluntary(stepped, "WF-029");
    const bare = send(changed, {
      type: "PULL_PATIENT",
      role: "coordinator",
      movementId: "WF-029",
      unitId: "sjgs-adult-open",
    });
    expect(bare.refused).toBe(true);
    expect(bare.reason).toMatch(/not set up for involuntary admissions/);
    expect(movement(bare.next, "WF-029").stage).toBe("accepted_awaiting_bed");

    const answered = send(changed, {
      type: "PULL_PATIENT",
      role: "coordinator",
      movementId: "WF-029",
      unitId: "sjgs-adult-open",
      overrideReason: OVERRIDE_REASONS[0],
    });
    expect(answered.refused).toBe(false);
    const restored = movement(answered.next, "WF-029");
    expect(restored.stage).toBe("pulled");
    expect(restored.overrides.some((o) => o.gate === "authorisation" && o.unitIds.includes("sjgs-adult-open"))).toBe(
      true,
    );
  });

  it("refuses the steps before collection once the status changes, and never refuses an arrival in transit", () => {
    const enRoute = send(fresh(), { type: "TRANSPORT_EN_ROUTE", role: "officer", movementId: "WF-030" }).next;
    const changed = toInvoluntary(enRoute, "WF-030");
    const collected = send(changed, { type: "PATIENT_COLLECTED", role: "officer", movementId: "WF-030" });
    expect(collected.refused).toBe(true);
    expect(collected.reason).toMatch(/not set up for involuntary admissions/);

    // A patient already moving when the status changes still arrives.
    let moving = fresh();
    for (const step of ["TRANSPORT_EN_ROUTE", "PATIENT_COLLECTED"]) {
      moving = send(moving, { type: step, role: "officer", movementId: "WF-030" }).next;
    }
    expect(movement(moving, "WF-030").stage).toBe("moving");
    const arrived = send(toInvoluntary(moving, "WF-030"), {
      type: "PATIENT_ARRIVED",
      role: "coordinator",
      movementId: "WF-030",
    });
    expect(arrived.refused).toBe(false);
    expect(movement(arrived.next, "WF-030").stage).toBe("arrived");
  });
});

describe("E-04: a referral with no recorded legal status needs an authorised bed", () => {
  it("refuses RF-RD06 into an unauthorised ward without a reason", () => {
    expect(unit(fresh(), "sjgs-adult-open").authorised).toBe(false);
    const accept = send(fresh(), {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      referralId: "RF-RD06",
      destinationKind: "psychiatric_ward",
      unitId: "sjgs-adult-open",
    });
    expect(accept.refused).toBe(true);
    expect(accept.reason).toMatch(/legal_status/);
  });
});
