import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
 * that exact bed Closed, never another tile, and Reopen this bed clears it. A14-19 (Josh, 18 Nov
 * 2026, D-263): the press asks "Why is this bed closing?" first. Synthetic seed only.
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
    fireEvent.click(screen.getByRole("menuitem", { name: "Not given" }));

    expect(flow!.units.find((unit) => unit.id === UNIT)!.closedBeds?.map((mark) => mark.bedNumber)).toEqual([bed]);
    expect(card(bed)).toHaveAttribute("data-state", "closed");
    expect(bedsIn("ready")).toHaveLength(ready.length - 1);
    expect(bedsIn("ready")).not.toContain(bed);
    // D-192 (shared design parts item 4): the toast title loses its full stop and names the Undo time.
    expect(
      screen.getByText(`Bed ${String(bed).padStart(2, "0")} closed. It is not offered until it is reopened`),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ward-drawer-reopen-bed"));
    expect(activeClosedBeds(flow!.units.find((unit) => unit.id === UNIT)!)).toEqual([]);
    expect(card(bed)).toHaveAttribute("data-state", "ready");
    expect(bedsIn("ready")).toHaveLength(ready.length);
  });

  // Live audit item 13 (11 Nov 2026): the bed's History lists its closure and its reopening.
  it("lists the closure and the reopening in the bed's History", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Grab />
          <WardScreen unitId={UNIT} />
        </ToastProvider>
      </WardFlowProvider>,
    );
    const bed = Math.min(...bedsIn("ready"));
    fireEvent.click(card(bed));
    fireEvent.click(screen.getByTestId("ward-drawer-close-bed"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Not given" }));
    fireEvent.click(screen.getByTestId("ward-drawer-reopen-bed"));
    const toggle = screen.getByTestId("bed-drawer-history-toggle");
    fireEvent.click(toggle);
    const history = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(history).toBeVisible();
    expect(history).toHaveTextContent(/Bed closed, by /u);
    expect(history).toHaveTextContent("Bed reopened");
    expect(toggle).toHaveTextContent("History2");
  });
});

describe("closing a bed with a review time (item 6)", () => {
  it("records Review in, shows the review on the closed bed, and leaves Ready as a plain closure", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Grab />
          <WardScreen unitId={UNIT} />
        </ToastProvider>
      </WardFlowProvider>,
    );
    const ready = bedsIn("ready");
    const bed = Math.min(...ready);
    fireEvent.click(card(bed));
    // Nothing is chosen for the person beyond "Not known", which leaves the time out.
    const choice = screen.getByTestId("ward-drawer-close-bed-review");
    expect(choice).toHaveAttribute("data-value", "");
    fireEvent.click(screen.getByRole("button", { name: "In 4 hours" }));
    expect(choice).toHaveAttribute("data-value", "4");
    fireEvent.click(screen.getByTestId("ward-drawer-close-bed"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Not given" }));

    const now = flow!.now;
    const mark = flow!.units.find((unit) => unit.id === UNIT)!.closedBeds!.at(-1)!;
    expect(mark).toMatchObject({ bedNumber: bed, reviewAt: now + 240 });
    expect(bedsIn("ready")).toHaveLength(ready.length - 1);
    expect(screen.getByTestId("ward-drawer-reopen-bed-note")).toHaveTextContent(
      /^Review \d{1,2}:\d{2} [ap]m\. Reopening/,
    );
  });

  // A14-19 (Josh, 18 Nov 2026, D-263): the reason is chosen as the bed closes, in one step, and the
  // review time rides with it.
  it("closes with the reason chosen as it closes, keeping the review time", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Grab />
          <WardScreen unitId={UNIT} />
        </ToastProvider>
      </WardFlowProvider>,
    );
    const bed = Math.min(...bedsIn("ready"));
    fireEvent.click(card(bed));
    fireEvent.click(screen.getByRole("button", { name: "In 4 hours" }));
    const before = flow!.units.find((unit) => unit.id === UNIT)!.closedBeds?.length ?? 0;
    fireEvent.click(screen.getByTestId("ward-drawer-close-bed"));
    const menu = screen.getByRole("menu", { name: "Why is this bed closing?" });
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual(["Infection outbreak", "Staffing", "Building or maintenance", "Other operational reason", "Not given"]);
    // Nothing is closed until a reason (or Not given) is pressed.
    expect(flow!.units.find((unit) => unit.id === UNIT)!.closedBeds?.length ?? 0).toBe(before);
    const reviewAt = flow!.now + 240;
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Staffing" }));
    const mark = flow!.units.find((unit) => unit.id === UNIT)!.closedBeds!.at(-1)!;
    expect(mark).toMatchObject({ bedNumber: bed, reason: "staffing", reviewAt });
    const toast = screen.getByTestId("toast");
    expect(toast).toHaveTextContent(`Bed ${String(bed).padStart(2, "0")} closed: Staffing. It is not offered`);
    // The toast keeps its Undo and no longer offers a reason.
    expect(within(toast).getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(within(toast).queryByTestId("toast-choices")).toBeNull();
  });

  it("backs out on Escape with nothing changed, focus back on Close this bed", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToastProvider>
          <Grab />
          <WardScreen unitId={UNIT} />
        </ToastProvider>
      </WardFlowProvider>,
    );
    const bed = Math.min(...bedsIn("ready"));
    fireEvent.click(card(bed));
    const before = flow!.units.find((unit) => unit.id === UNIT)!.closedBeds?.length ?? 0;
    const trigger = screen.getByTestId("ward-drawer-close-bed");
    fireEvent.click(trigger);
    // Focus moves into the choice, on its first reason.
    expect(screen.getByRole("menuitem", { name: "Infection outbreak" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
    // The drawer is still open on the same bed.
    expect(screen.getByTestId("ward-drawer-close-bed")).toBeInTheDocument();
    // r10: the kit menu has no Cancel item; Escape is the way out.
    fireEvent.click(trigger);
    expect(screen.queryByRole("menuitem", { name: "Cancel" })).toBeNull();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
    expect(flow!.units.find((unit) => unit.id === UNIT)!.closedBeds?.length ?? 0).toBe(before);
    expect(card(bed)).toHaveAttribute("data-state", "ready");
  });
});
