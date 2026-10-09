import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md`, task S2 (item 44 — the
 * service chooser). This is the catcher for three things at once, per S2's own brief:
 *
 * 1. `shell/ward-service-store.ts` — the `sessionStorage`-backed module store the chosen health
 *    service now lives in, replacing `ward-bar.tsx`'s old component-local `useState`.
 * 2. `ward-bar.tsx`'s Service selector, wired to that store: no "not wired" text left in the
 *    panel, each option's own open-movement count agreeing with `ward-service-scope.ts` (S1) over
 *    the real seed, and the exact build-plan §3 Escape sentence.
 * 3. `shell/ward-service-scope-bar.tsx` — the reusable "Showing N of M..., in {S}" strip a later
 *    screen lane mounts. Tested standalone here: no screen mounts it yet ("Don't scope any screen
 *    yet" — S2's own brief), so this file is its only exercise until a screen lane wires it in.
 *
 * Also pins the S2 fix for a real race in the shared outside-click-close effect (`ward-bar.tsx`,
 * inside this file's own owned range): a second click on a popover's OWN trigger used to close it
 * on `mousedown` and then reopen it from the trigger's own `onClick`, so one click that looked like
 * "nothing happened" actually closed and reopened in the same gesture — see the two tests under
 * "the outside-click-close race" below, and `ward-bar.tsx`'s own comment at the fixed effect for
 * the full mechanism.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const route = { pathname: "/mockups/ward-flow" };
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { WardBar } from "@/components/ward-management/shell/ward-bar";
import { WardLiveRegion, resetWardLiveRegionForTests } from "@/components/ward-management/shell/ward-live-region";
import {
  SERVICE_SCOPE_STORAGE_KEY,
  resetServiceScopeForTests,
  setServiceScope,
  useServiceScope,
} from "@/components/ward-management/shell/ward-service-store";
import { WardServiceScopeBar } from "@/components/ward-management/shell/ward-service-scope-bar";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { WARD_HOME_HREF, resolveWardPrimaryAction } from "@/components/ward-management/ward-nav";
import { movementBelongsToService } from "@/components/ward-management/ward-service-scope";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function ServiceScopeProbe() {
  const service = useServiceScope();
  return <span data-testid="probe">{service ?? "null"}</span>;
}

function renderBar(pathname = "/mockups/ward-flow") {
  route.pathname = pathname;
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardLiveRegion />
      <WardBar primaryAction={resolveWardPrimaryAction(pathname)} />
    </WardFlowProvider>,
  );
}

beforeEach(() => {
  route.pathname = "/mockups/ward-flow";
  window.sessionStorage.clear();
});

afterEach(() => {
  resetServiceScopeForTests();
  resetWardLiveRegionForTests();
  window.sessionStorage.clear();
});

/* ── 1. the store itself ──────────────────────────────────────────────────────────────────────── */

describe("ward-service-store.ts — storage contract", () => {
  it("writes exactly one sessionStorage key, holding exactly the chosen service id", () => {
    setServiceScope("South Metro");
    expect(window.sessionStorage.length).toBe(1);
    expect(window.sessionStorage.key(0)).toBe(SERVICE_SCOPE_STORAGE_KEY);
    expect(window.sessionStorage.getItem(SERVICE_SCOPE_STORAGE_KEY)).toBe("South Metro");
  });

  it("removes the key rather than writing a sentinel when cleared back to All services", () => {
    setServiceScope("South Metro");
    setServiceScope(null);
    expect(window.sessionStorage.length).toBe(0);
    expect(window.sessionStorage.getItem(SERVICE_SCOPE_STORAGE_KEY)).toBeNull();
  });

  it("reads a garbage stored value as All services, not as a crash or a guess", () => {
    window.sessionStorage.setItem(SERVICE_SCOPE_STORAGE_KEY, "Not A Real Service");
    render(<ServiceScopeProbe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("null");
  });

  it("keeps working when sessionStorage throws on write, via an in-memory fallback for the rest of the session", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    try {
      act(() => setServiceScope("East Metro"));
      render(<ServiceScopeProbe />);
      expect(screen.getByTestId("probe")).toHaveTextContent("East Metro");
    } finally {
      setItem.mockRestore();
    }
  });

  it("keeps working when sessionStorage throws on read, reading as All services rather than throwing", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    try {
      expect(() => render(<ServiceScopeProbe />)).not.toThrow();
      expect(screen.getByTestId("probe")).toHaveTextContent("null");
    } finally {
      getItem.mockRestore();
    }
  });

  it("restores the choice across a remount, reading real sessionStorage rather than a stale in-memory value", () => {
    setServiceScope("WACHS");
    const { unmount } = render(<ServiceScopeProbe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("WACHS");
    unmount();
    render(<ServiceScopeProbe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("WACHS");
  });

  it("resetServiceScopeForTests clears both the stored value and any in-memory fallback", () => {
    setServiceScope("Private");
    resetServiceScopeForTests();
    expect(window.sessionStorage.getItem(SERVICE_SCOPE_STORAGE_KEY)).toBeNull();
    render(<ServiceScopeProbe />);
    expect(screen.getByTestId("probe")).toHaveTextContent("null");
  });
});

/* ── 2. the wired Service selector in ward-bar.tsx ───────────────────────────────────────────── */

describe("WardBar's Service selector, wired to the store", () => {
  it("has no 'not wired' text anywhere in the panel", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByTestId("ward-bar-service-trigger"));
    const panel = screen.getByTestId("ward-bar-service-panel");
    expect((panel.textContent ?? "").toLowerCase()).not.toContain("not wired");
  });

  // Owner request (9 Oct 2026): the painted footer note and the "scopes the lists" hint are gone.
  // The sentence stays for screen readers only, so what the choice narrows is still announced.
  it("shows the Service heading, with the scope note for screen readers only", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByTestId("ward-bar-service-trigger"));
    const panel = screen.getByTestId("ward-bar-service-panel");
    expect(within(panel).getByText("Service")).toBeInTheDocument();
    expect(within(panel).queryByText("scopes the lists")).not.toBeInTheDocument();
    expect(
      within(panel).getByText(
        "One service, or all of them. Capacity, Delays and Movements narrow their lists to it. " +
          "The bed shortlist, whole-network figures, the rail counts and the drawers do not.",
      ),
    ).toHaveClass("sr-only");
  });

  it("shows each service option's open-movement count exactly as ward-service-scope.ts (S1) computes it over the real seed", async () => {
    const { movements, units } = seedWardFlowState();
    const openMovements = movements.filter(isOpen);
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByTestId("ward-bar-service-trigger"));
    const panel = screen.getByTestId("ward-bar-service-panel");
    const options = within(panel).getAllByRole("button");

    for (const service of HEALTH_SERVICES) {
      const expectedCount = openMovements.filter((movement) =>
        movementBelongsToService(movement, service, units),
      ).length;
      const expectedText = expectedCount > 0 ? `${expectedCount} open` : "none open";
      const option = options.find((button) => (button.textContent ?? "").startsWith(service));
      expect(option, `no option button found starting with "${service}"`).toBeDefined();
      expect(option!.textContent ?? "").toContain(expectedText);
    }
  });

  // Anti-vacuity: the count test above would pass just as well if every option showed "none open"
  // by a broken join always returning zero. The real seed must actually produce a mix, or that
  // test cannot tell "computed correctly" from "computed as always zero".
  it("anti-vacuity: at least one service option shows a non-zero open count over the real seed", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByTestId("ward-bar-service-trigger"));
    const panel = screen.getByTestId("ward-bar-service-panel");
    const nonZero = within(panel)
      .getAllByRole("button")
      .filter((button) => /\d+ open/.test(button.textContent ?? ""));
    expect(nonZero.length).toBeGreaterThan(0);
  });

  // Exact accessible-name compatibility: several existing suites (this file's neighbour,
  // `tests/ward-shell-third-edition.dom.test.tsx`, among them) select an option button by its
  // EXACT accessible name, e.g. `getByRole("button", { name: "South Metro" })`. The new count span
  // must never leak into that computed name, or every one of those pre-existing queries breaks.
  it("keeps each option's accessible name exactly the service name, with the count hidden from it", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByTestId("ward-bar-service-trigger"));
    for (const service of HEALTH_SERVICES) {
      expect(screen.getByRole("button", { name: service })).toBeInTheDocument();
    }
  });

  it("still selects a service and persists it to the store when its option is clicked", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByTestId("ward-bar-service-trigger"));
    await user.click(screen.getByRole("button", { name: "South Metro" }));
    expect(window.sessionStorage.getItem(SERVICE_SCOPE_STORAGE_KEY)).toBe("South Metro");
    expect(screen.getByTestId("ward-bar-service-trigger")).toHaveTextContent("South Metro");
  });
});

/* ── 3. assertion 2's Escape sentence — build plan §3 exact wording ─────────────────────────────
 *
 * `tests/ward-shell-third-edition.dom.test.tsx`'s own assertion-2 tests already pin that Escape
 * never CLEARS the service and that IT announces SOMETHING containing "Nothing more to clear" and
 * the service name — they use `toContain`, so the old "not wired" wording passed them too. This
 * test is the one that would have caught the old wording: the FULL exact sentence.
 */
describe("assertion 2's Escape sentence", () => {
  it("announces the exact build-plan §3 sentence, not the old 'not wired' wording", async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByTestId("ward-bar-service-trigger"));
    await user.click(screen.getByRole("button", { name: "South Metro" }));
    await user.keyboard("{Escape}");
    const live = screen.getByTestId("ward-live-region").textContent ?? "";
    expect(live).toContain(
      "Nothing more to clear. The service stays South Metro. Choose All services in the selector to widen the lists.",
    );
    expect(live).not.toContain("not wired");
  });
});

/* ── 4. the outside-click-close race (S2's own fix, inside its owned range of ward-bar.tsx) ─────── */

describe("the outside-click-close race no longer reopens a popover on its own second click", () => {
  it("closes the Service selector on a second click of its own trigger, rather than closing and racing back open", async () => {
    const user = userEvent.setup();
    renderBar();
    const trigger = screen.getByTestId("ward-bar-service-trigger");

    await user.click(trigger);
    expect(screen.getByTestId("ward-bar-service-panel")).toBeInTheDocument();

    await user.click(trigger);
    expect(screen.queryByTestId("ward-bar-service-panel")).not.toBeInTheDocument();
  });

  it("closes the primary-action ('New referral') popover on a second click of its own trigger", async () => {
    const user = userEvent.setup();
    renderBar(WARD_HOME_HREF);
    const trigger = screen.getByTestId("ward-bar-primary-action");

    await user.click(trigger);
    expect(screen.getByTestId("ward-bar-primary-panel")).toBeInTheDocument();

    await user.click(trigger);
    expect(screen.queryByTestId("ward-bar-primary-panel")).not.toBeInTheDocument();
  });
});

/* ── 5. WardServiceScopeBar, standalone (no screen mounts it yet — S2's own brief) ──────────────── */

describe("WardServiceScopeBar", () => {
  it("renders the exact fixed 'Showing N of M...' sentence", () => {
    render(<WardServiceScopeBar service="South Metro" shown={3} total={10} noun="movements" />);
    expect(screen.getByTestId("ward-service-scope-bar-summary").textContent ?? "").toContain(
      "Showing 3 of 10 movements, in South Metro.",
    );
  });

  it("renders the 'no recorded service' sentence only when the count prop is given, with correct is/are agreement", () => {
    const { rerender } = render(
      <WardServiceScopeBar service="South Metro" shown={3} total={10} noun="movements" noRecordedServiceCount={1} />,
    );
    expect(screen.getByTestId("ward-service-scope-bar-unresolved")).toHaveTextContent(
      "1 with no recorded service is included.",
    );

    rerender(
      <WardServiceScopeBar service="South Metro" shown={3} total={10} noun="movements" noRecordedServiceCount={2} />,
    );
    expect(screen.getByTestId("ward-service-scope-bar-unresolved")).toHaveTextContent(
      "2 with no recorded service are included.",
    );

    rerender(<WardServiceScopeBar service="South Metro" shown={3} total={10} noun="movements" />);
    expect(screen.queryByTestId("ward-service-scope-bar-unresolved")).not.toBeInTheDocument();
  });

  it("renders S2's own urgent-outside sentence only when the prop is given, including the zero case", () => {
    const { rerender } = render(
      <WardServiceScopeBar service="East Metro" shown={1} total={2} noun="movements" urgentOutside={{ count: 0 }} />,
    );
    expect(screen.getByTestId("ward-service-scope-bar-urgent")).toHaveTextContent(
      "Nothing flagged urgent, a legal form running out, without a bed anywhere, waited past the access target, or escalated is outside East Metro.",
    );

    rerender(
      <WardServiceScopeBar service="East Metro" shown={1} total={2} noun="movements" urgentOutside={{ count: 1 }} />,
    );
    expect(screen.getByTestId("ward-service-scope-bar-urgent")).toHaveTextContent(
      "1 movement outside East Metro: flagged urgent, a legal form running out, without a bed anywhere, waited past the access target, or escalated.",
    );

    rerender(
      <WardServiceScopeBar service="East Metro" shown={1} total={2} noun="movements" urgentOutside={{ count: 4 }} />,
    );
    expect(screen.getByTestId("ward-service-scope-bar-urgent")).toHaveTextContent(
      "4 movements outside East Metro: flagged urgent, a legal form running out, without a bed anywhere, waited past the access target, or escalated.",
    );

    rerender(<WardServiceScopeBar service="East Metro" shown={1} total={2} noun="movements" />);
    expect(screen.queryByTestId("ward-service-scope-bar-urgent")).not.toBeInTheDocument();
  });

  it("'Show all services' clears the stored choice and announces 'Service set to all.'", async () => {
    setServiceScope("North Metro");
    const user = userEvent.setup();
    render(
      <>
        <WardLiveRegion />
        <WardServiceScopeBar service="North Metro" shown={4} total={9} noun="movements" />
      </>,
    );

    await user.click(screen.getByTestId("ward-service-scope-bar-clear"));

    expect(window.sessionStorage.getItem(SERVICE_SCOPE_STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId("ward-live-region").textContent ?? "").toContain("Service set to all.");
  });
});
