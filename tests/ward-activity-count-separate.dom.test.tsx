// tests/ward-activity-count-separate.dom.test.tsx
//
// `ward-bar.tsx`'s Activity drawer drew its "Activity" segment count as
// `changes.length + scopedNotices.length` — a derived fact (recent changes) and an authored,
// addressed fact (a notice) summed into one unlabelled number. The communication addendum
// (`docs/ward-flow/plans/2026-09-1x-communication-addendum.md` §1.4) is explicit: "The two lists
// must never be summed into one tally without saying so." The Notices heading already carries its
// own count (`scopedNotices.length`) right below — this file proves the Activity segment now shows
// only the activity changes, and that the Notices heading keeps counting notices on its own.
//
// Q99 (Josh, 1 Nov 2026): the bar's Activity button opens Home's Activity panel. Its tabs carry the
// counts now: Recent activity counts the feed's events alone and Notices counts unread notices.
//
// ⚠️ **`@/components/ward-management/ward-bar` (no `shell/` segment) is a DIFFERENT component with
// the same exported name** — a generic stacked bar primitive, unrelated to this one.
// `tests/ward-bar.dom.test.tsx` tests that one. The component under test here is
// `@/components/ward-management/shell/ward-bar`'s `WardBar`, the chrome bar mounted once per route.
//
// ⚠️ **`useWardFlow` IS MOCKED, FOLLOWING `tests/ward-ed-answered-cap.dom.test.tsx`'s OWN
// PRECEDENT.** A notice is only ever produced today by the reducer, from one of a handful of
// specific decisions (addendum §1.3) — there is no reachable dispatch sequence that deterministically
// yields "exactly one ward notice, addressed to this place, plus an independently-controlled
// activity tally" without depending on unrelated reducer behaviour this test is not about. Mocking
// `useWardFlow` to return a hand-built context (including a hand-built `Notice`, the same shape
// `tests/ward-chrome-role.test.ts` already hand-builds) isolates the assertion to `ward-bar.tsx`'s
// own rendering of the two counts.
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const WARD_PATHNAME = "/ward-flow/ward/rph-adult-secure";
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
import type { Notice } from "@/components/ward-management/ward-model";

import { dueSoonThresholdsOf } from "@/components/ward-management/ward-clock";
/** One notice addressed to the ward role at this exact unit — the shape
 *  `tests/ward-chrome-role.test.ts` already hand-builds a `Notice` with. */
const ONE_WARD_NOTICE: Notice = {
  id: "notice:movement:transport_cancelled_ward:0",
  raisedAt: NOW_ANCHOR - 5,
  to: { role: "ward", placeId: WARD_UNIT_ID },
  about: { movementId: "WF-TEST-001", unitId: WARD_UNIT_ID },
  kind: "transport_cancelled_ward",
  sentence: "A transport headed here was cancelled.",
};

const seeded = seedWardFlowState();

const mockContext = {
  ...seeded,
  notices: [ONE_WARD_NOTICE],
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

/** A tab's count: the number at the end of its accessible name. */
function tabCount(tab: HTMLElement) {
  return Number(/(\d+)\s*$/u.exec(tab.textContent ?? "")?.[1]);
}

describe("the Recent activity count and the Notices count are never summed", () => {
  // `Sheet`'s open-focus controller schedules work with `requestAnimationFrame` — same polyfill
  // guard `tests/ward-shell-mounted.dom.test.tsx` and `tests/ward-shell-third-edition.dom.test.tsx`
  // already carry for the identical component.
  beforeEach(() => {
    if (typeof window.requestAnimationFrame !== "function") {
      window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
      window.cancelAnimationFrame = ((id: number) =>
        clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
    }
  });

  it("has one notice scoped to this ward, or the assertions below are vacuous", () => {
    expect(mockContext.notices).toHaveLength(1);
  });

  it("reads the Recent activity count as the feed's events alone, not events plus notices", async () => {
    const { user, sheet } = await openActivityPanel();
    const recentTab = within(sheet).getByRole("tab", { name: /Recent activity/u });
    await user.click(recentTab);
    const events = within(within(sheet).getByRole("list", { name: "Recent activity" })).getAllByRole("listitem");
    expect(events.length, "the seeded world records events, or this is vacuous").toBeGreaterThan(0);
    expect(tabCount(recentTab), "events and the 1 notice must not be summed — addendum §1.4").toBe(events.length);
  });

  // Item 48, Q2 (owner answer 48, 2026-09-17): the notices count reads unread notices only. The
  // fixture notice (`ONE_WARD_NOTICE`) carries no `readAt`, so it is unread and the count is 1.
  it("keeps the Notices tab counting unread notices on its own", async () => {
    const { user, sheet } = await openActivityPanel();
    const noticesTab = within(sheet).getByRole("tab", { name: /Notices/u });
    expect(tabCount(noticesTab)).toBe(1);
    await user.click(noticesTab);
    expect(within(sheet).getByText("1 unread")).toBeInTheDocument();
  });
});
