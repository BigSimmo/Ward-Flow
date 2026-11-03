// tests/ward-patient-care-journey.test.ts
// PT1 round 3 (Josh, 3 Nov 2026): the patient's journey in plain steps, from the record only.
import { describe, expect, it } from "vitest";

import { patientCareJourney } from "@/components/ward-management/patients/patient-care-journey";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Movement } from "@/components/ward-management/ward-model";

const day = (at: number) => `day-${at}`;
const states = (steps: ReturnType<typeof patientCareJourney>) => steps.map((step) => `${step.id}:${step.state}`);

function movement(overrides: Partial<Movement>): Movement {
  return { id: "ZZ-SYNTH-1", openedAt: 100, stage: "placement_requested", ...overrides } as Movement;
}

function stay(overrides: Partial<Admission> = {}): Admission {
  return {
    id: "ZZ-STAY-1",
    arrivedAt: 200,
    expectedDischargeAt: null,
    dischargeConfirmedAt: null,
    leftAt: null,
    ...overrides,
  } as Admission;
}

describe("patient care journey", () => {
  it("lights In ED while a bed is still being found from an emergency department", () => {
    const steps = patientCareJourney({
      mode: "find",
      movement: movement({ originEdId: "ED-SYNTH" } as Partial<Movement>),
      stayCurrent: false,
      day,
    });
    expect(steps[0]).toMatchObject({ label: "In ED", state: "now", detail: "day-100" });
    expect(states(steps).slice(1)).toEqual([
      "bed:next",
      "moving:next",
      "ward:next",
      "discharge:next",
      "community:next",
    ]);
  });

  it("moves to Bed found once accepted, and Moving once handover is ready", () => {
    expect(
      patientCareJourney({ mode: "held", movement: movement({ stage: "pulled" }), stayCurrent: false, day })[1],
    ).toMatchObject({
      state: "now",
      detail: "Bed pulled",
    });
    expect(
      patientCareJourney({
        mode: "transit",
        movement: movement({ stage: "handover_ready" }),
        stayCurrent: false,
        day,
      })[2],
    ).toMatchObject({ state: "now", detail: "Handover ready" });
  });

  it("shows the ward day and the expected date as recorded, never a countdown", () => {
    const steps = patientCareJourney({
      mode: "ward",
      movement: movement({ stage: "arrived" }),
      stay: stay({ expectedDischargeAt: 900 }),
      stayCurrent: true,
      stayDay: 7,
      day,
    });
    expect(steps.find((step) => step.id === "ward")).toMatchObject({ state: "now", detail: "Day 7" });
    expect(steps.find((step) => step.id === "discharge")).toMatchObject({ state: "next", detail: "Expected day-900" });
  });

  it("leaves out the unknown path into the ward when no movement is on record", () => {
    const steps = patientCareJourney({ mode: "ward", stay: stay(), stayCurrent: true, stayDay: 3, day });
    expect(steps.map((step) => step.id)).toEqual(["ward", "discharge", "community"]);
  });

  it("puts community care now when an episode is active after discharge", () => {
    const steps = patientCareJourney({
      mode: "idle",
      stay: stay({ leftAt: 500 }),
      stayCurrent: false,
      communityTeam: "Synthetic Community Team",
      day,
    });
    expect(steps.find((step) => step.id === "community")).toMatchObject({
      state: "now",
      detail: "Synthetic Community Team",
    });
    expect(steps.find((step) => step.id === "discharge")).toMatchObject({ state: "done", detail: "Left day-500" });
  });

  it("marks every step to come when nothing on record places the patient", () => {
    const steps = patientCareJourney({ mode: "idle", stayCurrent: false, day });
    expect(steps.every((step) => step.state === "next")).toBe(true);
  });
});
