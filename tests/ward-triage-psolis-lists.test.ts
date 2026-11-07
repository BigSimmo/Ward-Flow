import { describe, expect, it } from "vitest";

import {
  PSOLIS_LIST_GAPS,
  ACTIONS_COMMON,
  ALL_PROGRAMS,
  DESK_PROGRAM,
  labelOf,
  PROBLEMS_COMMON,
  PROGRAMS,
  PSOLIS_ACTIONS,
  PSOLIS_PROBLEMS,
  psolisOf,
  REFERRAL_TYPES,
  REFERRAL_TYPES_COMMON,
  STREAMS,
  VENUES,
  VENUES_COMMON,
} from "@/components/ward-management/triage/triage-psolis-lists";
import { RISK_TO_PROBLEM, WHO_TOLD } from "@/components/ward-management/triage/triage-risk-data";
import { partText, summaryModel, summaryText } from "@/components/ward-management/triage/triage-risk-summary";

import { exampleTriage } from "./helpers/triage-example";

// The triage form's webPSOLIS pick-lists (Josh's decision 3, 7 Nov 2026): plain sentence-case
// labels on screen; Copy and the summary write the exact PSOLIS value. System reference values and
// a synthetic patient only.

type Option = readonly [string, string, string | null, ...unknown[]];
const LISTS: Record<string, readonly Option[]> = {
  VENUES,
  REFERRAL_TYPES,
  PSOLIS_PROBLEMS,
  PSOLIS_ACTIONS,
  STREAMS,
  ...Object.fromEntries(Object.entries(PROGRAMS).map(([stream, list]) => [`PROGRAMS.${stream}`, list])),
};
const codes = (list: readonly Option[]) => list.map(([code]) => code);

describe("the PSOLIS pick-lists", () => {
  it("keeps the gaps the source did not show on record until Josh sends the rest", () => {
    expect(PSOLIS_LIST_GAPS.length).toBeGreaterThan(0);
    for (const list of ["Referral type", "Venue", "Problems", "Action plan"])
      expect(PSOLIS_LIST_GAPS.some((gap) => gap.startsWith(list))).toBe(true);
  });

  it.each(Object.entries(LISTS))("%s has unique codes, labels and PSOLIS values", (_, list) => {
    expect(new Set(codes(list)).size).toBe(list.length);
    expect(new Set(list.map(([, label]) => label)).size).toBe(list.length);
    const values = list.map(([, , psolis]) => psolis).filter((v) => v !== null);
    expect(new Set(values).size).toBe(values.length);
  });

  it("keeps every program code unique across streams", () => {
    expect(new Set(codes(ALL_PROGRAMS)).size).toBe(ALL_PROGRAMS.length);
  });

  it.each(Object.entries(LISTS))("%s spells every PSOLIS value in upper case, labels in sentence case", (_, list) => {
    for (const [, label, psolis] of list) {
      if (psolis !== null) expect(psolis).toBe(psolis.toUpperCase());
      expect(label).not.toBe(label.toUpperCase());
      expect(label[0]).toBe(label[0]!.toUpperCase());
    }
  });

  it("keeps the source spelling exactly, including LIASON", () => {
    expect(psolisOf(PSOLIS_ACTIONS, "alo")).toBe("ABORIGINAL LIASON OFFICER NOTIFIED");
    expect(labelOf(PSOLIS_ACTIONS, "alo")).toBe("Aboriginal liaison officer notified");
    expect(psolisOf(PSOLIS_PROBLEMS, "dsh")).toBe("DELIBERATE SELF HARM");
    expect(psolisOf(VENUES, "home")).toBe("HOME/PRIVATE DWELLING");
    expect(psolisOf(VENUES, "lock-up")).toBe("LOCK UP");
    expect(psolisOf(REFERRAL_TYPES, "family")).toBe("FAMILY / FRIEND");
    expect(psolisOf(PSOLIS_PROBLEMS, "disturbed-thoughts")).toBe("DISTURBED THOUGHTS, DELUSIONS ETC");
  });

  it("writes the label for a Ward Flow step with no PSOLIS value, and nothing for an unknown code", () => {
    expect(psolisOf(PSOLIS_ACTIONS, "bed-request")).toBe("Bed request");
    expect(psolisOf(PSOLIS_ACTIONS, "not-a-code")).toBe("");
    expect(labelOf(PSOLIS_ACTIONS, null)).toBe("");
  });

  it("shows only codes from each list before More", () => {
    const pairs: [readonly string[], readonly Option[]][] = [
      [VENUES_COMMON, VENUES],
      [REFERRAL_TYPES_COMMON, REFERRAL_TYPES],
      [PROBLEMS_COMMON, PSOLIS_PROBLEMS],
      [ACTIONS_COMMON, PSOLIS_ACTIONS],
    ];
    for (const [common, list] of pairs) for (const code of common) expect(codes(list)).toContain(code);
  });

  it("gives each desk a program from its own stream", () => {
    for (const desk of Object.values(DESK_PROGRAM)) {
      expect(codes(STREAMS)).toContain(desk!.stream);
      expect(codes(PROGRAMS[desk!.stream])).toContain(desk!.program);
    }
  });

  it("points the form's risk and who-told rules at codes on the lists", () => {
    for (const [, problem] of RISK_TO_PROBLEM) expect(codes(PSOLIS_PROBLEMS)).toContain(problem);
    for (const [action] of WHO_TOLD) expect(codes(PSOLIS_ACTIONS)).toContain(action);
  });
});

describe("the summary writes PSOLIS values", () => {
  const state = {
    ...exampleTriage(),
    referralType: "medical",
    program: "rph-ed-triage",
    actions: ["bed-request", "police", "ref-inpatient"],
  };
  const model = summaryModel(state);
  const text = summaryText(model);

  it("writes venue, referral type, stream and program as PSOLIS spells them", () => {
    const review = partText(model.parts[0]!);
    expect(review).toMatch(/^Venue: EMERGENCY DEPARTMENT$/m);
    expect(review).toMatch(/^Referral type: MEDICAL PRACTITIONER$/m);
    expect(review).toMatch(/^Stream: RPH ADULT$/m);
    expect(review).toMatch(/^Program: RPH ED TRIAGE$/m);
    expect(review).not.toMatch(/Emergency department|Medical practitioner|ED triage/);
  });

  it("writes problems and actions in the order chosen, never the screen labels", () => {
    expect(text).toContain("Problems: PSYCHOTIC SYMPTOMS, AGGRESSIVE/THREATENING BEHAVIOUR, ALCOHOL/DRUGS");
    expect(text).toContain("Actions: Bed request, POLICE NOTIFIED, REFERRED TO INPATIENT MENTAL HEALTH SERVICE");
    expect(text).not.toMatch(/Psychotic symptoms|Alcohol or drugs|Police notified/);
  });

  it("asks for medical clearance once a bed is requested, by its code", () => {
    expect(text).toContain("Medical clearance: not recorded.");
    expect(summaryText(summaryModel(exampleTriage()))).not.toContain("Medical clearance");
  });

  it("names who was told from the action codes", () => {
    const told = summaryText(summaryModel({ ...state, urgency: "A", actions: ["police", "senior"] }));
    expect(told).toContain("Who was told: Police, Senior");
  });

  it("writes OTHER with its typed detail in the copied text", () => {
    const withOther = {
      ...state,
      problems: ["other"],
      actions: ["other"],
      text: { ...state.text, problemOther: "Synthetic detail A", actionOther: "Synthetic detail B" },
    };
    const copied = summaryText(summaryModel(withOther));
    expect(copied).toContain("Problems: OTHER: Synthetic detail A");
    expect(copied).toContain("Actions: OTHER: Synthetic detail B");
    expect(summaryText(summaryModel({ ...state, problems: ["other"] }))).toContain("Problems: OTHER\n");
  });
});
