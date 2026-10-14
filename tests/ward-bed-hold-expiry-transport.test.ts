// Audit follow-up, 13 October 2026: `isBedHoldExpired` read `movement.transport.stage`, a field
// `TransportJob` does not have, so a bed held for a patient already on the road still read as
// expired. Transport progress is recorded as timestamps (`enRouteAt`, `collectedAt`, `arrivedAt`).
import { describe, expect, it } from "vitest";

import type { Movement, TransportJob } from "@/components/ward-management/ward-model";
import { BED_HOLD_EXPIRY_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isBedHoldExpired } from "@/components/ward-management/ward-referrals";

const BASE = seedWardFlowState().movements[0];
const PULLED_AT = 1000;
const LATE = PULLED_AT + BED_HOLD_EXPIRY_MINUTES + 1;

function heldMovement(transport?: Partial<TransportJob>): Movement {
  return {
    ...BASE,
    stage: "pulled",
    acceptedAt: PULLED_AT,
    transport:
      transport === undefined
        ? undefined
        : ({ id: "T-1", provider: "Ambulance service", escortRequired: false, ...transport } as TransportJob),
  } as Movement;
}

describe("isBedHoldExpired reads transport progress from its timestamps", () => {
  it("expires a hold past the threshold with no transport booked (control)", () => {
    expect(isBedHoldExpired(heldMovement(), LATE)).toBe(true);
  });

  it("expires a hold whose transport is booked but not yet moving (control)", () => {
    expect(isBedHoldExpired(heldMovement({ acceptedAt: PULLED_AT }), LATE)).toBe(true);
  });

  it.each([
    ["en route", { enRouteAt: PULLED_AT + 10 }],
    ["collected", { enRouteAt: PULLED_AT + 10, collectedAt: PULLED_AT + 20 }],
    ["arrived", { enRouteAt: PULLED_AT + 10, collectedAt: PULLED_AT + 20, arrivedAt: PULLED_AT + 30 }],
  ])("does not expire a hold while the patient is %s", (_label, transport) => {
    expect(isBedHoldExpired(heldMovement(transport), LATE)).toBe(false);
  });

  it("still expires a hold whose transport was cancelled", () => {
    expect(isBedHoldExpired(heldMovement({ enRouteAt: PULLED_AT + 10, cancelledAt: PULLED_AT + 15 }), LATE)).toBe(true);
  });

  it("does not expire before the threshold", () => {
    expect(isBedHoldExpired(heldMovement(), PULLED_AT + 1)).toBe(false);
  });
});
