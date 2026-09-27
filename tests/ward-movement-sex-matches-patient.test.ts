import { describe, expect, it } from "vitest";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

/**
 * A seeded movement that names a person carries that person's recorded sex and gender.
 *
 * WF-021 once read "Female" while its linked PT-024 is Male (seed-audit follow-up T2, section 2
 * item 8). The split of gender from sex (R7, 25 September 2026) then gave it a gender, so the
 * two fields could disagree with the record in two ways. Pinned by name, and swept for every
 * movement, so a new sample row cannot bring the contradiction back.
 */
const seed = seedWardFlowState();

describe("a seeded movement's sex and gender agree with its linked patient", () => {
  it("WF-021 is Male for both, like PT-024", () => {
    const movement = seed.movements.find((candidate) => candidate.id === "WF-021");
    const patient = seed.patients.find((candidate) => candidate.id === "PT-024");
    expect(movement?.patientId).toBe("PT-024");
    expect(patient?.sex).toBe("Male");
    expect(patient?.gender).toBe("Male");
    expect(movement?.sex).toBe("Male");
    expect(movement?.gender).toBe("Male");
  });

  it("holds for every seeded movement that names a patient", () => {
    const linked = seed.movements.filter((movement) => movement.patientId !== undefined);
    expect(linked.length).toBeGreaterThan(30);
    const disagreements = linked.flatMap((movement) => {
      const patient = seed.patients.find((candidate) => candidate.id === movement.patientId);
      if (!patient) return [`${movement.id}: names ${movement.patientId}, who has no record`];
      const found: string[] = [];
      if (patient.sex !== undefined && movement.sex !== patient.sex) {
        found.push(`${movement.id}: sex ${movement.sex}, ${patient.id} is ${patient.sex}`);
      }
      if (patient.gender !== undefined && movement.gender !== patient.gender) {
        found.push(`${movement.id}: gender ${movement.gender}, ${patient.id} is ${patient.gender}`);
      }
      return found;
    });
    expect(disagreements).toEqual([]);
  });
});
