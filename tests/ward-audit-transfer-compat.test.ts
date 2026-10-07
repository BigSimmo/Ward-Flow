import { expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { emptyCareJourney } from "@/components/ward-management/ward-care-journey";
import type { Movement } from "@/components/ward-management/ward-model";
it("allows a recorded ward-source referral to reserve a destination and depart its source on arrival", () => {
  let s = seedWardFlowState();
  const a = s.admissions.find((a) => a.state === "occupied" && a.patientId && a.unitId === "rph-adult-secure")!;
  const referral = {
    ...s.referrals[0],
    id: "RF-AUDIT-TRANSFER",
    patientId: a.patientId!,
    source: "psychiatric_ward" as const,
    originUnitId: a.unitId,
  };
  const m: Movement = {
    ...s.movements[0],
    id: "WF-AUDIT-TRANSFER",
    patientId: a.patientId!,
    referralId: referral.id,
    admissionId: undefined,
    closure: undefined,
    gender: a.gender,
    sex: a.sex,
    cohort: "Adult",
    security: "Open",
    legalStatus: "Voluntary",
    specialling: false,
    highAcuity: false,
    transport: undefined,
    stage: "accepted_awaiting_bed",
    acceptedUnitId: "scgh-adult-open",
    referredUnitIds: ["scgh-adult-open"],
  };
  s = { ...s, referrals: [...s.referrals, referral], movements: [...s.movements, m] };
  s = wardFlowReducer(s, { type: "PULL_PATIENT", role: "ward", now: 642, movementId: m.id, unitId: "scgh-adult-open" });
  expect(s.rejections).toEqual([]);
  expect(s.admissions.find((row) => row.id === a.id)?.state).toBe("occupied");
  s = wardFlowReducer(s, {
    type: "RECORD_TRANSPORT_NEED",
    role: "ward",
    now: 642,
    movementId: m.id,
    needed: false,
  });
  s = wardFlowReducer(s, {
    type: "PATIENT_ARRIVED",
    role: "ward",
    now: 642,
    movementId: m.id,
    actingUnitId: "scgh-adult-open",
  });
  expect(s.rejections).toEqual([]);
  expect(s.admissions.find((row) => row.id === a.id)?.state).toBe("departed");
  expect(s.admissions.filter((row) => row.patientId === a.patientId && row.state === "occupied")).toHaveLength(1);
});
it("accepts another transfer after restoring a legacy completed incoming transfer", () => {
  let s = seedWardFlowState();
  const a = s.admissions.find((a) => a.state === "occupied" && a.patientId)!;
  s = {
    ...s,
    admissions: s.admissions.map((row) =>
      row.id === a.id
        ? {
            ...row,
            careJourney: {
              ...emptyCareJourney(),
              transfer: {
                kind: "transfer",
                step: "arrived",
                receivingUnitId: row.unitId,
                recordedAt: 640,
                recordedBy: "coordinator",
              },
            },
          }
        : row,
    ),
  };
  s = wardFlowReducer(s, {
    type: "RECORD_ADMISSION_CARE",
    role: "coordinator",
    now: 642,
    admissionId: a.id,
    patientId: a.patientId!,
    expectedGeneration: s.worldGeneration,
    expectedRevision: 0,
    change: {
      kind: "transfer",
      step: "accepted",
      receivingUnitId: a.unitId === "scgh-adult-open" ? "rph-adult-secure" : "scgh-adult-open",
    },
  });
  expect(s.rejections).toEqual([]);
  expect(s.admissions.find((row) => row.id === a.id)?.careJourney?.transfer?.step).toBe("accepted");
});
