import { describe, expect, it } from "vitest";

import { criteriaEligibility } from "../src/components/ward-management/ward-discharge-criteria";
import {
  admissionCriteriaEligibility,
  admissionLegalStatus,
  patientRecordIsInvoluntary,
  seedWardFlowState,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import {
  classifyLegalStatus,
  legalStatusIsDetained,
  legalStatusIsOnOrder,
  type LegalStatusClass,
} from "../src/components/ward-management/ward-legal-status";
import type { LegalStatus } from "../src/components/ward-management/ward-model";
import { isOnOrder } from "../src/components/ward-management/ward-stay-legal";
import { legalStatusTextIsInvoluntary } from "../src/components/ward-management/ward-support-notifications";

/** Review 18 Oct 2026, item 4: one reading of a legal status, checked against every class. */

const EVERY_MOVEMENT_STATUS: Record<LegalStatus, LegalStatusClass> = {
  Voluntary: "voluntary",
  "Referred for psychiatric examination": "referred",
  "Detained awaiting examination": "detained",
  "Involuntary inpatient": "detained",
};

const FREE_TEXT: ReadonlyArray<[string | undefined, LegalStatusClass]> = [
  [undefined, "not_recorded"],
  ["", "not_recorded"],
  ["   ", "not_recorded"],
  ["Voluntary", "voluntary"],
  ["voluntary patient", "voluntary"],
  ["Referred for psychiatric examination", "referred"],
  ["referred for psychiatric examination (Form 1A)", "referred"],
  ["Detained awaiting examination", "detained"],
  ["Involuntary inpatient", "detained"],
  ["Involuntary, Form 6A", "detained"],
  ["Community treatment order, Form 5A", "cto"],
  ["On a community treatment order", "cto"],
  ["Informal", "unrecognised"],
  ["Detained under another Act", "unrecognised"],
];

describe("classifyLegalStatus", () => {
  it("classifies every movement status in the closed vocabulary", () => {
    for (const [status, expected] of Object.entries(EVERY_MOVEMENT_STATUS)) {
      expect(classifyLegalStatus(status as LegalStatus), status).toBe(expected);
    }
  });

  it("classifies free-text patient record statuses, and never guesses unknown text into a class", () => {
    for (const [status, expected] of FREE_TEXT) expect(classifyLegalStatus(status), String(status)).toBe(expected);
  });

  it("counts as detained only detained or involuntary text, never a referral or unknown text", () => {
    for (const [status, kind] of FREE_TEXT) {
      expect(legalStatusIsDetained(status), String(status)).toBe(kind === "detained");
      expect(patientRecordIsInvoluntary(status), String(status)).toBe(kind === "detained");
      expect(legalStatusTextIsInvoluntary(status), String(status)).toBe(kind === "detained");
    }
  });

  it("counts every recorded status that is not voluntary as on an order, unknown text included", () => {
    for (const [status, kind] of FREE_TEXT) {
      const expected = kind !== "voluntary" && kind !== "not_recorded";
      expect(legalStatusIsOnOrder(status), String(status)).toBe(expected);
      expect(isOnOrder(status), String(status)).toBe(expected);
    }
  });
});

describe("criteria led discharge reads the same classes", () => {
  it("excludes a patient record on a referral for examination as involuntary, not as not recorded", () => {
    expect(criteriaEligibility("Referred for psychiatric examination", undefined)).toBe("involuntary");
  });

  it("gives each record class its reason when the movement records nothing", () => {
    const expected: Record<LegalStatusClass, string> = {
      voluntary: "voluntary",
      referred: "involuntary",
      detained: "involuntary",
      cto: "cto",
      not_recorded: "not_recorded",
      unrecognised: "not_recorded",
    };
    for (const [status, kind] of FREE_TEXT) {
      expect(criteriaEligibility(status, undefined), String(status)).toBe(expected[kind]);
    }
  });

  it("treats any movement status other than Voluntary as involuntary", () => {
    for (const status of Object.keys(EVERY_MOVEMENT_STATUS) as LegalStatus[]) {
      expect(criteriaEligibility(undefined, status), status).toBe(status === "Voluntary" ? "voluntary" : "involuntary");
    }
  });

  it("lets a community treatment order in force outrank everything", () => {
    expect(criteriaEligibility("Voluntary", "Voluntary", true)).toBe("cto");
  });
});

describe("the Legal tile agrees with criteria led discharge", () => {
  it("shows a patient record on a referral for examination, not the movement's Voluntary", () => {
    const seeded = seedWardFlowState();
    const admission = seeded.admissions.find((a) => a.state === "occupied" && a.patientId);
    if (!admission) throw new Error("no occupied stay with a patient in the seed");
    const state: WardFlowState = {
      ...seeded,
      patients: seeded.patients.map((patient) =>
        patient.id === admission.patientId
          ? { ...patient, legalStatus: "Referred for psychiatric examination", communityTreatmentOrder: undefined }
          : patient,
      ),
    };
    expect(admissionCriteriaEligibility(state, admission)).toBe("involuntary");
    expect(admissionLegalStatus(state, admission)).toBe("Referred for psychiatric examination");
  });
});
