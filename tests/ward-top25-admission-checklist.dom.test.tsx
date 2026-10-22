import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EdAdmissionChecklist } from "@/components/ward-management/ed/ed-admission-checklist";
import { admissionChecklist } from "@/components/ward-management/ward-admission-checklist";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";

const raise = vi.fn();
vi.mock("@/components/ward-management/ward-flow-raise", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/ward-flow-raise")>()),
  useWardRaise: (role: string) => (type: string, fields: object) => raise({ ...fields, type, role }),
}));

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
      contraband_search: "outstanding",
      medication_chart: "outstanding",
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
      expect(items.find((item) => item.key === key)).toMatchObject({ state: "outstanding", detail: "Not recorded" });
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

  it("records the search and the chart through RECORD_ARRIVAL_CHECK and shows Done only from the record", () => {
    const pending = movement({ legalStatus: "Voluntary" });
    const { rerender } = render(<EdAdmissionChecklist movement={pending} referrals={[]} />);
    const card = screen.getByTestId("ward-ed-admission-checklist");
    expect(within(card).getByText("Arrival checklist, 1 of 5 recorded")).toBeTruthy();
    expect(within(card).queryByText(/not wired/i)).toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: "Record contraband search done" }));
    expect(raise).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RECORD_ARRIVAL_CHECK",
        role: "ed",
        movementId: pending.id,
        check: "contraband_search",
        done: true,
      }),
    );
    // The tap alone records nothing on screen.
    expect(within(card).queryByText("Checked in ED")).toBeNull();

    rerender(
      <EdAdmissionChecklist
        movement={movement({ legalStatus: "Voluntary", contrabandSearchDone: true, medicationChartDone: true })}
        referrals={[]}
      />,
    );
    expect(within(card).getByText("Arrival checklist, 3 of 5 recorded")).toBeTruthy();
    expect(within(card).getByText("Checked in ED")).toBeTruthy();
    expect(within(card).getByText("Ready for ward")).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Take back medication chart" })).toBeTruthy();
  });
});
