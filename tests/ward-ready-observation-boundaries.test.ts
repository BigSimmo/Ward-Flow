import { describe, expect, it } from "vitest";

import { capacityBreakdown, openBedsNow } from "@/components/ward-management/ward-bed-availability";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

// R-B-09 defines Ready from the two recorded observations, not nominal beds.
// Literal expectations deliberately expose disagreement beyond the nominal boundary.
const boundaries = [
  { beds: 4, allocatable: 7, empty: 6, ready: 6, held: 0 },
  { beds: 4, allocatable: 3, empty: 6, ready: 3, held: 3 },
  { beds: 4, allocatable: 7, empty: 2, ready: 2, held: 0 },
  { beds: 4, allocatable: 4, empty: 4, ready: 4, held: 0 },
  { beds: 4, allocatable: 0, empty: 6, ready: 0, held: 6 },
  { beds: 4, allocatable: 7, empty: 0, ready: 0, held: 0 },
  { beds: 0, allocatable: 1, empty: 1, ready: 1, held: 0 },
];

describe("Ready observation boundaries", () => {
  it.each(boundaries)(
    "beds=$beds, allocatable=$allocatable, empty=$empty keeps Ready=$ready",
    ({ beds, allocatable, empty, ready, held }) => {
      const seed = allUnits()[0];
      const unit = {
        ...seed,
        beds,
        allocatable: { ...seed.allocatable, value: allocatable },
        empty: { ...seed.empty, value: empty },
      };
      const capacity = unitCapacity(unit, []);
      const breakdown = capacityBreakdown(unit, [], [], NOW_ANCHOR);

      expect(capacity.available).toBe(ready);
      expect(openBedsNow(unit, [])).toBe(ready);
      expect(breakdown.availableNow).toBe(ready);
      expect(capacity.held).toBe(held);
      // Conflicting observations cannot prove that physical surge beds exist.
      expect(capacity.surge).toBe(0);
    },
  );
});
