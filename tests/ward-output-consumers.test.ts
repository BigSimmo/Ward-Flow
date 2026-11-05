import { describe, expect, it } from "vitest";
import { downtimePack } from "@/components/ward-management/reports/downtime-pack";
import { wardTvSheet } from "@/components/ward-management/bed-meeting/tv-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Movement } from "@/components/ward-management/ward-model";

function fixture() {
  const state = seedWardFlowState();
  const transport = state.movements.find((item) => item.transport)?.transport;
  if (!transport) throw new Error("Synthetic transport fixture missing");
  const movement: Movement = {
    ...state.movements[0],
    id: "WF-999",
    stage: "moving",
    closure: undefined,
    acceptedUnitId: state.units[0].id,
    sourceAdmissionId: undefined,
    transport: {
      ...transport,
      collectedAt: NOW_ANCHOR - 60,
      arrivedAt: undefined,
      stoppedAt: undefined,
      cancelledAt: undefined,
    },
  };
  const input = { ...state, movements: [movement], now: NOW_ANCHOR, nameOf: () => "Synthetic person" };
  return { state, movement, input };
}

function packFor(input: ReturnType<typeof fixture>["input"]) {
  return downtimePack({ ...input, bedUnits: input.units, identify: input.nameOf });
}

describe("output audit field consumers", () => {
  it("names the explicit sending stay rather than its routing ED", () => {
    const { input, movement } = fixture();
    const source = input.admissions[0];
    movement.sourceAdmissionId = source.id;
    expect(packFor(input).pendingMoves[0].from).toBe(input.units.find((unit) => unit.id === source.unitId)!.name);
  });

  it("does not substitute the routing ED when the explicit sending stay is unavailable", () => {
    const { input, movement } = fixture();
    movement.sourceAdmissionId = "unavailable-source";
    expect(packFor(input).pendingMoves[0].from).toBe("Sending ward not recorded");
  });

  it("says delivered at ward in downtime and TV before ward confirmation", () => {
    const { input, movement } = fixture();
    movement.transport!.arrivedAt = NOW_ANCHOR - 5;
    expect(packFor(input).pendingMoves[0].stage).toBe("Arrived at ward, awaiting ward confirmation");
    const tv = wardTvSheet({ ...input, unit: input.units[0], thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
    expect(tv.coming.rows[0].stage).toBe("Arrived at ward, awaiting ward confirmation");
    expect(tv.incoming.onTheWay).toBe(0);
  });

  it("says stopped rather than moving or in transit while a pulled bed needs release", () => {
    const { input, movement } = fixture();
    movement.admissionId = "held-bed";
    movement.transport!.stoppedAt = NOW_ANCHOR - 5;
    movement.transport!.cancelledAt = NOW_ANCHOR - 5;
    expect(packFor(input).pendingMoves[0].stage).toBe("Transport stopped, release pulled bed");
    const tv = wardTvSheet({ ...input, unit: input.units[0], thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
    expect(tv.coming.rows[0].stage).toBe("Transport stopped, release pulled bed");
    expect(tv.incoming.onTheWay).toBe(0);
  });

  it("keeps a collected live journey in transit and missing planned time unknown", () => {
    const { input, movement } = fixture();
    movement.plannedMoveAt = undefined;
    expect(packFor(input).pendingMoves[0].plannedAt).toBeNull();
    const tv = wardTvSheet({ ...input, unit: input.units[0], thresholds: DEFAULT_DUE_SOON_THRESHOLDS });
    expect(tv.coming.rows[0].stage).toMatch(/^In transit /);
  });
});
