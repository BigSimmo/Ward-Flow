import { describe, expect, it } from "vitest";
import { isClinicalQuestion } from "@/components/ward-management/help/ward-help-search-index";
import { patientChronology, type ChronologyInput } from "@/components/ward-management/reports/patient-chronology";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("consolidated chronology and Help repairs", () => {
  it("keeps an existing event selected when an earlier record row is inserted", () => {
    const state = seedWardFlowState();
    const input: ChronologyInput = {
      personId: "PT-013",
      patients: state.patients,
      movements: state.movements,
      referrals: state.referrals,
      admissions: state.admissions,
      units: state.units,
      auditEvents: state.auditEvents,
      eventLog: [],
      dayZero: new Date(2026, 9, 7),
    };
    const before = patientChronology(input).rows;
    const held = before.find((row) => row.action === "Legal form made (typed time)") ?? before.at(-1)!;
    const changed = {
      ...input,
      movements: state.movements.map((movement) =>
        movement.id === "WF-014"
          ? {
              ...movement,
              declines: [
                ...movement.declines,
                { unitId: state.units[0]!.id, at: NOW_ANCHOR - 10, reason: "no_suitable_bed" as const },
              ],
            }
          : movement,
      ),
    };
    const after = patientChronology(changed).rows;
    expect(after.find((row) => row.key === held.key)).toEqual(held);
    expect(new Set(after.map((row) => row.key)).size).toBe(after.length);
  });
  it.each(["should  we  transfer", "should\nwe\ttransfer", "safe   to transfer"])(
    "keeps fixed clinical routing with whitespace: %s",
    (query) => {
      expect(isClinicalQuestion(query)).toBe(true);
      expect(isClinicalQuestion("How do I record a transfer?")).toBe(false);
    },
  );
});
