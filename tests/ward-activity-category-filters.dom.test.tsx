// tests/ward-activity-category-filters.dom.test.tsx
//
// Activity category chips on the Recent activity tab: All shows every row; named chips show only
// that category; chip counts match the live feed; untagged rows count as "other" and stay off the
// four named chips. Q99 (Josh, 1 Nov 2026): the bar's Activity button opens Home's Activity panel,
// so the chips are the panel's. The feed is pinned below so the counts are known.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const WARD_PATHNAME = "/ward-flow/ward/rph-adult-secure";

vi.mock("next/navigation", () => ({
  usePathname: () => WARD_PATHNAME,
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

// The panel's feed, pinned to a known mix of categories.
vi.mock("@/components/ward-management/shell/ward-command-activity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/shell/ward-command-activity")>();
  return {
    ...actual,
    deriveCommandActivity: (...args: Parameters<typeof actual.deriveCommandActivity>) => {
      const derived = actual.deriveCommandActivity(...args);
      return { ...derived, content: { ...derived.content, changes: MIXED_CHANGES } };
    },
  };
});

import { WardBar } from "@/components/ward-management/shell/ward-bar";
import type { WardActivityContent } from "@/components/ward-management/shell/ward-shell-types";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { activeWardNetwork, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { dueSoonThresholdsOf } from "@/components/ward-management/ward-clock";
const MIXED_CHANGES: WardActivityContent["changes"] = [
  { id: "escalation:WF-1:1", time: "09:00", text: "WF-1 escalated to on-call.", category: "escalation" },
  { id: "escalation:WF-2:2", time: "09:01", text: "WF-2 escalated to manager.", category: "escalation" },
  { id: "decline:WF-3:u:3:0", time: "09:02", text: "Ward declined WF-3.", category: "decline" },
  { id: "referral-raised:REF-1", time: "09:03", text: "REF-1 referral raised.", category: "referral" },
  { id: "stage:WF-4:4:0", time: "09:04", text: "WF-4 moved to transport booked.", category: "transfer" },
  { id: "movement-opened:WF-5", time: "09:05", text: "WF-5 opened at ED.", category: "other" },
  // A row may omit category — treat as other so named chips stay honest.
  { id: "page-untagged", time: "09:06", text: "A page-local update without a category." },
];

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

async function openRecentActivity() {
  const user = userEvent.setup();
  render(<WardBar />);
  await user.click(screen.getByTestId("ward-bar-activity-trigger"));
  const sheet = await screen.findByTestId("ward-bar-activity-sheet");
  await user.click(within(sheet).getByRole("tab", { name: /Recent activity/u }));
  return { user, sheet };
}

const chip = (sheet: HTMLElement, name: string) =>
  within(within(sheet).getByRole("group", { name: "Filter events by category" })).getByRole("button", {
    name: new RegExp(`^${name}`, "u"),
  });
const feedRows = (sheet: HTMLElement) =>
  within(within(sheet).getByRole("list", { name: "Recent activity" })).queryAllByRole("listitem");

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
    const { sheet } = await openRecentActivity();
    expect(feedRows(sheet)).toHaveLength(MIXED_CHANGES.length);
    const allChip = chip(sheet, "All");
    expect(allChip).toHaveAttribute("aria-pressed", "true");
    expect(allChip.textContent).toMatch(/All\s*7/u);
    expect(within(sheet).getByText(/without a category/u)).toBeTruthy();
  });

  it("filters to escalations only and keeps the Escalations chip count honest", async () => {
    const { user, sheet } = await openRecentActivity();
    const escalationsChip = chip(sheet, "Escalations");
    expect(escalationsChip.textContent).toMatch(/Escalations\s*2/u);

    await user.click(escalationsChip);
    expect(escalationsChip).toHaveAttribute("aria-pressed", "true");

    const rows = feedRows(sheet);
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.textContent).toMatch(/escalated/u);
    expect(within(sheet).queryByText(/declined/u)).toBeNull();
    expect(within(sheet).queryByText(/referral raised/u)).toBeNull();
    expect(within(sheet).queryByText(/without a category/u)).toBeNull();
  });

  it("keeps untagged and other rows off the four named chips", async () => {
    const { user, sheet } = await openRecentActivity();
    expect(chip(sheet, "Declines").textContent).toMatch(/Declines\s*1/u);
    expect(chip(sheet, "Referrals").textContent).toMatch(/Referrals\s*1/u);
    expect(chip(sheet, "Transfers").textContent).toMatch(/Transfers\s*1/u);

    await user.click(chip(sheet, "Transfers"));
    expect(feedRows(sheet)).toHaveLength(1);
    expect(within(sheet).getByText(/moved to transport booked/u)).toBeTruthy();
    expect(within(sheet).queryByText(/opened at ED/u)).toBeNull();
    expect(within(sheet).queryByText(/without a category/u)).toBeNull();
  });

  it("keeps the chosen chip while another tab is visited", async () => {
    const { user, sheet } = await openRecentActivity();
    await user.click(chip(sheet, "Escalations"));
    await user.click(within(sheet).getByRole("tab", { name: /Notices/u }));
    await user.click(within(sheet).getByRole("tab", { name: /Recent activity/u }));
    expect(chip(sheet, "Escalations")).toHaveAttribute("aria-pressed", "true");
    expect(feedRows(sheet)).toHaveLength(2);
  });
});
