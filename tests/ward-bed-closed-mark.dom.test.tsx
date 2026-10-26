import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The ward screen renders next/link anchors and jsdom cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { activeClosedBeds, boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

/**
 * H-0978 / WS-15 (Josh 26 Oct 2026, "Close the exact bed"): Close this bed in the bed drawer marks
 * that exact bed Closed, never another tile, and Reopen this bed clears it. Synthetic seed only.
 */
const UNIT = seedWardFlowState().units.find((unit) => boundedBedAvailability(unit).available >= 2)!.id;

let flow: ReturnType<typeof useWardFlow> | undefined;
function Grab() {
  const value = useWardFlow();
  useEffect(() => {
    flow = value;
  });
  return null;
}

afterEach(() => {
  cleanup();
  flow = undefined;
});

const card = (bed: number) => screen.getByTestId(`ward-bed-card-${bed}`);
const bedsIn = (state: string) =>
  Array.from(document.querySelectorAll<HTMLElement>(`[data-testid^='ward-bed-card-'][data-state='${state}']`)).map(
    (element) => Number(element.dataset.testid!.replace("ward-bed-card-", "")),
  );

describe("closing the exact bed from the bed drawer", () => {
  it("marks that bed Closed, and Reopen this bed clears it", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Grab />
          <WardScreen unitId={UNIT} />
        </ToastProvider>
      </WardFlowProvider>,
    );
    const ready = bedsIn("ready");
    expect(ready.length).toBeGreaterThan(1);
    // The lowest ready bed, so a closed mark shown on a later tile could not pass for it.
    const bed = Math.min(...ready);
    fireEvent.click(card(bed));
    fireEvent.click(screen.getByTestId("ward-drawer-close-bed"));

    expect(flow!.units.find((unit) => unit.id === UNIT)!.closedBeds?.map((mark) => mark.bedNumber)).toEqual([bed]);
    expect(card(bed)).toHaveAttribute("data-state", "closed");
    expect(bedsIn("ready")).toHaveLength(ready.length - 1);
    expect(bedsIn("ready")).not.toContain(bed);
    expect(screen.getByText(`Bed ${bed} closed. It is not offered until it is reopened.`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ward-drawer-reopen-bed"));
    expect(activeClosedBeds(flow!.units.find((unit) => unit.id === UNIT)!)).toEqual([]);
    expect(card(bed)).toHaveAttribute("data-state", "ready");
    expect(bedsIn("ready")).toHaveLength(ready.length);
  });
});
