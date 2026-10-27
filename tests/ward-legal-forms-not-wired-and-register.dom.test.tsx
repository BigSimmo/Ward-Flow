import { useEffect } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { ExtendSheet } from "@/components/ward-management/legal-forms/legal-forms-sheets";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { legalFormGroupRows } from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { perthMidnight } from "@/components/ward-management/ward-clock";
import { dateInputFor } from "./helpers/ward-date-input";
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

let screenDayZero: Date;
function ReadDayZero() {
  const { dayZero } = useWardFlow();
  useEffect(() => {
    screenDayZero = dayZero;
  }, [dayZero]);
  return null;
}

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <ReadDayZero />
      <LegalFormsScreen />
    </WardFlowProvider>,
  );
}

describe("Legal forms — wired confirm controls (F2.1)", () => {
  it("gates both confirm buttons until required fields are provided, then dispatches and closes", () => {
    renderScreen();

    fireEvent.click(screen.getByRole("button", { name: "Record a form" }));
    const registerConfirm = screen.getByTestId("ward-legal-forms-register-confirm");
    expect(registerConfirm).toHaveAttribute("aria-disabled", "true");
    expect(registerConfirm).not.toBeDisabled();
    expect(registerConfirm).toHaveAttribute("title", "Choose a movement first.");
    fireEvent.click(registerConfirm);
    expect(screen.queryByText("Statutory Form registered successfully in registry.")).not.toBeInTheDocument();

    const movementSelect = screen.getByLabelText("Movement") as HTMLSelectElement;
    const firstOption = Array.from(movementSelect.options).find((opt) => opt.value !== "");
    expect(firstOption).toBeDefined();
    fireEvent.change(movementSelect, { target: { value: firstOption!.value } });
    // The form type opens blank (MHA forms are never prefilled) and is chosen from the paper.
    expect(screen.getByTestId("ward-legal-forms-register-confirm")).toHaveAttribute(
      "title",
      "Choose a form type first.",
    );
    const typeSelect = screen.getByLabelText("Form type") as HTMLSelectElement;
    expect(typeSelect).toHaveValue("");
    fireEvent.change(typeSelect, {
      target: { value: Array.from(typeSelect.options).find((o) => o.value !== "")!.value },
    });
    // A blank, malformed or future time is refused rather than replaced with the save moment.
    const timeInput = screen.getByLabelText("Time on form") as HTMLInputElement;
    const timeBlockedConfirm = screen.getByTestId("ward-legal-forms-register-confirm");
    expect(timeBlockedConfirm).toHaveAttribute("aria-disabled", "true");
    expect(timeBlockedConfirm).toHaveAttribute(
      "title",
      "Enter the time written on the form as HH:MM, no later than now.",
    );
    // "0930" now reads as 09:30 (the iPhone number pad has no colon); three digits are still refused.
    for (const bad of ["25:00", "093", "23:59"]) {
      fireEvent.change(timeInput, { target: { value: bad } });
      expect(screen.getByTestId("ward-legal-forms-register-confirm")).toHaveAttribute("aria-disabled", "true");
    }
    fireEvent.change(timeInput, { target: { value: "00:00" } });
    const enabledRegisterConfirm = screen.getByTestId("ward-legal-forms-register-confirm");
    expect(enabledRegisterConfirm).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.click(enabledRegisterConfirm);
    expect(screen.queryByTestId("ward-legal-record")).not.toBeInTheDocument();

    // Trigger the renew modal via a breached order if one exists on this fixture; otherwise open
    // it is unreachable and this half of the test would prove nothing — fail loudly instead.
    const rows = legalFormGroupRows(wardMovements, NOW, "with-deadline");
    const breached = rows.some((m) => m.legalForm?.dueAt !== undefined && m.legalForm.dueAt <= NOW);
    if (breached) {
      // Forms (9 Oct 2026): extension is offered in the selected patient's panel.
      const target = rows.find((m) => m.legalForm?.dueAt !== undefined && m.legalForm.dueAt <= NOW)!;
      const row = document.querySelector(`[data-record-key="${target.id}"]`) as HTMLElement;
      fireEvent.click(row.querySelector("button")!);
      fireEvent.click(screen.getAllByRole("button", { name: "Extend recorded form" })[0]);
      const renewConfirm = screen.getByTestId("ward-legal-forms-renew-confirm");
      expect(renewConfirm).toHaveAttribute("aria-disabled", "true");
      expect(renewConfirm).not.toBeDisabled();
      expect(renewConfirm).toHaveAttribute("title", "Enter the new expiry date and time written on the form.");
      fireEvent.click(renewConfirm);
      expect(screen.queryByText(/re-authorised under MHA 2014/i)).not.toBeInTheDocument();

      const expiryInput = screen.getByTestId("ward-legal-forms-renew-expiry");
      fireEvent.change(expiryInput, { target: { value: "23:30" } });
      // Audit CS3-05: a time alone is not enough; the date written on the form is compulsory.
      expect(screen.getByTestId("ward-legal-forms-renew-confirm")).toHaveAttribute("aria-disabled", "true");
      fireEvent.change(screen.getByTestId("ward-legal-forms-renew-date"), {
        target: { value: dateInputFor(NOW, screenDayZero) },
      });
      const enabledRenewConfirm = screen.getByTestId("ward-legal-forms-renew-confirm");
      expect(enabledRenewConfirm).not.toHaveAttribute("aria-disabled", "true");
      fireEvent.click(enabledRenewConfirm);
      expect(screen.queryByTestId("ward-legal-extend")).not.toBeInTheDocument();
    }
  });
});

describe("Legal forms — extension shows the day it will record", () => {
  const dayZero = perthMidnight(2026, 9, 24);
  const base = wardMovements.find((m) => m.legalForm !== undefined)!;
  const dueAt = NOW + 60;
  const target = { ...base, legalForm: { ...base.legalForm!, dueAt } };
  function renderSheet() {
    render(
      <ExtendSheet
        target={target}
        label="Synthetic movement"
        now={NOW}
        dayZero={dayZero}
        onClose={() => {}}
        onExtendForm={() => false}
      />,
    );
  }

  it("needs the date as well as the time, and never guesses the day (audit CS3-05)", () => {
    renderSheet();
    fireEvent.change(screen.getByTestId("ward-legal-forms-renew-expiry"), {
      target: { value: formatInstant(dueAt - 30) },
    });
    expect(screen.queryByTestId("ward-legal-forms-renew-resolved")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-legal-forms-renew-confirm")).toHaveAttribute(
      "title",
      "Enter the new expiry date and time written on the form.",
    );
  });

  it("names the resolved day before Confirm", () => {
    renderSheet();
    const later = formatInstant(dueAt + 30);
    fireEvent.change(screen.getByTestId("ward-legal-forms-renew-date"), {
      target: { value: dateInputFor(NOW + 1440, dayZero) },
    });
    fireEvent.change(screen.getByTestId("ward-legal-forms-renew-expiry"), { target: { value: later } });
    expect(screen.getByTestId("ward-legal-forms-renew-resolved")).toHaveTextContent(
      `Records the new expiry as ${later} tomorrow.`,
    );
  });

  it("says so when the new expiry is earlier than the one recorded (audit TC2-03)", () => {
    renderSheet();
    const earlier = formatInstant(dueAt - 30);
    fireEvent.change(screen.getByTestId("ward-legal-forms-renew-date"), {
      target: { value: dateInputFor(NOW, dayZero) },
    });
    fireEvent.change(screen.getByTestId("ward-legal-forms-renew-expiry"), { target: { value: earlier } });
    expect(screen.getByTestId("ward-legal-forms-renew-resolved")).toHaveTextContent(
      /This is earlier than the expiry already recorded .*Check the form\./,
    );
    expect(screen.getByTestId("ward-legal-forms-renew-confirm")).not.toHaveAttribute("aria-disabled", "true");
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
    // Forms (9 Oct 2026): the catalogue lives in the Requirements sheet. D-77 change 5: desktop opens it
    // from the chosen patient's form, since the strip with the Requirements link is phone-only.
    const row = document.querySelector("[data-record-key]") as HTMLElement;
    fireEvent.click(within(row).getAllByRole("button")[0]!);
    fireEvent.click(within(screen.getByTestId("ward-legal-selected")).getByRole("button", { name: /^Form \w+$/ }));
    for (const code of ["1A", "3B", "3D", "4A", "4C"]) {
      const title = formTitleForCode(code);
      expect(title, `form-register.ts no longer lists ${code}`).not.toBeNull();
      expect(screen.getAllByText(new RegExp(title as string)).length).toBeGreaterThan(0);
    }
  });

  it("builds the 'Record a form' picker options from the register too", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: "Record a form" }));
    const select = screen.getByLabelText("Form type") as HTMLSelectElement;
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
