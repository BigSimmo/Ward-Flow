import { describe, expect, it } from "vitest";

import { demoDayZero } from "@/components/ward-management/ward-clock";
import {
  dobAsShown,
  legalLine,
  previousTriageFrom,
  searchTriagePeople,
  triagePersonFromWorld,
  type WorldPersonInput,
} from "@/components/ward-management/triage/triage-risk-people";
import { blankTriage, requirements, sinceLastText } from "@/components/ward-management/triage/triage-risk-state";
import { summaryModel, summaryText } from "@/components/ward-management/triage/triage-risk-summary";

import { EXAMPLE_PERSON, exampleTriage } from "./helpers/triage-example";

// The Start a triage step and a new triage's blank state (approved mock-up, built into the app on
// 7 Nov 2026). Synthetic people only.

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

const PEOPLE = [
  triagePersonFromWorld(world({})),
  triagePersonFromWorld(world({ patientId: "PT-901", name: "Slateridge, Bo", umrn: "UM900002", dob: "1970-12-30" })),
  triagePersonFromWorld(world({ patientId: "PT-902", name: "Moss, Ridley", umrn: "UM900003" })),
];

describe("Start a triage search", () => {
  it("lists nobody until something is typed", () => {
    expect(searchTriagePeople(PEOPLE, "")).toEqual([]);
    expect(searchTriagePeople(PEOPLE, "  , ")).toEqual([]);
  });

  it("puts surnames that start with the text first, then given names, then the rest", () => {
    expect(searchTriagePeople(PEOPLE, "rid").map((p) => p.name)).toEqual([
      "Ridgewell, Ada",
      "Moss, Ridley",
      "Slateridge, Bo",
    ]);
  });

  it("finds by UMRN and by date of birth as shown", () => {
    expect(searchTriagePeople(PEOPLE, "UM900002").map((p) => p.name)).toEqual(["Slateridge, Bo"]);
    expect(searchTriagePeople(PEOPLE, "30/12/1970").map((p) => p.name)).toEqual(["Slateridge, Bo"]);
  });

  it("searches world people only: no worked Example is added", () => {
    expect(searchTriagePeople(PEOPLE, "Harlow")).toEqual([]);
    expect(PEOPLE.map((p) => p.id)).toEqual(["PT-900", "PT-901", "PT-902"]);
  });
});

describe("a world person on the banner", () => {
  it("reads the record: surname first, DD/MM/YYYY, legal as typed, no previous triage", () => {
    const person = triagePersonFromWorld(world({ legalStatus: "Form 1A", origin: "Peel Health Campus ED" }));
    expect(person.name).toBe("Ridgewell, Ada");
    expect(person.meta).toBe("Female · 41y");
    expect(person.dob).toBe("03/02/1985");
    expect(person.nowAt).toBe("Peel Health Campus ED");
    expect(person.legal).toBe("Form 1A");
    expect(legalLine(person)).toBe("Form 1A, as typed. Not legally checked.");
    expect(person.last).toBeNull();
    expect(person.recordHref).toBe("/ward-flow/people/code900");
  });

  it("shows the record's alerts, allergies on their own chip", () => {
    const person = triagePersonFromWorld(
      world({ alerts: ["Penicillin allergy", "Type 2 diabetes, insulin", "Falls risk"] }),
    );
    expect(person.allergies).toBe("Penicillin allergy");
    expect(person.alert).toBe("Type 2 diabetes, insulin");
    expect(person.alertCount).toBe(2);
    expect(person.alerts).toEqual(["Type 2 diabetes, insulin", "Falls risk"]);
  });

  it("reads no alert and allergies not recorded when the record has none", () => {
    const person = triagePersonFromWorld(world({}));
    expect(person.alert).toBeNull();
    expect(person.alertCount).toBe(0);
    expect(person.allergies).toBe("Not recorded");
  });

  it("says when legal status, sex or age are not recorded", () => {
    const person = triagePersonFromWorld(world({ gender: "", age: "" }));
    expect(person.legal).toBeNull();
    expect(legalLine(person)).toBe("Legal status not recorded.");
    expect(person.meta).toBe("Sex not recorded · age not recorded");
    expect(dobAsShown("")).toBe("Not recorded");
  });
});

describe("a new triage", () => {
  const person = triagePersonFromWorld(world({}));
  const state = blankTriage(person);

  it("starts with nothing pre-selected, the episode included", () => {
    const { person: who, text, ...answers } = state;
    expect(who).toBe(person);
    expect(Object.values(text).every((value) => value === "")).toBe(true);
    for (const [key, value] of Object.entries(answers)) {
      if (Array.isArray(value)) expect(value, key).toEqual([]);
      else if (value && typeof value === "object") expect(Object.keys(value), key).toEqual([]);
      else if (key !== "mseMode" && key !== "xrKind") expect(value, key).toBeFalsy();
    }
  });

  it("asks why urgency differs only when the referral asked for a tier", () => {
    const asked = requirements({ ...blankTriage(EXAMPLE_PERSON), urgency: "A" }, Date.now());
    expect(asked.some((r) => r.label === "Why urgency differs")).toBe(true);
    const none = requirements({ ...state, urgency: "A" }, Date.now());
    expect(none.some((r) => r.label === "Why urgency differs")).toBe(false);
  });

  it("compares with a last triage only when one is on record", () => {
    const flagged = { ...state, f: { "general.now.intox": "y" as const } };
    expect(sinceLastText(flagged)).toBe("");
    expect(sinceLastText({ ...exampleTriage(), f: { "general.now.intox": "y" } })).not.toBe("");
  });

  it("names the chosen person in the summary and says there is no referral", () => {
    const model = summaryModel(state);
    expect(model.name).toBe("Ridgewell, Ada");
    expect(model.keyLine).toContain("Dr S. Chen");
    expect(summaryText(model)).toMatch(/\nReferral: None\n/);
  });

  it("prefills the referrer from the referral only, and chooses nothing", () => {
    const harlow = blankTriage(EXAMPLE_PERSON);
    expect(harlow.text.refName).toBe("Dr P. Singh");
    expect(harlow.arrivedBy).toBeNull();
    expect(harlow.interp).toBeNull();
    expect(harlow.sources).toEqual([]);
    expect(state.text.refName).toBe("");
  });

  it("keeps a referral's episode", () => {
    expect(blankTriage(EXAMPLE_PERSON).episode).toBe("ED");
  });
});

describe("a previous triage, read from a signed record", () => {
  const signed = {
    patientId: "PT-900",
    at: 60 * 10,
    by: "ward" as const,
    urgency: "C" as const,
    outcome: "Accepted" as const,
    legal: "cto" as const,
    review: "72h" as const,
    riskFlags: ["violence.bg.prev", "general.now.agit"],
  };
  const last = previousTriageFrom(signed, demoDayZero(new Date("2026-11-07T04:00:00Z")));

  it("carries only past flags forward and keeps current flags for what is new today", () => {
    expect(last.pastFlags).toEqual(["violence.bg.prev"]);
    expect(last.nowFlags).toEqual(["general.now.agit"]);
    expect(last.pastSummary).toMatch(/^Previous violence\. Carries these flags only/);
  });

  it("names its codes in words and the synthetic reviewer", () => {
    expect(last.urgencyText).toBe("C within 12 hours");
    expect(last.legal).toBe("Community treatment order");
    expect(last.review).toBe("72 hours");
    expect(last.label).toMatch(/^Last triage · \d{2} [A-Z][a-z]{2} · Dr S\. Chen$/);
  });

  it("puts that triage on the person, so the next one compares with it", () => {
    const person = triagePersonFromWorld(world({ last }));
    const state = { ...blankTriage(person), rest: "np", f: {} };
    expect(sinceLastText(state)).toMatch(/^Not seen today: distress or agitation\.$/);
  });
});

describe("the document", () => {
  it("starts with the key line, keeps PSOLIS order and ends with the signature", () => {
    const model = summaryModel(exampleTriage(), { at: "07/11/2026 10:42", by: "Dr S. Chen" });
    expect(model.keyLine).toBe(
      "Urgency not chosen · Outcome not set · Community treatment order, Form 5A 28/01/2027 23:59 (as typed) · Reviewed 06/11/2026 09:42 Phone · Dr S. Chen",
    );
    expect(model.parts.map((p) => p.title)).toEqual([
      "Review details",
      "Assessment",
      "Mental state",
      "Triage decision",
      "Risk assessment",
      "Formulation and plan",
    ]);
    const text = summaryText(model);
    expect(text).toMatch(/\n\n5\. RISK ASSESSMENT\nCurrent: present: /);
    expect(text).toMatch(/\nArrived by: Ambulance\n/);
    expect(text).toMatch(/\nReferrer: Dr P\. Singh, ED registrar · \(08\) 5550 0190\n/);
    expect(text).toMatch(/\n\nSIGNATURE\nSigned 07\/11\/2026 10:42 by Dr S\. Chen\n/);
    expect(text).not.toContain("SYN 40-2271");
  });

  it("lists not known apart and marks carried flags", () => {
    const state = {
      ...exampleTriage(),
      f: { ...exampleTriage().f, "general.now.intox": "u" as const, "violence.bg.prev": "y" as const },
      fromLast: ["violence.bg.prev"],
    };
    const text = summaryText(summaryModel(state));
    expect(text).toMatch(/\nCurrent: not known: /);
    expect(text).toMatch(/\(carried from 12 Oct, not re-checked\)/);
    expect(text).toMatch(/\nNot signed\. Reviewer: Dr S\. Chen/);
  });
});
