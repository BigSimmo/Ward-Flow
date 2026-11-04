// tests/ward-patient-glance-legal.dom.test.tsx
// PT1 review (PR #1382): the band never shows a form as in force once arrival or the examination
// ended it, and a ward stay's typed expiry reaches the band.
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
  it("names a form that ended at arrival as ended, with Form 6A to record", () => {
    render(<PatientGlance mode="ward" movement={movement({ closure: { outcome: "arrived" } } as Partial<Movement>)} />);
    const legal = screen.getByTestId("ward-patient-glance-legal");
    expect(legal).toHaveTextContent("Form 1A ended at arrival");
    expect(legal).toHaveTextContent("Form 6A to record");
    expect(legal).not.toHaveTextContent("in force");
  });

  it("names a form that ended at the examination as ended", () => {
    render(
      <PatientGlance
        mode="find"
        movement={movement({ stage: "moving", examination: { outcome: "inpatient_order" } } as Partial<Movement>)}
      />,
    );
    expect(screen.getByTestId("ward-patient-glance-legal")).toHaveTextContent("Form 1A ended at the examination");
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
