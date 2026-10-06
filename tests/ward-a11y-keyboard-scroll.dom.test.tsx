import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import React from "react";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";
import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import { WardMhaCalculator } from "@/components/ward-management/tools/ward-mha-calculator";
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

  it("renders WardMhaCalculator tabs with roving tabindex and keyboard accessible tabpanels", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardMhaCalculator />
      </WardFlowProvider>,
    );

    const tablist = screen.getByRole("tablist", { name: /Statutory form selection/i });
    expect(tablist).toBeInTheDocument();

    const tab1A = screen.getByRole("tab", { name: /Form 1A/i });
    const tab3A = screen.getByRole("tab", { name: /Form 3A/i });
    const tab4B = screen.getByRole("tab", { name: /Form 4B/i });

    // Active tab (Form 1A) has tabIndex=0, inactive tabs have tabIndex=-1
    expect(tab1A).toHaveAttribute("aria-selected", "true");
    expect(tab1A).toHaveAttribute("tabindex", "0");
    expect(tab3A).toHaveAttribute("aria-selected", "false");
    expect(tab3A).toHaveAttribute("tabindex", "-1");
    expect(tab4B).toHaveAttribute("aria-selected", "false");
    expect(tab4B).toHaveAttribute("tabindex", "-1");

    // Active tabpanel has tabIndex=0 for keyboard scrolling
    const panel1A = screen.getByRole("tabpanel");
    expect(panel1A).toHaveAttribute("tabindex", "0");
    expect(panel1A).toHaveAttribute("id", "panel-1A");

    // Switch to Form 3A
    fireEvent.click(tab3A);
    expect(tab3A).toHaveAttribute("aria-selected", "true");
    expect(tab3A).toHaveAttribute("tabindex", "0");
    expect(tab1A).toHaveAttribute("tabindex", "-1");

    const panel3A = screen.getByRole("tabpanel");
    expect(panel3A).toHaveAttribute("tabindex", "0");
    expect(panel3A).toHaveAttribute("id", "panel-3A");
  });
});
