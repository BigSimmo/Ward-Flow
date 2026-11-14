import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CapacityScreen } from "@/components/ward-management/capacity/capacity-screen";
import { bedMapWards, groupBedMapWardsByService } from "@/components/ward-management/capacity/bed-map";
import {
  bedKindGaps,
  networkTotals,
  networkWardRows,
} from "@/components/ward-management/capacity/capacity-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resetServiceScopeForTests, setServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { shiftConfirmations } from "@/components/ward-management/capacity/shift-confirmations";
import { bedMapCards, bedMapGroup, bedMapRegion, wardCardName } from "./helpers/capacity-ward-table";

/**
 * Build plan `docs/history/plans-2026-09/2026-09-17-build-plan-screens.md`, task C1 (item 44 — the
 * service chooser, Capacity's own scoping), on the October 2026 redesign of Capacity
 * (`capacity-screen.tsx`).
 *
 * A chosen service narrows the bed map and the other ward panels (nearest ready beds, This shift;
 * scope audit, Josh, 3 Nov 2026). The hero, the mismatch band and the bed forecast stay
 * whole-network, and the hero's eyebrow says so ("Modelled network, not only South Metro"). The
 * redesign removed the old "Ready now" section (`ReadyNowSection`), the gap table, the network ward
 * table and the aside's Freeing today / Needs you panels, each of which carried its own
 * whole-network sentence; their cases were retired with them, and the whole-network rule is pinned
 * here on the hero, the mismatch band and the forecast instead.
 *
 * ⚠️ **EVERY EXPECTED VALUE COMES FROM THE SAME DERIVATION FUNCTIONS THE SCREEN ITSELF CALLS**,
 * against the seeded state the provider starts from — a hand-written number goes stale the day the
 * fixture changes, and it goes stale by passing.
 */
const NOW = NOW_ANCHOR;
const seeded = seedWardFlowState();
const gapRows = bedKindGaps(seeded.movements, seeded.units, NOW, seeded.admissions);
const networkRows = networkWardRows(seeded.units, NOW, seeded.bedReleases, seeded.admissions, seeded.leaveBeds);
const netTotals = networkTotals(networkRows);
const mapGroups = groupBedMapWardsByService(
  bedMapWards(seeded.units, [...seeded.bedReleases], seeded.admissions, seeded.leaveBeds),
);

const SCOPED_SERVICE = "South Metro" as const;
const scopedRows = networkRows.filter((row) => unitHealthService(row.unit) === SCOPED_SERVICE);
const outsideRows = networkRows.filter((row) => unitHealthService(row.unit) !== SCOPED_SERVICE);
const scopedReady = scopedRows.reduce((sum, row) => sum + row.ready, 0);

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
    </WardFlowProvider>,
  );
}

/**
 * The hero's ready figure must always be the whole network's. Page tops (Josh, 9 Nov 2026): the
 * headline is now "Beds ready and short" and the ready count is the first hero figure; the
 * Locked / Open ready chips went with the old top, and their split lives on as the bed map's
 * highlights, which a service does narrow.
 */
function expectWholeNetworkHero() {
  const figures = screen.getByRole("group", { name: "Network beds" });
  expect(within(figures).getByTestId("capacity-hero-ready")).toHaveTextContent(
    // D-179 item 8: the beds still being made ready are said beside Ready.
    new RegExp(
      `^${netTotals.ready}\\s*/ ${netTotals.beds}\\s*Ready · now${netTotals.pendingPreparation ? `, ${netTotals.pendingPreparation} being made ready` : ""}$`,
      "u",
    ),
  );
  expect(netTotals.ready, "the network and South Metro could not be told apart").not.toBe(scopedReady);
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  resetServiceScopeForTests();
  window.sessionStorage.clear();
});

describe("Capacity screen service scope — the fixture actually has something to prove", () => {
  it("has a real, non-vacuous population: some wards inside the chosen service, some outside, all with ready beds", () => {
    expect(gapRows.length).toBeGreaterThan(0);
    expect(scopedRows.length, "no ward belongs to South Metro — this whole file proves nothing").toBeGreaterThan(0);
    expect(outsideRows.length, "every ward belongs to South Metro — nothing is actually narrowed").toBeGreaterThan(0);
    expect(scopedRows.length).toBeLessThan(networkRows.length);
    expect(scopedReady, "South Metro has zero ready beds today — the non-zero branch is untested").toBeGreaterThan(0);
    expect(scopedReady, "South Metro holds every ready bed — the hero could not be told apart").toBeLessThan(
      netTotals.ready,
    );
  });
});

describe("with All services chosen, nothing is narrowed", () => {
  // Page tops (Josh, 9 Nov 2026): with nothing chosen the header names the network, so the hero
  // has no eyebrow; its figures are still named the network's.
  it("mounts no scope bar and labels the hero's figures the network's", () => {
    renderScreen();
    expect(screen.queryByTestId("ward-service-scope-bar")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Network beds" })).toBeInTheDocument();
    expect(screen.queryByText(/not only/u)).toBeNull();
  });

  it("draws every ward on the bed map, in every service that has one — nothing pre-filtered", () => {
    renderScreen();
    expect(bedMapCards()).toHaveLength(networkRows.length);
    for (const group of mapGroups) {
      if (group.wards.length === 0) continue;
      expect(bedMapGroup(group.service), `${group.service} has wards but no group`).not.toBeNull();
    }
  });

  it("states the whole network's ready beds in the hero headline and its ready chips", () => {
    renderScreen();
    expectWholeNetworkHero();
  });
});

describe("with South Metro chosen, only the bed map is scoped", () => {
  it("draws only South Metro's wards on the bed map, and no group for any other service", () => {
    setServiceScope(SCOPED_SERVICE);
    renderScreen();
    const scoped = mapGroups.find((group) => group.service === SCOPED_SERVICE)!;
    expect(bedMapCards().map(wardCardName)).toEqual(scoped.wards.map((ward) => ward.unit.name));
    // ⚠️ The false claim this design specifically avoids: a service with real units reading as
    // absent purely because scoping hid it. A scoped-out service draws no group at all.
    const otherServices = [...new Set(outsideRows.map((row) => unitHealthService(row.unit)))];
    expect(otherServices.length).toBeGreaterThan(0);
    for (const other of otherServices) {
      expect(bedMapGroup(other!), `${other} is outside ${SCOPED_SERVICE}`).toBeNull();
    }
  });

  // Josh's fifth notes (8 Nov 2026): Nearest ready beds and This shift are gone. Their counts now sit
  // in the hero strip, which follows the hero's rule: whole network, never the chosen service.
  it("counts every ward's confirmation in the hero, never only South Metro's", () => {
    setServiceScope(SCOPED_SERVICE);
    renderScreen();
    const network = shiftConfirmations(
      networkRows.map((row) => row.unit),
      NOW,
    );
    const chip = screen.getByTestId("capacity-hero-confirmed");
    expect(chip.textContent ?? "").toContain(`${network.confirmed} of ${network.total}`);
  });

  it("keeps the hero headline and its ready chips at the whole network, never South Metro's own", () => {
    setServiceScope(SCOPED_SERVICE);
    renderScreen();
    expectWholeNetworkHero();
  });

  it("labels the hero Modelled network, never South Metro, because its figures are whole-network (shell-1)", () => {
    setServiceScope(SCOPED_SERVICE);
    renderScreen();
    expect(screen.getAllByText(/^Modelled network, not only South Metro$/u).length).toBeGreaterThan(0);
    // The bed map below names South Metro's group; the hero itself never names it alone.
    const hero = screen.getByRole("heading", { level: 1 }).closest("[data-wf-hero]") as HTMLElement;
    expect(within(hero).queryByText(/^South Metro$/u)).toBeNull();
    const figures = screen.getByRole("group", { name: "Network beds" });
    expect(figures.getAttribute("aria-label") ?? "").not.toContain(SCOPED_SERVICE);
  });

  it("shows the exact scope bar sentence — 'Showing N of M wards, in South Metro.'", () => {
    setServiceScope(SCOPED_SERVICE);
    renderScreen();
    const bar = screen.getByTestId("ward-service-scope-bar");
    expect(within(bar).getByTestId("ward-service-scope-bar-summary").textContent ?? "").toContain(
      `Showing ${scopedRows.length} of ${networkRows.length} wards, in ${SCOPED_SERVICE}.`,
    );
    // Capacity's ward list is not a movement list, and a unit's service always resolves — neither
    // sentence belongs here (§2's own reasoning for both fields being optional).
    expect(within(bar).queryByTestId("ward-service-scope-bar-unresolved")).not.toBeInTheDocument();
    expect(within(bar).queryByTestId("ward-service-scope-bar-urgent")).not.toBeInTheDocument();
    expect(bedMapRegion().parentElement).toContainElement(bar);
  });
});

/**
 * 🔴 **THE SAFETY PROPERTY — the mismatch never narrows, whatever the Service selector is set to.**
 * Rendered twice, once per scope, and compared as markup: not "the same numbers" but the same
 * HTML, so a future change that reorders a tile, renames a class, or drops a figure would fail this
 * exactly as loudly as a change that filtered the band would. The bed forecast is held to the same.
 * Only React's generated ids are normalised, because they differ between any two mounts.
 */
/** React's `useId` values count up across mounts, so two renders differ there and nowhere else. */
/** The Mismatch band (in the hero since the page tops) or the Forecast rail card (wave 4, D-191). */
function card(view: ReturnType<typeof renderScreen>, name: "Mismatch" | "Forecast"): HTMLElement {
  return name === "Mismatch" ? view.getByTestId("capacity-mismatch") : view.getByTestId("capacity-forecast-card");
}

function withoutIds(html: string): string {
  return html.replace(/_r_[0-9a-z]+_/gu, "_r_id_");
}

describe("safety property: the mismatch band and the forecast are identical with and without a service", () => {
  for (const name of ["Mismatch", "Forecast"] as const) {
    it(`produces byte-identical markup for the ${name} card under All services and under South Metro`, () => {
      const withoutService = renderScreen();
      const unscopedHtml = withoutIds(card(withoutService, name).outerHTML);
      withoutService.unmount();

      setServiceScope(SCOPED_SERVICE);
      const withService = renderScreen();
      expect(withService.getByTestId("ward-service-scope-bar")).toBeInTheDocument();
      const scopedHtml = withoutIds(card(withService, name).outerHTML);
      withService.unmount();

      expect(unscopedHtml.length).toBeGreaterThan(0);
      // Scope audit (Josh, 3 Nov 2026): the scoped card adds one quiet "Network-wide" label and
      // nothing else; every figure is the same.
      // The Mismatch card is now the hero's band (page tops, Josh 9 Nov 2026), whose aside is a <p>.
      // The Forecast card says it in its meta line, "From ward dates · Network-wide" (wave 4).
      const label = name === "Mismatch" ? /<p class="[^"]*">Network-wide<\/p>/u : / · Network-wide/u;
      expect(unscopedHtml).not.toMatch(label);
      expect(scopedHtml).toMatch(label);
      expect(scopedHtml.replace(label, "")).toBe(unscopedHtml);
    });
  }
});
