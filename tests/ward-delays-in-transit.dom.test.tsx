import { render, screen, within } from "@testing-library/react";
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
import { waitingSplit } from "@/components/ward-management/ward-shared-figures";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * P098 (Josh, 27 Oct 2026): beside "Over 8h", Waiting names the people on its list who are not
 * waiting, in the shared helper's own words ("1 more in transit"), so the hero stats add up.
 */
describe("Waiting names the people in transit beside Over 8h", () => {
  it('shows "1 more in transit" when one patient on the list is in transit', () => {
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
    const stats = within(hero).getByRole("group", { name: "Filter by the headline counts" });
    expect(within(stats).getByTestId("delays-stat-over8")).toBeInTheDocument();
    expect(within(stats).getByTestId("delays-in-transit-note")).toHaveTextContent(/^1 more in transit$/u);
  });

  it("shows nothing extra when everybody on the list is waiting", () => {
    const open = seedWardFlowState().movements.filter(isOpen);
    const waiting = open.filter((m) => waitingSplit([m]).waiting === 1);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DelaysScreen movements={waiting} />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("delays-in-transit-note")).toBeNull();
  });
});
