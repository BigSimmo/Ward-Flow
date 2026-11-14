import { describe, expect, it } from "vitest";

import { edClinicalRows } from "@/components/ward-management/bed-meeting/tv-clinical-derivations";
import {
  legalFormBreakdown,
  legalFormGroupRows,
  legalFormOrdered,
} from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { nextStep } from "@/components/ward-management/legal-forms/legal-forms-next-step";
import { attentionItems } from "@/components/ward-management/movements/movement-workspace-derivations";
import { endedFormWords, recordedPullDetails } from "@/components/ward-management/referrals/accepted-ward-referral";
import { admittedLegalInboxItems } from "@/components/ward-management/ward-act-now-items";
import { DEFAULT_DUE_SOON_THRESHOLDS, perthMidnight } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { admittedLegalExpiryPassed } from "@/components/ward-management/ward-legal-admitted";
import {
  currentLegalStanding,
  FORM_RECORDED_ENDED,
  legalFormNowWords,
} from "@/components/ward-management/ward-legal-form-progression";
import { formTimeAsTyped } from "@/components/ward-management/ward-legal-time-as-typed";
import type { LegalForm, Movement, Referral } from "@/components/ward-management/ward-model";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { LEGAL_STATUSES_DIFFER, legalStatusesDiffer } from "@/components/ward-management/ward-stay-legal";
import { transportOrderOnFile } from "@/components/ward-management/ward-transport-paperwork";
import { wardLiveFormAlerts } from "@/components/ward-management/ward/ward-screen-derivations";

/**
 * Mechanics and clock audit (14 Nov 2026): H4, H5, H6, M1, M4 and M13 (a), with D-210 (Josh,
 * 14 Nov 2026) rulings 2, 3 and 7. Every reader takes the one current legal position. Synthetic only.
 */

const DAY_ZERO = perthMidnight(2026, 10, 14);
const thresholds = DEFAULT_DUE_SOON_THRESHOLDS;
const now = NOW_ANCHOR + 600;
const seed = seedWardFlowState();
const edWait = seed.movements.find((m) => !m.closure && m.originEdId !== undefined && m.stage !== "arrived")!;

function onForm(form: Partial<LegalForm>, base: Movement = edWait): Movement {
  return {
    ...base,
    examination: undefined,
    legalStatus: "Referred for psychiatric examination",
    legalForm: { code: "1A", kind: "detention", ...form } as LegalForm,
  };
}

describe("H4: every reader takes the one current legal position", () => {
  const ended = onForm({ dueAt: now + 30, endedBy: "revoked" });

  it("names an ended form as ended and shows no live expiry", () => {
    expect(legalFormNowWords(ended)).toBe("Form 1A ended");
    expect(currentLegalStanding(ended, now, thresholds)).toBe("none");
    expect(formTimeAsTyped(ended.legalForm!, now, DAY_ZERO)).toContain("recorded as ended");
    expect(nextStep(ended, now, DAY_ZERO).action).toBe("none");
    expect(transportOrderOnFile({ ...onForm({ code: "4A", endedBy: "revoked" }), uploadedForms: [] })).toBe(false);
  });

  it("the movement console never says Overdue for a legal time", () => {
    const chips = (dueAt: number, form: Partial<LegalForm> = {}) =>
      attentionItems({
        movement: onForm({ dueAt, ...form }),
        units: seed.units,
        now,
        thresholds,
        destination: undefined,
        open: true,
        blockerIsActive: false,
        dayZero: DAY_ZERO,
      })
        .filter((item) => item.key === "deadline")
        .map((item) => item.chip);
    expect(chips(now - 1)).toEqual(["Form expiry passed"]);
    expect(chips(now)).toEqual(["Act now"]);
    expect(chips(now + thresholds.soonMinutes)).toEqual(["Ending soon"]);
    expect(chips(now + thresholds.soonMinutes + 1)).toEqual([]);
    expect(chips(now - 1, { endedBy: "revoked" })).toEqual([]);
    for (const offset of [-600, -1, 0, 30, 120]) expect(chips(now + offset)).not.toContain("Overdue");
  });
});

describe("H5, ruling 7: the pull never copies an ended form or a passed expiry forward", () => {
  const ed = allEmergencyDepartments().find((place) => place.id === edWait.originEdId)!;
  const referral = {
    ...seed.referrals[0]!,
    id: "REF-MCA-1",
    source: "ed_medical",
    originSiteCode: ed.siteCode,
    patientId: edWait.patientId,
  } as Referral;
  const withWait = (wait: Movement) => seed.movements.map((m) => (m.id === wait.id ? wait : m));

  it("carries a form in force with its typed expiry", () => {
    const details = recordedPullDetails(referral, withWait(onForm({ code: "3B", dueAt: now + 60 })), now);
    expect(details.legalFormCode).toBe("3B");
    expect(details.legalFormDueAt).toBe(now + 60);
    expect(details.endedForm).toBeUndefined();
  });

  it("shows a passed typed expiry as information and leaves the form Not recorded", () => {
    const details = recordedPullDetails(referral, withWait(onForm({ code: "3B", dueAt: now - 5 })), now);
    expect(details.legalFormCode).toBeUndefined();
    expect(details.legalFormDueAt).toBeUndefined();
    expect(details.endedForm).toEqual({ code: "3B", typedEndAt: now - 5 });
    expect(endedFormWords(details.endedForm!, now, DAY_ZERO)).toMatch(/^Form 3B ended .*as typed/u);
  });

  it("shows a form recorded as ended as information only", () => {
    const details = recordedPullDetails(
      referral,
      withWait(onForm({ code: "3B", dueAt: now + 60, endedBy: "revoked" })),
      now,
    );
    expect(details.legalFormCode).toBeUndefined();
    expect(details.endedForm).toEqual({ code: "3B" });
    expect(endedFormWords(details.endedForm!, now, DAY_ZERO)).toBe(
      `Form 3B ended (${FORM_RECORDED_ENDED.toLowerCase()})`,
    );
  });
});

describe("H6: Forms in force leaves out a form recorded as ended", () => {
  it("drops it from the Forms page rows and the breakdown", () => {
    const ended = onForm({ code: "3A", endedBy: "revoked" });
    const movements = seed.movements.map((m) => (m.id === ended.id ? ended : m));
    for (const group of ["with-deadline", "no-deadline"] as const) {
      expect(legalFormGroupRows(movements, now, group).map((m) => m.id)).not.toContain(ended.id);
    }
    // The downtime pack still prints it, as ended (M17).
    expect(legalFormOrdered(movements, now).map((m) => m.id)).toContain(ended.id);
    expect(legalFormBreakdown([ended], now)).toEqual([]);
  });
});

/** The reviewer's admitted-on-a-form fixture: WF-003 arrived and in a bed on a Form 3B. */
function admittedState(form: Partial<LegalForm>) {
  const base = seed.movements.find((m) => m.id === "WF-003")!;
  const occupied = seed.admissions.find((a) => a.state === "occupied")!;
  const stay = { ...occupied, id: "ADM-MCA", movementId: base.id, patientId: base.patientId ?? occupied.patientId };
  const target: Movement = {
    ...base,
    acceptedUnitId: occupied.unitId,
    admissionId: "ADM-MCA",
    stage: "arrived",
    closure: { outcome: "arrived", at: NOW_ANCHOR - 120, reason: "Arrived" } as Movement["closure"],
    legalForm: { code: "3B", kind: "detention", ...form } as LegalForm,
  };
  return {
    target,
    unit: seed.units.find((u) => u.id === occupied.unitId)!,
    movements: seed.movements.map((m) => (m.id === base.id ? target : m)),
    admissions: [...seed.admissions, stay],
  };
}

describe("M1, ruling 2: a passed typed expiry for a person already admitted", () => {
  it("raises the ward desk's Act now and the coordinator's alert row", () => {
    const { target, unit, movements, admissions } = admittedState({ dueAt: now - 1 });
    const passed = admittedLegalExpiryPassed(movements, admissions, now);
    expect(passed.map((m) => m.id)).toEqual([target.id]);

    const inbox = admittedLegalInboxItems({ movements, admissions, dayZero: DAY_ZERO }, now);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ id: `legal-${target.id}`, tone: "danger", title: "Legal due time passed" });

    const { liveFormAlerts } = wardLiveFormAlerts({
      resolvePatientIdentity: () => ({ formalName: "Synthetic Person" }) as never,
      accepted: [],
      now,
      thresholds,
      overdueLeaveBeds: [],
      unit,
      dayZero: DAY_ZERO,
      admittedLegalPassed: passed,
    });
    expect(liveFormAlerts.map((alert) => [alert.key, alert.tone])).toEqual([
      [`form-admitted-${target.id}`, "critical"],
    ]);
  });

  it("raises nothing at the typed minute, or once a person records the form ended", () => {
    const atMinute = admittedState({ dueAt: now });
    expect(admittedLegalExpiryPassed(atMinute.movements, atMinute.admissions, now)).toEqual([]);
    const ended = admittedState({ dueAt: now - 60, endedBy: "revoked" });
    expect(admittedLegalExpiryPassed(ended.movements, ended.admissions, now)).toEqual([]);
    expect(admittedLegalInboxItems({ movements: ended.movements, admissions: ended.admissions }, now)).toEqual([]);
  });
});

describe("M4, ruling 3: legal bands come from the Settings thresholds on every screen", () => {
  const incoming = (dueAt: number) =>
    wardLiveFormAlerts({
      resolvePatientIdentity: () => ({ formalName: "Synthetic Person" }) as never,
      accepted: [onForm({ code: "4A", dueAt })],
      now,
      thresholds,
      overdueLeaveBeds: [],
      unit: seed.units[0]!,
      dayZero: DAY_ZERO,
    }).liveFormAlerts.map((alert) => alert.tone);

  const tvTone = (dueAt: number) => {
    const movement = onForm({ code: "4A", dueAt });
    const rows = edClinicalRows({
      edId: edWait.originEdId!,
      units: seed.units,
      now,
      accessTargetMinutes: 240,
      movements: seed.movements.map((m) => (m.id === movement.id ? movement : m)),
      referrals: seed.referrals,
      patients: seed.patients,
      dayZero: DAY_ZERO,
      thresholds,
      nameOf: () => "Synthetic Person",
    });
    return rows?.find((row) => row.id === movement.id)?.legal?.tone;
  };

  it.each([
    ["passed", now - 1, "critical", "danger"],
    ["at the typed minute", now, "critical", "danger"],
    ["within the urgent warning", now + thresholds.urgentMinutes, "critical", "danger"],
    ["within the soon warning", now + thresholds.soonMinutes, "warning", "warning"],
    ["beyond the soon warning", now + thresholds.soonMinutes + 1, undefined, undefined],
  ] as const)("%s: the ward incoming alert and the TV agree", (_label, dueAt, wardTone, tv) => {
    expect(incoming(dueAt)).toEqual(wardTone === undefined ? [] : [wardTone]);
    expect(tvTone(dueAt)).toBe(tv);
  });

  it("follows a changed Settings threshold", () => {
    const wide = { ...thresholds, soonMinutes: thresholds.soonMinutes * 4 };
    const movement = onForm({ code: "4A", dueAt: now + thresholds.soonMinutes * 2 });
    expect(currentLegalStanding(movement, now, thresholds)).toBe("later");
    expect(currentLegalStanding(movement, now, wide)).toBe("soon");
  });
});

describe("M13 (a): the TV uses the patient page's statuses-differ rule", () => {
  it("marks a journey whose status differs from the patient record", () => {
    expect(legalStatusesDiffer({ legalStatus: "Voluntary" }, { legalStatus: "Voluntary" })).toBe(false);
    expect(legalStatusesDiffer({ legalStatus: "Voluntary" }, { legalStatus: "Involuntary inpatient" } as never)).toBe(
      true,
    );
    const patient = seed.patients.find((p) => p.id === edWait.patientId);
    expect(patient, "the synthetic ED wait has a patient record").toBeDefined();
    const movement = { ...onForm({ code: "4A", dueAt: now + 600 }), legalStatus: "Voluntary" as const };
    const patients = seed.patients.map((p) =>
      p.id === patient!.id ? { ...p, legalStatus: "Referred for psychiatric examination" as const } : p,
    );
    const row = edClinicalRows({
      edId: edWait.originEdId!,
      units: seed.units,
      now,
      accessTargetMinutes: 240,
      movements: seed.movements.map((m) => (m.id === movement.id ? movement : m)),
      referrals: seed.referrals,
      patients,
      dayZero: DAY_ZERO,
      thresholds,
      nameOf: () => "Synthetic Person",
    })?.find((r) => r.id === movement.id);
    expect(row?.legal?.text).toContain(LEGAL_STATUSES_DIFFER);
  });
});
