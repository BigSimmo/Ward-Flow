// AUD-05 (13 Oct 2026): the bed-hold expiry alarm read a `transport.stage` field that
// `TransportJob` does not have, so a patient already on the road still raised "hold expired".
// The rule now reads the real timestamps (`enRouteAt`, `arrivedAt`) and ignores a cancelled job.
// Synthetic data only.
import { describe, expect, it } from "vitest";

import type { Movement, TransportJob } from "@/components/ward-management/ward-model";
import {
  BED_HOLD_EXPIRY_MINUTES,
  bedHoldExpiryAlert,
  isBedHoldExpired,
} from "@/components/ward-management/ward-referrals";

const NOW = 1_000;
const HELD_SINCE = NOW - BED_HOLD_EXPIRY_MINUTES - 5;

function movement(transport?: Partial<TransportJob>, stage: Movement["stage"] = "pulled"): Movement {
  return {
    id: "WF-AUD05",
    stage,
    acceptedAt: HELD_SINCE,
    referredUnitIds: [],
    declines: [],
    transport: transport
      ? ({ id: "TJ-AUD05", provider: "Patient transport service", escortRequired: false, ...transport } as TransportJob)
      : undefined,
  } as unknown as Movement;
}

describe("isBedHoldExpired: in-transit patients (AUD-05)", () => {
  it("alarms for a stale hold with no transport, or transport only booked", () => {
    expect(isBedHoldExpired(movement(), NOW)).toBe(true);
    expect(isBedHoldExpired(movement({}), NOW)).toBe(true);
    expect(isBedHoldExpired(movement({}, "handover_ready"), NOW)).toBe(true);
  });

  it.each(["pulled", "handover_ready"] as const)("does not alarm once transport is en route (%s)", (stage) => {
    const m = movement({ enRouteAt: NOW - 20 }, stage);
    expect(isBedHoldExpired(m, NOW)).toBe(false);
    expect(bedHoldExpiryAlert(m, NOW)).toMatchObject({ expired: false });
    expect(bedHoldExpiryAlert(m, NOW).message).toBeUndefined();
  });

  it("does not alarm once the patient has arrived", () => {
    expect(isBedHoldExpired(movement({ enRouteAt: NOW - 40, collectedAt: NOW - 30, arrivedAt: NOW - 5 }), NOW)).toBe(
      false,
    );
    expect(isBedHoldExpired(movement({ arrivedAt: NOW - 5 }), NOW)).toBe(false);
  });

  it("treats an en-route timestamp of zero as en route, not as absent", () => {
    expect(isBedHoldExpired(movement({ enRouteAt: 0 }), NOW)).toBe(false);
  });

  it("still alarms when the en-route job was cancelled — nobody is on the road", () => {
    const m = movement({ enRouteAt: NOW - 40, cancelledAt: NOW - 30 });
    expect(isBedHoldExpired(m, NOW)).toBe(true);
    expect(bedHoldExpiryAlert(m, NOW).expired).toBe(true);
  });

  it("still alarms when the job was cancelled at epoch zero", () => {
    const m = movement({ enRouteAt: 0, cancelledAt: 0 });
    expect(isBedHoldExpired(m, NOW)).toBe(true);
    expect(bedHoldExpiryAlert(m, NOW).expired).toBe(true);
  });

  it("keeps the threshold boundary for a hold without transport", () => {
    const fresh = { ...movement(), acceptedAt: NOW - BED_HOLD_EXPIRY_MINUTES + 1 } as Movement;
    const atLimit = { ...movement(), acceptedAt: NOW - BED_HOLD_EXPIRY_MINUTES } as Movement;
    expect(isBedHoldExpired(fresh, NOW)).toBe(false);
    expect(isBedHoldExpired(atLimit, NOW)).toBe(true);
  });
});
