import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TransportExceptionDialog } from "@/components/ward-management/transport-exception-dialog";
import { transportBookingSubmission } from "@/components/ward-management/transport/transport-booking-form";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { TRANSFER_PAUSED_TEXT } from "@/components/ward-management/ward-transport-checks";

/**
 * D-211 (Josh, 14 Nov 2026): fit to travel recorded as not cleared is a hard stop. The screens offer
 * no "save without a reason" or "Continue without a reason" and say transfer is paused, matching the
 * engine's refusal. "Not recorded" still asks for a reason and never requires one. Synthetic only.
 */
afterEach(cleanup);

const answers = {
  provider: "Ambulance service" as const,
  escortRequired: true,
  cadNumber: "CAD-1",
  transportLegalStatus: "involuntary" as const,
  estimatedTime: "",
  estimatedDay: undefined,
};
const record = { legalStatus: "Involuntary inpatient" as const, legalForm: undefined };

describe("not medically cleared pauses onward transfer (D-211)", () => {
  it("the booking form will not book a not-cleared journey, with or without a reason", () => {
    const notCleared = { ...record, medicalClearance: { cleared: false, at: NOW_ANCHOR } };
    expect(transportBookingSubmission(answers, "", notCleared, NOW_ANCHOR)).toBeUndefined();
    expect(transportBookingSubmission(answers, "treating_team_confirmed", notCleared, NOW_ANCHOR)).toBeUndefined();
    // Nothing recorded still books without a reason.
    expect(transportBookingSubmission(answers, "", record, NOW_ANCHOR)).toBeDefined();
  });

  it("the step check says transfer is paused and offers no way on", () => {
    render(
      <TransportExceptionDialog
        open
        who="Test Patient"
        action="Collected"
        gaps={["fit_to_travel_not_cleared"]}
        onConfirm={vi.fn()}
        onContinueWithoutReason={vi.fn()}
        onClose={vi.fn()}
        testId="check"
      />,
    );
    const dialog = screen.getByTestId("check");
    expect(within(dialog).getAllByText(TRANSFER_PAUSED_TEXT).length).toBeGreaterThan(0);
    expect(within(dialog).getByText("Fit to travel: not cleared")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Continue without a reason" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /record reason/u })).toBeNull();
    expect(within(dialog).queryByTestId("check-reason")).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("nothing recorded still offers Continue without a reason", () => {
    render(
      <TransportExceptionDialog
        open
        who="Test Patient"
        action="Collected"
        gaps={["fit_to_travel_missing"]}
        onConfirm={vi.fn()}
        onContinueWithoutReason={vi.fn()}
        onClose={vi.fn()}
        testId="check"
      />,
    );
    const dialog = screen.getByTestId("check");
    expect(within(dialog).getByRole("button", { name: "Continue without a reason" })).toBeInTheDocument();
    expect(within(dialog).queryByText(TRANSFER_PAUSED_TEXT)).toBeNull();
  });
});
