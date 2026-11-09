// Feature 29 (Josh, 9 Nov 2026): the 28 day readmission flag on an inpatient stay and its weekly
// count, by the same rule as the referral and journey flags. The seed holds one deliberate,
// synthetic readmission so the flag shows on the ward board and in Statistics.
import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import {
  READMISSION_WINDOW_DAYS,
  admissionReadmissionFlag,
  createReadmissionIndex,
  readmissionsArrivedIn,
} from "@/components/ward-management/ward-readmission";
import { stayReadmissionCopy } from "@/components/ward-management/ward-readmission-copy";

describe("admissionReadmissionFlag", () => {
  const state = seedWardFlowState();
  const index = createReadmissionIndex(state);
  const flagged = state.admissions.filter(
    (admission) => admission.state === "occupied" && admissionReadmissionFlag(admission, state.movements, index),
  );

  it("finds the seeded readmission: an earlier discharge of the same person inside the window", () => {
    expect(flagged).toHaveLength(1);
    const stay = flagged[0]!;
    const flag = admissionReadmissionFlag(stay, state.movements, index)!;
    const earlier = state.admissions.find((admission) => admission.id === flag.admissionId)!;
    expect(earlier.patientId).toBe(stay.patientId);
    expect(earlier.state).toBe("departed");
    expect(flag.daysBefore).toBeLessThanOrEqual(READMISSION_WINDOW_DAYS);
    expect(flag.dischargedAt).toBeLessThan(stay.arrivedAt!);
  });

  it("never flags a stay against itself, nor a discharge past the window", () => {
    const stay = flagged[0]!;
    const flag = admissionReadmissionFlag(stay, state.movements, index)!;
    const later = {
      ...stay,
      movementId: null,
      pulledAt: flag.dischargedAt + (READMISSION_WINDOW_DAYS + 1) * MINUTES_PER_DAY,
    };
    expect(admissionReadmissionFlag(later, state.movements, index)).toBeNull();
    const own = state.admissions.find((admission) => admission.id === flag.admissionId)!;
    expect(admissionReadmissionFlag(own, state.movements, index)?.admissionId).not.toBe(own.id);
  });

  it("reads a journey joined only by its admissionId, and ignores an ambiguous pair", () => {
    const stay = flagged[0]!;
    const flag = admissionReadmissionFlag(stay, state.movements, index)!;
    const unflagged = {
      ...stay,
      movementId: null,
      pulledAt: flag.dischargedAt + (READMISSION_WINDOW_DAYS + 1) * MINUTES_PER_DAY,
    };
    const journey = {
      ...state.movements[0]!,
      id: "WF-SYNTH-JOIN" as const,
      admissionId: stay.id,
      patientId: stay.patientId ?? undefined,
      referralId: undefined,
      openedAt: flag.dischargedAt + MINUTES_PER_DAY,
    };
    const others = state.movements.filter((movement) => movement.admissionId !== stay.id);
    expect(admissionReadmissionFlag(unflagged, others, index)).toBeNull();
    expect(admissionReadmissionFlag(unflagged, [...others, journey], index)?.admissionId).toBe(flag.admissionId);
    const twin = { ...journey, id: "WF-SYNTH-TWIN" as const };
    expect(admissionReadmissionFlag(unflagged, [...others, journey, twin], index)).toBeNull();
  });

  it("gives the ward's copy the discharge time only, and counts arrivals in a period", () => {
    const stay = flagged[0]!;
    expect(Object.keys(stayReadmissionCopy(stay, state.movements, index)!).sort()).toEqual([
      "daysBefore",
      "dischargedAt",
    ]);
    const counted = readmissionsArrivedIn(
      state.admissions,
      state.movements,
      index,
      stay.arrivedAt!,
      stay.arrivedAt! + 1,
    );
    expect(counted.readmitted).toBe(1);
    expect(counted.arrivals).toBeGreaterThanOrEqual(1);
    expect(readmissionsArrivedIn(state.admissions, state.movements, index, 0, 0)).toEqual({
      arrivals: 0,
      readmitted: 0,
    });
  });
});
