import { expect, it } from "vitest";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolvePatientNowRecord } from "@/components/ward-management/patients/patient-now-adapter";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { MOVEMENT_STAGES, type Movement } from "@/components/ward-management/ward-model";
it.each(["absent", "backpointer"] as const)("resolves an older current stay with a %s movement join", (join) => {
  const s = seedWardFlowState();
  const a = s.admissions.find((a) => a.state === "occupied" && a.patientId)!;
  const historical = {
    ...s.movements[0],
    id: "WF-AUDIT-OLD" as const,
    patientId: a.patientId!,
    referralId: undefined,
    admissionId: "old-stay",
    stage: "arrived" as const,
    acceptedUnitId: "scgh-adult-open",
    closure: { at: 600, outcome: "arrived" as const, reason: "Historical arrival" },
  };
  const current = { ...a, movementId: null, referralId: null };
  const old = {
    ...a,
    id: "old-stay",
    unitId: "scgh-adult-open",
    state: "departed" as const,
    leftAt: 600,
    movementId: historical.id,
  };
  const movements =
    join === "absent"
      ? [historical]
      : [
          historical,
          { ...historical, id: "WF-AUDIT-CURRENT" as const, admissionId: current.id, acceptedUnitId: current.unitId },
        ];
  const result = resolvePatientNowRecord(
    a.patientId!,
    s.patients,
    movements,
    s.referrals,
    [old, current],
    s.units,
    642,
  )!;
  expect(result.liveAdmission?.id).toBe(current.id);
  if (join === "absent") expect(result.liveMovement).toBeUndefined();
  else expect(result.liveMovement?.admissionId).toBe(current.id);
  expect(result.record.verdict.title).toContain(s.units.find((u) => u.id === current.unitId)!.name);
});

it.each(["closed arrival", "no direct join", "newer closed return", "newer arrived return"] as const)(
  "resolves an open repatriation from the occupied sending stay despite %s",
  (history) => {
    const s = seedWardFlowState();
    const occupied = s.admissions.find((a) => a.state === "occupied" && a.patientId)!;
    const source: Admission = { ...occupied, movementId: null, referralId: null };
    const arrival = {
      ...s.movements[0],
      id: "WF-AUDIT-SOURCE-ARRIVAL" as const,
      patientId: source.patientId!,
      referralId: undefined,
      admissionId: source.id,
      sourceAdmissionId: undefined,
      acceptedUnitId: source.unitId,
      stage: "arrived" as const,
      closure: { at: 600, outcome: "arrived" as const, reason: "Sending stay arrival" },
    };
    if (history !== "no direct join") source.movementId = arrival.id;
    const returning = {
      ...arrival,
      id: "WF-AUDIT-LIVE-RETURN" as const,
      admissionId: undefined,
      sourceAdmissionId: source.id,
      acceptedUnitId: undefined,
      stage: "placement_requested" as const,
      closure: undefined,
    };
    const movements: Movement[] = history === "no direct join" ? [returning] : [arrival, returning];
    if (history === "newer closed return" || history === "newer arrived return") {
      movements.push({
        ...returning,
        id: "WF-AUDIT-OLD-RETURN",
        stage: history === "newer arrived return" ? "arrived" : "placement_requested",
        closure: history === "newer closed return" ? arrival.closure : undefined,
      });
    }
    // A newer open movement for this patient belongs to a different stay.
    movements.push({ ...returning, id: "WF-AUDIT-OTHER-STAY", sourceAdmissionId: "other-stay" });
    const result = resolvePatientNowRecord(
      source.patientId!,
      s.patients,
      movements,
      s.referrals,
      [source],
      s.units,
      642,
    )!;
    expect(result.liveAdmission).toBe(source);
    expect(result.liveMovement).toBe(returning);
    expect(result.livePatient).toBe(s.patients.find((patient) => patient.id === source.patientId));
    expect(result.currentStageIndex).toBe(MOVEMENT_STAGES.indexOf("placement_requested"));
  },
);

it("retains the completed return linked to the occupied destination stay", () => {
  const s = seedWardFlowState();
  const occupied = s.admissions.find((a) => a.state === "occupied" && a.patientId)!;
  const source = { ...occupied, id: "sending-stay", state: "departed" as const, leftAt: 630 };
  const destination: Admission = {
    ...occupied,
    id: "destination-stay",
    movementId: "WF-AUDIT-COMPLETED-RETURN",
    referralId: null,
  };
  const completed = {
    ...s.movements[0],
    id: "WF-AUDIT-COMPLETED-RETURN" as const,
    patientId: occupied.patientId!,
    referralId: undefined,
    sourceAdmissionId: source.id,
    admissionId: destination.id,
    acceptedUnitId: destination.unitId,
    stage: "arrived" as const,
    closure: { at: 630, outcome: "arrived" as const, reason: "Return completed" },
  };
  const result = resolvePatientNowRecord(
    occupied.patientId!,
    s.patients,
    [completed],
    s.referrals,
    [source, destination],
    s.units,
    642,
  )!;
  expect(result.liveAdmission).toBe(destination);
  expect(result.liveMovement).toBe(completed);
  expect(result.record.verdict.short).toBe("Arrived");
});
