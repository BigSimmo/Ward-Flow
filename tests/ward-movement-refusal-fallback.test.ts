import { describe, expect, it } from "vitest";
import type { Rejection } from "@/components/ward-management/ward-model";
import { newWardMovementRefusal } from "@/components/ward-management/ward/use-ward-command-completion";

const refusal = (id: string, attempted: string): Rejection =>
  ({ id, at: 0, attempted, movementId: `M-${id}`, reason: `refused ${id}` }) as Rejection;

describe("Ward flow list refusal fallback (review: gitar)", () => {
  it("shows only an accept, pull or release refusal raised since the last read", () => {
    const list = [refusal("1", "PULL_PATIENT"), refusal("2", "ACCEPT_IN_PRINCIPLE"), refusal("3", "PLACE_IN_BED")];
    expect(newWardMovementRefusal(list, 1)?.id).toBe("2");
  });

  it("ignores a Bed board, decline or other desk refusal", () => {
    const list = [refusal("1", "PLACE_IN_BED"), refusal("2", "DECLINE_REFERRAL"), refusal("3", "RELEASE_PULL")];
    expect(newWardMovementRefusal(list, 0)).toBeUndefined();
  });

  it("never revives a refusal already read", () => {
    const list = [refusal("1", "RELEASE_HELD_BED"), refusal("2", "PLACE_IN_BED")];
    expect(newWardMovementRefusal(list, 1)).toBeUndefined();
    expect(newWardMovementRefusal(list, 0)?.id).toBe("1");
  });
});
