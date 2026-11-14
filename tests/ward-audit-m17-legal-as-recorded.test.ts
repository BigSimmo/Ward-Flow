import { describe, expect, it } from "vitest";

import { edClinicalRows } from "@/components/ward-management/bed-meeting/tv-clinical-derivations";
import { ED_EXPORT_HEADER, edExportLines } from "@/components/ward-management/ed/ed-export";
import {
  currentLegalDueAt,
  FORM_RECORDED_ENDED,
} from "@/components/ward-management/legal-forms/legal-form-progression";
import { legalDeadlineText } from "@/components/ward-management/legal-forms/legal-forms-derivations";
import {
  formTimeAsTyped,
  typedClock,
  typedTimeLine,
  typedTimePhrase,
} from "@/components/ward-management/legal-forms/legal-time-as-typed";
import { handoverPackModel } from "@/components/ward-management/patients/patient-handover-pack";
import { downtimePack } from "@/components/ward-management/reports/downtime-pack";
import { perthMidnight, type Instant } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { LEGAL_STATUSES_DIFFER } from "@/components/ward-management/ward-stay-legal";

/**
 * M17 (master audit list, 10 Nov 2026): legal status as recorded everywhere (D-93).
 *
 * One synthetic journey (seed WF-001, an open ED referral on a Form 1A with no written time) has
 * its form recorded, edited, replaced by a second form, and then the clock runs past the typed end.
 * At each step every pure output that carries the form is compared with the record:
 *
 *   - Legal forms page line (`legalDeadlineText`)
 *   - the shared screen wording (`formTimeAsTyped`), read by Patient, Home, Movements, Alerts
 *   - the ED TV wall (`edClinicalRows`)
 *   - the downtime pack (`downtimePack().legalForms`)
 *   - the printed ward handover pack (`handoverPackModel`, legal section)
 *
 * Each must show the current form's type and the time exactly as typed, never the old form or the
 * old time, and never a count. React screens are covered by the existing as-typed guard
 * (`tests/ward-legal-as-typed-guard.test.ts`), which reads every screen's source.
 *
 * Fixed 10 Nov 2026 (D-125): the TV names the form in full and an ended form reads the same on the
 * TV, downtime pack and print. 13 Nov 2026 (1.6): the ED list download carries the form's end too.
 */

const MOVEMENT_ID = "WF-001";
const NOW = NOW_ANCHOR;
/** The board's day 0, passed in as every screen does, so a typed time on another day prints its date. */
const DAY_ZERO = perthMidnight(2026, 10, 9);

function apply(state: WardFlowState, event: WardFlowEvent): WardFlowState {
  const before = state.rejections.length;
  const next = wardFlowReducer(state, event);
  expect(next.rejections.slice(before), `${event.type} was refused`).toEqual([]);
  return next;
}

function movementOf(state: WardFlowState): Movement {
  const movement = state.movements.find((candidate) => candidate.id === MOVEMENT_ID);
  if (!movement) throw new Error("seed movement WF-001 is missing");
  return movement;
}

type Outputs = {
  page: string;
  shared: string;
  tv: string;
  downtime: { form: string; madeAt: Instant | null; typedExpiryAt: Instant | null };
  printStatus: string;
  printExpiry: string;
  downtimeEnded: boolean;
};

function outputsAt(state: WardFlowState, now: Instant): Outputs {
  const movement = movementOf(state);
  const tvRow = edClinicalRows({
    movements: state.movements,
    referrals: state.referrals,
    patients: state.patients,
    plannedAdmissions: state.plannedAdmissions,
    edId: movement.originEdId!,
    units: state.units,
    now,
    dayZero: DAY_ZERO,
    accessTargetMinutes: 12 * 60,
    nameOf: () => "Synthetic person",
  })?.find((row) => row.id === MOVEMENT_ID);
  const pack = downtimePack({
    units: state.units,
    bedUnits: state.units,
    admissions: state.admissions,
    bedReleases: state.bedReleases,
    leaveBeds: state.leaveBeds,
    movements: state.movements,
    referrals: state.referrals,
    now,
    identify: () => "Synthetic person",
  });
  const downtimeRow = pack.legalForms.find((row) => row.movementId === MOVEMENT_ID);
  const print = handoverPackModel(
    {
      movement,
      patient: { name: "Testperson, Alex", umrn: "UM100001", ageSex: "41, female" },
      fromName: "Synthetic ED",
      wardName: undefined,
      riskFlags: undefined,
      clearance: undefined,
      paperExpiryAt: currentLegalDueAt(movement),
      edContacts: [],
      careContacts: [],
      checklist: [],
      now,
    },
    DAY_ZERO,
  );
  const legal = print.sections.find((section) => section.id === "legal")!;
  return {
    page: legalDeadlineText(movement, now, DAY_ZERO),
    shared: formTimeAsTyped(movement.legalForm!, now, DAY_ZERO),
    tv: tvRow?.legal?.text ?? "(no TV row)",
    downtime: {
      form: downtimeRow?.form ?? "(no downtime row)",
      madeAt: downtimeRow?.madeAt ?? null,
      typedExpiryAt: downtimeRow?.typedExpiryAt ?? null,
    },
    printStatus: legal.rows.find((row) => row.label === "Legal status")?.value ?? "(no row)",
    printExpiry: legal.rows.find((row) => row.label === "Paper expiry")?.value ?? "(no row)",
    downtimeEnded: downtimeRow?.formEnded === true,
  };
}

/** No output may carry a count worked out from the typed time (D-93). */
const COUNT = /\b\d+\s*[dhm]\b|\bleft\b|\bago\b|\boverdue\b|\bdue in\b/;

function expectAsRecorded(outputs: Outputs, movement: Movement, now: Instant, label: string) {
  const form = movement.legalForm!;
  const dueAt = form.dueAt!;
  const name = legalFormName(form);
  expect(outputs.page, `${label}: Legal forms page`).toBe(`Form expiry ${typedTimePhrase(dueAt, now, DAY_ZERO)}`);
  expect(outputs.shared, `${label}: shared screen wording`).toBe(`${name} · ${typedTimePhrase(dueAt, now, DAY_ZERO)}`);
  expect(outputs.tv, `${label}: TV`).toContain(name);
  expect(outputs.tv, `${label}: TV`).toContain(typedTimeLine(dueAt, now, DAY_ZERO));
  expect(outputs.downtime, `${label}: downtime pack`).toEqual({
    form: name,
    madeAt: movement.formedAt ?? null,
    typedExpiryAt: dueAt,
  });
  expect(outputs.printStatus, `${label}: printed handover`).toBe(name);
  expect(outputs.printExpiry, `${label}: printed handover`).toBe(typedTimeLine(dueAt, now, DAY_ZERO));
  for (const [where, text] of Object.entries({
    page: outputs.page,
    shared: outputs.shared,
    tv: outputs.tv,
    print: outputs.printExpiry,
  }))
    expect(text, `${label}: ${where} carries a count`).not.toMatch(COUNT);
}

/** Recorded, edited, then a second form: the states the test walks. */
function journey() {
  const seeded = seedWardFlowState();
  const recorded = apply(seeded, {
    type: "RECORD_LEGAL_FORM_WRITTEN",
    role: "ed",
    now: NOW,
    movementId: MOVEMENT_ID,
    formCode: "1A",
    writtenAt: NOW - 30,
    paperExpiresAt: NOW + 120,
  });
  const edited = apply(recorded, {
    type: "RECORD_LEGAL_FORM_WRITTEN",
    role: "ed",
    now: NOW + 1,
    movementId: MOVEMENT_ID,
    formCode: "1A",
    writtenAt: NOW - 25,
    paperExpiresAt: NOW + 150,
  });
  const second = apply(edited, {
    type: "RECORD_LEGAL_FORM_WRITTEN",
    role: "ed",
    now: NOW + 2,
    movementId: MOVEMENT_ID,
    formCode: "3A",
    writtenAt: NOW - 5,
    paperExpiresAt: NOW + 400,
  });
  return { recorded, edited, second };
}

describe("M17: one form, edited, replaced and lapsed, reads the same on every output", () => {
  it("shows the typed form and time on every output once recorded", () => {
    const { recorded } = journey();
    const movement = movementOf(recorded);
    expect(movement.legalForm?.dueAt).toBe(NOW + 120);
    expectAsRecorded(outputsAt(recorded, NOW), movement, NOW, "recorded");
  });

  it("shows only the edited time after an edit, nowhere the first one", () => {
    const { recorded, edited } = journey();
    const movement = movementOf(edited);
    expect(movement.formedAt).toBe(NOW - 25);
    const outputs = outputsAt(edited, NOW + 1);
    expectAsRecorded(outputs, movement, NOW + 1, "edited");
    const oldClock = typedClock(movementOf(recorded).legalForm!.dueAt!, NOW + 1, DAY_ZERO);
    for (const text of [outputs.page, outputs.shared, outputs.tv, outputs.printExpiry])
      expect(text).not.toContain(oldClock);
  });

  it("shows the second form, never the first, once a second form is recorded", () => {
    const { second } = journey();
    const movement = movementOf(second);
    expect(movement.legalForm?.code).toBe("3A");
    const outputs = outputsAt(second, NOW + 2);
    expectAsRecorded(outputs, movement, NOW + 2, "second form");
    for (const text of [outputs.shared, outputs.tv, outputs.downtime.form, outputs.printStatus])
      expect(text).not.toMatch(/\b1A\b/);
  });

  it("says 'Ended ... as typed' everywhere once the typed time has gone by, with no count", () => {
    const { second } = journey();
    const movement = movementOf(second);
    const lapsed = movement.legalForm!.dueAt! + 61;
    const outputs = outputsAt(second, lapsed);
    expectAsRecorded(outputs, movement, lapsed, "lapsed");
    expect(outputs.tv).toContain("Ended");
    expect(outputs.printExpiry.startsWith("Ended")).toBe(true);
    expect(outputs.page).toContain("ended");
  });

  // Fixed 10 Nov 2026 (M17, D-125): once a form is recorded as ended, the TV wall, downtime pack and
  // printed handover all read `legalForm.endedBy` and show the same words, never the old typed end.
  it("after a form is recorded as ended, the TV, downtime pack and print all say 'Recorded as ended'", () => {
    const { second } = journey();
    const ended = apply(second, {
      type: "RECORD_LEGAL_FORM_DETAILS",
      role: "ed",
      now: NOW + 3,
      movementId: MOVEMENT_ID,
      formCode: "3A",
      endedBy: "revoked",
    });
    const movement = movementOf(ended);
    const outputs = outputsAt(ended, NOW + 3);
    const name = legalFormName(movement.legalForm!);
    expect(currentLegalDueAt(movement)).toBeUndefined();
    expect(outputs.printStatus).toBe(name);
    expect(outputs.printExpiry).toBe(FORM_RECORDED_ENDED);
    expect(outputs.tv.startsWith(`${name}, `)).toBe(true);
    // Audit M13 (a): the TV adds the patient page's statuses-differ mark when the journey and the
    // patient record differ, after the form words.
    expect(outputs.tv.replace(`. ${LEGAL_STATUSES_DIFFER}`, "").endsWith(`. ${FORM_RECORDED_ENDED}`)).toBe(true);
    expect(outputs.tv).not.toContain(typedTimeLine(movement.legalForm!.dueAt!, NOW + 3, DAY_ZERO));
    expect(outputs.downtime.form).toBe(name);
    expect(outputs.downtime.typedExpiryAt).toBeNull();
    expect(outputs.downtimeEnded).toBe(true);
  });

  // Fixed 11 Nov 2026 (Josh): the Legal forms card and row said "Ended" then "Form expiry ends 15:42
  // as typed", which reads as a live expiry. The ended form's typed time is history, as typed.
  it("on the Legal forms page, an ended form's line says it ended and gives the typed expiry as history", () => {
    const { second } = journey();
    const ended = apply(second, {
      type: "RECORD_LEGAL_FORM_DETAILS",
      role: "ed",
      now: NOW + 3,
      movementId: MOVEMENT_ID,
      formCode: "3A",
      endedBy: "revoked",
    });
    const movement = movementOf(ended);
    const dueAt = movement.legalForm!.dueAt!;
    for (const now of [NOW + 3, dueAt + 61]) {
      const page = legalDeadlineText(movement, now, DAY_ZERO);
      expect(page).toBe(`Form ended; expiry as typed was ${typedClock(dueAt, now, DAY_ZERO)}`);
      expect(page).not.toContain(typedTimePhrase(dueAt, now, DAY_ZERO));
      expect(page).not.toMatch(COUNT);
    }
    const noTime = { ...movement, legalForm: { ...movement.legalForm!, dueAt: undefined } } as Movement;
    expect(legalDeadlineText(noTime, NOW + 3)).toBe("Form ended");
  });

  it("names the form on the TV wall by its full name (D-93), not the bare code", () => {
    const { second } = journey();
    const outputs = outputsAt(second, NOW + 2);
    expect(outputs.tv.startsWith(`${legalFormName(movementOf(second).legalForm!)},`)).toBe(true);
  });

  // 1.6 (K29, 13 Nov 2026): the ED list download carries the form's end, from the one current legal
  // position, as the screens show it: the typed time as typed, then "Recorded as ended".
  it("writes the form's end in the ED list download, as typed, then as recorded ended", () => {
    const { second } = journey();
    const at = (instant: Instant) => `T${instant}`;
    const ctx = {
      department: "Synthetic ED",
      umrnOf: () => "UM000001",
      bayOf: () => "Bay 01",
      stageOf: () => "x",
      minutesOf: () => 0,
      at,
    };
    const formEndColumn = ED_EXPORT_HEADER.indexOf("Form end");
    expect(formEndColumn).toBeGreaterThan(0);
    const live = movementOf(second);
    expect(edExportLines([live], ctx)[1]![formEndColumn]).toBe(`${at(live.legalForm!.dueAt!)} as typed`);
    const ended = apply(second, {
      type: "RECORD_LEGAL_FORM_DETAILS",
      role: "ed",
      now: NOW + 3,
      movementId: MOVEMENT_ID,
      formCode: "3A",
      endedBy: "revoked",
    });
    expect(edExportLines([movementOf(ended)], ctx)[1]![formEndColumn]).toBe(FORM_RECORDED_ENDED);
  });
});
