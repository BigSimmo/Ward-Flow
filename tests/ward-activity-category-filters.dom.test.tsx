// tests/ward-activity-category-filters.dom.test.tsx
//
// Activity category chips under the Activity/Live-tally segment: All shows every row; named
// chips show only that category; chip counts match the live feed; untagged page-supplied rows
// count as "other" and stay off the four named chips.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const WARD_PATHNAME = "/mockups/ward-flow/ward/rph-adult-secure";

vi.mock("next/navigation", () => ({
  usePathname: () => WARD_PATHNAME,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useWardFlow: () => mockContext,
    useWardFlowClock: () => mockContext.now,
  };
});

import { WardBar } from "@/components/ward-management/shell/ward-bar";
import type { WardActivityContent } from "@/components/ward-management/shell/ward-shell-types";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const MIXED_ACTIVITY: WardActivityContent = {
  pageTitle: "Ward 2K",
  tiles: [],
  changes: [
    { id: "escalation:WF-1:1", time: "09:00", text: "WF-1 escalated to on-call.", category: "escalation" },
    { id: "escalation:WF-2:2", time: "09:01", text: "WF-2 escalated to manager.", category: "escalation" },
    { id: "decline:WF-3:u:3:0", time: "09:02", text: "Ward declined WF-3.", category: "decline" },
    { id: "referral-raised:REF-1", time: "09:03", text: "REF-1 referral raised.", category: "referral" },
    { id: "stage:WF-4:4:0", time: "09:04", text: "WF-4 moved to transport booked.", category: "transfer" },
    { id: "movement-opened:WF-5", time: "09:05", text: "WF-5 opened at ED.", category: "other" },
    // Page-supplied rows may omit category — treat as other so named chips stay honest.
    { id: "page-untagged", time: "09:06", text: "A page-local update without a category." },
  ],
};

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
  render(<WardBar activity={MIXED_ACTIVITY} />);
  await user.click(screen.getByTestId("ward-bar-activity-trigger"));
  return { user, sheet: screen.getByTestId("ward-bar-activity-sheet") };
}

describe("Activity category filter chips", () => {
  beforeEach(() => {
    if (typeof window.requestAnimationFrame !== "function") {
      window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
      window.cancelAnimationFrame = ((id: number) =>
        clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
    }
  });

  it("shows every row under All, including other and untagged rows", async () => {
    const { sheet } = await openActivityDrawer();
    const feed = within(sheet).getByRole("list", { name: "Recent changes" });
    expect(within(feed).getAllByRole("listitem")).toHaveLength(MIXED_ACTIVITY.changes.length);
    const allChip = within(sheet).getByTestId("ward-bar-activity-filter-all");
    expect(allChip).toHaveAttribute("aria-pressed", "true");
    expect(allChip.textContent).toMatch(/All\s*7/u);
    expect(within(feed).getByText(/without a category/u)).toBeTruthy();
  });

  it("filters to escalations only and keeps the Escalations chip count honest", async () => {
    const { user, sheet } = await openActivityDrawer();
    const escalationsChip = within(sheet).getByTestId("ward-bar-activity-filter-escalation");
    expect(escalationsChip.textContent).toMatch(/Escalations\s*2/u);

    await user.click(escalationsChip);
    expect(escalationsChip).toHaveAttribute("aria-pressed", "true");

    const feed = within(sheet).getByRole("list", { name: "Recent changes" });
    const rows = within(feed).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toHaveAttribute("data-category", "escalation");
    }
    expect(within(feed).queryByText(/declined/u)).toBeNull();
    expect(within(feed).queryByText(/referral raised/u)).toBeNull();
    expect(within(feed).queryByText(/without a category/u)).toBeNull();
  });

  it("keeps untagged and other rows off the four named chips", async () => {
    const { user, sheet } = await openActivityDrawer();
    expect(within(sheet).getByTestId("ward-bar-activity-filter-decline").textContent).toMatch(/Declines\s*1/u);
    expect(within(sheet).getByTestId("ward-bar-activity-filter-referral").textContent).toMatch(/Referrals\s*1/u);
    expect(within(sheet).getByTestId("ward-bar-activity-filter-transfer").textContent).toMatch(/Transfers\s*1/u);

    await user.click(within(sheet).getByTestId("ward-bar-activity-filter-transfer"));
    const feed = within(sheet).getByRole("list", { name: "Recent changes" });
    expect(within(feed).getAllByRole("listitem")).toHaveLength(1);
    expect(within(feed).getByText(/moved to transport booked/u)).toBeTruthy();
    expect(within(feed).queryByText(/opened at ED/u)).toBeNull();
    expect(within(feed).queryByText(/without a category/u)).toBeNull();
  });
});
