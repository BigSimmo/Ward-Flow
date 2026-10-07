import { expect, it } from "vitest";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolvePatientNowRecord } from "@/components/ward-management/patients/patient-now-adapter";
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
