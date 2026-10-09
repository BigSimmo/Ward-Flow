import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { legalFormGroupRows } from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { formTitleForCode } from "@/lib/form-register";

/**
 * F2 (P1), 2026-09-17 fix round. Antigravity's rebuild of Legal forms kept its layout and modals
 * (owner ruling: "keep and fix") but shipped four defects this file pins:
 *
 *  1. "Register Statutory Form" and "Confirm Re-Authorisation" changed nothing while showing a
 *     success toast — D4 requires an unconnected control to say exactly
 *     "Not wired in this prototype." and nothing else to claim an effect.
 *  2. Form titles ("Inpatient Treatment Order" for 3B, "Order Detaining Voluntary Patient" for
 *     3D, "Extension of Transport Order" for 4C) were hand-written and contradicted the Chief
 *     Psychiatrist register (`src/lib/form-register.ts`). Every title must now come from
 *     `legalFormName`/the register, never be typed by hand.
 *  3. Invented legal/governance text — the "Office of Chief Psychiatrist" badge, "WA Gazetted",
 *     "Custody orders", the "Re-authorisation required under MHA 2014 statutory governance"
 *     sentence, and prefilled clinician names ("Dr. A. Taylor", "Dr. K. Vance") — is gone.
 *  4. The all-clear caption on "Deadlines passed" used to read the unqualified "All orders in
 *     date"; it must now state what was counted.
 */
const NOW = NOW_ANCHOR;

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <LegalFormsScreen />
    </WardFlowProvider>,
  );
}

describe("Legal forms — unwired confirm controls (F2.1)", () => {
  it("both confirm buttons are aria-disabled, carry the exact D4 wording, and dispatch nothing", () => {
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: "Record a form" }));
    const registerConfirm = screen.getByTestId("ward-legal-forms-register-confirm");
    expect(registerConfirm).toHaveAttribute("aria-disabled", "true");
    expect(registerConfirm).not.toBeDisabled();
    expect(registerConfirm).toHaveAttribute("title", "Not wired in this prototype.");
    fireEvent.click(registerConfirm);
    expect(screen.queryByText("Statutory Form registered successfully in registry.")).not.toBeInTheDocument();
    expect(screen.getAllByText("Not wired in this prototype.").length).toBeGreaterThan(0);

    // Trigger the renew modal via a breached order if one exists on this fixture; otherwise open
    // it is unreachable and this half of the test would prove nothing — fail loudly instead.
    const rows = legalFormGroupRows(wardMovements, NOW, "with-deadline");
    const breached = rows.some((m) => m.legalForm?.dueAt !== undefined && m.legalForm.dueAt <= NOW);
    if (breached) {
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      // Forms (9 Oct 2026): extension is offered in the selected patient's panel.
      const target = rows.find((m) => m.legalForm?.dueAt !== undefined && m.legalForm.dueAt <= NOW)!;
      const row = document.querySelector(`[data-record-key="${target.id}"]`) as HTMLElement;
      fireEvent.click(row.querySelector("button")!);
      fireEvent.click(screen.getAllByRole("button", { name: "Extend recorded form" })[0]);
      const renewConfirm = screen.getByTestId("ward-legal-forms-renew-confirm");
      expect(renewConfirm).toHaveAttribute("aria-disabled", "true");
      expect(renewConfirm).not.toBeDisabled();
      expect(renewConfirm).toHaveAttribute("title", "Not wired in this prototype.");
      fireEvent.click(renewConfirm);
      expect(screen.queryByText(/re-authorised under MHA 2014/i)).not.toBeInTheDocument();
    }
  });
});

describe("Legal forms — titles come from the Chief Psychiatrist register (F2.2)", () => {
  it("never renders the hand-written titles this rebuild shipped", () => {
    renderScreen();
    expect(screen.queryByText(/Order Detaining Voluntary Patient/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Extension of Transport Order/)).not.toBeInTheDocument();
    expect(screen.queryByText("Custody orders")).not.toBeInTheDocument();
  });

  it("renders the real register titles for 1A, 3B, 3D, 4A and 4C in the authority catalogue", () => {
    renderScreen();
    // Forms (9 Oct 2026): the catalogue lives in the Requirements sheet.
    fireEvent.click(screen.getByRole("button", { name: "Requirements" }));
    for (const code of ["1A", "3B", "3D", "4A", "4C"]) {
      const title = formTitleForCode(code);
      expect(title, `form-register.ts no longer lists ${code}`).not.toBeNull();
      expect(screen.getAllByText(new RegExp(title as string)).length).toBeGreaterThan(0);
    }
  });

  it("builds the 'Record a form' picker options from the register too", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Record a form" }));
    const select = document.getElementById("legal-forms-new-instrument") as HTMLSelectElement;
    const optionText = Array.from(select.options).map((o) => o.textContent);
    expect(optionText.some((t) => t?.includes(formTitleForCode("3B") as string))).toBe(true);
    expect(optionText.some((t) => t?.includes(formTitleForCode("3D") as string))).toBe(true);
    expect(optionText.some((t) => t?.includes(formTitleForCode("4C") as string))).toBe(true);
  });
});

describe("Legal forms — invented legal/governance text removed (F2.3)", () => {
  it("carries none of the removed governance claims or prefilled clinician names", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Record a form" }));
    expect(screen.queryByText("Office of Chief Psychiatrist")).not.toBeInTheDocument();
    expect(screen.queryByText("WA Gazetted")).not.toBeInTheDocument();
    expect(screen.queryByText(/Re-authorisation required under MHA 2014 statutory governance/)).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Dr. A. Taylor (Consultant Psychiatrist)")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Dr. K. Vance (On-Call Consultant)")).not.toBeInTheDocument();
  });
});

describe("Legal forms — all-clear caption states a count (F2.4)", () => {
  it("never shows the unqualified 'All orders in date' — a passed count against a real denominator instead", () => {
    renderScreen();
    expect(screen.queryByText("All orders in date")).not.toBeInTheDocument();

    const withDeadline = legalFormGroupRows(wardMovements, NOW, "with-deadline");
    const passed = withDeadline.filter((m) => m.legalForm?.dueAt !== undefined && m.legalForm.dueAt <= NOW).length;
    const noDeadline = legalFormGroupRows(wardMovements, NOW, "no-deadline");

    if (passed === 0 && noDeadline.length === 0) {
      expect(screen.getByText(`0 of ${withDeadline.length} forms past their written due time`)).toBeInTheDocument();
    }
  });
});
