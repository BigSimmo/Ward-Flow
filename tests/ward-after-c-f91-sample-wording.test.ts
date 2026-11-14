import { describe, expect, it } from "vitest";
import { ABSCONDED_IN_TRANSIT } from "@/components/ward-management/ward-change-reasons";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { wardPatients } from "@/components/ward-management/ward-patients-seed";
import { interpreterLanguageRequired } from "@/components/ward-management/patients/patient-interpreter";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * F-91 (K27, 13 Nov 2026 audit): two small wording and sample-data fixes. Synthetic data only.
 */
describe("F-91: the transport alert and a sample person's language", () => {
  it("tells the sending ward the patient is absent without leave, never 'absconded'", () => {
    const seed = seedWardFlowState();
    // A synthetic ward to ward transfer, collected and on the road from an occupied stay.
    const stay = seed.admissions.find((admission) => admission.state === "occupied" && admission.patientId !== null)!;
    const journey = seed.movements.find((movement) => !movement.closure && movement.transport)!;
    const moving = {
      ...journey,
      stage: "moving" as const,
      sourceAdmissionId: stay.id,
      transport: { ...journey.transport!, collectedAt: NOW_ANCHOR - 10, cancelledAt: undefined, arrivedAt: undefined },
    };
    const state = { ...seed, movements: seed.movements.map((m) => (m.id === journey.id ? moving : m)) };
    const next = wardFlowReducer(state, {
      type: "STOP_TRANSPORT",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: journey.id,
      reason: ABSCONDED_IN_TRANSIT,
      whereabouts: "Another place — needs follow-up",
    });
    expect(next.rejections).toHaveLength(state.rejections.length);
    const told = next.notices.filter(
      (notice) =>
        notice.to.role === "ward" &&
        notice.to.placeId === stay.unitId &&
        notice.sentence.startsWith("Your patient for"),
    );
    expect(told).toHaveLength(1);
    expect(told[0]!.sentence).toBe(
      `Your patient for ${journey.id} went absent without leave in transit and their whereabouts are unknown. Record them absent without leave.`,
    );
    expect(told[0]!.sentence).not.toMatch(/abscond/i);
  });

  it("the sample Torres Strait Islander person needs a Torres Strait language interpreter, not Tagalog", () => {
    const person = wardPatients.find((patient) => patient.id === "PT-024")!;
    expect(person.aboriginalOrTorresStraitIslanderStatus).toBe("Torres Strait Islander, not Aboriginal");
    expect(interpreterLanguageRequired(person)).toBe("Yumplatok (Torres Strait Creole)");
    expect(wardPatients.filter((patient) => /tagalog/i.test(patient.interpreterLanguage ?? ""))).toEqual([]);
  });
});
