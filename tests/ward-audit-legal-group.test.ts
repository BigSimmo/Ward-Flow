import { describe, expect, it } from "vitest";

import { dueTone, isDueSoon, type BoardRow } from "@/components/ward-management/delays/delays-board-model";
import {
  actPeriodLineText,
  actPeriodReading,
  orderByActPeriodShare,
} from "@/components/ward-management/legal-forms/act-periods-demo";
import { formProgression } from "@/components/ward-management/legal-forms/legal-form-progression";
import { formTimeLeft } from "@/components/ward-management/legal-forms/legal-form-time-left";
import { clockStanding, isActNow } from "@/components/ward-management/legal-forms/legal-forms-view";
import { bedGlyphTone } from "@/components/ward-management/ward/ward-beds-matrix";
import { activeActNowItems, taskItems } from "@/components/ward-management/ward-act-now-items";
import { clockState } from "@/components/ward-management/ward-clock";
import {
  seedWardFlowStateAt,
  wardFlowReducer,
  type WardFlowState,
} from "@/components/ward-management/ward-flow-reducer";
import { inboxItemIsActNow } from "@/components/ward-management/ward-inbox-reducer";
import {
  ABSENCE_STEPS,
  ABSENCE_STEP_BAR_LABELS,
  ABSENCE_STEP_LABELS,
  type Movement,
} from "@/components/ward-management/ward-model";
import { isOnOrder, stayLegalShort, stayLegalStatus } from "@/components/ward-management/ward-stay-legal";

/** Audit fix group "legal", 13 Oct 2026. Synthetic data only. */
const NOW = 10 * 60 + 42;
const DAY_ZERO = new Date("2026-10-05T00:00:00+08:00");

function movement(overrides: Partial<Movement>): Movement {
  const base = seedWardFlowStateAt(0).movements[0]!;
  return { ...base, closure: undefined, examination: undefined, ...overrides } as Movement;
}

describe("one time-left rule for legal forms (A3-3, A3-4)", () => {
  it("is act now at exactly the first warning on Forms and Delays alike", () => {
    const due = movement({ legalForm: { code: "4A", kind: "transport", dueAt: NOW + 60 } });
    expect(clockState(NOW + 60, NOW)).toBe("critical");
    expect(clockStanding(due, NOW)).toBe("urgent");
    expect(isActNow(clockStanding(due, NOW))).toBe(true);
    expect(dueTone(60)).toBe("danger");
    expect(isDueSoon({ dueIn: 60 } as BoardRow)).toBe(true);
    expect(clockState(NOW + 61, NOW)).toBe("due");
    expect(clockState(NOW + 180, NOW)).toBe("due");
    expect(clockState(NOW + 181, NOW)).toBe("clear");
  });

  it("gives the Patient page the same time left and expiry the Forms page shows", () => {
    const due = movement({ legalForm: { code: "4A", kind: "transport", dueAt: NOW + 60 } });
    const left = formTimeLeft(due, NOW)!;
    expect(left).toMatchObject({ code: "Form 4A", text: "1h 00m left", at: "11:42", actNow: true });
    expect(formTimeLeft(movement({ legalForm: { code: "3B", kind: "detention" } }), NOW)).toBeUndefined();
    expect(formTimeLeft(movement({ legalForm: { code: "4A", kind: "transport", dueAt: NOW - 37 } }), NOW)?.text).toBe(
      "37m past",
    );
  });
});

describe("Act period line beside a typed expiry (A3-5)", () => {
  it("drops the second countdown and 'nothing to count from' when an expiry was typed", () => {
    const typed = movement({ legalForm: { code: "4A", kind: "transport", dueAt: NOW + 60 }, formedAt: undefined });
    const reading = actPeriodReading(typed, DAY_ZERO)!;
    const line = actPeriodLineText(reading, typed, NOW);
    expect(line).toBe(reading.text);
    expect(line).not.toMatch(/nothing to count from/);
  });

  it("keeps the demo countdown sentence when no expiry was typed", () => {
    const untyped = movement({ legalForm: { code: "4A", kind: "transport" }, formedAt: undefined });
    const reading = actPeriodReading(untyped, DAY_ZERO)!;
    expect(actPeriodLineText(reading, untyped, NOW)).toMatch(/nothing to count from/);
  });
});

describe("Time not written group order (A3-6)", () => {
  it("puts the form with most of its Act period used first, unsourced forms last", () => {
    const sixA = movement({ id: "WF-T6A", legalForm: { code: "6A", kind: "detention" }, openedAt: NOW - 600 });
    const threeB = movement({ id: "WF-T3B", legalForm: { code: "3B", kind: "detention" }, openedAt: NOW - 420 });
    const oneB = movement({ id: "WF-T1B", legalForm: { code: "1B", kind: "examination" }, openedAt: NOW - 900 });
    const ordered = orderByActPeriodShare([oneB, sixA, threeB], NOW, DAY_ZERO).map((m) => m.id);
    expect(ordered).toEqual(["WF-T3B", "WF-T6A", "WF-T1B"]);
  });
});

describe("form moves on after examination or arrival (S-6)", () => {
  it("names Form 6A once an inpatient order is recorded or a person on an order arrives", () => {
    const examined = movement({
      legalStatus: "Referred for psychiatric examination",
      legalForm: { code: "1A", kind: "examination" },
      examination: { at: NOW, outcome: "inpatient_order" },
    });
    expect(formProgression(examined)).toEqual({ endedCode: "1A", endedWhen: "at the examination", nextCode: "6A" });
    const arrived = movement({
      legalStatus: "Involuntary inpatient",
      legalForm: { code: "4C", kind: "transport" },
      closure: { at: NOW, outcome: "arrived", reason: "arrived" },
    });
    expect(formProgression(arrived)?.endedWhen).toBe("at arrival");
    expect(formProgression({ ...arrived, legalForm: { code: "6A", kind: "detention" } } as Movement)).toBeUndefined();
    expect(formProgression({ ...arrived, legalStatus: "Voluntary" } as Movement)).toBeUndefined();
  });
});

describe("absent without leave on an order (A3-1, A3-2, A3-10, A3-11)", () => {
  function involuntaryStay() {
    const state = seedWardFlowStateAt(0);
    const stay = state.admissions.find(
      (a) =>
        a.state === "occupied" &&
        !state.leaveBeds.some((bed) => bed.admissionId === a.id) &&
        isOnOrder(stayLegalStatus(a, state)),
    );
    return { state, stay };
  }

  function markAbsent(state: WardFlowState, admissionId: string, unitId: string) {
    return wardFlowReducer(state, {
      type: "RECORD_ABSENT_WITHOUT_LEAVE",
      role: "ward",
      now: NOW,
      admissionId,
      actingUnitId: unitId,
    });
  }

  it("raises one red act-now task that leaves when the return is recorded", () => {
    const { state, stay } = involuntaryStay();
    expect(stay, "no involuntary occupied stay in the seed").toBeDefined();
    const before = activeActNowItems(state, NOW).length;
    const absent = markAbsent(state, stay!.id, stay!.unitId);
    const rows = taskItems(absent, NOW).filter((item) => item.id === `awol-${stay!.id}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tone: "danger", kind: "fact", title: "Absent without leave on an order" });
    expect(inboxItemIsActNow(rows[0]!.id)).toBe(true);
    expect(activeActNowItems(absent, NOW).length).toBe(before + 1);

    const bed = absent.leaveBeds.find((b) => b.admissionId === stay!.id)!;
    const returned = wardFlowReducer(absent, {
      type: "END_LEAVE_BED",
      role: "ward",
      now: NOW + 30,
      leaveBedId: bed.id,
      actingUnitId: bed.unitId,
    });
    expect(taskItems(returned, NOW + 30).some((item) => item.id.startsWith("awol-"))).toBe(false);
  });

  it("raises nothing for a voluntary person", () => {
    const state = seedWardFlowStateAt(0);
    const stay = state.admissions.find(
      (a) =>
        a.state === "occupied" &&
        !state.leaveBeds.some((bed) => bed.admissionId === a.id) &&
        stayLegalStatus(a, state) === "Voluntary",
    );
    if (!stay) return;
    const absent = markAbsent(state, stay.id, stay.unitId);
    expect(taskItems(absent, NOW).some((item) => item.id.startsWith("awol-"))).toBe(false);
  });

  it("offers an exact Undo for Mark absent", () => {
    const { state, stay } = involuntaryStay();
    const absent = markAbsent(state, stay!.id, stay!.unitId);
    const undone = wardFlowReducer(absent, {
      type: "UNDO_ABSENT_WITHOUT_LEAVE",
      role: "coordinator",
      now: NOW + 1,
      admissionId: stay!.id,
    });
    expect(undone.rejections.length).toBe(absent.rejections.length);
    expect(undone.leaveBeds).toEqual(state.leaveBeds);
  });

  it("lists the return order step after the psychiatrist, in neutral words, with step-named bar labels", () => {
    expect(ABSENCE_STEPS.indexOf("return_order_made")).toBe(ABSENCE_STEPS.indexOf("psychiatrist_told") + 1);
    expect(ABSENCE_STEP_LABELS.return_order_made).toBe("Return order made");
    expect(ABSENCE_STEP_LABELS.return_order_made).not.toMatch(/Form|\d/);
    for (const step of ABSENCE_STEPS) expect(ABSENCE_STEP_BAR_LABELS[step]).toMatch(/^Record \S+/);
    expect(ABSENCE_STEP_BAR_LABELS.searched).toBe("Record search done");
  });

  it("shows an absent bed as act now on the ward board, never a neutral On leave", () => {
    const bed = { status: "leave", statusText: "Absent without leave" } as Parameters<typeof bedGlyphTone>[0];
    expect(bedGlyphTone(bed)).toBe("danger");
    expect(bedGlyphTone({ ...bed, statusText: "On Leave" })).toBe("neutral");
  });
});

describe("legal status on a stay (A3-18)", () => {
  it("reads the form for a person on an order and the word for a voluntary one", () => {
    const state = seedWardFlowStateAt(0);
    for (const stay of state.admissions.filter((a) => a.state === "occupied")) {
      const short = stayLegalShort(stay, state);
      if (short === undefined) continue;
      expect(short).toMatch(/^(Form \S+|Voluntary|Involuntary)$/);
    }
    expect(isOnOrder("Voluntary")).toBe(false);
    expect(isOnOrder("Involuntary inpatient")).toBe(true);
    expect(isOnOrder(undefined)).toBe(false);
  });
});
