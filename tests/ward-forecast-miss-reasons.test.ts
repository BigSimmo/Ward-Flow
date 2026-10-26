import { describe, expect, it } from "vitest";

import { forecastTrackRecord, type ForecastHistoryEntry } from "@/components/ward-management/forecast/forecast-history";
import {
  latestMissReasons,
  missCandidates,
  missReasonSummary,
  parseForecastMissReasons,
  recordForecastMissReason,
  type ForecastMissReasonEntry,
} from "@/components/ward-management/forecast/forecast-miss-reasons";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

const DAY = 1440;

function entry(day: number, nowGap: number, likely: number): ForecastHistoryEntry {
  return { day, at: day * DAY + 600, nowGap, tomorrow: { low: likely - 1, likely, high: likely + 1 } };
}

// Day 1 matches its forecast; days 2 and 3 differ from it.
const HISTORY = [entry(0, 0, 4), entry(1, 4, 6), entry(2, 9, 2), entry(3, 5, 5)];

describe("forecast miss reasons", () => {
  it("counts every differing day as unexplained until a person records a reason", () => {
    const record = forecastTrackRecord(HISTORY);
    expect(missReasonSummary(record.days, [])).toEqual({ missed: 2, known: [], unexplained: 2 });
  });

  it("separates known causes from unexplained, and the latest choice for a day wins", () => {
    const record = forecastTrackRecord(HISTORY);
    let entries: ForecastMissReasonEntry[] = [];
    entries = recordForecastMissReason(entries, { day: 2, reason: "other", by: "coordinator", at: 3000 });
    entries = recordForecastMissReason(entries, { day: 2, reason: "transfer_cancelled", by: "coordinator", at: 3010 });
    expect(latestMissReasons(entries).get(2)?.reason).toBe("transfer_cancelled");
    expect(missReasonSummary(record.days, entries)).toEqual({
      missed: 2,
      known: [{ reason: "transfer_cancelled", count: 1 }],
      unexplained: 1,
    });
  });

  it("ignores a reason recorded for a day that matched its forecast", () => {
    const record = forecastTrackRecord(HISTORY);
    const entries: ForecastMissReasonEntry[] = [{ day: 1, reason: "other", by: "coordinator", at: 1 }];
    expect(missReasonSummary(record.days, entries).unexplained).toBe(2);
  });

  it("restores only closed-list reasons with a role, and nothing typed", () => {
    const raw = JSON.stringify([
      { day: 2, reason: "capacity_changed", by: "coordinator", at: 5 },
      { day: 3, reason: "typed words", by: "coordinator", at: 5 },
      { day: 3, reason: "other", by: "someone", at: 5 },
      { day: 3, reason: "other", by: "coordinator", at: 5, note: "free text" },
    ]);
    expect(parseForecastMissReasons(raw)).toEqual([{ day: 2, reason: "capacity_changed", by: "coordinator", at: 5 }]);
    expect(parseForecastMissReasons("not json")).toEqual([]);
  });

  it("lists recorded events in the span as candidates, without choosing one", () => {
    const state = seedWardFlowState();
    const cancelled = state.movements.find((movement) => movement.closure?.outcome === "did_not_proceed")!;
    const candidates = missCandidates(
      { forecastAt: cancelled.closure!.at - 10, actualAt: cancelled.closure!.at + 10 },
      state.movements,
      state.admissions,
      () => "Name, Ward",
    );
    expect(candidates).toContainEqual(
      expect.objectContaining({ fits: "transfer_cancelled", source: { kind: "movement", id: cancelled.id } }),
    );
    expect(
      missCandidates({ forecastAt: -99999, actualAt: -99998 }, state.movements, state.admissions, () => ""),
    ).toEqual([]);
  });

  // W-5 (fresh audit 26 Oct 2026): a moved discharge date names the person and ward, never the id.
  it("names the person and ward for a moved discharge date, not the admission id", () => {
    const state = seedWardFlowState();
    const moved = { ...state.admissions[0]!, dischargeDateMoves: 1, dischargeDateSetAt: 50 };
    const [candidate] = missCandidates({ forecastAt: 40, actualAt: 60 }, [], [moved], () => "Synthetic Person, Ward A");
    expect(candidate?.label).toBe("Discharge date moved, Synthetic Person, Ward A");
    expect(candidate?.label).not.toContain(moved.id);
  });
});
