import { describe, expect, it } from "vitest";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import type { SenderMovementPartialView } from "@/components/ward-management/ward-partial-view-contract";
import {
  destinationText,
  groupOf,
  handoverStatusLabel,
  isbarText,
  isDueBy,
  nextStep,
  situationState,
  toHandoverRow,
} from "@/components/ward-management/handover/handover-model";
import { HANDOVER_COLUMNS } from "@/components/ward-management/handover/handover-columns";
import {
  movementInHandoverScope,
  urgentMovementsOutsideScope,
} from "@/components/ward-management/handover/handover-scope-rules";

const state = seedWardFlowStateAt(0);
const source = state.admissions.find((admission) => state.units.some((unit) => unit.id === admission.unitId))!;
const sourceUnit = state.units.find((unit) => unit.id === source.unitId)!;
const base = state.movements.find((movement) => movement.transport)!;
function movement(patch: Partial<Movement> = {}): Movement {
  return {
    ...base,
    id: "WF-OUTPUT-REGRESSION",
    stage: "placement_requested",
    closure: undefined,
    acceptedUnitId: undefined,
    referredUnitIds: [],
    declines: [],
    unwinds: [],
    withdrawnReferrals: [],
    sourceAdmissionId: undefined,
    transport: undefined,
    examination: undefined,
    legalForm: undefined,
    pullExpiresAt: undefined,
    flaggedUrgent: false,
    escalation: undefined,
    ...patch,
  };
}
const rowOf = (record: Movement, sender?: SenderMovementPartialView | null) => ({
  ...toHandoverRow(record, state.units, state.patients, state.referrals, state.admissions, sender),
  actNow: false,
});
const ctx = { now: 600, cutoff: 700, readyBeds: () => 0 };
const printField = (id: string, row: ReturnType<typeof rowOf>) =>
  HANDOVER_COLUMNS.find((column) => column.id === id)!.paper(row, ctx);

describe("Handover output audit repairs", () => {
  it("retains a source ward's outgoing movement even before a destination is asked", () => {
    const record = movement({ sourceAdmissionId: source.id });
    expect(
      movementInHandoverScope(
        record,
        { kind: "ward", id: source.unitId },
        state.units,
        state.referrals,
        state.admissions,
      ),
    ).toBe(true);
    expect(
      movementInHandoverScope(
        record,
        { kind: "ward", id: "unrelated-ward" },
        state.units,
        state.referrals,
        state.admissions,
      ),
    ).toBe(false);
    expect(
      urgentMovementsOutsideScope(
        [{ ...record, flaggedUrgent: true }],
        { kind: "ward", id: source.unitId },
        state.units,
        state.referrals,
        600,
        state.admissions,
      ),
    ).toEqual([]);
  });

  it("uses the linked sending ward as origin, retaining routing ED only in domain state", () => {
    const record = movement({ sourceAdmissionId: source.id });
    const row = rowOf(record);
    expect(row.edShort).toBe(sourceUnit.name);
    expect(row.edFull).toBe(sourceUnit.name);
    expect(record.originEdId).toBe(base.originEdId);
  });

  it("does not invent an ED origin when an explicit sending stay is unavailable", () => {
    expect(rowOf(movement({ sourceAdmissionId: "missing-stay" })).edFull).toBe("Sending ward not recorded");
  });

  it("preserves permitted accepted status without reconstructing the hidden ward", () => {
    const record = movement();
    const row = rowOf(record, {
      id: record.id,
      kind: "sender",
      visibleUntil: null,
      destinationStatus: "accepted",
      progress: "accepted",
      nextStep: "wait",
    });
    expect(destinationText(row)).toBe("Accepted, destination not available");
    expect(groupOf(row, 600, 700)).toBe("acc");
    expect(nextStep(row, 600, 700, () => 99).text).toBe("Accepted, await destination details");
    expect(isbarText(row, 600)).not.toContain("No ward asked yet");
    expect(row.to).toBeUndefined();
    expect(printField("route", row)).toContain("Accepted, destination not available");
  });

  it("keeps a moving journey in Moving when its permitted sender summary says accepted", () => {
    const record = movement({ stage: "moving" });
    const row = rowOf(record, {
      id: record.id,
      kind: "sender",
      visibleUntil: null,
      destinationStatus: "accepted",
      progress: "accepted",
      nextStep: "none",
    });
    expect(groupOf(row, 600, 700)).toBe("mov");
  });

  it("states unavailable destination status rather than asserting no request", () => {
    const row = rowOf(movement(), null);
    expect(destinationText(row)).toBe("Destination status not available");
    expect(nextStep(row, 600, 700, () => 0).text).toBe("Await destination status");
  });

  it.each(["current", "missing", "progressed", "ended"] as const)(
    "uses only a current form deadline in grouping, actions and print: %s",
    (kind) => {
      const record = movement({
        legalStatus: "Referred for psychiatric examination",
        legalForm: {
          code: "1A",
          kind: "examination",
          ...(kind === "missing" ? {} : { dueAt: 599 }),
          ...(kind === "ended" ? { endedBy: "revoked" } : {}),
        },
        ...(kind === "progressed" ? { examination: { at: 600, outcome: "inpatient_order" } } : {}),
      });
      const row = rowOf(record);
      // A1 (Josh, 13 Nov 2026): the examination alone ends nothing, so a progressed form's typed time
      // is still current; only a recorded end makes it history.
      const inForce = kind === "current" || kind === "progressed";
      expect(isDueBy(row, 600, 700)).toBe(inForce);
      expect(groupOf(row, 600, 700)).toBe(inForce ? "due" : "bed");
      expect(nextStep(row, 600, 700, () => 0).text.includes("time passed")).toBe(inForce);
      expect(Boolean(printField("due", row))).toBe(inForce);
      if (kind === "ended" || kind === "progressed") {
        expect(row.formDueAt).toBe(kind === "progressed" ? 599 : undefined);
        expect(record.legalForm!.dueAt).toBe(599);
        expect(isbarText(row, 600)).not.toContain("no due time typed");
      }
    },
  );

  it("shows recorded delivery and requests ward confirmation across status, next step and print", () => {
    const record = movement({
      stage: "moving",
      transport: { ...base.transport!, collectedAt: 550, arrivedAt: 590, cancelledAt: undefined },
    });
    const row = rowOf(record);
    expect(handoverStatusLabel(row)).toBe("Arrived at ward, awaiting ward confirmation");
    expect(situationState(row, 600)).toBe("Arrived at ward, awaiting ward confirmation");
    expect(nextStep(row, 600, 700, () => 0).text).toContain("Confirm ward arrival");
    expect(printField("st", row)).toContain("Arrived at ward");
  });

  it("keeps stopped transport distinct from live movement in print and recommendations", () => {
    const record = movement({
      stage: "moving",
      admissionId: "held-bed",
      transport: { ...base.transport!, collectedAt: 550, stoppedAt: 590, cancelledAt: 590, arrivedAt: undefined },
    });
    const row = rowOf(record);
    expect(handoverStatusLabel(row)).toBe("Transport stopped, release pulled bed");
    expect(printField("st", row)).toContain("Transport stopped");
    expect(nextStep(row, 600, 700, () => 0).text).toContain("Release the pulled bed");
  });
});
