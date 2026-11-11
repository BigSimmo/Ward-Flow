import { act, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => <a {...props}>{children}</a>,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { openEdJourneys } from "@/components/ward-management/ward-shared-figures";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * AUDIT 4 (issue #1567), the DOM twin of `ward-one-number-across-screens.test.ts`. Home and
 * Statistics compute some headline figures inside the component (Statistics' ready, discharged
 * today and open ED movements are inline in `StatisticsScreen`), so these are read off the rendered
 * page and compared with the printed bed meeting sheet built from the same seed.
 */
afterEach(() => {
  window.sessionStorage.clear();
});

const state = seedWardFlowState();
const sheet = bedMeetingSheet({
  ...state,
  now: NOW_ANCHOR,
  thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
  service: null,
  nameOf: (movement) => movement.id,
  referrals: state.referrals,
  referralLimitMinutes: state.configuration.referralDecisionTargetMinutes,
});
const printedInUse = sheet.capacity.occupied + sheet.capacity.pulled;

/** The leading whole number in an element's text: "26 beds ready" reads 26. */
function leadingNumber(element: HTMLElement): number {
  const match = /(\d+)/u.exec(element.textContent ?? "");
  expect(match, element.textContent ?? "").not.toBeNull();
  return Number(match![1]);
}

describe("Home and Statistics print the same figures as the bed meeting sheet (Audit 4)", () => {
  it("non-zero on the seed, so agreement is never 0 = 0", () => {
    expect(sheet.capacity.ready).toBeGreaterThan(0);
    expect(sheet.discharges.dischargedToday).toBeGreaterThan(0);
    expect(printedInUse).toBeGreaterThan(0);
  });

  it("Home's hero: beds ready, open ED movements and the occupancy ring", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    expect(leadingNumber(screen.getByTestId("home-figure-beds")), "beds ready vs print").toBe(sheet.capacity.ready);
    expect(leadingNumber(screen.getByTestId("home-figure-ed")), "open ED movements").toBe(
      openEdJourneys(state.movements, NOW_ANCHOR).total,
    );
    const beds = state.units.reduce((sum, unit) => sum + unit.beds, 0);
    expect(leadingNumber(screen.getByTestId("home-figure-occupancy")), "occupancy vs print").toBe(
      Math.round((printedInUse / beds) * 100),
    );
  });

  it("Statistics' hero: beds ready now, in use, discharged today and open ED movements", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsScreen />
      </WardFlowProvider>,
    );
    const page = screen.getByTestId("ward-statistics-screen");
    // Page tops (9 Nov 2026, PR #1581): the hero's figures are one "Network at a glance" row, each
    // a number then its words ("4 beds ready", "41 / 60 in use, 68%").
    const chips = within(page).getByRole("group", { name: "Network at a glance" });
    const figureOf = (words: RegExp) => within(chips).getByText(words).closest<HTMLElement>("[data-wf-hero-figure]")!;
    expect(leadingNumber(figureOf(/^beds? ready$/u)), "ready vs print").toBe(sheet.capacity.ready);
    expect(leadingNumber(figureOf(/^in use,/u)), "in use vs print").toBe(printedInUse);
    expect(
      leadingNumber(within(chips).getByTestId("ward-statistics-discharges-today-count")),
      "discharged today vs print",
    ).toBe(sheet.discharges.dischargedToday);
    expect(leadingNumber(figureOf(/^open ED movements$/u)), "open ED movements").toBe(
      openEdJourneys(state.movements, NOW_ANCHOR).total,
    );
  });
});

/**
 * Audit M6, no false "all clear": when the ward list a figure is built from comes back empty (a site
 * desk whose site has no wards in this workspace, or a source that returned nothing), the occupancy
 * share is unknown. Home already leaves its ring out; Statistics printed "0 / 0 in use, 0%".
 */
describe("a missing ward source reads as unknown, never 0% in use (audit M6)", () => {
  afterEach(() => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", null);
      resetWardAccessStoreForTests();
    });
  });

  it("Statistics' hero shows a dash, not 0%, when no ward was counted", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: "SYN-NO-WARDS" } });
    });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsScreen />
      </WardFlowProvider>,
    );
    const chips = within(screen.getByTestId("ward-statistics-screen")).getByRole("group", {
      name: "Network at a glance",
    });
    const inUse = within(chips)
      .getByText(/^in use,/u)
      .closest<HTMLElement>("[data-wf-hero-figure]")!;
    expect(inUse.textContent).toContain("—");
    expect(inUse.textContent).not.toMatch(/\d\s*%/u);
  });
});
