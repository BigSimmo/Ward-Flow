import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import {
  countCellText,
  networkTotals,
  networkWardRows,
} from "@/components/ward-management/capacity/capacity-derivations";
import { BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

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
 *
 * Capacity redesign (Josh, 31 Oct 2026): the network table, its per-ward columns and the "Ready
 * now" panel are gone. Case 2 now reads the hero's "N beds ready of M"; case 20 reads each ward's
 * own occupied, pulled and closed beds in its ward drawer, opened from its bed map card. The
 * per-ward Confirmed and Expected columns went with the table, so that half of case 20 is retired.
 * The note above about `NetworkRow`'s repeated test ids describes the removed table.
 */
const NOW = NOW_ANCHOR;
const seed = seedWardFlowState();
// Same arguments `useCapacityModel` passes to `networkWardRows`.
const networkRows = networkWardRows(seed.units, NOW, seed.bedReleases, seed.admissions, seed.leaveBeds);
const netTotals = networkTotals(networkRows);

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
    </WardFlowProvider>,
  );
}

/** A ward card's visible name: its text without the spelled-out code a screen reader hears. */
function visibleName(element: Element | null): string {
  if (!element) return "";
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll("abbr + span").forEach((node) => node.remove());
  return (clone.textContent ?? "").trim();
}

/** Opens a ward's drawer from its bed map card, as a coordinator would. */
function openWardDrawer(unit: { id: string; name: string }): HTMLElement {
  const map = document.getElementById("capacity-bed-map");
  if (!map) throw new Error("no bed map on the Capacity screen");
  const card = Array.from(map.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]')).find(
    (button) => visibleName(button.firstElementChild) === unit.name,
  );
  if (!card) throw new Error(`no bed map card for ${unit.id}`);
  fireEvent.click(card);
  const drawer = screen.getByTestId("ward-capacity-ward-drawer");
  expect(drawer).toHaveAccessibleName(unit.name);
  return drawer;
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
 * The old wording asserted `toHaveTextContent("not approved for clinical use")` — a phrase this banner does
 * not carry. `expectSays` is used, not an exact match, for the same reason
 * `tests/helpers/ward-caption.ts` gives for every other caption in this suite: a caption reworded
 * keeps meaning what it means, and pinning the sentence goes red on a legitimate rewording — but the
 * concepts asserted here (invented data, no real hospital, not a clinical record) are the substance
 * an old "not approved for clinical use" reader was also relying on, restated in this screen's own words.
 */
describe("Case 1 — Capacity identifies synthetic data via the governance footer", () => {
  it("keeps the synthetic prototype disclosure visible in the footer", () => {
    renderScreen();
    // Hospital names are real directory facts. The synthetic marker applies to the operational data.
    const governance = screen.getByTestId("ward-capacity-governance");
    expect(within(governance).getByText("Synthetic prototype")).toBeVisible();
    // Redesign (31 Oct 2026): the footer note is shorter, "Modelled network · CAHS wards not modelled".
    expect(governance).toHaveTextContent(/Modelled network/u);
    expect(governance).toHaveTextContent(/CAHS (inpatient )?wards (are )?not modelled/u);
    expect(governance).toHaveTextContent(/Not approved for clinical use/u);
  });

  // Josh's warnings trim (31 Oct 2026) dropped "private live feeds are unavailable" from the footer.
  // What stays is that the figures are a modelled network, so they are never read as every bed in WA.
  it("still says the figures are a modelled network, not every bed in WA", () => {
    renderScreen();
    const footer = screen.getByTestId("ward-capacity-governance");
    expect(footer).toHaveTextContent(/Modelled network/u);
    expect(footer).toHaveTextContent(/not modelled/u);
  });
});

/**
 * Inherits retired case 2 ("renders the headline as availableNow alone, never mixing in
 * confirmedToday, expectedToday or onLeave"). Since the redesign (31 Oct 2026) CapacityScreen's
 * headline is the hero's title, which states `netTotals.ready` beds ready of `netTotals.beds` and
 * nothing else. `netTotals` (`capacity-derivations.ts`) is computed as
 * `{ wards, beds, ready, pendingPreparation }` — it structurally cannot carry a same-day
 * confirmed/expected/closed figure, because nothing sums one into it. This asserts the number itself,
 * independently derived from the real fixture, and floors on confirmed/expected/closed genuinely being
 * non-zero and different from `ready` — the same "guard the guard" the retired case ran, so an
 * anchored equality below cannot pass by coincidence on a fixture where every figure happens to
 * agree.
 */
describe("Case 2 — the hero headline states availableNow alone", () => {
  it("shows exactly netTotals.ready of netTotals.beds beds, never a total inflated by confirmed, expected or closed", () => {
    const confirmedTotal = networkRows.reduce((sum, row) => sum + (row.confirmed ?? 0), 0);
    const expectedTotal = networkRows.reduce((sum, row) => sum + (row.expected ?? 0), 0);
    const closedTotal = networkRows.reduce((sum, row) => sum + row.closed, 0);

    expect(confirmedTotal, "fixture assumption: some ward confirms a release today").toBeGreaterThan(0);
    expect(expectedTotal, "fixture assumption: some ward expects a release today").toBeGreaterThan(0);
    expect(closedTotal, "fixture assumption: some ward has a closed bed today").toBeGreaterThan(0);
    expect(confirmedTotal, "confirmed and ready coincide — this fixture cannot distinguish the two").not.toBe(
      netTotals.ready,
    );
    expect(expectedTotal, "expected and ready coincide — this fixture cannot distinguish the two").not.toBe(
      netTotals.ready,
    );
    expect(closedTotal, "closed and ready coincide — this fixture cannot distinguish the two").not.toBe(
      netTotals.ready,
    );

    renderScreen();
    const headline = screen.getByRole("heading", { level: 1 });
    expect(
      headline.textContent?.replace(/\s+/gu, " ").trim(),
      `the headline must state exactly ${netTotals.ready} beds ready of ${netTotals.beds}`,
    ).toBe(`Capacity, ${netTotals.ready} beds ready of ${netTotals.beds}`);
  });
});

/**
 * Inherits retired case 20 ("renders each ward row from its own breakdown, computed for that ward
 * alone, not its hospital's rolled-up total"). The retired case's own mutation targets —
 * `serviceRollup` rolling a site up from the whole network, `SiteBlock` reading its first ward's
 * breakdown, `UnitRow` reading the site rollup instead of the unit's own — do not exist as separate
 * derivation paths here, but the SAME class of bug is still reachable through each ward's occupied,
 * pulled and closed beds: a mutation that read one ward's figure for every ward would still sum
 * correctly at the group level and pass every group-level test.
 *
 * Since the redesign (31 Oct 2026) these are read in each ward's drawer ("N occupied · N pulled ·
 * N closed" under its beds). The per-ward Confirmed and Expected columns went with the network
 * table and are no longer drawn anywhere on Capacity, so that half is retired.
 *
 * Floored the same way the retired case was: the figures must genuinely vary across wards, or a
 * same-value-everywhere mutation would be numerically invisible.
 */
describe("Case 20 — each ward's drawer states its own occupied, pulled and closed beds, never another ward's or the group's rolled-up total", () => {
  it("matches an independently-computed bedStates for that unit alone, on every ward", () => {
    const states = new Map(
      networkRows.map((row) => [row.unit.id, bedStates(row.unit, seed.admissions, seed.bedReleases, seed.leaveBeds)]),
    );
    expect(
      new Set([...states.values()].map((state) => state.occupied)).size,
      "every ward's occupied figure is identical — a same-value-everywhere mutation would be invisible",
    ).toBeGreaterThan(1);
    expect(
      [...states.values()].some((state) => state.pulled > 0),
      "no ward has a pulled patient — the pulled figure is untested",
    ).toBe(true);
    expect(
      [...states.values()].some((state) => state.closed > 0),
      "no ward has a closed bed — the closed figure is untested",
    ).toBe(true);

    renderScreen();
    for (const row of networkRows) {
      // Pulled, Closed and Occupied are the ruled boxes (`ward-bed-states.ts`), read from a SEPARATE
      // call with the same inputs the screen passes — reproduced here rather than reusing
      // `row.pulled`/`row.closed`/`row.occupied`, which would just be comparing the production value
      // against itself. Closed is the box once mislabelled "Held".
      const expected = states.get(row.unit.id)!;
      const beds = within(openWardDrawer(row.unit)).getByRole("region", { name: "Beds now" });
      const notes = (Array.from(beds.querySelectorAll("p")).at(-1)?.textContent ?? "").split(" · ");
      const figure = (label: string) =>
        notes.find((note) => note.endsWith(` ${label.toLowerCase()}`))?.replace(` ${label.toLowerCase()}`, "");

      expect(figure(BED_STATE_LABELS.occupied), `${row.unit.id}: occupied`).toBe(countCellText(expected.occupied));
      // Pulled and closed are said only when there is one (a zero is left off the line).
      expect(figure(BED_STATE_LABELS.pulled), `${row.unit.id}: pulled`).toBe(
        expected.pulled > 0 ? String(expected.pulled) : undefined,
      );
      expect(figure(BED_STATE_LABELS.closed), `${row.unit.id}: closed`).toBe(
        expected.closed > 0 ? String(expected.closed) : undefined,
      );
    }
  });
});
