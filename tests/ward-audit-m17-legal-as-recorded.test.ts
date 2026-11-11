import { describe, expect, it } from "vitest";

import { edClinicalRows } from "@/components/ward-management/bed-meeting/tv-clinical-derivations";
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-form-progression";
import { legalDeadlineText } from "@/components/ward-management/legal-forms/legal-forms-derivations";
import {
  formTimeAsTyped,
  typedClock,
  typedTimeLine,
  typedTimePhrase,
} from "@/components/ward-management/legal-forms/legal-time-as-typed";
import { handoverPackModel } from "@/components/ward-management/patients/patient-handover-pack";
import { downtimePack } from "@/components/ward-management/reports/downtime-pack";
import type { Instant } from "@/components/ward-management/ward-clock";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

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
 * Clinical: where an output disagrees, the case is `it.todo` and is reported as a DEFECT for Josh.
 */

const MOVEMENT_ID = "WF-001";
const NOW = NOW_ANCHOR;

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
    now,
    identify: () => "Synthetic person",
  });
  const downtimeRow = pack.legalForms.find((row) => row.movementId === MOVEMENT_ID);
  const print = handoverPackModel({
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
  });
  const legal = print.sections.find((section) => section.id === "legal")!;
  return {
    page: legalDeadlineText(movement, now),
    shared: formTimeAsTyped(movement.legalForm!, now),
    tv: tvRow?.legal?.text ?? "(no TV row)",
    downtime: {
      form: downtimeRow?.form ?? "(no downtime row)",
      madeAt: downtimeRow?.madeAt ?? null,
      typedExpiryAt: downtimeRow?.typedExpiryAt ?? null,
    },
    printStatus: legal.rows.find((row) => row.label === "Legal status")?.value ?? "(no row)",
    printExpiry: legal.rows.find((row) => row.label === "Paper expiry")?.value ?? "(no row)",
  };
}

/** No output may carry a count worked out from the typed time (D-93). */
const COUNT = /\b\d+\s*[dhm]\b|\bleft\b|\bago\b|\boverdue\b|\bdue in\b/;

function expectAsRecorded(outputs: Outputs, movement: Movement, now: Instant, label: string) {
  const form = movement.legalForm!;
  const dueAt = form.dueAt!;
  const name = legalFormName(form);
  expect(outputs.page, `${label}: Legal forms page`).toBe(`Form expiry ${typedTimePhrase(dueAt, now)}`);
  expect(outputs.shared, `${label}: shared screen wording`).toBe(`${name} · ${typedTimePhrase(dueAt, now)}`);
  expect(outputs.tv, `${label}: TV`).toContain(`Form ${form.code}`);
  expect(outputs.tv, `${label}: TV`).toContain(typedTimeLine(dueAt, now));
  expect(outputs.downtime, `${label}: downtime pack`).toEqual({
    form: name,
    madeAt: movement.formedAt ?? null,
    typedExpiryAt: dueAt,
  });
  expect(outputs.printStatus, `${label}: printed handover`).toBe(name);
  expect(outputs.printExpiry, `${label}: printed handover`).toBe(typedTimeLine(dueAt, now));
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
    const oldClock = typedClock(movementOf(recorded).legalForm!.dueAt!, NOW + 1);
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

  it("after a form is recorded as ended, the print drops the expiry (currentLegalDueAt)", () => {
    const { second } = journey();
    const ended = apply(second, {
      type: "RECORD_LEGAL_FORM_DETAILS",
      role: "ed",
      now: NOW + 3,
      movementId: MOVEMENT_ID,
      formCode: "3A",
      endedBy: "revoked",
    });
    const outputs = outputsAt(ended, NOW + 3);
    expect(outputs.printExpiry).toBe("Not recorded");
  });

  // DEFECTS for Josh (clinical display; not changed here).
  it.todo(
    "M17 defect: after a form is recorded as ended (endedBy), the TV wall and downtime pack still show its typed end as current ('Ends HH:MM as typed' / typedExpiryAt), while the printed handover says 'Not recorded' (they read legalForm.dueAt, not currentLegalDueAt)",
  );
  it.todo(
    "M17 defect: the TV wall names the form by bare code ('Form 3A, involuntary inpatient') where D-93 asks for the full name ('Form 3A (title)') used by every other output",
  );
  it.todo(
    "M17 gap: the ED list download (ed-export.ts) writes 'Form 3A' with no written or typed end time; D-93 covers screens, print, TV and the downtime pack, so Josh to say whether the export counts as print",
  );
});

describe("M17 defect probes (show the disagreement, do not change behaviour)", () => {
  it("records that the TV and downtime pack keep an ended form's time today", () => {
    const { second } = journey();
    const ended = apply(second, {
      type: "RECORD_LEGAL_FORM_DETAILS",
      role: "ed",
      now: NOW + 3,
      movementId: MOVEMENT_ID,
      formCode: "3A",
      endedBy: "revoked",
    });
    const outputs = outputsAt(ended, NOW + 3);
    const dueAt = movementOf(ended).legalForm!.dueAt!;
    // Today's behaviour, pinned so a fix is noticed: when this flips, retire the todo above.
    expect(outputs.tv).toContain(typedTimeLine(dueAt, NOW + 3));
    expect(outputs.downtime.typedExpiryAt).toBe(dueAt);
    expect(currentLegalDueAt(movementOf(ended))).toBeUndefined();
  });

  it("records that the TV wall uses the bare code today", () => {
    const { second } = journey();
    const outputs = outputsAt(second, NOW + 2);
    expect(outputs.tv.startsWith("Form 3A,")).toBe(true);
    expect(outputs.tv).not.toContain(legalFormName(movementOf(second).legalForm!));
  });
});
