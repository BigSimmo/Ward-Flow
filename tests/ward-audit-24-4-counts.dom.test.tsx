import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => <a {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/statistics",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { NetworkFigures } from "@/components/ward-management/tools/ward-network-figures";
import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { WardFlowProvider, useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { nextEvent, nowFor, seededRandom } from "./helpers/ward-engine-fuzz";

/** Old Tools formula: `capacityBreakdown().availableNow`, summed. */
function oldReady(state: WardFlowState, now: number) {
  return state.units.reduce(
    (sum, unit) => sum + capacityBreakdown(unit, state.bedReleases, state.leaveBeds, now).availableNow,
    0,
  );
}

/**
 * The first fuzz run (standard scenario) that reaches a state where the old Tools "Ready" formula
 * and `readyBedsNow` disagree: the accepted events up to that point.
 */
function eventsToSplit(): WardFlowEvent[] {
  // 40 until 25 Oct 2026; removing RELEASE_BED from the generator shifted the runs (PR #730).
  for (let seed = 0; seed < 400; seed += 1) {
    const random = seededRandom(24460 + seed);
    let state = seedWardFlowState("standard");
    const events: WardFlowEvent[] = [];
    for (let step = 0; step < 200; step += 1) {
      const event = nextEvent(state, random, step);
      const next = wardFlowReducer(state, event);
      if (next.rejections.length > state.rejections.length) {
        state = next;
        continue;
      }
      state = next;
      events.push(event);
      const now = nowFor(state, step);
      if (oldReady(state, now) !== totalReadyBedsNow(state.units, state.admissions, state.bedReleases)) return events;
    }
  }
  throw new Error("no fuzz run reached a split between the old and shared ready formulas");
}

function ReadyProbe({ events }: { events: WardFlowEvent[] }) {
  const { units, admissions, bedReleases, leaveBeds, dispatch } = useWardFlow();
  const now = useWardFlowClock();
  const old = units.reduce(
    (sum, unit) => sum + capacityBreakdown(unit, [...bedReleases], leaveBeds, now).availableNow,
    0,
  );
  return (
    <>
      <span data-testid="ready-probe">{totalReadyBedsNow(units, admissions, bedReleases)}</span>
      <span data-testid="old-probe">{old}</span>
      <button onClick={() => events.forEach((event) => dispatch(event))}>Replay</button>
    </>
  );
}

/**
 * Audit 24-4 NA2-06 (Tools half): Tools' Network figures "Ready" is `totalReadyBedsNow`, the figure
 * Home and Capacity print, including after a ward confirms fewer beds than it has pulled.
 */
describe("audit 24-4: Tools Network figures Ready reads readyBedsNow", () => {
  it("matches readyBedsNow at the seed and after the old formula would have split", () => {
    const events = eventsToSplit();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReadyProbe events={events} />
        <NetworkFigures />
      </WardFlowProvider>,
    );
    const readyFigure = () => screen.getByText("Ready", { selector: "dt" }).parentElement?.querySelector("dd > span");
    expect(readyFigure()?.textContent).toBe(screen.getByTestId("ready-probe").textContent);

    act(() => {
      screen.getByRole("button", { name: "Replay" }).click();
    });
    // The replay reached the case: the old formula now prints a different number.
    expect(screen.getByTestId("old-probe").textContent).not.toBe(screen.getByTestId("ready-probe").textContent);
    expect(readyFigure()?.textContent).toBe(screen.getByTestId("ready-probe").textContent);
  });
});
