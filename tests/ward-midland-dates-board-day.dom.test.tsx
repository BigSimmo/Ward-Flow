import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TeamHome } from "@/components/ward-management/community/team-2026/team-home";
import { rebaseMidlandText } from "@/components/ward-management/community/team-2026/midland-dates";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { perthMidnight } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * CL-1 (content and locale audit, 5 Nov 2026): the Midland demo's dates follow the board's day.
 * The mock-up was written for Mon 2 Nov 2026; opened on Thu 5 Nov, "Wed 4 Nov, in 2 days" must read
 * "Sat 7 Nov, in 2 days", never a past date labelled as the future. Synthetic data only.
 */
const THURSDAY = perthMidnight(2026, 10, 5);

describe("Midland demo dates follow the board day (CL-1)", () => {
  it("moves each written date by the days since the authored day, keeping its form", () => {
    expect(rebaseMidlandText("Wed 4 Nov", THURSDAY)).toBe("Sat 7 Nov");
    expect(rebaseMidlandText("Ends 16 Nov", THURSDAY)).toBe("Ends 19 Nov");
    expect(rebaseMidlandText("Fri 30 Oct 09:41", THURSDAY)).toBe("Mon 2 Nov 09:41");
    expect(rebaseMidlandText("08 5550 0370 · Clinic room 2", THURSDAY)).toBe("08 5550 0370 · Clinic room 2");
    expect(rebaseMidlandText("Mon 2 Nov", perthMidnight(2026, 11, 31))).toBe("Thu 31 Dec");
    expect(rebaseMidlandText("Wed 4 Nov", perthMidnight(2026, 11, 31))).toBe("2 Jan 2027");
  });

  it("prints Team home's dates from the provider's day 0", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR} initialDayZero={THURSDAY.getTime()}>
        <TeamHome go={vi.fn()} now="10:42" />
      </WardFlowProvider>,
    );
    const row = screen.getByText("Leaving hospital, no follow-up booked").closest("li")!;
    expect(within(row).getByText("Sat 7 Nov")).toBeInTheDocument();
    expect(within(row).getByText("in 2 days")).toBeInTheDocument();
    expect(screen.queryByText("Wed 4 Nov")).toBeNull();
  });
});
