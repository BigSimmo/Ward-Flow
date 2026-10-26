import { describe, expect, it } from "vitest";
import {
  edJourneySummaries,
  edOpenSummaries,
  edWaitingSeries,
} from "@/components/ward-management/ed/ed-home-derivations";
import {
  edJourneyWaitBands,
  edJourneyWaitFigures,
  edWaitFigures,
} from "@/components/ward-management/statistics/statistics-ed-waits";
import { isWaitingInEd } from "@/components/ward-management/ward-ed-presence";
import { openEdJourneys, waitingInEds } from "@/components/ward-management/ward-shared-figures";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const seed = seedWardFlowState();
const base = seed.movements.find(isWaitingInEd)!;
const now = NOW_ANCHOR;
function specimen(id: Movement["id"], changes: Partial<Movement> = {}): Movement {
  return {
    ...base,
    id,
    openedAt: now - 120,
    sourceAdmissionId: undefined,
    stage: "placement_requested",
    closure: undefined,
    edOutcome: undefined,
    leftDepartmentAt: undefined,
    transport: undefined,
    stageChanges: [],
    ...changes,
  };
}

describe("open ED accountability and physical ED waits remain distinct", () => {
  it("retains every open ED-origin journey, including recorded ED outcomes, and conserves the physical split", () => {
    const movements = [
      specimen("WF-here"),
      specimen("WF-moving", { stage: "moving" }),
      specimen("WF-left", { leftDepartmentAt: now - 5 }),
      specimen("WF-collected", {
        stage: "pulled",
        transport: {
          id: "TR-synthetic",
          provider: "Patient transport service",
          escortRequired: false,
          collectedAt: now - 5,
        },
      }),
      specimen("WF-stage-history", { stageChanges: [{ at: now - 5, to: "moving", by: "Synthetic coordinator" }] }),
      specimen("WF-outcome", { edOutcome: "for_discharge" }),
      specimen("WF-outcome-left", { edOutcome: "for_community_follow_up", leftDepartmentAt: now - 5 }),
      specimen("WF-ward-origin", { sourceAdmissionId: "AD-synthetic" }),
      specimen("WF-community-origin", { originEdId: undefined, originCommunity: { siteCode: "SYNTHETIC-PLACE" } }),
      specimen("WF-arrived", { stage: "arrived" }),
      specimen("WF-closed", { closure: { outcome: "did_not_proceed", at: now - 5, reason: "Synthetic closure" } }),
    ];
    const journeys = openEdJourneys(movements, now);
    expect(journeys).toMatchObject({ total: 7, stillInEd: 2, inTransit: 5 });
    expect(journeys.stillInEd + journeys.inTransit).toBe(journeys.total);
    expect([...journeys.byService.values()].reduce((sum, value) => sum + value, 0)).toBe(journeys.total);
    expect(waitingInEds(movements, now).total).toBe(1);
    expect(edOpenSummaries(movements, now).find((row) => row.ed.id === base.originEdId)?.waiting).toBe(1);
    expect(edWaitFigures(movements, base.originEdId!, now).onTheList).toBe(1);
    const report = edJourneyWaitFigures(movements, base.originEdId!, now);
    expect(report.onTheList).toBe(journeys.total);
    expect(edJourneyWaitBands(movements, base.originEdId!, now).reduce((sum, band) => sum + band.count, 0)).toBe(
      journeys.total,
    );
    expect(
      edJourneySummaries(movements, now)
        .find((row) => row.ed.id === base.originEdId)
        ?.open.map((movement) => movement.id),
    ).toEqual(report.departmentMovements.map((movement) => movement.id));
  });

  it("keeps the physical trend's current point physical while journey accountability includes transit", () => {
    const movements = [specimen("WF-waiting"), specimen("WF-transit", { stage: "moving", leftDepartmentAt: now - 5 })];
    const physical = edWaitingSeries(movements, base.originEdId!, now);
    expect(physical.at(-1)).toBe(1);
    expect(openEdJourneys(movements, now)).toMatchObject({ total: 2, stillInEd: 1, inTransit: 1 });
    expect(waitingInEds(movements, now).total).toBe(physical.at(-1));
  });
});
