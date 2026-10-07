import { beforeEach, describe, expect, it, vi } from "vitest";
import React, { type ReactNode } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/referrals/new",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ReferralIntakeForm } from "@/components/ward-management/referrals/referral-intake";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardPatients as seedPatients } from "@/components/ward-management/ward-patients-seed";
import type { Patient } from "@/components/ward-management/ward-patients";

function LastDispatchedEvent() {
  const { rejections, referrals, patients } = useWardFlow();
  const newest = referrals[referrals.length - 1];
  return (
    <div>
      <span data-testid="test-patient-count">{patients.length}</span>
      <span data-testid="test-newest-referral-patient-id">{newest?.patientId ?? "none"}</span>
      <span data-testid="test-rejection-count">{rejections.length}</span>
    </div>
  );
}

function renderIntake(initialNow = NOW_ANCHOR) {
  return render(
    <WardFlowProvider initialNow={initialNow}>
      <ReferralIntakeForm />
      <LastDispatchedEvent />
    </WardFlowProvider>,
  );
}

describe("ReferralIntakeForm — Third Edition Sovereign Person & Rapid Search", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/mockups/ward-flow/referrals/new");
  });

  it("renders the Sovereign Person header strip with mode switches and rapid search", () => {
    renderIntake();

    expect(screen.getByRole("heading", { name: "The person" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Linked record" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Unlinked intake" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Add new patient" })).toBeDefined();

    const searchInput = screen.getByTestId("ward-referral-patient-search") as HTMLInputElement;
    expect(searchInput).toBeDefined();
    expect(searchInput.placeholder).toContain("Search or link a patient");
  });

  it("rapid search filters patients by name and UMRN, and selecting a patient links them", async () => {
    renderIntake();

    const searchInput = screen.getByTestId("ward-referral-patient-search") as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "Talia" } });

    // Dropdown should be open with search results
    const dropdown = screen.getByRole("listbox");
    expect(dropdown).toBeDefined();
    expect(screen.getByText("Talia Halloway")).toBeDefined();
    expect(screen.getByText("UM100001")).toBeDefined();

    // Click to select Talia
    const option = screen.getByText("Talia Halloway").closest("button");
    expect(option).not.toBeNull();
    fireEvent.click(option!);

    // Sovereign Person Card should now show Talia Halloway as linked
    expect(screen.getByText("Talia Halloway")).toBeDefined();
    expect(screen.getAllByText("UM100001").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Adult cohort/)).toBeDefined();
    expect(screen.getByText(/Duplicate check/)).toBeDefined();
  });

  it("switching between Linked record and Unlinked intake updates the card state", () => {
    renderIntake();

    // Select a patient first
    const searchInput = screen.getByTestId("ward-referral-patient-search");
    fireEvent.change(searchInput, { target: { value: "Marcus" } });
    const option = screen.getByText("Marcus Hallowin").closest("button");
    fireEvent.click(option!);

    expect(screen.getByText("Marcus Hallowin")).toBeDefined();

    // Click Unlinked intake
    const unlinkedBtn = screen.getByRole("button", { name: "Unlinked intake" });
    fireEvent.click(unlinkedBtn);

    // Should now show unlinked card state
    expect(screen.getByText("No patient record linked")).toBeDefined();
    expect(screen.getByText("UNLINKED INTAKE")).toBeDefined();

    // Click Linked record — should focus search input
    const linkedBtn = screen.getByRole("button", { name: "Linked record" });
    fireEvent.click(linkedBtn);
    expect(document.activeElement).toBe(searchInput);
  });

  it("opens quick Add Patient modal, validates inputs, and closes on Escape with focus restored", async () => {
    renderIntake();

    const addBtn = screen.getByRole("button", { name: "Add new patient" });
    fireEvent.click(addBtn);

    // Modal should be visible
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Register new patient" })).toBeDefined();

    // Test Escape key dismissal and focus restoration
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(addBtn);
  });

  it("adds a new patient via modal, auto-links them to the referral, and updates patient count", async () => {
    renderIntake();

    const initialCount = Number(screen.getByTestId("test-patient-count").textContent);

    const addBtn = screen.getByRole("button", { name: "Add new patient" });
    fireEvent.click(addBtn);

    // Fill new patient form
    fireEvent.change(screen.getByLabelText(/Given name/), { target: { value: "Alistair" } });
    fireEvent.change(screen.getByLabelText(/Family name/), { target: { value: "Montgomery" } });
    fireEvent.change(screen.getByLabelText(/UMRN/), { target: { value: "UM999001" } });
    fireEvent.change(screen.getByLabelText(/Date of birth/), { target: { value: "1985-04-12" } });

    // Submit
    const submitBtn = screen.getByRole("button", { name: "Register & link patient" });
    fireEvent.click(submitBtn);

    // Modal should close
    expect(screen.queryByRole("dialog")).toBeNull();

    // Sovereign Person Card should now show the new patient linked
    await waitFor(() => {
      expect(screen.getByText("Alistair Montgomery")).toBeDefined();
      expect(screen.getByText("UM999001")).toBeDefined();
      expect(Number(screen.getByTestId("test-patient-count").textContent)).toBe(initialCount + 1);
    });
  });

  it("displays interpreter required badge and clinical warning when patient requires interpreter", () => {
    renderIntake();

    // Find a seed patient with interpreter requirement
    const caldPatient = seedPatients.find(
      (p: Patient) =>
        p.interpreterLanguage &&
        !p.interpreterLanguage.toLowerCase().includes("no interpreter required") &&
        !p.interpreterLanguage.toLowerCase().startsWith("english"),
    );
    expect(caldPatient).toBeDefined();

    const searchInput = screen.getByTestId("ward-referral-patient-search");
    const fullName = `${caldPatient!.givenName} ${caldPatient!.familyName}`;
    fireEvent.change(searchInput, { target: { value: fullName } });

    const option = screen.getByText(fullName, { exact: false }).closest("button");
    fireEvent.click(option!);

    // Interpreter badge and alert should be rendered
    expect(screen.getByTestId("ward-referral-intake-interpreter-badge")).toBeDefined();
    expect(screen.getByTestId("ward-referral-intake-interpreter-alert")).toBeDefined();
    expect(screen.getByText(/Professional Interpreter Required/)).toBeDefined();
  });

  it("renders 'View profile' link to person detail route when patient is linked", () => {
    renderIntake();

    const searchInput = screen.getByTestId("ward-referral-patient-search");
    fireEvent.change(searchInput, { target: { value: "Talia" } });
    const option = screen.getByText("Talia Halloway").closest("button");
    fireEvent.click(option!);

    const profileLink = screen.getByTestId("ward-referral-intake-view-profile");
    expect(profileLink).toBeDefined();
    expect(profileLink.getAttribute("href")).toBe("/mockups/ward-flow/people/PT-001");
    expect(profileLink.getAttribute("target")).toBe("_blank");
  });

  it("clears search query and closes dropdown when Escape is pressed", () => {
    renderIntake();

    const searchInput = screen.getByTestId("ward-referral-patient-search");
    fireEvent.change(searchInput, { target: { value: "Marcus" } });
    expect(searchInput).toHaveValue("Marcus");

    fireEvent.keyDown(searchInput, { key: "Escape" });
    expect(searchInput).toHaveValue("");
  });

  it("sets suburb to 'not_known' via 1-click quick action button", () => {
    renderIntake();

    const suburbSelect = screen.getByTestId("ward-referral-intake-suburb") as HTMLSelectElement;
    expect(suburbSelect.value).toBe("not-answered");

    const quickBtn = screen.getByTestId("ward-referral-intake-suburb-quick-unknown");
    fireEvent.click(quickBtn);

    expect(suburbSelect.value).toBe("not_known");
    expect(quickBtn.getAttribute("data-active")).toBe("true");
  });

  it("handles duplicate UMRN rejection by displaying error, preserving typed inputs, and not leaking pendingAddPatientRef", async () => {
    renderIntake();
    const initialCount = Number(screen.getByTestId("test-patient-count").textContent);

    const addBtn = screen.getByRole("button", { name: "Add new patient" });
    fireEvent.click(addBtn);

    // Type patient with duplicate UMRN (UM100001 belongs to Talia Halloway)
    fireEvent.change(screen.getByLabelText(/Given name/), { target: { value: "Alistair" } });
    fireEvent.change(screen.getByLabelText(/Family name/), { target: { value: "Montgomery" } });
    fireEvent.change(screen.getByLabelText(/UMRN/), { target: { value: "UM100001" } });
    fireEvent.change(screen.getByLabelText(/Date of birth/), { target: { value: "1985-04-12" } });

    // Submit invalid colliding UMRN
    const submitBtn = screen.getByRole("button", { name: "Register & link patient" });
    fireEvent.click(submitBtn);

    // Modal must NOT close and error must be displayed
    expect(screen.getByRole("dialog")).toBeDefined();
    const errorAlert = await screen.findByTestId("ward-referral-intake-add-patient-error");
    expect(errorAlert.textContent).toMatch(/UMRN collision/i);

    // Typed inputs must be preserved in the modal
    expect(screen.getByLabelText(/Given name/)).toHaveValue("Alistair");
    expect(screen.getByLabelText(/Family name/)).toHaveValue("Montgomery");
    expect(screen.getByLabelText(/UMRN/)).toHaveValue("UM100001");
    expect(screen.getByLabelText(/Date of birth/)).toHaveValue("1985-04-12");

    // Correct the UMRN to a unique one — verify pendingAddPatientRef was reset and does not leak
    fireEvent.change(screen.getByLabelText(/UMRN/), { target: { value: "UM999002" } });
    fireEvent.click(submitBtn);

    // Modal closes and new patient is linked
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.getByText("Alistair Montgomery")).toBeDefined();
      expect(screen.getByText("UM999002")).toBeDefined();
      expect(Number(screen.getByTestId("test-patient-count").textContent)).toBe(initialCount + 1);
    });
  });

  it("offers 'Import Existing Record' button on collision and links existing patient without dispatching ADD_PATIENT", async () => {
    renderIntake();
    const initialCount = Number(screen.getByTestId("test-patient-count").textContent);

    const addBtn = screen.getByRole("button", { name: "Add new patient" });
    fireEvent.click(addBtn);

    // Type colliding UMRN
    fireEvent.change(screen.getByLabelText(/UMRN/), { target: { value: "UM100001" } });

    const importBtn = await screen.findByTestId("ward-referral-intake-import-existing-patient");
    expect(importBtn.textContent).toBe("Import Existing Record");

    fireEvent.click(importBtn);

    // Modal closes, Talia Halloway is linked, and no new patient was created
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Talia Halloway")).toBeDefined();
    expect(screen.getAllByText("UM100001").length).toBeGreaterThanOrEqual(1);
    expect(Number(screen.getByTestId("test-patient-count").textContent)).toBe(initialCount);
  });
});
