import { describe, expect, it } from "vitest";

import { networkTotals, networkWardRows } from "@/components/ward-management/capacity/capacity-derivations";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * L6 (mechanics and clock audit, 14 Nov 2026): "N still being made ready" counted wards closed to
 * admissions. Ready counts a closed ward as zero capacity, so its bed being cleaned is not one about
 * to be offered either. Synthetic seed data only.
 */
const seed = seedWardFlowState();
const holds = [...seed.movements, ...seed.referrals];
const open = seed.units.find((unit) => !unit.isClosed)!;
const closed = { ...open, isClosed: true };

function cleaning(id: string): BedRelease {
  return {
    ...seed.bedReleases[0]!,
    id,
    unitId: open.id,
    admissionId: `AD-${id}`,
    state: "discharged",
    preparing: true,
    blocker: null,
  };
}
const releases = [...seed.bedReleases, cleaning("WR-MCA-L6")];

describe("L6: being made ready leaves out a ward closed to admissions, as Ready does", () => {
  it("an open ward's bed being cleaned is counted", () => {
    const row = networkWardRows([open], NOW_ANCHOR, releases, seed.admissions, seed.leaveBeds, holds)[0]!;
    expect(row.pendingPreparation).toBeGreaterThan(0);
  });

  it("the same ward closed to admissions shows none, matching its Ready and its bed boxes", () => {
    const row = networkWardRows([closed], NOW_ANCHOR, releases, seed.admissions, seed.leaveBeds, holds)[0]!;
    expect(row.ready).toBe(0);
    expect(row.pendingPreparation).toBe(0);
    expect(bedStates(closed, seed.admissions, releases, [], holds).beingMadeReady).toBe(0);
    expect(networkTotals([row]).pendingPreparation).toBe(0);
  });
});
