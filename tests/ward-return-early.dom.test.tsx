// Out of area "Flag early" (Josh, 3 Nov 2026): the button in the return plan's pinned foot raises the
// event from the tap, shows "Flagged early" with Undo, and the three desks' alert rows read it.
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { OutOfAreaBoard } from "@/components/ward-management/out-of-area/out-of-area-board";
import { ReturnEarlyAlerts } from "@/components/ward-management/out-of-area/return-early-alerts";
import type { ReturnEarlyDesk } from "@/components/ward-management/out-of-area/return-early";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { outOfAreaLedger } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

const { entries } = outOfAreaLedger(wardAdmissions, allUnits(), NOW_ANCHOR);

function renderBoard(desk?: ReturnEarlyDesk) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <OutOfAreaBoard admissions={wardAdmissions} />
      {desk ? <ReturnEarlyAlerts desk={desk} now={NOW_ANCHOR + 1} /> : null}
    </WardFlowProvider>,
  );
}

function openFirstPlan() {
  fireEvent.click(screen.getByTestId(`ward-out-of-area-row-${entries[0]!.admission.id}`));
}

describe("out-of-area return plan — Flag early", () => {
  it("waits for a receiving hospital, with the reason, and raises nothing on its own", () => {
    renderBoard({ role: "officer" });
    openFirstPlan();
    const button = screen.getByTestId("ward-out-of-area-flag-early");
    expect(button).toHaveTextContent("Flag early");
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(screen.queryByTestId("ward-out-of-area-flagged-early")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-return-early-alerts")).not.toBeInTheDocument();
  });

  it("flags from the tap, shows when with Undo, and Undo puts the button back", () => {
    renderBoard({ role: "officer" });
    openFirstPlan();
    fireEvent.change(screen.getByTestId("ward-out-of-area-repat-home-hospital"), { target: { value: "RPH" } });
    const button = screen.getByTestId("ward-out-of-area-flag-early");
    expect(button).not.toHaveAttribute("aria-disabled", "true");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(button);

    expect(screen.getByTestId("ward-out-of-area-flagged-early")).toHaveTextContent(/^Flagged early \S/);
    expect(screen.queryByTestId("ward-out-of-area-flag-early")).not.toBeInTheDocument();
    const alerts = screen.getAllByTestId("ward-return-early-alert");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent(/Out of area return flagged early: .+ may be ready to come home to .+\./);

    fireEvent.click(screen.getByTestId("ward-out-of-area-flag-early-undo"));
    expect(screen.queryByTestId("ward-out-of-area-flagged-early")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-out-of-area-flag-early")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-return-early-alerts")).not.toBeInTheDocument();
  });

  it("shows the alert to the receiving hospital's ward and the home team, not to another hospital's ward", () => {
    const flagFor = (desk: ReturnEarlyDesk) => {
      const view = renderBoard(desk);
      openFirstPlan();
      fireEvent.change(screen.getByTestId("ward-out-of-area-repat-home-hospital"), { target: { value: "RPH" } });
      fireEvent.click(screen.getByTestId("ward-out-of-area-flag-early"));
      const seen = screen.queryAllByTestId("ward-return-early-alert").length;
      view.unmount();
      return seen;
    };
    expect(flagFor({ role: "ward", siteCode: "RPH" })).toBe(1);
    expect(flagFor({ role: "community" })).toBe(1);
    expect(flagFor({ role: "ward", siteCode: "BUN" })).toBe(0);
  });
});
