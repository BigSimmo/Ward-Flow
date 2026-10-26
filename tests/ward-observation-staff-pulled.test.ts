import { describe, expect, it } from "vitest";

import {
  observationStaffOnWard,
  remainingSpeciallingCapacity,
  type Admission,
} from "../src/components/ward-management/ward-admissions";
import type { Unit } from "../src/components/ward-management/ward-model";
import { observationAt, type ObservationLevel } from "../src/components/ward-management/ward-observation";

/**
 * Audit F1 (26 Oct 2026, Josh approved): the ward screen's "staff on constant observation" figure
 * must count every bed the placement check counts. A pulled patient holds the bed from the pull,
 * so a pulled 2:1 and a pulled 1:1 already take three staff before either arrives.
 */
const UNIT = "ward-a";

function stay(id: string, state: Admission["state"], level: ObservationLevel, unitId = UNIT): Admission {
  return { id, unitId, state, observation: observationAt(level) } as unknown as Admission;
}

const admissions: Admission[] = [
  stay("AD-1", "pulled", "two_staff"),
  stay("AD-2", "pulled", "within_sight"),
  stay("AD-3", "occupied", "arms_length"),
  stay("AD-4", "occupied", "general"),
  stay("AD-5", "departed", "two_staff"),
  stay("AD-6", "waitlisted", "two_staff"),
  stay("AD-7", "pulled", "two_staff", "ward-b"),
];

describe("observation staff figure counts pulled beds", () => {
  it("counts a pulled 2:1 and a pulled 1:1 beside an occupied 1:1", () => {
    expect(observationStaffOnWard(UNIT, admissions)).toBe(4);
  });

  it("agrees with the placement check's remaining staff", () => {
    const unit = { id: UNIT, speciallingCapacity: 6 } as unknown as Unit;
    expect(remainingSpeciallingCapacity(unit, admissions)).toBe(6 - observationStaffOnWard(UNIT, admissions));
  });
});
