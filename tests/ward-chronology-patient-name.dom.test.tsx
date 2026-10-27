import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PatientChronologyScreen } from "@/components/ward-management/reports/patient-chronology-screen";
import { patientIdsWithRecords } from "@/components/ward-management/reports/patient-chronology";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { installMatchMediaStub } from "./setup/jsdom.setup";

vi.mock("next/navigation", () => ({ usePathname: () => "/mockups/ward-flow/reports/chronology" }));

afterEach(() => {
  localStorage.removeItem("ward-flow-discreet-names");
  installMatchMediaStub(false);
});

describe("chronology phone patient picker", () => {
  // D-83 (fresh audit W-9): names in full, and the removed Discreet names setting's old key changes nothing.
  it.each([true, false])("shows and announces the full name (old discreet key=%s)", (discreet) => {
    installMatchMediaStub(true);
    if (discreet) localStorage.setItem("ward-flow-discreet-names", "on");
    const state = seedWardFlowState();
    const ids = patientIdsWithRecords(state.patients, state.movements, state.referrals, state.admissions);
    const patient = state.patients.find((person) => ids.has(person.id));
    if (!patient) throw new Error("no patient with chronology records");
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientChronologyScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Choose a patient" }));
    const list = screen.getByRole("list", { name: "Patients" });
    const fullName = `${patient.familyName}, ${patient.givenName}`;
    const shown = fullName;
    const choice = within(list).getByRole("button", { name: shown });
    expect(choice).toHaveTextContent(shown);
    expect(choice).toHaveTextContent(patient.familyName);
    fireEvent.click(choice);
    expect(screen.queryByRole("list", { name: "Patients" })).not.toBeInTheDocument();
  });
});
