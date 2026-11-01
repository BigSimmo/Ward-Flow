import { describe, expect, it } from "vitest";
import { promiseChaseTimes } from "@/components/ward-management/handover/handover-open-promises";

/*
 * CodeRabbit (#1246): "Ward promises to chase" lists by when to ring next, so an overdue promise
 * with an earlier callback sorts by that callback, while its "since" time stays the promised time.
 * Synthetic instants (minutes) only.
 */
const by = "Synthetic coordinator";
const promised = (promisedFor: number, callbackAt?: number) => ({
  step: { step: "promised" as const, at: 0, by },
  promisedFor,
  nextCallbackAt: callbackAt === undefined ? undefined : { at: callbackAt, recordedAt: 0, by },
  entries: 1,
});

describe("promiseChaseTimes", () => {
  it("sorts an overdue promise by its earlier callback and keeps the promised time on show", () => {
    const times = promiseChaseTimes(promised(600, 540), 660);
    expect(times.overdue).toBe(true);
    expect(times.sortAt).toBe(540);
    expect(times.shownAt).toBe(600);
    expect(times.isCallback).toBe(false);
  });

  it("sorts an overdue promise by the promised time when the callback is later", () => {
    const times = promiseChaseTimes(promised(600, 700), 660);
    expect(times.sortAt).toBe(600);
    expect(times.shownAt).toBe(600);
  });

  it("shows and sorts an open promise by the earlier time, marking a callback as ring back", () => {
    const times = promiseChaseTimes(promised(700, 680), 660);
    expect(times.overdue).toBe(false);
    expect(times.sortAt).toBe(680);
    expect(times.shownAt).toBe(680);
    expect(times.isCallback).toBe(true);
  });
});
