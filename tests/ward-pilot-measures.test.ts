import { describe, expect, it } from "vitest";

import { per100, pilotMeasures, summariseDurations } from "@/components/ward-management/reports/pilot-measures";
import type { ReportWeek } from "@/components/ward-management/reports/weekly-report";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";

const DAY = 24 * 60;
const WEEK: ReportWeek = { offset: 0, start: 0, end: 7 * DAY, countedEnd: 7 * DAY };
const NOW = 8 * DAY;

function fixture() {
  const state = seedWardFlowState();
  const base = state.movements[0]!;
  const movement = (id: string, patch: Partial<Movement>): Movement => ({
    ...base,
    id: id as Movement["id"],
    patientId: undefined,
    referralId: undefined,
    stage: "placement_requested",
    stageChanges: [],
    declines: [],
    overrides: [],
    unwinds: [],
    referredUnitIds: [],
    waitlistedUnitIds: undefined,
    acceptedUnitId: undefined,
    heldBedNumber: undefined,
    referredAt: undefined,
    acceptedAt: undefined,
    pullExpiresAt: undefined,
    leftDepartmentAt: undefined,
    transport: undefined,
    closure: undefined,
    ...patch,
  });
  const run = (movements: Movement[]) =>
    pilotMeasures({ movements, referrals: [], patients: state.patients, now: NOW }, WEEK);
  return { state, movement, run };
}

/** A journey that went the whole way: raised, asked, accepted, held, left, arrived. */
function fullJourney(f: ReturnType<typeof fixture>, id: string, start: number, heldAfter: number): Movement {
  return f.movement(id, {
    openedAt: start,
    referredAt: start + 30,
    acceptedAt: start + 90,
    stage: "arrived",
    stageChanges: [
      { at: start + heldAfter, to: "pulled", by: "ward" },
      { at: start + heldAfter + 60, to: "moving", by: "officer" },
      { at: start + heldAfter + 120, to: "arrived", by: "ward" },
    ],
  });
}

describe("summariseDurations", () => {
  it("publishes no typical time below the sample floor, but keeps the sample", () => {
    expect(summariseDurations([10, 20, 30], 7)).toEqual({
      median: undefined,
      p90: undefined,
      sampleSize: 3,
      population: 7,
    });
  });

  it("gives the median and the nearest-rank 90th percentile at the floor and above", () => {
    expect(summariseDurations([50, 10, 40, 20, 30], 5)).toEqual({ median: 30, p90: 50, sampleSize: 5, population: 5 });
    const ten = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(summariseDurations(ten, 10)).toMatchObject({ median: 6, p90: 9 });
  });
});

describe("pilotMeasures", () => {
  it("times request to bed held for beds first held in the week", () => {
    const f = fixture();
    const journeys = [100, 200, 300, 400, 500].map((heldAfter, index) =>
      fullJourney(f, `MV-${index}`, DAY + index * 600, heldAfter),
    );
    const measures = f.run(journeys);
    expect(measures.requestToBedHeld).toMatchObject({ median: 300, p90: 500, sampleSize: 5, population: 5 });
    expect(measures.steps.find((step) => step.id === "ask")?.summary).toMatchObject({ median: 30, sampleSize: 5 });
    expect(measures.steps.find((step) => step.id === "travel")?.summary).toMatchObject({ median: 60 });
    expect(measures.completeness).toEqual({ arrivals: 5, complete: 5 });
  });

  it("leaves out a hold made before the week, and says a thin sample is thin", () => {
    const f = fixture();
    const measures = f.run([fullJourney(f, "MV-early", -DAY, 60), fullJourney(f, "MV-in", DAY, 60)]);
    expect(measures.requestToBedHeld).toEqual({ median: undefined, p90: undefined, sampleSize: 1, population: 1 });
  });

  it("counts a request with no ward asked inside the window, but not one whose window is still open", () => {
    const f = fixture();
    const window = CLINICAL_VALUES.missedRequestWindow.value;
    const measures = f.run([
      f.movement("MV-asked", { openedAt: DAY, referredAt: DAY + window - 1 }),
      f.movement("MV-late", { openedAt: DAY, referredAt: DAY + window + 1 }),
      f.movement("MV-never", { openedAt: DAY }),
      f.movement("MV-too-soon", { openedAt: WEEK.countedEnd - 10 }),
    ]);
    expect(measures.requests).toMatchObject({ raised: 4, noWardAsked: 2, windowMinutes: window });
  });

  it("counts a second open request for the same recorded person, and not a later one after the first closed", () => {
    const f = fixture();
    const personId = f.state.patients[0]!.id;
    const measures = f.run([
      f.movement("MV-first", { openedAt: DAY, patientId: personId }),
      f.movement("MV-second", { openedAt: DAY + 60, patientId: personId }),
      f.movement("MV-other", { openedAt: DAY + 60, patientId: f.state.patients[1]!.id }),
    ]);
    expect(measures.requests.duplicates).toBe(1);

    const closed = f.run([
      f.movement("MV-first", {
        openedAt: DAY,
        patientId: personId,
        closure: { at: DAY + 30, outcome: "did_not_proceed", reason: "no_longer_required" } as Movement["closure"],
      }),
      f.movement("MV-second", { openedAt: DAY + 60, patientId: personId }),
    ]);
    expect(closed.requests.duplicates).toBe(0);
  });

  it("counts holds that ran out before the person left, and holds given back", () => {
    const f = fixture();
    const held = (id: string, expiresAfter: number, leftAfter: number | undefined) =>
      f.movement(id, {
        openedAt: DAY,
        pullExpiresAt: DAY + 100 + expiresAfter,
        stageChanges: [
          { at: DAY + 100, to: "pulled", by: "ward" },
          ...(leftAfter === undefined ? [] : [{ at: DAY + 100 + leftAfter, to: "moving" as const, by: "officer" }]),
        ],
      });
    const givenBack = f.movement("MV-back", {
      openedAt: DAY,
      unwinds: [{ at: DAY + 200, kind: "pull_released", by: "coordinator", reason: "patient_no_longer_coming" }],
    });
    const measures = f.run([
      held("MV-ok", 240, 60),
      held("MV-late", 240, 300),
      held("MV-waiting", 240, undefined),
      givenBack,
    ]);
    expect(measures.holds).toEqual({ held: 3, ranOut: 2, givenBack: 1 });
  });

  it("measures transport lateness against the estimate and counts cancellations", () => {
    const f = fixture();
    const grace = CLINICAL_VALUES.lateArrivalGrace.value;
    const job = (patch: Partial<NonNullable<Movement["transport"]>>) =>
      ({ id: "TJ", provider: "St John Ambulance", escortRequired: false, ...patch }) as NonNullable<
        Movement["transport"]
      >;
    const measures = f.run([
      f.movement("MV-on-time", {
        openedAt: DAY,
        transport: job({ estimatedAt: DAY + 60, collectedAt: DAY + 60 + grace }),
      }),
      f.movement("MV-late", {
        openedAt: DAY,
        transport: job({ estimatedAt: DAY + 60, collectedAt: DAY + 61 + grace }),
      }),
      f.movement("MV-cancelled", { openedAt: DAY, transport: job({ cancelledAt: DAY + 30 }) }),
    ]);
    expect(measures.transport).toMatchObject({ collections: 2, lateCollections: 1, cancelled: 1 });
  });

  it("gives a rate per 100 only with something to divide by", () => {
    expect(per100(1, 3)).toBe(33);
    expect(per100(0, 0)).toBeUndefined();
  });
});
