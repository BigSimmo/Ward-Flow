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

  it("renders ArrivalTimeModal with an accessible group of ETA time buttons that fill the typed box", () => {
    const seed = seedWardFlowState();
    const movement = seed.movements[0];

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ArrivalTimeModal isOpen={true} onClose={() => {}} movement={movement} />
      </WardFlowProvider>,
    );

    const presetGroup = screen.getByRole("group", { name: /Estimated Time of Arrival/i });
    expect(presetGroup).toBeInTheDocument();

    // D-91 (31 Oct 2026): the kit's time buttons (Now, +15m, +30m, +1h) each say the time they set
    // and write it into the typed box. They are actions, not toggles, so they carry no aria-pressed
    // and none is pressed before a person picks one.
    const presetButtons = screen.getAllByRole("button", { name: /^(?:Now|\+\d+[mh]), sets \d{2}:\d{2}$/u });
    expect(presetButtons).toHaveLength(4);
    presetButtons.forEach((btn) => expect(btn).not.toHaveAttribute("aria-pressed"));

    fireEvent.click(screen.getByRole("button", { name: /^\+30m/u }));
    expect(screen.getByLabelText("Type the ETA")).toHaveValue("11:12");
  });

  it("gives every Form times control a visible label, so it is reachable by name from the keyboard", () => {
    // Form times replaced the MHA form calculator's tabbed panels (Tools review, 15 Oct 2026).
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardFormTimes />
      </WardFlowProvider>,
    );

    const form = screen.getByRole("combobox", { name: "Form" });
    expect(form).toHaveValue("");
    fireEvent.change(form, { target: { value: "3A" } });
    expect(form).toHaveValue("3A");
    fireEvent.change(screen.getByLabelText("Date written on form"), { target: { value: "2026-09-26" } });
    expect(screen.getByLabelText("Date written on form")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Time written on form")).toHaveAttribute("type", "time");
    // The result shows only a typed time (rule D5), so type one before reading it back.
    fireEvent.change(screen.getByLabelText("Time written on form"), { target: { value: "09:15" } });
    expect(screen.getByRole("status")).toHaveTextContent(/^Form 3A/u);
  });
});
