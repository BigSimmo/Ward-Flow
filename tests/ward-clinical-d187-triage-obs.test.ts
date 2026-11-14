import { describe, expect, it } from "vitest";

import {
  BED_FINDER_GENDER_REVIEW,
  BED_FINDER_WARD_FOR,
  findBeds,
  wardForAccepts,
  wardForNeedsReview,
  type BedFinderFilters,
} from "@/components/ward-management/tools/ward-bed-finder";
import { LEGAL } from "@/components/ward-management/triage/triage-record";
import { isbarText } from "@/components/ward-management/triage/triage-risk-isbar";
import { SAFETY_PLAN_SERVICES, serviceText } from "@/components/ward-management/triage/triage-risk-safety";
import { blankTriage, type TriageState } from "@/components/ward-management/triage/triage-risk-state";
import { foldLine } from "@/components/ward-management/triage/triage-risk-fold";
import { triagePersonFromWorld } from "@/components/ward-management/triage/triage-risk-people";
import { summaryModel, summaryText } from "@/components/ward-management/triage/triage-risk-summary";
import { GENDER_PLACEMENT_REFUSAL } from "@/components/ward-management/ward-change-reasons";
import { sexDesignationAccepts } from "@/components/ward-management/ward-eligibility";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { REFERRAL_GENDERS } from "@/components/ward-management/ward-model-vocabulary";

import { EXAMPLE_PERSON, exampleTriage } from "./helpers/triage-example";

// D-187 (Josh, 13 Nov 2026; the clinical sitting's Q36, Q39, Q43 and Q44). Item 14: the bed finder's
// "Ward for" offers the recorded genders, and those beyond Female and Male filter no ward and show the
// coordinator-review message. Item 17: the copied iSoBAR's Recommendation carries the safety plan's
// Plan and Crisis lines, crisis numbers keeping "Not checked". Item 18: the Triage wording sheet's
// "Contradicts" rows. Item 19 (the Intermittent interval) is in the matching .dom test. Wording and
// display only; no clinical value changes. Synthetic data only.

const line = (text: string, start: string) => text.split("\n").find((l) => l.startsWith(start)) ?? "";

describe("D-187 item 17 (Q39): the copied handover's Recommendation carries the safety plan", () => {
  it("prints a dash for an empty Plan and Crisis, inventing nothing", () => {
    expect(line(isbarText(blankTriage(EXAMPLE_PERSON)), "R ")).toBe(
      "R Recommendation: Actions – · Review risk by – · Plan – · Crisis –",
    );
  });

  it("carries the Plan and Crisis lines as written, with each crisis number's Not checked mark", () => {
    const lifeline = SAFETY_PLAN_SERVICES.find((service) => service.name === "Lifeline")!;
    const blank = blankTriage(EXAMPLE_PERSON);
    const state: TriageState = {
      ...blank,
      text: {
        ...blank.text,
        rp: [
          "Protective: Mother supportive.",
          "Plan: Home with mother tonight.",
          "Step 1, warning signs: not sleeping.",
          "Means safety: Mother holds medicines.",
          `Crisis: Step 5, services: ${serviceText(lifeline)}.`,
          "Crisis (Rosa): Call the community team.",
          "Follow-up: Seen tomorrow.",
        ].join("\n"),
      },
    };
    const recommendation = line(isbarText(state), "R ");
    expect(recommendation).toBe(
      "R Recommendation: Actions – · Review risk by – · Plan Home with mother tonight. Step 1, warning signs: not sleeping. · Crisis Step 5, services: Lifeline 13 11 14 (Not checked). (Rosa) Call the community team.",
    );
    // D-186 item 12: the number keeps its mark; no number changes.
    expect(recommendation).toContain(`${lifeline.phone} (Not checked)`);
    // Only Plan and Crisis join it: Means safety and the plan's Follow-up heading stay where they were.
    expect(recommendation).not.toMatch(/Mother holds medicines|Seen tomorrow/u);
  });

  it("keeps the follow-up choice last, after the safety plan lines", () => {
    const blank = blankTriage(EXAMPLE_PERSON);
    const state: TriageState = {
      ...blank,
      outcome: "Advice only",
      followUp: "72h",
      text: { ...blank.text, rp: "Plan: Home.\n" },
    };
    expect(line(isbarText(state), "R ")).toMatch(/· Plan Home\. · Crisis – · Follow-up Within 72 h$/u);
  });

  it("leaves the risk answers' dash wording as it was (the confirmed none and not known words stay open)", () => {
    const text = isbarText(blankTriage(EXAMPLE_PERSON));
    expect(line(text, "B ")).toBe("B Background: Past risk –");
    expect(line(text, "A ")).toBe("A Assessment: Current risk –");
  });
});

describe("D-187 item 18 (Q43): the Triage wording sheet's Contradicts rows", () => {
  it("TW-107: the referred status reads as the approved status words, not tied to Form 1A (D-170 item 4)", () => {
    const names = LEGAL.map(([, name]) => name);
    expect(names).toContain("Referred for psychiatric examination");
    expect(names).not.toContain("Referred (Form 1A)");
    // The stored code is unchanged, so a signed record reads the same.
    expect(LEGAL.find(([, name]) => name === "Referred for psychiatric examination")?.[0]).toBe("ref");
  });

  it("TW-173: Current present reads Not answered until Rest of current risk is answered, then None recorded", () => {
    const blank = blankTriage(EXAMPLE_PERSON);
    const unanswered = summaryText(summaryModel(blank));
    expect(unanswered).toMatch(/\nCurrent: present: Not answered\n/u);
    expect(unanswered).not.toMatch(/None flagged/u);
    const answered = summaryText(summaryModel({ ...blank, rest: "np" }));
    expect(answered).toMatch(/\nCurrent: present: None recorded\n/u);
  });

  // TW-198 (the sign dialog says one entry, as the page foot does, TW-202) is checked rendered in
  // ward-clinical-review-fixes-2.dom.test.tsx and ward-clinical-triage-wording.dom.test.tsx, as are the
  // banner's "Legal, chosen today", the earlier triage's "(as chosen)" and How to's saved fields.
  it("TW-26, TW-36, TW-52, TW-167, TW-178, TW-195 and TW-201 stay as D-186 left them", () => {
    const person = triagePersonFromWorld({
      patientId: "PT-SYN-187",
      name: "Ridgewell, Ada",
      age: "41",
      gender: "F",
      umrn: "UM900001",
      dob: "1985-02-03",
      origin: "Not recorded",
      legalStatus: "Community treatment order",
      recordAddress: "code900",
      openReferral: null,
    });
    expect(person.legalTag).toBe("On record · Not legally checked.");
    const state = exampleTriage();
    expect(foldLine(state, "dec").join(" · ")).toContain("Community treatment order (as chosen)");
    expect(summaryModel(state).keyLine).toContain("Community treatment order (as chosen)");
  });
});

describe("D-187 item 14 (Q36): the bed finder's Ward for", () => {
  const { units } = seedWardFlowState();
  const filters = (sex: BedFinderFilters["sex"]): BedFinderFilters => ({
    cohort: "Adult",
    bed: "any",
    sex,
    home: "any",
    legalStatus: "voluntary",
  });
  const listed = (sex: BedFinderFilters["sex"]) => findBeds(units, [], [], filters(sex), []).map((row) => row.unit.id);

  it("offers Any and every recorded gender (R7), in the app's own order", () => {
    expect(BED_FINDER_WARD_FOR.map((option) => option.value)).toEqual(["any", ...REFERRAL_GENDERS]);
    expect(BED_FINDER_WARD_FOR.map((option) => option.label)).toEqual([
      "Any",
      "Female",
      "Male",
      "Non-binary",
      "Different term",
    ]);
  });

  it("filters no ward for a gender beyond Female and Male, and shows the coordinator-review message", () => {
    for (const gender of ["Non-binary", "Different term"] as const) {
      expect(wardForNeedsReview(gender)).toBe(true);
      expect(listed(gender)).toEqual(listed("any"));
    }
    expect(BED_FINDER_GENDER_REVIEW.startsWith(GENDER_PLACEMENT_REFUSAL)).toBe(true);
  });

  it("keeps Female, Male and Any as today", () => {
    for (const sex of ["any", "Female", "Male"] as const) expect(wardForNeedsReview(sex)).toBe(false);
    for (const designation of ["Female only", "Male only", "Undesignated"] as const) {
      expect(wardForAccepts(designation, "any")).toBe(true);
      expect(wardForAccepts(designation, "Female")).toBe(sexDesignationAccepts(designation, "Female"));
      expect(wardForAccepts(designation, "Male")).toBe(sexDesignationAccepts(designation, "Male"));
    }
    const singleSex = units.some((unit) => unit.cohort === "Adult" && unit.sexDesignation !== "Undesignated");
    if (singleSex) expect(listed("Female").length).toBeLessThanOrEqual(listed("any").length);
  });
});
