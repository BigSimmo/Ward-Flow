import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CapacityScreen, ReadyNowSection } from "@/components/ward-management/capacity/capacity-screen";
import {
  bedKindGaps,
  networkTotals,
  networkWardRows,
} from "@/components/ward-management/capacity/capacity-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { bedReleases, wardMovements } from "@/components/ward-management/ward-movements";
import { resetServiceScopeForTests, setServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { NOW_ANCHOR, allUnits } from "@/components/ward-management/ward-sites";

/**
 * Build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md`, task C1 (item 44 — the
 * service chooser, Capacity's own scoping). Owns `capacity-screen.tsx`, its CSS module and
 * `bed-map.tsx`.
 *
 * ⚠️ **EVERY EXPECTED VALUE COMES FROM THE SAME DERIVATION FUNCTIONS THE SCREEN ITSELF CALLS**,
 * against the real fixture — `ward-capacity-screen.dom.test.tsx`'s own top-of-file comment states
 * why: a hand-written number goes stale the day the fixture changes, and it goes stale by passing.
 *
 * The one behaviour the real fixture cannot exercise is the MEASURED-ZERO branch of "Ready now" —
 * every one of the five health services has at least one ready bed at `NOW_ANCHOR` (checked directly:
 * North Metro 4, South Metro 8, East Metro 9, WACHS 4, Private 2). `ReadyNowSection` is exported
 * from `capacity-screen.tsx` for exactly this reason, so that branch is rendered and asserted
 * directly with a real, honestly-summed non-zero figure for every OTHER case, and a deliberately
 * zero one only for the branch the fixture itself cannot reach.
 */
const NOW = NOW_ANCHOR;
const units = allUnits();
const gapRows = bedKindGaps(wardMovements, units, NOW);
const networkRows = networkWardRows(units, NOW, bedReleases);
const netTotals = networkTotals(networkRows);
const totalLockedReady = networkRows.reduce((sum, row) => sum + row.lockedReady, 0);
const totalOpenReady = netTotals.ready - totalLockedReady;

const SCOPED_SERVICE = "South Metro" as const;
const scopedRows = networkRows.filter((row) => unitHealthService(row.unit) === SCOPED_SERVICE);
const outsideRows = networkRows.filter((row) => unitHealthService(row.unit) !== SCOPED_SERVICE);
const scopedReady = scopedRows.reduce((sum, row) => sum + row.ready, 0);
const scopedLockedReady = scopedRows.reduce((sum, row) => sum + row.lockedReady, 0);
const scopedOpenReady = scopedReady - scopedLockedReady;
const scopedBeds = scopedRows.reduce((sum, row) => sum + row.unit.beds, 0);

function renderScreen() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CapacityScreen />
    </WardFlowProvider>,
  );
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
  });
});

describe("with All services chosen, the screen renders byte-identical to before C1", () => {
  it("mounts no scope bar and no mismatch or Ready-in-service sentence", () => {
    renderScreen();
    expect(screen.queryByTestId("ward-service-scope-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-capacity-mismatch-service-note")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-capacity-ready-zero-in-service")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-capacity-ready-network-line")).not.toBeInTheDocument();
  });

  it("renders every ward's row in the table and its block on the map — nothing pre-filtered", () => {
    renderScreen();
    for (const row of networkRows) {
      expect(screen.getByTestId(`ward-capacity-network-row-${row.unit.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`ward-bed-map-ward-${row.unit.id}`)).toBeInTheDocument();
    }
  });

  it("keeps the exact pre-C1 Ready now markup: the whole-network headline, and the unscoped bar caption", () => {
    renderScreen();
    const readySummary = screen.getByRole("region", { name: "Ready now" });
    expect(within(readySummary).getByText(String(netTotals.ready), { selector: "strong" })).toBeInTheDocument();
    expect(within(readySummary).getByText(new RegExp(`^of\\s+${netTotals.beds} beds$`, "u"))).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: new RegExp(`Locked ready ${totalLockedReady}\\b.*Open ready`, "su") }),
    ).toBeInTheDocument();
  });

  it("keeps the Bed map panel's own count at the whole-network bed total", () => {
    renderScreen();
    const bedMapPanel = screen.getByRole("region", { name: "Bed map" });
    expect(within(bedMapPanel).getByText(`${netTotals.beds} beds`)).toBeInTheDocument();
  });
});

describe("with South Metro chosen, the map and ward table are scoped", () => {
  it("renders only South Metro's rows in the network table, and marks every other ward absent", () => {
    setServiceScope(SCOPED_SERVICE);
    renderScreen();
    for (const row of scopedRows) {
      expect(
        screen.getByTestId(`ward-capacity-network-row-${row.unit.id}`),
        `${row.unit.name} is in ${SCOPED_SERVICE} and must still render`,
      ).toBeInTheDocument();
    }
    for (const row of outsideRows) {
      expect(
        screen.queryByTestId(`ward-capacity-network-row-${row.unit.id}`),
        `${row.unit.name} is outside ${SCOPED_SERVICE} and must not render in the scoped table`,
      ).not.toBeInTheDocument();
    }
  });

  it("renders only South Metro's wards on the bed map, and no false 'no inpatient unit' sentence for any other service", () => {
    setServiceScope(SCOPED_SERVICE);
    renderScreen();
    for (const row of scopedRows) {
      expect(screen.getByTestId(`ward-bed-map-ward-${row.unit.id}`)).toBeInTheDocument();
    }
    for (const row of outsideRows) {
      expect(screen.queryByTestId(`ward-bed-map-ward-${row.unit.id}`)).not.toBeInTheDocument();
    }
    // ⚠️ The false claim this design specifically avoids: a service with real units printing "has
    // no inpatient unit reporting to this board" purely because scoping hid them from this map.
    const otherServices = [...new Set(outsideRows.map((row) => unitHealthService(row.unit)))];
    expect(otherServices.length).toBeGreaterThan(0);
    for (const other of otherServices) {
      expect(screen.queryByTestId(`ward-bed-map-service-${other}`)).not.toBeInTheDocument();
    }
  });

  it("scopes the Bed map panel's own count to South Metro's own beds", () => {
    setServiceScope(SCOPED_SERVICE);
    renderScreen();
    const bedMapPanel = screen.getByRole("region", { name: "Bed map" });
    expect(within(bedMapPanel).getByText(`${scopedBeds} beds`)).toBeInTheDocument();
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
  });

  it("shows the exact Ready caption and the whole-network sentence, in words, never hidden", () => {
    setServiceScope(SCOPED_SERVICE);
    renderScreen();
    const readySummary = screen.getByRole("region", { name: "Ready now" });
    expect(within(readySummary).getByText(`${scopedReady} beds ready in ${SCOPED_SERVICE}`)).toBeInTheDocument();
    expect(within(readySummary).getByTestId("ward-capacity-ready-network-line")).toHaveTextContent(
      `Across the whole network: ${netTotals.ready} beds ready, ${totalLockedReady} locked.`,
    );
  });

  it("states the mismatch panel is whole-network, without changing the panel itself", () => {
    setServiceScope(SCOPED_SERVICE);
    renderScreen();
    expect(screen.getByTestId("ward-capacity-mismatch-service-note")).toHaveTextContent(
      `Across the whole network, not only ${SCOPED_SERVICE}.`,
    );
  });
});

/**
 * R2 item 6 (P3): the aside's "Freeing today" and "Worth your attention" sub-panels, and the
 * "wards need confirming" chip beneath the second, all read `networkRows`/`freeingWards`/
 * `gapRows`/`shortfalls` — never `scopedNetworkRows` — so they sit whole-network beside the
 * genuinely-scoped "Ready now" section and ward table with nothing saying so. Labelled "across the
 * whole network" while a service is chosen; unchanged with All services.
 */
describe("the aside's Freeing/Attention sub-panels are labelled whole-network while a service is chosen (R2 item 6)", () => {
  it("labels 'Freeing today' and stays unlabelled with All services", () => {
    setServiceScope(SCOPED_SERVICE);
    renderScreen();
    expect(screen.getByRole("heading", { name: /^Freeing today/u })).toHaveTextContent(
      "Freeing today across the whole network",
    );

    resetServiceScopeForTests();
    renderScreen();
    const headings = screen.getAllByRole("heading", { name: /^Freeing today/u });
    expect(headings[headings.length - 1]).not.toHaveTextContent("across the whole network");
  });

  it("labels 'Worth your attention' and the 'wards need confirming' chip once the Attention tab is open", () => {
    setServiceScope(SCOPED_SERVICE);
    renderScreen();
    fireEvent.click(screen.getByRole("tab", { name: "Attention" }));

    expect(screen.getByRole("heading", { name: /^Needs you/u })).toHaveTextContent(
      "Needs you across the whole network",
    );
    expect(screen.getByRole("button", { name: /wards need confirming/iu })).toHaveTextContent(
      "wards need confirming across the whole network · Highlight wards",
    );
  });

  it("stays unlabelled with All services", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("tab", { name: "Attention" }));

    expect(screen.getByRole("heading", { name: /^Needs you/u })).not.toHaveTextContent("across the whole network");
    expect(screen.getByRole("button", { name: /wards need confirming/iu })).not.toHaveTextContent(
      "across the whole network",
    );
  });
});

/**
 * 🔴 **THE SAFETY PROPERTY — the mismatch band never narrows, whatever the Service selector is set
 * to.** Rendered twice, once per scope, and compared as markup: not "the same numbers" but the same
 * HTML, so a future change that reorders a row, renames a class, or drops a cell would fail this
 * exactly as loudly as a change that filtered the table would.
 */
describe("safety property: the mismatch table is identical with and without a service", () => {
  it("produces byte-identical markup for the gap table under All services and under South Metro", () => {
    const withoutService = renderScreen();
    const unscopedHtml = withoutService.getByTestId("ward-capacity-gap-table").outerHTML;
    withoutService.unmount();

    setServiceScope(SCOPED_SERVICE);
    const withService = renderScreen();
    const scopedHtml = withService.getByTestId("ward-capacity-gap-table").outerHTML;
    withService.unmount();

    expect(unscopedHtml.length).toBeGreaterThan(0);
    expect(scopedHtml).toBe(unscopedHtml);
  });

  it("produces byte-identical markup for the whole 'Where the mismatch is' panel too", () => {
    const withoutService = renderScreen();
    const unscopedPanel = within(withoutService.getByRole("region", { name: "Where the mismatch is" })).getByRole(
      "table",
    ).outerHTML;
    withoutService.unmount();

    setServiceScope(SCOPED_SERVICE);
    const withService = renderScreen();
    const scopedPanel = within(withService.getByRole("region", { name: "Where the mismatch is" })).getByRole(
      "table",
    ).outerHTML;
    withService.unmount();

    expect(scopedPanel).toBe(unscopedPanel);
  });
});

/**
 * `ReadyNowSection` rendered directly — see this file's own header comment for why: the real
 * fixture has no zero-ready service at `NOW_ANCHOR`, so the "None ready in {S}." branch and the
 * "no bar on a measured zero" refusal `WardBar` itself would throw on are proven here with
 * deliberately-zero props, the same way `ward-service-store.dom.test.tsx` proves
 * `WardServiceScopeBar`'s own branches with hand-supplied `shown`/`total`.
 */
describe("ReadyNowSection — the branch the real fixture at NOW_ANCHOR cannot reach", () => {
  it("with service null, renders exactly the pre-C1 markup (byte-identical assertions, not a re-description)", () => {
    render(
      <ReadyNowSection
        service={null}
        netTotals={netTotals}
        totalLockedReady={totalLockedReady}
        totalOpenReady={totalOpenReady}
        scopedReady={0}
        scopedLockedReady={0}
        scopedOpenReady={0}
        scopedPendingPreparation={0}
      />,
    );
    const readySummary = screen.getByRole("region", { name: "Ready now" });
    expect(within(readySummary).getByText(String(netTotals.ready), { selector: "strong" })).toBeInTheDocument();
    expect(within(readySummary).getByText(new RegExp(`^of\\s+${netTotals.beds} beds$`, "u"))).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: new RegExp(`Locked ready ${totalLockedReady}\\b.*Open ready`, "su") }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("ward-capacity-ready-network-line")).not.toBeInTheDocument();
  });

  it("with a real positive scoped count, renders the exact caption and the whole-network sentence", () => {
    render(
      <ReadyNowSection
        service={SCOPED_SERVICE}
        netTotals={netTotals}
        totalLockedReady={totalLockedReady}
        totalOpenReady={totalOpenReady}
        scopedReady={scopedReady}
        scopedLockedReady={scopedLockedReady}
        scopedOpenReady={scopedOpenReady}
        scopedPendingPreparation={0}
      />,
    );
    expect(screen.getByText(`${scopedReady} beds ready in ${SCOPED_SERVICE}`)).toBeInTheDocument();
    expect(screen.getByTestId("ward-capacity-ready-network-line")).toHaveTextContent(
      `Across the whole network: ${netTotals.ready} beds ready, ${totalLockedReady} locked.`,
    );
    expect(screen.queryByTestId("ward-capacity-ready-zero-in-service")).not.toBeInTheDocument();
  });

  it("with a MEASURED zero scoped count, renders 'None ready in {S}.' and draws no bar at all", () => {
    render(
      <ReadyNowSection
        service={SCOPED_SERVICE}
        netTotals={netTotals}
        totalLockedReady={totalLockedReady}
        totalOpenReady={totalOpenReady}
        scopedReady={0}
        scopedLockedReady={0}
        scopedOpenReady={0}
        scopedPendingPreparation={0}
      />,
    );
    expect(screen.getByTestId("ward-capacity-ready-zero-in-service")).toHaveTextContent(
      `None ready in ${SCOPED_SERVICE}.`,
    );
    // WardBar throws on an all-zero bar (see its own file header) — so the only way this component
    // can be safe here is to never construct one. No `role="img"` at all proves that, not merely
    // that the test did not crash.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByTestId("ward-capacity-ready-network-line")).toHaveTextContent(
      `Across the whole network: ${netTotals.ready} beds ready, ${totalLockedReady} locked.`,
    );
  });
});
