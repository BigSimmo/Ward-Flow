import { describe, expect, it } from "vitest";

import { seedWardFlowStateAt, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  admissionSupportNotificationSubject,
  supportNotificationChecklist,
} from "@/components/ward-management/ward-support-notifications";

describe("discharge support notification reducer and subject derivation", () => {
  it("identifies an involuntary departed admission as eligible for discharge support notifications", () => {
    const state = seedWardFlowStateAt(NOW_ANCHOR);
    const departedInvoluntary = state.admissions.find((admission) => admission.id === "AD-LEFT-01");
    expect(departedInvoluntary).toBeDefined();

    const subject = admissionSupportNotificationSubject(departedInvoluntary!, {
      movements: state.movements,
      admissions: state.admissions,
      patients: state.patients,
      referrals: state.referrals,
    });
    expect(subject).toMatchObject({
      occasion: "discharge",
      subjectId: "AD-LEFT-01",
      admissionId: "AD-LEFT-01",
    });
  });

  it("records carer, personal support person and MHAS discharge notifications via RECORD_SUPPORT_NOTIFICATION", () => {
    let state = seedWardFlowStateAt(NOW_ANCHOR);

    state = wardFlowReducer(state, {
      type: "RECORD_SUPPORT_NOTIFICATION",
      role: "coordinator",
      now: NOW_ANCHOR,
      occasion: "discharge",
      admissionId: "AD-LEFT-01",
      party: "carer",
      outcome: "told",
      who: "Synthetic carer",
      contactedAt: NOW_ANCHOR - 15,
    });

    state = wardFlowReducer(state, {
      type: "RECORD_SUPPORT_NOTIFICATION",
      role: "ward",
      now: NOW_ANCHOR,
      occasion: "discharge",
      admissionId: "AD-LEFT-01",
      party: "personal_support_person",
      outcome: "told",
      who: "Synthetic PSP",
      contactedAt: NOW_ANCHOR - 10,
    });

    state = wardFlowReducer(state, {
      type: "RECORD_SUPPORT_NOTIFICATION",
      role: "coordinator",
      now: NOW_ANCHOR,
      occasion: "discharge",
      admissionId: "AD-LEFT-01",
      party: "mhas",
      outcome: "not_applicable",
      reason: "Synthetic advocacy note",
    });

    const checklist = supportNotificationChecklist(state.supportNotifications, "discharge", "AD-LEFT-01");
    expect(checklist.carer?.outcome).toBe("told");
    expect(checklist.carer?.who).toBe("Synthetic carer");
    expect(checklist.personal_support_person?.outcome).toBe("told");
    expect(checklist.personal_support_person?.who).toBe("Synthetic PSP");
    expect(checklist.mhas?.outcome).toBe("not_applicable");
    expect(checklist.mhas?.reason).toBe("Synthetic advocacy note");
  });
});
