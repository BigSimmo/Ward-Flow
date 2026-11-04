import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PatientChronologyScreen } from "@/components/ward-management/reports/patient-chronology-screen";
import { patientIdsWithRecords } from "@/components/ward-management/reports/patient-chronology";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
vi.mock("next/navigation", () => ({ usePathname: () => "/ward-flow/reports/chronology" }));
describe("chronology subject changes", () => {
  it("resets an earlier event search when an Activity link selects another subject", () => {
    const state = seedWardFlowState();
    const ids = patientIdsWithRecords(state.patients, state.movements, state.referrals, state.admissions);
    const selected = state.patients.filter((p) => ids.has(p.id)).slice(0, 2);
    expect(selected).toHaveLength(2);
    const view = (id: string) => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientChronologyScreen initialPatientId={id} />
      </WardFlowProvider>
    );
    const { rerender } = render(view(selected[0]!.id));
    fireEvent.change(screen.getByLabelText("Find in events"), { target: { value: "synthetic-no-matching-event" } });
    expect(screen.getByLabelText("Find in events")).not.toHaveValue("");
    rerender(view(selected[1]!.id));
    expect(screen.getByLabelText("Find in events")).toHaveValue("");
  });
});
