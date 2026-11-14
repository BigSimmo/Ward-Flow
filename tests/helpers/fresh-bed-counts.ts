import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Bed counts go stale after the signed hour on every desk (D-214, 14 Nov 2026). A journey test that
 * drives the reducer past that hour confirms every ward's count as the journey starts, so its pulls
 * test the journey rather than the age of the seed's counts.
 */
export function withFreshBedCounts<T extends Pick<WardFlowState, "units">>(state: T, at = NOW_ANCHOR): T {
  return {
    ...state,
    units: state.units.map((unit) => ({ ...unit, allocatable: { ...unit.allocatable, confirmedAt: at } })),
  };
}
