import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import {
  admissionsForUnit,
  bedIsOccupied,
  daysInBed,
  type Admission,
} from "@/components/ward-management/ward-admissions";
import { WARD_ADMISSIONS_ANCHOR, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { wardSites } from "@/components/ward-management/ward-sites";

/**
 * One test for the first pass of the ward board, and deliberately only one thing each: that the
 * board draws a tile per recorded bed, and that every occupied tile states its own day count as
 * TEXT.
 *
 * The second of those is the one that matters. The stay band is rendered as a fill shade, and a
 * shade is invisible to a greyscale print, to forced-colors mode, and to a reader who cannot
 * separate two blues — so the day count on the tile is the entire reason the board is readable
 * without colour. A test that only counted tiles would stay green while every number vanished.
 *
 * The expected values are derived from the same seed the component reads rather than hard-coded,
 * because a hand-typed "20" would go stale the day an occupant is added to the fixture and would
 * then be a test asserting last month's ward.
 *
 * **Task A note.** `WardBoard` now mounts `<ClinicalRail />`, which reaches `WardRoleSwitcher`
 * (`ward-role-switcher.tsx`), which calls `useWardFlow()` — so every render below must sit inside
 * a `WardFlowProvider`, exactly as `tests/ward-nav.test.ts` and `tests/ward-landmarks.test.ts`
 * already wrap every Ward Flow route. `WardBoard` itself still reads the frozen
 * `WARD_ADMISSIONS_ANCHOR` seed directly rather than the provider's own state (see its own doc
 * comment) — the provider is here only because the rail it now mounts needs the context to exist,
 * not because the board reads anything from it. `WARD_ADMISSIONS_ANCHOR` and `NOW_ANCHOR`
 * (`ward-sites.ts`) are the same literal instant, so pinning the provider's clock to it keeps the
 * whole rendered page on one consistent "now".
 */
function renderWardBoard(unitId: string) {
  return render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <WardBoard unitId={unitId} />
    </WardFlowProvider>,
  );
}
const UNIT_ID = "rph-adult-secure";
/** The ward the defect was FOUND on: it records blocked beds, so it is the one where drawing them
 *  as ordinary empty tiles put more fillable-looking tiles on screen than the header claimed. */
const BLOCKED_UNIT_ID = "fsh-adult-secure";

function unitFor(unitId: string): Unit {
  const unit = wardSites.flatMap((site) => site.units).find((candidate) => candidate.id === unitId);
  if (unit === undefined) throw new Error(`No seeded unit ${unitId} — this test cannot check anything.`);
  return unit;
}

function occupantsFor(unitId: string): Admission[] {
  return admissionsForUnit(wardAdmissions, unitId).filter(bedIsOccupied);
}

describe("ward board page", () => {
  it("Nobody due out shows only arrived occupants with no expected departure", () => {
    const { container } = renderWardBoard(UNIT_ID);
    const expected = occupantsFor(UNIT_ID).filter(
      (admission) => daysInBed(admission, WARD_ADMISSIONS_ANCHOR) !== null && admission.expectedDischargeAt === null,
    );
    expect(expected.length).toBeGreaterThan(0);
    const filter = screen.getByTestId("ward-board-filter-quiet");
    expect(filter).toHaveTextContent(`Nobody due out${expected.length}`);
    fireEvent.click(filter);
    const visibleTiles = [...container.querySelectorAll<HTMLElement>("[data-bed-kind]")].filter((tile) => !tile.hidden);
    expect(visibleTiles).toHaveLength(expected.length);
    for (const tile of visibleTiles) {
      expect(tile).toHaveAttribute("data-bed-kind", "occupied");
      fireEvent.click(within(tile).getByRole("button"));
      expect(screen.getByTestId("ward-board-detail")).toHaveTextContent("No expected date set");
    }
  });

  it("clears an excluded selection while keeping every filtered bed mounted", () => {
    const { container } = renderWardBoard(UNIT_ID);
    const tile = container.querySelector<HTMLElement>('[data-bed-kind="occupied"]');
    expect(tile).not.toBeNull();
    fireEvent.click(within(tile!).getByRole("button"));
    expect(screen.getByTestId("ward-board-detail")).toHaveAttribute("data-detail-kind", "occupied");
    const ready = screen.getByTestId("ward-board-filter-ready");
    ready.focus();
    fireEvent.click(ready);
    expect(screen.getByTestId("ward-board-detail")).toHaveAttribute("data-detail-kind", "none");
    expect(tile).not.toBeVisible();
    expect(container.querySelectorAll("[data-bed-kind]")).toHaveLength(unitFor(UNIT_ID).beds);
    expect(ready).toHaveFocus();
    fireEvent.keyDown(ready, { key: "Escape" });
    expect(ready).toHaveFocus();
    fireEvent.click(screen.getByTestId("ward-board-filter-all"));
    expect(tile).toBeVisible();
  });

  it("draws one tile per recorded bed", () => {
    const unit = unitFor(UNIT_ID);
    const { container } = renderWardBoard(UNIT_ID);

    const tiles = container.querySelectorAll("[data-bed-kind]");
    // Guards the assertion below against passing on an empty ward: a board with zero beds and
    // zero tiles would satisfy an equality check while proving nothing.
    expect(unit.beds).toBeGreaterThan(0);
    expect(tiles).toHaveLength(unit.beds);
  });

  it("states the day count as text on every occupied tile", () => {
    const occupants = occupantsFor(UNIT_ID);
    // Only occupants who have actually ARRIVED carry a day count. A pulled bed is occupied — the
    // ward gave it away — but its stay has not started, so it shows "Pulled" instead.
    const arrived = occupants.filter((admission) => daysInBed(admission, WARD_ADMISSIONS_ANCHOR) !== null);
    expect(arrived.length).toBeGreaterThan(0);

    const { container } = renderWardBoard(UNIT_ID);

    const occupiedTiles = [...container.querySelectorAll('[data-bed-kind="occupied"]')];
    expect(occupiedTiles).toHaveLength(arrived.length);

    // Compared as a SORTED MULTISET of exact strings, not with a per-tile substring search. A
    // substring check passes when a tile reading "45" is accepted as evidence for a five-day
    // stay, and it cannot notice a duplicated or missing number at all — this ward really does
    // hold two five-day stays and a forty-five-day one, so that weakness is not hypothetical.
    const rendered = occupiedTiles
      .map((tile) => tile.querySelector('[data-testid$="-days"]')?.textContent ?? "")
      .sort();
    const expected = arrived
      .map((admission) => {
        const days = daysInBed(admission, WARD_ADMISSIONS_ANCHOR);
        return `${days} day${days === 1 ? "" : "s"}`;
      })
      .sort();
    expect(rendered).toEqual(expected);

    // And the pulled bed is drawn as taken, never as a free bed.
    const pulled = occupants.filter((admission) => daysInBed(admission, WARD_ADMISSIONS_ANCHOR) === null);
    expect(container.querySelectorAll('[data-bed-kind="waiting"]')).toHaveLength(pulled.length);
    expect(within(screen.getByTestId("ward-board-beds")).getAllByText("Pulled")).toHaveLength(pulled.length);
  });
});

/**
 * The defect the render found, pinned so it cannot come back.
 *
 * A bed with nobody in it is not necessarily a bed you can fill. Drawing an out-of-service bed as
 * an ordinary empty tile is not a cosmetic slip: it is the board telling a coordinator there is
 * somewhere to put a person when there is not, which on `fsh-adult-secure` meant four
 * empty-looking tiles under a header saying three.
 *
 * `tests/ward-board-consistency.test.ts` already pins the arithmetic in the FIXTURE across all 23
 * units (`beds − occupied === empty + blocked`). What is asserted here is the different half of
 * it: that the RENDERED BOARD spends those beds on the right kinds of tile. Both are needed — the
 * fixture was correct throughout the period the board was wrong.
 */
describe("ward board page — out-of-service beds", () => {
  // Owner ruling 2026-09-25: out-of-service beds are not recorded anywhere in the model, and an
  // empty bed the feed marked blocked counts as closed (once called held). So the sample network has no out-of-service
  // bed, and the board draws none: it never shows a count nothing records.
  it("draws no out-of-service tile, because no ward records an out-of-service bed", () => {
    const unit = unitFor(BLOCKED_UNIT_ID);
    expect(unit.blocked).toBe(0);

    const { container } = renderWardBoard(BLOCKED_UNIT_ID);

    expect(container.querySelectorAll('[data-bed-kind="blocked"]')).toHaveLength(0);
    expect(within(screen.getByTestId("ward-board-beds")).queryAllByText("Out of service")).toHaveLength(0);
  });

  /**
   * The whole point, stated as the thing a coordinator actually does: count the tiles that look
   * fillable and compare with the header. Asserted against the unit's OWN recorded empty figure
   * rather than against the number of tiles left over after the others are drawn, so a board that
   * simply relabelled some empties as blocked would not satisfy it.
   *
   * `fsh-adult-secure` is the fixture used here precisely because its `unitCapacity(...).held` is
   * `0` — `allocatable.value` (3) equals `empty.value` (3), so nothing is held back and the raw
   * `unit.empty.value` figure still equals the count of plain "Empty" tiles. That equality is a
   * property of THIS unit's numbers, not a general one once Task B splits empty into held and
   * available — see the `rph-adult-secure` describe block below for the unit where it does not
   * hold and the split actually shows up on screen.
   */
  it("leaves exactly the unit's fillable empty beds looking fillable", () => {
    const unit = unitFor(BLOCKED_UNIT_ID);
    // Since the owner's ruling of 2026-09-25 this unit's former blocked bed is an empty, CLOSED bed
    // (`unitCapacity().held`; no live pull here, so it equals the ruled Closed), so the fillable
    // empties are its empty beds less the closed ones (non-zero here).
    const { held } = unitCapacity(unit, []);
    expect(held, `${BLOCKED_UNIT_ID} should now hold its former blocked bed`).toBeGreaterThan(0);
    const { container } = renderWardBoard(BLOCKED_UNIT_ID);

    expect(container.querySelectorAll('[data-bed-kind="empty"]')).toHaveLength(unit.empty.value - held);
    expect(container.querySelectorAll('[data-bed-kind="closed"]')).toHaveLength(held);
  });

  /**
   * And the four kinds still add up to the ward's beds. A tile per bed was already asserted for
   * `rph-adult-secure`; here it is the partition that matters, because a blocked tile added
   * WITHOUT taking one away from the empties would leave the ward drawing more beds than it has —
   * the same defect in the opposite direction. Widened to include "closed" (Task B) alongside
   * "empty": `fsh-adult-secure` has none, so this also doubles as a non-vacuity check that the
   * closed branch does not silently swallow tiles that belong on the empty side.
   */
  it("partitions every bed into occupied, out-of-service, closed or empty, with none left over", () => {
    const unit = unitFor(BLOCKED_UNIT_ID);
    const { container } = renderWardBoard(BLOCKED_UNIT_ID);

    const counts = {
      occupied: container.querySelectorAll('[data-bed-kind="occupied"]').length,
      waiting: container.querySelectorAll('[data-bed-kind="waiting"]').length,
      blocked: container.querySelectorAll('[data-bed-kind="blocked"]').length,
      closed: container.querySelectorAll('[data-bed-kind="closed"]').length,
      empty: container.querySelectorAll('[data-bed-kind="empty"]').length,
    };

    // "Waiting" is an OCCUPIED bed — the ward gave it away and the person has not arrived. It is
    // counted on the occupied side of this sum, never with the empties.
    expect(counts.occupied + counts.waiting).toBe(occupantsFor(BLOCKED_UNIT_ID).length);
    expect(counts.occupied + counts.waiting + counts.blocked + counts.closed + counts.empty).toBe(unit.beds);
    expect(container.querySelectorAll("[data-bed-kind]")).toHaveLength(unit.beds);
  });
});

/**
 * Task B: a bed nobody is in that a coordinator still cannot fill. On `rph-adult-secure` the
 * header already said "1 bed you can fill today" (`min(allocatable, empty)` = `min(1, 2)`), but
 * the first board pass drew BOTH of its physically-empty beds as plain "Empty" — the header and
 * the grid disagreeing about how many beds are actually offered, the same class of defect the
 * blocked-tile suite above already pins for out-of-service beds.
 *
 * `rph-adult-secure` is the fixture used here precisely because it is the unit named in the task:
 * `beds: 20, empty: 2, allocatable: 1, blocked: 0`, so `unitCapacity` derives `held: 1` and
 * `available: 1` — a non-zero count on a unit with no blocked beds at all, so this suite cannot
 * pass by accident via the blocked-tile logic. That empty-but-not-offered bed is now called
 * **Closed** (2026-09-01 ruling 5; `ward-bed-states.ts`): "Held" means only a leave bed.
 */
describe("ward board page — closed beds", () => {
  it("draws rph-adult-secure's closed bed as its own tile kind, agreeing with the header", () => {
    const unit = unitFor(UNIT_ID);
    const capacity = unitCapacity(unit, []);
    // Non-vacuity: if the fixture ever changes so this unit has no held bed, this suite would
    // otherwise pass while proving nothing about the held tile at all.
    expect(
      capacity.held,
      `${UNIT_ID} must have at least one held bed for this suite to prove anything`,
    ).toBeGreaterThan(0);

    const { container } = renderWardBoard(UNIT_ID);

    const headline = screen.getByTestId("ward-board-headline");
    expect(headline.textContent).toContain(`${capacity.available}`);

    expect(container.querySelectorAll('[data-bed-kind="closed"]')).toHaveLength(capacity.held);
    // Said in WORDS on every one of them, not by the dot pattern alone.
    //
    // **Scoped to the grid, and the reason is a real collision rather than a tidy-up.** The triage
    // bar added by the three-zone rebuild prints `CAPACITY_FIGURE_LABELS.held` ("Closed"), which is
    // the same word — so a page-wide `getAllByText("Closed")` finds two elements. The two are not a
    // contradiction: the bar's figure and the tiles are the same closed count seen twice, which is
    // exactly what the next assertion below now proves rather than assumes. (No live pull on the
    // seeded ward, so the ruled Closed equals `unitCapacity().held` here.)
    expect(within(screen.getByTestId("ward-board-beds")).getAllByText("Closed")).toHaveLength(capacity.held);
    expect(within(screen.getByTestId("ward-board-beds")).queryAllByText("Held")).toHaveLength(0);
    // The triage bar's own Closed figure, against the tiles drawn for it. Two surfaces on one page
    // showing one fact is only safe while they agree, and this is what makes the agreement fail
    // loudly instead of quietly.
    expect(screen.getByTestId("ward-board-figure-held").textContent).toContain(`${capacity.held}`);

    // The plain "Empty" tiles are only the FILLABLE subset now — `available`, not the unit's raw
    // `empty.value` (which also includes the closed bed). Closed and ready must add back up to
    // the unit's own physically-empty count, and every kind together must still equal the beds.
    const counts = {
      occupied: container.querySelectorAll('[data-bed-kind="occupied"]').length,
      waiting: container.querySelectorAll('[data-bed-kind="waiting"]').length,
      blocked: container.querySelectorAll('[data-bed-kind="blocked"]').length,
      closed: container.querySelectorAll('[data-bed-kind="closed"]').length,
      empty: container.querySelectorAll('[data-bed-kind="empty"]').length,
    };
    expect(counts.empty).toBe(capacity.available);
    expect(counts.closed + counts.empty).toBe(unit.empty.value);
    expect(counts.occupied + counts.waiting + counts.blocked + counts.closed + counts.empty).toBe(unit.beds);
  });
});
