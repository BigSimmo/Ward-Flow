// M120 (master audit list, 10 Nov 2026): forecasts stay honest. A fixed synthetic history checks the
// track-record arithmetic by hand; a read-through of every forecast surface finds no "will get"
// wording; D-108's "Not a prediction" stays on Home's tomorrow line. Gaps found are todos for Josh.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  forecastTrackRecord,
  type ForecastHistoryEntry,
} from "../src/components/ward-management/forecast/forecast-history";

const entry = (day: number, nowGap: number, low: number, likely: number, high: number): ForecastHistoryEntry => ({
  day,
  at: day * 1440 + 480,
  nowGap,
  tomorrow: { low, likely, high },
});

describe("M120 forecast track record arithmetic (fixed synthetic history)", () => {
  // Day 1 forecasts day 2 as 2 to 6 (likely 4). Day 2's gap is 5: inside, miss +1.
  // Day 2 forecasts day 3 as 1 to 5 (likely 3). Day 3's gap is 7: outside, miss +4.
  // Day 4 is missing, so day 5 is not scored (no forecast the day before).
  // Day 5 forecasts day 6 as 0 to 4 (likely 2). Day 6's gap is 4, on the top edge: inside, miss +2.
  // Day 6 forecasts day 7 as 3 to 7 (likely 5). Day 7's gap is 2: outside, miss -3 (counted as 3).
  const history = [
    entry(3, 7, 4, 6, 8),
    entry(1, 3, 2, 4, 6),
    entry(2, 5, 1, 3, 5),
    entry(5, 0, 0, 2, 4),
    entry(6, 4, 3, 5, 7),
    entry(7, 2, 0, 0, 0),
  ];
  const record = forecastTrackRecord(history);

  it("scores only days whose previous day holds a forecast, in day order", () => {
    expect(record.days.map((day) => day.day)).toEqual([2, 3, 6, 7]);
  });
  it("counts a day on the range's edge as inside, and every other day exactly", () => {
    expect(record.days.map((day) => day.inRange)).toEqual([true, false, true, false]);
    expect(record.inRange).toBe(2);
  });
  it("signs each miss as actual minus likely and averages their sizes to one decimal", () => {
    expect(record.days.map((day) => day.miss)).toEqual([1, 4, 2, -3]);
    // (1 + 4 + 2 + 3) / 4 = 2.5
    expect(record.averageMiss).toBe(2.5);
  });
  it("is empty, with no average, until two consecutive days exist", () => {
    expect(forecastTrackRecord([entry(1, 3, 2, 4, 6)])).toEqual({ days: [], inRange: 0, averageMiss: null });
    expect(forecastTrackRecord([entry(1, 3, 2, 4, 6), entry(3, 3, 2, 4, 6)]).averageMiss).toBeNull();
  });
});

const root = path.resolve(__dirname, "..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const SURFACES = [
  "src/components/ward-management/forecast/ed-access-risk-card.tsx",
  "src/components/ward-management/forecast/ed-access-risk.ts",
  "src/components/ward-management/forecast/forecast-alerts-group.tsx",
  "src/components/ward-management/forecast/forecast-alerts.ts",
  "src/components/ward-management/forecast/forecast-brief.ts",
  "src/components/ward-management/forecast/forecast-brief-panel.tsx",
  "src/components/ward-management/forecast/forecast-track-record.tsx",
  "src/components/ward-management/bed-meeting/bed-meeting-tv.tsx",
  "src/components/ward-management/coordinator/planned-list.tsx",
];

describe("M120 forecast wording read-through", () => {
  it.each(SURFACES)("%s promises no bed to anyone", (file) => {
    // Strings only: comments may quote the forbidden words when explaining the rule.
    const strings = read(file).match(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g) ?? [];
    const promise =
      /\bwill (get|be given|be admitted|be placed|receive)\b|\bguarantee|\bpromised (a |the )?bed|\bbed (is )?secured\b|\bconfirmed bed\b/i;
    expect(strings.filter((text) => promise.test(text))).toEqual([]);
  });
  it("D-108: Home's tomorrow line still says Not a prediction", () => {
    expect(read("src/components/ward-management/coordinator/planned-list.tsx")).toContain("Not a prediction.");
  });
  it.todo(
    "DEFECT M120 (Josh): the ED 'May pass' card states no method or limits, and lists named people with UMRN, time left and a Find a bed button (ed-access-risk-card.tsx)",
  );
  it.todo("DEFECT M120 (Josh): the bed meeting TV 'Tomorrow' column and brief state no method or limits");
  it.todo("DEFECT M120 (Josh): forecast alerts ('May pass the ED access target') state no method or limits");
});
