import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { isDetainedUnderTheAct, isUnderAForm } from "@/components/ward-management/ed/ed-home-derivations";
import { PatientLegalNowCard } from "@/components/ward-management/patients/patient-now-cards";
import { matchesLegal } from "@/components/ward-management/search/search-filters";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isDetained, isNotVoluntary } from "@/components/ward-management/ward-legal-meaning";
import type { LegalStatus, Movement } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { legalStatusTextIsInvoluntary } from "@/components/ward-management/ward-support-notifications";

/**
 * D-187 (Josh, 13 Nov 2026), the legal items of the clinical sign-off sitting's part 2. Item 1 (two
 * statuses), item 4's corridor half and item 16's Undo message are covered in
 * `ward-clinical-d187-legal.dom.test.tsx`. Synthetic seed data only.
 */
const seed = seedWardFlowState();
const ALL: readonly LegalStatus[] = [
  "Voluntary",
  "Referred for psychiatric examination",
  "Detained awaiting examination",
  "Involuntary inpatient",
];

function text(html: string): string {
  return html
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

describe("D-186 item 4 and D-187 item 3: two named legal rules", () => {
  it("isNotVoluntary: anything recorded that is not Voluntary, including a referral", () => {
    expect(isNotVoluntary("Voluntary")).toBe(false);
    expect(isNotVoluntary("Referred for psychiatric examination")).toBe(true);
    expect(isNotVoluntary("Detained awaiting examination")).toBe(true);
    expect(isNotVoluntary("Involuntary inpatient")).toBe(true);
    expect(isNotVoluntary("Community treatment order")).toBe(true);
    // Nothing recorded is not read as either.
    expect(isNotVoluntary(undefined)).toBe(false);
    expect(isNotVoluntary("")).toBe(false);
    expect(isNotVoluntary("Not recorded")).toBe(false);
  });

  it("isDetained: detained awaiting examination or involuntary, never a referral", () => {
    expect(isDetained("Voluntary")).toBe(false);
    expect(isDetained("Referred for psychiatric examination")).toBe(false);
    expect(isDetained("Detained awaiting examination")).toBe(true);
    expect(isDetained("Involuntary inpatient")).toBe(true);
    expect(isDetained("Involuntary patient (recorded)")).toBe(true);
    expect(isDetained("Community treatment order")).toBe(false);
    expect(isDetained(undefined)).toBe(false);
  });

  it("the detained counts and the support checklist read the same isDetained rule", () => {
    for (const status of ALL) {
      expect(isDetainedUnderTheAct(status), status).toBe(isDetained(status));
      expect(legalStatusTextIsInvoluntary(status), status).toBe(isDetained(status));
    }
    // "Under a form" still counts a referral only when a form is on record.
    expect(isUnderAForm({ legalStatus: "Referred for psychiatric examination", legalForm: undefined })).toBe(false);
    expect(isUnderAForm({ legalStatus: "Involuntary inpatient", legalForm: undefined })).toBe(true);
  });

  it("the Involuntary search filter leaves out people referred for psychiatric examination", () => {
    const base = seed.movements[0]!;
    const result = (legalStatus: LegalStatus) => ({ kind: "movement" as const, movement: { ...base, legalStatus } });
    expect(matchesLegal(result("Referred for psychiatric examination"), "Involuntary")).toBe(false);
    expect(matchesLegal(result("Detained awaiting examination"), "Involuntary")).toBe(true);
    expect(matchesLegal(result("Involuntary inpatient"), "Involuntary")).toBe(true);
    expect(matchesLegal(result("Voluntary"), "Involuntary")).toBe(false);
    expect(matchesLegal(result("Voluntary"), "Voluntary")).toBe(true);
    // A referred person is neither Voluntary nor Involuntary; "All" still finds them.
    expect(matchesLegal(result("Referred for psychiatric examination"), "Voluntary")).toBe(false);
    expect(matchesLegal(result("Referred for psychiatric examination"), "all")).toBe(true);
  });
});

describe("D-187 item 8 (Q29): a missing person shows only the recorded status and form", () => {
  const patient: Patient = { ...seed.patients[0]!, legalStatus: "Involuntary inpatient" };
  const card = (absent: boolean, who: Patient = patient, movement?: Movement) =>
    text(
      renderToStaticMarkup(
        createElement(PatientLegalNowCard, { patient: who, movement, absent, onAllForms: () => undefined }),
      ),
    );

  it("drops 'Order stays in force while absent' and keeps the recorded status", () => {
    const shown = card(true);
    expect(shown).toContain("Involuntary inpatient");
    expect(shown).toContain("As recorded");
    expect(shown).not.toContain("Order stays in force");
    expect(shown).not.toMatch(/while absent/u);
  });

  it("still shows a recorded form for a missing person", () => {
    const withForm = seed.movements.find((movement) => movement.legalForm !== undefined);
    expect(withForm, "the seed has a movement with a form").toBeDefined();
    const shown = card(true, patient, withForm);
    expect(shown).toContain(`Form ${withForm!.legalForm!.code}`);
    expect(shown).not.toContain("Order stays in force");
  });
});
