import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { asAtStamp, WardDailySheet, WardDailySheetDialog } from "@/components/ward-management/board/ward-daily-sheet";
import { CommunityScreen } from "@/components/ward-management/community/community-screen";
import { DischargeBoard } from "@/components/ward-management/discharges/discharge-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits } from "@/components/ward-management/ward-sites";

const dayZero = new Date("2026-12-30T16:00:00Z"); // Midnight on 31 December in Perth.
const now = 1445;
const stamp = "1 Jan 2027, 00:05 AWST";
const wrap = (children: ReactNode) => (
  <WardFlowProvider initialNow={now} initialDayZero={dayZero.getTime()}>
    {children}
  </WardFlowProvider>
);

afterEach(cleanup);

describe("saved print provenance", () => {
  it("distinguishes years and preserves conservative standalone fallbacks", () => {
    expect(asAtStamp(5, dayZero).time).toContain("31 Dec 2026, 00:05 AWST");
    expect(asAtStamp(now, dayZero).time).toContain(stamp);
    expect(asAtStamp(now).time).toBe("00:05");
    expect(asAtStamp(now, new Date(Number.NaN))).toEqual(asAtStamp(now));
    expect(asAtStamp(Number.NaN, dayZero).time).toBeNull();
    expect(asAtStamp(now).dayNote).toContain("day 2 of this demonstration");
  });

  it("uses the provider calendar in both daily-sheet entry points and keeps the synthetic notice", () => {
    const unit = allUnits()[0];
    const standalone = render(wrap(<WardDailySheet unit={unit} now={now} />));
    expect(
      standalone.container.querySelector('[data-testid="ward-daily-sheet-shift-timestamp"]')?.textContent,
    ).toContain(stamp);
    standalone.unmount();
    render(wrap(<WardDailySheetDialog unit={unit} now={now} onClose={() => {}} />));
    const text = document.querySelector('[data-testid="ward-daily-sheet-dialog-stamp"]')?.textContent;
    expect(text).toContain(stamp);
    expect(text).toContain("synthetic figures, not a record of any real day");
  });

  it("adds the same provider moment and synthetic notice to the community catchment counts print", () => {
    render(wrap(<CommunityScreen teamId="albany" />));
    fireEvent.click(screen.getAllByRole("button", { name: "Catchment MDT" })[0]);
    const text = document.querySelector('[id="handoverModal"]')?.textContent;
    expect(text).toContain(stamp);
    expect(text).toContain("Synthetic figures, not a record of any real day");
    expect(text).toContain("Active Caseload");
    expect(text).toContain("Waiting Referrals");
  });

  it("includes the year and AWST in the existing discharge print scope", () => {
    const { container } = render(wrap(<DischargeBoard />));
    expect(container.querySelector("main > p")?.textContent).toContain(stamp);
  });
});
