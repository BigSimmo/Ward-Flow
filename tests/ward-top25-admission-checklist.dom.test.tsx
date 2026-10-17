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
    contrabandSearchDone: undefined,
    medicationChartDone: undefined,
    ...overrides,
  };
}

const states = (m: Movement) =>
  Object.fromEntries(admissionChecklist(m, []).map((item) => [item.key, item.state] as const));

describe("Top 25 item 14: admission arrival checklist", () => {
  it("ticks recorded facts including contraband search and medication chart when completed", () => {
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
      contrabandSearchDone: true,
      medicationChartDone: true,
    });
    expect(states(ready).medical_clearance).toBe("done");
    expect(states(ready).transport).toBe("done");
    expect(states(ready).contraband_search).toBe("done");
    expect(states(ready).medication_chart).toBe("done");
  });

  it("ignores local draft overrides when deriving recorded completion", () => {
    const items = admissionChecklist(movement({ legalStatus: "Voluntary" }), [], {
      contraband_search: true,
      medication_chart: true,
    });
    for (const key of ["contraband_search", "medication_chart"]) {
      expect(items.find((item) => item.key === key)).toMatchObject({ state: "not_wired", detail: NOT_WIRED });
    }
    const recorded = admissionChecklist(movement({ contrabandSearchDone: true, medicationChartDone: false }), [], {
      contraband_search: false,
      medication_chart: true,
    });
    expect(recorded.find((item) => item.key === "contraband_search")?.state).toBe("done");
    expect(recorded.find((item) => item.key === "medication_chart")?.state).toBe("outstanding");
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

  it("does not offer local completion controls for checks that cannot be recorded", () => {
    const { rerender } = render(
      <EdAdmissionChecklist movement={movement({ legalStatus: "Voluntary" })} referrals={[]} />,
    );
    const card = screen.getByTestId("ward-ed-admission-checklist");
    expect(within(card).getByText("Arrival checklist, 1 of 3 recorded")).toBeTruthy();
    expect(within(card).getAllByText(NOT_WIRED)).toHaveLength(2);
    expect(within(card).queryByRole("button", { name: /^Mark done: / })).toBeNull();
    expect(within(card).queryByText("Checked in ED")).toBeNull();
    expect(within(card).queryByText("Ready for ward")).toBeNull();

    rerender(
      <EdAdmissionChecklist
        movement={movement({ legalStatus: "Voluntary", contrabandSearchDone: true, medicationChartDone: true })}
        referrals={[]}
      />,
    );
    expect(within(card).getByText("Arrival checklist, 3 of 5 recorded")).toBeTruthy();
    expect(within(card).getByText("Checked in ED")).toBeTruthy();
    expect(within(card).getByText("Ready for ward")).toBeTruthy();
    expect(within(card).queryByText(NOT_WIRED)).toBeNull();
  });
});
