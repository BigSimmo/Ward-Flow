import { describe, expect, it } from "vitest";

import { patientJourneyStages } from "@/components/ward-management/patients/patient-journey";
import type { Movement } from "@/components/ward-management/ward-model";

const base = { openedAt: 100, declines: [], stageChanges: [] } as unknown as Movement;

describe("patientJourneyStages (v10 Patient Journey strip)", () => {
  it("sizes each stage by its recorded minutes and runs the open stage to now", () => {
    const stages = patientJourneyStages({ ...base, referredAt: 130, acceptedAt: 190 } as Movement, 400);
    expect(stages.map((stage) => [stage.id, stage.minutes])).toEqual([
      ["ed", 30],
      ["asked", 60],
      ["bed-wait", 210],
    ]);
    expect(stages.at(-1)).toMatchObject({ quiet: true, now: true });
  });

  it("hatches only the bed wait and folds unrecorded starts into the stage before", () => {
    const stages = patientJourneyStages({ ...base, acceptedAt: 160 } as Movement, 200);
    expect(stages.map((stage) => stage.label)).toEqual(["Finding a bed", "Bed wait"]);
    expect(stages[0]!.quiet).toBeUndefined();
    expect(stages[1]!.quiet).toBe(true);
  });

  it("says stage times are not recorded when only the opening time is", () => {
    expect(patientJourneyStages(base, 160)[0]).toMatchObject({
      minutes: 60,
      label: "Since opened · stage times not recorded",
      now: true,
    });
  });

  it("stops at arrival and marks nothing as now once arrived", () => {
    const movement = {
      ...base,
      acceptedAt: 160,
      transport: { collectedAt: 200, arrivedAt: 260 },
    } as unknown as Movement;
    const stages = patientJourneyStages(movement, 999);
    expect(stages.map((stage) => stage.minutes)).toEqual([60, 40, 60]);
    expect(stages.some((stage) => stage.now)).toBe(false);
  });
});
