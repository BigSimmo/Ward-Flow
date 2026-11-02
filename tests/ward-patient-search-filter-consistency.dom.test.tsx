import "@testing-library/jest-dom/vitest";
import { cleanup, configure, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

configure({ getElementError: () => new Error("Patient filter query failed; record-bearing diagnostics suppressed.") });

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
});

describe("Patient census place search and structured filters", () => {
  it("keeps legitimate place matches and applies Department and Stage to them", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
      </WardFlowProvider>,
    );
    fireEvent.change(screen.getByLabelText("Find a person by name, UMRN or place"), {
      target: { value: "Armadale" },
    });
    // Synthetic movement WF-001 belongs to arm-ed. A place match is useful with no conflicting filter.
    expect(screen.queryByTestId("ward-patient-search-case-WF-001")).not.toBeNull();
    const department = screen.getByLabelText("Department");
    // The retained filter is outside Tab order, but neither hidden nor inert for assistive technology.
    expect(department).toHaveAttribute("tabindex", "-1");
    expect(department.closest("[inert], [hidden], [aria-hidden=true]")).toBeNull();
    fireEvent.change(department, { target: { value: "rph-ed" } });
    expect(screen.queryByTestId("ward-patient-search-case-WF-001")).toBeNull();
    fireEvent.change(department, { target: { value: "" } });
    expect(screen.queryByTestId("ward-patient-search-case-WF-001")).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Stage"), { target: { value: "moving" } });
    expect(screen.queryByTestId("ward-patient-search-case-WF-001")).toBeNull();
  });
});
