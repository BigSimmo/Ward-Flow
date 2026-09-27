import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WARD_ADMISSIONS_ANCHOR } from "@/components/ward-management/ward-admissions-seed";
import type { HealthService } from "@/components/ward-management/ward-model";
import { resetServiceScopeForTests, setServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { wardSites } from "@/components/ward-management/ward-sites";

/**
 * Build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md`, task G2 (item 44 — the
 * service chooser, §2 "Bed board ... a sentence only.", §3 "Bed board" — same-service and
 * other-service branches). After G1 (item 51, same file — the tile/figure structural proof lives
 * in `tests/ward-board-figures-and-tiles-structural.dom.test.tsx`).
 */

const UNIT_ID = "rph-adult-secure";
const OWN_SERVICE: HealthService = wardSites.find((site) => site.units.some((unit) => unit.id === UNIT_ID))!.service;
const OTHER_SERVICE = (["North Metro", "South Metro", "East Metro", "WACHS", "Private"] as HealthService[]).find(
  (service) => service !== OWN_SERVICE,
)!;

function renderWardBoard(unitId: string) {
  return render(
    <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
      <WardBoard unitId={unitId} />
    </WardFlowProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetServiceScopeForTests();
});

describe("fixture sanity", () => {
  it("the chosen unit's own service resolves and a different one exists", () => {
    expect(OWN_SERVICE).toBeDefined();
    expect(OTHER_SERVICE).not.toBe(OWN_SERVICE);
  });
});

describe("the bed board states how the chosen service relates to it (item 44, task G2)", () => {
  it("with the ward's own service chosen, states the SAME-service branch exactly", () => {
    setServiceScope(OWN_SERVICE);
    renderWardBoard(UNIT_ID);

    expect(screen.getByTestId("ward-board-service-sentence")).toHaveTextContent(
      `The Service selector is set to ${OWN_SERVICE}, which is this ward's own service.`,
    );
  });

  it("with a DIFFERENT service chosen, states the OTHER-service branch exactly, naming both services", () => {
    setServiceScope(OTHER_SERVICE);
    renderWardBoard(UNIT_ID);

    expect(screen.getByTestId("ward-board-service-sentence")).toHaveTextContent(
      `The Service selector is set to ${OTHER_SERVICE}. This ward is in ${OWN_SERVICE}. The board always shows this one ward.`,
    );
  });

  it("with All services chosen, the sentence does not render at all", () => {
    // resetServiceScopeForTests() in beforeEach already leaves the store at All services (null).
    renderWardBoard(UNIT_ID);

    expect(screen.queryByTestId("ward-board-service-sentence")).not.toBeInTheDocument();
  });

  it("the board's own markup (tiles and figures) is identical with and without a service chosen", () => {
    const unscoped = renderWardBoard(UNIT_ID);
    const unscopedBeds = unscoped.getByTestId("ward-board-beds").innerHTML;
    const unscopedFigures = unscoped.getByTestId("ward-board-triage").innerHTML;
    cleanup();

    setServiceScope(OTHER_SERVICE);
    const scoped = renderWardBoard(UNIT_ID);
    const scopedBeds = scoped.getByTestId("ward-board-beds").innerHTML;
    const scopedFigures = scoped.getByTestId("ward-board-triage").innerHTML;

    expect(scopedBeds).toBe(unscopedBeds);
    expect(scopedFigures).toBe(unscopedFigures);
  });
});
