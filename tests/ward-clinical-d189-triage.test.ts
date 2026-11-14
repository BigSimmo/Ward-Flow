import { describe, expect, it } from "vitest";

import { DESK_PERSONAS } from "@/components/ward-management/shell/ward-desk-personas";
import { triageSignedLine } from "@/components/ward-management/triage/patient-triage-card";
import { LEGAL, TIER_LONG, type TriageSignedRecord } from "@/components/ward-management/triage/triage-record";
import { LEGAL_SHORT } from "@/components/ward-management/triage/triage-risk-data";
import { isbarText } from "@/components/ward-management/triage/triage-risk-isbar";
import { previousTriageFrom } from "@/components/ward-management/triage/triage-risk-people";
import {
  SAFETY_PLAN_SERVICES,
  serviceCheck,
  serviceText,
} from "@/components/ward-management/triage/triage-risk-safety";
import { blankTriage } from "@/components/ward-management/triage/triage-risk-state";
import { summaryModel, summaryText } from "@/components/ward-management/triage/triage-risk-summary";
import { seeBy } from "@/components/ward-management/triage/triage-see-by";
import { DEFAULT_REVIEWER, signerName } from "@/components/ward-management/triage/triage-signer";
import { demoDayZero, perthMidnight } from "@/components/ward-management/ward-clock";

import { EXAMPLE_PERSON } from "./helpers/triage-example";

// The held clinical PR's Triage package (D-189 item 9, Josh 13 Nov 2026): A9-29 (a signed triage
// names the desk that signed it), the F-52 remainder (A9-20(b), A9-22(a), (b) and (d)), F-80 (crisis
// numbers stay copy-only, never a call link: D-189 item 5) and the LEGAL_SHORT key rename. Labels and
// display only; no clinical value changes. Synthetic data only.

// The two whole-folder Triage guards (no fixed signer, no call link) are in
// ward-clinical-source-guards.test.ts; the mental state hint is checked rendered in
// ward-clinical-triage-wording.dom.test.tsx.

const record = (by: TriageSignedRecord["by"]): TriageSignedRecord => ({
  patientId: "PT-SYN-1",
  at: 10 * 60,
  by,
  urgency: "C",
  outcome: "Accepted",
  legal: "vol",
  review: "72h",
  riskFlags: [],
});
const DAY_ZERO = demoDayZero(new Date("2026-11-07T04:00:00Z"));

describe("A9-29: a signed triage names the desk that signed it, from the record", () => {
  // Go question 4 (Josh, 14 Nov 2026): the desk's own name, never its sample persona.
  it("reads each desk's own name, never its sample persona", () => {
    expect(signerName("ward")).toBe("Nurse in charge");
    expect(signerName("ed")).toBe("ED clinician");
    expect(signerName("coordinator")).toBe("Bed coordinator");
    expect(signerName("demo")).toBe("Demonstration control");
    expect(DEFAULT_REVIEWER).toBe("Bed coordinator");
    for (const persona of Object.values(DESK_PERSONAS))
      for (const role of ["ward", "ed", "coordinator"] as const) expect(signerName(role)).not.toBe(persona.name);
  });

  it("names the ward desk in the previous-triage label, the summary, the iSoBAR and the patient card", () => {
    const signed = record("ward");
    const last = previousTriageFrom(signed, DAY_ZERO);
    expect(last.label).toMatch(/ · Nurse in charge$/u);
    expect(last.by).toBe("Nurse in charge");

    const by = { at: "07/11/2026 10:42", by: signerName(signed.by) };
    const state = blankTriage(EXAMPLE_PERSON);
    expect(summaryModel(state, by).keyLine).toMatch(/ · Nurse in charge$/u);
    expect(summaryText(summaryModel(state, by))).toContain("Signed 07/11/2026 10:42 by Nurse in charge");
    expect(isbarText(state, by)).toMatch(/\nI Identify: Nurse in charge · /u);
    expect(triageSignedLine(signed, DAY_ZERO)).toMatch(/^Signed \d{2} [A-Z][a-z]{2} \d{2}:\d{2} by Nurse in charge$/u);
  });

  it("names the ED desk when the ED desk signed", () => {
    const signed = record("ed");
    expect(previousTriageFrom(signed, DAY_ZERO).label).toMatch(/ · ED clinician$/u);
    expect(triageSignedLine(signed, DAY_ZERO)).toMatch(/ by ED clinician$/u);
  });

  it("names the desk filling in an unsigned triage as its reviewer", () => {
    const state = blankTriage(EXAMPLE_PERSON);
    expect(summaryText(summaryModel(state, undefined, signerName("ward")))).toContain(
      "Not signed. Reviewer: Nurse in charge",
    );
    expect(isbarText(state, undefined, signerName("ed"))).toMatch(/\nI Identify: ED clinician · /u);
  });
});

describe("F-52 remainder: checks that trip a careful clinician (A9-22)", () => {
  const REVIEWED = "09/11/2026 10:42";
  // 09/11/2026 10:42 on the Perth clock, as checkReviewTime reads it.
  const reviewedAt = perthMidnight(2026, 10, 9).getTime() + (10 * 60 + 42) * 60_000;
  const today = new Date(2026, 10, 9, 11, 0);

  it("(a) shows no see-by time beside a reviewed time the check refuses as in the future", () => {
    const before = reviewedAt - 60 * 60_000;
    expect(seeBy("B", REVIEWED, today, TIER_LONG.B, before)).toBeNull();
    expect(seeBy("B", REVIEWED, today, TIER_LONG.B, reviewedAt + 60_000)?.when).toBe("12:42 today");
    // Without the moment, the arithmetic is as it was; A stays immediate whatever the time.
    expect(seeBy("B", REVIEWED, today, TIER_LONG.B)?.when).toBe("12:42 today");
    expect(seeBy("A", REVIEWED, today, TIER_LONG.A, before)?.when).toBe("Now");
  });
});

describe("F-80 (D-189 item 5): crisis numbers stay copy-only text, never a call link", () => {
  it("marks every number Not checked until both who and when are filled in, and changes no number", () => {
    for (const service of SAFETY_PLAN_SERVICES) {
      expect(serviceCheck(service), service.name).toBe("Not checked");
      if (service.phone) expect(serviceText(service)).toBe(`${service.name} ${service.phone} (Not checked)`);
    }
    expect(SAFETY_PLAN_SERVICES.map((service) => service.phone)).toEqual([
      "1300 555 788",
      "13 11 14",
      "13 92 76",
      "1800 55 1800",
      "000",
      null,
    ]);
  });
});

describe("LEGAL_SHORT follows the renamed status (D-187 item 18, TW-107)", () => {
  it("keys every short form by a status name the form offers", () => {
    const names = LEGAL.map(([, name]) => name as string);
    for (const key of Object.keys(LEGAL_SHORT)) expect(names, key).toContain(key);
  });

  it("shortens the referred status to Referred", () => {
    expect(LEGAL_SHORT["Referred for psychiatric examination"]).toBe("Referred");
    expect(LEGAL_SHORT["Referred (Form 1A)"]).toBeUndefined();
  });
});
