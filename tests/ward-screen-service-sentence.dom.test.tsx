import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Same jsdom-App-Router workaround as the sibling ward-screen dom suites.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { resetServiceScopeForTests, setServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import type { HealthService } from "@/components/ward-management/ward-model";

/**
 * Build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md`, task F3 (item 44 — the
 * service chooser, §2 "Bed board, ward page and all seven statistics screens: a sentence only.",
 * §3 "Ward" — "This ward is one unit in {own}, so its own figures below do not change with the
 * service."). The ward page is a page about ONE named place (§2 "Never hidden", S4) — it is never
 * itself narrowed by the chosen service; this only states how the choice relates to it.
 */

function renderWard(unitId: string) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={unitId} />
    </WardFlowProvider>,
  );
}

const UNIT = allUnits().find((candidate) => unitHealthService(candidate) !== undefined)!;
const OWN_SERVICE = unitHealthService(UNIT) as HealthService;
// A DIFFERENT service from the unit's own, to prove the sentence's wording never branches on
// same-vs-different the way the bed board's own §3 sentence does — the ward page states its own
// service either way.
const OTHER_SERVICE = (["North Metro", "South Metro", "East Metro", "WACHS", "Private"] as HealthService[]).find(
  (service) => service !== OWN_SERVICE,
)!;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetServiceScopeForTests();
});

describe("fixture sanity", () => {
  it("has a real unit whose own service resolves", () => {
    expect(UNIT, "no unit in the fixture resolves to a health service").toBeDefined();
    expect(OWN_SERVICE).toBeDefined();
    expect(OTHER_SERVICE).not.toBe(OWN_SERVICE);
  });
});

describe("the ward page states how the chosen service relates to it (item 44, task F3)", () => {
  it("with the unit's own service chosen, states the exact §3 sentence", () => {
    setServiceScope(OWN_SERVICE);
    renderWard(UNIT.id);

    expect(screen.getByTestId("ward-unit-service-sentence")).toHaveTextContent(
      `This ward is one unit in ${OWN_SERVICE}, so its own figures below do not change with the service.`,
    );
  });

  it("with a DIFFERENT service chosen, the wording is identical — it never branches on same-vs-different", () => {
    setServiceScope(OTHER_SERVICE);
    renderWard(UNIT.id);

    expect(screen.getByTestId("ward-unit-service-sentence")).toHaveTextContent(
      `This ward is one unit in ${OWN_SERVICE}, so its own figures below do not change with the service.`,
    );
  });

  it("with All services chosen, the sentence does not render at all", () => {
    // resetServiceScopeForTests() in beforeEach already leaves the store at All services (null).
    renderWard(UNIT.id);

    expect(screen.queryByTestId("ward-unit-service-sentence")).not.toBeInTheDocument();
  });

  it("the ward's own figures are unaffected by the chosen service (S4: never itself scoped)", () => {
    cleanup();
    const unscoped = renderWard(UNIT.id);
    const unscopedCard = unscoped.getByTestId(`ward-unit-card-${UNIT.id}`).textContent;
    cleanup();

    setServiceScope(OTHER_SERVICE);
    const scoped = renderWard(UNIT.id);
    const scopedCard = scoped.getByTestId(`ward-unit-card-${UNIT.id}`).textContent;

    expect(scopedCard).toBe(unscopedCard);
  });
});
