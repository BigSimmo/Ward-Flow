import { describe, expect, it } from "vitest";
import { seedWardFlowStateAt, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import {
  FREQUENT_PRESENTER_ED_THRESHOLD,
  carerToldMoments,
  currentCarePlan,
  edPresentationsInWindow,
  frequentPresenterTag,
  isoDayOfDisplayDate,
  tribunalHearingPassedWithoutOutcome,
  type CarePlanInput,
  type TribunalHearing,
} from "@/components/ward-management/ward-patient-care-plans";
import { recordExtrasFor } from "@/components/ward-management/patients/patient-record-extras";

/** Care plans and safety flags (Josh, 9 Nov 2026, care plans and safety flags thread: defaults approved). */
const NOW = 10 * 60 + 42;
const ed = (start: string) => ({ kind: "ed", start });

describe("frequent presenter", () => {
  it("reads display dates as typed, refusing anything less precise", () => {
    expect(isoDayOfDisplayDate("14 Jun 2026")).toBe("2026-06-14");
    expect(isoDayOfDisplayDate("Mar 2025")).toBeUndefined();
    expect(isoDayOfDisplayDate("31 Feb 2026")).toBeUndefined();
  });

  it("counts only ED presentations within the last twelve months", () => {
    const episodes = [
      ed("1 Nov 2026"),
      ed("1 Aug 2026"),
      ed("1 May 2026"),
      ed("10 Nov 2025"),
      ed("9 Nov 2025"), // exactly twelve months ago: outside the window
      { kind: "admission", start: "1 Oct 2026" },
    ];
    expect(edPresentationsInWindow(episodes, "2026-11-09")).toBe(4);
  });

  it("tags at the threshold, and says whether a current care plan is on file", () => {
    expect(FREQUENT_PRESENTER_ED_THRESHOLD).toBe(4);
    const three = [ed("1 Nov 2026"), ed("1 Aug 2026"), ed("1 May 2026")];
    expect(frequentPresenterTag(three, undefined, "2026-11-09")).toBeUndefined();
    const four = [...three, ed("1 Feb 2026")];
    expect(frequentPresenterTag(four, undefined, "2026-11-09")).toBe("Frequent presenter · No care plan");
    const plan = seedWardFlowStateAt(0).patients.find((p) => p.id === "PT-036")!.carePlans;
    expect(frequentPresenterTag(four, plan, "2026-11-09")).toBe("Frequent presenter · Care plan on file");
    const superseded = plan!.map((p) => ({ ...p, status: "Superseded" as const }));
    expect(frequentPresenterTag(four, superseded, "2026-11-09")).toBe("Frequent presenter · No care plan");
  });

  it("tags the seeded examples", () => {
    expect(edPresentationsInWindow(recordExtrasFor("PT-036")?.episodes, "2026-11-09")).toBe(4);
    expect(edPresentationsInWindow(recordExtrasFor("PT-023")?.episodes, "2026-11-09")).toBe(4);
  });
});

describe("tribunal hearing date", () => {
  const hearing = (date: string, time?: string, outcome = false): TribunalHearing => ({
    date,
    ...(time ? { time } : {}),
    recordedAt: 0,
    recordedBy: "ward",
    ...(outcome ? { outcome: { value: "Held" as const, recordedAt: 1, recordedBy: "ward" as const } } : {}),
  });

  it("flags once the typed date has passed and no outcome is recorded", () => {
    expect(tribunalHearingPassedWithoutOutcome(hearing("2026-11-08"), "2026-11-09")).toBe(true);
    expect(tribunalHearingPassedWithoutOutcome(hearing("2026-11-10"), "2026-11-09")).toBe(false);
    expect(tribunalHearingPassedWithoutOutcome(hearing("2026-11-08", undefined, true), "2026-11-09")).toBe(false);
    expect(tribunalHearingPassedWithoutOutcome(undefined, "2026-11-09")).toBe(false);
  });

  it("on the day, flags only once a typed time has passed", () => {
    expect(tribunalHearingPassedWithoutOutcome(hearing("2026-11-09"), "2026-11-09", "16:00")).toBe(false);
    expect(tribunalHearingPassedWithoutOutcome(hearing("2026-11-09", "10:00"), "2026-11-09", "09:59")).toBe(false);
    expect(tribunalHearingPassedWithoutOutcome(hearing("2026-11-09", "10:00"), "2026-11-09", "10:01")).toBe(true);
  });

  it("records a date and then an outcome, refusing an outcome with no date", () => {
    const state = seedWardFlowStateAt(0);
    const patientId = state.patients.find((p) => !p.tribunalHearing)!.id;
    const refused = wardFlowReducer(state, {
      type: "RECORD_TRIBUNAL_OUTCOME",
      role: "ward",
      now: NOW,
      patientId,
      outcome: "Held",
    });
    expect(refused.patients).toBe(state.patients);
    const bad = wardFlowReducer(state, {
      type: "RECORD_TRIBUNAL_HEARING",
      role: "ward",
      now: NOW,
      patientId,
      date: "2026-02-31",
    });
    expect(bad.patients).toBe(state.patients);
    let next = wardFlowReducer(state, {
      type: "RECORD_TRIBUNAL_HEARING",
      role: "ward",
      now: NOW,
      patientId,
      date: "2026-11-20",
      time: "14:30",
    });
    next = wardFlowReducer(next, {
      type: "RECORD_TRIBUNAL_OUTCOME",
      role: "ward",
      now: NOW + 5,
      patientId,
      outcome: "Adjourned",
    });
    expect(next.patients.find((p) => p.id === patientId)!.tribunalHearing).toEqual({
      date: "2026-11-20",
      time: "14:30",
      recordedAt: NOW,
      recordedBy: "ward",
      outcome: { value: "Adjourned", recordedAt: NOW + 5, recordedBy: "ward" },
    });
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(next)))).toBe(true);
  });

  it("seeds one hearing that has passed without an outcome", () => {
    const pt002 = seedWardFlowStateAt(0).patients.find((p) => p.id === "PT-002")!;
    expect(tribunalHearingPassedWithoutOutcome(pt002.tribunalHearing, "2026-11-09")).toBe(true);
  });
});

describe("care plans", () => {
  const input: CarePlanInput = {
    type: "Crisis/safety plan",
    agreedBy: "Ward 3 team",
    agreedOn: "2026-11-02",
    helps: ["Quiet space"],
    attachment: { fileType: "PDF", sizeBytes: 4096 },
  };

  it("supersedes the previous current plan and never deletes it", () => {
    const state = seedWardFlowStateAt(0);
    const next = wardFlowReducer(state, {
      type: "RECORD_CARE_PLAN",
      role: "community",
      now: NOW,
      patientId: "PT-036",
      plan: input,
    });
    const plans = next.patients.find((p) => p.id === "PT-036")!.carePlans!;
    expect(plans).toHaveLength(3);
    expect(plans.map((p) => p.status)).toEqual(["Superseded", "Superseded", "Current"]);
    expect(currentCarePlan(plans)).toMatchObject({ type: "Crisis/safety plan", recordedBy: "community" });
    // The file itself and its name are never kept: type and size only.
    expect(Object.keys(currentCarePlan(plans)!.attachment!).sort()).toEqual([
      "addedAt",
      "addedBy",
      "fileType",
      "sizeBytes",
    ]);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(next)))).toBe(true);
  });

  it("refuses a plan missing who agreed it, its date or with an off-list choice", () => {
    const state = seedWardFlowStateAt(0);
    for (const plan of [
      { ...input, agreedBy: "  " },
      { ...input, agreedOn: "next week" },
      { ...input, helps: ["Something else"] },
      { ...input, contactPhone: "call me" },
      { ...input, attachment: { fileType: "PDF", sizeBytes: 0 } },
    ] as CarePlanInput[]) {
      const next = wardFlowReducer(state, {
        type: "RECORD_CARE_PLAN",
        role: "ward",
        now: NOW,
        patientId: "PT-002",
        plan,
      });
      expect(next.patients).toBe(state.patients);
    }
  });

  it("refuses a desk the role table does not name", () => {
    const state = seedWardFlowStateAt(0);
    const next = wardFlowReducer(state, {
      type: "RECORD_CARE_PLAN",
      role: "officer",
      now: NOW,
      patientId: "PT-002",
      plan: input,
    });
    expect(next.patients).toBe(state.patients);
  });
});

describe("cultural support request", () => {
  it("is set and cleared only by its own event, never from the Aboriginal status field", () => {
    const state = seedWardFlowStateAt(0);
    for (const patient of state.patients)
      if (patient.id !== "PT-002") expect(patient.culturalSupportRequested).toBeUndefined();
    const target = state.patients.find((p) => !p.culturalSupportRequested)!;
    let next = wardFlowReducer(state, {
      type: "SET_CULTURAL_SUPPORT_REQUEST",
      role: "ed",
      now: NOW,
      patientId: target.id,
      request: "Aboriginal liaison officer",
    });
    expect(next.patients.find((p) => p.id === target.id)!.culturalSupportRequested).toBe("Aboriginal liaison officer");
    next = wardFlowReducer(next, {
      type: "SET_CULTURAL_SUPPORT_REQUEST",
      role: "ed",
      now: NOW,
      patientId: target.id,
      request: null,
    });
    expect("culturalSupportRequested" in next.patients.find((p) => p.id === target.id)!).toBe(false);
  });
});

describe("carer told", () => {
  const subjects = [
    { occasion: "transfer" as const, subjectId: "MV-2" },
    { occasion: "admission" as const, subjectId: "MV-1" },
  ];

  it("reads the latest carer record for each moment, and says Not yet when nothing is recorded", () => {
    const moments = carerToldMoments(subjects, [
      { occasion: "admission", subjectId: "MV-1", party: "carer", outcome: "not_applicable", at: 5 },
      {
        occasion: "admission",
        subjectId: "MV-1",
        party: "carer",
        outcome: "told",
        who: "Mother",
        contactedAt: 9,
        at: 10,
      },
      { occasion: "transfer", subjectId: "MV-2", party: "mhas", outcome: "told", who: "MHAS", at: 12 },
    ]);
    expect(moments).toEqual([
      { occasion: "admission", status: "told", who: "Mother", contactedAt: 9 },
      { occasion: "transfer", status: "not-yet" },
      { occasion: "discharge", status: "none" },
    ]);
  });

  it("reads a not applicable record as such", () => {
    expect(
      carerToldMoments(subjects, [
        { occasion: "transfer", subjectId: "MV-2", party: "carer", outcome: "not_applicable", at: 1 },
      ])[1],
    ).toEqual({ occasion: "transfer", status: "not-applicable" });
  });
});
