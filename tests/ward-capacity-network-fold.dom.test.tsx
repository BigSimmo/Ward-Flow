import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import {
  groupNetworkWardRowsByService,
  networkWardRows,
} from "@/components/ward-management/capacity/capacity-derivations";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { wardServiceOrder } from "@/components/ward-management/ward-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { bedReleases, leaveBeds } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits, siteByCode } from "@/components/ward-management/ward-sites";

/**
 * Task 2, Part Two — the network table folded by health service.
 *
 * 🔴 **THIS FILE ONCE BUILT ITS EXPECTED TOTALS BY CALLING `networkServiceGroupTotals`, THE SAME
 * FUNCTION THE SUMMARY ROW CALLS — AND ITS OWN HEADER COMMENT DESCRIBED THAT AS THE POINT.** Both
 * sides moved together, so a bug inside that function could not be seen from here: a swapped
 * field, a wrong reducer, a double-count, or a read of the whole network's total instead of the
 * group's would each have been asserted as correct. It mattered more than the general shape of the
 * mistake suggests, because that function was the newest, least-proven code on this screen.
 *
 * **The totals are now summed a second, independent way — from the per-ward cells the component
 * actually rendered** — and the two paths must agree. See the test that carries them.
 *
 * ⚠️ **What still legitimately comes from production code, and why it is not the same fault.**
 * `networkWardRows` and `groupNetworkWardRowsByService` decide *which services exist and which
 * wards belong to them* — the iteration, not the arithmetic. That partition is independently
 * checked in the first describe block below against `siteByCode`, the same lookup the bed map
 * uses, so a mis-grouping cannot hide behind it either.
 *
 * The screen's arguments are `bedReleases` AND `wardAdmissions` AND `leaveBeds`, exactly as
 * `ward-capacity-screen.dom.test.tsx` insists on for `bedReleases` alone. Omitting `wardAdmissions`
 * here first made every group's Specialling total read "Not tracked here" while the live screen
 * (which always has a real admissions list from `useWardFlow()`) rendered a real figure.
 */
const NOW = NOW_ANCHOR;
const units = allUnits();
const networkRows = networkWardRows(units, NOW, bedReleases, wardAdmissions, leaveBeds);
const groups = groupNetworkWardRowsByService(networkRows);
/**
 * The one service with no ward in the live fixture. Perth Children's moved under CAHS (owner ruling
 * 2026-09-25), and it has an emergency department and no adult mental health ward, so CAHS renders
 * the empty-service sentence on the live screen. Every totals test below walks the populated
 * services; the first test pins that CAHS is the only empty one.
 */
const EMPTY_SERVICE = "CAHS";
const populatedGroups = groups.filter((group) => group.wards.length > 0);

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
    </WardFlowProvider>,
  );
}

function slugOf(service: string): string {
  return service.replace(/\s+/gu, "-");
}

function groupHeaderRow(service: string): HTMLElement {
  const table = screen.getByTestId("ward-capacity-network-table");
  const header = within(table).getByTestId(`ward-capacity-network-group-${slugOf(service)}`);
  const row = header.querySelector("tr");
  expect(row, `no header row rendered for ${service}`).not.toBeNull();
  return row as HTMLElement;
}

function foldButton(service: string): HTMLElement {
  const row = groupHeaderRow(service);
  const button = within(row).getByRole("button");
  return button;
}

/*
 * ─── Reading the rendered table back, so a total can be checked against a second path ───────────
 *
 * Everything below parses what the browser was given. Nothing here imports a derivation, and
 * nothing formats — the comparisons downstream are between NUMBERS, because asserting
 * `cell.textContent === countCellText(total)` would put the production formatter back on both
 * sides of the equation by the back door, which is the same fault one layer down.
 */

const NOT_TRACKED = "Not tracked here";

/** A per-ward cell's own value, without its footnotes. */
function ownText(cell: Element): string {
  // ⚠️ `Ready` can carry a "N still being made ready" annotation and the sex-mix cell a mid-update
  // caution, each in a `<small>`. Both hold a second number; a bare `textContent` would read one
  // of them as the cell's value and the sum would still look plausible.
  const clone = cell.cloneNode(true) as HTMLElement;
  for (const small of Array.from(clone.querySelectorAll("small"))) small.remove();
  return (clone.textContent ?? "").replace(/\s+/gu, " ").trim();
}

/**
 * A count column, read as a coordinator reads it: the word means nought, a numeral means itself.
 * Anything else is a rendering fault and is refused rather than coerced — `Number("")` is 0, and a
 * blank cell silently summing as nought is exactly how a missing column passes a totals test.
 */
function readCount(cell: Element, where: string): number {
  const text = ownText(cell);
  if (text === "none") return 0;
  expect(/^\d+$/u.test(text), `${where} rendered "${text}" — neither a numeral nor "none"`).toBe(true);
  return Number(text);
}

/** A column that can also say nobody reported. An absence is not a nought and never sums as one. */
function readTracked(cell: Element, where: string): number | undefined {
  return ownText(cell) === NOT_TRACKED ? undefined : readCount(cell, where);
}

/** The group's own ward rows. They stay mounted while the fold is shut — visibility is by class. */
function foldBody(service: string): HTMLElement {
  const button = foldButton(service);
  const body = document.getElementById(button.getAttribute("aria-controls") as string);
  expect(body, `${service}'s fold body is not in the document`).not.toBeNull();
  return body as HTMLElement;
}

function wardCells(service: string, selector: string): HTMLElement[] {
  return Array.from(foldBody(service).querySelectorAll<HTMLElement>(selector));
}

function readSexMix(cell: Element, where: string): { Female: number; Male: number } {
  const text = ownText(cell);
  const match = /^Female (\d+) · Male (\d+)$/u.exec(text);
  expect(match, `${where} rendered "${text}" — not "Female N · Male M"`).not.toBeNull();
  return { Female: Number(match![1]), Male: Number(match![2]) };
}

function readSpecialling(cell: Element, where: string): { free: number; staffable: number } | undefined {
  const text = ownText(cell);
  if (text === NOT_TRACKED) return undefined;
  const match = /^(\d+) of (\d+)$/u.exec(text);
  expect(match, `${where} rendered "${text}" — not "N of M" and not "${NOT_TRACKED}"`).not.toBeNull();
  return { free: Number(match![1]), staffable: Number(match![2]) };
}

/**
 * The tracked-sum contract, restated by hand over rendered values: an absence is skipped, and the
 * total is itself an absence only when every ward was silent. This is deliberately a second
 * implementation of the rule rather than a call to `trackedSum` — a shared helper here would put
 * one function on both sides of the comparison again.
 */
function sumTracked(values: (number | undefined)[]): number | undefined {
  const tracked = values.filter((value): value is number => value !== undefined);
  return tracked.length === 0 ? undefined : tracked.reduce((total, value) => total + value, 0);
}

describe("the Capacity network table walks every health service, or the suite below is vacuous", () => {
  it("has all six services, every one but CAHS with real wards in the live fixture, summing to the whole board", () => {
    expect(groups.length, "groupNetworkWardRowsByService did not return one entry per wardServiceOrder").toBe(
      wardServiceOrder.length,
    );
    expect(groups.map((group) => group.service)).toEqual([...wardServiceOrder]);

    expect(
      groups.filter((group) => group.wards.length === 0).map((group) => group.service),
      "a service other than CAHS has no wards in the live fixture, or CAHS gained one",
    ).toEqual([EMPTY_SERVICE]);
    expect(
      populatedGroups.length,
      "no service has any wards in the live fixture — every totals assertion below would be vacuous",
    ).toBe(groups.length - 1);

    const totalWards = groups.reduce((sum, group) => sum + group.wards.length, 0);
    expect(totalWards, "the groups do not partition every network row exactly once").toBe(networkRows.length);
  });

  it("never assigns two wards from the same service to different groups, or the same ward to two groups", () => {
    // Anti-vacuity for the partition itself: every unit resolves through the same siteByCode lookup
    // groupBedMapWardsByService uses, so a ward can never sit in a different service on this table
    // than it does on the bed map above it.
    for (const group of groups) {
      for (const row of group.wards) {
        const site = siteByCode(row.unit.siteCode);
        expect(site, `${row.unit.id} has no resolvable site`).not.toBeUndefined();
        expect(site?.service, `${row.unit.id} landed in the "${group.service}" group`).toBe(group.service);
      }
    }
    const seen = new Set<string>();
    for (const group of groups) {
      for (const row of group.wards) {
        expect(seen.has(row.unit.id), `${row.unit.id} appears in more than one service group`).toBe(false);
        seen.add(row.unit.id);
      }
    }
  });
});

describe("a folded group's summary row states its own totals, never the network's", () => {
  it("renders a fold button per service, open by default, naming the ward count in words", () => {
    renderScreen();
    // The empty service states a sentence and has no fold button, on the live data as well as in
    // ward-capacity-network-fold-empty-service.dom.test.tsx.
    const table = screen.getByTestId("ward-capacity-network-table");
    const emptyGroup = within(table).getByTestId(`ward-capacity-network-group-${slugOf(EMPTY_SERVICE)}`);
    expect(emptyGroup).toHaveTextContent(`${EMPTY_SERVICE} has no inpatient unit reporting to this board.`);
    expect(within(emptyGroup).queryByRole("button")).not.toBeInTheDocument();
    for (const group of populatedGroups) {
      const button = foldButton(group.service);
      expect(button, `${group.service} has no fold button`).toHaveAttribute("aria-expanded", "true");
      const bodyId = button.getAttribute("aria-controls");
      expect(bodyId, `${group.service}'s fold button has no aria-controls`).toBeTruthy();
      // ⚠️ Present in the DOM whether open or shut — visibility is by CSS class, never by
      // unmounting, so aria-controls must resolve to a real element even while folded.
      expect(
        document.getElementById(bodyId as string),
        `${group.service}'s aria-controls="${bodyId}" resolves to nothing while folded`,
      ).not.toBeNull();

      const row = groupHeaderRow(group.service);
      const expectedCount = group.wards.length === 1 ? "1 ward" : `${group.wards.length} wards`;
      expect(row, `${group.service}'s header row does not state its own ward count`).toHaveTextContent(expectedCount);
    }
  });

  /**
   * ⚠️ **THE ASSERTION THIS WHOLE FILE IS FOR, AND THE ONE THAT USED TO PROVE NOTHING.**
   *
   * Every expected figure below is summed from the group's OWN ward cells as rendered — a second
   * path that shares no code with `networkServiceGroupTotals`. For the summary to pass, the
   * production derivation and this hand-written sum over the DOM must agree, and no single mistake
   * can move both.
   *
   * Floored three ways, because a totals test is the easiest kind to satisfy vacuously:
   *   1. every group renders at least one ward row (otherwise every sum is 0 === 0);
   *   2. at least one column somewhere carries a non-zero total;
   *   3. at least one group's Ready differs from the whole network's — without which a mutant
   *      reading the network figure on every group would still pass.
   */
  it("agrees, column by column, with an independent sum of its own wards' rendered cells", () => {
    renderScreen();

    let sawANonZeroTotal = false;
    let sawAFullyTrackedSpecialling = false;
    const readyByGroup: number[] = [];

    for (const group of populatedGroups) {
      const service = group.service;
      const wardRows = wardCells(service, '[data-testid^="ward-capacity-network-row-"]');
      expect(
        wardRows.length,
        `${service}'s fold renders no ward rows — every total asserted for it would be vacuous`,
      ).toBeGreaterThan(0);

      const row = groupHeaderRow(service);
      const cells = within(row).getAllByRole("cell");
      // Column order: the ward header is a <th scope="row">, which has role "rowheader", not
      // "cell" — so these start at Bed kinds.
      const [
        bedKinds,
        ready,
        locked,
        freeing,
        confirmed,
        expected,
        blocked,
        dischargesDueToday,
        transfersToday,
        pulled,
        closed,
        occupied,
        sexMix,
        specialling,
        mha,
        freshness,
        ask,
      ] = cells;

      // The ward count states the rows actually beneath it, not a number computed alongside them.
      expect(row, `${service}'s header row does not state its own ward count`).toHaveTextContent(
        wardRows.length === 1 ? "1 ward" : `${wardRows.length} wards`,
      );

      // Three cells state in words that nothing sums here. They are facts or timestamps, not
      // quantities, and a number in any of them would be meaningless arithmetic.
      expect(ownText(bedKinds), `${service}'s bed-kinds cell should say nothing sums here`).toMatch(
        /^(?:By ward|Vary by ward)$/iu,
      );
      expect(ownText(freshness), `${service}'s freshness cell must direct readers to individual wards`).toBe("By ward");
      expect(ownText(ask), `${service}'s summary row offers an action no reducer implements`).toBe("");

      const sumOf = (selector: string, label: string): number =>
        wardCells(service, selector).reduce(
          (total, cell) => total + readCount(cell, `${service} — a ward's ${label}`),
          0,
        );

      const trackedSumOf = (selector: string, label: string): number | undefined =>
        sumTracked(wardCells(service, selector).map((cell) => readTracked(cell, `${service} — a ward's ${label}`)));

      const expectedReady = sumOf('[data-testid="ward-capacity-network-ready"]', "Ready");
      const expectedLocked = sumOf('[data-testid="ward-capacity-network-locked"]', "Locked");
      const expectedPulled = sumOf('[data-testid="ward-capacity-network-pulled"]', "Pulled");
      const expectedClosed = sumOf('[data-testid="ward-capacity-network-closed"]', "Closed");
      const expectedOccupied = sumOf('[data-testid="ward-capacity-network-occupied"]', "Occupied");
      const expectedFreeing = trackedSumOf('[data-testid="ward-capacity-network-freeing"]', "Freeing");
      const expectedConfirmed = trackedSumOf('[data-testid="ward-capacity-network-confirmed"]', "Confirmed");
      const expectedExpected = trackedSumOf('[data-testid="ward-capacity-network-expected"]', "Expected");
      const expectedBlocked = trackedSumOf('[data-testid="ward-capacity-network-blocked"]', "Blocked");

      expect(readCount(ready, `${service}'s Ready total`), `${service}'s Ready total`).toBe(expectedReady);
      expect(readCount(locked, `${service}'s Locked total`), `${service}'s Locked total`).toBe(expectedLocked);
      expect(readCount(pulled, `${service}'s Pulled total`), `${service}'s Pulled total`).toBe(expectedPulled);
      expect(readCount(closed, `${service}'s Closed total`), `${service}'s Closed total`).toBe(expectedClosed);
      expect(readCount(occupied, `${service}'s Occupied total`), `${service}'s Occupied total`).toBe(expectedOccupied);
      expect(readTracked(freeing, `${service}'s Freeing total`), `${service}'s Freeing total`).toBe(expectedFreeing);
      expect(readTracked(confirmed, `${service}'s Confirmed total`), `${service}'s Confirmed total`).toBe(
        expectedConfirmed,
      );
      expect(readTracked(expected, `${service}'s Expected total`), `${service}'s Expected total`).toBe(
        expectedExpected,
      );
      expect(readTracked(blocked, `${service}'s Blocked total`), `${service}'s Blocked total`).toBe(expectedBlocked);
      // Bed board decision 8A (26 Sept 2026): discharges due today sums like the other figures;
      // transfers today has no recorded source, so the total says so, as each ward's cell does.
      const expectedDischargesDueToday = trackedSumOf(
        '[data-testid="ward-capacity-network-discharges-due-today"]',
        "Discharges due today",
      );
      expect(
        readTracked(dischargesDueToday, `${service}'s Discharges due today total`),
        `${service}'s Discharges due today total`,
      ).toBe(expectedDischargesDueToday);
      expect(ownText(transfersToday), `${service}'s Transfers today total`).toBe("Not recorded");

      const wardSexMix = wardCells(service, '[data-testid^="ward-capacity-sexmix-"]').map((cell) =>
        readSexMix(cell, `${service} — a ward's sex mix`),
      );
      expect(wardSexMix.length, `${service}'s sex-mix cells do not match its ward rows`).toBe(wardRows.length);
      expect(readSexMix(sexMix, `${service}'s sex-mix total`)).toEqual({
        Female: wardSexMix.reduce((total, ward) => total + ward.Female, 0),
        Male: wardSexMix.reduce((total, ward) => total + ward.Male, 0),
      });

      const wardSpecialling = wardCells(service, '[data-testid^="ward-capacity-specialling-"]').map((cell) =>
        readSpecialling(cell, `${service} — a ward's specialling`),
      );
      const trackedSpecialling = wardSpecialling.filter(
        (entry): entry is { free: number; staffable: number } => entry !== undefined,
      );
      const summarySpecialling = readSpecialling(specialling, `${service}'s specialling total`);
      if (trackedSpecialling.length === 0) {
        expect(summarySpecialling, `${service} has no ward reporting specialling, so its total cannot`).toBeUndefined();
      } else {
        expect(summarySpecialling?.free, `${service}'s free-specialling total`).toBe(
          trackedSpecialling.reduce((total, ward) => total + ward.free, 0),
        );
        // ⚠️ The staffable half is only independently derivable when EVERY ward reported, because an
        // untracked ward renders "Not tracked here" and its staffable figure never reaches the DOM —
        // while the production total still counts it. Asserting a sum over the visible subset would
        // be asserting a number the screen never claimed. Checked where it can be, floored below so
        // the case cannot quietly stop occurring.
        if (trackedSpecialling.length === wardSpecialling.length) {
          sawAFullyTrackedSpecialling = true;
          expect(summarySpecialling?.staffable, `${service}'s staffable-specialling total`).toBe(
            trackedSpecialling.reduce((total, ward) => total + ward.staffable, 0),
          );
        }
      }

      const authorisedCells = wardCells(service, '[data-testid^="ward-capacity-authorised-"]');
      expect(authorisedCells.length, `${service}'s MHA cells do not match its ward rows`).toBe(wardRows.length);
      for (const cell of authorisedCells) {
        expect(["Yes", "No"], `${service} has a ward whose MHA cell reads "${ownText(cell)}"`).toContain(ownText(cell));
      }
      const authorised = authorisedCells.filter((cell) => ownText(cell) === "Yes").length;
      expect(ownText(mha), `${service}'s MHA total`).toBe(`${authorised} of ${wardRows.length} involuntary-capable`);

      readyByGroup.push(expectedReady);
      if (expectedReady > 0 || expectedOccupied > 0 || (expectedFreeing !== undefined && expectedFreeing > 0)) {
        sawANonZeroTotal = true;
      }
    }

    // Floor 2 — without a single non-zero figure anywhere, every comparison above is 0 === 0 and a
    // derivation returning zeroes for everything would pass the whole test.
    expect(
      sawANonZeroTotal,
      "every group totalled nought in every column — this suite cannot tell a real sum from a stub",
    ).toBe(true);

    // Floor 3 — every group holds fewer than all the board's wards, so at least one group's Ready
    // must differ from the network's. Without this, a mutant reading the whole network's figure on
    // every group would satisfy every assertion above. The network figure is itself summed from the
    // DOM here, so this floor shares no code with the derivation either.
    const networkReady = readyByGroup.reduce((total, value) => total + value, 0);
    expect(
      readyByGroup.some((value) => value !== networkReady),
      "every group's Ready total equals the whole network's — this suite cannot tell a correct " +
        "group sum from one that reads the network total instead",
    ).toBe(true);

    // Floor on the specialling exception above: if no group is ever fully tracked, the staffable
    // half of that column is asserted nowhere and the branch has quietly stopped being covered.
    expect(
      sawAFullyTrackedSpecialling,
      "no service had every ward reporting specialling, so the staffable total was never checked",
    ).toBe(true);
  });
});

describe("expanding a service reveals exactly its own rows, and no others", () => {
  it("puts only that service's own wards inside the fold it controls", () => {
    renderScreen();
    for (const group of populatedGroups) {
      const button = foldButton(group.service);
      const bodyId = button.getAttribute("aria-controls") as string;
      const body = document.getElementById(bodyId) as HTMLElement;

      const otherUnitIds = networkRows
        .filter((row) => !group.wards.some((owned) => owned.unit.id === row.unit.id))
        .map((row) => row.unit.id);

      for (const row of group.wards) {
        expect(
          within(body).queryByTestId(`ward-capacity-network-row-${row.unit.id}`),
          `${group.service}'s fold is missing its own ward ${row.unit.id}`,
        ).toBeInTheDocument();
      }
      for (const unitId of otherUnitIds) {
        expect(
          within(body).queryByTestId(`ward-capacity-network-row-${unitId}`),
          `${group.service}'s fold contains ${unitId}, which belongs to a different service`,
        ).not.toBeInTheDocument();
      }
    }
  });

  it("toggles aria-expanded on click, independently per service", () => {
    renderScreen();
    const [first, second] = groups.filter((group) => group.wards.length > 0);
    expect(first, "need at least two populated services for this test to prove independence").toBeDefined();
    expect(second, "need at least two populated services for this test to prove independence").toBeDefined();

    const firstButton = foldButton(first!.service);
    const secondButton = foldButton(second!.service);

    fireEvent.click(firstButton);
    expect(firstButton).toHaveAttribute("aria-expanded", "false");
    expect(secondButton, "closing one service also closed another").toHaveAttribute("aria-expanded", "true");

    fireEvent.click(firstButton);
    expect(firstButton).toHaveAttribute("aria-expanded", "true");
  });

  it("operates on both Enter and Space, like any native button", async () => {
    renderScreen();
    const [group] = groups.filter((entry) => entry.wards.length > 0);
    const user = userEvent.setup();
    const button = foldButton(group!.service);

    button.focus();
    await user.keyboard("{Enter}");
    expect(button).toHaveAttribute("aria-expanded", "false");

    await user.keyboard(" ");
    expect(button).toHaveAttribute("aria-expanded", "true");
  });
});

// ⚠️ The "a service with no reporting unit" case needs `useWardFlow` mocked, and `vi.mock` is
// hoisted to the top of the FILE by Vitest regardless of where it is written — so it would apply
// to every test above this line too, silently replacing the real `WardFlowProvider` state they
// depend on. That case lives in its own file
// (`ward-capacity-network-fold-empty-service.dom.test.tsx`) for exactly the reason
// `ward-capacity-freshness-source.dom.test.tsx` is its own file rather than a describe block
// bolted onto `ward-capacity-screen.dom.test.tsx`.
