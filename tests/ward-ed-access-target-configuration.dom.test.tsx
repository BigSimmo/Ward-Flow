// tests/ward-ed-access-target-configuration.dom.test.tsx
import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { PARALLEL_REFERRAL_CAP, PULL_HOLD_MINUTES } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Task 6 of the audit-wiring plan, 2026-09-16: this is the DOM proof that the ED screen actually
 * READS `state.configuration.edAccessTargetMinutes` — not just that `ed-home-derivations.ts`'s
 * pure functions accept a target argument (see tests/ward-ed-home-derivations.test.ts for that).
 *
 * `ED_ACCESS_TARGET_RANGE_MINUTES.min` (720), the LOWEST value `SET_CONFIGURATION` will accept —
 * not an arbitrary lower number, so this test cannot pass by coincidentally choosing a value
 * `validateConfiguration` would refuse.
 */
const LOWERED_TARGET = 720;

/**
 * A real seeded movement whose own wait sits strictly between the lowered target above and the
 * default (`ED_ACCESS_TARGET_MINUTES` = 1440), found from the fixture rather than hand-picked by
 * id — so this test keeps working if the fixture's exact minutes ever change, and fails loudly
 * (rather than silently proving nothing) if the seed stops containing a movement in this band.
 */
const flips = wardMovements.find((movement) => {
  const waited = NOW_ANCHOR - movement.openedAt;
  return isOpen(movement) && waited > LOWERED_TARGET && waited < 1440;
});
if (!flips) {
  throw new Error(
    "fixture no longer contains an open movement whose wait sits strictly between 720 and 1440 minutes — this test cannot prove anything without one",
  );
}
const target = flips;

// Mirrors ward-audit-provider.dom.test.tsx's own harness (`current = useWardFlow()`): a thin
// sibling captures the live context so `act(() => current.dispatch(...))` can drive the real
// reducer from outside the render tree.
let current: ReturnType<typeof useWardFlow>;
function Harness({ edId }: { edId: string }) {
  const value = useWardFlow();
  useEffect(() => {
    current = value;
  });
  return <EdScreen edId={edId} />;
}
function renderScreen(edId: string) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Harness edId={edId} />
    </WardFlowProvider>,
  );
}

describe("the ED screen reads the coordinator-configured ED access target", () => {
  it("SET_CONFIGURATION flips ward-ed-access-target-<id> from under to over, and the screen's own label follows it", () => {
    renderScreen(target.originEdId);
    const testid = `ward-ed-access-target-${target.id}`;

    // Under the default 1440-minute target, this movement's wait has not yet passed it.
    expect(screen.getByTestId(testid)).toHaveAttribute("data-state", "under");

    act(() => {
      current.dispatch({
        type: "SET_CONFIGURATION",
        role: "coordinator",
        now: NOW_ANCHOR,
        payload: {
          edAccessTargetMinutes: LOWERED_TARGET,
          parallelReferralCap: PARALLEL_REFERRAL_CAP,
          pullHoldMinutes: PULL_HOLD_MINUTES,
        },
      });
    });

    // A coordinator-configured target of 700 minutes puts the same movement's wait past it.
    expect(screen.getByTestId(testid)).toHaveAttribute("data-state", "over");
  });

  it("the screen's text names the new label and carries no '24-hour' wording", () => {
    renderScreen(target.originEdId);
    act(() => {
      current.dispatch({
        type: "SET_CONFIGURATION",
        role: "coordinator",
        now: NOW_ANCHOR,
        payload: {
          edAccessTargetMinutes: LOWERED_TARGET,
          parallelReferralCap: PARALLEL_REFERRAL_CAP,
          pullHoldMinutes: PULL_HOLD_MINUTES,
        },
      });
    });

    const screenText = document.body.textContent ?? "";
    // splitDuration(720) === "12h 00m" — the governance banner and the table header both name it.
    expect(screenText).toMatch(/12h 00m/);
    expect(screenText).not.toMatch(/24-hour/);
    expect(screenText).not.toMatch(/24h target/);
  });
});
