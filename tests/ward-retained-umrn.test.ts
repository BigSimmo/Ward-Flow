import { describe, expect, it } from "vitest";

import { TYPED_TEXT_NOT_KEPT } from "@/components/ward-management/ward-flow-demo-storage-constants";
import {
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "@/components/ward-management/ward-flow-reducer";
import { buildScenarioFile, readScenarioFile } from "@/components/ward-management/ward-flow-scenario-file";
import {
  isValidStoredWardFlowState,
  WARD_FLOW_STORED_STATE_VERSION,
} from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR + 1;
const state = () => seedWardFlowStateAt(0);
const serialise = (world: WardFlowState) => JSON.parse(JSON.stringify({ ...world, rejections: [] }));

function scenario() {
  const built = buildScenarioFile(state(), NOW, WARD_FLOW_STORED_STATE_VERSION, new Date("2026-11-04T00:00:00Z"));
  if (!built.ok) throw new Error(built.reason);
  return JSON.parse(built.json);
}

function register(world: WardFlowState, umrn: string) {
  const registered = wardFlowReducer(world, {
    type: "ADD_PATIENT",
    role: "coordinator",
    now: NOW,
    umrn,
    givenName: "Synthetic",
    familyName: "Identity",
    dateOfBirth: "1980-01-01",
  });
  expect(registered.rejections).toEqual(world.rejections);
  return registered;
}

function archiveThenRegister(umrn: string) {
  const first = register(state(), "SYN-IDENTITY-001");
  const patient = first.patients.at(-1)!;
  const archived = wardFlowReducer(first, {
    type: "ARCHIVE_PATIENT",
    role: "coordinator",
    now: NOW,
    patientId: patient.id,
    reason: "test",
  });
  expect(archived.rejections).toEqual(first.rejections);
  expect(archived.patients.some((row) => row.id === patient.id)).toBe(false);
  return { patient, archived, registered: register(archived, umrn) };
}

describe("retained UMRN ownership at restore and inverse boundaries", () => {
  it.each(["exact", "case and surrounding spaces"])(
    "refuses a duplicate retained number through the real import parser: %s",
    (variant) => {
      const file = scenario();
      const [first, second] = file.state.patients;
      second.umrn = variant === "exact" ? first.umrn : `  ${first.umrn.toLowerCase()}  `;
      expect(readScenarioFile(JSON.stringify(file), WARD_FLOW_STORED_STATE_VERSION).ok).toBe(false);
      expect(isValidStoredWardFlowState(file.state)).toBe(false);
    },
  );

  it("round-trips an unchanged scenario through the real import parser", () => {
    const file = scenario();
    expect(readScenarioFile(JSON.stringify(file), WARD_FLOW_STORED_STATE_VERSION).ok).toBe(true);
  });

  it.each([TYPED_TEXT_NOT_KEPT, "UMRN not recorded", ""])(
    "allows repeated deliberate non-identifying values: %s",
    (placeholder) => {
      const file = scenario();
      file.state.patients[0].umrn = placeholder;
      file.state.patients[1].umrn = placeholder;
      expect(isValidStoredWardFlowState(file.state)).toBe(true);
      expect(readScenarioFile(JSON.stringify(file), WARD_FLOW_STORED_STATE_VERSION).ok).toBe(true);
    },
  );

  it.each(["SYN-IDENTITY-001", " syn-identity-001 "])(
    "refuses archive Undo atomically after the number gains a new owner: %s",
    (umrn) => {
      const { patient, registered } = archiveThenRegister(umrn);
      const undone = wardFlowReducer(registered, {
        type: "UNDO_PATIENT_RECORD",
        role: "coordinator",
        now: NOW + 1,
        patientId: patient.id,
      });
      expect(undone.rejections.length).toBe(registered.rejections.length + 1);
      expect(undone.patients).toEqual(registered.patients);
      expect(undone.undoRecords).toEqual(registered.undoRecords);
      expect(isValidStoredWardFlowState(serialise(undone))).toBe(true);
    },
  );

  it("allows immediate archive Undo", () => {
    const { patient, archived } = archiveThenRegister("SYN-OTHER-001");
    const undone = wardFlowReducer(archived, {
      type: "UNDO_PATIENT_RECORD",
      role: "coordinator",
      now: NOW + 1,
      patientId: patient.id,
    });
    expect(undone.rejections).toEqual(archived.rejections);
    expect(undone.patients).toContainEqual(patient);
  });

  it("allows the original archive Undo once the newer owner has also been archived", () => {
    const { patient, registered } = archiveThenRegister("SYN-IDENTITY-001");
    const newerOwner = registered.patients.at(-1)!;
    const released = wardFlowReducer(registered, {
      type: "ARCHIVE_PATIENT",
      role: "coordinator",
      now: NOW + 1,
      patientId: newerOwner.id,
      reason: "test",
    });
    expect(released.rejections).toEqual(registered.rejections);
    const undone = wardFlowReducer(released, {
      type: "UNDO_PATIENT_RECORD",
      role: "coordinator",
      now: NOW + 2,
      patientId: patient.id,
    });
    expect(undone.rejections).toEqual(released.rejections);
    expect(undone.patients).toContainEqual(patient);
    expect(undone.patients.some((row) => row.id === newerOwner.id)).toBe(false);
    expect(isValidStoredWardFlowState(serialise(undone))).toBe(true);
  });

  it("allows archive Undo after an unrelated registration", () => {
    const { patient, registered } = archiveThenRegister("SYN-OTHER-001");
    const undone = wardFlowReducer(registered, {
      type: "UNDO_PATIENT_RECORD",
      role: "coordinator",
      now: NOW + 1,
      patientId: patient.id,
    });
    expect(undone.rejections).toEqual(registered.rejections);
    expect(undone.patients).toContainEqual(patient);
    expect(undone.patients).toContainEqual(registered.patients.at(-1));
    expect(isValidStoredWardFlowState(serialise(undone))).toBe(true);
  });
});
