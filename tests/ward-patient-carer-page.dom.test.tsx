import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  PatientCarerPageButton,
  PatientCarerPaper,
  patientCarerPageFor,
} from "@/components/ward-management/patient-carer-page";
import { PATIENT_CARER_NOT_RECORDED, PATIENT_CARER_TEXT } from "@/components/ward-management/patient-carer-page-text";
import { MOCK_NUMBER_PREFIX } from "@/components/ward-management/on-call/on-call-directory";
import { DESK_PERSONAS } from "@/components/ward-management/shell/ward-desk-personas";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

/** Words that would mean a health, risk or legal detail reached the page (synthetic seed only). */
const BLOCKED_WORDS = [
  "diagnos",
  "risk",
  "umrn",
  "form ",
  "mental health act",
  "involuntary",
  "voluntary",
  "detained",
  "inpatient",
  "observation",
  "aggress",
  "suicid",
  "self-harm",
  "abscond",
  "psychos",
  "schizo",
  "bipolar",
  "dr ",
];

const state = seedWardFlowState();
const accepted = state.movements.filter((movement) => patientCarerPageFor(movement, state.units) !== undefined);

function textOf(movement: (typeof accepted)[number]): string {
  const page = patientCarerPageFor(movement, state.units)!;
  const html = renderToStaticMarkup(<PatientCarerPaper page={page} />);
  return html
    .replace(/<style>[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

describe("patient and carer page (item 40)", () => {
  it("is offered on accepted, open movements only", () => {
    expect(accepted.length).toBeGreaterThan(0);
    for (const movement of state.movements) {
      const page = patientCarerPageFor(movement, state.units);
      if (movement.closure || !movement.acceptedUnitId || movement.stage === "arrived") expect(page).toBeUndefined();
    }
    const first = accepted[0]!;
    expect(patientCarerPageFor({ ...first, stage: "destination_review" }, state.units)).toBeUndefined();
    expect(patientCarerPageFor({ ...first, acceptedUnitId: undefined }, state.units)).toBeUndefined();
  });

  it("names the receiving ward, hospital and mock ward phone, and never invents an address or visiting hours", () => {
    for (const movement of accepted) {
      const unit = state.units.find((entry) => entry.id === movement.acceptedUnitId)!;
      const page = patientCarerPageFor(movement, state.units)!;
      expect(page.wardName).toBe(unit.name);
      expect(page.address).toBe(PATIENT_CARER_NOT_RECORDED);
      expect(page.visitingHours).toBe(PATIENT_CARER_NOT_RECORDED);
      expect(page.phone.startsWith(MOCK_NUMBER_PREFIX), page.phone).toBe(true);
      expect(textOf(movement)).toContain(page.phone);
      expect(textOf(movement)).toContain(unit.name);
    }
  });

  it("carries no diagnosis, risk, legal form, staff name, UMRN or patient name", () => {
    const staff = Object.values(DESK_PERSONAS).map((persona) => persona.name);
    for (const movement of accepted) {
      const text = textOf(movement);
      const lower = text.toLowerCase();
      for (const word of BLOCKED_WORDS) expect(lower, word).not.toContain(word);
      const patient = state.patients.find((entry) => entry.id === movement.patientId);
      const personal = [
        patient?.umrn,
        patient?.givenName,
        patient?.familyName,
        patient?.preferredName,
        patient?.dateOfBirth,
        movement.legalStatus,
        movement.legalForm?.code,
        movement.owner,
        ...staff,
      ].filter((value): value is string => typeof value === "string" && value.length > 1);
      for (const value of personal) expect(text, value).not.toContain(value);
    }
  });

  it("keeps the fixed words free of blocked details too, and marks them as draft wording", () => {
    const all = JSON.stringify(PATIENT_CARER_TEXT).toLowerCase();
    for (const word of BLOCKED_WORDS) expect(all, word).not.toContain(word);
    expect(textOf(accepted[0]!)).toContain("Draft wording: awaiting consumer, carer and cultural review.");
  });

  it("opens the page from the button, ready to print on A4", async () => {
    render(<PatientCarerPageButton movement={accepted[0]!} units={state.units} />);
    await userEvent.click(screen.getByRole("button", { name: PATIENT_CARER_TEXT.button }));
    const paper = screen.getByTestId("patient-carer-paper");
    // Its own isolation: the paper alone prints, never the patient page behind the dialog.
    expect(paper).toHaveAttribute("data-wf-print-carer");
    expect(paper.querySelector("style")?.textContent).toContain("size: A4 portrait");
    expect(screen.getByRole("button", { name: PATIENT_CARER_TEXT.printAction })).toBeInTheDocument();
  });
});
