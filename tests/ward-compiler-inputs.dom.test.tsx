import { act, fireEvent, render, screen } from "@testing-library/react";
import { memo } from "react";
import { describe, expect, it } from "vitest";

import {
  clockState,
  DEFAULT_DUE_SOON_THRESHOLDS,
  type DueSoonThresholds,
} from "@/components/ward-management/ward-clock";
import {
  WardFlowProvider,
  useDueSoonThresholds,
  useWardFlow,
  useWardNetwork,
} from "@/components/ward-management/ward-flow-provider";
import { scenarioWardNetwork, WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { NOW_ANCHOR, type WardNetwork } from "@/components/ward-management/ward-sites";

/**
 * With the React Compiler on, a screen's calculation re-runs only when an input it can see
 * changes. These prove the warnings and the scenario's wards reach a screen as inputs, so a memoised
 * screen still updates when Settings changes a warning or the demo switches scenario.
 */

const DUE_IN_MINUTES = 120;

const ClockLabel = memo(function ClockLabel({ thresholds, now }: { thresholds: DueSoonThresholds; now: number }) {
  return <span data-testid="clock">{clockState(now + DUE_IN_MINUTES, now, thresholds)}</span>;
});

const WardCount = memo(function WardCount({ network }: { network: WardNetwork }) {
  return <span data-testid="wards">{network.allUnits().length}</span>;
});

function Probe() {
  const { now, configuration, dispatch } = useWardFlow();
  const thresholds = useDueSoonThresholds();
  const network = useWardNetwork();
  const demo = WARD_SCENARIOS.find(
    (scenario) => scenarioWardNetwork(scenario).allUnits().length !== scenarioWardNetwork("standard").allUnits().length,
  );
  return (
    <div>
      <ClockLabel thresholds={thresholds} now={now} />
      <WardCount network={network} />
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: "SET_CONFIGURATION",
            role: "coordinator",
            now,
            payload: { ...configuration, dueSoonMinutes: DUE_IN_MINUTES - 30 },
          })
        }
      >
        shorten warning
      </button>
      <button
        type="button"
        onClick={() => demo && dispatch({ type: "SET_SCENARIO", role: "demo", now, scenario: demo })}
      >
        switch scenario
      </button>
      <span data-testid="demo-wards">{demo ? scenarioWardNetwork(demo).allUnits().length : "none"}</span>
    </div>
  );
}

describe("screens update when the inputs the compiler sees change", () => {
  it("a shorter warning in Settings recolours a due time", () => {
    expect(DEFAULT_DUE_SOON_THRESHOLDS.urgentMinutes).toBeLessThan(DUE_IN_MINUTES - 30);
    expect(DEFAULT_DUE_SOON_THRESHOLDS.soonMinutes).toBeGreaterThanOrEqual(DUE_IN_MINUTES);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Probe />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("clock")).toHaveTextContent("due");
    act(() => fireEvent.click(screen.getByRole("button", { name: "shorten warning" })));
    expect(screen.getByTestId("clock")).toHaveTextContent("clear");
  });

  it("a scenario switch brings that scenario's wards", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Probe />
      </WardFlowProvider>,
    );
    const standard = String(scenarioWardNetwork("standard").allUnits().length);
    const demo = screen.getByTestId("demo-wards").textContent;
    expect(demo).not.toBe("none");
    expect(screen.getByTestId("wards")).toHaveTextContent(standard);
    act(() => fireEvent.click(screen.getByRole("button", { name: "switch scenario" })));
    expect(screen.getByTestId("wards")).toHaveTextContent(demo!);
  });
});
