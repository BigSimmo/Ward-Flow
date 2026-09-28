import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import {
  countCellText,
  freeingCellText,
  networkTotals,
  networkWardRows,
} from "@/components/ward-management/capacity/capacity-derivations";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { bedReleases, leaveBeds } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

/**
 * Owner ruling, 2026-09-12 (closing spec D9, open six days): the morning bed-state board's coverage
 * (its own DOM suite, `describe.skip("MorningPage", …)`, 20 cases, retired 2026-09-06 and its file
 * itself deleted outright 2026-09-17, item 41) points at `CapacityScreen`, the screen MERGE 02
 * (2026-09-05) folded it into — not at restoring `MorningPage`'s route and not at deleting the
 * parked component.
 *
 * ⚠️ **THIS FILE IS NOT A RENAME OF THE 20 RETIRED CASES.** Most of them describe a fact —
 * `PEOPLE_WAITING_LABEL`, the `CAPACITY_FIGURE_LABELS` three-level vocabulary, a per-SITE (hospital)
 * block with an empty-site branch, a rollup-level `FreshnessStamp`, a dated definition-change notice,
 * a printed-sheet timestamp — that `CapacityScreen` genuinely does not carry, either because the fold
 * dropped it or because the screen was built around a different structure (wards grouped by health
 * SERVICE, not by hospital SITE; live `now`, not a frozen 08:00 handover instant; no referral-sourced
 * demand figure at all). Only three of the twenty have a home here that is not ALREADY covered by an
 * existing, purpose-built test file — see the full case-by-case mapping in this task's own report.
 * Every test below names the exact retired case it inherits, in its own first line.
 *
 * ⚠️ **CASE 18 WAS ATTEMPTED HERE FIRST AND WITHDRAWN — THE FINDING IS REAL, NOT THE TEST.** Case 18
 * ("no duplicate data-testid on the page") was tried against the whole network table and failed
 * immediately, for a genuine reason worth recording rather than working around: `NetworkRow`
 * (`capacity-screen.tsx`) renders bare, unparameterised `data-testid`s —
 * `ward-capacity-network-ready`, `-locked`, `-freeing`, `-confirmed`, `-expected`, `-blocked`,
 * `-held`, `-occupied` — repeated identically on all 23 ward rows (confirmed by running the attempt:
 * `["ward-capacity-network-ready",23]`, and seven more at the same count). This is safe only because
 * every existing consumer scopes with `within(tableRow)` first; an unscoped
 * `page.getByTestId("ward-capacity-network-ready")` would hit a Playwright strict-mode violation
 * across all 23 rows — the exact class of defect the retired case 18 existed to catch, at a larger
 * scale than the gap table's five-instance repeat noted below. Writing case 18's actual property
 * (global uniqueness) would be a permanently-red test for an existing, heavily-relied-on pattern this
 * task's brief forbids fixing (§1); writing a version scoped to only the genuinely-unique per-ward
 * ids (`ward-capacity-network-row-<id>` etc.) would prove only that the fixture's own unit ids are
 * distinct, which is not a meaningful assertion. Left unwritten per this task's own instruction: "an
 * empty test that names a case is worse than an honest gap." Case 20, below, replaces it as the
 * third new test.
 *
 * ⚠️ **ONE THING THE RETIRED FILE'S OWN DOCBLOCK SAID IS NOW FACTUALLY WRONG, AND THIS FILE DOES NOT
 * REPEAT IT.** That now-deleted DOM suite's docblock (lines 31-35) said "the capacity screen
 * deliberately shows no sex mix and no specialling headroom, and whether those belong on a network
 * view is an OPEN owner question." `capacity-screen.tsx` itself (its own doc comment, "SEX MIX AND
 * SPECIALLING HEADROOM — OWNER RULING 2026-09-06, built here the same day") records that the owner
 * ANSWERED that question on 2026-09-06 — CapacityScreen renders both, per ward, today. That caution
 * is stale and is corrected at its own file, not re-asserted here.
 */
const NOW = NOW_ANCHOR;
const units = allUnits();
const networkRows = networkWardRows(units, NOW, bedReleases, wardAdmissions, leaveBeds);
const netTotals = networkTotals(networkRows);

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
    </WardFlowProvider>,
  );
}

/**
 * Inherits retired case 1 ("renders the governance banner, the headline and the remaining four
 * figures for the real fixture after 08:00") — the governance-banner third of it only. The headline
 * third is already proven, exactly, by `tests/ward-capacity-screen.dom.test.tsx`'s "shows the
 * ready-bed split as a bar whose numbers are the real locked/open sums, never invented" — not
 * repeated here. The "remaining four figures" third (a network-wide confirmedToday/expectedToday/
 * held/onLeave total beside the headline) has NO HOME: `networkTotals` returns only
 * `{ wards, beds, ready, pendingPreparation }`, `onLeave` is not read by any Capacity derivation at
 * all, and confirmed/expected/held are summed only per SERVICE GROUP
 * (`networkServiceGroupTotals`), never once for the whole network — see the two tests below that
 * only ever needed a per-ward or per-group figure to stay proven, never a network total that does
 * not exist.
 *
 * The old wording asserted `toHaveTextContent("not a medical device")` — a phrase this banner does
 * not carry. `expectSays` is used, not an exact match, for the same reason
 * `tests/helpers/ward-caption.ts` gives for every other caption in this suite: a caption reworded
 * keeps meaning what it means, and pinning the sentence goes red on a legitimate rewording — but the
 * concepts asserted here (invented data, no real hospital, not a clinical record) are the substance
 * an old "not a medical device" reader was also relying on, restated in this screen's own words.
 */
describe("Case 1 — Capacity identifies synthetic data via the governance footer", () => {
  it("keeps the synthetic prototype disclosure visible in the footer", () => {
    renderScreen();
    // Hospital names are real directory facts. The synthetic marker applies to the operational data.
    const governance = screen.getByTestId("ward-capacity-governance");
    expect(within(governance).getByText("Synthetic prototype")).toBeVisible();
    expect(governance).toHaveTextContent(/Statewide bed capacity/u);
    expect(governance).toHaveTextContent(/Not a medical device/u);
  });
});

/**
 * Inherits retired case 2 ("renders the headline as availableNow alone, never mixing in
 * confirmedToday, expectedToday or onLeave"). CapacityScreen has no single frozen "headline" the way
 * `MorningPage` did — its closest analogue is the "Ready now" panel, which states `netTotals.ready`
 * of `netTotals.beds` beds and nothing else. `netTotals` (`capacity-derivations.ts`) is computed as
 * `{ wards, beds, ready, pendingPreparation }` — it structurally cannot carry a same-day
 * confirmed/expected/held figure, because nothing sums one into it. This asserts the number itself,
 * independently derived from the real fixture, and floors on confirmed/expected/held genuinely being
 * non-zero and different from `ready` — the same "guard the guard" the retired case ran, so an
 * anchored equality below cannot pass by coincidence on a fixture where every figure happens to
 * agree.
 */
describe("Case 2 — the Ready-now panel states availableNow alone", () => {
  it("shows exactly netTotals.ready of netTotals.beds beds, never a total inflated by confirmed, expected or held", () => {
    const confirmedTotal = networkRows.reduce((sum, row) => sum + (row.confirmed ?? 0), 0);
    const expectedTotal = networkRows.reduce((sum, row) => sum + (row.expected ?? 0), 0);
    const heldTotal = networkRows.reduce((sum, row) => sum + row.held, 0);

    expect(confirmedTotal, "fixture assumption: some ward confirms a release today").toBeGreaterThan(0);
    expect(expectedTotal, "fixture assumption: some ward expects a release today").toBeGreaterThan(0);
    expect(heldTotal, "fixture assumption: some ward holds a bed back today").toBeGreaterThan(0);
    expect(confirmedTotal, "confirmed and ready coincide — this fixture cannot distinguish the two").not.toBe(
      netTotals.ready,
    );
    expect(expectedTotal, "expected and ready coincide — this fixture cannot distinguish the two").not.toBe(
      netTotals.ready,
    );
    expect(heldTotal, "held and ready coincide — this fixture cannot distinguish the two").not.toBe(netTotals.ready);

    renderScreen();
    const panel = screen.getByRole("region", { name: "Ready now" });
    expect(
      within(panel).getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent?.replace(/\s+/gu, " ").trim() === `${netTotals.ready} of ${netTotals.beds} beds`,
      ),
      `the Ready-now panel must state exactly ${netTotals.ready} of ${netTotals.beds} beds`,
    ).toBeInTheDocument();
  });
});

/**
 * Inherits retired case 20 ("renders each ward row from its own breakdown, computed for that ward
 * alone, not its hospital's rolled-up total"). The retired case's own mutation targets —
 * `serviceRollup` rolling a site up from the whole network, `SiteBlock` reading its first ward's
 * breakdown, `UnitRow` reading the site rollup instead of the unit's own — do not exist as separate
 * derivation paths here (`ready`/`lockedReady` are already proven per-row against the real fixture by
 * `tests/ward-capacity-screen.dom.test.tsx`'s "names every ward's real ready and locked-ready
 * counts"), but the SAME class of bug is still reachable through `confirmed`/`expected`/`held`/
 * `occupied`, which no existing DOM test checks per-ward against an independently-called
 * `capacityBreakdown`/`unitCapacity` — only summed across a whole service group
 * (`tests/ward-capacity-network-fold.dom.test.tsx`). A mutation that read one ward's figure for
 * every row, or swapped the confirmed/expected columns, would still sum correctly at the group level
 * (the total is the same regardless of which row it came from) and would pass every existing test.
 *
 * Floored the same way the retired case was: confirmed must genuinely vary across wards, and must
 * genuinely differ from expected on at least one ward, or the two mutations above would be
 * numerically invisible on a fixture where every figure happened to coincide.
 */
describe("Case 20 — each ward row renders its own confirmed/expected/held/occupied breakdown, never another ward's or the group's rolled-up total", () => {
  it("matches an independently-computed capacityBreakdown/unitCapacity for that unit alone, on every row", () => {
    const confirmedValues = new Set(networkRows.map((row) => row.confirmed));
    expect(
      confirmedValues.size,
      "every ward's confirmed figure is identical — a same-value-everywhere mutation would be invisible",
    ).toBeGreaterThan(1);
    const rowsWhereConfirmedDiffersFromExpected = networkRows.filter((row) => row.confirmed !== row.expected);
    expect(
      rowsWhereConfirmedDiffersFromExpected.length,
      "confirmed equals expected on every ward — a column-swap mutation would be invisible",
    ).toBeGreaterThan(0);

    renderScreen();
    const table = screen.getByTestId("ward-capacity-network-table");

    for (const row of networkRows) {
      const expectedBreakdown = capacityBreakdown(row.unit, bedReleases, leaveBeds, NOW);
      // `held` and `occupied` are read from a SEPARATE call the screen itself makes — `held` via
      // `capacityBreakdown(unit, [], leave, now)` (releases deliberately empty; see
      // `capacity-derivations.ts`'s own comment on why), `occupied` via `unitCapacity(unit, [])` —
      // reproduced exactly here rather than reusing `row.held`/`row.occupied`, which would just be
      // comparing the production value against itself.
      const expectedHeld = capacityBreakdown(row.unit, [], leaveBeds, NOW).held;
      const expectedOccupied = unitCapacity(row.unit, []).occupied;

      const tableRow = within(table).getByTestId(`ward-capacity-network-row-${row.unit.id}`);
      expect(
        within(tableRow).getByTestId("ward-capacity-network-confirmed"),
        `${row.unit.id}: confirmed`,
      ).toHaveTextContent(freeingCellText(expectedBreakdown.confirmedToday));
      expect(
        within(tableRow).getByTestId("ward-capacity-network-expected"),
        `${row.unit.id}: expected`,
      ).toHaveTextContent(freeingCellText(expectedBreakdown.expectedToday));
      expect(within(tableRow).getByTestId("ward-capacity-network-held"), `${row.unit.id}: held`).toHaveTextContent(
        countCellText(expectedHeld),
      );
      expect(
        within(tableRow).getByTestId("ward-capacity-network-occupied"),
        `${row.unit.id}: occupied`,
      ).toHaveTextContent(countCellText(expectedOccupied));
    }
  });
});
