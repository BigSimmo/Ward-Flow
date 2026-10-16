import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  CRITERIA_CTO_IN_FORCE,
  CRITERIA_STATUS_NOT_RECORDED,
  CRITERIA_VOLUNTARY_ONLY,
  criteriaEligibility,
  dischargeCriteriaStatus,
  nextDischargeCriteria,
} from "@/components/ward-management/ward-discharge-criteria";

// Top 25 item 9 (D-60): criteria led discharge for patients recorded as voluntary only.

const UNIT = "rph-adult-secure";
const VALIDITY = CLINICAL_VALUES.dischargeCriteriaValidity.value;

function voluntaryStay(state: WardFlowState): string {
  const admission = state.admissions.find((a) => {
    if (a.state !== "occupied" || a.unitId !== UNIT) return false;
    return state.patients.find((p) => p.id === a.patientId)?.legalStatus === "Voluntary";
  });
  if (admission) return admission.id;
  // Fall back to any occupied stay, recorded as voluntary on its patient for this test.
  const any = state.admissions.find((a) => a.state === "occupied" && a.unitId === UNIT);
  if (!any) throw new Error("no occupied stay on the test ward");
  return any.id;
}

function withVoluntary(state: WardFlowState, admissionId: string): WardFlowState {
  const admission = state.admissions.find((a) => a.id === admissionId)!;
  return {
    ...state,
    patients: state.patients.map((p) => (p.id === admission.patientId ? { ...p, legalStatus: "Voluntary" } : p)),
  };
}

function setCriteria(admissionId: string, now: number, extra: Partial<WardFlowEvent> = {}): WardFlowEvent {
  return {
    type: "SET_DISCHARGE_CRITERIA",
    role: "ward",
    now,
    actingUnitId: UNIT,
    admissionId,
    criteria: ["Accommodation confirmed", "Transport home arranged"],
    met: [],
    setByTreatingPsychiatrist: true,
    ...extra,
  } as WardFlowEvent;
}

function lastRejection(before: WardFlowState, after: WardFlowState): string | undefined {
  return after.rejections.slice(before.rejections.length).at(-1)?.reason;
}

describe("criteriaEligibility", () => {
  it("counts a patient as voluntary only when that is recorded", () => {
    expect(criteriaEligibility("Voluntary", undefined)).toBe("voluntary");
    expect(criteriaEligibility(undefined, "Voluntary")).toBe("voluntary");
    expect(criteriaEligibility(undefined, undefined)).toBe("not_recorded");
    expect(criteriaEligibility("Community treatment order", undefined)).toBe("not_recorded");
  });

  it("gives a community treatment order in force its own result, not the unrecorded one", () => {
    expect(criteriaEligibility("Voluntary", "Voluntary", true)).toBe("cto");
    const change = { criteria: ["Accommodation confirmed"], met: [], setByTreatingPsychiatrist: true };
    expect(nextDischargeCriteria(null, change, "cto", 1000)).toEqual({ refusal: CRITERIA_CTO_IN_FORCE });
  });

  it("excludes an involuntary patient whichever record says so", () => {
    expect(criteriaEligibility("Involuntary inpatient", undefined)).toBe("involuntary");
    expect(criteriaEligibility("Detained awaiting examination", undefined)).toBe("involuntary");
    expect(criteriaEligibility("Voluntary", "Involuntary inpatient")).toBe("involuntary");
    expect(criteriaEligibility("Voluntary", "Referred for psychiatric examination")).toBe("involuntary");
  });
});

describe("nextDischargeCriteria and dischargeCriteriaStatus", () => {
  const now = 1000;
  const set = nextDischargeCriteria(
    null,
    { criteria: ["Accommodation confirmed"], met: [], setByTreatingPsychiatrist: true },
    "voluntary",
    now,
  );

  it("refuses an involuntary or unrecorded patient, and a list nobody attests", () => {
    const change = { criteria: ["Accommodation confirmed"], met: [], setByTreatingPsychiatrist: true };
    expect(nextDischargeCriteria(null, change, "involuntary", now)).toEqual({ refusal: CRITERIA_VOLUNTARY_ONLY });
    expect(nextDischargeCriteria(null, change, "not_recorded", now)).toEqual({
      refusal: CRITERIA_STATUS_NOT_RECORDED,
    });
    expect(nextDischargeCriteria(null, { ...change, setByTreatingPsychiatrist: false }, "voluntary", now)).toEqual({
      refusal: "Discharge criteria are set by the treating psychiatrist.",
    });
    expect(nextDischargeCriteria(null, { ...change, criteria: ["Feeling better"] }, "voluntary", now)).toEqual({
      refusal: "Discharge criteria must be chosen from the list.",
    });
  });

  it("ticks a criterion met without restarting the validity, and reads all met", () => {
    if (!("record" in set) || !set.record) throw new Error("set refused");
    const ticked = nextDischargeCriteria(
      set.record,
      { criteria: ["Accommodation confirmed"], met: ["Accommodation confirmed"], setByTreatingPsychiatrist: false },
      "voluntary",
      now + 60,
    );
    if (!("record" in ticked) || !ticked.record) throw new Error("tick refused");
    expect(ticked.record.setAt).toBe(now);
    expect(ticked.record.items[0]!.metAt).toBe(now + 60);
    expect(dischargeCriteriaStatus(ticked.record, "voluntary", now + 60).kind).toBe("all_met");
    expect(dischargeCriteriaStatus(ticked.record, "involuntary", now + 60).kind).toBe("paused");
  });

  it("lapses after the set time, refuses ticks then, and a psychiatrist review restarts it", () => {
    if (!("record" in set) || !set.record) throw new Error("set refused");
    const later = now + VALIDITY;
    expect(dischargeCriteriaStatus(set.record, "voluntary", later).kind).toBe("lapsed");
    expect(
      nextDischargeCriteria(
        set.record,
        { criteria: ["Accommodation confirmed"], met: ["Accommodation confirmed"], setByTreatingPsychiatrist: false },
        "voluntary",
        later,
      ),
    ).toEqual({ refusal: "These criteria have lapsed. Ask the treating psychiatrist to review them." });
    const reviewed = nextDischargeCriteria(
      set.record,
      { criteria: ["Accommodation confirmed"], met: [], setByTreatingPsychiatrist: true },
      "voluntary",
      later,
    );
    expect("record" in reviewed && reviewed.record?.setAt).toBe(later);
  });
});

describe("SET_DISCHARGE_CRITERIA in the reducer", () => {
  it("records criteria for a voluntary patient on their own ward, and clears them", () => {
    const seeded = seedWardFlowState();
    const id = voluntaryStay(seeded);
    const state = withVoluntary(seeded, id);
    const after = wardFlowReducer(state, setCriteria(id, NOW_ANCHOR));
    const record = after.admissions.find((a) => a.id === id)?.dischargeCriteria;
    expect(record?.items.map((item) => item.criterion)).toEqual(["Accommodation confirmed", "Transport home arranged"]);

    const cleared = wardFlowReducer(after, setCriteria(id, NOW_ANCHOR, { criteria: null } as Partial<WardFlowEvent>));
    expect(cleared.admissions.find((a) => a.id === id)?.dischargeCriteria).toBeNull();
  });

  it("refuses an involuntary patient and another ward", () => {
    const seeded = seedWardFlowState();
    const involuntary = seeded.admissions.find(
      (a) =>
        a.state === "occupied" &&
        a.unitId === UNIT &&
        seeded.patients.find((p) => p.id === a.patientId)?.legalStatus === "Involuntary inpatient",
    );
    if (!involuntary) throw new Error("no involuntary stay seeded on the test ward");
    const refused = wardFlowReducer(seeded, setCriteria(involuntary.id, NOW_ANCHOR));
    expect(refused.admissions.find((a) => a.id === involuntary.id)?.dischargeCriteria).toBeUndefined();
    expect(lastRejection(seeded, refused)).toBe(CRITERIA_VOLUNTARY_ONLY);

    const id = voluntaryStay(seeded);
    const state = withVoluntary(seeded, id);
    const wrongWard = wardFlowReducer(
      state,
      setCriteria(id, NOW_ANCHOR, { actingUnitId: "scgh-adult-open" } as Partial<WardFlowEvent>),
    );
    expect(lastRejection(state, wrongWard)).toBe("Discharge criteria can only be set by the patient's own ward.");
  });

  it("applies a tick to the criteria held now, so a second stale tick cannot clear the first", () => {
    const seeded = seedWardFlowState();
    const id = voluntaryStay(seeded);
    const set = wardFlowReducer(withVoluntary(seeded, id), setCriteria(id, NOW_ANCHOR));
    // Both ticks were built from the same untouched list, as two quick clicks before a save returns.
    const tick = (criterion: "Accommodation confirmed" | "Transport home arranged") =>
      setCriteria(id, NOW_ANCHOR, {
        criteria: ["Accommodation confirmed", "Transport home arranged"],
        met: [criterion],
        toggle: { criterion, met: true },
        setByTreatingPsychiatrist: false,
      } as Partial<WardFlowEvent>);
    const both = wardFlowReducer(
      wardFlowReducer(set, tick("Accommodation confirmed")),
      tick("Transport home arranged"),
    );
    const items = both.admissions.find((a) => a.id === id)?.dischargeCriteria?.items;
    expect(items?.map((item) => item.metAt !== null)).toEqual([true, true]);

    const untick = wardFlowReducer(
      both,
      setCriteria(id, NOW_ANCHOR, {
        toggle: { criterion: "Accommodation confirmed", met: false },
        setByTreatingPsychiatrist: false,
      } as Partial<WardFlowEvent>),
    );
    expect(untick.admissions.find((a) => a.id === id)?.dischargeCriteria?.items.map((i) => i.metAt !== null)).toEqual([
      false,
      true,
    ]);
  });
});
