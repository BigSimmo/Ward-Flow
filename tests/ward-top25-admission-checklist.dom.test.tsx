import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EdAdmissionChecklist } from "@/components/ward-management/ed/ed-admission-checklist";
import { NOT_WIRED, admissionChecklist } from "@/components/ward-management/ward-admission-checklist";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";

const seeded = seedWardFlowState();
const base = seeded.movements[0]!;

function movement(overrides: Partial<Movement>): Movement {
  return {
    ...base,
    referralId: undefined,
    medicalClearance: undefined,
    legalForm: undefined,
    legalFormReceivedAt: undefined,
    transport: undefined,
    transportNeed: undefined,
    ...overrides,
  };
}

const states = (m: Movement) =>
  Object.fromEntries(admissionChecklist(m, []).map((item) => [item.key, item.state] as const));

describe("Top 25 item 14: admission arrival checklist", () => {
  it("ticks only recorded facts and never ticks the unwired checks", () => {
    expect(states(movement({ legalStatus: "Voluntary" }))).toEqual({
      medical_clearance: "outstanding",
      legal_form: "done",
      transport: "outstanding",
      contraband_search: "not_wired",
      medication_chart: "not_wired",
    });
    const ready = movement({
      medicalClearance: { cleared: true, at: 10 } as Movement["medicalClearance"],
      transportNeed: { needed: false } as Movement["transportNeed"],
    });
    expect(states(ready).medical_clearance).toBe("done");
    expect(states(ready).transport).toBe("done");
  });

  it("asks for the legal form receipt when a form is on the record", () => {
    const form = { code: "1A" } as Movement["legalForm"];
    expect(states(movement({ legalForm: form })).legal_form).toBe("outstanding");
    expect(states(movement({ legalForm: form, legalFormReceivedAt: 5 })).legal_form).toBe("done");
  });

  it("flags a missing form when the legal status needs one", () => {
    const missing = admissionChecklist(movement({ legalStatus: "Involuntary inpatient" }), []).find(
      (item) => item.key === "legal_form",
    );
    expect(missing?.state).toBe("outstanding");
    expect(missing?.detail).toBe("Legal form not on this record");
  });

  it("renders the two unwired checks with the agreed wording", () => {
    render(<EdAdmissionChecklist movement={movement({ legalStatus: "Voluntary" })} referrals={[]} />);
    const card = screen.getByTestId("ward-ed-admission-checklist");
    expect(within(card).getByText("Arrival checklist, 1 of 3 recorded")).toBeTruthy();
    expect(within(card).getAllByText(NOT_WIRED)).toHaveLength(2);
    expect(NOT_WIRED).toBe("Not wired in this prototype.");
  });
});
