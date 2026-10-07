import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Same mocking idiom as `tests/ward-sidebar.dom.test.tsx`: `WardChromeHeader` renders next/link
// anchors and reads the route via next/navigation, neither of which jsdom can supply without an
// App Router context.
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

import { WardChromeHeader } from "@/components/ward-management/ward-chrome-header";
import { wardsConfirmedLabel } from "@/components/ward-management/ward-morning-rollup";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, wardSites } from "@/components/ward-management/ward-sites";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { serviceRollup } from "@/components/ward-management/ward-morning-rollup";
import { WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";

const COORDINATOR_ROUTE = "/mockups/ward-flow";
const WARD_ROUTE = "/mockups/ward-flow/board/rph-adult-secure";
const ED_ROUTE = "/mockups/ward-flow/ed/peel-ed";

function renderHeader(pathname: string) {
  route.pathname = pathname;
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardChromeHeader />
    </WardFlowProvider>,
  );
}

beforeEach(() => {
  route.pathname = COORDINATOR_ROUTE;
});

afterEach(() => {
  cleanup();
});

/**
 * The Handover link — a plain destination, no derived data, no count. Checked in all three roles
 * because the header's other two additions change with the role and this one must not.
 */
describe("Ward Flow chrome header — Handover link", () => {
  it.each([
    ["coordinator", COORDINATOR_ROUTE],
    ["ward", WARD_ROUTE],
    ["ed", ED_ROUTE],
  ])("links to the handover board in the %s role", (_role, pathname) => {
    renderHeader(pathname);
    expect(screen.getByTestId("ward-chrome-handover")).toHaveAttribute("href", "/mockups/ward-flow/handover");
  });
});

/**
 * 🔴 **THE EXPECTED NUMBERS ARE RE-DERIVED HERE FROM THE SEED, NEVER BY CALLING
 * `ward-chrome-header.tsx`'S OWN `freshnessLine`.** A test that built its expectation by calling
 * the function under test could not fail if that function's arithmetic were wrong — exactly the
 * defect this repository found in a sibling suite yesterday (a mutated `wardNavCounts` derivation
 * left all fifteen of its own cases green). `serviceRollup` is called a second, independent time
 * from `seedWardFlowState()`, mirroring `tests/ward-sidebar.dom.test.tsx`'s own
 * "against their own derivations" suite.
 */
describe("Ward Flow chrome header — board freshness", () => {
  const seed = seedWardFlowState();
  const rollup = serviceRollup(wardSites, seed.units, seed.bedReleases, seed.leaveBeds, NOW_ANCHOR);
  const freshness = rollup.service.freshness;

  it("is not vacuous on the seed — at least one wing of the figure is non-zero", () => {
    expect(freshness.kind, "every unit is unconfirmed — this suite would prove nothing").not.toBe("never");
    if (freshness.kind !== "never") {
      expect(
        freshness.unitsConfirmed > 0 || freshness.unitsTotal > 0,
        "both unitsConfirmed and unitsTotal are zero — the figure carries no information",
      ).toBe(true);
    }
  });

  /**
   * 🔴 **MEASURED, NOT ASSUMED: ON THIS SEED `unitsConfirmed === unitsTotal` (23 of 23), SO A
   * SWAP BETWEEN THE TWO FIELDS RENDERS AN IDENTICAL STRING.** The render test two below this one
   * proves the seed's own numbers reach the screen unmutated, but it could not, by itself, tell
   * "read the right field" apart from "read the other one" — both give "23 of 23" here. That is
   * exactly the coincidence class this repository's own sidebar-count suite already guards against
   * for a different pair of figures (`tests/ward-sidebar.dom.test.tsx`, "counts delays from a
   * narrower population than movements"). So `freshnessLine` is called directly here with a
   * synthetic `"partial"` input whose two counts are NOT equal, which is what actually exercises
   * the two fields independently rather than relying on today's seed to keep them apart.
   */
  it("reads unitsConfirmed and unitsTotal as two distinct fields, not one value read twice", () => {
    expect(wardsConfirmedLabel({ kind: "partial", oldestConfirmedAt: 0, unitsConfirmed: 3, unitsTotal: 5 })).toBe(
      "2 wards have never confirmed",
    );
    // Singular, because "1 wards have never confirmed" is the kind of thing nobody notices in review.
    expect(wardsConfirmedLabel({ kind: "partial", oldestConfirmedAt: 0, unitsConfirmed: 4, unitsTotal: 5 })).toBe(
      "1 ward has never confirmed",
    );
    expect(wardsConfirmedLabel({ kind: "confirmed", oldestConfirmedAt: 0, unitsConfirmed: 5, unitsTotal: 5 })).toBe(
      "Every ward has confirmed at least once",
    );
  });

  it("handles the no-counts 'never' arm without rendering '0 of 0'", () => {
    expect(wardsConfirmedLabel({ kind: "never" })).toBe("No ward has ever confirmed");
  });

  it("renders exactly the sentence the seed's own rollup computes, with no day-boundary wording", () => {
    renderHeader(COORDINATOR_ROUTE);
    const rendered = screen.getByTestId("ward-chrome-freshness").textContent ?? "";

    // Built independently of ward-chrome-header.tsx's own `freshnessLine` — the same union-arm
    // handling, re-typed here rather than imported, so a wrong derivation in the source has
    // something else to disagree with.
    const expected =
      freshness.kind === "never"
        ? "No ward has ever confirmed"
        : freshness.unitsTotal - freshness.unitsConfirmed === 0
          ? "Every ward has confirmed at least once"
          : `${freshness.unitsTotal - freshness.unitsConfirmed} ward${freshness.unitsTotal - freshness.unitsConfirmed === 1 ? " has" : "s have"} never confirmed`;

    expect(rendered).toBe(expected);
  });

  it("never says the confirmation happened today — rollupFreshness carries no day-boundary comparison", () => {
    renderHeader(COORDINATOR_ROUTE);
    const rendered = screen.getByTestId("ward-chrome-freshness").textContent ?? "";
    expect(rendered.toLowerCase()).not.toContain("today");
  });
});

/**
 * The one action that changes with the role — always a link, per `ward-flow-events.ts`'s
 * `EVENT_ROLE` table: `RAISE_REFERRAL` excludes `coordinator`, `RECEIVE_REFERRAL` is `community`
 * alone, and `referral-intake.tsx` hard-codes `role: "community"` on its own dispatch. A
 * coordinator is in neither list, so every role gets a destination rather than a dispatched event.
 */
describe("Ward Flow chrome header — role action", () => {
  it("links a ward to the movements board to answer bed offers", () => {
    renderHeader(WARD_ROUTE);
    const link = screen.getByTestId("ward-chrome-action");
    expect(link).toHaveAttribute("href", "/mockups/ward-flow/movements");
    expect(link).toHaveTextContent("Answer bed offers");
  });

  it("links an emergency department to the referral intake form, by the shared path constant", () => {
    renderHeader(ED_ROUTE);
    const link = screen.getByTestId("ward-chrome-action");
    expect(link).toHaveAttribute("href", WARD_REFERRAL_INTAKE_HREF);
  });

  it("links a coordinator to the referral board", () => {
    renderHeader(COORDINATOR_ROUTE);
    const link = screen.getByTestId("ward-chrome-action");
    expect(link).toHaveAttribute("href", "/mockups/ward-flow/referrals");
    expect(link).toHaveTextContent("Referrals");
  });
});
