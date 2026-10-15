import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import React from "react";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import { WardFormTimes } from "@/components/ward-management/tools/ward-form-times";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("Phase 6: Accessibility & Ergonomics Polish", () => {
  it("renders WardTable scroll container with keyboard-operable region attributes", () => {
    render(
      <WardTable testId="test-scroll-table" ariaLabel="Inpatient movement list">
        <thead>
          <tr>
            <th>Patient</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Hawthornby, M.</td>
            <td>Admitted</td>
          </tr>
        </tbody>
      </WardTable>,
    );

    const scrollContainer = screen.getByTestId("test-scroll-table");
    expect(scrollContainer).toHaveAttribute("tabindex", "0");
    expect(scrollContainer).toHaveAttribute("role", "region");
    expect(scrollContainer).toHaveAttribute("aria-label", "Inpatient movement list");
  });

  it("renders ArrivalTimeModal with accessible group and aria-pressed on ETA presets", () => {
    const seed = seedWardFlowState();
    const movement = seed.movements[0];

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ArrivalTimeModal isOpen={true} onClose={() => {}} movement={movement} />
      </WardFlowProvider>,
    );

    const presetGroup = screen.getByRole("group", { name: /Estimated Time of Arrival/i });
    expect(presetGroup).toBeInTheDocument();

    const presetButtons = screen.getAllByRole("button", { name: /\+(?:30 min|\d hour)/i });
    expect(presetButtons.length).toBeGreaterThan(0);

    // Initial check: each preset button has aria-pressed
    presetButtons.forEach((btn) => {
      expect(btn).toHaveAttribute("aria-pressed");
    });

    // Clicking a preset button toggles aria-pressed="true"
    fireEvent.click(presetButtons[0]);
    expect(presetButtons[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("gives every Form times control a visible label, so it is reachable by name from the keyboard", () => {
    // Form times replaced the MHA form calculator's tabbed panels (Tools review, 15 Oct 2026).
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardFormTimes />
      </WardFlowProvider>,
    );

    const form = screen.getByRole("combobox", { name: "Form" });
    expect(form).toHaveValue("1A");
    fireEvent.change(form, { target: { value: "3A" } });
    expect(form).toHaveValue("3A");
    expect(screen.getByLabelText("Date written on form")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Time written on form")).toHaveAttribute("type", "time");
    // The result shows only a typed time (rule D5), so type one before reading it back.
    fireEvent.change(screen.getByLabelText("Time written on form"), { target: { value: "09:15" } });
    expect(screen.getByRole("status")).toHaveTextContent(/^Form 3A/u);
  });
});
