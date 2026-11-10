import { describe, expect, it } from "vitest";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { transportDelay } from "@/components/ward-management/transport/transport-delay";
import { isOfficerJob } from "@/components/ward-management/officer/officer-jobs";
import type { Movement } from "@/components/ward-management/ward-model";
import {
  LATE_ARRIVAL_GRACE_MINUTES,
  TRANSPORT_ACCEPT_DELAY_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Feature 25: the Delayed tag on the transport list. Synthetic records only. */
const now = 1000;

function withJob(transport: Partial<NonNullable<Movement["transport"]>>, extra: Partial<Movement> = {}): Movement {
  const base = seedWardFlowState().movements[0]!;
  return {
    ...base,
    closure: undefined,
    arrivalDetails: undefined,
    transport: { id: "TR-T", provider: "Patient transport service", escortRequired: false, ...transport },
    ...extra,
  } as Movement;
}

describe("transportDelay", () => {
  it("flags a job not accepted after the operational time, and not before", () => {
    expect(transportDelay(withJob({ bookedAt: now - TRANSPORT_ACCEPT_DELAY_MINUTES - 1 }), now)).toBe("not_accepted");
    expect(transportDelay(withJob({ bookedAt: now - TRANSPORT_ACCEPT_DELAY_MINUTES }), now)).toBeNull();
    expect(
      transportDelay(withJob({ bookedAt: now - 120, acceptedAt: now - 100 }), now),
      "accepted in the end",
    ).toBeNull();
  });

  it("flags a job past its ETA by more than the existing late grace", () => {
    const eta = now - LATE_ARRIVAL_GRACE_MINUTES - 1;
    expect(transportDelay(withJob({ estimatedAt: eta, acceptedAt: now - 200 }), now)).toBe("past_eta");
    expect(transportDelay(withJob({ estimatedAt: now - 1, acceptedAt: now - 200 }), now)).toBeNull();
  });

  it("never flags an arrived, cancelled or untimed job", () => {
    expect(transportDelay(withJob({ bookedAt: now - 500, arrivedAt: now - 1 }), now)).toBeNull();
    expect(transportDelay(withJob({ bookedAt: now - 500, cancelledAt: now - 1 }), now)).toBeNull();
    expect(transportDelay(withJob({}), now)).toBeNull();
  });

  it("the demo seed shows at least one delayed current transfer", () => {
    const delayed = seedWardFlowState()
      .movements.filter(isOfficerJob)
      .filter((movement) => transportDelay(movement, NOW_ANCHOR) !== null);
    expect(delayed.length).toBeGreaterThan(0);
  });
});
