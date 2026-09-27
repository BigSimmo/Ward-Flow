import { render, screen } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { readDeclinesByReason } from "@/components/ward-management/statistics/statistics-decline-reporting";
import { StatisticsEdScreen } from "@/components/ward-management/statistics/statistics-ed-screen";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * ═══ ONE MALFORMED FIELD MUST NOT TAKE A WHOLE SCREEN AWAY ════════════════════════════════════
 *
 * `declinesByReason` throws when a movement carries a decline reason outside `DECLINE_REASONS`, and
 * **that throw is correct and is not softened**: a categorical breakdown that quietly drops an
 * unrecognised member would under-count while still reading as authoritative.
 *
 * But three screens called it during render, so one bad field blanked an entire page — including
 * every figure that has nothing to do with declines. Ward Lead's ruling, 2026-09-07: report in
 * place, consistently, at all three sites, with the reason written in the code at each.
 *
 * ⚠️ **THE OVERVIEW SCREEN CANNOT BE DOM-TESTED HERE AND THAT IS A REAL LIMIT, NOT AN OVERSIGHT.**
 * `WardFlowProvider` takes only `initialNow` — there is no seam for injecting state — and
 * `StatisticsOverviewScreen` takes no `movements` prop, deliberately, because a route that passed
 * one would pin the screen to a fixture. So the third site is covered by the source scan at the
 * bottom of this file instead: no statistics screen may call `declinesByReason` directly. **That
 * proves the call site was converted; it does not prove that screen renders the sentence.** Stated
 * rather than papered over, because a reader who assumes all three are behaviourally covered would
 * be wrong.
 */

const STATISTICS_DIR = "src/components/ward-management/statistics";

/**
 * A movement carrying a decline reason the vocabulary does not contain.
 *
 * ⚠️ The cast is the point of the fixture: this value is unreachable through the type system, which
 * is exactly why the runtime guard exists. It is confined to this one helper so no other test can
 * pick up a malformed movement by accident.
 */
function withMalformedDecline(movements: Movement[]): Movement[] {
  const [first, ...rest] = movements;
  return [
    {
      ...first,
      declines: [...first.declines, { unitId: "any", at: first.openedAt, reason: "a_reason_nobody_declared" as never }],
    },
    ...rest,
  ];
}

function seedMovements(): Movement[] {
  return seedWardFlowStateAt(0).movements;
}

describe("readDeclinesByReason", () => {
  it("returns the breakdown untouched when every reason is a member", () => {
    const readout = readDeclinesByReason(seedMovements());
    expect(readout.ok).toBe(true);
    if (readout.ok) expect(readout.value.vocabularySize).toBeGreaterThan(0);
  });

  it("reports a malformed reason instead of throwing, and never states a count", () => {
    const readout = readDeclinesByReason(withMalformedDecline(seedMovements()));
    expect(readout.ok).toBe(false);
    if (!readout.ok) {
      expect(readout.statement).toMatch(/cannot be broken down by reason/u);
      // A nought here would be a false figure: the true count is unknown, not zero.
      expect(readout.statement).not.toMatch(/\b0\b/u);
      expect(readout.detail).toMatch(/^declinesByReason:/u);
    }
  });

  it("rethrows anything that is not the vocabulary error", () => {
    // The one property that stops this becoming a blanket catch. Without it, a genuine defect
    // anywhere inside the derivation would render a reassuring sentence over itself.
    const exploding = new Proxy([] as Movement[], {
      get(target, key) {
        if (key === Symbol.iterator) throw new Error("some unrelated defect deeper in the derivation");
        return Reflect.get(target, key);
      },
    });
    expect(() => readDeclinesByReason(exploding)).toThrow(/some unrelated defect/u);
  });
});

describe("the screens survive a malformed decline reason", () => {
  it("the hub reports it in place and still renders its other figures", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsScreen movements={withMalformedDecline(seedMovements())} />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("ward-statistics-declines-by-reason-unavailable")).toBeTruthy();
    expect(screen.queryByTestId("ward-statistics-declines-by-reason-total")).toBeNull();

    // The point of the ruling: the rest of the page is untouched. If this screen had thrown, the
    // render above would have failed outright and every assertion here would be unreachable.
    expect(screen.getByTestId("ward-statistics-screen")).toBeTruthy();
  });

  it("the ED screen keeps the count that does not read the vocabulary, and withholds only the subtraction", () => {
    // 🔴 The asymmetry this test exists for. `noFreeBed` filters for its reason directly and stays
    // true; `notSuitable` is a subtraction from the total and becomes unknowable. Withholding both
    // would read as "no ward refused for want of a bed", which is a different false claim.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsEdScreen edId={seedMovements()[0].originEdId} movements={withMalformedDecline(seedMovements())} />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("ward-stat-ed-declined-no-free-bed")).toBeTruthy();
    expect(screen.getByTestId("ward-stat-ed-declined-not-suitable-unavailable")).toBeTruthy();
    expect(screen.queryByTestId("ward-stat-ed-declined-not-suitable")).toBeNull();
  });

  it("renders the ordinary figures when nothing is malformed, so the branch above is not the only path", () => {
    // A control. Without it, a screen that ALWAYS reported unavailability would pass every
    // assertion above while showing a reader nothing at all.
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StatisticsScreen movements={seedMovements()} />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("ward-statistics-declines-by-reason-total")).toBeTruthy();
    expect(screen.queryByTestId("ward-statistics-declines-by-reason-unavailable")).toBeNull();
  });
});

describe("all three call sites were converted, including the one that cannot be rendered here", () => {
  const screens = readdirSync(STATISTICS_DIR).filter((f) => f.endsWith("-screen.tsx"));

  it("walked every statistics screen", () => {
    // Floor the population: a scan over an empty list reports "clean".
    expect(screens.length).toBeGreaterThanOrEqual(5);
    expect(screens).toContain("statistics-overview-screen.tsx");
    expect(screens).toContain("statistics-screen.tsx");
    expect(screens).toContain("statistics-ed-screen.tsx");
  });

  // ⚠️ The detector's own test, because the scan above passed on its first run and a scan that
  // matches nothing passes on its first run too. `readDeclinesByReason(` contains the literal
  // `DeclinesByReason(`, so a naive pattern would report every converted site as an offender — and
  // a pattern loose enough to avoid that can end up matching nothing at all.
  const DIRECT_CALL = /(?<!read)\bdeclinesByReason\s*\(/u;

  it("the detector matches a direct call and not the wrapped one", () => {
    expect(DIRECT_CALL.test("const d = declinesByReason(movements);")).toBe(true);
    expect(DIRECT_CALL.test("const d = readDeclinesByReason(movements);")).toBe(false);
    // Prose naming the function is not a call, and every one of these screens discusses it at length.
    expect(DIRECT_CALL.test(" * `declinesByReason` throws when a movement carries")).toBe(false);
  });

  it("no screen calls declinesByReason directly", () => {
    const offenders = screens.filter((file) => {
      const source = readFileSync(`${STATISTICS_DIR}/${file}`, "utf8");
      return DIRECT_CALL.test(source);
    });
    expect(
      offenders,
      "A screen calling declinesByReason directly loses the whole page to one malformed field. " +
        "Use readDeclinesByReason and report in place — see statistics-decline-reporting.ts.",
    ).toEqual([]);
  });
});
