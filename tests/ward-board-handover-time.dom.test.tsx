// Phone review F-09 (Oct 2026): the board said "handover at 15:30" while the sidebar countdown,
// Settings and the shift pattern all end the day shift at 15:00. The board now reads that one value.
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { DAY_SHIFT_END_MINUTE } from "@/components/ward-management/ward-board-time-features";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { SHIFT_PATTERN } from "@/components/ward-management/ward-operational-defaults";

describe("the board's handover time", () => {
  it("names the day shift's own end, the time the rest of the app uses", () => {
    expect(DAY_SHIFT_END_MINUTE).toBe(SHIFT_PATTERN[0].endMinute);
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <WardBoard unitId="rph-adult-secure" />
      </WardFlowProvider>,
    );
    const digest = screen.getByTestId("ward-board-work-band-digest");
    expect(digest).toHaveTextContent(`before the handover at ${formatInstant(DAY_SHIFT_END_MINUTE)}.`);
    expect(digest).not.toHaveTextContent("15:30");
  });
});
