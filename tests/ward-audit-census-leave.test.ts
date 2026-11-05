import { describe, expect, it } from "vitest";
import { buildCensus } from "@/components/ward-management/search/patient-census";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";

const seed = seedWardFlowState();
const stay = seed.admissions.find(
  (a) =>
    a.state === "occupied" &&
    a.patientId &&
    !seed.movements.some((m) => !m.closure && (m.patientId === a.patientId || m.sourceAdmissionId === a.id)),
)!;
describe("Patients whereabouts for a bed held during leave", () => {
  it.each([false, true])(
    "reports the recorded leave or absence (absent=%s) without releasing the ward bed",
    (absent) => {
      const now = 1000;
      const leave = {
        id: "synthetic-leave",
        admissionId: stay.id,
        unitId: stay.unitId,
        confirmedAt: 900,
        confirmedBy: "ward",
        expectedReturn: 1100,
        ...(absent ? { absentWithoutLeave: { since: 950, steps: [] } } : {}),
      };
      const row = buildCensus({
        ...seed,
        leaveBeds: [leave],
        now,
        thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
        dayZero: new Date("2026-11-01T00:00:00+08:00"),
      }).rows.find((r) => r.key === `adm:${stay.id}`)!;
      expect(row.where).toBe(absent ? "Absent without leave" : "On leave");
      expect(row.whereSub).toContain("bed kept");
      expect(row.nextWho).toBe("Ward");
      expect(row.next).not.toBe("On ward");
      expect(row.timeSub).not.toBe("on ward");
      expect(row.unitId).toBe(stay.unitId);
      expect(row.bedNumber).toBe(stay.bedNumber);
      expect(row.group).toBe("ward");
    },
  );
});
