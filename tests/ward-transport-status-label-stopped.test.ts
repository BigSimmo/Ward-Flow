// tests/ward-transport-status-label-stopped.test.ts
import { describe, expect, it } from "vitest";

import { transportStatusLabel } from "../src/components/ward-management/ward-derivations";
import type { TransportJob } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

function transportJob(overrides: Partial<TransportJob> = {}): TransportJob {
  return {
    id: "TR-TEST",
    provider: "Patient transport service",
    escortRequired: true,
    ...overrides,
  };
}

/**
 * `STOP_TRANSPORT` (WLQ-38, owner 2026-09-15 — after the patient has already been collected)
 * writes BOTH `cancelledAt` and `stoppedAt` on the same job, by design: `cancelledAt` is the
 * general "this job is over" signal every reader already understood, and `stoppedAt` (plus
 * `stoppedBy`/`stopReason`) is `STOP_TRANSPORT`'s own more specific record — see
 * `TransportJob.stoppedAt`'s own doc comment in `ward-model.ts`. Before this fix,
 * `transportStatusLabel` checked `cancelledAt` first and had no branch for `stoppedAt` at all, so
 * a job stopped mid-journey — after a real vehicle had already collected the patient — read
 * exactly the same on screen as a job cancelled before it ever left the sending ward. Those are
 * different situations for a coordinator reading the board: one never happened, the other did and
 * was interrupted.
 */
describe("transportStatusLabel — a stopped job reads as stopped, not cancelled", () => {
  it("labels a job with stoppedAt set 'Stopped after collection', not 'Cancelled'", () => {
    const stopped = transportJob({
      acceptedAt: NOW_ANCHOR - 40,
      enRouteAt: NOW_ANCHOR - 30,
      collectedAt: NOW_ANCHOR - 20,
      // Both set together, exactly as STOP_TRANSPORT writes them.
      cancelledAt: NOW_ANCHOR - 10,
      stoppedAt: NOW_ANCHOR - 10,
      stoppedBy: "coordinator",
      stopReason: "patient_declined_transport",
    });
    expect(transportStatusLabel(stopped)).toBe("Stopped after collection");
  });

  it("still labels a cancelled-but-never-stopped job 'Cancelled' — cancelledAt alone is unaffected", () => {
    const cancelledOnly = transportJob({
      acceptedAt: NOW_ANCHOR - 20,
      cancelledAt: NOW_ANCHOR - 5,
    });
    expect(transportStatusLabel(cancelledOnly)).toBe("Cancelled");
  });

  it("a cancelled job that also progressed further still reads Cancelled when it was never stopped", () => {
    // Mirrors the existing transportLeg precedence test in tests/ward-derivations.test.ts:
    // cancelledAt wins over every progress stamp when stoppedAt is absent.
    const cancelledAfterProgress = transportJob({
      acceptedAt: NOW_ANCHOR - 40,
      enRouteAt: NOW_ANCHOR - 30,
      collectedAt: NOW_ANCHOR - 20,
      cancelledAt: NOW_ANCHOR - 5,
    });
    expect(transportStatusLabel(cancelledAfterProgress)).toBe("Cancelled");
  });
});
