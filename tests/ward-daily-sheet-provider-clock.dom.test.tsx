import { cleanup, render, screen } from "@testing-library/react";
import { useContext } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { WardDailySheet } from "@/components/ward-management/board/ward-daily-sheet";
import { WARD_ADMISSIONS_ANCHOR, wardAdmissions } from "@/components/ward-management/ward-admissions-seed";
import {
  WardFlowClockContext,
  WardFlowContext,
  WardFlowOverride,
  WardFlowProvider,
} from "@/components/ward-management/ward-flow-provider";
import { allUnits } from "@/components/ward-management/ward-sites";

const unit = allUnits()[0];
afterEach(cleanup);
// Root-cause fix 2.4 (Josh, 13 Nov 2026): the stay day is a Perth calendar day, so Instant 0 and the
// seed anchor (10:42 the same day) give the same Day. The expected date sits between them, so the
// "past the ward's expected date" line shows only when the sheet reads the anchor.
const PAST_EXPECTED = /past the ward.s expected date/;
function Fixture({ now }: { now?: number }) {
  const flow = useContext(WardFlowContext)!;
  const admission = {
    ...wardAdmissions.find((item) => item.state === "occupied")!,
    unitId: unit.id,
    arrivedAt: -1200,
    expectedDischargeAt: 300,
  };
  return (
    <WardFlowOverride value={{ ...flow, admissions: [admission] }}>
      <WardDailySheet unit={unit} now={now} />
    </WardFlowOverride>
  );
}

describe("daily sheet provider clock boundaries", () => {
  it.each([
    [0, "Day 2", "Day 1"],
    [-60, "Day 1", "Day 2"],
  ])("uses finite provider Instant %s rather than the seed anchor", (now, day, otherDay) => {
    render(
      <WardFlowProvider initialNow={now}>
        <Fixture />
      </WardFlowProvider>,
    );
    // Arrival was at 04:00 the day before Instant 0: Day 2 from midnight, Day 1 the hour before it.
    expect(screen.getAllByText(day, { exact: true }).length).toBeGreaterThan(0);
    expect(screen.queryByText(otherDay, { exact: true })).toBeNull();
    expect(screen.queryByText(PAST_EXPECTED)).toBeNull();
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
    expect(screen.getAllByText(PAST_EXPECTED).length).toBeGreaterThan(0);
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
      expect(screen.getAllByText(PAST_EXPECTED).length).toBeGreaterThan(0);
    },
  );

  it("does not fall back to epoch 0 when now is omitted (AUD-04)", () => {
    // The old `now ?? 0` read the clock as Instant 0; the provider clock at the anchor is past the
    // expected date, which Instant 0 is not.
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <Fixture />
      </WardFlowProvider>,
    );
    expect(screen.getAllByText("Day 2", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.queryByText("Day 1", { exact: true })).toBeNull();
    expect(screen.getAllByText(PAST_EXPECTED).length).toBeGreaterThan(0);
  });

  it("prefers a finite explicit now prop, including zero, over the provider clock", () => {
    render(
      <WardFlowProvider initialNow={WARD_ADMISSIONS_ANCHOR}>
        <Fixture now={0} />
      </WardFlowProvider>,
    );
    expect(screen.getAllByText("Day 2", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.queryByText(PAST_EXPECTED)).toBeNull();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    "ignores an invalid explicit now prop (%s) and uses the provider",
    (now) => {
      render(
        <WardFlowProvider initialNow={0}>
          <Fixture now={now} />
        </WardFlowProvider>,
      );
      expect(screen.getAllByText("Day 2", { exact: true }).length).toBeGreaterThan(0);
      expect(screen.queryByText(PAST_EXPECTED)).toBeNull();
    },
  );
});
