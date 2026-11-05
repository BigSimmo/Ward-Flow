import type { TourFacts, TourRole, TourStep } from "./ward-tour-steps";
import type { WardTourDevice } from "./ward-tour-device";

/**
 * LEAD TO WIRE: the optional steps offered after the first-run tour ends ("Go further, n more
 * steps"). `ward-tour-more-steps.ts` exports the real `goFurtherSteps(role, device, facts)` (WS4).
 * Until that lands this stand-in offers none, so the player shows Done alone. Once it has, replace
 * this whole file with:
 *
 *   export { goFurtherSteps } from "./ward-tour-more-steps";
 *
 * The player (`ward-tour.tsx`) and its tests import from here, so nothing else changes.
 */
export function goFurtherSteps(role: TourRole, device: WardTourDevice, facts: TourFacts): readonly TourStep[] {
  void role;
  void device;
  void facts;
  return [];
}
