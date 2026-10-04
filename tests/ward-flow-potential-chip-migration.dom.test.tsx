import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Mirrors tests/ward-flow-queue-selection.dom.test.tsx: the network view renders next/link
// anchors and this suite never checks routing itself, so a plain <a> avoids requiring an App
// Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { FlowDiagram } from "@/components/ward-management/coordinator/flow-diagram";
import { dayOf } from "@/components/ward-management/ward-clock";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardModeWorkspace } from "@/components/ward-management/ward-management-modes";
import { PARALLEL_REFERRAL_CAP } from "@/components/ward-management/ward-model";
import { bedReleases, leaveBeds } from "@/components/ward-management/ward-movements";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";

/**
 * CHANGED 25 September 2026: `Confirmed`/`Expected` figures below are no longer pinned by the
 * hand-authored WR-008 (discharged, at arm-adult-open) and WR-001 (confirmed, at
 * rph-adult-secure) — owner ruling 2026-09-25 removed both in favour of releases derived from
 * named admissions. `todayCount` re-implements `capacityBreakdown`'s own documented today/
 * tomorrow-vs-beyond-today rule (`releaseBand` in `ward-bed-availability.ts`: a release counts
 * unless it is two or more calendar days ahead of `now`) directly against the raw `bedReleases`
 * array, rather than calling `capacityBreakdown`/`releaseBand` themselves — the same "never call
 * the function under test" discipline `ward-shortlist-ward-detail.dom.test.tsx` holds to.
 */
function todayCount(unitId: string, state: "confirmed" | "expected"): number {
  return bedReleases.filter((release) => {
    if (release.unitId !== unitId || release.state !== state) return false;
    return dayOf(release.expectedAt) - dayOf(NOW_ANCHOR) < 2;
  }).length;
}

/**
 * Review Finding 4: the network view and the coordinator flow diagram both used to render a
 * `Potential` chip sourced from `unitCapacity()`'s raw release count — every release for the
 * unit regardless of state or timing, including one already `discharged` and one expected beyond
 * tonight, neither of which spec D5/D6 permit in any count. Both surfaces now read
 * `capacityBreakdown()` instead, the same figures the capacity board and the ward screen already
 * show (`tests/ward-capacity-view.dom.test.tsx`, `tests/ward-screen.dom.test.tsx`).
 *
 * `arm-adult-open` is the review's own "zero clicks, seeded data" trigger: the old figure showed
 * `Potential 1` for a bed that had already come free (the hand-authored WR-008, `state:
 * "discharged"`, owner ruling 2026-09-25 removed it). The word "Potential" must never appear on
 * either surface again, and the Confirmed/Expected figures must come from `capacityBreakdown`,
 * never from a raw release count.
 *
 * `rph-adult-secure` carries a real confirmed release derived from a named admission, giving a
 * non-zero control case alongside `arm-adult-open` — see `todayCount`'s own comment for how each
 * unit's figure is read at runtime rather than hard-coded, now that neither WR-008 nor WR-001
 * (the two hand-authored releases this suite used to pin) still exists.
 */
describe("network view and coordinator flow diagram never show the raw potential figure", () => {
  it("network view shows Confirmed/Expected from capacityBreakdown(), not unitCapacity()'s potential", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardModeWorkspace mode="network" />
      </WardFlowProvider>,
    );

    // The defect this suite exists to catch: the word this view (and its legend) used to show
    // for a figure that is no longer computed anywhere on this branch.
    expect(screen.queryByText("Potential")).not.toBeInTheDocument();

    // The network card's chips carry no visible label text of their own (only a `data-state`
    // attribute and a `title` tooltip — see `BedStateChips`), so the figure is read from the
    // chip matching each state rather than from a rendered word.
    const armConfirmed = todayCount("arm-adult-open", "confirmed");
    const armExpected = todayCount("arm-adult-open", "expected");
    const dischargedUnitCard = screen.getByTestId("ward-network-card-arm-adult-open");
    expect(dischargedUnitCard.querySelector('[data-state="confirmed"]')).toHaveTextContent(String(armConfirmed));
    expect(dischargedUnitCard.querySelector('[data-state="expected"]')).toHaveTextContent(String(armExpected));
    expect(dischargedUnitCard.getAttribute("aria-label")).not.toMatch(/potential/i);
    expect(dischargedUnitCard.getAttribute("aria-label")).toMatch(
      new RegExp(`${armConfirmed} confirmed, ${armExpected} expected`),
    );

    const rphConfirmed = todayCount("rph-adult-secure", "confirmed");
    const rphExpected = todayCount("rph-adult-secure", "expected");
    const confirmedUnitCard = screen.getByTestId("ward-network-card-rph-adult-secure");
    expect(confirmedUnitCard.querySelector('[data-state="confirmed"]')).toHaveTextContent(String(rphConfirmed));
    expect(confirmedUnitCard.querySelector('[data-state="expected"]')).toHaveTextContent(String(rphExpected));
  });

  it("coordinator flow diagram shows Confirmed/Expected from capacityBreakdown(), not unitCapacity()'s potential", () => {
    render(
      <FlowDiagram
        movement={undefined}
        /* Named rather than defaulted. `FlowDiagram` used to reach the seed through `edPressure`'s
           old default parameter, so its ED figures were the fixture's whatever the caller meant.
           The argument is required now and every caller says which movements it means. */
        movements={wardMovements}
        now={NOW_ANCHOR}
        units={allUnits()}
        bedReleases={bedReleases}
        leaveBeds={leaveBeds}
        admissions={wardAdmissions}
        selectedUnitId={undefined}
        onSelectUnit={() => {}}
        parallelReferralCap={PARALLEL_REFERRAL_CAP}
      />,
    );

    expect(screen.queryByText(/^Potential/)).not.toBeInTheDocument();

    const dischargedUnitNode = screen.getByTestId("ward-diagram-unit-arm-adult-open");
    expect(within(dischargedUnitNode).queryByText(/^Potential/)).not.toBeInTheDocument();
    expect(dischargedUnitNode).toHaveTextContent(`Confirmed ${todayCount("arm-adult-open", "confirmed")}`);
    expect(dischargedUnitNode).toHaveTextContent(`Expected ${todayCount("arm-adult-open", "expected")}`);

    const confirmedUnitNode = screen.getByTestId("ward-diagram-unit-rph-adult-secure");
    expect(confirmedUnitNode).toHaveTextContent(`Confirmed ${todayCount("rph-adult-secure", "confirmed")}`);
    expect(confirmedUnitNode).toHaveTextContent(`Expected ${todayCount("rph-adult-secure", "expected")}`);
  });
});
