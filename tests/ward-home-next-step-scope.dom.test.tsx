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
      // The hero title follows too: the service's movements, and the bed figure says it is network-wide.
      const title = screen.getByRole("heading", { level: 2, name: /open ED movements/u }).textContent ?? "";
      expect(title).toContain(`in ${service}`);
      expect(title).toMatch(/ready network-wide$/u);
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
  it("leaves out the hero chip that says the step's own figure on tablet and desktop", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    const step = answer();
    const chipFor = (label: RegExp) => screen.queryAllByRole("button", { name: label });
    // The seeded network opens on Act now, so the Act now chip is the one left out.
    expect(step).toMatch(/need(s)? a person now/u);
    expect(chipFor(/^\d+\s*To decide/u)).toHaveLength(1);
    if (/need(s)? a person now/u.test(step)) expect(chipFor(/^\d+\s*Act now/u)).toHaveLength(0);
    else if (/to decide/u.test(step)) expect(chipFor(/^\d+\s*To decide/u)).toHaveLength(0);
    // The step's own button still does the toggle the chip did.
    expect(screen.getByTestId("home-next-action")).toBeInTheDocument();
  });
});
