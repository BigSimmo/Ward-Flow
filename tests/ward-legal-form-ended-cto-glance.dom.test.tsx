// Review follow-up (12 Nov 2026): the patient band names an arrived Form 5A or 5B that was then
// recorded as ended as ended, never "On Form 5A at arrival". Synthetic record only.
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PatientGlance } from "@/components/ward-management/patients/patient-glance";
import type { Movement } from "@/components/ward-management/ward-model";

afterEach(cleanup);

describe("patient band, an ended community treatment order after arrival", () => {
  it("says the form was recorded as ended", () => {
    const movement = {
      id: "ZZ-SYNTH-CTO",
      openedAt: 0,
      stage: "arrived",
      legalStatus: "Involuntary inpatient",
      legalForm: { code: "5A", endedBy: "revoked" },
      closure: { outcome: "arrived" },
    } as unknown as Movement;
    render(<PatientGlance mode="ward" movement={movement} />);
    const legal = screen.getByTestId("ward-patient-glance-legal");
    expect(legal).toHaveTextContent("Form 5A recorded as ended");
    expect(legal).not.toHaveTextContent("On Form 5A at arrival");
    expect(legal).not.toHaveTextContent("in force");
  });
});
