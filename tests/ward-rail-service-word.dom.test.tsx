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
 * Plus rail-figure truthfulness: the handover countdown comes from the demonstration clock
 * (including "Handover Due" after 15:00 on that clock), and bed-alert totals are derived rather
 * than hardcoded. The board time itself shows once, in the top bar (A7, overall review).
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const route = { pathname: "/ward-flow" };
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { WardBar } from "@/components/ward-management/shell/ward-bar";
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
  route.pathname = "/ward-flow";
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
  // v6 rail (7 October 2026): the control read "All pages". B1 (Josh, 19 Oct 2026): the rail shows
  // the role's own menu and the control is More, which opens every other page.
  it("keeps all pages reachable from the desktop More control", () => {
    renderRail();
    expect(screen.getAllByRole("button", { name: "Menu" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "More pages" }));
    const navigation = screen.getByRole("dialog", { name: "More pages" });
    expect(within(navigation).getByRole("link", { name: /Statistics/i })).toHaveAttribute(
      "href",
      "/ward-flow/statistics",
    );
    expect(within(navigation).getByRole("link", { name: "Legal forms" })).toHaveAttribute(
      "href",
      "/ward-flow/legal-forms",
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

describe("board time in the top bar (A7)", () => {
  it("shows the demo clock once, in the top bar, and it opens the demo controls", () => {
    // NOW_ANCHOR is 10:42 on the demonstration clock.
    setRailOpenPreference(true);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardRail />
        <WardBar />
      </WardFlowProvider>,
    );
    const clocks = screen.getAllByLabelText(/Board time 10:42 AWST/i);
    expect(clocks).toHaveLength(1);
    const clock = clocks[0]!;
    expect(clock).toHaveAttribute("data-testid", "ward-bar-demo-clock");
    expect(clock).toHaveAccessibleName("Board time 10:42 AWST. Open demo controls");
    expect(clock).toHaveTextContent("Board time");
    expect(clock).toHaveTextContent("10:42");
    expect(clock).toHaveTextContent("AWST");
    expect(clock.textContent).not.toMatch(/\d{2}:\d{2}:\d{2}/);
  });
});

describe("rail handover countdown", () => {
  it("shows the handover countdown from the pinned board time, and no clock of its own", () => {
    // NOW_ANCHOR is 10:42. Day shift ends 15:00 → remaining 4h 18m.
    setRailOpenPreference(true);
    renderRail(NOW_ANCHOR);

    // A7 (overall review, 20 Oct 2026): the demo clock lives in the top bar only, not the rail.
    expect(screen.queryByLabelText(/Board time 10:42 AWST/i)).not.toBeInTheDocument();
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

    const countdown = screen.getByRole("link", { name: /Handover countdown:/i });
    expect(countdown).toHaveAccessibleName(/Handover Due/);
    // v6 rail (7 October 2026): the visible chip reads "due now"; the accessible name keeps "Handover Due".
    expect(countdown).toHaveTextContent("due now");
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

    // Audit 24-4 NA2-08: the header chip reads "N beds ready" (`readyBedsNow`, Capacity's word) and
    // each service row "N of M ready", in place of v6's "N unoccupied beds" / "N of M free".
    const header = screen.getByTestId("ward-rail-bed-alerts-free");
    expect(header).toHaveTextContent(`${expected.totalFreeBeds} beds ready`);
    expect(header).not.toHaveTextContent("unoccupied");

    const rows = screen.getAllByTestId("ward-rail-bed-alert-row");
    expect(rows).toHaveLength(expected.services.length);
    for (const row of expected.services) {
      const match = rows.find((element) => element.textContent?.includes(row.name));
      expect(match, `no Bed alerts row for ${row.name}`).toBeDefined();
      expect(match).toHaveTextContent(`${row.freeBeds} of ${row.totalBeds} ready`);
    }
  });

  it("counts services at or over the bed alert line, not Alerts items (#793)", () => {
    setRailOpenPreference(true);
    renderRail();
    const count = seededBedAlerts().services.filter((row) => row.occupancyPercent >= 85).length;
    const trigger = screen.getByTestId("ward-rail-capacity-alerts-trigger");
    const noun = count === 1 ? "service" : "services";
    expect(trigger).toHaveAccessibleName(new RegExp(`Bed alerts: ${count === 0 ? "No" : count} ${noun} at 85%\\+`));
    expect(trigger.getAttribute("aria-label")).not.toMatch(/\d+ alerts?\b|No alerts/u);
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
