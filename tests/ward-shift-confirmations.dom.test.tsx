import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { heldUpReleases } from "@/components/ward-management/capacity/capacity-held-up";
import type { CapacityModel } from "@/components/ward-management/capacity/capacity-model";
import { ShiftChecks } from "@/components/ward-management/capacity/capacity-shift-checks";
import {
  type CountedFigure,
  shiftConfirmations,
  unchangedConfirmations,
} from "@/components/ward-management/capacity/shift-confirmations";
import { currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Unit } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Smart features idea 6 on screen: the coordinator sees which wards have not confirmed this shift.
 * Since the Capacity redesign (31 Oct 2026) the count sits in the "This shift" card, with the
 * longest-waiting ward named and one Ask beside it.
 */
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

/** A ward name as the card shows it, codes spelt out for a screen reader. */
const spelt = (text: string) => render(<SpelledCodes text={text} />).container.textContent;

/** Only the parts of the Capacity model the card reads, each from its real derivation. */
function shiftModel(units: readonly Unit[]): CapacityModel {
  return {
    confirmations: shiftConfirmations(units, NOW_ANCHOR),
    unchanged: unchangedConfirmations(units),
    heldUp: heldUpReleases([], NOW_ANCHOR),
    now: NOW_ANCHOR,
  } as unknown as CapacityModel;
}

describe("This shift card: bed counts confirmed", () => {
  const [a, b] = seedWardFlowState().units;
  const since = currentShiftStartInstant(NOW_ANCHOR);

  it("shows the count, names the ward still to confirm and asks that ward", () => {
    const onAskWard = vi.fn();
    const name = spelt(b!.name);
    render(
      <ShiftChecks model={shiftModel([confirmedAt(a!, since), confirmedAt(b!, since - 60)])} onAskWard={onAskWard} />,
    );
    const section = within(screen.getByRole("region", { name: "Bed counts confirmed" }));
    expect(section.getByText(/^1 of 2/u)).toHaveTextContent("1 of 2confirmed");
    expect(section.getByText(/^Waiting on/u)).toHaveTextContent(
      `Waiting on ${name}, last at ${formatInstant(since - 60)}`,
    );
    fireEvent.click(section.getByRole("button", { name: `Ask ${b!.name} to confirm its beds` }));
    expect(onAskWard).toHaveBeenCalledWith(b!.id);
  });

  it("links a desk that may not ask to the waiting ward's own page instead", () => {
    render(<ShiftChecks model={shiftModel([confirmedAt(a!, since), confirmedAt(b!, since - 60)])} />);
    const section = within(screen.getByRole("region", { name: "Bed counts confirmed" }));
    expect(section.queryByRole("button", { name: /^Ask/u })).toBeNull();
    expect(section.getByRole("link", { name: `Confirm beds on ${b!.name}` })).toHaveAttribute(
      "href",
      `/ward-flow/ward/${b!.id}`,
    );
  });

  it("says so when every ward has confirmed, with nothing to ask", () => {
    render(
      <ShiftChecks model={shiftModel([confirmedAt(a!, since), confirmedAt(b!, since + 1)])} onAskWard={vi.fn()} />,
    );
    const section = within(screen.getByRole("region", { name: "Bed counts confirmed" }));
    expect(section.getByText(/^2 of 2/u)).toHaveTextContent("2 of 2confirmed");
    expect(section.getByText("Every open ward has confirmed since the shift began")).toBeInTheDocument();
    expect(section.queryByRole("button")).toBeNull();
  });
});

describe("This shift card: the same number confirmed shift after shift (Josh, 31 Oct 2026)", () => {
  const [a, b] = seedWardFlowState().units;
  const since = currentShiftStartInstant(NOW_ANCHOR);

  it("names each ward whose count has not changed for 3 or more shifts, with how many", () => {
    const allocatable: CountedFigure = { ...a!.allocatable, confirmedAt: since, unchangedShifts: 4 };
    render(<ShiftChecks model={shiftModel([{ ...a!, allocatable }, confirmedAt(b!, since)])} />);
    const list = screen.getByRole("list", { name: "Same number confirmed shift after shift" });
    expect(screen.getByText(/^Same number confirmed 3 or more shifts in a row, worth a look$/u)).toBeInTheDocument();
    expect(list).toHaveTextContent(`${spelt(a!.name)} · 4 shifts`);
    expect(list).not.toHaveTextContent(spelt(b!.name) ?? "");
  });

  it("says nothing when no ward has such a run", () => {
    render(<ShiftChecks model={shiftModel([confirmedAt(a!, since), confirmedAt(b!, since)])} />);
    expect(screen.queryByRole("list", { name: "Same number confirmed shift after shift" })).toBeNull();
  });
});
