import { describe, expect, it } from "vitest";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { movementNextStep } from "@/components/ward-management/movements/movement-next-step";
import { dueParts, dueShort, type HandoverRow } from "@/components/ward-management/handover/handover-model";
import { sampleProfile } from "@/components/ward-management/referrals/ward-referral-drawer-model";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR as now } from "@/components/ward-management/ward-sites";

describe("journey place and next step, 8 November 2026 (synthetic records)", () => {
  it("WF-J04: a pulled journey needing no transport waits on the receiving ward's arrival", () => {
    const pulled = seedWardFlowState().movements.find((row) => row.stage === "pulled")!;
    const direct: Movement = { ...pulled, transportNeed: { needed: false, at: now } };
    expect(movementNextStep(direct)).toEqual({ label: "Arrival", owner: "Receiving ward", kind: "wait" });
    // Transport needed or not yet answered keeps the sending team's handover.
    expect(movementNextStep({ ...pulled, transportNeed: { needed: true, at: now } })).toMatchObject({
      label: "Handover",
    });
    const { transportNeed: _need, ...unanswered } = pulled;
    void _need;
    expect(movementNextStep(unanswered as Movement)).toMatchObject({ label: "Handover" });
  });

  it("WF-J03: the referral sheet names a ward-to-ward journey's sending ward as its origin", () => {
    const state = seedWardFlowState();
    const movement = state.movements.find((row) => !row.closure && row.originEdId !== undefined)!;
    const stay = state.admissions.find((row) => row.state === "occupied")!;
    const wardName = state.units.find((unit) => unit.id === stay.unitId)!.name;
    const record = {
      ...state,
      dayZero: new Date(2026, 10, 8),
      movements: [{ ...movement, sourceAdmissionId: stay.id }],
    };
    expect(sampleProfile(movement.id, record, now).origin).toBe(wardName);
  });

  const movingRow = (transport: Movement["transport"]) => {
    const movement = { stage: "moving", transport } as Movement;
    return { stage: "moving", movement, pullExpiresAt: now - 60 } as unknown as HandoverRow;
  };
  const transport = { provider: "Synthetic transport", collectedAt: now - 30 } as unknown as Movement["transport"];

  it("AR-1: a delivered journey's Due cell says it arrived, not In transit or Collected", () => {
    const delivered = movingRow({ ...transport!, arrivedAt: now - 5 });
    expect(dueShort(delivered, now)).toBe("Arrived at ward, awaiting ward confirmation");
    expect(dueParts(delivered, now)).toEqual({ when: "Arrived at ward", what: "Awaiting ward confirmation" });
  });

  it("AR-1: an in-transit journey still reads In transit and never shows its bed hold lapse", () => {
    const inTransit = movingRow(transport);
    expect(dueShort(inTransit, now)).toBe("In transit");
    expect(dueParts(inTransit, now)).toEqual({ when: "In transit", what: "Collected" });
  });
});
