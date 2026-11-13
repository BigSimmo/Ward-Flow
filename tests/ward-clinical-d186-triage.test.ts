import { describe, expect, it } from "vitest";

import { resolvePatientNowRecord } from "@/components/ward-management/patients/patient-now-adapter";
import { patientKeyFor } from "@/components/ward-management/referrals/ward-referral-drawer-model";
import { foldLine } from "@/components/ward-management/triage/triage-risk-fold";
import {
  legalLine,
  triagePersonFromWorld,
  wardStayFacts,
  type WorldPersonInput,
} from "@/components/ward-management/triage/triage-risk-people";
import {
  SAFETY_PLAN_SERVICES,
  applySafetyPlan,
  serviceCheck,
  serviceText,
  BLANK_SAFETY_PLAN,
} from "@/components/ward-management/triage/triage-risk-safety";
import { summaryModel, summaryText } from "@/components/ward-management/triage/triage-risk-summary";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { stayLegalStatus } from "@/components/ward-management/ward-stay-legal";

import { exampleTriage, SIGNED_RECORD_WORDS } from "./helpers/triage-example";

// D-186 (Josh, 13 Nov 2026; the clinical sitting's Q10, Q11, Q12 and Q14): the Triage banner reads the
// ward and legal status the patient page shows, its two legal lines are "Chosen today" and "On record",
// each crisis number reads "Not checked" until it is checked, and the signed line and How to name
// everything signing saves. Wording and display only; no clinical value changes. Synthetic data only.

const seed = seedWardFlowState();
// What the screen draws (the hook's stay and legal reading, the labels, the sheets, How to and the
// signed line) is checked rendered, in ward-clinical-triage-wording.dom.test.tsx and
// ward-clinical-review-fixes-2.dom.test.tsx, not by reading the source as text (CQ-10).

/** Seed people with no open movement, so the referral model alone would say "Not recorded". */
const withoutOpenMovement = seed.patients.filter((patient) => !patientKeyFor(patient.id, seed)?.startsWith("WF-"));

const world = (overrides: Partial<WorldPersonInput>): WorldPersonInput => ({
  patientId: "PT-900",
  name: "Ridgewell, Ada",
  age: "41",
  gender: "F",
  umrn: "UM900001",
  dob: "1985-02-03",
  origin: "Not recorded",
  legalStatus: "Not recorded",
  recordAddress: "code900",
  openReferral: null,
  ...overrides,
});

describe("Q10: the banner reads a ward stay as the patient page does", () => {
  const onWard = withoutOpenMovement.flatMap((patient) => {
    const facts = wardStayFacts(patient.id, seed, NOW_ANCHOR);
    return facts ? [{ patient, facts }] : [];
  });

  it("finds people on a ward with no open movement, some with a recorded legal status (not vacuous)", () => {
    expect(onWard.length).toBeGreaterThan(0);
    expect(onWard.some(({ facts }) => facts.legalStatus !== "Not recorded")).toBe(true);
  });

  it("gives the ward of the stay the patient page resolves, and that stay's recorded legal status", () => {
    for (const { patient, facts } of onWard) {
      const stay = resolvePatientNowRecord(
        patient.id,
        seed.patients,
        seed.movements,
        seed.referrals,
        seed.admissions,
        seed.units,
        NOW_ANCHOR,
      )?.liveAdmission;
      expect(stay?.state, patient.id).toBe("occupied");
      expect(facts.origin, patient.id).toBe(seed.units.find((unit) => unit.id === stay!.unitId)?.name);
      expect(facts.legalStatus, patient.id).toBe(stayLegalStatus(stay!, seed) ?? "Not recorded");
    }
  });

  it("keeps Not recorded for someone with no ward stay", () => {
    const offWard = withoutOpenMovement.filter((patient) => !wardStayFacts(patient.id, seed, NOW_ANCHOR));
    expect(offWard.length).toBeGreaterThan(0);
    const person = triagePersonFromWorld(world({ patientId: offWard[0]!.id }));
    expect(person.nowAt).toBe("Not recorded");
    expect(person.legal).toBeNull();
  });

  it("shows the stay's ward and status on the banner, still not legally checked", () => {
    const { facts } = onWard.find(({ facts }) => facts.legalStatus !== "Not recorded")!;
    const person = triagePersonFromWorld(world({ origin: facts.origin, legalStatus: facts.legalStatus }));
    expect(person.nowAt).toBe(facts.origin);
    expect(person.legal).toBe(facts.legalStatus);
    expect(person.legalTag).toBe("On record · Not legally checked.");
  });
});

describe('Q11: "Chosen today" and "On record"; a picked status reads "as chosen"', () => {
  it("reads the record's status as on record in the start rows and Patient and referral", () => {
    const person = triagePersonFromWorld(world({ legalStatus: "Community treatment order" }));
    expect(legalLine(person)).toBe("Community treatment order, on record. Not legally checked.");
  });

  it("reads the chosen status as chosen and only the typed form and date as typed", () => {
    const state = exampleTriage();
    const legal = "Community treatment order (as chosen), Form 5A · 28/01/2027 23:59 (as typed)";
    expect(foldLine(state, "dec")).toContain(legal);
    expect(summaryModel(state).keyLine).toContain(
      "Community treatment order (as chosen), Form 5A 28/01/2027 23:59 (as typed)",
    );
    const noForm = { ...state, legal: "vol" as const };
    expect(foldLine(noForm, "dec")).toContain("Voluntary (as chosen)");
    expect(summaryModel(noForm).keyLine).toContain("Voluntary (as chosen)");
    expect(summaryModel(noForm).keyLine).not.toContain("as typed");
  });
});

describe("Q12: crisis numbers read Not checked until checked", () => {
  it("keeps every name and number, with checked by and checked on empty today", () => {
    expect(SAFETY_PLAN_SERVICES.map(({ name, phone }) => [name, phone])).toEqual([
      ["Mental Health Emergency Response Line (metro WA)", "1300 555 788"],
      ["Lifeline", "13 11 14"],
      ["13YARN", "13 92 76"],
      ["Kids Helpline", "1800 55 1800"],
      ["Emergency", "000"],
      ["Community team on-call", null],
    ]);
    for (const service of SAFETY_PLAN_SERVICES) {
      expect(service.checkedBy).toBeNull();
      expect(service.checkedOn).toBeNull();
    }
  });

  it("puts Not checked beside each number, and nothing beside a service with no number", () => {
    const lifeline = SAFETY_PLAN_SERVICES.find((service) => service.name === "Lifeline")!;
    expect(serviceText(lifeline)).toBe("Lifeline 13 11 14 (Not checked)");
    const onCall = SAFETY_PLAN_SERVICES.find((service) => service.phone === null)!;
    expect(serviceText(onCall)).toBe("Community team on-call");
  });

  it("says Not checked until both checked by and checked on are filled", () => {
    const lifeline = SAFETY_PLAN_SERVICES.find((service) => service.name === "Lifeline")!;
    expect(serviceCheck({ ...lifeline, checkedBy: "Synthetic Checker" })).toBe("Not checked");
    expect(serviceCheck({ ...lifeline, checkedOn: "01/12/2026" })).toBe("Not checked");
    expect(serviceCheck({ ...lifeline, checkedBy: " ", checkedOn: "01/12/2026" })).toBe("Not checked");
    expect(serviceText({ ...lifeline, checkedBy: "Synthetic Checker", checkedOn: "01/12/2026" })).toBe(
      "Lifeline 13 11 14 (checked by Synthetic Checker on 01/12/2026)",
    );
  });

  it("carries Not checked into the plan, the Summary and Copy summary", () => {
    const services = SAFETY_PLAN_SERVICES.filter((service) => service.phone)
      .map(serviceText)
      .join("; ");
    const state = exampleTriage();
    const rp = applySafetyPlan(state.text.rp, { ...BLANK_SAFETY_PLAN, services });
    expect(rp).toContain("Lifeline 13 11 14 (Not checked)");
    const planned = { ...state, text: { ...state.text, rp } };
    const copied = summaryText(summaryModel(planned));
    for (const service of SAFETY_PLAN_SERVICES.filter((s) => s.phone))
      expect(copied).toContain(`${service.name} ${service.phone} (Not checked)`);
    expect(JSON.stringify(summaryModel(planned).parts)).toContain("Emergency 000 (Not checked)");
  });
});

describe("Q14: the signed line and How to name everything signing saves", () => {
  const signed = wardFlowReducer(seed, {
    type: "RECORD_TRIAGE_SIGNED",
    role: "ward",
    now: NOW_ANCHOR,
    patientId: seed.patients[0]!.id,
    urgency: "C",
    outcome: "Accepted",
    legal: "cto",
    review: "72h",
    riskFlags: ["violence.now.intent"],
    problems: ["suicidal"],
    actions: ["police"],
    venue: "ed",
    referralType: "self",
  });

  // The signed line and How to's What gets saved are checked rendered, word by word, in
  // ward-clinical-review-fixes-2.dom.test.tsx and ward-clinical-triage-wording.dom.test.tsx.
  it("names every field of the signed record, and the record holds no other", () => {
    const record = (signed.triages ?? []).at(-1)!;
    expect(Object.keys(record).sort()).toEqual(Object.keys(SIGNED_RECORD_WORDS).sort());
  });
});
