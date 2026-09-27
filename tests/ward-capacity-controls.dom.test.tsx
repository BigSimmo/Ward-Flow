import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import {
  groupNetworkWardRowsByService,
  networkWardRows,
} from "@/components/ward-management/capacity/capacity-derivations";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { bedReleases, leaveBeds } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

/**
 * WF-27 — the Wards panel's own controls: the sort box that orders rows inside each health-service
 * fold (`wardSort`, ~capacity-screen.tsx:175-183), the highlight-chip group that marks rows but
 * never removes them (`networkFilters`, ~126-132 / the panel at ~457-466), the "Highlight wards"
 * attention shortcut (~415-424), and ward selection's tie to the demo reset count (~69-96). None of
 * these had a test before this file.
 *
 * Harness copied from `ward-capacity-screen.dom.test.tsx` / `ward-capacity-network-fold.dom.test.tsx`
 * — the real `WardFlowProvider` with a pinned `initialNow`, never a mock. The fold helpers
 * (`foldButton`, `foldBody`, `slugOf`) are copied from `ward-capacity-network-fold.dom.test.tsx` for
 * the same reason that file gives them: the fold body stays mounted and only gains a CSS class when
 * shut, so a test reading it back must resolve the SAME element the summary row's `aria-controls`
 * names, not assume visibility.
 *
 * ⚠️ **EXPECTATIONS ARE READ OFF THE RENDERED ROWS, NEVER RE-SORTED OR RE-FILTERED IN THE TEST.**
 * The sort tests walk adjacent DOM rows and check the comparator's own property pairwise; the chip
 * tests read `data-ward-network-row-matches` and the panel's own count text back from the page. A
 * test that re-implements the comparator or the predicate and compares two independently-sorted
 * arrays could agree with a swapped comparison operator in both places at once.
 *
 * ⚠️ **2026-09-17 FOLLOW-UP.** The sixth item — "a demo reset after selecting a ward clears the
 * selection, and focus lands on the network heading or the opener" — was first written here without
 * its focus half asserted: run against the screen as it stood then, `document.activeElement` was
 * `<body>` after a reset, a real gap handed back rather than silently pinned. `capacity-screen.tsx`
 * now arms the same focus-restoration effect `clearWard()` uses for this second path too (see
 * `previouslySelectedUnitId`'s own comment there), and the full assertion below is real again —
 * proven red against the unfixed screen before the fix landed, per that test's own comment.
 */
const NOW = NOW_ANCHOR;
const units = allUnits();
// Same arguments the screen itself passes to `networkWardRows` — `ward-capacity-network-fold.dom.test.tsx`
// found that omitting any one of `bedReleases`/`wardAdmissions`/`leaveBeds` makes a figure this
// file's rows read as "not tracked" here while the live screen (fed by `useWardFlow()`) has a real
// value, disagreeing with the render for a reason that has nothing to do with the control under test.
const networkRows = networkWardRows(units, NOW, bedReleases, wardAdmissions, leaveBeds);
const groups = groupNetworkWardRowsByService(networkRows);
const rowById = new Map(networkRows.map((row) => [row.unit.id, row]));

type WardFlowContext = ReturnType<typeof useWardFlow>;
let flow: WardFlowContext;
/** Task 5 needs a live `dispatch`/`now` from the SAME provider instance `CapacityScreen` reads. */
function FlowProbe() {
  const value = useWardFlow();
  useEffect(() => {
    flow = value;
  });
  return null;
}

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <FlowProbe />
      <CapacityScreen />
    </WardFlowProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

function slugOf(service: string): string {
  return service.replace(/\s+/gu, "-");
}

function foldButton(service: string): HTMLElement {
  const table = screen.getByTestId("ward-capacity-network-table");
  const header = within(table).getByTestId(`ward-capacity-network-group-${slugOf(service)}`);
  const row = header.querySelector("tr");
  expect(row, `no header row rendered for ${service}`).not.toBeNull();
  return within(row as HTMLElement).getByRole("button");
}

/** The group's own ward rows. They stay mounted while the fold is shut — visibility is by class. */
function foldBody(service: string): HTMLElement {
  const button = foldButton(service);
  const body = document.getElementById(button.getAttribute("aria-controls") as string);
  expect(body, `${service}'s fold body is not in the document`).not.toBeNull();
  return body as HTMLElement;
}

function unitIdOfRow(row: HTMLElement): string {
  const testId = row.getAttribute("data-testid") ?? "";
  expect(testId.startsWith("ward-capacity-network-row-"), `unexpected row testid "${testId}"`).toBe(true);
  return testId.replace("ward-capacity-network-row-", "");
}

function allNetworkRows(): HTMLElement[] {
  const table = screen.getByTestId("ward-capacity-network-table");
  return within(table)
    .getAllByRole("row")
    .filter((row) => (row.getAttribute("data-testid") ?? "").startsWith("ward-capacity-network-row-"));
}

function wardsPanelCount(): string {
  const panel = screen.getByRole("region", { name: "Wards" });
  const count = panel.querySelector("[data-ward-panel-count]");
  expect(count, "Wards panel has no count").not.toBeNull();
  return (count as HTMLElement).textContent ?? "";
}

function wardSelectButton(unitId: string): HTMLElement {
  const table = screen.getByTestId("ward-capacity-network-table");
  const row = within(table).getByTestId(`ward-capacity-network-row-${unitId}`);
  return within(row).getByRole("button", { name: rowById.get(unitId)!.unit.name });
}

describe("the Capacity screen's Wards controls", () => {
  it("orders wards inside each service group by 'Most ready', checked pairwise on the rendered rows", () => {
    renderScreen();
    fireEvent.change(screen.getByLabelText("Sort wards"), { target: { value: "ready" } });

    let pairsChecked = 0;
    for (const group of groups) {
      if (group.wards.length < 2) continue;
      const rendered = within(foldBody(group.service)).getAllByRole("row");
      for (let i = 0; i < rendered.length - 1; i += 1) {
        const a = rowById.get(unitIdOfRow(rendered[i]))!;
        const b = rowById.get(unitIdOfRow(rendered[i + 1]))!;
        if (a.ready === b.ready) {
          expect(
            a.unit.name.localeCompare(b.unit.name) <= 0,
            `${group.service}: ${a.unit.name} and ${b.unit.name} tie on ready (${a.ready}) but are not in name order`,
          ).toBe(true);
        } else {
          expect(
            a.ready,
            `${group.service}: "${a.unit.name}" (ready ${a.ready}) sits before "${b.unit.name}" (ready ${b.ready}) under "Most ready"`,
          ).toBeGreaterThan(b.ready);
        }
        pairsChecked += 1;
      }
    }
    expect(pairsChecked, "no service has two wards to compare — this guard proved nothing").toBeGreaterThan(0);
  });

  it("orders wards inside each service group by 'Oldest confirmation', checked pairwise on the rendered rows", () => {
    renderScreen();
    fireEvent.change(screen.getByLabelText("Sort wards"), { target: { value: "confirmation" } });

    let pairsChecked = 0;
    for (const group of groups) {
      if (group.wards.length < 2) continue;
      const rendered = within(foldBody(group.service)).getAllByRole("row");
      for (let i = 0; i < rendered.length - 1; i += 1) {
        const a = rowById.get(unitIdOfRow(rendered[i]))!;
        const b = rowById.get(unitIdOfRow(rendered[i + 1]))!;
        if (a.confirmedAt === b.confirmedAt) {
          expect(
            a.unit.name.localeCompare(b.unit.name) <= 0,
            `${group.service}: ${a.unit.name} and ${b.unit.name} tie on confirmedAt but are not in name order`,
          ).toBe(true);
        } else {
          expect(
            a.confirmedAt,
            `${group.service}: "${a.unit.name}" (confirmedAt ${a.confirmedAt}) sits before "${b.unit.name}" (confirmedAt ${b.confirmedAt}) under "Oldest confirmation"`,
          ).toBeLessThan(b.confirmedAt);
        }
        pairsChecked += 1;
      }
    }
    expect(pairsChecked, "no service has two wards to compare — this guard proved nothing").toBeGreaterThan(0);
  });

  it("keeps the chip's marked set, the panel's matching count, and the full row set consistent across sort, a folded service and a ward selection", () => {
    renderScreen();
    fireEvent.change(screen.getByLabelText("Sort wards"), { target: { value: "ready" } });
    fireEvent.click(screen.getByRole("button", { name: /^Has a bed ready/u }));

    const foldedGroup = groups.find((group) => group.wards.length > 0);
    expect(foldedGroup, "no populated service to fold — this guard proved nothing").toBeDefined();
    fireEvent.click(foldButton(foldedGroup!.service));
    expect(foldButton(foldedGroup!.service)).toHaveAttribute("aria-expanded", "false");

    const otherGroup = groups.find((group) => group.wards.length > 0 && group.service !== foldedGroup!.service);
    const selectable = otherGroup ? otherGroup.wards[0] : foldedGroup!.wards[0];
    fireEvent.click(wardSelectButton(selectable.unit.id));
    expect(screen.getByRole("heading", { level: 2, name: selectable.unit.name })).toBeInTheDocument();

    const expectedMatches = networkRows.filter((row) => row.ready > 0);
    expect(expectedMatches.length, "no ward has a ready bed — this guard proved nothing").toBeGreaterThan(0);
    expect(
      expectedMatches.length,
      "every ward has a ready bed — the marked-set assertion below would be vacuous",
    ).toBeLessThan(networkRows.length);

    const rendered = allNetworkRows();
    expect(rendered.length, "the row set changed under a chip/fold/selection combination").toBe(networkRows.length);

    const markedIds = new Set(
      rendered
        .filter((row) => row.getAttribute("data-ward-network-row-matches") === "true")
        .map((row) => unitIdOfRow(row)),
    );
    expect(markedIds).toEqual(new Set(expectedMatches.map((row) => row.unit.id)));

    expect(wardsPanelCount()).toBe(`${networkRows.length} wards in the network, ${expectedMatches.length} matching`);
  });

  it("'All' resets: no row reads 'Matches this filter' anywhere, and the panel count reads the full network as matching", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: /^Has a bed ready/u }));
    expect(
      screen.getAllByText("Matches this filter").length,
      "the 'ready' chip marked nothing — this guard proved nothing",
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /^All\b/u }));

    expect(screen.queryAllByText("Matches this filter")).toHaveLength(0);
    for (const row of allNetworkRows()) {
      expect(row).not.toHaveAttribute("data-ward-network-row-matches");
    }
    expect(wardsPanelCount()).toBe(
      `${networkRows.length} ${networkRows.length === 1 ? "ward" : "wards"} in the network, ${networkRows.length} matching`,
    );
  });

  it("'Highlight wards' presses the 'Needs confirming' chip", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("tab", { name: "Attention" }));
    const highlightButton = screen.getByRole("button", { name: /wards need confirming/u });
    const match = highlightButton.textContent?.match(/(\d+) wards need confirming/u);
    expect(match, "the Highlight wards button did not state a count").not.toBeNull();
    const statedCount = Number(match![1]);
    expect(statedCount, "no ward needs confirming — this guard proved nothing").toBeGreaterThan(0);

    expect(screen.getByRole("button", { name: /^Needs confirming/u })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(highlightButton);

    const chip = screen.getByRole("button", { name: /^Needs confirming/u });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^All\b/u })).toHaveAttribute("aria-pressed", "false");
    expect(within(chip).getByText(String(statedCount))).toBeInTheDocument();
  });

  /**
   * ⚠️ **THE FOCUS ASSERTION BELOW IS REAL, NOT ASPIRATIONAL — PROVEN RED AGAINST THE UNFIXED
   * SCREEN FIRST (2026-09-17), THEN FIXED.** `restoreNetworkFocus.current` — the ref gating the
   * focus-restoration effect right below `clearWard` in `capacity-screen.tsx` — used to be set
   * `true` in exactly one place: inside `clearWard()`, which only runs from the sidebar's own "Back
   * to network" button. `RESET_SCENARIO` clears the selection by a different route entirely: it
   * bumps `worldGeneration`, and `selectedUnitId` goes stale (`selection?.generation ===
   * worldGeneration ? selection.unitId : undefined`) without `clearWard()` ever running — so the
   * flag was never armed, the restoration effect's guard returned on its first line, and the
   * sidebar heading that held focus simply unmounted, dropping focus to `<body>` by the DOM's own
   * default behaviour. `previouslySelectedUnitId` (see its own comment in `capacity-screen.tsx`)
   * now arms the same flag for this second path too.
   *
   * ⚠️ **BOTH TARGETS ARE ACCEPTED, ON PURPOSE.** The ward-select button used as the opener here
   * lives in the Wards table, which a selection change never unmounts (only the aside toggles
   * between the sidebar and the network summary) — so in THIS fixture the restoration effect's own
   * preference order resolves to that same button, not the network heading. Asserting only the
   * heading would fail against the real, correct behaviour; asserting the disjunction matches what
   * `clearWard()` itself has always promised — the opener if it is still connected, the heading
   * otherwise — which this fix extends to the generation-change path rather than replacing.
   */
  it("a demo reset after selecting a ward clears the selection, and focus lands on the network heading or the opener", async () => {
    renderScreen();
    const user = userEvent.setup();
    const selectable = networkRows[0];
    const opener = wardSelectButton(selectable.unit.id);
    await user.click(opener);

    expect(screen.getByRole("heading", { level: 2, name: selectable.unit.name })).toHaveFocus();
    expect(screen.queryByRole("heading", { level: 2, name: "Network" })).not.toBeInTheDocument();

    expect(flow, "the useWardFlow probe never captured the live context").toBeDefined();
    act(() => {
      flow.dispatch({ type: "RESET_SCENARIO", role: "demo", now: flow.now });
    });

    expect(screen.queryByRole("heading", { level: 2, name: selectable.unit.name })).not.toBeInTheDocument();
    const networkHeading = screen.getByRole("heading", { level: 2, name: "Network" });
    expect(networkHeading).toBeInTheDocument();
    const focusLandedCorrectly =
      networkHeading === document.activeElement || (opener.isConnected && opener === document.activeElement);
    expect(
      focusLandedCorrectly,
      `neither the network heading nor the opener has focus after a demo reset; document.activeElement is ` +
        `${(document.activeElement as HTMLElement | null)?.tagName}#${(document.activeElement as HTMLElement | null)?.id}`,
    ).toBe(true);
  });

  it("highlight chips activate from the keyboard, on both Enter and Space, like any native button", async () => {
    renderScreen();
    const user = userEvent.setup();
    const readyChip = screen.getByRole("button", { name: /^Has a bed ready/u });
    const allChip = screen.getByRole("button", { name: /^All\b/u });

    expect(allChip).toHaveAttribute("aria-pressed", "true");

    readyChip.focus();
    await user.keyboard("{Enter}");
    expect(readyChip).toHaveAttribute("aria-pressed", "true");
    expect(allChip).toHaveAttribute("aria-pressed", "false");

    allChip.focus();
    await user.keyboard(" ");
    expect(allChip).toHaveAttribute("aria-pressed", "true");
    expect(readyChip).toHaveAttribute("aria-pressed", "false");
  });
});
