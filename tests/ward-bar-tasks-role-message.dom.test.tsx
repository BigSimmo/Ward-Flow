// tests/ward-bar-tasks-role-message.dom.test.tsx
//
// F8 (Opus adversarial review, 2026-09-17): `ward-bar.tsx` computes `tasksItems` as `[]` for every
// role `wardTasksAreActionableForRole` refuses (`ward`, `ed`, `officer`) — the reducer's task
// actions are coordinator-only, so a non-coordinator route is never handed the network's real
// inbox. But `WardTasksDrawer`'s only empty state read "No outstanding work right now.", which is
// true for a coordinator with a clear inbox and FALSE for a ward or ED reader: the network may
// have outstanding work, this route is simply never shown it. This file proves the drawer now
// tells the two apart, through the real `WardBar` shell rather than the drawer alone, so the
// route -> role -> empty-tasksItems -> message wiring is covered end to end.
//
// ⚠️ Harness copied from `tests/ward-activity-count-separate.dom.test.tsx`: `useWardFlow` is
// mocked to a hand-built context so movements/role are exactly controlled, and `next/navigation`'s
// `usePathname` drives the route-derived role the same way `use-ward-nav-counts.ts` reads it in
// the app (`wardChromeRole`: a `/ward/` segment is role "ward", everything else here is
// "coordinator").
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const route = { pathname: "/mockups/ward-flow/ward/rph-adult-secure" };

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
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
import { buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const seeded = seedWardFlowState();

function freshContext(overrides: Partial<typeof seeded> = {}) {
  return {
    ...seeded,
    ...overrides,
    now: NOW_ANCHOR,
    dayZero: new Date(0),
    dispatch: vi.fn(),
    focusMovementId: undefined,
    setFocusMovementId: vi.fn(),
  };
}

// Reassigned per test rather than mutated in place, so one test can never leak its movements/role
// into the next. The `vi.mock` factory above closes over this binding and reads it at call time.
let mockContext = freshContext();

async function openTasksDrawer() {
  const user = userEvent.setup();
  render(<WardBar />);
  await user.click(screen.getByTestId("ward-bar-tasks-trigger"));
  return screen.getByTestId("ward-bar-tasks-sheet");
}

describe("F8 — the Tasks drawer's empty state names why the list is empty", () => {
  // `Sheet`'s open-focus controller schedules work with `requestAnimationFrame` — same polyfill
  // guard `tests/ward-activity-count-separate.dom.test.tsx` and
  // `tests/ward-shell-mounted.dom.test.tsx` already carry for the identical component.
  beforeEach(() => {
    window.history.replaceState({}, "", "/mockups/ward-flow");
    if (typeof window.requestAnimationFrame !== "function") {
      window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
      window.cancelAnimationFrame = ((id: number) =>
        clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
    }
  });

  it("has real coordinator work in the seed, or the ward-role assertion below is vacuous", () => {
    const items = buildActionInbox(seeded.movements.filter(isOpen), NOW_ANCHOR, seeded.units);
    expect(items.length).toBeGreaterThan(0);
  });

  it("tells a ward reader the list is the coordinator's, never the coordinator's own empty state", async () => {
    route.pathname = "/mockups/ward-flow/ward/rph-adult-secure";
    mockContext = freshContext(); // full seeded movements — real work exists, just gated off this role
    const sheet = await openTasksDrawer();
    expect(within(sheet).getByText("Tasks is the bed coordinator's list.")).toBeInTheDocument();
    expect(within(sheet).queryByText("No outstanding work right now.")).toBeNull();
  });

  it("keeps the coordinator's genuine empty state when a coordinator's own inbox is clear", async () => {
    route.pathname = "/mockups/ward-flow";
    mockContext = freshContext({ movements: [] }); // no movements at all -> buildActionInbox is []
    const sheet = await openTasksDrawer();
    expect(within(sheet).getByText("No outstanding work right now.")).toBeInTheDocument();
    expect(within(sheet).queryByText("Tasks is the bed coordinator's list.")).toBeNull();
  });
});
