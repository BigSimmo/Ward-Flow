import { describe, expect, it } from "vitest";
import {
  FORECAST_PENDING_LIMIT,
  forecastPendingKey,
  parsePendingForecastReason,
  readPendingForecastReasons,
  removePendingForecastReason,
  writePendingForecastReason,
  type ForecastPendingScope,
  type PendingForecastReason,
} from "@/components/ward-management/forecast/forecast-pending-reasons";
import { forecastHistoryResponse } from "@/components/ward-management/forecast/forecast-shared-types";

const scope: ForecastPendingScope = {
  actorId: "synthetic-actor",
  scopeKey: "a".repeat(64),
  scenario: "baseline",
  generation: 0,
};
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const draft = (value = 1): PendingForecastReason => ({
  operationId: id(value),
  expectedDayVersion: 3,
  entry: { day: 0, reason: "capacity_changed", by: "coordinator", at: 642 },
  status: "queued",
});
function storage() {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

describe("bounded forecast pending journal", () => {
  it("retains the original operation and basis while status changes", () => {
    const store = storage();
    expect(writePendingForecastReason(store, scope, draft())).toBe(true);
    expect(writePendingForecastReason(store, scope, { ...draft(), status: "failed" })).toBe(true);
    expect(readPendingForecastReasons(store, scope)).toEqual([{ ...draft(), status: "failed" }]);
  });
  it("never admits typed text, unknown fields or invalid operation identifiers", () => {
    for (const bad of [
      { ...draft(), note: "synthetic unstructured text" },
      { ...draft(), operationId: "not-an-operation" },
      { ...draft(), entry: { ...draft().entry, note: "synthetic unstructured text" } },
      { ...draft(), expectedDayVersion: -1 },
    ])
      expect(parsePendingForecastReason(JSON.stringify(bad))).toBeNull();
  });
  it("isolates actors, desks and world generations", () => {
    const store = storage();
    writePendingForecastReason(store, scope, draft());
    for (const changed of [
      { ...scope, actorId: "different-actor" },
      { ...scope, scopeKey: "b".repeat(64) },
      { ...scope, generation: 1 },
      { ...scope, scenario: "another-world" },
    ])
      expect(readPendingForecastReasons(store, changed)).toEqual([]);
  });
  it("keeps separate tab operations and retires only the matching receipt", () => {
    const store = storage();
    writePendingForecastReason(store, scope, draft(1));
    writePendingForecastReason(store, scope, draft(2));
    removePendingForecastReason(store, scope, id(1));
    expect(readPendingForecastReasons(store, scope)).toEqual([draft(2)]);
    expect(store.getItem(forecastPendingKey(scope, id(2)))).not.toBeNull();
  });
  it("refuses additional drafts at the bound without evicting unresolved actions", () => {
    const store = storage();
    for (let index = 1; index <= FORECAST_PENDING_LIMIT; index += 1)
      expect(writePendingForecastReason(store, scope, draft(index))).toBe(true);
    expect(writePendingForecastReason(store, { ...scope, generation: 1 }, draft(100))).toBe(false);
    expect(readPendingForecastReasons(store, scope)).toHaveLength(FORECAST_PENDING_LIMIT);
  });
  it("preserves recognised conflict bodies and rejects unknown failures", () => {
    const conflict = { code: "forecast-conflict", outcome: "conflict" };
    expect(forecastHistoryResponse({ ok: false, status: 409 }, conflict)).toBe(conflict);
    expect(() => forecastHistoryResponse({ ok: false, status: 500 }, conflict)).toThrow();
    expect(() => forecastHistoryResponse({ ok: false, status: 409 }, { code: "unrecognised" })).toThrow();
  });
});
