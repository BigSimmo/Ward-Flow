import { describe, expect, it } from "vitest";
import {
  notWaitingParts,
  waitingSplit,
  waitingInEds,
  openEdJourneys,
} from "@/components/ward-management/ward-shared-figures";
import { downtimePack, leftEdNote } from "@/components/ward-management/reports/downtime-pack";
import { edJourneySummaries } from "@/components/ward-management/ed/ed-home-derivations";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const state = seedWardFlowState();
const base = state.movements.find(isWaitingInEd)!;
function specimen(id: Movement["id"], changes: Partial<Movement> = {}): Movement {
  return {
    ...base,
    id,
    stage: "placement_requested",
    sourceAdmissionId: undefined,
    closure: undefined,
    edOutcome: undefined,
    leftDepartmentAt: undefined,
    transport: undefined,
    stageChanges: [],
    ...changes,
  };
}
function pack(movements: Movement[]) {
  return downtimePack({
    ...state,
    bedUnits: state.units,
    movements,
    now: NOW_ANCHOR,
    identify: () => "Synthetic person",
  });
}

describe("downtime and ED statistics use the same journey population", () => {
  it("partitions ED origins by physical presence, retaining outcomes and excluding other origins", () => {
    const movements = [
      specimen("WF-here"),
      specimen("WF-outcome", { edOutcome: "for_discharge" }),
      specimen("WF-community", { originEdId: undefined, originCommunity: { siteCode: "SYNTHETIC" } }),
      specimen("WF-transfer", { sourceAdmissionId: "AD-synthetic" }),
      specimen("WF-left", { leftDepartmentAt: NOW_ANCHOR - 5 }),
      specimen("WF-moving", { stage: "moving" }),
      specimen("WF-collected", {
        stage: "pulled",
        transport: {
          id: "TR-synthetic",
          provider: "Patient transport service",
          escortRequired: false,
          collectedAt: NOW_ANCHOR - 5,
        },
      }),
      specimen("WF-reversed", {
        stage: "pulled",
        stageChanges: [
          { at: NOW_ANCHOR - 5, to: "moving", by: "Synthetic coordinator" },
          { at: NOW_ANCHOR - 2, to: "pulled", by: "Synthetic coordinator" },
        ],
      }),
      specimen("WF-closed", {
        closure: { outcome: "did_not_proceed", at: NOW_ANCHOR - 1, reason: "Synthetic closure" },
      }),
    ];
    const frozen = pack(movements);
    expect(frozen.edQueue.map((row) => row.movementId).sort()).toEqual(["WF-here", "WF-outcome"]);
    expect(frozen.leftEd).toBe(4);
    const journeys = edJourneySummaries(movements, NOW_ANCHOR);
    expect(frozen.edQueue.length).toBe(journeys.reduce((sum, row) => sum + row.stillInEd, 0));
    expect(frozen.leftEd).toBe(journeys.reduce((sum, row) => sum + row.inTransit, 0));
    expect(frozen.edQueue.length + frozen.leftEd).toBe(journeys.flatMap((row) => row.open).length);
  });

  it("recomputes late departure history and removals without changing an already frozen pack", () => {
    const before = specimen("WF-late");
    const frozen = pack([before]);
    const corrected = specimen("WF-late", {
      stageChanges: [
        { at: NOW_ANCHOR - 1, to: "pulled", by: "Synthetic coordinator" },
        { at: NOW_ANCHOR - 5, to: "moving", by: "Synthetic coordinator" },
      ],
    });
    expect(pack([corrected]).edQueue).toHaveLength(0);
    expect(pack([corrected]).leftEd).toBe(1);
    expect(pack([]).leftEd).toBe(0);
    expect(frozen.edQueue.map((row) => row.movementId)).toEqual([before.id]);
    expect(frozen.leftEd).toBe(0);
  });
});

describe("journey semantics across summaries", () => {
  it("keeps community origins separate from transfers without losing list entries", () => {
    const split = waitingSplit([
      specimen("WF-waiting"),
      specimen("WF-transfer", { sourceAdmissionId: "AD-synthetic" }),
      specimen("WF-community", { originEdId: undefined, originCommunity: { siteCode: "SYNTHETIC" } }),
    ]);
    expect(split.waiting).toBe(1);
    expect(split.notWaiting.ward_transfer).toBe(1);
    expect(split.notWaiting.community_origin).toBe(1);
    expect(notWaitingParts(split)).toEqual(["1 moving between wards", "1 from community"]);
    expect(split.waiting + Object.values(split.notWaiting).reduce((sum, count) => sum + count, 0)).toBe(split.listed);
  });

  it("retains open journey accountability while physical waiting excludes transit and outcomes", () => {
    const movements = Array.from({ length: 30 }, (_, index) =>
      specimen(
        `WF-count-${index}`,
        index < 10 ? {} : index < 20 ? { leftDepartmentAt: NOW_ANCHOR - 5 } : { edOutcome: "for_discharge" },
      ),
    );
    expect(waitingInEds(movements, NOW_ANCHOR).total).toBe(10);
    expect(openEdJourneys(movements, NOW_ANCHOR)).toMatchObject({ total: 30, stillInEd: 20, inTransit: 10 });
    expect(pack(movements).edQueue).toHaveLength(20);
    expect(pack(movements).leftEd).toBe(10);
  });
});

describe("downtime left-ED note", () => {
  it("agrees in number with the count and is absent at zero", () => {
    expect(leftEdNote(0)).toBeNull();
    expect(leftEdNote(1)).toBe("1 more open ED journey is in transit or has a recorded departure.");
    expect(leftEdNote(3)).toBe("3 more open ED journeys are in transit or have a recorded departure.");
  });
});
