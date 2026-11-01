// tests/ward-activity-consistent-across-screens.dom.test.tsx
//
// Verifies that the Activity panel and its recent events feed are consistently
// wired across the entire application, regardless of which screen is active.
// Q99 (Josh, 1 Nov 2026): every page's Activity button opens Home's Activity panel, one design
// everywhere, so its feed and statewide live tally read the same on every route.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let currentPathname = "/ward-flow";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useWardFlow: () => mockContext,
    useWardFlowSelect: () => mockContext,
    useOptionalWardFlowSelect: () => mockContext,
    useDueSoonThresholds: () => dueSoonThresholdsOf(mockContext?.configuration),
    useWardNetwork: () => activeWardNetwork(),
    useWardFlowClock: () => mockContext.now,
  };
});

import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { activeWardNetwork, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { dueSoonThresholdsOf } from "@/components/ward-management/ward-clock";
const seeded = seedWardFlowState();

const mockContext = {
  ...seeded,
  notices: [],
  now: NOW_ANCHOR,
  dayZero: new Date(0),
  dispatch: vi.fn(),
  focusMovementId: undefined,
  setFocusMovementId: vi.fn(),
};

async function openActivityPanel() {
  const user = userEvent.setup();
  render(<WardBar />);
  await user.click(screen.getByTestId("ward-bar-activity-trigger"));
  return { user, sheet: await screen.findByTestId("ward-bar-activity-sheet") };
}

describe("the Activity panel is consistently wired across all screens", () => {
  beforeEach(() => {
    if (typeof window.requestAnimationFrame !== "function") {
      window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
      window.cancelAnimationFrame = ((id: number) =>
        clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
    }
  });

  it("labels the trigger as synthetic activity without a clock or a tone", () => {
    currentPathname = "/ward-flow/movements";
    render(<WardBar />);
    const trigger = screen.getByTestId("ward-bar-activity-trigger");
    expect(trigger.querySelector('[data-tone][aria-hidden="true"]')).toBeNull();
    expect(trigger.textContent).toContain("synthetic activity");
    expect(trigger).not.toHaveTextContent(/\d{1,2}:\d{2}/u);
  });

  it.each([
    ["the movements screen", "/ward-flow/movements"],
    ["the Waiting screen", "/ward-flow/waiting"],
    ["a ward route", "/ward-flow/ward/rph-adult-secure"],
    ["Home", "/ward-flow"],
  ])("shows the same panel, 20 events and the statewide live tally on %s", async (_name, pathname) => {
    currentPathname = pathname;
    const { user, sheet } = await openActivityPanel();

    expect(within(sheet).getByRole("heading", { name: "Activity · Statewide" })).toBeInTheDocument();
    for (const tab of [/Changes/u, /Recent activity/u, /Notices/u])
      expect(within(sheet).getByRole("tab", { name: tab })).toBeInTheDocument();

    await user.click(within(sheet).getByRole("tab", { name: /Recent activity/u }));
    expect(within(sheet).getByRole("tab", { name: /Recent activity/u }).textContent).toMatch(/20$/u);
    const feed = within(sheet).getByRole("list", { name: "Recent activity" });
    expect(within(feed).getAllByRole("listitem")).toHaveLength(20);
    const escalations = within(within(sheet).getByRole("group", { name: "Filter events by category" })).getByRole(
      "button",
      { name: /^Escalations/u },
    );
    expect(escalations.textContent).toMatch(/Escalations\s*[1-9]/u);

    // The live tally, with its synthetic provenance, opens under whichever tab shows.
    expect(within(sheet).getByText(/Synthetic state · demo time/u)).toBeInTheDocument();
    await user.click(within(sheet).getByText("Live tally"));
    expect(within(sheet).getByText("Open movements")).toBeInTheDocument();
    expect(within(sheet).getByText("Beds ready")).toBeInTheDocument();
    expect(within(sheet).getByRole("table", { name: "Emergency departments" })).toBeInTheDocument();
  });
});
