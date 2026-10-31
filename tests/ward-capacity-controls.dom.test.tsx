import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The Capacity bed map's own controls: the highlight chips that dim the wards that do not match but
 * never remove one (`HIGHLIGHTS` in `capacity-bed-map-cards.tsx`), the hero's ready figures that
 * press the same highlight (`highlightFromHero` in `capacity-screen.tsx`), the service groups that
 * fold, and a ward's drawer opened from its card.
 *
 * Capacity redesign (Josh, 31 Oct 2026): the network ward table, its sort box, its "All" chip and
 * the Attention tab's "Highlight wards" shortcut are gone (the redesign removed them). The two sort
 * cases were retired with the table; the chip, shortcut, selection and keyboard cases below are the
 * same subjects on the bed map that replaced it.
 *
 * Harness: the real `WardFlowProvider` with a pinned `initialNow`, never a mock.
 *
 * ⚠️ **EXPECTATIONS ARE READ OFF THE RENDERED CARDS, NEVER RE-FILTERED BY THE SCREEN'S OWN CODE.**
 * The chip tests read each card's dimmed state back from the page and compare it with the
 * predicate applied here to `networkWardRows`, called with the same arguments the screen's model
 * uses, so a swapped predicate in the screen cannot agree with itself.
 */
const NOW = NOW_ANCHOR;
const seed = seedWardFlowState();
// Same arguments `useCapacityModel` passes to `networkWardRows`.
const networkRows = networkWardRows(seed.units, NOW, seed.bedReleases, seed.admissions, seed.leaveBeds);
const idByName = new Map(networkRows.map((row) => [row.unit.name, row.unit.id]));

type WardFlowContext = ReturnType<typeof useWardFlow>;
let flow: WardFlowContext;
/** The reset case needs a live `dispatch`/`now` from the SAME provider instance `CapacityScreen` reads. */
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

/** A ward card's visible name: its text without the spelled-out code a screen reader hears. */
function visibleName(element: Element | null): string {
  if (!element) return "";
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll("abbr + span").forEach((node) => node.remove());
  return (clone.textContent ?? "").trim();
}

function bedMap(): HTMLElement {
  const map = document.getElementById("capacity-bed-map");
  expect(map, "no bed map on the Capacity screen").not.toBeNull();
  return map as HTMLElement;
}

/** Every ward card on the bed map, folded groups included (a folded group stays mounted, hidden). */
function wardCards(): HTMLElement[] {
  return Array.from(bedMap().querySelectorAll<HTMLElement>('button[aria-haspopup="dialog"]'));
}

function unitIdOfCard(card: HTMLElement): string {
  const name = visibleName(card.firstElementChild);
  const id = idByName.get(name);
  expect(id, `the bed map card "${name}" names no ward in the network`).toBeDefined();
  return id as string;
}

function cardOf(unitId: string): HTMLElement {
  const card = wardCards().find((candidate) => unitIdOfCard(candidate) === unitId);
  expect(card, `no bed map card for ${unitId}`).toBeDefined();
  return card as HTMLElement;
}

function litIds(): Set<string> {
  return new Set(
    wardCards()
      .filter((card) => !/dimmed/u.test(card.className))
      .map(unitIdOfCard),
  );
}

function highlightChip(label: string): HTMLElement {
  const group = within(screen.getByRole("group", { name: "Highlight wards" }));
  return group.getByRole("button", { name: new RegExp(`^${label} · \\d+ wards?$`, "u") });
}

describe("the Capacity screen's bed map controls", () => {
  it("has a network to render, with wards both lit and dimmed by 'Any ready', or the cases below are vacuous", () => {
    expect(networkRows.length).toBeGreaterThan(1);
    expect(idByName.size, "two wards share a name, so a card cannot be told apart").toBe(networkRows.length);
    const ready = networkRows.filter((row) => row.ready > 0).length;
    expect(ready, "no ward has a ready bed").toBeGreaterThan(0);
    expect(ready, "every ward has a ready bed").toBeLessThan(networkRows.length);
  });

  /*
   * RETIRED 31 Oct 2026 with the network ward table (Capacity redesign): "orders wards inside each
   * service group by 'Most ready'" and "... by 'Oldest confirmation'". Both pinned the table's
   * "Sort wards" box, which the redesign removed; the bed map keeps each service's own ward order.
   */

  it("keeps the highlight's lit set and the full card set consistent across a folded service and a ward selection", () => {
    renderScreen();
    fireEvent.click(highlightChip("Any ready"));
    expect(highlightChip("Any ready")).toHaveAttribute("aria-pressed", "true");

    const toggles = within(bedMap())
      .getAllByRole("button", { expanded: true })
      .filter((button) => button.hasAttribute("aria-controls"));
    expect(toggles.length, "no open service group to fold — this guard proved nothing").toBeGreaterThan(0);
    fireEvent.click(toggles[0]!);
    expect(toggles[0]).toHaveAttribute("aria-expanded", "false");

    const visibleCard = within(bedMap()).getAllByRole("button", { name: /occupied/u })[0]!;
    const selected = unitIdOfCard(visibleCard);
    fireEvent.click(visibleCard);
    expect(screen.getByTestId("ward-capacity-ward-drawer")).toHaveAccessibleName(
      networkRows.find((row) => row.unit.id === selected)!.unit.name,
    );

    const cards = wardCards();
    expect(cards.length, "the card set changed under a chip, fold and selection").toBe(networkRows.length);
    expect(litIds()).toEqual(new Set(networkRows.filter((row) => row.ready > 0).map((row) => row.unit.id)));
  });

  it("pressing the pressed chip again clears the highlight: no ward is dimmed and every ward stays", () => {
    renderScreen();
    fireEvent.click(highlightChip("Any ready"));
    expect(litIds().size, "the 'Any ready' chip dimmed nothing — this guard proved nothing").toBeLessThan(
      networkRows.length,
    );

    fireEvent.click(highlightChip("Any ready"));

    expect(highlightChip("Any ready")).toHaveAttribute("aria-pressed", "false");
    expect(wardCards()).toHaveLength(networkRows.length);
    expect(litIds()).toEqual(new Set(networkRows.map((row) => row.unit.id)));
  });

  it("the hero's 'Locked ready' figure presses the bed map's 'Locked ready' highlight", () => {
    renderScreen();
    const lockedWards = networkRows.filter((row) => row.lockedReady > 0);
    expect(lockedWards.length, "no ward has a locked bed ready — this guard proved nothing").toBeGreaterThan(0);
    const heroChips = within(screen.getByRole("group", { name: "Network beds" }));
    const heroLocked = heroChips.getByRole("button", { name: /Locked ready/u });
    expect(heroLocked).toHaveTextContent(String(networkRows.reduce((sum, row) => sum + row.lockedReady, 0)));
    expect(highlightChip("Locked ready")).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(heroLocked);

    expect(heroLocked).toHaveAttribute("aria-pressed", "true");
    expect(highlightChip("Locked ready")).toHaveAttribute("aria-pressed", "true");
    expect(highlightChip("Locked ready")).toHaveTextContent(
      `${lockedWards.length} ${lockedWards.length === 1 ? "ward" : "wards"}`,
    );
    expect(litIds()).toEqual(new Set(lockedWards.map((row) => row.unit.id)));
  });

  /**
   * The old ward sidebar was keyed by `worldGeneration`, so a demo reset cleared the selection and
   * focus went back to the opener or the network heading (proved red first, 2026-09-17). The same
   * promise is held here against the ward drawer: after a reset the drawer of the old world is
   * closed and focus is back on the card that opened it.
   */
  it("a demo reset after opening a ward clears the selection, and focus lands back on the opener", async () => {
    renderScreen();
    const user = userEvent.setup();
    const opener = within(bedMap()).getAllByRole("button", { name: /occupied/u })[0]!;
    await user.click(opener);
    expect(screen.getByTestId("ward-capacity-ward-drawer")).toBeInTheDocument();

    expect(flow, "the useWardFlow probe never captured the live context").toBeDefined();
    act(() => {
      flow.dispatch({ type: "RESET_SCENARIO", role: "demo", now: flow.now });
    });

    expect(
      screen.queryByTestId("ward-capacity-ward-drawer"),
      "the ward drawer stayed open across a demo reset",
    ).not.toBeInTheDocument();
    const card = cardOf(unitIdOfCard(opener));
    expect(
      card === document.activeElement,
      `the opener does not have focus after a demo reset; document.activeElement is ` +
        `${(document.activeElement as HTMLElement | null)?.tagName}#${(document.activeElement as HTMLElement | null)?.id}`,
    ).toBe(true);
  });

  it("highlight chips activate from the keyboard, on both Enter and Space, like any native button", async () => {
    renderScreen();
    const user = userEvent.setup();
    const readyChip = highlightChip("Any ready");
    const lockedChip = highlightChip("Locked ready");
    expect(readyChip).toHaveAttribute("aria-pressed", "false");

    readyChip.focus();
    await user.keyboard("{Enter}");
    expect(readyChip).toHaveAttribute("aria-pressed", "true");

    lockedChip.focus();
    await user.keyboard(" ");
    expect(lockedChip).toHaveAttribute("aria-pressed", "true");
    expect(readyChip).toHaveAttribute("aria-pressed", "false");

    await user.keyboard(" ");
    expect(lockedChip).toHaveAttribute("aria-pressed", "false");
  });
});
