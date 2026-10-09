// The setup file already loads these matchers; importing them here as well lets the commit-time
// type check, which reads only the changed files, see them too.
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { expectSays } from "./helpers/ward-caption";
import { vi } from "vitest";

// Same reason as every sibling dom suite (ward-handover.dom.test.tsx, ward-ed-screen.dom.test.tsx):
// `ClinicalRail` renders next/link anchors and this suite never checks routing, so a plain <a>
// avoids an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { EVENING_SHIFT_END_MINUTES } from "@/components/ward-management/ward-bed-availability";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { DischargeBoard, groupDischarges } from "@/components/ward-management/discharges/discharge-board";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
// CHANGED 25 September 2026: the fixture's nine hand-written `WR-00N` bed releases (owner ruling,
// ward-movements.ts) were replaced by `derivedBedReleases(wardAdmissions, NOW_ANCHOR)` — every
// occupied admission's own real `expectedDischargeAt`/`dischargeConfirmedAt`, plus one
// "discharged" release per admission that has actually departed. The old fixed counts ("2 blocked,
// 2 confirmed, 4 expected, 1 discharged, 9 rows") described that hand-written fixture and are no
// longer true of anything. Every test below that used to assert one of those numbers now computes
// its expectation from this same exported `bedReleases` array, using the SAME `groupDischarges`
// the board itself calls — never a number read off the old fixture and typed in here.
import { bedReleases as seededBedReleases } from "@/components/ward-management/ward-movements";

function renderBoard() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <DischargeBoard />
    </WardFlowProvider>,
  );
}

/**
 * Raises a real `FLAG_BED_RELEASE` reducer event — the same mechanism `ward-handover.dom.test.tsx`'s
 * `ClockAdvancer` uses to move shared state without reaching into the reducer directly — carrying
 * an explicit `expectedAt` two full days out, safely beyond the rolling horizon WB-DB-7 introduced. `FLAG_BED_RELEASE`
 * carries the ward's own estimate as `event.expectedAt` (see `ward-flow-events.ts`'s own doc
 * comment); this is a real, reducer-produced `BedRelease` whose `expectedAt` genuinely falls
 * beyond tonight — not a fixture or component change, and independent of the board's own live
 * `now` (pinned at `NOW_ANCHOR`).
 */
function FarFutureReleaseFlagger() {
  const { dispatch, admissions, bedReleases } = useWardFlow();
  // A bed release names the occupant whose stay it belongs to: one with no live release yet.
  const occupant = admissions.find(
    (a) =>
      a.unitId === "rph-adult-secure" &&
      a.state === "occupied" &&
      !bedReleases.some((r) => r.admissionId === a.id && r.state !== "discharged"),
  );
  return (
    <button
      type="button"
      onClick={() =>
        dispatch({
          type: "FLAG_BED_RELEASE",
          role: "ward",
          now: EVENING_SHIFT_END_MINUTES + 100,
          unitId: "rph-adult-secure",
          actingUnitId: "rph-adult-secure",
          admissionId: occupant?.id ?? "",
          waitingOn: "Nothing outstanding",
          expectedAt: NOW_ANCHOR + 2 * MINUTES_PER_DAY,
        })
      }
    >
      flag far-future release
    </button>
  );
}

/**
 * The rendered header names of a table, in DOM order — read once per table so a column lookup
 * below can find "where is Expected THIS RENDER" instead of assuming it never moves.
 */
function tableHeaders(table: HTMLElement): string[] {
  return within(table)
    .getAllByRole("columnheader")
    .map((header) => header.textContent ?? "");
}

/**
 * Old shape of this file: every cell lookup hard-coded a column's index — `[2]` for Expected,
 * `[0]`/`[3]` for Unit/Stage. That index happened to keep two properties true at once: it read the
 * right FACT (because the index matched today's layout) and, incidentally, it would go wrong if a
 * value ever rendered under the wrong heading (because it read a fixed DOM position regardless of
 * what the `<thead>` said lived there). A redesign that adds, removes or reorders a column breaks
 * the first property on purpose and the second one by accident, and nothing told the two apart.
 *
 * Cell lookups below now find a column by its HEADER NAME, resolved fresh from the rendered
 * `<thead>` on every call — never a hard-coded integer — so a column moving in the header moves
 * the lookup with it. This function is what a name-based lookup still needs beyond that: proof
 * that a row's cells actually line up with the header row promising them, for every data row the
 * number of cells must equal the number of headers, and every column name this file reads must
 * resolve to a real, in-range position. Without it, a row that silently rendered one cell short
 * (say, a conditional column that dropped out for one row but not its header) would have the
 * name-based lookup quietly read the WRONG neighbouring cell instead of failing loudly.
 *
 * ⚠️ **MEASURED, NOT ASSUMED — THIS FUNCTION IS NOT WHAT CATCHES A VALUE RENDERED UNDER THE WRONG
 * HEADING.** Mutation-tested 2026-09-05: swapping the `Health service` and `Expected` `<td>`s while
 * leaving the `<thead>` untouched left `assertRowsMatchHeaders` green (the cell COUNT never
 * changed) and turned red the ordinary value assertion in the test body instead
 * (`expect(timingColumn(...)).toEqual(["By midday", "By midday"])`, which read "East Metro" —
 * see the mutation report kept in the task record). That is the coverage this file's cell-swap
 * mutation actually needs, and it survives the refactor for a plainer reason than this function:
 * so long as the HEADER order is unchanged, "Expected"'s resolved index is the same number `[2]`
 * always was, so the value assertion reads the identical position it always did and still catches
 * a value landing there wrong. What this function adds beyond that is the case a value comparison
 * cannot cover on its own — the header ITSELF moving. If a redesign reorders the `<thead>` (Stage
 * before Expected, say) along with the matching `<td>`s, a hard-coded `[2]` would silently start
 * reading Stage's values as Expected's; the name-based lookup here follows "Expected" wherever the
 * header goes, and this function is what confirms there is still one real cell per header for it
 * to land on.
 */
function assertRowsMatchHeaders(headers: string[], rows: HTMLElement[], columnNames: readonly string[]): void {
  /*
   * FLOORED ON THE POPULATION WALKED, NOT ON THE VIOLATIONS FOUND. The per-row loop below asserts
   * nothing at all when `rows` is empty, so a board that rendered no rows would satisfy this helper
   * completely — and that is precisely the day it is worth least. Both floors are asserted here
   * rather than assumed from the caller, because a caller that stops passing rows is exactly the
   * change nobody would think to re-check this helper against.
   */
  expect(headers.length, "the table rendered no column headers, so every lookup below is vacuous").toBeGreaterThan(0);
  expect(
    rows.length,
    "the table rendered no data rows, so the per-row correspondence check ran zero times",
  ).toBeGreaterThan(0);
  for (const name of columnNames) {
    expect(
      headers.indexOf(name),
      `no column is headed "${name}" — headers are: ${headers.join(" | ")}`,
    ).toBeGreaterThanOrEqual(0);
  }
  for (const row of rows) {
    expect(
      within(row).getAllByRole("cell"),
      `a row has a different number of cells than the table has headers (${headers.length})`,
    ).toHaveLength(headers.length);
  }
}

/** The in-range index of a named column, resolved fresh from this render's header row. */
function columnIndex(headers: string[], name: string): number {
  const index = headers.indexOf(name);
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

/**
 * The rendered timing cell of every release row in one group of the shared worklist, which
 * `discharge-board.tsx` leads with `BAND_LABELS[releaseBand(release, now)]`. Read the DOM rather than
 * by calling `releaseBand` again, so the assertion fails if the band the screen SHOWS stops
 * matching the clock the provider serves — and read by the "Timing" header's own runtime
 * position, guarded by `assertRowsMatchHeaders`, rather than by a hard-coded column number. See
 * that function's comment for why the header-name lookup alone would not be enough.
 */
const RELEASE_GROUP_KEYS = ["blocked", "confirmed", "expected", "discharged-today"] as const;
type ReleaseGroupKey = (typeof RELEASE_GROUP_KEYS)[number];

function releaseWorklist(): HTMLElement {
  return within(screen.getByRole("region", { name: "Discharge worklist" })).getByRole("table");
}

function releaseGroup(key: ReleaseGroupKey): HTMLElement {
  return within(releaseWorklist()).getByTestId(`ward-discharge-group-${key}`);
}

/** Actual release rows have a ward opener; group headers and honest empty rows do not. */
function releaseRows(key: ReleaseGroupKey): HTMLElement[] {
  return within(releaseGroup(key))
    .getAllByRole("row")
    .filter((row) => within(row).queryByRole("button") !== null);
}

function releaseRowForWard(key: ReleaseGroupKey, wardName: string): HTMLElement {
  const row = within(releaseGroup(key)).getByRole("button", { name: wardName }).closest("tr");
  if (!row) throw new Error(`${wardName} has no containing release row`);
  return row;
}

function timingColumn(key: ReleaseGroupKey): string[] {
  const table = releaseWorklist();
  const headers = tableHeaders(table);
  const rows = releaseRows(key);
  assertRowsMatchHeaders(headers, rows, ["Timing"]);
  const index = columnIndex(headers, "Timing");
  return rows.map((row) => within(row).getAllByRole("cell")[index]?.textContent ?? "");
}

/**
 * Added 25 September 2026, for the tests below that used to name a fixed row ("FSH Adult Secure",
 * WR-007/WR-009) which no longer exists. The real derived seed still mixes a confirmed-and-blocked
 * release with an expected-and-blocked one — RPHS's own stuck confirmed discharge is the seed's
 * own "most load-bearing single occupant" case, authored specifically to keep this property real
 * (see `bedReleases`'s own doc comment in `ward-movements.ts`) — so this reads the mix straight off
 * the rendered Stage column instead of assuming which admission plays which role.
 *
 * `within(cell).queryByText(stage)` rather than a raw `cell.textContent` comparison: a blocked
 * row's Stage/blocker cell always carries the release's blocker text alongside its stage badge (a
 * blocked release always has a non-null blocker, by construction), so the cell's own textContent
 * is never just "Confirmed" or "Expected" on its own — it is the badge's OWN text node that must
 * match exactly, not the cell's concatenation of badge-plus-blocker.
 */
function blockedRowByStage(stage: "Confirmed" | "Expected"): HTMLElement {
  const headers = tableHeaders(releaseWorklist());
  const rows = releaseRows("blocked");
  assertRowsMatchHeaders(headers, rows, ["Stage / blocker"]);
  const stageIndex = columnIndex(headers, "Stage / blocker");
  const row = rows.find((candidate) => {
    const cell = within(candidate).getAllByRole("cell")[stageIndex];
    return within(cell).queryByText(stage) !== null;
  });
  if (!row) {
    throw new Error(`no blocked row shows stage "${stage}" — the mix this suite exists to prove is gone`);
  }
  return row;
}

/** A unit's real display name, read from the network topology rather than assumed — the
 *  "standard" scenario `seedWardFlowState` renders with is `scenarioUnits("standard")`, which is
 *  `structuredClone(allUnits())` unchanged (`ward-scenarios.ts`), so this matches what the board
 *  actually renders for any real unit id. */
function unitDisplayName(unitId: string): string {
  const name = allUnits().find((unit) => unit.id === unitId)?.name;
  if (!name) {
    throw new Error(`no unit named "${unitId}" in the network`);
  }
  return name;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("DischargeBoard", () => {
  it("groups releases under Blocked, Confirmed, Expected and the last-24-hours group, in that exact order", () => {
    renderBoard();

    const groups = within(releaseWorklist())
      .getAllByTestId(/^ward-discharge-group-/)
      .map((group) => group.getAttribute("data-testid"));
    expect(groups).toEqual(RELEASE_GROUP_KEYS.map((key) => `ward-discharge-group-${key}`));

    // CHANGED 25 September 2026: the fixture's fixed "2 blocked, 2 confirmed, 4 expected, 1
    // discharged" counts described nine hand-written WR-00N releases that no longer exist. Each
    // heading's count is checked against the SAME `groupDischarges` the board itself calls,
    // applied to the same exported `bedReleases`, rather than a number read off the old fixture —
    // and every group is required to be genuinely non-empty, so this cannot pass by the seed
    // happening to leave a group at zero.
    const expectedGroups = groupDischarges(seededBedReleases, NOW_ANCHOR);
    expect(expectedGroups.blocked.length).toBeGreaterThan(0);
    expect(expectedGroups.confirmed.length).toBeGreaterThan(0);
    expect(expectedGroups.expected.length).toBeGreaterThan(0);
    expect(expectedGroups["discharged-today"].length).toBeGreaterThan(0);
    // The expectation above comes from the board's own grouping, so the grouping is checked here
    // against the rule in plain terms, independently of how `groupDischarges` is written: every
    // blocked row carries a blocker, Confirmed and Expected rows carry none and sit at their own
    // stage, the last-24-hours rows are discharged, and nothing is counted twice or lost.
    expect(expectedGroups.blocked.every((r) => r.blocker !== null && r.state !== "discharged")).toBe(true);
    expect(expectedGroups.confirmed.every((r) => r.blocker === null && r.state === "confirmed")).toBe(true);
    expect(expectedGroups.expected.every((r) => r.blocker === null && r.state === "expected")).toBe(true);
    expect(expectedGroups["discharged-today"].every((r) => r.state === "discharged")).toBe(true);
    expect(
      expectedGroups.blocked.length +
        expectedGroups.confirmed.length +
        expectedGroups.expected.length +
        expectedGroups["discharged-today"].length +
        expectedGroups.excludedBeyondToday +
        expectedGroups.completedBeforeToday,
    ).toBe(seededBedReleases.length);

    expect(
      within(releaseGroup("blocked")).getByRole("heading", {
        name: new RegExp(`^Blocked\\s+${expectedGroups.blocked.length}$`, "u"),
      }),
    ).toBeInTheDocument();
    expect(
      within(releaseGroup("confirmed")).getByRole("heading", {
        name: new RegExp(`^Confirmed\\s+${expectedGroups.confirmed.length}$`, "u"),
      }),
    ).toBeInTheDocument();
    expect(
      within(releaseGroup("expected")).getByRole("heading", {
        name: new RegExp(`^Expected\\s+${expectedGroups.expected.length}$`, "u"),
      }),
    ).toBeInTheDocument();
    expect(
      within(releaseGroup("discharged-today")).getByRole("heading", {
        name: new RegExp(`^Discharged in last 24 hours\\s+${expectedGroups["discharged-today"].length}$`, "u"),
      }),
    ).toBeInTheDocument();
  });

  it("names the blocker on a blocked row", () => {
    renderBoard();

    // WR-007 in the real fixture (ward-movements.ts) is blocked with blocker "Awaiting
    // accommodation" — chosen from BED_RELEASE_BLOCKERS, never free text.
    expect(within(releaseGroup("blocked")).getByText("Awaiting accommodation")).toBeInTheDocument();
  });

  /**
   * Bed-model rework (2026-08-28). The Blocked group is now keyed on the FLAG, not on a state, so
   * it holds releases at two different stages at once — and every row states its own stage.
   * Without that column the group would swallow the fact this rework exists to preserve: that a
   * stuck discharge can be one the ward has already DECIDED. A coordinator who cannot tell a
   * blocked prediction from a blocked confirmation cannot tell which bed to chase first.
   *
   * The real fixture seeds exactly this pair — WR-007 confirmed-and-blocked at fsh-adult-secure,
   * WR-009 expected-and-blocked at rgh-adult-secure — so the assertion is over a genuinely mixed
   * group, not one row that happens to agree with whatever the implementation prints.
   */
  it("states each blocked row's own stage, so a blocked confirmation is not mistaken for a blocked prediction", () => {
    renderBoard();

    // CHANGED 25 September 2026: WR-007 (confirmed-and-blocked, FSH Adult Secure) and WR-009
    // (expected-and-blocked, RGH Adult Secure) no longer exist — the fixture's nine hand-written
    // releases were replaced by `derivedBedReleases(wardAdmissions, NOW_ANCHOR)` (owner ruling,
    // ward-movements.ts). The real seed still mixes a confirmed-and-blocked release with an
    // expected-and-blocked one, so the property this test proves still holds; the rows are found
    // by their rendered Stage text (`blockedRowByStage`) rather than a hand-picked ward name, and
    // the row COUNT is computed from the same `groupDischarges` the board itself calls rather than
    // typed in.
    const expectedBlockedCount = groupDischarges(seededBedReleases, NOW_ANCHOR).blocked.length;
    const dataRows = releaseRows("blocked");
    expect(dataRows).toHaveLength(expectedBlockedCount);

    const confirmedRow = blockedRowByStage("Confirmed");
    const expectedRow = blockedRowByStage("Expected");
    const headers = tableHeaders(releaseWorklist());
    const stageIndex = columnIndex(headers, "Stage / blocker");
    expect(within(confirmedRow).getAllByRole("cell")[stageIndex]).toHaveTextContent("Confirmed");
    expect(within(expectedRow).getAllByRole("cell")[stageIndex]).toHaveTextContent("Expected");
  });

  /**
   * The grouping rule itself, stated as a rule rather than inferred from the fixture: the flag is
   * read BEFORE the stage. A blocked-but-confirmed release belongs in Blocked (the group a
   * coordinator scans first) and must NOT also appear under Confirmed — this board is a work
   * queue, where each release appears exactly once. That is deliberately the opposite trade-off
   * from `CapacityBreakdown.blockedToday`, which is a set of counts and cross-cuts on purpose.
   */
  it("puts a blocked-but-confirmed release in Blocked and nowhere else", () => {
    renderBoard();

    // CHANGED 25 September 2026: see the previous test's comment — WR-007/"FSH Adult Secure" no
    // longer exists, so the confirmed-and-blocked release is found by its rendered Stage text
    // instead, and the ward name it belongs to is read off that same row.
    const confirmedBlockedRow = blockedRowByStage("Confirmed");
    const wardName = within(confirmedBlockedRow).getByRole("button").textContent;
    if (!wardName) {
      throw new Error("the confirmed-and-blocked row's ward button has no text");
    }

    expect(within(releaseGroup("confirmed")).queryByRole("button", { name: wardName })).not.toBeInTheDocument();
    expect(within(releaseGroup("blocked")).getByRole("button", { name: wardName })).toBeInTheDocument();
  });

  it("shows a selected release's confirming role exactly once with its freshness detail", () => {
    renderBoard();

    // CHANGED 25 September 2026: WR-007's hand-authored confirming role "NUM FSH Adult Secure" no
    // longer exists — the real seed's confirming role comes from `DISCHARGE_DATE_SETTERS`
    // (ward-admissions-seed.ts) by index, so it is read back off the rendered freshness stamp
    // itself rather than pinned as a literal. The property under test — the role is shown exactly
    // once, alongside its freshness stamp — does not depend on which role string it actually is.
    const confirmedBlockedRow = blockedRowByStage("Confirmed");
    fireEvent.click(within(confirmedBlockedRow).getByRole("button"));
    const detail = screen.getByRole("region", { name: "Selected discharge details" });
    const stamp = within(detail).getByText(/^Confirmed \d{2}:\d{2} · .+$/);
    const role = stamp.textContent?.replace(/^Confirmed \d{2}:\d{2} · /, "") ?? "";
    expect(role.length).toBeGreaterThan(0);
    expect(detail.textContent?.match(new RegExp(escapeRegExp(role), "g")) ?? []).toHaveLength(1);
  });

  it("states the excluded-beyond-today count as the number the live seed actually produces", () => {
    renderBoard();

    // CHANGED 25 September 2026: the old fixture's nine hand-written releases all fell at or
    // before EVENING_SHIFT_END_MINUTES from NOW_ANCHOR, so "0 excluded" was true of it. The real
    // derived seed deliberately carries many admissions with an `expectedDischargeAt` two or more
    // days out (`derivedBedReleases`, ward-discharge-dates.ts), so "0" is no longer a true fact
    // about this seed — pinning it as a literal would be exactly the fabricated-figure defect this
    // codebase treats as a bug. The count is computed independently, from the same exported
    // `bedReleases` the board itself reads, and the test requires it be a real positive number
    // rather than accepting a coincidental 0.
    const expectedExcluded = groupDischarges(seededBedReleases, NOW_ANCHOR).excludedBeyondToday;
    expect(
      expectedExcluded,
      "the live seed has nothing 2+ days out any more, so this count can no longer prove the figure is real",
    ).toBeGreaterThan(0);

    const excluded = screen.getByTestId("ward-discharge-excluded");
    expect(within(excluded).getByText(new RegExp(`^${expectedExcluded} expected in 2\\+ days$`))).toHaveTextContent(
      new RegExp(`^${expectedExcluded}\\b`),
    );
    expect(excluded.textContent?.toLowerCase()).not.toContain("none");
  });

  it("gives every release a freshness stamp in its selected detail", () => {
    renderBoard();

    let inspected = 0;
    for (const key of RELEASE_GROUP_KEYS) {
      const rows = releaseRows(key);
      expect(rows.length, `${key} has no release row, so its detail freshness was not exercised`).toBeGreaterThan(0);
      for (const row of rows) {
        fireEvent.click(within(row).getByRole("button"));
        expect(
          within(screen.getByRole("region", { name: "Selected discharge details" })).getByText(
            /^Confirmed \d{2}:\d{2} ·/,
          ),
        ).toBeInTheDocument();
        inspected += 1;
      }
    }
    // CHANGED 25 September 2026: 9 was the hand-written fixture's total row count across all four
    // groups. The real derived seed's total is computed the same way the board computes it — every
    // release `groupDischarges` places into one of the four buckets, excluding whatever it counts
    // as excluded-beyond-today or completed-before-today — rather than a number read off the old
    // fixture and typed in here.
    const expectedGroups = groupDischarges(seededBedReleases, NOW_ANCHOR);
    const expectedTotal =
      expectedGroups.blocked.length +
      expectedGroups.confirmed.length +
      expectedGroups.expected.length +
      expectedGroups["discharged-today"].length;
    expect(inspected).toBe(expectedTotal);
  });

  it("counts a release expected beyond tonight without listing it in any group", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
        <FarFutureReleaseFlagger />
      </WardFlowProvider>,
    );

    // CHANGED 25 September 2026: the old fixture's exact "2 blocked, 2 confirmed, 4 expected, 1
    // released, 9 rows, 0 excluded" baseline no longer exists — the real derived seed already
    // excludes several admissions 2+ days out (see the previous excluded-count test). The BEFORE
    // figures are read straight off the render instead of assumed, so the property this test
    // actually proves — flagging a far-future release moves the excluded count by exactly one,
    // leaves every listed group's row count untouched, and the new release is declared but never
    // listed — holds regardless of what the baseline number is.
    const excludedBefore = Number(
      within(screen.getByTestId("ward-discharge-excluded"))
        .getByText(/^\d+ expected in 2\+ days$/)
        .textContent?.match(/^(\d+)/)?.[1],
    );
    expect(Number.isFinite(excludedBefore)).toBe(true);
    const expectedRowsBefore = releaseRows("expected").length;
    const totalRowsBefore = RELEASE_GROUP_KEYS.map((key) => releaseRows(key).length).reduce(
      (sum, count) => sum + count,
      0,
    );

    fireEvent.click(screen.getByRole("button", { name: "flag far-future release" }));

    // The new release is real reducer state now (an extra BedRelease, expected, expectedAt =
    // EVENING_SHIFT_END_MINUTES + 100), so the excluded count must move by exactly one — the half
    // of the spec's promise the earlier excluded-count test cannot exercise on its own.
    const excluded = screen.getByTestId("ward-discharge-excluded");
    expect(within(excluded).getByText(new RegExp(`^${excludedBefore + 1} expected in 2\\+ days$`))).toHaveTextContent(
      new RegExp(`^${excludedBefore + 1}\\b`),
    );
    expect(excluded.textContent?.toLowerCase()).not.toContain("none");

    // Being counted and being listed are different things (D5): the new release is `expected`,
    // so a leak would land it in the Expected group specifically. That group's row count must
    // stay at its pre-flag figure, not grow by one.
    expect(releaseRows("expected")).toHaveLength(expectedRowsBefore);

    // Belt and braces: total data rows across every group must stay exactly where it was even
    // though the reducer now holds one more bed release — the new one is declared (via the count
    // above) but never listed.
    const totalDataRows = RELEASE_GROUP_KEYS.map((key) => releaseRows(key).length).reduce(
      (sum, count) => sum + count,
      0,
    );
    expect(totalDataRows).toBe(totalRowsBefore);
  });

  /**
   * ⚠️ **HARNESS FOR THE TWO TESTS BELOW.** They need `now` to move while the FIXTURE STAYS PUT,
   * and on this line that is `ADVANCE_CLOCK` rather than a second render: the reducer adds to
   * `state.clockOffsetMinutes` without reseeding, and the provider computes
   * `now = NOW_ANCHOR + anchorOffsetMinutes + elapsed + state.clockOffsetMinutes`.
   *
   * ⚠️ The role is `demo`, and it is not interchangeable: the reducer refuses this event from any
   * other role with "ADVANCE_CLOCK requires role demo". Moving the clock is a demonstration
   * control, not a clinical act, so no ward or coordinator role may do it.
   */
  function ClockAdvancer({ minutes }: { minutes: number }) {
    const { dispatch, now } = useWardFlow();
    return (
      <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes })}>
        advance the clock
      </button>
    );
  }

  /**
   * Added 25 September 2026, for the test below. The real derived seed's only confirmed-and-
   * unblocked release (`sjgs-adult-open`, `confirmedHoursAgo: 8`) already sits in the "now" band
   * at `NOW_ANCHOR` — its `expectedAt` is in the past — so it never crosses from "By midday" into
   * "Now" and cannot exercise that transition on its own. This harness constructs a genuine SECOND
   * confirmed release through the two real reducer events a ward actually uses — `FLAG_BED_RELEASE`
   * (which always creates an `"expected"` release) followed by `CONFIRM_BED_RELEASE` (the only
   * legal `expected -> confirmed` transition) — on a real occupied admission with no live release
   * yet, exactly the same "pick a real occupant" discipline `FarFutureReleaseFlagger` above already
   * uses. `expectedAt` is `now + 45`, chosen the same way WR-001 (`NOW_ANCHOR + 45`) used to be
   * hand-authored, so it lands inside the by-midday window at the moment it is flagged.
   */
  function ConfirmedByMiddayFlagger() {
    const { dispatch, admissions, bedReleases, now } = useWardFlow();
    const occupant = admissions.find(
      (a) =>
        a.unitId === "rph-adult-secure" &&
        a.state === "occupied" &&
        !bedReleases.some((r) => r.admissionId === a.id && r.state !== "discharged"),
    );
    // Remembered at flag time: once flagged, that person has a live release and `occupant` above
    // moves on to somebody else, so the confirm step must not look them up again.
    const [flaggedFor, setFlaggedFor] = useState<string | null>(null);
    const flagged = bedReleases.find((r) => r.admissionId === flaggedFor && r.state === "expected");
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setFlaggedFor(occupant?.id ?? null);
            dispatch({
              type: "FLAG_BED_RELEASE",
              role: "ward",
              now,
              unitId: "rph-adult-secure",
              actingUnitId: "rph-adult-secure",
              admissionId: occupant?.id ?? "",
              waitingOn: "Nothing outstanding",
              expectedAt: now + 45,
            });
          }}
        >
          flag confirmable release
        </button>
        <button
          type="button"
          onClick={() =>
            flagged &&
            dispatch({
              type: "CONFIRM_BED_RELEASE",
              role: "ward",
              now,
              releaseId: flagged.id,
              actingUnitId: "rph-adult-secure",
            })
          }
        >
          confirm flagged release
        </button>
      </>
    );
  }

  /**
   * Both tests below exist because of #YTR84P. `WardFlowProvider`'s `initialNow` prop once
   * discarded its value — the render body forced `elapsed = 0` when pinned, so a pinned provider
   * always served `NOW_ANCHOR` (642, 10:42) whatever instant it was handed. The provider now
   * serves the instant it is given, and these are the first tests that spend that: each drives one
   * of `releaseBand`'s two `now`-dependent branches (`ward-bed-availability.ts`) through a real
   * rendered screen rather than by calling the pure function directly, which is what
   * `tests/ward-bed-availability.test.ts` already does. That is a defect no other DOM suite can
   * see, since every one of them pins `NOW_ANCHOR` and never moves it.
   *
   * ⚠️ **THE MECHANISM CHANGED ON THIS LINE, AND THE REASON IS A DESIGN DIFFERENCE RATHER THAN A
   * DEFECT ON EITHER SIDE.** As written on `main` these tests moved `now` by rendering a SECOND
   * provider at a later `initialNow`. Here, `initialNow` also moves the demo day: the provider
   * derives `anchorOffsetMinutes = initialNow - NOW_ANCHOR` and seeds with
   * `seedWardFlowStateAt(offset)`, so **fixture and clock travel together**, every release stays
   * the same distance in the future, and the band never changes. That is deliberate — it keeps the
   * demo day coherent at any pinned instant — and it is the later decision, so it stands.
   *
   * `ADVANCE_CLOCK` is this line's equivalent of "move `now` past the fixture": it moves the clock
   * WITHOUT reseeding, which is exactly the axis these tests need. ⚠️ **The property that matters
   * is unchanged — both branches are still driven THROUGH A RENDERED SCREEN, never by calling
   * `releaseBand` directly. A translation that ended up testing the pure function would have lost
   * the thing these tests are for.**
   *
   * ⚠️ **They also use this line's GROUP NAMES.** `main` says `released-today` and `predicted`;
   * here they are `discharged-today` and `expected`. The first is not cosmetic: "released" was
   * renamed on 2026-08-30 because it reads as release from detention.
   */
  it("moves a confirmed release from By midday to Now once the clock passes its expected instant", () => {
    // CHANGED 25 September 2026: WR-001/WR-004, the fixture's only confirmed-and-unblocked
    // releases sitting in the by-midday band at NOW_ANCHOR, no longer exist. The real derived
    // seed's one confirmed-and-unblocked release already sits in the "now" band and never crosses
    // into it, so `ConfirmedByMiddayFlagger` (above) constructs a genuine second one through the
    // two real reducer events a ward actually uses — not a fixture row, and not a fabricated DOM
    // state — so the property this test exists for (the SAME release recomputes its band live as
    // the clock passes it) is still proven through a rendered screen.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
        <ConfirmedByMiddayFlagger />
        <ClockAdvancer minutes={700 - NOW_ANCHOR} />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "flag confirmable release" }));
    fireEvent.click(screen.getByRole("button", { name: "confirm flagged release" }));

    // The harness adds exactly one confirmed-and-unblocked release on top of however many the
    // live seed already carries — computed rather than hard-coded, so a future seed change that
    // adds or removes its own confirmed releases cannot silently make this a coincidence.
    const expectedConfirmedCount = groupDischarges(seededBedReleases, NOW_ANCHOR).confirmed.length + 1;
    expect(timingColumn("confirmed")).toHaveLength(expectedConfirmedCount);

    const wardName = unitDisplayName("rph-adult-secure");
    const headers = tableHeaders(releaseWorklist());
    assertRowsMatchHeaders(headers, releaseRows("confirmed"), ["Timing"]);
    const timingIndex = columnIndex(headers, "Timing");
    const row = () => releaseRowForWard("confirmed", wardName);

    expect(within(row()).getAllByRole("cell")[timingIndex]).toHaveTextContent(/^By midday/);

    // 11:40 — past the flagged instant, still the same operating day, still before midday. The
    // ONLY thing that differs is the clock: same release, same mount.
    fireEvent.click(screen.getByRole("button", { name: "advance the clock" }));

    expect(within(row()).getAllByRole("cell")[timingIndex]).toHaveTextContent(/^Now/);
  });

  it("drops a discharged row from the last-24-hours group once it is more than 24 hours old", () => {
    // `releaseBand`'s other `now`-dependent branch: the real seed's five actually-departed
    // admissions (`AD-LEFT-01`..`AD-LEFT-05`, ward-admissions-seed.ts) leave the discharged group
    // once their departure is more than 24 hours old.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard />
        <ClockAdvancer minutes={MINUTES_PER_DAY} />
      </WardFlowProvider>,
    );

    // CHANGED 25 September 2026: WR-008 (the fixture's one hand-written discharge) no longer
    // exists. `AD-LEFT-05` left 2600 minutes before NOW_ANCHOR — already more than 24 hours ago —
    // so it is already excluded from this group even before the clock moves; the other four
    // departures left within the last 24 hours and are the rows this test moves. Baseline counts
    // are computed from the live seed (`groupDischarges`) rather than assumed, because the exact
    // split is a fact about `ward-admissions-seed.ts`'s departure list, not something to hard-code
    // here and risk drifting from silently.
    const before = groupDischarges(seededBedReleases, NOW_ANCHOR);
    const dischargedBefore = before["discharged-today"].length;
    expect(dischargedBefore, "no discharged-today row exists in the live seed to exercise this drop").toBeGreaterThan(
      0,
    );

    // ⚠️ ASSERTED BEFORE THE CLOCK MOVES, so "the group is empty afterwards" cannot pass because it
    // was empty all along — the row has to be there first for its disappearance to mean anything.
    expect(releaseRows("discharged-today")).toHaveLength(dischargedBefore);

    fireEvent.click(screen.getByRole("button", { name: "advance the clock" }));

    // The grouped table keeps an honest empty group row rather than removing the group.
    expect(releaseRows("discharged-today")).toHaveLength(0);
    expect(within(releaseGroup("discharged-today")).getByText("None")).toBeInTheDocument();

    /*
     * Dropped from the group is not the same as dropped from the board: every discharge that ages
     * out must still be declared at the foot, which is the half a "the group is empty" assertion
     * cannot reach.
     *
     * ⚠️ **IT IS DECLARED IN ITS OWN WORDS.** A completed discharge is never "expected beyond
     * tonight" — it already happened — so it is counted separately from `excludedBeyondToday`
     * rather than folded into that footer's older, wrong phrasing.
     *
     * ⚠️ **CHANGED 25 September 2026: "8 listed, unchanged" is no longer true of this seed.**
     * Advancing the clock by exactly one whole day shifts EVERY release's day-boundary comparison
     * by one day, not only the discharged ones — a release that was "2+ days out" (excluded) can
     * become "tomorrow" (listed), and one that was "tomorrow" can become "today". The real derived
     * seed has plenty of releases 2+ days out (see the excluded-count tests above), so "the other
     * releases are untouched" is false of it, and pinning the old total (8) would silently stop
     * checking anything real. The independently computed grouping, evaluated at the ADVANCED
     * clock, is the honest replacement — the same `groupDischarges` the board itself calls,
     * applied to the same exported `bedReleases`, at the `now` this render has just moved to.
     */
    const after = groupDischarges(seededBedReleases, NOW_ANCHOR + MINUTES_PER_DAY);
    expect(after["discharged-today"]).toHaveLength(0);

    const completed = screen.getByTestId("ward-discharge-completed-before-today");
    expectSays(completed, "the completed-before-today count", ["24h+ ago", "more than 24 hours ago"]);
    // The COUNT stays pinned to what the derivation actually produces, because a figure is data and
    // a rewording cannot change it — but the figure itself is computed, not typed in: every
    // departed admission has now aged past 24 hours under the same one-day shift.
    expect(completed.textContent?.toLowerCase()).toContain(`${after.completedBeforeToday} discharge`);

    const excludedAfter = screen.getByTestId("ward-discharge-excluded");
    expect(excludedAfter).toHaveTextContent(`${after.excludedBeyondToday} expected in 2+ days`);
    expect(excludedAfter.textContent?.toLowerCase()).not.toContain("none");

    const listedAfter = (["blocked", "confirmed", "expected"] as const)
      .map((key) => releaseRows(key).length)
      .reduce((sum, count) => sum + count, 0);
    const expectedListedAfter = after.blocked.length + after.confirmed.length + after.expected.length;
    expect(listedAfter).toBe(expectedListedAfter);
  });
});

describe("a Tasks link to one discharged stay", () => {
  it("opens that stay's detail, with its carer, PSP and MHAS checklist", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard initialAdmissionId="AD-LEFT-01" />
      </WardFlowProvider>,
    );
    const checklist = screen.getByTestId("ward-support-notifications");
    expect(within(checklist).getByText(/Discharge · Advisory/)).toBeInTheDocument();
  });

  it("opens nothing for an id that names no stay", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <DischargeBoard initialAdmissionId="AD-NOPE" />
      </WardFlowProvider>,
    );
    expect(screen.queryByTestId("ward-support-notifications")).not.toBeInTheDocument();
  });
});
