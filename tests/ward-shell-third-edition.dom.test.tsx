import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The catcher for phase-1.1 of the third-edition build plan (`docs/ward-flow/plans/2026-09-10-
 * third-edition-build-master-plan.md` §1.3, item 1.1): `WardRail` and `WardBar`
 * (`src/components/ward-management/shell/`), **not mounted anywhere in the app yet** — a later
 * task edits `layout.tsx`. This file renders both directly, wrapped only in `WardFlowProvider`,
 * exactly the way the brief's own catcher line describes it.
 *
 * The seven numbered assertions below are the brief's own list, each kept as its own `it()` so a
 * single regression names exactly one broken promise rather than one giant test going red for an
 * unstated reason.
 */

// Same mocking idiom as `tests/ward-chrome-header-actions.dom.test.tsx`: the shell renders
// next/link anchors and reads the route via next/navigation, neither of which jsdom can supply
// without an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const route = { pathname: "/mockups/ward-flow" };
const mockRouterPush = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: mockRouterPush, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { applyAppearance, WardBar } from "@/components/ward-management/shell/ward-bar";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import { computeShiftProgress, WardRail } from "@/components/ward-management/shell/ward-rail";
import { resetWardChecksForTests, useWardChecksPublisher } from "@/components/ward-management/shell/ward-checks";
import type { WardReconciliationCheck } from "@/components/ward-management/shell/ward-shell-types";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WARD_NAV, WARD_VIEWS, resolveWardPrimaryAction } from "@/components/ward-management/ward-nav";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Dispatches a raw Tab keydown the same way `tests/sheet-focus.dom.test.tsx` already does —
 *  `<Sheet>`'s focus trap computes the next focusable element itself and calls
 *  `preventDefault()` on a real "Tab" keydown reaching `window` (see `sheet.tsx`'s own `onKeyDown`);
 *  `userEvent.tab()` walks jsdom's own tabbable order instead and does not exercise that code
 *  path, which is why the established convention in this repository dispatches the key directly. */
function pressTab(shiftKey = false) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey, bubbles: true, cancelable: true }));
}

const OK_CHECKS: WardReconciliationCheck[] = [
  { label: "Open movements sum to the rail's tally", ok: true },
  { label: "Referrals waiting sum to the queue", ok: true },
];

const FAILING_CHECKS: WardReconciliationCheck[] = [
  { label: "Open movements sum to the rail's tally", ok: true },
  { label: "Referrals waiting sum to the queue", ok: false },
];

/**
 * 🔴 **O-9: THE SHELL NO LONGER TAKES `checks` AS A PROP.** A screen renders below the rail and the
 * bar, so it cannot hand anything upward; it PUBLISHES to a module store instead and the shell
 * reads it. **These tests publish the same way a screen does** — through the real hook, not a prop
 * that only tests use. ⚠️ **A test-only prop would move the untested seam rather than close it.**
 */
function ChecksPublisher({ checks }: { checks: readonly WardReconciliationCheck[] }) {
  useWardChecksPublisher(checks);
  return null;
}

function renderShell(checks: WardReconciliationCheck[] = OK_CHECKS) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardLiveRegion />
      <ChecksPublisher checks={checks} />
      <WardRail />
      <WardBar />
    </WardFlowProvider>,
  );
}

// Same jsdom rAF guard `tests/sheet.dom.test.tsx` already carries — the shell's three drawers are
// `<Sheet>`, whose open-focus controller schedules work via requestAnimationFrame.
beforeEach(() => {
  route.pathname = "/mockups/ward-flow";
  mockRouterPush.mockClear();
  if (typeof window.requestAnimationFrame !== "function") {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
  }
});

afterEach(() => {
  resetWardLiveRegionForTests();
  // ⚠️ A module store outlives a `render()`. A leaked publication would make the NEXT test's shell
  // claim a reconciliation it never published — green, and about the wrong page.
  resetWardChecksForTests();
  if (typeof document !== "undefined" && document.body) {
    document.body.style.overflow = "";
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-rail");
  }
});

/* ── 1. rail link count equals WARD_VIEWS plus the rail entries of WARD_NAV ──────────────────── */

describe("assertion 1 — owner-selected rail destinations", () => {
  it("renders the owner-selected groups in order, with Patients only in Work", () => {
    renderShell();
    const links = screen.getAllByTestId("ward-rail-link");
    expect(links).toHaveLength(21);
    const groups = [
      ["Today", ["Home", "Movements", "Capacity", "Delays", "Network"]],
      ["Where", ["Places", "Emergency", "Wards", "Community", "Transport"]],
      ["Work", ["Patients", "New referral", "Referrals", "Handover", "Discharges"]],
      ["Checks", ["Governance", "Statistics", "Legal", "Out of area", "Alerts", "On-call"]],
    ] as const;
    for (const [name, labels] of groups) {
      const groupLinks = within(screen.getByRole("region", { name })).getAllByRole("link");
      expect(groupLinks.map((link) => link.getAttribute("aria-label")?.split(",")[0])).toEqual(labels);
    }
    const destinations = links.map((link) => link.getAttribute("href"));
    expect(new Set(destinations).size).toBe(21);
    // Alerts and On-call are now reachable from the rail (previously orphaned / weakly discoverable).
    expect(destinations).toContain("/mockups/ward-flow/alerts");
    expect(destinations).toContain("/mockups/ward-flow/on-call");
  });

  it("keeps Wards active for a ward answer without restoring the removed example link", () => {
    route.pathname = "/mockups/ward-flow/ward/rph-adult-secure/answer";
    renderShell();
    const links = screen.getAllByTestId("ward-rail-link");
    expect(links.some((link) => link.getAttribute("href") === "/mockups/ward-flow/ward/rph-adult-secure")).toBe(false);
    const wards = links.find((link) => link.getAttribute("href") === "/mockups/ward-flow/wards");
    expect(wards).toHaveAttribute("aria-current", "page");
    expect(wards).toHaveAttribute("data-active", "true");
  });

  it.each([
    ["/mockups/ward-flow/movements/WF-001", "/mockups/ward-flow/movements"],
    ["/mockups/ward-flow/statistics/ward/rph-adult-secure", "/mockups/ward-flow/statistics"],
    ["/mockups/ward-flow/referrals/new", "/mockups/ward-flow/referrals/new"],
  ])("highlights only the owning destination for %s", (pathname, href) => {
    route.pathname = pathname;
    renderShell();
    const active = screen
      .getAllByTestId("ward-rail-link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveAttribute("href", href);
  });
});

describe("closed desktop rail cards", () => {
  it("shows the truthful route label on focus without adding a duplicate accessible description", async () => {
    const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: query === "(min-width: 1001px)",
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as unknown as MediaQueryList,
    );
    window.localStorage.setItem("ward-flow-rail", "closed");
    try {
      renderShell();
      const command = screen.getAllByTestId("ward-rail-link")[0]!;
      await waitFor(() => expect(command).not.toHaveAttribute("title"));
      command.focus();
      const card = await screen.findByTestId("tooltip");
      expect(card).toHaveTextContent(command.getAttribute("aria-label") ?? "");
      expect(card).toHaveAttribute("data-placement", "right");
      expect(card).toHaveAttribute("aria-hidden", "true");
      expect(command).not.toHaveAttribute("aria-describedby");
      expect(command).not.toHaveAttribute("title");
    } finally {
      window.localStorage.removeItem("ward-flow-rail");
      matchMedia.mockRestore();
    }
  });
});

/* ── 7. anti-vacuity floor (rail half here; drawer half lives beside assertion 3 below) ──────── */

describe("assertion 7 — anti-vacuity floor, rail", () => {
  it("fails if the rail link list is empty: the source lists are non-empty AND the render matches them", () => {
    // Guards the fixture itself, independent of the component: if WARD_VIEWS/WARD_NAV were both
    // emptied, assertion 1's equality (0 === 0) would pass vacuously. This floor would not.
    expect(WARD_VIEWS.length).toBeGreaterThan(0);
    expect(WARD_NAV.length).toBeGreaterThan(0);

    renderShell();
    const links = screen.getAllByTestId("ward-rail-link");
    expect(links.length).toBeGreaterThan(0);
  });
});

/* ── 2. Escape does NOT clear the Service selector — the value survives ──────────────────────── */

describe("assertion 2 — Escape never clears the Service selector", () => {
  it("closes the Service popup when search takes focus without changing the chosen service", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByTestId("ward-bar-service-trigger"));
    await user.click(screen.getByRole("button", { name: "South Metro" }));
    await user.click(screen.getByTestId("ward-bar-service-trigger"));
    expect(screen.getByRole("group", { name: "Choose a health service" })).toBeInTheDocument();
    await user.click(screen.getByRole("textbox", { name: "Search" }));
    expect(screen.queryByRole("group", { name: "Choose a health service" })).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-bar-service-trigger")).toHaveTextContent("South Metro");
  });

  it("keeps the chosen service after repeated Escape presses", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByTestId("ward-bar-service-trigger"));
    await user.click(screen.getByRole("button", { name: "South Metro" }));

    const trigger = screen.getByTestId("ward-bar-service-trigger");
    expect(trigger).toHaveTextContent("South Metro");

    // Several presses, not one — the standard is explicit that a FURTHER press still answers
    // ("Nothing more to clear") rather than the second press finally getting through.
    await user.keyboard("{Escape}");
    expect(trigger).toHaveTextContent("South Metro");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveTextContent("South Metro");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveTextContent("South Metro");
  });

  it("still announces the Escape press rather than doing nothing", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByTestId("ward-bar-service-trigger"));
    await user.click(screen.getByRole("button", { name: "East Metro" }));
    await user.keyboard("{Escape}");

    const live = screen.getByTestId("ward-live-region");
    expect(live.textContent ?? "").toContain("Nothing more to clear");
    expect(live.textContent ?? "").toContain("East Metro");
  });
});

/* ── 3. each drawer traps focus, and Escape closes in the documented order ───────────────────── */

// Mirrors `sheet.tsx:283-296`'s own candidate filter exactly, so the test can compute the SAME
// focusable order the trap itself computes, rather than guessing at the drawer's contents.
const SHEET_FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function focusableWithin(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(SHEET_FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.tabIndex >= 0 &&
      !element.closest('[aria-hidden="true"], [inert]') &&
      element.getClientRects().length > 0,
  );
}

describe("assertion 3 — drawer focus trap and Escape order", () => {
  it.each([
    ["Activity", "ward-bar-activity-trigger"],
    ["Tasks", "ward-bar-tasks-trigger"],
    ["Tools", "ward-bar-tools-trigger"],
  ])("%s opens as a modal dialog and traps focus inside its panel", async (name, triggerTestId) => {
    // 🔴 Round-1 review, Critical 3: jsdom's own `getClientRects` always returns an empty list, so
    // `Sheet`'s own trap filter (`sheet.tsx:295`, "candidates with a rendered box") saw zero
    // candidates and returned at `focusable.length === 0` before moving anything — and a synthetic
    // Tab keydown never moves focus in jsdom by itself, so `dialog.contains(document.activeElement)`
    // stayed true for the entire 50 presses whether or not the trap existed at all. This is the
    // same idiom `tests/sheet-focus.dom.test.tsx:262-266` already uses to give the trap something
    // to work with, applied here rather than reinvented.
    const getClientRectsSpy = vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (
      this: HTMLElement,
    ) {
      return {
        length: this.closest("[hidden]") ? 0 : 1,
        item: () => null,
        [Symbol.iterator]: function* () {
          yield {} as DOMRect;
        },
      } as DOMRectList;
    });

    try {
      const user = userEvent.setup();
      renderShell();

      const trigger = screen.getByTestId(triggerTestId);
      await user.click(trigger);

      const dialog = await screen.findByRole("dialog", { name: new RegExp(name) });
      expect(dialog).toHaveAttribute("aria-modal", "true");

      await waitFor(() => {
        expect(dialog.contains(document.activeElement)).toBe(true);
      });

      const focusable = focusableWithin(dialog);
      // Anti-vacuity floor: every one of the three drawers renders at least its own close control,
      // so an empty list here means the mock above stopped working, not that the drawer is bare.
      expect(focusable.length).toBeGreaterThan(0);

      // Tab forward through the panel's own focusable order, twice around (a trap that leaks only
      // on the SECOND lap — a stale list, an off-by-one on wraparound — is still caught). Asserting
      // the EXACT next control, not merely "still inside the dialog", is what makes this able to
      // fail: without a working trap, `document.activeElement` never moves at all (jsdom does not
      // implement native Tab focus movement), so it would stop matching `focusable[expectedIndex]`
      // on the very first press for any drawer with more than one control.
      for (let lap = 0; lap < 2; lap += 1) {
        for (let i = 0; i < focusable.length; i += 1) {
          const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
          const expectedIndex = (currentIndex + 1) % focusable.length;
          pressTab();
          expect(dialog.contains(document.activeElement)).toBe(true);
          expect(document.activeElement).toBe(focusable[expectedIndex]);
        }
      }

      // Shift+Tab must wrap the other way, landing on the PREVIOUS control each time.
      for (let lap = 0; lap < 2; lap += 1) {
        for (let i = 0; i < focusable.length; i += 1) {
          const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
          const expectedIndex = (currentIndex - 1 + focusable.length) % focusable.length;
          pressTab(true);
          expect(dialog.contains(document.activeElement)).toBe(true);
          expect(document.activeElement).toBe(focusable[expectedIndex]);
        }
      }
    } finally {
      getClientRectsSpy.mockRestore();
    }
  });

  it("Escape closes the open drawer first (the documented order's first step) and returns focus to its trigger", async () => {
    const user = userEvent.setup();
    renderShell();

    const trigger = screen.getByTestId("ward-bar-tools-trigger");
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: /Tools/ });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /Tools/ })).not.toBeInTheDocument();
    });
    // ⚠️ **THE RETURN OF FOCUS IS DEFERRED BY DESIGN, SO IT CANNOT BE READ IN THE SAME TICK AS
    //  THE CLOSE.** The dialog is gone in the very commit whose effect cleanup runs; that cleanup
    //  only *schedules* the restore — `requestAnimationFrame`, with a 50 ms `setTimeout` retry
    //  behind it (`sheet.tsx`'s restore block). The `waitFor` above therefore resolves in the gap
    //  between "dialog removed" and "frame fired", and a bare
    //  `expect(document.activeElement).toBe(trigger)` here read that gap and saw `document.body`.
    //  It passed only while the frame happened to win the race and lost whenever the same vitest
    //  process was busy — which is why it went red the moment a second file was handed to the
    //  same run and stayed green when this file was run on its own.
    //  🔴 **This still FAILS if focus never returns**: `waitFor` re-runs the same equality until it
    //  holds or the timeout expires, so it waits for the restore rather than assuming it. Proved by
    //  delaying `requestAnimationFrame` on purpose — the bare assertion went red with the exact
    //  original message ("expected <body style> to be <button>"), this one stayed green.
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("an open drawer is the FIRST thing Escape acts on — the service survives the same press that closes it", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByTestId("ward-bar-service-trigger"));
    await user.click(screen.getByRole("button", { name: "North Metro" }));

    await user.click(screen.getByTestId("ward-bar-tools-trigger"));
    await screen.findByRole("dialog", { name: /Tools/ });

    await user.keyboard("{Escape}");

    // The drawer closed — that was the whole press.
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /Tools/ })).not.toBeInTheDocument();
    });
    // The service was NOT touched by the same press that closed the drawer.
    expect(screen.getByTestId("ward-bar-service-trigger")).toHaveTextContent("North Metro");
  });
});

/* ── 7. anti-vacuity floor, drawers ───────────────────────────────────────────────────────────── */

describe("assertion 7 — anti-vacuity floor, drawers", () => {
  it("fails if the drawer list is empty: exactly the three named drawers are present", () => {
    renderShell();
    const drawerTriggers = [
      screen.getByTestId("ward-bar-activity-trigger"),
      screen.getByTestId("ward-bar-tasks-trigger"),
      screen.getByTestId("ward-bar-tools-trigger"),
    ];
    expect(drawerTriggers.length).toBeGreaterThan(0);
    expect(drawerTriggers).toHaveLength(3);
  });
});

describe("task movement navigation", () => {
  it("closes the Tasks drawer before routing from a task row", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByTestId("ward-bar-tasks-trigger"));
    const task = await screen.findByTestId("ward-task-bed-pull-WF-004");
    await user.click(task);

    expect(mockRouterPush).toHaveBeenCalledWith("/mockups/ward-flow/movements/WF-004");
    expect(screen.queryByTestId("ward-bar-tasks-sheet")).not.toBeInTheDocument();
  });
});

/*
 * ── Tasks drawer role gating, audit finding STILL-06 (ward-flow-task-ledger.md §6.3 item 5, 2026-09-16) ──
 *
 * `ACKNOWLEDGE_INBOX_ITEM`/`COMPLETE_INBOX_ITEM`/`REOPEN_INBOX_ITEM` are all `EVENT_ROLE`-gated to
 * `"coordinator"` alone (`ward-flow-events.ts`), and `wardTasksAreActionableForRole`
 * (`ward-chrome-role.ts`) exists to say so — but nothing in `ward-bar.tsx` called it, so a ward or
 * ED route mounted `WardTasksDrawer` (which trusts its caller and does not re-check role, by its
 * own doc comment) with the full network-wide action inbox and a non-zero badge, and every
 * Acknowledge press there was silently refused by the reducer. These tests pin the fix: the trigger
 * still renders everywhere (the drawing and `ui-ward-chrome-header.spec.ts` require it), but the
 * network inbox, its count and any acknowledge affordance are coordinator-only.
 */
describe("assertion 8 — Tasks drawer network inbox is coordinator-only", () => {
  it("shows the coordinator route's real network inbox with its items and an Acknowledge affordance", async () => {
    const user = userEvent.setup();
    renderShell();

    const badge = within(screen.getByTestId("ward-bar-tasks-trigger")).getByText(/^\d+$/);
    expect(Number(badge.textContent)).toBeGreaterThan(0);

    await user.click(screen.getByTestId("ward-bar-tasks-trigger"));
    expect(await screen.findByTestId("ward-task-bed-pull-WF-004")).toBeTruthy();
  });

  it("hides the network inbox, zeroes the badge, and offers no Acknowledge affordance on a ward route", async () => {
    const user = userEvent.setup();
    route.pathname = "/mockups/ward-flow/ward/rph-adult-secure/answer";
    renderShell();

    const badge = within(screen.getByTestId("ward-bar-tasks-trigger")).getByText(/^\d+$/);
    expect(badge.textContent).toBe("0");

    await user.click(screen.getByTestId("ward-bar-tasks-trigger"));
    expect(screen.queryByTestId("ward-task-bed-pull-WF-004")).toBeNull();
    expect(screen.queryByRole("button", { name: /acknowledge/i })).toBeNull();
  });

  it("hides the network inbox on an ED route too", async () => {
    const user = userEvent.setup();
    route.pathname = "/mockups/ward-flow/ed/answer";
    renderShell();

    const badge = within(screen.getByTestId("ward-bar-tasks-trigger")).getByText(/^\d+$/);
    expect(badge.textContent).toBe("0");

    await user.click(screen.getByTestId("ward-bar-tasks-trigger"));
    expect(screen.queryByTestId("ward-task-bed-pull-WF-004")).toBeNull();
    expect(screen.queryByRole("button", { name: /acknowledge/i })).toBeNull();
  });
});

/* ── 4. the reconciliation sentence appears exactly ONCE per page ────────────────────────────── */

// Round-2 review, Important 1 read the sentence disappearing below 1000px as a CSS width band
// this file's own media query genuinely governed, and fixed it by giving `ward-bar.tsx` a SECOND,
// always-mounted instance of `WardReconciliationLine`. `task-4-findings-round3.md` measured that
// premise false in a real browser: `ward-rail.module.css`'s `.railFoot { display: none }` inside
// its `@media (max-width: 1000px)` block never won the cascade at all — a bare `.railFoot {
// display: flex }` rule further down the same file shared the same specificity and came later, so
// CSS's own "later wins" rule made the media rule dead on arrival. The sentence never read zero;
// with round 2's second instance added on top of that, it read TWICE at every width ≤1000px.
//
// Round 3's fix is structural rather than CSS-dependent: `WardReconciliationLine` now mounts as a
// sibling of `.railFoot` in `ward-rail.tsx`, not a child of it, so no rule that hides the foot can
// reach it, regardless of whether that rule's own ordering is ever right or wrong again. That
// claim needs no viewport simulation and no stylesheet loaded into jsdom to prove — the tests
// below assert it directly from the rendered DOM, at the one instance the shell now has. Whether
// `.railFoot` itself (the disclaimer and the toggle) actually disappears below 1000px remains
// CSS-only and outside what this file can measure — see assertion 8 below, the static ordering
// guard that catches exactly the class of bug this section describes, and `task-4-report-
// round3.md` for what was read from the cascade rather than measured in a browser.
describe("assertion 4 — the reconciliation sentence appears exactly once per page", () => {
  it("renders the reconciled sentence exactly once when every check passes", () => {
    renderShell(OK_CHECKS);
    const matches = screen.getAllByText((_content, element) =>
      (element?.textContent ?? "").includes("Invented figures, reconciled with each other"),
    );
    // Several DOM nodes can carry the same text via ancestor/descendant text matching — collapse
    // to the elements that own the sentence directly (the reconciliation line's own <p>), which
    // is the count that actually answers "does this sentence appear once on the page".
    const owners = matches.filter((element) => element.getAttribute("data-testid") === "ward-reconciliation-line");
    expect(owners).toHaveLength(1);
  });

  it("renders the disagreement sentence exactly once when a check fails — never the reconciled one", () => {
    renderShell(FAILING_CHECKS);
    const reconciled = screen.queryAllByText(
      (_content, element) => (element?.textContent ?? "") === "Invented figures, reconciled with each other.",
    );
    expect(reconciled).toHaveLength(0);

    const line = screen.getByTestId("ward-reconciliation-line");
    expect(line.textContent ?? "").toContain("Invented figures, 1 figure does not reconcile");
  });

  it("stays exactly once even while the Activity drawer (which reflects the same checks) is open", async () => {
    const user = userEvent.setup();
    renderShell(OK_CHECKS);

    await user.click(screen.getByTestId("ward-bar-activity-trigger"));
    await screen.findByRole("dialog", { name: /Activity/ });

    const owners = screen
      .getAllByText((_content, element) =>
        (element?.textContent ?? "").includes("Invented figures, reconciled with each other"),
      )
      .filter((element) => element.getAttribute("data-testid") === "ward-reconciliation-line");
    expect(owners).toHaveLength(1);
  });

  // Round-1 review, Important 6: `WardReconciliationLine` used to render only when the rail's
  // remembered preference was "open" (`ward-rail.tsx`'s own `{open ? <WardReconciliationLine ...>
  // : null}`), so with the stored preference "closed" the sentence appeared ZERO times — and this
  // very describe block's other tests never caught it because `renderShell` always mounts with
  // the rail's default (open) preference. This test seeds the same `localStorage` key the rail
  // reads (`ward-rail.tsx`'s `RAIL_OPEN_STORAGE_KEY`) to "closed" before rendering, the one
  // documented way to start the rail collapsed.
  it("still renders the reconciliation sentence exactly once when the rail's remembered preference is closed", () => {
    window.localStorage.setItem("ward-flow-rail", "closed");
    try {
      renderShell(OK_CHECKS);
      const owners = screen
        .getAllByText((_content, element) =>
          (element?.textContent ?? "").includes("Invented figures, reconciled with each other"),
        )
        .filter((element) => element.getAttribute("data-testid") === "ward-reconciliation-line");
      expect(owners).toHaveLength(1);
    } finally {
      window.localStorage.removeItem("ward-flow-rail");
    }
  });
});

// Round-2 review, Important 2: the drawing's own closed `#railCheck` carries `title="<the
// sentence>"` so a sighted mouse user hovering the compact dot still gets the word, not colour
// alone (standard §9: "No colour is the only carrier of any state"). The port had this on
// neither element before this fix. Unlike round-1's CSS-only findings, a `title` attribute is a
// plain DOM property jsdom renders exactly like a browser would, so — unlike assertion 4's bar
// instance above — this one IS fully testable, and is tested rather than merely read.
describe("round-2 review, Important 2 — the closed rail strip's sighted-user path", () => {
  it("gives the compact (closed-rail) reconciliation line a title carrying the sentence", () => {
    window.localStorage.setItem("ward-flow-rail", "closed");
    try {
      renderShell(OK_CHECKS);
      const line = screen.getByTestId("ward-reconciliation-line");
      expect(line).toHaveAttribute("title", "Invented figures, reconciled with each other.");
    } finally {
      window.localStorage.removeItem("ward-flow-rail");
    }
  });

  it("carries no title in the open (non-compact) shape, matching the drawing's own open branch", () => {
    renderShell(OK_CHECKS);
    const line = screen.getByTestId("ward-reconciliation-line");
    expect(line).not.toHaveAttribute("title");
  });
});

/* ── BRIEF-mount-wiring.md item 1 — an empty checks array must never read as reconciled ───────── */

// Activity's green status now means current synthetic events are available. It must not be read as
// a reconciliation verdict. Real published checks remain available in a compact disclosure, while
// silence and an explicitly empty publication both make no agreement claim here; the rail retains
// their distinct fixed sentences.
function renderBarOnly(checks?: WardReconciliationCheck[]) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardLiveRegion />
      {checks === undefined ? null : <ChecksPublisher checks={checks} />}
      <WardBar />
    </WardFlowProvider>,
  );
}

describe("Activity distinguishes demo provenance from published figure checks", () => {
  it("labels Command activity as synthetic demo state without claiming reconciliation", () => {
    renderBarOnly();
    const trigger = screen.getByTestId("ward-bar-activity-trigger");
    expect(trigger.textContent ?? "").toContain("synthetic activity");
    expect(trigger).not.toHaveTextContent(/\d{1,2}:\d{2}/u);
    expect(trigger.textContent ?? "").not.toMatch(/reconcil/i);
    expect(trigger.querySelector('[data-tone][aria-hidden="true"]')).toBeNull();
  });

  it("does not invent a figure-check result when no screen has published", async () => {
    const user = userEvent.setup();
    renderBarOnly();

    await user.click(screen.getByTestId("ward-bar-activity-trigger"));
    const dialog = await screen.findByRole("dialog", { name: /Activity/ });

    expect(within(dialog).getByText(/Synthetic state · demo time/)).toBeInTheDocument();
    expect(within(dialog).queryByTestId("ward-bar-figure-checks")).not.toBeInTheDocument();
    expect(dialog.textContent ?? "").not.toMatch(/reconcil/i);
  });

  it("still publishes no figure-check agreement when a screen reports an empty check list", async () => {
    const user = userEvent.setup();
    renderBarOnly([]);

    await user.click(screen.getByTestId("ward-bar-activity-trigger"));
    const dialog = await screen.findByRole("dialog", { name: /Activity/ });

    expect(within(dialog).queryByTestId("ward-bar-figure-checks")).not.toBeInTheDocument();
    expect(dialog.textContent ?? "").not.toMatch(/reconcil/i);
  });

  it("keeps real provided checks discoverable inside Activity", async () => {
    const user = userEvent.setup();
    renderBarOnly(OK_CHECKS);

    await user.click(screen.getByTestId("ward-bar-activity-trigger"));
    const dialog = await screen.findByRole("dialog", { name: /Activity/ });
    const checks = within(dialog).getByTestId("ward-bar-figure-checks");
    expect(within(checks).getByText("Figure checks · 2 of 2 reconcile")).toBeInTheDocument();
    expect(checks.textContent ?? "").toContain("Open movements sum to the rail's tally · Reconciles");
    expect(checks.textContent ?? "").toContain("Referrals waiting sum to the queue · Reconciles");
  });

  it("keeps a failed provided check explicit", async () => {
    const user = userEvent.setup();
    renderBarOnly(FAILING_CHECKS);

    await user.click(screen.getByTestId("ward-bar-activity-trigger"));
    const dialog = await screen.findByRole("dialog", { name: /Activity/ });
    const checks = within(dialog).getByTestId("ward-bar-figure-checks");
    expect(within(checks).getByText("Figure checks · 1 of 2 reconcile")).toBeInTheDocument();
    expect(checks.textContent ?? "").toContain("Referrals waiting sum to the queue · Does not reconcile");
  });
});

/* ── 5. the demonstration controls are reachable from the Tools drawer ───────────────────────── */

describe("assertion 5 — demonstration controls reachable from Tools", () => {
  it("restores the saved appearance when the shell mounts after a reload", () => {
    applyAppearance("dark");
    document.documentElement.removeAttribute("data-theme");
    try {
      renderShell();
      expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    } finally {
      act(() => applyAppearance("auto"));
    }
  });

  it("hydrates the silent live region without an unstable server snapshot", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<WardLiveRegion />);
    document.body.append(container);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    let root: Root | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(container, <WardLiveRegion />);
      });
      expect(errors.mock.calls.flat().join(" ")).not.toContain("getServerSnapshot should be cached");
      expect(container.textContent).toBe("");
    } finally {
      await act(async () => root?.unmount());
      container.remove();
      errors.mockRestore();
    }
  });

  it("keeps scenario controls and the role switcher under Shift desk while account utilities stay out", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByTestId("ward-bar-tools-trigger"));
    const dialog = await screen.findByRole("dialog", { name: /Tools/ });
    const withinDialog = within(dialog);

    expect(withinDialog.queryByRole("button", { name: /^Demo$/ })).toBeNull();
    await user.click(withinDialog.getByRole("button", { name: /^Shift desk$/ }));
    expect(withinDialog.getByTestId("ward-demo-controls-trigger")).toBeVisible();
    expect(withinDialog.queryByRole("link", { name: "Exit to developer hub" })).not.toBeInTheDocument();
    expect(withinDialog.queryByRole("group", { name: "Appearance" })).not.toBeInTheDocument();
    // The role switcher renders its own labelled control — asserting the heading it sits under
    // proves the section rather than reaching into its internals.
    expect(withinDialog.getByText("Scenario controls")).toBeInTheDocument();
  });

  it("reaches Appearance and Settings from the rail's role controls", async () => {
    renderShell();

    const appearance = screen.getByRole("group", { name: "Appearance" });
    expect(within(appearance).getByRole("button", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/mockups/ward-flow/settings");
  });
});

/* ── 6. no text below 12px in the shell's CSS module ──────────────────────────────────────────── */

describe("assertion 6 — no text below 12px in the shell's CSS modules", () => {
  const shellDir = join(process.cwd(), "src/components/ward-management/shell");
  // The token DEFINITIONS live beside `src/app/ckb-v2-tokens.css`, not under `shell/` — see
  // `ward-flow-shell-tokens.module.css`'s own header comment: `tests/ward-raw-colour.test.ts`
  // fails on any literal colour under `src/components/ward-management/`, and the third edition's
  // palette is a new closed system rather than an alias of the app's existing v2 tokens, so its
  // raw values had to be written down somewhere outside that guard's scanned tree.
  const tokensFile = join(process.cwd(), "src/app/ward-flow-shell-tokens.module.css");
  const cssFiles = ["ward-rail.module.css", "ward-bar.module.css", "ward-reconciliation-line.module.css"];

  function toPx(value: string): number | null {
    const remMatch = /^(-?[\d.]+)rem$/.exec(value);
    if (remMatch) return Number.parseFloat(remMatch[1]) * 16;
    const pxMatch = /^(-?[\d.]+)px$/.exec(value);
    if (pxMatch) return Number.parseFloat(pxMatch[1]);
    return null;
  }

  it("every --t-* token in ward-flow-shell-tokens.module.css is at least 12px", () => {
    const css = readFileSync(tokensFile, "utf8");
    const tokenMatches = [...css.matchAll(/--t-\d:\s*([\d.]+(?:px|rem));/g)];
    expect(tokenMatches.length).toBeGreaterThan(0);
    for (const match of tokenMatches) {
      const px = toPx(match[1]);
      expect(px, `token value ${match[1]} did not parse`).not.toBeNull();
      expect(px as number).toBeGreaterThanOrEqual(12);
    }
  });

  // Round-1 review, Minor 10: this test used to skip any value `toPx` could not parse as a
  // literal length ("var(...) or a keyword — not a literal length"), and every single declaration
  // in these three files IS a `var(--t-N)` reference — so the loop below ran 0 real assertions on
  // every pass, and `font-size: var(--text-xs)` (a literal, forbidden step off the seven-step
  // scale, per this repo's own `--text-3xs`/`--text-2xs` ban) would have passed it too, having
  // parsed as neither a literal length nor been checked against the token pattern at all. Fixed to
  // require the token form outright and to fail if the file set carries no declarations to check.
  it("every font-size declaration across the shell's CSS modules is a --t-N token reference", () => {
    let totalDeclarations = 0;
    for (const file of cssFiles) {
      const css = readFileSync(join(shellDir, file), "utf8");
      const declarations = [...css.matchAll(/font-size:\s*([^;]+);/g)];
      totalDeclarations += declarations.length;
      for (const [, raw] of declarations) {
        // Priority is separate from the value; portalled Sheet overrides still use the same scale.
        const value = raw.trim().replace(/\s*!important$/u, "");
        expect(value, `${file} declares font-size: ${value}, not a --t-N token`).toMatch(/^var\(--t-\d+\)$/);
      }
    }
    // The floor this test lacked: if every file above stopped declaring font-size at all, the
    // loop would pass having asserted nothing, the exact shape of the defect just fixed.
    expect(totalDeclarations).toBeGreaterThan(0);
  });
});

/* ── 8. round-3 review, Important B — the guard that would have caught round 2's false premise ── */

// `task-4-findings-round3.md`: round 2's fix rested on `ward-rail.module.css`'s own
// `@media (max-width: 1000px) { .railFoot { display: none } }` actually winning the cascade below
// 1000px. It never did — a bare `.railFoot { display: flex; ... }` 117 lines further down the
// same file shares the same specificity and comes later, so CSS's own "later wins at equal
// specificity" rule made the media rule dead on arrival. The sentence never read zero; it read
// TWICE at every width ≤1000px once round 2 added a second, always-mounted copy elsewhere,
// believing the first had gone silent. No test in this file could have caught it — this project's
// Vitest config never loads a stylesheet into jsdom (assertion 4's own header comment says so at
// length) — so the only place this class of bug is visible to a fast, offline check is the
// stylesheet's own source text, read in file order.
//
// This is a small hand-rolled parser, not a CSS AST library: the three files below nest at most
// one level (`@media { selector { decl: value; } }`, never `@media` inside `@media`, never a
// selector inside a selector), so a brace-depth walk recovers everything the check needs — each
// rule's file order, whether it sits inside ANY `@media` block, its selector list, and the
// property names it declares — and nothing a full parser would add on top.
describe("assertion 8 — round-3 review, Important B: no media-set `display` is defeated by a later bare rule", () => {
  const shellDir = join(process.cwd(), "src/components/ward-management/shell");
  /**
   * DERIVED from the directory, never hand-listed. The first version of this guard named three
   * stylesheets by hand and `shell/` already held FOUR - `ward-shell-tokens.module.css` was
   * unguarded from the day it was written, and nothing could have told you: a hand-maintained
   * list under-covers silently and its own green is the proof it offers. Task 1 adds files here.
   */
  const cssFiles = readdirSync(shellDir)
    .filter((name) => name.endsWith(".css"))
    .sort();

  type FlatRule = { order: number; inMedia: boolean; selectors: string[]; properties: string[] };

  function findMatchingBrace(css: string, openIndex: number): number {
    let depth = 1;
    for (let i = openIndex + 1; i < css.length; i++) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") {
        depth -= 1;
        if (depth === 0) return i;
      }
    }
    throw new Error("unbalanced braces in stylesheet fixture");
  }

  // Walks a span of CSS text, recording every leaf rule (selector list + declaration block) it
  // finds, and recursing one level into any `@media` at-rule it meets along the way. `inMedia`
  // marks every rule found underneath ANY `@media` condition — the defect this guard hunts is not
  // specific to `max-width`, only to a media rule losing to a later unconditional one.
  function flattenRules(cssRaw: string): FlatRule[] {
    const css = cssRaw.replace(/\/\*[\s\S]*?\*\//g, "");
    const rules: FlatRule[] = [];
    let order = 0;

    function walk(text: string, start: number, end: number, inMedia: boolean) {
      let i = start;
      while (i < end) {
        while (i < end && /\s/.test(text[i] ?? "")) i += 1;
        if (i >= end) break;
        const braceOpen = text.indexOf("{", i);
        if (braceOpen === -1 || braceOpen >= end) break;
        const head = text.slice(i, braceOpen).trim();
        const braceClose = findMatchingBrace(text, braceOpen);
        if (head.startsWith("@media")) {
          walk(text, braceOpen + 1, braceClose, true);
        } else {
          const declText = text.slice(braceOpen + 1, braceClose);
          const selectors = head
            .split(",")
            .map((selector) => selector.trim())
            .filter(Boolean);
          const properties = [...declText.matchAll(/([a-zA-Z-]+)\s*:/g)].map((match) => match[1]!.trim());
          rules.push({ order: order++, inMedia, selectors, properties });
        }
        i = braceClose + 1;
      }
    }

    walk(css, 0, css.length, false);
    return rules;
  }

  function findDefeatedDisplayRules(cssRaw: string): string[] {
    const rules = flattenRules(cssRaw);
    const defeatedSelectors: string[] = [];
    for (const mediaRule of rules) {
      if (!mediaRule.inMedia || !mediaRule.properties.includes("display")) continue;
      for (const selector of mediaRule.selectors) {
        const overriddenByLaterBareRule = rules.some(
          (candidate) =>
            !candidate.inMedia &&
            candidate.order > mediaRule.order &&
            candidate.properties.includes("display") &&
            candidate.selectors.includes(selector),
        );
        if (overriddenByLaterBareRule) defeatedSelectors.push(selector);
      }
    }
    return defeatedSelectors;
  }

  it("the parser itself: a media-set display defeated by a later bare rule is found; an undefeated one is not", () => {
    const sample = `
      @media (max-width: 1000px) {
        .foo { display: none; }
        .safe { display: none; }
      }
      .foo { width: 1px; display: flex; }
      .untouched { color: red; }
    `;
    expect(findDefeatedDisplayRules(sample)).toEqual([".foo"]);
  });

  /**
   * ANTI-VACUITY, and it has to be RELATIVE rather than a constant. An emptied stylesheet passes
   * the per-file assertion below - the parser finds no rules, so it reports no defeated ones - and
   * a constant floor only ever catches the LAST unit that stops being measured. So: every file
   * found must be non-trivial, and at least one media block must exist across the set, because a
   * guard about media-set declarations inspecting a set with no media blocks is inspecting nothing.
   */
  it("the ordering guard has stylesheets with media blocks to inspect", () => {
    expect(cssFiles.length, `no .css found in ${shellDir}`).toBeGreaterThan(0);
    const bodies = cssFiles.map((file) => readFileSync(join(shellDir, file), "utf8"));
    const empty = cssFiles.filter((_, i) => bodies[i].trim().length < 100);
    expect(empty, `stylesheet(s) too small to carry a rule: ${empty.join(", ") || "(none)"}`).toEqual([]);
    const withMedia = cssFiles.filter((_, i) => /@media[^{]*\{/.test(bodies[i]));
    expect(
      withMedia.length,
      "no @media block anywhere in shell/ - this guard would be inspecting nothing",
    ).toBeGreaterThan(0);
  });

  for (const file of cssFiles) {
    it(`${file} carries no media-set display defeated by a later bare rule`, () => {
      const css = readFileSync(join(shellDir, file), "utf8");
      const defeatedSelectors = findDefeatedDisplayRules(css);
      expect(
        defeatedSelectors,
        `${file}: display set in a media block is overridden by a later bare rule for ${defeatedSelectors.join(", ") || "(none)"}`,
      ).toEqual([]);
    });
  }
});

/* ── 9. item 43 (build plan A1) — the three unwired primary-action kinds open a popover whose
      visible text reads EXACTLY "Not wired in this prototype.", not only an SR-only announcement ── */

describe("assertion 9 — item 43: the unwired primary action shows visible text, and Escape closes it", () => {
  /**
   * `/movements`, `/community/<a real team id>` and `/statistics` — the brief's own three routes,
   * one for each of the three kinds `ward-nav.ts`'s `WARD_PRIMARY_ACTIONS` resolves no `href` for
   * (`resolveWardPrimaryAction`, confirmed by the anti-vacuity test just below rather than assumed).
   * The community route uses `COMMUNITY_TEAM_PAGES[0].id` — a REAL derived team slug, never a
   * hand-typed placeholder id that could stop matching `ward-nav.ts`'s dynamic-route pattern.
   */
  const UNWIRED_PRIMARY_ROUTES: ReadonlyArray<readonly [string, string]> = [
    ["/mockups/ward-flow/movements", "Record a decision"],
    [`/mockups/ward-flow/community/${COMMUNITY_TEAM_PAGES[0]!.id}`, "Contact a team"],
    ["/mockups/ward-flow/statistics", "Export the figures"],
  ];

  // Unlike `renderShell()` above, this resolves and passes `primaryAction` for the given route —
  // `renderShell()` renders `<WardBar />` bare, which is why no earlier test in this file exercises
  // the primary-action area at all.
  function renderShellAt(pathname: string) {
    route.pathname = pathname;
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardLiveRegion />
        <ChecksPublisher checks={OK_CHECKS} />
        <WardRail />
        <WardBar primaryAction={resolveWardPrimaryAction(pathname)} />
      </WardFlowProvider>,
    );
  }

  it("anti-vacuity: the three routes actually resolve the three kinds this test claims to cover", () => {
    for (const [pathname, label] of UNWIRED_PRIMARY_ROUTES) {
      const action = resolveWardPrimaryAction(pathname);
      expect(action, `${pathname} resolved no primary action at all`).toBeDefined();
      if (!action || action.kind === "none") {
        throw new Error(`${pathname} resolved kind "none" or nothing, expected "${label}"`);
      }
      expect(action.label).toBe(label);
    }
  });

  it.each(UNWIRED_PRIMARY_ROUTES)(
    "on %s, clicking the unwired primary action shows the visible text exactly " +
      '"Not wired in this prototype.", and Escape closes it with focus returning to the button',
    async (pathname, label) => {
      const user = userEvent.setup();
      renderShellAt(pathname);

      const trigger = screen.getByTestId("ward-bar-primary-action");
      expect(trigger).toHaveTextContent(label);
      expect(screen.queryByTestId("ward-bar-primary-panel")).toBeNull();

      await user.click(trigger);

      const panel = screen.getByTestId("ward-bar-primary-panel");
      // Exact text, not a substring match on a longer sentence — the constraint is the VISIBLE
      // words are exactly this, nothing prepended and nothing appended.
      const note = within(panel).getByText("Not wired in this prototype.");
      expect(note.textContent).toBe("Not wired in this prototype.");

      // The SR-only announcement is unchanged (build plan §3): the fuller sentence still reaches
      // the live region, distinct from the shorter visible panel text asserted above.
      expect(screen.getByTestId("ward-live-region").textContent ?? "").toBe(`${label} is not wired in this prototype.`);

      await user.keyboard("{Escape}");

      expect(screen.queryByTestId("ward-bar-primary-panel")).toBeNull();
      expect(document.activeElement).toBe(trigger);
    },
  );
});

describe("computeShiftProgress", () => {
  it("computes shift progress correctly for Instant numbers without calling getUTCHours on a number", () => {
    // 10:42 AM is minute 642. Day shift: 07:00 (420) to 15:00 (900), duration 480 mins.
    // Elapsed: 642 - 420 = 222 mins (3h 42m). Percent: round(222/480*100) = 46%.
    // Remaining: 900 - 642 = 258 mins (4h 18m).
    const result = computeShiftProgress(642);
    expect(result.elapsedHours).toBe(3);
    expect(result.elapsedMins).toBe(42);
    expect(result.percent).toBe(46);
    expect(result.countdownStr).toBe("4h 18m");
  });

  it("handles shift wrap and rollover correctly", () => {
    // 06:00 AM (360) is during Night shift (23:00–07:00), 1h before handover
    const early = computeShiftProgress(360);
    expect(early.shiftTitle).toBe("Night Shift (23:00–07:00)");
    expect(early.elapsedHours).toBe(7);
    expect(early.elapsedMins).toBe(0);
    expect(early.countdownStr).toBe("1h 0m");

    // 16:00 PM (960) is during Evening shift (15:00–23:00), 7h before handover
    const late = computeShiftProgress(960);
    expect(late.shiftTitle).toBe("Evening Shift (15:00–23:00)");
    expect(late.countdownStr).toBe("7h 0m");
    expect(late.countdownStr).not.toBe("3h 38m");
    expect(late.percent).toBe(13);

    // Handover due within final 15 minutes of shift (e.g. 14:55 = minute 895)
    const handover = computeShiftProgress(895);
    expect(handover.shiftTitle).toBe("Day Shift (07:00–15:00)");
    expect(handover.countdownStr).toBe("Handover Due");
  });

  it("handles Date objects and undefined gracefully", () => {
    const fromDate = computeShiftProgress(new Date("2026-09-17T02:42:00Z")); // 10:42 AWST (UTC+8)
    expect(fromDate.elapsedHours).toBe(3);
    expect(fromDate.elapsedMins).toBe(42);

    const fromUndefined = computeShiftProgress(undefined);
    expect(typeof fromUndefined.percent).toBe("number");
    expect(typeof fromUndefined.countdownStr).toBe("string");
  });
});
