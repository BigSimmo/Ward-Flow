import type { Instant } from "@/components/ward-management/ward-clock";
import { byServiceThenName } from "@/components/ward-management/ward-derivations-shortlist";
import type { Unit, WardIntakeWindow } from "@/components/ward-management/ward-model";

import { tonightIntakeWindow } from "./ward-intake-window";

/**
 * Feature item 13: the wards that have set tonight's intake hours, in the one neutral order
 * (health service, then ward name; D-71, D-126), and a count of those that have not. Never sorted
 * by the hours themselves, so the list ranks nobody.
 */
export function tonightIntakeWindowList(
  units: readonly Unit[],
  now: Instant,
): { set: { unit: Unit; intake: WardIntakeWindow }[]; notSetCount: number } {
  const set: { unit: Unit; intake: WardIntakeWindow }[] = [];
  let notSetCount = 0;
  for (const unit of [...units].sort(byServiceThenName)) {
    const intake = tonightIntakeWindow(unit, now);
    if (intake) set.push({ unit, intake });
    else notSetCount += 1;
  }
  return { set, notSetCount };
}
