// tests/ward-activity-consistent-across-screens.dom.test.tsx
//
// Verifies that the Activity drawer and its recent events feed are consistently
// wired across the entire application, regardless of which screen is active,
// while correctly resolving the live tally screen title for the active route.

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

async function openActivityDrawer() {
  const user = userEvent.setup();
  render(<WardBar />);
  await user.click(screen.getByTestId("ward-bar-activity-trigger"));
  return { user, sheet: screen.getByTestId("ward-bar-activity-sheet") };
}

describe("Activity drawer is consistently wired across all screens", () => {
  beforeEach(() => {
    if (typeof window.requestAnimationFrame !== "function") {
      window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
      window.cancelAnimationFrame = ((id: number) =>
        clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
    }
  });

  it("shows 20 system events and resolved 'Movements' live tally on the movements screen", async () => {
    currentPathname = "/ward-flow/movements";
    const { user, sheet } = await openActivityDrawer();

    const trigger = screen.getByTestId("ward-bar-activity-trigger");
    expect(trigger.querySelector('[data-tone][aria-hidden="true"]')).toBeNull();
    expect(trigger.textContent).toContain("synthetic activity");
    expect(trigger).not.toHaveTextContent(/\d{1,2}:\d{2}/u);

    // Header freshness shows synthetic demo time and last event time (not "no recorded event")
    expect(within(sheet).getByText(/Synthetic state · demo time/u)).toBeInTheDocument();
    expect(within(sheet).getByText(/last event/u)).toBeInTheDocument();
    expect(within(sheet).queryByText(/no recorded event/u)).toBeNull();

    // Segment buttons show Activity 20 and Live tally Movements
    const segButtons = within(sheet).getAllByRole("button", { name: /Activity|Live tally/u });
    expect(segButtons[0].textContent).toMatch(/Activity\s*20/u);
    expect(segButtons[1].textContent).toMatch(/Live tally\s*Movements/u);

    // Category chips are populated with counts
    const allChip = within(sheet).getByTestId("ward-bar-activity-filter-all");
    expect(allChip.textContent).toMatch(/All\s*20/u);
    const escalationsChip = within(sheet).getByTestId("ward-bar-activity-filter-escalation");
    expect(escalationsChip.textContent).toMatch(/Escalations\s*[1-9]/u);

    // Recent changes list contains 20 items
    const feed = within(sheet).getByRole("list", { name: "Recent changes" });
    const items = within(feed).getAllByRole("listitem");
    expect(items).toHaveLength(20);

    // Switch to live tally tab
    await user.click(segButtons[1]);
    expect(within(sheet).getByText("Movements now")).toBeInTheDocument();
    expect(within(sheet).getByText("Open movements")).toBeInTheDocument();
    expect(within(sheet).getByText("Beds ready")).toBeInTheDocument();
    expect(within(sheet).getByRole("table", { name: "Emergency departments" })).toBeInTheDocument();
  });

  it("shows the same 20 system events and 'Waiting' live tally on the Waiting screen", async () => {
    currentPathname = "/ward-flow/waiting";
    const { user, sheet } = await openActivityDrawer();

    const segButtons = within(sheet).getAllByRole("button", { name: /Activity|Live tally/u });
    expect(segButtons[0].textContent).toMatch(/Activity\s*20/u);
    expect(segButtons[1].textContent).toMatch(/Live tally\s*Waiting/u);

    const feed = within(sheet).getByRole("list", { name: "Recent changes" });
    expect(within(feed).getAllByRole("listitem")).toHaveLength(20);

    await user.click(segButtons[1]);
    expect(within(sheet).getByText("Waiting now")).toBeInTheDocument();
  });

  it("resolves the unit place name on a ward route while keeping the consistent 20 events", async () => {
    currentPathname = "/ward-flow/ward/rph-adult-secure";
    const unitName = seeded.units.find((u) => u.id === "rph-adult-secure")?.name ?? "RPH Adult Secure";
    const { user, sheet } = await openActivityDrawer();

    const segButtons = within(sheet).getAllByRole("button", { name: /Activity|Live tally/u });
    expect(segButtons[0].textContent).toMatch(/Activity\s*20/u);
    expect(segButtons[1].textContent).toContain(unitName);

    const feed = within(sheet).getByRole("list", { name: "Recent changes" });
    expect(within(feed).getAllByRole("listitem")).toHaveLength(20);

    await user.click(segButtons[1]);
    expect(within(sheet).getByText(`${unitName} now`)).toBeInTheDocument();
  });

  it("shows the Home live tally on the ward root screen", async () => {
    currentPathname = "/ward-flow";
    const { user, sheet } = await openActivityDrawer();

    const segButtons = within(sheet).getAllByRole("button", { name: /Activity|Live tally/u });
    expect(segButtons[0].textContent).toMatch(/Activity\s*20/u);
    expect(segButtons[1].textContent).toMatch(/Live tally\s*Home/u);

    await user.click(segButtons[1]);
    expect(within(sheet).getByText("Home now")).toBeInTheDocument();
  });
});
