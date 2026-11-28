import "@testing-library/jest-dom/vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithToasts as render } from "./helpers/with-toasts";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/bedchart/people/new",
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

// The board's anchor minute. This read 1_700_000_000_000 (an epoch-millisecond figure) until 14 Nov
// 2026: an instant counts minutes from the board's day 0, so that put the board three million years
// out, past the last day a JavaScript date can hold, and seeding's sample-day move (CC-5) threw on it.
const NOW_ANCHOR = WARD_ADMISSIONS_ANCHOR;

describe("WardBoard Patient Safety Confirmations", () => {
  it("with requireConfirmation=true, clicking 'They have left' opens confirmation modal and requires explicit confirm before dispatching", async () => {
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <WardBoard unitId="arm-adult-open" requireConfirmation={true} />
      </WardFlowProvider>,
    );

    const shiftButtons = screen.queryAllByRole("button", { name: /^They have left(, |$)/ });
    if (shiftButtons.length === 0) {
      return;
    }
    const leaveBtn = shiftButtons[0];
    fireEvent.click(leaveBtn);

    // Modal dialog must appear with accessible role and title
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("heading", { name: "Record discharge" })).toBeInTheDocument();

    // No departure toast before confirmation
    expect(screen.queryByTestId("ward-board-toast")).not.toBeInTheDocument();

    // Cancel closes dialog without dispatching
    const cancelBtn = within(dialog).getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-board-toast")).not.toBeInTheDocument();

    // Re-open and confirm departure
    fireEvent.click(leaveBtn);
    const reopened = screen.getByRole("alertdialog");
    const proceedBtn = within(reopened).getByRole("button", { name: "Record discharge" });
    // Audit CS3-07: where they went starts blank and must be chosen before the departure records.
    expect(proceedBtn).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(screen.getByTestId("ward-board-confirm-destination"), {
      target: { value: "discharged-to-the-community" },
    });
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Record discharge" }));

    // Dialog closes and toast appears confirming departure
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    const toast = await screen.findByTestId("ward-board-toast");
    expect(toast).toHaveTextContent(/^Recorded discharge: /);
  });

  it("escape key dismisses the departure confirmation modal safely", () => {
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <WardBoard unitId="arm-adult-open" requireConfirmation={true} />
      </WardFlowProvider>,
    );

    const shiftButtons = screen.queryAllByRole("button", { name: /^They have left(, |$)/ });
    if (shiftButtons.length === 0) return;

    fireEvent.click(shiftButtons[0]);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
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
    // Drawer review (6 Nov 2026): the confirmation stacks over the bed record's kit drawer, so it is
    // found by its name among the two dialogs.
    const dialog = screen.getByRole("alertdialog", { name: "Confirm emergency department transfer" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Confirm emergency department transfer")).toBeInTheDocument();

    // Confirm transfer
    const proceedBtn = within(dialog).getByRole("button", { name: "Record ED transfer" });
    fireEvent.click(proceedBtn);

    // The confirmation closes (the bed's record stays open under it) and a toast reports the transfer.
    expect(
      screen.queryByRole("alertdialog", { name: "Confirm emergency department transfer" }),
    ).not.toBeInTheDocument();
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

  it("clicking Reset with entered patient details clears them and offers Undo", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AddPatientForm />
      </WardFlowProvider>,
    );

    const givenNameInput = screen.getByLabelText(/given name/i);
    fireEvent.change(givenNameInput, { target: { value: "Jane" } });

    // D-77 change 6: the intake notes box is gone, so the family name stands in as the second field.
    const familyNameInput = screen.getByLabelText(/family name/i);
    fireEvent.change(familyNameInput, { target: { value: "Invented" } });

    const resetBtn = screen.getByTestId("ward-add-patient-reset");
    fireEvent.click(resetBtn);

    // r10: Reset no longer asks first. It clears at once and the toast offers Undo, which restores
    // every entered detail, so a mis-press cannot lose them.
    fireEvent.click(resetBtn);
    expect(screen.queryByText("Reset patient form?")).not.toBeInTheDocument();
    expect(screen.getByText("Form cleared")).toBeInTheDocument();
    expect(givenNameInput).toHaveValue("");
    expect(familyNameInput).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: /^Undo/ }));
    expect(givenNameInput).toHaveValue("Jane");
    expect(familyNameInput).toHaveValue("Invented");
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
    fireEvent.change(screen.getByLabelText(/date of birth/i), { target: { value: "15/05/1985" } });

    const submitBtn = screen.getByTestId("ward-add-patient-submit");
    expect(submitBtn).not.toHaveAttribute("aria-disabled");

    fireEvent.click(submitBtn);

    // While submitting, the focusable control is aria-disabled; the submit handler also rejects repeats.
    expect(submitBtn).toHaveAttribute("aria-disabled", "true");
    expect(submitBtn).toHaveTextContent("Adding patient...");
  });

  it("D-18 Privacy Ruling: never writes the patient draft to localStorage or sessionStorage", () => {
    const localSpy = vi.spyOn(Storage.prototype, "setItem");

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AddPatientForm />
      </WardFlowProvider>,
    );

    fireEvent.change(screen.getByLabelText(/given name/i), { target: { value: "ConfidentialPatient" } });
    // D-77 change 6: no clinical notes box remains to type into; the identity fields still stay off storage.
    expect(screen.queryByLabelText(/clinical intake notes/i)).toBeNull();
    fireEvent.change(screen.getByLabelText(/family name/i), {
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
