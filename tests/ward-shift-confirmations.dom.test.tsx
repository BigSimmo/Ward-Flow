import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ShiftConfirmationsCard } from "@/components/ward-management/capacity/shift-confirmations-card";
import type { CountedFigure } from "@/components/ward-management/capacity/shift-confirmations";
import { currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Unit } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Smart features idea 6 on screen: the coordinator sees which wards have not confirmed this shift. */
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const confirmedAt = (unit: Unit, at: number): Unit => ({
  ...unit,
  allocatable: { ...unit.allocatable, confirmedAt: at },
});

describe("Confirmed this shift card", () => {
  const [a, b] = seedWardFlowState().units;
  const since = currentShiftStartInstant(NOW_ANCHOR);

  it("shows the count and opens the list of wards still to confirm, each linked to its ward", () => {
    render(<ShiftConfirmationsCard units={[confirmedAt(a!, since), confirmedAt(b!, since - 60)]} now={NOW_ANCHOR} />);
    expect(screen.getByTestId("shift-confirmations-figure")).toHaveTextContent("1 of 2 wards");
    expect(screen.queryByTestId("shift-confirmations-list")).toBeNull();
    const toggle = screen.getByRole("button", { name: "Show 1 not confirmed" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const link = screen.getByRole("link", { name: b!.name });
    expect(link).toHaveAttribute("href", `/ward-flow/ward/${encodeURIComponent(b!.id)}`);
  });

  it("lists wards that have confirmed the same number for a day or more, with the count", () => {
    const allocatable: CountedFigure = { ...a!.allocatable, confirmedAt: since, unchangedShifts: 4 };
    const steady: Unit = { ...a!, allocatable };
    render(<ShiftConfirmationsCard units={[steady, confirmedAt(b!, since)]} now={NOW_ANCHOR} />);
    const list = screen.getByTestId("shift-confirmations-unchanged");
    expect(list).toHaveTextContent("Same number confirmed 3 or more shifts in a row");
    expect(list).toHaveTextContent(`${a!.name}4 shifts`);
    expect(list).not.toHaveTextContent(b!.name);
  });

  it("shows no such list when no ward has a run of unchanged confirmations", () => {
    render(<ShiftConfirmationsCard units={[confirmedAt(a!, since), confirmedAt(b!, since)]} now={NOW_ANCHOR} />);
    expect(screen.queryByTestId("shift-confirmations-unchanged")).toBeNull();
  });

  it("says so when every ward has confirmed, with nothing to open", () => {
    render(<ShiftConfirmationsCard units={[confirmedAt(a!, since), confirmedAt(b!, since + 1)]} now={NOW_ANCHOR} />);
    expect(screen.getByTestId("shift-confirmations-figure")).toHaveTextContent("2 of 2 wards");
    expect(screen.getByText(/Every ward has confirmed its numbers since then\./)).toBeInTheDocument();
    expect(screen.queryByTestId("shift-confirmations-toggle")).toBeNull();
  });
});
