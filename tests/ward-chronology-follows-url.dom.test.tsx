import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PatientChronologyScreen } from "@/components/ward-management/reports/patient-chronology-screen";
import { patientIdsWithRecords } from "@/components/ward-management/reports/patient-chronology";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({ usePathname: () => "/mockups/ward-flow/reports/chronology" }));

describe("chronology follows the patient in the URL", () => {
  // #1010 Codex P2: an Activity link to another patient changes initialPatientId on the mounted screen.
  it("switches to the new initialPatientId without remounting", () => {
    const state = seedWardFlowState();
    const ids = patientIdsWithRecords(state.patients, state.movements, state.referrals, state.admissions);
    const [first, second] = state.patients.filter((person) => ids.has(person.id));
    if (!first || !second) throw new Error("need two patients with chronology records");
    const view = (id: string) => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientChronologyScreen initialPatientId={id} />
      </WardFlowProvider>
    );
    const { rerender } = render(view(first.id));
    const select = () => screen.getAllByRole("combobox").find((el) => el.tagName === "SELECT") as HTMLSelectElement;
    expect(select().value).toBe(first.id);
    rerender(view(second.id));
    expect(select().value).toBe(second.id);
  });
});
