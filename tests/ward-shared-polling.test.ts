import { afterEach, expect, it, vi } from "vitest";
import { startWardPolling } from "../src/components/ward-management/ward-shared-polling";

afterEach(() => vi.useRealTimers());
it("backs failed reads off to15and60seconds, then restores three seconds after success", async () => {
  vi.useFakeTimers();
  const refresh = vi
    .fn<() => Promise<boolean>>()
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(false)
    .mockResolvedValue(true);
  const polling = startWardPolling({ refresh, visible: () => true });
  await vi.advanceTimersByTimeAsync(3_000);
  expect(refresh).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(14_999);
  expect(refresh).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  expect(refresh).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(refresh).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(3_000);
  expect(refresh).toHaveBeenCalledTimes(4);
  polling.stop();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(refresh).toHaveBeenCalledTimes(4);
});
it("does not poll hidden tabs; a successful manual read resets an outage delay", async () => {
  vi.useFakeTimers();
  let visible = false;
  const refresh = vi.fn<() => Promise<boolean>>().mockResolvedValue(false);
  const polling = startWardPolling({ refresh, visible: () => visible });
  await vi.advanceTimersByTimeAsync(60_000);
  expect(refresh).not.toHaveBeenCalled();
  visible = true;
  await vi.advanceTimersByTimeAsync(3_000);
  expect(refresh).toHaveBeenCalledTimes(1);
  polling.refreshed();
  await vi.advanceTimersByTimeAsync(3_000);
  expect(refresh).toHaveBeenCalledTimes(2);
  polling.stop();
});
// SD-04 (audit, 5 Nov 2026): a read skipped because a save was in flight is not a failed read, so a
// slow save that then fails does not leave the board unread for a minute.
it("keeps the three-second cadence when reads are skipped during a save", async () => {
  vi.useFakeTimers();
  const refresh = vi
    .fn<() => Promise<boolean | "skipped">>()
    .mockResolvedValueOnce("skipped")
    .mockResolvedValueOnce("skipped")
    .mockResolvedValueOnce("skipped")
    .mockResolvedValue(true);
  const polling = startWardPolling({ refresh, visible: () => true });
  await vi.advanceTimersByTimeAsync(9_000);
  expect(refresh).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(3_000);
  expect(refresh).toHaveBeenCalledTimes(4);
  polling.stop();
});
it("a skipped read neither clears nor deepens an outage delay", async () => {
  vi.useFakeTimers();
  const refresh = vi
    .fn<() => Promise<boolean | "skipped">>()
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce("skipped")
    .mockResolvedValue(true);
  const polling = startWardPolling({ refresh, visible: () => true });
  await vi.advanceTimersByTimeAsync(3_000);
  await vi.advanceTimersByTimeAsync(15_000);
  expect(refresh).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(14_999);
  expect(refresh).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(refresh).toHaveBeenCalledTimes(3);
  polling.stop();
});
