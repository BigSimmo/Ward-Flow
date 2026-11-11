// M69 (master audit list, 10 Nov 2026): devices returning after an outage spread their retries
// rather than all retrying at once. Synthetic timers only; no network.
import { afterEach, expect, it, vi } from "vitest";
import { startWardPolling } from "../src/components/ward-management/ward-shared-polling";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A small seeded generator so the fleet test is repeatable. */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

it("a backed-off retry is spread from three quarters to one and a quarter of its delay", async () => {
  vi.useFakeTimers();
  for (const [random, first, second] of [
    [0, 11_250, 45_000],
    [0.999_999, 18_750, 75_000],
  ] as const) {
    const refresh = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);
    const polling = startWardPolling({ refresh, visible: () => true, random: () => random });
    await vi.advanceTimersByTimeAsync(3_000); // healthy cadence is never spread
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(first - 1);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(second - 1);
    expect(refresh).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(3);
    polling.stop();
  }
});

it("uses Math.random by default, so real devices do not share one retry moment", async () => {
  vi.useFakeTimers();
  const spy = vi.spyOn(Math, "random").mockReturnValue(0);
  const refresh = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);
  const polling = startWardPolling({ refresh, visible: () => true });
  await vi.advanceTimersByTimeAsync(3_000 + 11_250);
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(spy).toHaveBeenCalled();
  polling.stop();
});

it("100 devices that fail together at shift change spread their next retries across seconds", async () => {
  vi.useFakeTimers();
  const random = seeded(20261110);
  const hits: number[] = [];
  const start = Date.now();
  const fleet = Array.from({ length: 100 }, () =>
    startWardPolling({
      // Every device's read fails at once (the backend is down); record when each retry lands.
      refresh: async () => {
        hits.push(Date.now() - start);
        return false;
      },
      visible: () => true,
      random,
    }),
  );
  await vi.advanceTimersByTimeAsync(3_000 + 18_750);
  fleet.forEach((device) => device.stop());
  const retries = hits.filter((at) => at > 3_000);
  expect(hits.filter((at) => at === 3_000)).toHaveLength(100);
  expect(retries).toHaveLength(100);
  const perSecond = new Map<number, number>();
  for (const at of retries) perSecond.set(Math.floor(at / 1000), (perSecond.get(Math.floor(at / 1000)) ?? 0) + 1);
  // Without the spread all 100 land in the same millisecond. With it, no second takes a third of them.
  expect(Math.max(...perSecond.values())).toBeLessThan(34);
  expect(Math.max(...retries) - Math.min(...retries)).toBeGreaterThan(5_000);
});
