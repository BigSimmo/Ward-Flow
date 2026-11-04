import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useOpenFilter } from "../src/components/ward-management/alerts/alerts-log-filters";
import type { QueueEntry } from "../src/components/ward-management/alerts/alerts-queue";

afterEach(() => localStorage.clear());
const figures = { act: 1, wait: 2, forecast: undefined, reminders: 0, notices: 0, snoozed: 0, yours: 1 };
it("defaults to role ownership while retaining authorised act-now rows and an All escape", () => {
  const { result } = renderHook(() => useOpenFilter(false, figures, { role: "ward", scopeKey: "synthetic-ward-desk" }));
  expect(result.current.filter).toBe("yours");
  expect(
    result.current.pick([
      { group: "act", mine: false },
      { group: "wait", mine: true },
      { group: "wait", mine: false },
    ] as QueueEntry[]),
  ).toHaveLength(2);
  act(() => result.current.setFilter("all"));
  expect(result.current.filter).toBe("all");
});
it("does not inherit another desk's saved filter", () => {
  const { result, rerender } = renderHook(({ scopeKey }) => useOpenFilter(false, figures, { role: "ward", scopeKey }), {
    initialProps: { scopeKey: "desk-a" },
  });
  act(() => result.current.setFilter("wait"));
  rerender({ scopeKey: "desk-b" });
  expect(result.current.filter).toBe("yours");
  rerender({ scopeKey: "desk-a" });
  expect(result.current.filter).toBe("wait");
});
