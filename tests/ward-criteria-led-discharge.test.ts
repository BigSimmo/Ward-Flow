import { describe, expect, it } from "vitest";
import {
  admissionCriteriaEligibility,
  admissionLegalStatus,
  seedWardFlowState,
  seedWardFlowStateAt,
  wardFlowReducer,
} from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import {
  CRITERIA_CTO_EXCLUDED,
  CRITERIA_STATUS_NOT_RECORDED,
  CRITERIA_VOLUNTARY_ONLY,
  criteriaEligibility,
  criteriaLedDepartureNote,
  criteriaLedTileChip,
  dischargeCriteriaStatus,
  isDischargeCriteriaRecord,
  nextDischargeCriteria,
  PATIENT_SPECIFIC_CRITERIA_MAX,
  PATIENT_SPECIFIC_CRITERION_MAX_LENGTH,
  type DischargeCriteriaRecord,
} from "@/components/ward-management/ward-discharge-criteria";
import { eventCarriesTypedTextPayload } from "@/components/ward-management/ward-flow-persistence-classification";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { isValidSharedWardFlowState } from "@/components/ward-management/ward-shared-state-validation";

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
  });

  it("excludes a patient on a community treatment order, even with a voluntary movement", () => {
    expect(criteriaEligibility("Community treatment order", "Voluntary")).toBe("cto");
    expect(criteriaEligibility("Voluntary", "Voluntary", true)).toBe("cto");
    const change = { criteria: ["Accommodation confirmed"], met: [], setByTreatingPsychiatrist: true };
    expect(nextDischargeCriteria(null, change, "cto", 0)).toEqual({ refusal: CRITERIA_CTO_EXCLUDED });
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

  it("applies a single tick to the stored list, so two quick ticks both stick", () => {
    const two = nextDischargeCriteria(
      null,
      { criteria: ["Accommodation confirmed", "Transport home arranged"], met: [], setByTreatingPsychiatrist: true },
      "voluntary",
      now,
    );
    if (!("record" in two) || !two.record) throw new Error("set refused");
    // Both ticks were sent from the same screen, each carrying a stale met list of one.
    const first = nextDischargeCriteria(
      two.record,
      {
        criteria: ["Accommodation confirmed", "Transport home arranged"],
        met: ["Accommodation confirmed"],
        setByTreatingPsychiatrist: false,
        tick: { criterion: "Accommodation confirmed", met: true },
      },
      "voluntary",
      now + 1,
    );
    if (!("record" in first) || !first.record) throw new Error("first tick refused");
    const second = nextDischargeCriteria(
      first.record,
      {
        criteria: ["Accommodation confirmed", "Transport home arranged"],
        met: ["Transport home arranged"],
        setByTreatingPsychiatrist: false,
        tick: { criterion: "Transport home arranged", met: true },
      },
      "voluntary",
      now + 2,
    );
    if (!("record" in second) || !second.record) throw new Error("second tick refused");
    expect(second.record.items.map((item) => item.metAt)).toEqual([now + 1, now + 2]);
  });

  it("refuses a tick whose met value is not true or false", () => {
    if (!("record" in set) || !set.record) throw new Error("set refused");
    const change = {
      criteria: ["Accommodation confirmed"],
      met: [],
      setByTreatingPsychiatrist: false,
      tick: { criterion: "Accommodation confirmed", met: "false" as unknown as boolean },
    };
    expect(nextDischargeCriteria(set.record, change, "voluntary", now + 1)).toEqual({
      refusal: "A tick must say met or not met.",
    });
  });

  // Finding 72 (Josh, 27 Oct 2026): a review keeps the tick on each criterion still on the list.
  it("keeps ticks for criteria that stay on the list when the psychiatrist changes it", () => {
    if (!("record" in set) || !set.record) throw new Error("set refused");
    const ticked = {
      ...set.record,
      items: set.record.items.map((item, index) => ({ ...item, metAt: index === 0 ? now : null })),
    };
    const reviewed = nextDischargeCriteria(
      ticked,
      {
        criteria: ["Accommodation confirmed", "Community follow up booked within 7 days"],
        met: [],
        setByTreatingPsychiatrist: true,
      },
      "voluntary",
      now + 5,
    );
    if (!("record" in reviewed) || !reviewed.record) throw new Error("review refused");
    expect(reviewed.record.setAt).toBe(now + 5);
    expect(reviewed.record.items).toEqual([
      { criterion: "Accommodation confirmed", metAt: now },
      { criterion: "Community follow up booked within 7 days", metAt: null },
    ]);
    expect(dischargeCriteriaStatus(reviewed.record, "voluntary", now + 5).kind).toBe("in_progress");
  });

  it("restarts the ticks worded against the review, and every tick on a lapsed list", () => {
    const bound = "Observations done and reviewed in the last 24 hours" as const;
    const list: DischargeCriteriaRecord = {
      setAt: now,
      items: [
        { criterion: "Accommodation confirmed", metAt: now },
        { criterion: bound, metAt: now },
      ],
    };
    const change = { criteria: ["Accommodation confirmed", bound], met: [], setByTreatingPsychiatrist: true };
    const live = nextDischargeCriteria(list, change, "voluntary", now + 5);
    if (!("record" in live) || !live.record) throw new Error("review refused");
    expect(live.record.items.map((item) => item.metAt)).toEqual([now, null]);
    const lapsed = nextDischargeCriteria(list, change, "voluntary", now + VALIDITY);
    if (!("record" in lapsed) || !lapsed.record) throw new Error("review refused");
    expect(lapsed.record.items.map((item) => item.metAt)).toEqual([null, null]);
  });

  it("accepts only a well formed stored record", () => {
    expect(
      isDischargeCriteriaRecord({ setAt: 1, items: [{ criterion: "Accommodation confirmed", metAt: null }] }),
    ).toBe(true);
    expect(isDischargeCriteriaRecord({ setAt: 1 })).toBe(false);
    expect(isDischargeCriteriaRecord({ setAt: 1, items: [{ criterion: "Feeling better", metAt: null }] })).toBe(false);
    expect(isDischargeCriteriaRecord({ setAt: 1, items: [{ criterion: "Accommodation confirmed", metAt: "x" }] })).toBe(
      false,
    );
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
});

describe("criteria led discharge on boards and at departure (D-64)", () => {
  it("gives each status a short tile chip and a departure note", () => {
    const setAt = NOW_ANCHOR - 60;
    const partWay = dischargeCriteriaStatus(
      {
        setAt,
        items: [
          { criterion: "Accommodation confirmed", metAt: setAt },
          { criterion: "Transport home arranged", metAt: null },
        ],
      },
      "voluntary",
      NOW_ANCHOR,
    );
    expect(criteriaLedTileChip(partWay)).toMatchObject({ label: "CLD 1/2", tone: "neutral" });
    expect(criteriaLedDepartureNote(partWay)).toBe(
      "Criteria led discharge: 1 of 2 met. Ask for a medical review before they leave.",
    );
    expect(criteriaLedTileChip({ kind: "all_met", total: 2, lapsesAt: NOW_ANCHOR })).toMatchObject({
      label: "CLD ready",
      tone: "success",
    });
    expect(criteriaLedTileChip({ kind: "lapsed", met: 2, total: 2 })).toMatchObject({ label: "CLD review" });
    expect(criteriaLedDepartureNote({ kind: "lapsed", met: 2, total: 2 })).toMatch(/has lapsed/);
    expect(criteriaLedTileChip({ kind: "paused" })).toMatchObject({ label: "CLD paused", tone: "warning" });
    expect(criteriaLedTileChip({ kind: "none" })).toBeNull();
    expect(criteriaLedDepartureNote({ kind: "none" })).toBeNull();
  });

  it("seeds one Dabakarn patient part way and one with every criterion met", () => {
    const seeded = seedWardFlowState();
    const kinds = seeded.admissions
      .filter((a) => a.unitId === UNIT && a.state === "occupied" && a.dischargeCriteria)
      .map((a) => {
        expect(isDischargeCriteriaRecord(a.dischargeCriteria)).toBe(true);
        return dischargeCriteriaStatus(a.dischargeCriteria, admissionCriteriaEligibility(seeded, a), NOW_ANCHOR).kind;
      })
      .sort();
    expect(kinds).toEqual(["all_met", "in_progress"]);
  });

  it("moves the seeded criteria times with the demo clock, so an offset demo keeps their status", () => {
    const offset = 13 * 60;
    const plain = seedWardFlowState();
    const shifted = seedWardFlowStateAt(offset);
    const withCriteria = plain.admissions.filter((a) => a.unitId === UNIT && a.dischargeCriteria);
    expect(withCriteria).toHaveLength(2);
    for (const admission of withCriteria) {
      const moved = shifted.admissions.find((a) => a.id === admission.id)!;
      expect(moved.dischargeCriteria!.setAt).toBe(admission.dischargeCriteria!.setAt + offset);
      moved.dischargeCriteria!.items.forEach((item, index) => {
        const before = admission.dischargeCriteria!.items[index].metAt;
        expect(item.metAt).toBe(before === null ? null : before + offset);
      });
      expect(
        dischargeCriteriaStatus(
          moved.dischargeCriteria,
          admissionCriteriaEligibility(shifted, moved),
          NOW_ANCHOR + offset,
        ).kind,
      ).toBe(
        dischargeCriteriaStatus(admission.dischargeCriteria, admissionCriteriaEligibility(plain, admission), NOW_ANCHOR)
          .kind,
      );
    }
  });

  it("shows the legal status the eligibility rule reads, so the Legal tile and the card agree", () => {
    const seeded = seedWardFlowState();
    const occupied = seeded.admissions.filter((a) => a.state === "occupied");
    let voluntary = 0;
    for (const admission of occupied) {
      const eligibility = admissionCriteriaEligibility(seeded, admission);
      const shown = admissionLegalStatus(seeded, admission);
      if (eligibility === "voluntary") {
        voluntary += 1;
        expect(shown, admission.id).toMatch(/^voluntary\b/i);
      } else if (eligibility === "involuntary") {
        expect(shown, admission.id).not.toMatch(/^voluntary\b/i);
      }
    }
    expect(voluntary).toBeGreaterThan(0);
  });

  it("shows a community treatment order in force on the Legal tile even when the typed status says voluntary", () => {
    const seeded = seedWardFlowState();
    const admissionId = voluntaryStay(seeded);
    const admission = seeded.admissions.find((a) => a.id === admissionId)!;
    const state: WardFlowState = {
      ...seeded,
      patients: seeded.patients.map((p) =>
        p.id === admission.patientId
          ? {
              ...p,
              legalStatus: "Voluntary",
              communityTreatmentOrder: { form: "5A", recordedAt: NOW_ANCHOR, recordedBy: "coordinator" },
            }
          : p,
      ),
    };
    expect(admissionCriteriaEligibility(state, admission)).toBe("cto");
    expect(admissionLegalStatus(state, admission)).toMatch(/community treatment order/i);
  });
});

describe("patient specific typed criteria (D-65)", () => {
  const TYPED = "Lives with sister until flat repairs done";
  const psychiatrist = (patientSpecific: unknown[], criteria: unknown[] = ["Accommodation confirmed"]) => ({
    criteria,
    met: [],
    setByTreatingPsychiatrist: true,
    patientSpecific,
  });

  it("adds typed criteria after the fixed ones, marked patient specific, and ticks and counts them", () => {
    const set = nextDischargeCriteria(null, psychiatrist([TYPED]), "voluntary", 100);
    if (!("record" in set) || !set.record) throw new Error("set refused");
    expect(set.record.items).toEqual([
      { criterion: "Accommodation confirmed", metAt: null },
      { criterion: TYPED, metAt: null, patientSpecific: true },
    ]);
    expect(isDischargeCriteriaRecord(set.record)).toBe(true);
    const ticked = nextDischargeCriteria(
      set.record,
      {
        criteria: ["Accommodation confirmed", TYPED],
        met: [TYPED],
        setByTreatingPsychiatrist: false,
        tick: { criterion: TYPED, met: true },
      },
      "voluntary",
      150,
    );
    if (!("record" in ticked) || !ticked.record) throw new Error("tick refused");
    expect(ticked.record.items[1]).toEqual({ criterion: TYPED, metAt: 150, patientSpecific: true });
    expect(dischargeCriteriaStatus(ticked.record, "voluntary", 150)).toMatchObject({ kind: "in_progress", met: 1 });
  });

  it("allows typed criteria alone, and refuses too many, too long, blank or a copy of a fixed one", () => {
    expect("record" in nextDischargeCriteria(null, psychiatrist([TYPED], []), "voluntary", 0)).toBe(true);
    const tooMany = Array.from({ length: PATIENT_SPECIFIC_CRITERIA_MAX + 1 }, (_, i) => `Typed ${i}`);
    expect(nextDischargeCriteria(null, psychiatrist(tooMany), "voluntary", 0)).toHaveProperty("refusal");
    const tooLong = "x".repeat(PATIENT_SPECIFIC_CRITERION_MAX_LENGTH + 1);
    for (const bad of [tooLong, "", " padded ", "Transport home arranged", 7]) {
      expect(nextDischargeCriteria(null, psychiatrist([bad]), "voluntary", 0)).toHaveProperty("refusal");
    }
    expect(nextDischargeCriteria(null, psychiatrist([TYPED, TYPED]), "voluntary", 0)).toEqual({
      refusal: "Each discharge criterion can be chosen once.",
    });
  });

  it("lets only the treating psychiatrist add typed criteria, and keeps them on a ward tick", () => {
    const set = nextDischargeCriteria(null, psychiatrist([TYPED]), "voluntary", 0);
    if (!("record" in set) || !set.record) throw new Error("set refused");
    // A ward change that slips in new typed text is refused, the stored list is the only source.
    expect(
      nextDischargeCriteria(
        set.record,
        {
          criteria: ["Accommodation confirmed", TYPED, "Something new"],
          met: [],
          setByTreatingPsychiatrist: false,
          patientSpecific: [TYPED, "Something new"],
        },
        "voluntary",
        10,
      ),
    ).toHaveProperty("refusal");
    expect(
      nextDischargeCriteria(
        set.record,
        {
          criteria: [],
          met: [],
          setByTreatingPsychiatrist: false,
          tick: { criterion: "Something new", met: true },
        },
        "voluntary",
        10,
      ),
    ).toEqual({ refusal: "Only a chosen discharge criterion can be marked met." });
  });

  it("refuses a stored record whose typed criteria are unmarked, too many or too long", () => {
    const item = (criterion: string) => ({ criterion, metAt: null, patientSpecific: true });
    expect(isDischargeCriteriaRecord({ setAt: 1, items: [{ criterion: TYPED, metAt: null }] })).toBe(false);
    expect(
      isDischargeCriteriaRecord({ setAt: 1, items: [{ criterion: TYPED, metAt: null, patientSpecific: false }] }),
    ).toBe(false);
    const four = Array.from({ length: PATIENT_SPECIFIC_CRITERIA_MAX + 1 }, (_, i) => item(`Typed ${i}`));
    expect(isDischargeCriteriaRecord({ setAt: 1, items: four })).toBe(false);
    const long = item("x".repeat(PATIENT_SPECIFIC_CRITERION_MAX_LENGTH + 1));
    expect(isDischargeCriteriaRecord({ setAt: 1, items: [long] })).toBe(false);
  });

  it("treats a dispatch naming a typed criterion as typed text, and fixed criteria only as safe", () => {
    const base = {
      type: "SET_DISCHARGE_CRITERIA" as const,
      role: "ward" as const,
      now: 0,
      admissionId: "a",
      criteria: ["Accommodation confirmed"],
      met: [],
      setByTreatingPsychiatrist: true,
    };
    expect(eventCarriesTypedTextPayload(base)).toBe(false);
    expect(eventCarriesTypedTextPayload({ ...base, patientSpecific: [TYPED] })).toBe(true);
    expect(
      eventCarriesTypedTextPayload({
        ...base,
        criteria: ["Accommodation confirmed", TYPED],
        setByTreatingPsychiatrist: false,
        tick: { criterion: TYPED, met: true },
      }),
    ).toBe(true);
  });

  it("sets typed criteria through the reducer for a voluntary patient", () => {
    const seeded = seedWardFlowStateAt(NOW_ANCHOR);
    const admissionId = voluntaryStay(seeded);
    const state = withVoluntary(seeded, admissionId);
    const after = wardFlowReducer(state, setCriteria(admissionId, NOW_ANCHOR, { patientSpecific: [TYPED] }));
    expect(lastRejection(state, after)).toBeUndefined();
    const record = after.admissions.find((a) => a.id === admissionId)!.dischargeCriteria!;
    expect(record.items.at(-1)).toEqual({ criterion: TYPED, metAt: null, patientSpecific: true });
  });

  it("never restores typed criteria from browser storage, while shared storage holds them (D-65)", () => {
    const withCriteria = (items: unknown[]): WardFlowState => {
      const seeded = JSON.parse(JSON.stringify(seedWardFlowStateAt(0))) as WardFlowState;
      (seeded.admissions[0] as { dischargeCriteria: unknown }).dischargeCriteria = { setAt: 1, items };
      return seeded;
    };
    const fixed = { criterion: "Accommodation confirmed", metAt: null };
    const typed = { criterion: TYPED, metAt: null, patientSpecific: true };
    expect(isValidStoredWardFlowState(withCriteria([fixed]))).toBe(true);
    expect(isValidStoredWardFlowState(withCriteria([fixed, typed]))).toBe(false);
    expect(isValidSharedWardFlowState(withCriteria([fixed, typed]))).toBe(true);
    expect(isValidSharedWardFlowState(withCriteria([fixed, { ...typed, criterion: "x".repeat(121) }]))).toBe(false);
    expect(isValidSharedWardFlowState(withCriteria([fixed, { ...typed, patientSpecific: false }]))).toBe(false);
  });
});
