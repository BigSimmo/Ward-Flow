import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WardShellAuthorityProvider } from "@/components/ward-management/shell/ward-shell-public-context";
import { WardDemoPanel } from "@/components/ward-management/tools/ward-demo-panel";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import {
  seedWardFlowState,
  seedWardFlowStateAt,
  wardFlowReducer,
} from "@/components/ward-management/ward-flow-reducer";
import { rulingsDemoOverlay, workedExamplesShown } from "@/components/ward-management/ward-rulings-demo";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * A16-14 (root cause R8; Josh approved 13 Nov 2026). The legal-form worked examples were merged into
 * every Standard day at Armadale ED, so Armadale's 22 waiting, the 7d 1h longest wait and much of
 * the detained count were planted rows. They are now off by default and the presenter switches
 * them on from Tools, Demo, as the look-alike hard cases are opt-in.
 */

const overlay = rulingsDemoOverlay(NOW_ANCHOR);
const EXAMPLE_IDS = new Set(
  [...overlay.movements, ...overlay.referrals, ...overlay.admissions, ...overlay.leaveBeds].map((row) => row.id),
);

function exampleIdsIn(state: ReturnType<typeof seedWardFlowState>): string[] {
  return [...state.movements, ...state.referrals, ...state.admissions, ...state.leaveBeds]
    .map((row) => row.id)
    .filter((id) => EXAMPLE_IDS.has(id));
}

describe("A16-14: the worked examples are the presenter's to switch on", () => {
  it("leaves every worked example out of the ordinary Standard day", () => {
    expect(EXAMPLE_IDS.size).toBeGreaterThan(10);
    const ordinary = seedWardFlowState();
    expect(exampleIdsIn(ordinary)).toEqual([]);
    expect(workedExamplesShown(ordinary)).toBe(false);
  });

  it("keeps Armadale's ordinary waits apart from the examples", () => {
    const armadaleOpen = (state: ReturnType<typeof seedWardFlowState>) =>
      state.movements.filter((movement) => movement.originEdId === "arm-ed" && movement.closure === undefined);
    const ordinary = armadaleOpen(seedWardFlowState());
    const withExamples = armadaleOpen(seedWardFlowState("standard", { workedExamples: true }));
    expect(ordinary.every((movement) => !EXAMPLE_IDS.has(movement.id))).toBe(true);
    expect(withExamples.length).toBeGreaterThan(ordinary.length);
  });

  it("puts every example in when switched on, and keeps the ordinary day under them", () => {
    const ordinary = seedWardFlowState();
    const on = seedWardFlowState("standard", { workedExamples: true });
    expect(new Set(exampleIdsIn(on))).toEqual(EXAMPLE_IDS);
    expect(workedExamplesShown(on)).toBe(true);
    for (const movement of ordinary.movements) {
      expect(
        on.movements.some((row) => row.id === movement.id),
        movement.id,
      ).toBe(true);
    }
  });

  it("switches on through SET_SCENARIO, keeps them through Reset demo, and switches off again", () => {
    const start = seedWardFlowStateAt(0);
    const on = wardFlowReducer(start, {
      type: "SET_SCENARIO",
      role: "demo",
      now: NOW_ANCHOR,
      scenario: "standard",
      workedExamples: true,
    });
    expect(workedExamplesShown(on)).toBe(true);
    const reset = wardFlowReducer(on, { type: "RESET_SCENARIO", role: "demo", now: NOW_ANCHOR });
    expect(workedExamplesShown(reset)).toBe(true);
    const off = wardFlowReducer(reset, { type: "SET_SCENARIO", role: "demo", now: NOW_ANCHOR, scenario: "standard" });
    expect(workedExamplesShown(off)).toBe(false);
    expect(workedExamplesShown(wardFlowReducer(off, { type: "RESET_SCENARIO", role: "demo", now: NOW_ANCHOR }))).toBe(
      false,
    );
  });
});

function ExamplesProbe() {
  return <output data-testid="examples">{workedExamplesShown(useWardFlow()) ? "on" : "off"}</output>;
}

describe("A16-14: Tools, Demo has the switch", () => {
  it("starts off, asks first, then shows and hides the worked examples", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ExamplesProbe />
        <WardDemoPanel />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("examples")).toHaveTextContent("off");
    const toggle = screen.getByTestId("ward-tools-demo-worked-examples-toggle");
    expect(toggle).toHaveTextContent("Show worked examples");
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(toggle);
    const dialog = screen.getByRole("dialog", { name: "Show worked examples?" });
    expect(dialog).toHaveTextContent("This reloads Standard day with the worked examples");
    expect(screen.getByTestId("examples")).toHaveTextContent("off");
    fireEvent.click(within(dialog).getByRole("button", { name: "Show worked examples" }));
    expect(screen.getByTestId("examples")).toHaveTextContent("on");

    const shown = screen.getByTestId("ward-tools-demo-worked-examples-toggle");
    expect(shown).toHaveTextContent("Hide worked examples");
    expect(shown).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(shown);
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Hide worked examples?" })).getByRole("button", {
        name: "Hide worked examples",
      }),
    );
    expect(screen.getByTestId("examples")).toHaveTextContent("off");
  });
});

describe("Worked examples toggle on scoped desks", () => {
  it("is offered on a whole-network desk and hidden on a scoped one, which cannot see the examples", () => {
    const { unmount } = render(
      <WardShellAuthorityProvider access={{ role: "coordinator", scope: { kind: "statewide" } }}>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WardDemoPanel />
        </WardFlowProvider>
      </WardShellAuthorityProvider>,
    );
    expect(screen.getByTestId("ward-tools-demo-worked-examples-toggle")).toBeInTheDocument();
    unmount();
    render(
      <WardShellAuthorityProvider
        access={{ role: "community", scope: { kind: "team", teamName: "Midland Community Team" } }}
      >
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WardDemoPanel />
        </WardFlowProvider>
      </WardShellAuthorityProvider>,
    );
    expect(screen.queryByTestId("ward-tools-demo-worked-examples-toggle")).toBeNull();
  });
});
