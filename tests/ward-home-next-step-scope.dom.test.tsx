import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
// The pre-commit hook's staged-file typecheck compiles only this file, so it imports the matchers.
import "@testing-library/jest-dom/vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { HealthService } from "@/components/ward-management/ward-model";
import { resetServiceScopeForTests, setServiceScope } from "@/components/ward-management/shell/ward-service-store";

/**
 * Plan item 2i (proposal, 3 Nov 2026): Home's next-step hero follows the chosen service. After a
 * service change the sentence counts only that service's work and says so; it never keeps the
 * statewide figure.
 */

const SERVICES: HealthService[] = ["South Metro", "North Metro", "East Metro"];

const answer = () => screen.getByTestId("hero-next-answer").textContent ?? "";
const leadingCount = (text: string) => Number(/^(\d+) /u.exec(text)?.[1] ?? 0);

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetServiceScopeForTests();
});

describe("Home next step follows the service scope", () => {
  it("names the chosen service, never counts more than statewide, and returns to statewide", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    const statewide = answer();
    expect(statewide).not.toMatch(/ in (South|North|East) Metro/u);
    const statewideCount = leadingCount(statewide);

    const scopedCounts: number[] = [];
    for (const service of SERVICES) {
      act(() => setServiceScope(service));
      const scoped = answer();
      expect(scoped, `the step for ${service}`).toContain(`in ${service}`);
      // The hero figures follow too: the service's movements, and the bed figure says it is network-wide.
      expect(screen.getByTestId("home-figure-ed")).toHaveTextContent(`Open movements in ${service}`);
      expect(screen.getByTestId("home-figure-beds").textContent).toMatch(/Ready · network-wide$/u);
      // Only the same kind of step can be compared by count: Act now statewide stays Act now or
      // falls back to a later step under a service, which then names its own figure.
      if (/need(s)? a person now/u.test(statewide) && /need(s)? a person now/u.test(scoped)) {
        expect(leadingCount(scoped)).toBeLessThanOrEqual(statewideCount);
        scopedCounts.push(leadingCount(scoped));
      }
    }
    // The three metro services split the statewide Act now figure rather than each repeating it.
    if (scopedCounts.length === SERVICES.length && statewideCount > 0) {
      expect(scopedCounts.every((count) => count === statewideCount)).toBe(false);
    }

    act(() => setServiceScope(null));
    expect(answer()).toBe(statewide);
  });
});

describe("Home next step is not repeated by a hero chip (Josh, 4 Nov 2026)", () => {
  // Sticky header redesign (Josh, 9 Nov 2026): the hero keeps no count chips at all; the step's own
  // button is the one toggle, on every size.
  it("leaves no hero chip repeating the step's figure; the step's button does the toggle", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    const step = answer();
    const chipFor = (label: RegExp) => screen.queryAllByRole("button", { name: label });
    // The seeded network opens on Act now. Since the sticky header redesign (9 Nov 2026) the hero keeps
    // no count chips at all, so neither Act now nor To decide has one.
    expect(step).toMatch(/need(s)? a person now/u);
    expect(chipFor(/^\d+\s*Act now/u)).toHaveLength(0);
    expect(chipFor(/^\d+\s*To decide/u)).toHaveLength(0);
    // The step's own button still does the toggle the chip did.
    expect(screen.getByTestId("home-next-action")).toBeInTheDocument();
  });
});
