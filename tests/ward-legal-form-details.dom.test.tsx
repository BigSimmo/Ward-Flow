import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LegalFormDetailsSection } from "@/components/ward-management/legal-forms/legal-form-details";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

const DAY_ZERO = new Date("2026-09-23T00:00:00");

/**
 * Gap list items 3 to 7 (4 Nov 2026), review on #1398: a review date that will not read is an
 * error, never a blank that clears the recorded date. Synthetic seed only.
 */
describe("From the paper details", () => {
  it("refuses to save an unreadable review date instead of clearing it", () => {
    const base = seedWardFlowState().movements.find((movement) => movement.legalForm !== undefined)!;
    const movement = { ...base, legalForm: { ...base.legalForm!, reviewBy: 1440 } };
    const onSave = vi.fn();
    render(<LegalFormDetailsSection movement={movement} dayZero={DAY_ZERO} onSave={onSave} />);
    fireEvent.click(screen.getByTestId("ward-legal-form-details-edit"));
    const section = screen.getByTestId("ward-legal-form-details");
    const date = within(section).getByLabelText(/Review by/);
    fireEvent.input(date, { target: { value: "31/02/2026" } });
    fireEvent.change(date, { target: { value: "31/02/2026" } });
    fireEvent.click(screen.getByTestId("ward-legal-form-details-save"));
    expect(onSave).not.toHaveBeenCalled();
    expect(within(section).getAllByText("Type the review date as DD/MM/YYYY").length).toBeGreaterThan(0);
  });
});
