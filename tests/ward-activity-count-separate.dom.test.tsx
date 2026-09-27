// tests/ward-activity-count-separate.dom.test.tsx
//
// WF-10. `ward-bar.tsx`'s Activity drawer drew its "Activity" segment count as
// `changes.length + scopedNotices.length` — a derived fact (recent changes) and an authored,
// addressed fact (a notice) summed into one unlabelled number. The communication addendum
// (`docs/ward-flow/plans/2026-09-1x-communication-addendum.md` §1.4) is explicit: "The two lists
// must never be summed into one tally without saying so." The Notices heading already carries its
// own count (`scopedNotices.length`) right below — this file proves the Activity segment now shows
// only the activity changes, and that the Notices heading keeps counting notices on its own.
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
import type { WardActivityContent } from "@/components/ward-management/shell/ward-shell-types";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Notice } from "@/components/ward-management/ward-model";

/** Two activity changes — an arbitrary, independently-controlled tally, deliberately not equal to
 *  the notice count below, so a sum (2 + 1 = 3) reads differently from either count alone. */
const TWO_CHANGES: WardActivityContent = {
  pageTitle: "Ward 2K",
  tiles: [],
  changes: [
    { id: "change-1", time: "09:00", text: "A bed was marked ready." },
    { id: "change-2", time: "09:05", text: "A referral was accepted." },
  ],
};

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

async function openActivityDrawer() {
  const user = userEvent.setup();
  render(<WardBar activity={TWO_CHANGES} />);
  await user.click(screen.getByTestId("ward-bar-activity-trigger"));
  return screen.getByTestId("ward-bar-activity-sheet");
}

describe("WF-10 — the Activity segment count and the Notices heading are never summed", () => {
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

  it("has one notice scoped to this ward and two activity changes, or the assertions below are vacuous", () => {
    expect(mockContext.notices).toHaveLength(1);
    expect(TWO_CHANGES.changes).toHaveLength(2);
  });

  it("reads the Activity segment count as the activity changes alone, not changes plus notices", async () => {
    const sheet = await openActivityDrawer();
    // Targeted by `aria-controls`, not by visible text: the bar's OWN trigger button also carries
    // the word "Activity" (`data-testid="ward-bar-activity-trigger"`), so a text-based query would
    // be ambiguous between the two. `aria-controls="ward-bar-activity-events"` names exactly the
    // segment button under test.
    const segmentButton = within(sheet).getByRole("button", { name: /^Activity/u });
    expect(segmentButton.getAttribute("aria-controls")).toBe("ward-bar-activity-events");
    const count = segmentButton.querySelector("span");
    expect(count).not.toBeNull();
    expect(count?.textContent?.trim(), "2 activity changes and 1 notice must not be summed to 3 — addendum §1.4").toBe(
      "2",
    );
  });

  // Deliberately rewritten for item 48, Q2 (owner answer 48, 2026-09-17): the heading now reads
  // "Notices · {n} unread" and counts unread notices only, never `scopedNotices.length` — see
  // `tests/ward-notice-mark-read.dom.test.tsx` for the read/unread distinction itself. The fixture
  // notice here (`ONE_WARD_NOTICE`) carries no `readAt`, so it is unread and the count is still 1;
  // only the surrounding text and what the number MEANS changed, not this test's own arithmetic.
  it("keeps the Notices heading counting notices on its own, unaffected by the fix above — now unread notices only", async () => {
    const sheet = await openActivityDrawer();
    const noticesHeading = within(sheet).getByText(/^Notices/u);
    expect(noticesHeading.textContent?.replace(/\s+/g, " ").trim()).toBe("Notices · 1 unread");
  });
});
