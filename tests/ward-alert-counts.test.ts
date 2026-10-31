import { describe, expect, it } from "vitest";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { wardAlerts } from "@/components/ward-management/ward/ward-alert-counts";
import { buzzKeys } from "@/components/ward-management/ward/ward-buzz-keys";

// Notifications pass (30 Oct 2026): the ward's Notices button and its panel counted on their own.
// The panel still listed a buzz the ward had acknowledged, and called an arrived patient late, so
// the button and the list disagreed. Synthetic seed records only.
const UNIT = "ward-test";
const base = seedWardFlowState().movements[0]!;
let made = 0;

function inbound(overrides: Partial<Movement>): Movement {
  made += 1;
  return { ...base, id: `MV-TEST-${made}`, acceptedUnitId: UNIT, closure: undefined, ...overrides } as Movement;
}

const late: Partial<Movement> = {
  arrivalDetails: { ...base.arrivalDetails, estimatedArrivalAt: 100 },
} as Partial<Movement>;

describe("one count for the ward's Notices button and panel", () => {
  it("never calls an arrived patient late", () => {
    const onTheWay = inbound({ ...late, stage: "moving" });
    const arrived = inbound({ ...late, stage: "arrived" });
    const alerts = wardAlerts({ unitId: UNIT, now: 1000, movements: [onTheWay, arrived], notices: [] });
    expect(alerts.overdueArrivals).toEqual([onTheWay]);
  });

  it("drops an acknowledged buzz from the list and the total alike", () => {
    const requests = [
      { unitId: UNIT, at: 10, byRole: "coordinator" },
      { unitId: UNIT, at: 20, byRole: "coordinator", urgent: true },
    ];
    const [first] = buzzKeys(requests);
    const before = wardAlerts({ unitId: UNIT, now: 30, movements: [], notices: [], refreshRequests: requests });
    const after = wardAlerts({
      unitId: UNIT,
      now: 30,
      movements: [],
      notices: [],
      refreshRequests: requests,
      dismissedBuzzKeys: [first!],
    });
    expect(before.buzzes).toHaveLength(2);
    expect(after.buzzes).toHaveLength(1);
    expect(after.counts.total).toBe(before.counts.total - 1);
  });

  it("totals exactly the parts it lists", () => {
    const alerts = wardAlerts({
      unitId: UNIT,
      now: 1000,
      movements: [inbound({ ...late, stage: "moving" })],
      notices: [],
      refreshRequests: [{ unitId: UNIT, at: 10, byRole: "coordinator" }],
      censusOverdue: true,
    });
    const { act, check, coordinator, total } = alerts.counts;
    expect(total).toBe(act + check + coordinator);
    expect(coordinator).toBe(alerts.buzzes.length + alerts.counts.unreadNotices);
    expect(act).toBe(1 + alerts.overdueArrivals.length + alerts.missingClearances.length);
  });
});
