import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { dayOf } from "@/components/ward-management/ward-clock";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { bedReleases } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";

/**
 * The ward detail block (task C, Command mockup parity): the mockup's `wardDetailHtml()` shows
 * the selected ward's own bed states in the shortlist's own column. `flow-diagram.tsx` already
 * renders this exact chip set on every diagram node ALWAYS; this suite covers the genuinely new
 * surface — the same figures reachable from the shortlist column without looking back at the
 * diagram, gated on `state.unitId`/`selectedUnitId` exactly the mockup's own comment describes.
 *
 * ⚠️ Every expected figure below is hand-computed from `arm-adult-open` and `rph-adult-secure`'s
 * own RAW seed fields in `ward-sites.ts`, walking `unitCapacity`'s documented arithmetic by hand
 * — never by importing and calling `unitCapacity`/`capacityBreakdown` themselves. Task C's own
 * brief: a bug in the function under test would be invisible to a test that re-derives its answer
 * by calling that same function.
 *
 * CHANGED 25 September 2026: the Confirmed/Expected figures below no longer come from the two
 * hand-authored WR-00N releases (WR-008 discharged at Moodjar, WR-001 confirmed at Ward 2K) —
 * owner ruling 2026-09-25 removed both in favour of releases derived from named admissions. The
 * same "never call the function under test" discipline is kept: `todayCount` below re-implements
 * `capacityBreakdown`'s own documented today/tomorrow-vs-beyond-today rule (`releaseBand` in
 * `ward-bed-availability.ts`: a release is excluded only when it is two or more calendar days
 * ahead of `now`) directly against the raw `bedReleases` array, rather than calling
 * `capacityBreakdown`/`releaseBand` themselves.
 */
function todayCount(unitId: string, state: "confirmed" | "expected"): number {
  return bedReleases.filter((release) => {
    if (release.unitId !== unitId || release.state !== state) return false;
    return dayOf(release.expectedAt) - dayOf(NOW_ANCHOR) < 2;
  }).length;
}
const TARGET_MOVEMENT_ID = "WF-308";

function ShortlistHarness({ selectedUnitId }: { selectedUnitId: string }) {
  const { movements, units, bedReleases, leaveBeds, referrals, now, dispatch, configuration } = useWardFlow();
  const movement = movements.find((candidate) => candidate.id === TARGET_MOVEMENT_ID);
  return (
    <ShortlistPanel
      movement={movement}
      now={now}
      units={units}
      bedReleases={bedReleases}
      leaveBeds={leaveBeds}
      admissions={wardAdmissions}
      referrals={referrals}
      selectedUnitId={selectedUnitId}
      onSelectUnit={() => {}}
      dispatch={dispatch}
      parallelReferralCap={configuration.parallelReferralCap}
    />
  );
}

/**
 * CHANGED 25 September 2026: the seed no longer carries a release seeded `preparing: true` (owner
 * ruling 2026-09-25 removed the hand-authored WR-008). A bed being made ready is recorded through
 * `SET_BED_PREPARATION` on a real discharged release, so this button records one at runtime,
 * found by unit rather than by a fixed release id.
 */
function PrepareDischargedRelease({ unitId }: { unitId: string }) {
  const { dispatch, now, bedReleases: liveReleases } = useWardFlow();
  const release = liveReleases.find((candidate) => candidate.unitId === unitId && candidate.state === "discharged");
  if (!release) return null;
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "SET_BED_PREPARATION",
          role: "ward",
          now,
          releaseId: release.id,
          actingUnitId: unitId,
          preparing: true,
        })
      }
    >
      prepare discharged release
    </button>
  );
}

function renderWardDetail(selectedUnitId: string) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ShortlistHarness selectedUnitId={selectedUnitId} />
    </WardFlowProvider>,
  );
}

describe("ShortlistPanel's ward detail block", () => {
  it("shows the bed-state chips and the preparation note, hand-computed from Moodjar's own seed data", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ShortlistHarness selectedUnitId="arm-adult-open" />
        <PrepareDischargedRelease unitId="arm-adult-open" />
      </WardFlowProvider>,
    );
    // CHANGED 25 September 2026: records a preparation note on a real discharged release at this
    // unit — see `PrepareDischargedRelease`'s own comment for why this button exists now.
    fireEvent.click(screen.getByRole("button", { name: "prepare discharged release" }));

    const detail = screen.getByTestId("ward-shortlist-ward-detail-arm-adult-open");

    // Moodjar (ward-sites.ts): beds 19, empty.value 3, allocatable.value 2, blocked 0.
    // available = min(2, 3) = 2
    // held      = max(3 - 2, 0) = 1
    // notEmpty  = max(19 - 3, 0) = 16
    // blocked   = min(max(0, 0), 16) = 0
    // occupied  = max(16 - 0, 0) = 16
    // Bed states (R-B-05): one seeded pulled patient (AD-ARMA-16) sits inside that 16, so
    // Pulled 1 and Occupied 15; the empty bed the ward is not offering is Closed 1.
    expect(within(detail).getByText("Ready 2")).toBeInTheDocument();
    expect(within(detail).getByText("Pulled 1")).toBeInTheDocument();
    expect(within(detail).getByText("Closed 1")).toBeInTheDocument();
    expect(within(detail).getByText("Occupied 15")).toBeInTheDocument();

    // CHANGED 25 September 2026: Moodjar's Confirmed/Expected figures are no longer pinned by the
    // hand-authored WR-008 (owner ruling 2026-09-25 removed it) — this unit's occupied admissions
    // now carry real expected/confirmed discharge dates of their own, so the counts are read from
    // the fixture at runtime (see `todayCount`'s own comment) rather than hard-coded.
    const confirmedCount = todayCount("arm-adult-open", "confirmed");
    const expectedCount = todayCount("arm-adult-open", "expected");
    expect(within(detail).getByText(`Confirmed ${confirmedCount}`)).toBeInTheDocument();
    expect(within(detail).getByText(`Expected ${expectedCount}`)).toBeInTheDocument();

    // The discharged release `PrepareDischargedRelease` just flagged is the only one made ready on
    // this unit, so `bedsPendingPreparation` reads 1 for this unit alone.
    const pending = screen.getByTestId("ward-shortlist-ward-detail-pending-arm-adult-open");
    expect(pending).toHaveTextContent("1 of the ready bed is still being made ready");

    // 🔴 The Ready figure asserted above (2) is untouched by that pending count — nothing here
    // subtracts 1 from it. The preparation note is its own separate line, never folded into the
    // Ready chip's own number.
  });

  it("never subtracts the pending count from Ready, and renders no preparation note when nothing is pending", () => {
    renderWardDetail("rph-adult-secure");

    const detail = screen.getByTestId("ward-shortlist-ward-detail-rph-adult-secure");

    // Ward 2K (ward-sites.ts): beds 20, empty.value 2, allocatable.value 1, blocked 0.
    // available = min(1, 2) = 1
    // held      = max(2 - 1, 0) = 1
    // notEmpty  = max(20 - 2, 0) = 18
    // blocked   = min(max(0, 0), 18) = 0
    // occupied  = max(18 - 0, 0) = 18
    // Bed states (R-B-05): two seeded pulled patients (AD-RPHS-03, AD-RPHS-16) sit inside that 18.
    expect(within(detail).getByText("Ready 1")).toBeInTheDocument();
    expect(within(detail).getByText("Pulled 2")).toBeInTheDocument();
    expect(within(detail).getByText("Closed 1")).toBeInTheDocument();
    expect(within(detail).getByText("Occupied 16")).toBeInTheDocument();

    // CHANGED 25 September 2026: Ward 2K's Confirmed/Expected figures are no longer pinned by the
    // hand-authored WR-001 (owner ruling 2026-09-25 removed it) — read from the fixture at runtime
    // instead (see `todayCount`'s own comment).
    const confirmedCount = todayCount("rph-adult-secure", "confirmed");
    const expectedCount = todayCount("rph-adult-secure", "expected");
    expect(within(detail).getByText(`Confirmed ${confirmedCount}`)).toBeInTheDocument();
    expect(within(detail).getByText(`Expected ${expectedCount}`)).toBeInTheDocument();

    // No release on this unit is flagged `preparing: true` — the note must be absent, not "0
    // being made ready".
    expect(screen.queryByTestId("ward-shortlist-ward-detail-pending-rph-adult-secure")).not.toBeInTheDocument();
  });

  it("renders no ward detail block at all when no ward can be resolved", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ShortlistHarness selectedUnitId="an-id-no-unit-carries" />
      </WardFlowProvider>,
    );

    expect(screen.queryByTestId(/^ward-shortlist-ward-detail-/)).not.toBeInTheDocument();
  });
});
