// Production audit 24 Oct 2026: ADD_PATIENT input checks (ENG-02) and same-version scenario files
// with pre-21-Oct observation rows (ENG-03). Synthetic data only.
import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { buildScenarioFile, readScenarioFile } from "@/components/ward-management/ward-flow-scenario-file";
import { WARD_FLOW_STORED_STATE_VERSION } from "@/components/ward-management/ward-flow-storage-validation";
import { dateOfBirthProblem } from "@/components/ward-management/ward-patient-registration-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

type AddPatient = Extract<WardFlowEvent, { type: "ADD_PATIENT" }>;

function add(state: WardFlowState, overrides: Partial<AddPatient> = {}): WardFlowState {
  return wardFlowReducer(state, {
    type: "ADD_PATIENT",
    role: "coordinator",
    now: NOW_ANCHOR,
    umrn: "SYN-PA-001",
    givenName: "Demo",
    familyName: "Person",
    dateOfBirth: "1980-01-01",
    ...overrides,
  });
}

describe("ADD_PATIENT refuses a person with no identity (ENG-02)", () => {
  it.each([
    { umrn: "" },
    { umrn: "   " },
    { givenName: " " },
    { familyName: "" },
    { dateOfBirth: "2099-02-31" },
    { dateOfBirth: "2023-02-29" },
    { dateOfBirth: "not-a-date" },
    { dateOfBirth: "2999-01-01" },
  ])("refuses %j and stores nothing", (overrides) => {
    const seed = seedWardFlowState();
    const next = add(seed, overrides);
    expect(next.patients).toHaveLength(seed.patients.length);
    expect(next.rejections).toHaveLength(1);
    // The refusal never quotes the caller's own text.
    for (const value of Object.values(overrides)) {
      if (value.trim() !== "") expect(next.rejections[0]?.reason).not.toContain(value);
    }
  });

  it("stores the trimmed record number and names", () => {
    const seed = seedWardFlowState();
    const next = add(seed, { umrn: "  SYN-PA-002 ", givenName: " Demo ", familyName: " Person " });
    expect(next.rejections).toHaveLength(0);
    const patient = next.patients.at(-1);
    expect(patient).toMatchObject({ umrn: "SYN-PA-002", givenName: "Demo", familyName: "Person" });
  });

  it("checks the date against the Perth calendar day", () => {
    // 20:00 UTC on 24 Oct is 04:00 on 25 Oct in Perth.
    const today = new Date("2026-10-24T20:00:00Z");
    expect(dateOfBirthProblem("2026-10-25", today)).toBeUndefined();
    expect(dateOfBirthProblem("2026-10-26", today)).toBe("ADD_PATIENT date of birth is in the future");
    expect(dateOfBirthProblem("2024-02-29", today)).toBeUndefined();
    expect(dateOfBirthProblem("1899-12-31", today)).toBe("ADD_PATIENT date of birth is before 1900");
  });
});

describe("a same-version scenario file with old observation rows (ENG-03)", () => {
  it("loads through the same upgrade as a browser restore", () => {
    const built = buildScenarioFile(
      seedWardFlowState(),
      NOW_ANCHOR,
      WARD_FLOW_STORED_STATE_VERSION,
      new Date("2026-10-20T02:00:00Z"),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const payload = JSON.parse(built.json);
    const movement = payload.state.movements.find((row: Record<string, unknown>) => "observation" in row);
    expect(movement).toBeDefined();
    delete movement.observation;
    movement.specialling = true;
    const read = readScenarioFile(JSON.stringify(payload), WARD_FLOW_STORED_STATE_VERSION);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const loaded = read.state.movements.find((row) => row.id === movement.id) as unknown as Record<string, unknown>;
    expect(loaded.specialling).toBeUndefined();
    expect(loaded.observation).toBeDefined();
  });
});
