// tests/ward-patient-glance-legal.dom.test.tsx
// PT1 review (PR #1382): a ward stay's typed expiry reaches the band. A1 (13 Nov 2026): arrival and
// the examination no longer end a form by themselves; only a recorded end does.
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PatientGlance } from "@/components/ward-management/patients/patient-glance";
import type { FormTimeLeft } from "@/components/ward-management/legal-forms/legal-form-time-left";
import type { Movement } from "@/components/ward-management/ward-model";

afterEach(cleanup);

function movement(overrides: Partial<Movement>): Movement {
  return {
    id: "ZZ-SYNTH-1",
    openedAt: 0,
    stage: "arrived",
    legalStatus: "Involuntary (referred)",
    legalForm: { code: "1A" },
    ...overrides,
  } as unknown as Movement;
}

describe("patient band legal fact", () => {
  // A1 and D-170 item 1 (Josh, 13 Nov 2026): the form shows as recorded until a person records that it
  // ended, and the next form is "Next form to record", with no form number.
  it("keeps a form as recorded at arrival, with the next form to record and no number", () => {
    render(<PatientGlance mode="ward" movement={movement({ closure: { outcome: "arrived" } } as Partial<Movement>)} />);
    const legal = screen.getByTestId("ward-patient-glance-legal");
    expect(legal).toHaveTextContent("On Form 1A at arrival");
    expect(legal).toHaveTextContent("Next form to record");
    expect(legal).not.toHaveTextContent(/ended|Form 6A/u);
  });

  it("keeps a form as recorded at the examination, never ended by it", () => {
    render(
      <PatientGlance
        mode="find"
        movement={movement({ stage: "moving", examination: { outcome: "inpatient_order" } } as Partial<Movement>)}
      />,
    );
    expect(screen.getByTestId("ward-patient-glance-legal")).toHaveTextContent("On Form 1A at the examination");
  });

  it("shows the typed expiry it is given for a form still in force", () => {
    const left = { code: "Form 6A", text: "Ends 15:42 as typed", at: "15:42", standing: "later", tone: "neutral" };
    render(
      <PatientGlance
        mode="ward"
        movement={movement({ legalForm: { code: "6A" } } as Partial<Movement>)}
        formTimeLeft={left as unknown as FormTimeLeft}
      />,
    );
    expect(screen.getByTestId("ward-patient-glance-legal")).toHaveTextContent("Form 6A · Ends 15:42 as typed");
  });
});
