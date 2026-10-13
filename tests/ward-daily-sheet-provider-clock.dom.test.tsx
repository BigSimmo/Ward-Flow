import { cleanup, render, screen } from "@testing-library/react";
import { useContext } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { WardDailySheet } from "@/components/ward-management/board/ward-daily-sheet";
import { WARD_ADMISSIONS_ANCHOR, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import {
  WardFlowClockContext,
  WardFlowContext,
  WardFlowProvider,
} from "@/components/ward-management/ward-flow-provider";
import { allUnits } from "@/components/ward-management/ward-sites";

const unit = allUnits()[0];
afterEach(cleanup);
function Fixture({ now }: { now?: number }) {
  const flow = useContext(WardFlowContext)!;
  const admission = {
    ...wardAdmissions.find((item) => item.state === "occupied")!,
    unitId: unit.id,
    arrivedAt: -1200,
    expectedDischargeAt: -30,
  };
  return (
    <WardFlowContext.Provider value={{ ...flow, admissions: [admission] }}>
      <WardDailySheet unit={unit} now={now} />
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

  it.each([Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "uses the deterministic anchor for a %s provider clock",
    (clock) => {
      render(
        <WardFlowProvider initialNow={0}>
          <WardFlowClockContext.Provider value={clock}>
            <Fixture />
          </WardFlowClockContext.Provider>
        </WardFlowProvider>,
      );
      expect(screen.getAllByText("Day 2", { exact: true }).length).toBeGreaterThan(0);
    },
  );

  it("does not fall back to epoch 0 when now is omitted (AUD-04)", () => {
    // The old `now ?? 0` read this stay as day 1; the provider clock at the anchor makes it day 2.
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <Fixture />
      </WardFlowProvider>,
    );
    expect(screen.getAllByText("Day 2", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Day 1", { exact: true })).toBeNull();
  });

  it("prefers a finite explicit now prop, including zero, over the provider clock", () => {
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <Fixture now={0} />
      </WardFlowProvider>,
    );
    expect(screen.getAllByText("Day 1", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Day 2", { exact: true })).toBeNull();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    "ignores an invalid explicit now prop (%s) and uses the provider",
    (now) => {
      render(
        <WardFlowProvider initialNow={0}>
          <Fixture now={now} />
        </WardFlowProvider>,
      );
      expect(screen.getAllByText("Day 1", { exact: true }).length).toBeGreaterThan(0);
      expect(screen.queryByText("Day 2", { exact: true })).toBeNull();
    },
  );
});
