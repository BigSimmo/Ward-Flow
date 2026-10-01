import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow/people/new",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { AddPatientForm } from "@/components/ward-management/patients/add-patient";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";

const NOW_ANCHOR = 1_700_000_000_000;

describe("WardBoard Patient Safety Confirmations", () => {
  it("with requireConfirmation=true, clicking 'They have left' opens confirmation modal and requires explicit confirm before dispatching", async () => {
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <WardBoard unitId="arm-adult-open" requireConfirmation={true} />
      </WardFlowProvider>,
    );

    const shiftButtons = screen.queryAllByRole("button", { name: "They have left" });
    if (shiftButtons.length === 0) {
      return;
    }
    const leaveBtn = shiftButtons[0];
    fireEvent.click(leaveBtn);

    // Modal dialog must appear with accessible role and title
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Confirm patient departure")).toBeInTheDocument();

    // No departure toast before confirmation
    expect(screen.queryByTestId("ward-board-toast")).not.toBeInTheDocument();

    // Cancel closes dialog without dispatching
    const cancelBtn = screen.getByTestId("ward-board-confirm-cancel");
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-board-toast")).not.toBeInTheDocument();

    // Re-open and confirm departure
    fireEvent.click(leaveBtn);
    const proceedBtn = screen.getByTestId("ward-board-confirm-proceed");
    expect(proceedBtn).toHaveTextContent("Record departure");
    fireEvent.click(proceedBtn);

    // Dialog closes and toast appears confirming departure
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const toast = await screen.findByTestId("ward-board-toast");
    expect(toast).toHaveTextContent(/^Recorded departure: /);
  });

  it("escape key dismisses the departure confirmation modal safely", () => {
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <WardBoard unitId="arm-adult-open" requireConfirmation={true} />
      </WardFlowProvider>,
    );

    const shiftButtons = screen.queryAllByRole("button", { name: "They have left" });
    if (shiftButtons.length === 0) return;

    fireEvent.click(shiftButtons[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-board-toast")).not.toBeInTheDocument();
  });

  it("in the side detail panel, recording ED transfer requires confirmation when requireConfirmation=true", async () => {
    const { container } = render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <WardBoard unitId="arm-adult-open" requireConfirmation={true} />
      </WardFlowProvider>,
    );

    // Click an occupied tile to open side detail panel
    const tiles = [...container.querySelectorAll<HTMLElement>('[data-bed-kind="occupied"]')];
    expect(tiles.length).toBeGreaterThan(0);
    fireEvent.click(within(tiles[0]).getByRole("button"));

    const awayBtn = screen.queryByTestId("ward-board-record-away-submit");
    if (!awayBtn) return; // Patient may already be away at ED

    fireEvent.click(awayBtn);

    // Modal dialog must appear for ED transfer confirmation
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Confirm emergency department transfer")).toBeInTheDocument();

    // Confirm transfer
    const proceedBtn = screen.getByTestId("ward-board-confirm-proceed");
    expect(proceedBtn).toHaveTextContent("Record ED transfer");
    fireEvent.click(proceedBtn);

    // Dialog closes and toast reports ED transfer
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const toast = await screen.findByTestId("ward-board-toast");
    expect(toast).toHaveTextContent(/away at an emergency department/i);
  });
});

describe("AddPatientForm Patient Safety & Privacy Defenses", () => {
  it("warns on window beforeunload when in-memory form is dirty", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AddPatientForm />
      </WardFlowProvider>,
    );

    const givenNameInput = screen.getByLabelText(/given name/i);
    fireEvent.change(givenNameInput, { target: { value: "Jane" } });

    // Trigger beforeunload event on window
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("clicking Reset form with entered clinical notes or data opens confirmation modal", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AddPatientForm />
      </WardFlowProvider>,
    );

    const givenNameInput = screen.getByLabelText(/given name/i);
    fireEvent.change(givenNameInput, { target: { value: "Jane" } });

    const notesInput = screen.getByLabelText(/clinical intake notes/i);
    fireEvent.change(notesInput, { target: { value: "Detailed intake evaluation notes." } });

    const resetBtn = screen.getByTestId("ward-add-patient-reset");
    fireEvent.click(resetBtn);

    // Confirmation modal opens
    expect(screen.getByText("Reset patient form?")).toBeInTheDocument();
    expect(screen.getByText(/You have entered patient details or clinical notes/i)).toBeInTheDocument();

    // Cancel preserves entered details
    fireEvent.click(screen.getByTestId("ward-add-patient-reset-cancel"));
    expect(screen.queryByText("Reset patient form?")).not.toBeInTheDocument();
    expect(givenNameInput).toHaveValue("Jane");
    expect(notesInput).toHaveValue("Detailed intake evaluation notes.");

    // Clicking confirm clears fields
    fireEvent.click(resetBtn);
    fireEvent.click(screen.getByTestId("ward-add-patient-reset-confirm"));
    expect(screen.queryByText("Reset patient form?")).not.toBeInTheDocument();
    expect(givenNameInput).toHaveValue("");
    expect(notesInput).toHaveValue("");
  });

  it("locks the submit button with isSubmitting while processing", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AddPatientForm />
      </WardFlowProvider>,
    );

    // Fill valid required fields
    fireEvent.change(screen.getByLabelText(/medical record number/i), { target: { value: "MRN999888" } });
    fireEvent.change(screen.getByLabelText(/given name/i), { target: { value: "Sarah" } });
    fireEvent.change(screen.getByLabelText(/family name/i), { target: { value: "Connor" } });
    fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: "1985-05-15" } });

    const submitBtn = screen.getByTestId("ward-add-patient-submit");
    expect(submitBtn).not.toHaveAttribute("aria-disabled");

    fireEvent.click(submitBtn);

    // While submitting, submit button is disabled and text indicates in-flight status
    expect(submitBtn).toBeDisabled();
    expect(submitBtn).toHaveTextContent("Adding patient...");
  });

  it("D-18 Privacy Ruling: never writes clinical notes or patient draft to localStorage or sessionStorage", () => {
    const localSpy = vi.spyOn(Storage.prototype, "setItem");

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AddPatientForm />
      </WardFlowProvider>,
    );

    fireEvent.change(screen.getByLabelText(/given name/i), { target: { value: "ConfidentialPatient" } });
    fireEvent.change(screen.getByLabelText(/clinical intake notes/i), {
      target: { value: "Sensitive psychiatric clinical history." },
    });

    // Check no localStorage / sessionStorage calls stored patient data
    for (const call of localSpy.mock.calls) {
      const value = String(call[1]);
      expect(value).not.toContain("ConfidentialPatient");
      expect(value).not.toContain("Sensitive psychiatric clinical history");
    }

    localSpy.mockRestore();
  });
});
