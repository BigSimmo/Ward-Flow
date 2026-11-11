import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SharedPacing } from "@/components/ward-management/ward-shared-pacing";

// M53 review fix: a 429 resend that falls due while a read is in flight must not be lost.
describe("SharedPacing.holdFor", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const limited = () => new Response(null, { status: 429, headers: { "retry-after": "2" } });

  it("sends once Retry-After has passed when nothing is in flight", () => {
    const pacing = new SharedPacing(() => 0);
    const run = vi.fn();
    pacing.holdFor(limited(), run, () => false);
    expect(pacing.limited).toBe(true);
    vi.advanceTimersByTime(1_999);
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(pacing.limited).toBe(false);
  });

  it("waits for a read in flight to finish, then still sends", () => {
    const pacing = new SharedPacing(() => 0);
    const run = vi.fn();
    let busy = true;
    pacing.holdFor(limited(), run, () => busy);
    vi.advanceTimersByTime(2_000);
    expect(run).not.toHaveBeenCalled();
    expect(pacing.limited).toBe(false);
    vi.advanceTimersByTime(1_000);
    expect(run).not.toHaveBeenCalled();
    busy = false;
    vi.advanceTimersByTime(250);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("stops a waiting resend when the client stops", () => {
    const pacing = new SharedPacing(() => 0);
    const run = vi.fn();
    pacing.holdFor(limited(), run, () => true);
    vi.advanceTimersByTime(2_500);
    pacing.stop();
    vi.advanceTimersByTime(5_000);
    expect(run).not.toHaveBeenCalled();
  });
});
