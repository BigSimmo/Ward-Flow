import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md`, task A3 (item 52, owner
 * answer 52). `ward-rail.tsx`'s own header used to explain why the chosen service was left out of
 * the rail entirely (a colour-only `.svcStripe` bar, omitted as a judgement call). Owner answer 52
 * resolved that call: the rail now carries the chosen service too, but as a WORD next to a small
 * dot, never a colour-only bar — exactly build plan §3's "Rail (52)" wording.
 *
 * Three facts, each its own `it()`:
 * 1. Open, with a service chosen: the exact words "Service: South Metro".
 * 2. Closed, the same service chosen: just "South" — the short form, no "Service:" prefix.
 * 3. All services (nothing chosen): nothing renders at all — no dot, no word.
 *
 * Plus rail-figure truthfulness: board time and handover countdown come from the demonstration
 * clock (including "Handover Due" after 15:00 on that clock), and bed-alert totals are derived
 * rather than hardcoded.
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

import { WardRail, setRailOpenPreference } from "@/components/ward-management/shell/ward-rail";
import { deriveServiceBedAlerts } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { resetServiceScopeForTests, setServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderRail(initialNow: number = NOW_ANCHOR) {
  return render(
    <WardFlowProvider initialNow={initialNow}>
      <WardRail />
    </WardFlowProvider>,
  );
}

function seededBedAlerts() {
  const state = seedWardFlowState();
  return deriveServiceBedAlerts(state.units, state.bedReleases);
}

beforeEach(() => {
  route.pathname = "/mockups/ward-flow";
  // Same jsdom rAF guard `tests/ward-shell-third-edition.dom.test.tsx` carries — the rail always
  // mounts a `<Sheet>` for "More pages", whose open-focus controller schedules via rAF even closed.
  if (typeof window.requestAnimationFrame !== "function") {
    window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof window.cancelAnimationFrame;
  }
});

afterEach(() => {
  resetServiceScopeForTests();
  setRailOpenPreference(true);
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.documentElement.removeAttribute("data-rail");
  vi.useRealTimers();
});

describe("the rail's chosen-service word (item 52)", () => {
  it("keeps all pages reachable from the desktop All Pages control", () => {
    renderRail();
    expect(screen.getAllByRole("button", { name: "Menu" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "All Pages" }));
    const navigation = screen.getByRole("dialog", { name: "Ward Flow navigation" });
    expect(within(navigation).getByRole("link", { name: /Statistics/i })).toHaveAttribute(
      "href",
      "/mockups/ward-flow/statistics",
    );
    expect(within(navigation).getByRole("link", { name: "Legal" })).toHaveAttribute(
      "href",
      "/mockups/ward-flow/legal-forms",
    );
  });

  it('reads "Service: South Metro" when the rail is open', () => {
    setRailOpenPreference(true);
    setServiceScope("South Metro");
    renderRail();
    expect(screen.getByTestId("ward-rail-service")).toHaveTextContent("Service: South Metro");
    expect(screen.getByTestId("ward-rail-service-dot")).toBeInTheDocument();
  });

  it('reads just "South" when the rail is closed — the short form, not the full name', () => {
    setRailOpenPreference(false);
    setServiceScope("South Metro");
    renderRail();
    expect(screen.getByTestId("ward-rail-service").textContent).toBe("South");
  });

  it("renders nothing under All services — no dot, no word", () => {
    setRailOpenPreference(true);
    setServiceScope(null);
    renderRail();
    expect(screen.queryByTestId("ward-rail-service")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-rail-service-dot")).not.toBeInTheDocument();
  });
});

describe("rail board time and handover countdown", () => {
  it("shows the pinned board time (hours and minutes only) and its handover countdown", () => {
    // NOW_ANCHOR is 10:42. Day shift ends 15:00 → remaining 4h 18m.
    setRailOpenPreference(true);
    renderRail(NOW_ANCHOR);

    const boardTime = screen.getByLabelText(/Board time 10:42 AWST/i);
    expect(boardTime).toHaveTextContent("Board time");
    expect(boardTime).toHaveTextContent("10:42");
    expect(boardTime).toHaveTextContent("AWST");
    expect(boardTime.textContent).not.toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(screen.queryByText("Live Time")).not.toBeInTheDocument();

    const countdown = screen.getByRole("link", { name: /Handover countdown:/i });
    expect(countdown).toHaveAccessibleName(/4h 18m/);
    expect(countdown).toHaveTextContent("4h 18m");
    expect(countdown.textContent).not.toContain("3h 38m");
  });

  it('shows "Handover Due" during the shift changeover window and never the literal "3h 38m"', () => {
    // 14:55 on the demonstration day (within 15m of 15:00 shift end) — not the computer's wall clock.
    setRailOpenPreference(true);
    renderRail(14 * 60 + 55);

    expect(screen.getByLabelText(/Board time 14:55 AWST/i)).toHaveTextContent("14:55");

    const countdown = screen.getByRole("link", { name: /Handover countdown:/i });
    expect(countdown).toHaveAccessibleName(/Handover Due/);
    expect(countdown).toHaveTextContent("Handover Due");
    expect(countdown.textContent).not.toContain("3h 38m");
    expect(document.body.textContent).not.toContain("3h 38m");
  });
});

describe("rail bed alerts (live figures)", () => {
  it("shows a free-bed header that equals the sum of derived service rows", async () => {
    setRailOpenPreference(true);
    renderRail();
    const expected = seededBedAlerts();
    const rowSum = expected.services.reduce((sum, row) => sum + row.freeBeds, 0);
    expect(expected.totalFreeBeds).toBe(rowSum);

    const trigger = screen.getByTestId("ward-rail-capacity-alerts-trigger");
    await act(async () => {
      trigger.click();
    });

    expect(screen.getByText(`${expected.totalFreeBeds} Unoccupied Beds`)).toBeInTheDocument();
    expect(screen.queryByText("18 Unoccupied Beds")).not.toBeInTheDocument();

    for (const row of expected.services) {
      expect(screen.getByText(`${row.freeBeds} unoccupied (${row.occupiedBeds}/${row.totalBeds})`)).toBeInTheDocument();
    }
  });

  it("labels Metro occupancy from the three metro services only — not a fixed 96.4%", () => {
    setRailOpenPreference(true);
    renderRail();
    const expected = seededBedAlerts();
    const trigger = screen.getByTestId("ward-rail-capacity-alerts-trigger");
    expect(trigger.textContent).not.toContain("96.4%");
    expect(expected.metroOccupancyPercent).not.toBeNull();
    expect(trigger).toHaveTextContent(`Metro ${expected.metroOccupancyPercent}%`);
  });
});
