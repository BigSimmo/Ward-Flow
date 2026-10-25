import { describe, expect, it } from "vitest";

import { dueTone, isDueSoon, type BoardRow } from "@/components/ward-management/delays/delays-board-model";
import { formProgression } from "@/components/ward-management/legal-forms/legal-form-progression";
import { formTimeLeft } from "@/components/ward-management/legal-forms/legal-form-time-left";
import {
  currentLegalDueAt,
  isLegalDeadlineBreached,
  legalFormGroupOf,
  legalFormGroupRows,
} from "@/components/ward-management/legal-forms/legal-forms-derivations";
import { delayGroups, legalDeadlineMinutes } from "@/components/ward-management/delays/delays-derivations";
import { clockStanding, isActNow } from "@/components/ward-management/legal-forms/legal-forms-view";
import { bedGlyphTone } from "@/components/ward-management/ward/ward-beds-matrix";
import { activeActNowItems, taskItems } from "@/components/ward-management/ward-act-now-items";
import { clockState, DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
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

function movement(overrides: Partial<Movement>): Movement {
  const base = seedWardFlowStateAt(0).movements[0]!;
  return { ...base, closure: undefined, examination: undefined, ...overrides } as Movement;
}

describe("one time-left rule for legal forms (A3-3, A3-4)", () => {
  it("is act now at exactly the first warning on Forms and Delays alike", () => {
    const due = movement({ legalForm: { code: "4A", kind: "transport", dueAt: NOW + 60 } });
    expect(clockState(NOW + 60, NOW, DEFAULT_DUE_SOON_THRESHOLDS)).toBe("critical");
    expect(clockStanding(due, NOW, DEFAULT_DUE_SOON_THRESHOLDS)).toBe("urgent");
    expect(isActNow(clockStanding(due, NOW, DEFAULT_DUE_SOON_THRESHOLDS))).toBe(true);
    expect(dueTone(60, DEFAULT_DUE_SOON_THRESHOLDS)).toBe("danger");
    expect(isDueSoon({ dueIn: 60 } as BoardRow, DEFAULT_DUE_SOON_THRESHOLDS)).toBe(true);
    expect(clockState(NOW + 61, NOW, DEFAULT_DUE_SOON_THRESHOLDS)).toBe("due");
    expect(clockState(NOW + 180, NOW, DEFAULT_DUE_SOON_THRESHOLDS)).toBe("due");
    expect(clockState(NOW + 181, NOW, DEFAULT_DUE_SOON_THRESHOLDS)).toBe("clear");
  });

  it("gives the Patient page the same time left and expiry the Forms page shows", () => {
    const due = movement({ legalForm: { code: "4A", kind: "transport", dueAt: NOW + 60 } });
    const left = formTimeLeft(due, NOW, DEFAULT_DUE_SOON_THRESHOLDS)!;
    expect(left).toMatchObject({ code: "Form 4A", text: "1h 00m left", at: "11:42", actNow: true });
    expect(
      formTimeLeft(movement({ legalForm: { code: "3B", kind: "detention" } }), NOW, DEFAULT_DUE_SOON_THRESHOLDS),
    ).toBeUndefined();
    expect(
      formTimeLeft(
        movement({ legalForm: { code: "4A", kind: "transport", dueAt: NOW - 37 } }),
        NOW,
        DEFAULT_DUE_SOON_THRESHOLDS,
      )?.text,
    ).toBe("37m past");
  });
});

describe("Time not written group order (A3-6, owner 20 Oct 2026)", () => {
  it("keeps the longest wait in ED first and works out no Act period to order by", () => {
    const sixA = movement({ id: "WF-T6A", legalForm: { code: "6A", kind: "detention" }, openedAt: NOW - 600 });
    const threeB = movement({ id: "WF-T3B", legalForm: { code: "3B", kind: "detention" }, openedAt: NOW - 420 });
    const oneB = movement({ id: "WF-T1B", legalForm: { code: "1B", kind: "examination" }, openedAt: NOW - 900 });
    const ordered = legalFormGroupRows([threeB, sixA, oneB], NOW, "no-deadline").map((m) => m.id);
    // The removed demo ordered 3B before 6A by share of a computed Act period. Arrival order only now.
    expect(ordered).toEqual(["WF-T1B", "WF-T6A", "WF-T3B"]);
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

  it("keeps an ended form's typed expiry as history on Forms and Delays, never in force or overdue", () => {
    const ended = movement({
      legalStatus: "Involuntary inpatient",
      legalForm: { code: "4C", kind: "transport", dueAt: NOW - 30 },
      examination: { at: NOW - 60, outcome: "inpatient_order" },
    });
    expect(ended.legalForm?.dueAt, "the record keeps the typed time").toBe(NOW - 30);
    expect(currentLegalDueAt(ended)).toBeUndefined();
    expect(isLegalDeadlineBreached(ended, NOW)).toBe(false);
    expect(legalFormGroupOf(ended)).toBe("no-deadline");
    expect(clockStanding(ended, NOW, DEFAULT_DUE_SOON_THRESHOLDS)).toBe("none");
    expect(formTimeLeft(ended, NOW, DEFAULT_DUE_SOON_THRESHOLDS)).toBeUndefined();
    expect(legalDeadlineMinutes(ended, NOW)).toBeUndefined();
    const cause = delayGroups([ended], seedWardFlowStateAt(0).units, NOW, DEFAULT_DUE_SOON_THRESHOLDS).find((group) =>
      group.movements.some((row) => row.id === ended.id),
    )?.cause;
    expect(cause).not.toBe("legal_breached");
    // Without the examination the same typed time is overdue.
    const live = { ...ended, examination: undefined } as Movement;
    expect(isLegalDeadlineBreached(live, NOW)).toBe(true);
    expect(legalDeadlineMinutes(live, NOW)).toBe(-30);
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
      // Production audit 24 Oct 2026, EDR-02: the recorded status in its own words, never "Involuntary" for a CTO or referral.
      expect(short).toMatch(
        /^(Form \S+|Voluntary|Involuntary|CTO|Referred for exam|Awaiting exam|Status unrecognised)$/,
      );
    }
    expect(isOnOrder("Voluntary")).toBe(false);
    expect(isOnOrder("Involuntary inpatient")).toBe(true);
    expect(isOnOrder(undefined)).toBe(false);
  });
});
