import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow",
  useRouter: () => ({ back: vi.fn(), replace: vi.fn() }),
}));

import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { MovementId } from "@/components/ward-management/ward-model";
import { movementById } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The coordinator sees how far each ward is by road from the department the patient is in.
 *
 * ⚠️ THE CAVEAT IS ASSERTED AS RENDERED TEXT, AND THE `title` IS ASSERTED ABSENT. This panel
 * removed a tooltip once before — `ward-shortlist.dom.test.tsx` still pins that, on the reasoning
 * that a `title` is invisible on a touch screen and to a keyboard, so a qualification put there
 * reaches nobody who needs it. The first draft of this feature put the caveat in a `title` and
 * repeated the same defect; the assertion below is what stops the third time.
 *
 * ⚠️ AND THE FIGURES INFORM, THEY DO NOT ORDER. Nothing in the pack is approved for automatic
 * routing, and contested catchments must never route. The shortlist's order is decided by bed
 * eligibility and is asserted here to be untouched by distance — a nearer ward must not float up.
 */
function Harness({ movementId }: { movementId: MovementId }) {
  const { movements, units, bedReleases, leaveBeds, referrals, now, dispatch, configuration } = useWardFlow();
  return (
    <ShortlistPanel
      movement={movements.find((candidate) => candidate.id === movementId)}
      now={now}
      units={units}
      bedReleases={bedReleases}
      leaveBeds={leaveBeds}
      referrals={referrals}
      selectedUnitId={undefined}
      onSelectUnit={() => {}}
      dispatch={dispatch}
      parallelReferralCap={configuration.parallelReferralCap}
    />
  );
}

function renderPanel(movementId: MovementId) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Harness movementId={movementId} />
    </WardFlowProvider>,
  );
}

/** A seeded movement that starts in a metropolitan emergency department. */
const FROM_AN_ED = "WF-009" as MovementId;

describe("road distance on the shortlist", () => {
  it("the fixture this rests on still starts in an emergency department", () => {
    expect(movementById(FROM_AN_ED)?.originEdId).toBeDefined();
  });

  it("shows a measured road route for at least one candidate ward", () => {
    renderPanel(FROM_AN_ED);
    const routes = screen.queryAllByTestId(/^ward-shortlist-route-[a-z]/);
    expect(routes.length, "no candidate shows a road distance").toBeGreaterThan(0);
    expect(routes[0].textContent).toMatch(/\d+(\.\d+)? km by road/);
    expect(routes[0].textContent).toMatch(/about \d+ min/);
  });

  it("states the caveat as visible text, never as a tooltip", () => {
    renderPanel(FROM_AN_ED);
    const caveat = screen.getByTestId("ward-shortlist-route-caveat");
    expect(caveat.textContent).toMatch(/not a clinical travel time/i);
    for (const route of screen.queryAllByTestId(/^ward-shortlist-route-[a-z]/)) {
      expect(route.getAttribute("title"), "the caveat has gone back to being a tooltip").toBeNull();
    }
  });

  it("does not use a route testid inside the candidate namespace", () => {
    // `ward-shortlist-candidate-` is how other suites select the rows themselves. A child using
    // that prefix is counted as a candidate, and a test clicking it selects nothing.
    renderPanel(FROM_AN_ED);
    for (const route of screen.queryAllByTestId(/^ward-shortlist-route-[a-z]/)) {
      expect(route.getAttribute("data-testid")).not.toMatch(/^ward-shortlist-candidate-/);
    }
  });

  it("does not reorder the shortlist by distance", () => {
    renderPanel(FROM_AN_ED);
    const candidates = screen.queryAllByTestId(/^ward-shortlist-candidate-[a-z]/);
    expect(candidates.length).toBeGreaterThan(0);
    const distances = candidates.map((row) => {
      const match = row.textContent?.match(/([\d.]+) km by road/);
      return match ? Number(match[1]) : null;
    });
    const measured = distances.filter((km): km is number => km !== null);
    // If distance were ordering the list, the measured values would be non-decreasing. Asserting
    // they are NOT sorted is weak on a short list, so this only fires when there is enough to tell.
    if (measured.length >= 3) {
      const sorted = [...measured].sort((a, b) => a - b);
      expect(measured.join(","), "the shortlist appears to be ordered by distance").not.toBe(sorted.join(","));
    }
  });
});
