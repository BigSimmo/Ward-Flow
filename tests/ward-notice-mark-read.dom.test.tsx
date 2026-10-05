// tests/ward-notice-mark-read.dom.test.tsx
//
// Item 48, Q2 (owner answer 48, 2026-09-17): "Only the addressee's 'Mark as read' writes `readAt`,
// and counts show unread only." This file proves the control itself — `tests/ward-notice-read.test.ts`
// proves the reducer half (the addressee check, the second-mark refusal, `readBy`).
//
// Failing tests this file exists for: "Mark as read" is a real control, with no automatic read on
// opening the drawer; unread notices are visually distinct from read ones; a click dispatches
// `MARK_NOTICE_READ` with the viewer's own role and place.
//
// ⚠️ **`@/components/ward-management/ward-bar` (no `shell/` segment) is a DIFFERENT component with
// the same exported name.** The component under test here is
// `@/components/ward-management/shell/ward-bar`'s `WardBar` — see
// `tests/ward-activity-count-separate.dom.test.tsx`'s own header comment for the same note.
//
// `useWardFlow` IS MOCKED, following that same file's precedent: a notice is only ever produced by
// the reducer from one of a handful of decisions, so hand-building two notices (one read, one not)
// isolates the assertions to `ward-bar.tsx`'s own rendering and dispatch, not to reaching that state
// through a real event sequence.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const WARD_PATHNAME = "/mockups/ward-flow/ward/rph-adult-secure";
const WARD_UNIT_ID = "rph-adult-secure";

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
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Notice } from "@/components/ward-management/ward-model";

const UNREAD_NOTICE: Notice = {
  id: "notice:movement:transport_cancelled_ward:0",
  raisedAt: NOW_ANCHOR - 10,
  to: { role: "ward", placeId: WARD_UNIT_ID },
  about: { movementId: "WF-TEST-001", unitId: WARD_UNIT_ID },
  kind: "transport_cancelled_ward",
  sentence: "A transport headed here was cancelled.",
};

const READ_NOTICE: Notice = {
  id: "notice:movement:referral_accepted_ward:0",
  raisedAt: NOW_ANCHOR - 20,
  to: { role: "ward", placeId: WARD_UNIT_ID },
  about: { movementId: "WF-TEST-002", unitId: WARD_UNIT_ID },
  kind: "referral_accepted_ward",
  sentence: "A referral was accepted for this ward.",
  readAt: NOW_ANCHOR - 5,
  readBy: "ward",
};

const seeded = seedWardFlowState();

const dispatch = vi.fn();

const mockContext = {
  ...seeded,
  notices: [UNREAD_NOTICE, READ_NOTICE],
  now: NOW_ANCHOR,
  dayZero: new Date(0),
  dispatch,
  focusMovementId: undefined,
  setFocusMovementId: vi.fn(),
};

async function openActivityDrawer() {
  const user = userEvent.setup();
  render(<WardBar />);
  await user.click(screen.getByTestId("ward-bar-activity-trigger"));
  return { user, sheet: screen.getByTestId("ward-bar-activity-sheet") };
}

describe("Item 48, Q2 — the Activity drawer's Mark as read control", () => {
  // `Sheet`'s open-focus controller schedules work with `requestAnimationFrame` — same polyfill
  // guard `tests/ward-activity-count-separate.dom.test.tsx` carries for the identical component.
  beforeEach(() => {
    dispatch.mockClear();
    if (typeof window.requestAnimationFrame !== "function") {
      window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
      window.cancelAnimationFrame = ((id: number) =>
        clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
    }
  });

  it("has one unread and one read notice scoped to this ward, or the assertions below are vacuous", () => {
    expect(mockContext.notices).toHaveLength(2);
    expect(UNREAD_NOTICE.readAt).toBeUndefined();
    expect(READ_NOTICE.readAt).toBeDefined();
  });

  it("opens the drawer with no dispatch at all — no automatic read on opening it", async () => {
    await openActivityDrawer();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("shows a real 'Mark as read' control on the unread notice, and 'Read' on the read one", async () => {
    const { sheet } = await openActivityDrawer();
    const notices = within(sheet).getByRole("list", { name: "Notices" });
    const items = within(notices).getAllByRole("listitem");
    expect(items).toHaveLength(2);

    const unreadItem = within(sheet).getByText(UNREAD_NOTICE.sentence).closest("li")!;
    const readItem = within(sheet).getByText(READ_NOTICE.sentence).closest("li")!;

    expect(within(unreadItem).getByRole("button", { name: "Mark as read" })).toBeInTheDocument();
    expect(within(unreadItem).queryByText("Read")).not.toBeInTheDocument();

    expect(within(readItem).queryByRole("button", { name: "Mark as read" })).not.toBeInTheDocument();
    expect(within(readItem).getByText("Read")).toBeInTheDocument();
  });

  it("marks the unread notice visually distinct from the read one", async () => {
    const { sheet } = await openActivityDrawer();
    const unreadItem = within(sheet).getByText(UNREAD_NOTICE.sentence).closest("li")!;
    const readItem = within(sheet).getByText(READ_NOTICE.sentence).closest("li")!;
    expect(unreadItem.getAttribute("data-notice-read")).toBe("false");
    expect(readItem.getAttribute("data-notice-read")).toBe("true");
  });

  it("counts only the unread notice in the heading, even though the read one stays listed", async () => {
    const { sheet } = await openActivityDrawer();
    const heading = within(sheet).getByText(/^Notices/u);
    expect(heading.textContent?.replace(/\s+/g, " ").trim()).toBe("Notices · 1 unread");
    // Both notices — read and unread — are still present in the list.
    expect(within(sheet).getByText(UNREAD_NOTICE.sentence)).toBeInTheDocument();
    expect(within(sheet).getByText(READ_NOTICE.sentence)).toBeInTheDocument();
  });

  it("dispatches MARK_NOTICE_READ with this chrome's own role and place when clicked", async () => {
    const { user, sheet } = await openActivityDrawer();
    const unreadItem = within(sheet).getByText(UNREAD_NOTICE.sentence).closest("li")!;
    await user.click(within(unreadItem).getByRole("button", { name: "Mark as read" }));

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "MARK_NOTICE_READ",
      role: "ward",
      now: NOW_ANCHOR,
      noticeId: UNREAD_NOTICE.id,
      actingPlaceId: WARD_UNIT_ID,
    });
  });
});

it("filters unread notices explicitly and preserves read notices under All", async () => {
  const { user, sheet } = await openActivityDrawer();
  const notices = within(sheet).getByRole("list", { name: "Notices" });
  expect(within(notices).getAllByRole("listitem")).toHaveLength(2);
  const before = dispatch.mock.calls.length;
  await user.click(within(sheet).getByRole("button", { name: "Unread only" }));
  expect(within(notices).getAllByRole("listitem")).toHaveLength(1);
  expect(within(notices).getByText(UNREAD_NOTICE.sentence)).toBeVisible();
  expect(dispatch.mock.calls).toHaveLength(before);
  await user.click(within(sheet).getByRole("button", { name: "Unread only" }));
  expect(within(notices).getByText(READ_NOTICE.sentence)).toBeVisible();
  await user.type(within(sheet).getByRole("textbox", { name: "Search activity" }), "accepted");
  expect(within(notices).getAllByRole("listitem")).toHaveLength(1);
  expect(within(notices).getByText(READ_NOTICE.sentence)).toBeVisible();
});
