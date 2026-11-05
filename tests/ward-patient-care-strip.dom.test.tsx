import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PatientCareJourneyStrip } from "@/components/ward-management/patients/patient-care-journey-strip";
import type { CareStep } from "@/components/ward-management/patients/patient-care-journey";

afterEach(() => cleanup());

const steps: CareStep[] = [
  { id: "start", label: "Referred", state: "done" },
  { id: "bed", label: "Bed agreed", state: "done" },
  { id: "moving", label: "Moving", state: "done" },
  { id: "ward", label: "On ward", state: "now", detail: "Day 7" },
  { id: "discharge", label: "Discharge", state: "next" },
  { id: "community", label: "Community", state: "next" },
];

describe("the patient care strip", () => {
  it('is named "Care steps" (Josh, 5 Nov 2026 20:51Z)', () => {
    render(<PatientCareJourneyStrip steps={steps} />);
    const list = screen.getByRole("list", { name: "Care steps" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(6);
    expect(screen.queryByRole("list", { name: "Movement steps" })).not.toBeInTheDocument();
  });
});
