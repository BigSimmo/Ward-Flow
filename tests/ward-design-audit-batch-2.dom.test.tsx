import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Same jsdom-App-Router workaround as the sibling ward-screen dom suites.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf";
import { BedMeetingTvScreen } from "@/components/ward-management/bed-meeting/bed-meeting-tv";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// Design audit, 19 October 2026, batch 2: Pull a bed feedback (DA-11), ward tab keys (DA-36) and the
// TV's offline wording (DA-07).

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderWard(unitId: string) {
  return render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId={unitId} />
      </WardFlowProvider>
    </ToastProvider>,
  );
}

/** The first seeded ward with an arrival whose Pull a bed is available, so the test follows the seed. */
function renderWardWithPull(): HTMLElement {
  for (const unit of allUnits()) {
    renderWard(unit.id);
    const pull = screen
      .queryAllByRole("button", { name: "Pull a bed" })
      .find((button) => button.dataset.testid?.startsWith("ward-pull-") && !button.hasAttribute("aria-disabled"));
    if (pull) return pull;
    cleanup();
  }
  throw new Error("the seed must offer an available Pull a bed on some ward");
}

describe("Pull a bed feedback (DA-11)", () => {
  it("says the bed was pulled and keeps focus on the arrival it changed", () => {
    const pull = renderWardWithPull();
    const movementId = pull.dataset.testid!.replace("ward-pull-", "");
    pull.focus();
    fireEvent.click(pull);
    expect(screen.getByText("Bed pulled. It is held for this arrival.")).toBeInTheDocument();
    expect(screen.queryByTestId(`ward-pull-${movementId}`)).not.toBeInTheDocument();
    expect(document.activeElement).toBe(document.getElementById(`ward-arrival-${movementId}`));
  });
});

describe("ward view tabs (DA-36)", () => {
  it("move with Left, Right, Home and End, and only the open view is a tab stop", () => {
    renderWard(allUnits()[0]!.id);
    const list = screen.getByRole("tablist", { name: "Ward views" });
    const tabs = within(list).getAllByRole("tab");
    expect(tabs.length).toBeGreaterThan(1);
    expect(tabs.filter((tab) => tab.tabIndex === 0)).toHaveLength(1);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");

    tabs[0]!.focus();
    fireEvent.keyDown(tabs[0]!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]!.tabIndex).toBe(0);
    expect(tabs[0]!.tabIndex).toBe(-1);

    fireEvent.keyDown(tabs[1]!, { key: "End" });
    expect(document.activeElement).toBe(tabs.at(-1));
    fireEvent.keyDown(tabs.at(-1)!, { key: "ArrowRight" });
    expect(document.activeElement).toBe(tabs[0]);
    fireEvent.keyDown(tabs[0]!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(tabs.at(-1));
    fireEvent.keyDown(tabs.at(-1)!, { key: "Home" });
    expect(document.activeElement).toBe(tabs[0]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    // Up and Down belong to the page while the tabs run across.
    fireEvent.keyDown(tabs[0]!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(tabs[0]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });
});

describe("bed meeting TV offline wording (DA-07)", () => {
  it("stops saying it updates on its own while there is no connection", () => {
    const online = vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <BedMeetingTvScreen />
      </WardFlowProvider>,
    );
    const asAt = screen.getByTestId("bed-meeting-tv-as-at");
    expect(asAt).toHaveTextContent("offline, not updating");
    expect(asAt).not.toHaveTextContent("updates on its own");
    online.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(asAt).toHaveTextContent("updates on its own");
  });
});
