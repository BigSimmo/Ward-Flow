import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { notWaitingParts, waitingSplit } from "@/components/ward-management/ward-shared-figures";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * P098 (Josh, 27 Oct 2026): Waiting names the people on its list who are not waiting, in the shared
 * helper's own words, so its figures add up to the list's own count.
 *
 * ⚠️ RE-POINTED 31 Oct 2026 (round-8 redesign). The "1 more in transit" note beside Over 8h is
 * gone; the header title now names them ("12 waiting in ED, 1 in transit") and each wait band says
 * who in it is not in an ED ("includes 1 in transit"). The property is unchanged: somebody in
 * transit is named, never silently counted as waiting in an ED.
 */
describe("Waiting names the people in transit beside its waiting count", () => {
  it('names "1 in transit" in the header and in the band that holds them', () => {
    const open = seedWardFlowState().movements.filter(isOpen);
    const inTransit = open.filter((m) => {
      const s = waitingSplit([m]);
      return s.notWaiting.in_transit === 1;
    });
    const waiting = open.filter((m) => waitingSplit([m]).waiting === 1);
    expect(inTransit.length, "the seed has someone in transit").toBeGreaterThan(0);
    const movements = [...waiting, inTransit[0]!];
    expect(waitingSplit(movements).notWaiting.in_transit).toBe(1);

    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen movements={movements} />
      </WardFlowProvider>,
    );
    const hero = screen.getByTestId("delays-hero");
    const split = waitingSplit(movements);
    expect(notWaitingParts(split)).toEqual(["1 in transit"]);
    expect(within(hero).getByRole("heading", { level: 1 })).toHaveTextContent(
      new RegExp(`^${split.waiting} waiting in ED, 1 in transit$`, "u"),
    );
    const stats = within(hero).getByRole("group", { name: "Filter by the headline counts" });
    expect(within(stats).getByTestId("delays-stat-over8")).toBeInTheDocument();

    // The band holding the person in transit says so, folded or open, in the same words.
    const bands = screen.getAllByTestId(/^delays-band-/u);
    const naming = bands.filter((band) => (band.getAttribute("aria-label") ?? "").includes("includes 1 in transit"));
    expect(naming, "exactly one wait band names the person in transit").toHaveLength(1);
    for (const band of bands.filter((candidate) => !naming.includes(candidate))) {
      expect(band.getAttribute("aria-label")).toContain("all in an ED");
    }
    if (naming[0]!.getAttribute("aria-expanded") === "false") fireEvent.click(naming[0]!);
    expect(naming[0]).toHaveAccessibleName(/includes 1 in transit/u);
  });

  it("shows nothing extra when everybody on the list is waiting", () => {
    const open = seedWardFlowState().movements.filter(isOpen);
    const waiting = open.filter((m) => waitingSplit([m]).waiting === 1);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen movements={waiting} />
      </WardFlowProvider>,
    );
    const hero = screen.getByTestId("delays-hero");
    expect(within(hero).getByRole("heading", { level: 1 })).toHaveTextContent(
      new RegExp(`^${waitingSplit(waiting).waiting} waiting in ED$`, "u"),
    );
    expect(screen.queryByText(/in transit/u)).toBeNull();
    for (const band of screen.getAllByTestId(/^delays-band-/u)) {
      expect(band.getAttribute("aria-label")).not.toMatch(/in transit/u);
    }
  });
});
