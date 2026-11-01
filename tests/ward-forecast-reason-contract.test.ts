import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { forecastHistoryInput } from "../backend/ward-flow/forecast-history.mjs";
import {
  FORECAST_MISS_REASONS,
  parseForecastMissReasons,
} from "@/components/ward-management/forecast/forecast-miss-reasons";

describe("forecast reason contract across browser, API and database", () => {
  it("keeps every database reason available in the browser and accepted by both input boundaries", () => {
    const sql = readFileSync("backend/ward-flow/migrations/016-forecast-history.sql", "utf8");
    const constraint = sql.match(/reason\s+text\s+NOT\s+NULL\s+CHECK\s*\(reason\s+IN\s*\(([^)]+)\)\)/u);
    expect(constraint, "the database's closed-list reason constraint must be found").not.toBeNull();
    const databaseReasons = [...constraint![1].matchAll(/'([^']+)'/gu)].map((match) => match[1]);
    expect(databaseReasons.length).toBeGreaterThan(0);
    expect(new Set(databaseReasons).size).toBe(databaseReasons.length);
    expect([...databaseReasons].sort()).toEqual([...FORECAST_MISS_REASONS].sort());
    for (const code of databaseReasons) {
      const reason = { day: 2, reason: code, by: "coordinator", at: 3000 };
      expect(forecastHistoryInput({ generation: 0, reason })?.reason).toEqual(reason);
      expect(parseForecastMissReasons(JSON.stringify([reason]))).toEqual([reason]);
    }
  });

  it("refuses an unlisted reason at both runtime input boundaries", () => {
    const reason = { day: 2, reason: "synthetic_unlisted_reason", by: "coordinator", at: 3000 };
    expect(forecastHistoryInput({ generation: 0, reason })).toBeNull();
    expect(parseForecastMissReasons(JSON.stringify([reason]))).toEqual([]);
  });
});
