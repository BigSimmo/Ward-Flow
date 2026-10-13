import { cleanup, render, screen } from "@testing-library/react";
import { useContext } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { WardDailySheet } from "@/components/ward-management/board/ward-daily-sheet";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import {
  WardFlowClockContext,
  WardFlowContext,
  WardFlowProvider,
} from "@/components/ward-management/ward-flow-provider";
import { allUnits } from "@/components/ward-management/ward-sites";

const unit = allUnits()[0];
afterEach(cleanup);
function Fixture() {
  const flow = useContext(WardFlowContext)!;
  const admission = {
    ...wardAdmissions.find((item) => item.state === "occupied")!,
    unitId: unit.id,
    arrivedAt: -1200,
    expectedDischargeAt: -30,
  };
  return (
    <WardFlowContext.Provider value={{ ...flow, admissions: [admission] }}>
      <WardDailySheet unit={unit} />
    </WardFlowContext.Provider>
  );
}

describe("daily sheet provider clock boundaries", () => {
  it.each([0, -60])("uses finite provider Instant %s rather than the seed anchor", (now) => {
    render(
      <WardFlowProvider initialNow={now}>
        <Fixture />
      </WardFlowProvider>,
    );
    // Arrival was less than 1440 minutes ago: ordinal stay day 1, not anchor-derived day 2.
    expect(screen.getAllByText("Day 1", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Day 2", { exact: true })).toBeNull();
  });

  it("uses the deterministic anchor for a non-finite provider clock", () => {
    render(
      <WardFlowProvider initialNow={0}>
        <WardFlowClockContext.Provider value={Number.NaN}>
          <Fixture />
        </WardFlowClockContext.Provider>
      </WardFlowProvider>,
    );
    expect(screen.getAllByText("Day 2", { exact: true }).length).toBeGreaterThan(0);
  });
});
