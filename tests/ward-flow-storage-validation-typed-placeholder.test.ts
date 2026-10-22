import { describe, expect, it } from "vitest";

import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import {
  isValidStoredWardFlowState,
  typedCriterionNotKept,
} from "@/components/ward-management/ward-flow-storage-validation";
import { TYPED_TEXT_NOT_KEPT, typedTextOf } from "@/components/ward-management/ward-flow-typed-text-ledger";
import { redactTypedTextForDevice } from "@/components/ward-management/ward-flow-typed-text-scrub";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { TYPED_TEXT_FIXTURES } from "./helpers/ward-typed-text-fixtures";

/*
 * D-72 (21 Oct 2026): the restore fence holds repatriations, carer, PSP and MHAS records, planned
 * admission initials and patient specific discharge criteria with the placeholder in each typed
 * field, and still refuses the typed words themselves (D-18).
 */

const worlds = () => WARD_SCENARIOS.map((scenario) => seedWardFlowState(scenario));

function deviceCopy(label: string): WardFlowState {
  const fixture = TYPED_TEXT_FIXTURES.find((entry) => entry.label === label)!;
  const { before, event } = fixture.build(seedWardFlowState());
  const copy = redactTypedTextForDevice(wardFlowReducer(before, event), typedTextOf(event) ?? [], worlds);
  expect(copy).not.toBeNull();
  return structuredClone(copy!);
}

describe("restore fence with typed text not kept", () => {
  it("holds a repatriation whose CAD number is the placeholder, and refuses a typed one", () => {
    const copy = deviceCopy("RECORD_REPATRIATION");
    expect(copy.repatriations[0].cadNumber).toBe(TYPED_TEXT_NOT_KEPT);
    expect(isValidStoredWardFlowState(copy)).toBe(true);
    copy.repatriations[0].cadNumber = "CAD-SYNTHETIC-1";
    expect(isValidStoredWardFlowState(copy)).toBe(false);
  });

  it("refuses a repatriation for an admission the world does not hold", () => {
    const copy = deviceCopy("RECORD_REPATRIATION");
    copy.repatriations[0].admissionId = "AD-SYNTHETIC-MISSING";
    expect(isValidStoredWardFlowState(copy)).toBe(false);
  });

  it("refuses a repatriation naming an unknown hospital, or two for one admission", () => {
    const copy = deviceCopy("RECORD_REPATRIATION");
    const [row] = copy.repatriations;
    expect(
      isValidStoredWardFlowState({ ...copy, repatriations: [{ ...row, homeHospital: "Synthetic typed site" }] }),
    ).toBe(false);
    expect(isValidStoredWardFlowState({ ...copy, repatriations: [row, { ...row, at: row.at + 1 }] })).toBe(false);
  });

  it("holds a told record with the placeholder, and refuses a typed name or a later contact time", () => {
    const copy = deviceCopy("RECORD_SUPPORT_NOTIFICATION told (who)");
    const [row] = copy.supportNotifications!;
    expect(row.who).toBe(TYPED_TEXT_NOT_KEPT);
    expect(isValidStoredWardFlowState(copy)).toBe(true);
    expect(isValidStoredWardFlowState({ ...copy, supportNotifications: [{ ...row, who: "Synthetic carer" }] })).toBe(
      false,
    );
    expect(isValidStoredWardFlowState({ ...copy, supportNotifications: [{ ...row, contactedAt: row.at + 1 }] })).toBe(
      false,
    );
    expect(isValidStoredWardFlowState({ ...copy, supportNotifications: [{ ...row, subjectId: "MV-MISSING" }] })).toBe(
      false,
    );
    const { contactedAt: _contactedAt, ...noTime } = row;
    void _contactedAt;
    expect(isValidStoredWardFlowState({ ...copy, supportNotifications: [noTime] })).toBe(false);
    expect(
      isValidStoredWardFlowState({ ...copy, supportNotifications: [{ ...row, reason: TYPED_TEXT_NOT_KEPT }] }),
    ).toBe(false);
  });

  it("holds a not applicable record with the placeholder, and refuses a typed reason or a repeated id", () => {
    const copy = deviceCopy("RECORD_SUPPORT_NOTIFICATION not applicable (reason)");
    const [row] = copy.supportNotifications!;
    expect(row.reason).toBe(TYPED_TEXT_NOT_KEPT);
    expect(isValidStoredWardFlowState(copy)).toBe(true);
    expect(
      isValidStoredWardFlowState({ ...copy, supportNotifications: [{ ...row, reason: "Synthetic reason" }] }),
    ).toBe(false);
    expect(isValidStoredWardFlowState({ ...copy, supportNotifications: [row, row] })).toBe(false);
    expect(isValidStoredWardFlowState({ ...copy, supportNotifications: [{ ...row, who: TYPED_TEXT_NOT_KEPT }] })).toBe(
      false,
    );
  });

  it("holds planned admission initials as letters or the placeholder only", () => {
    const copy = deviceCopy("BOOK_PLANNED_ADMISSION with initials");
    const index = copy.plannedAdmissions.findIndex((row) => row.initials === TYPED_TEXT_NOT_KEPT);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(isValidStoredWardFlowState(copy)).toBe(true);
    copy.plannedAdmissions[index].initials = "ABC";
    expect(isValidStoredWardFlowState(copy)).toBe(true);
    copy.plannedAdmissions[index].initials = "Typed text";
    expect(isValidStoredWardFlowState(copy)).toBe(false);
  });

  it("names a booking whose initials were not kept without the placeholder in the initials slot", () => {
    const copy = deviceCopy("BOOK_PLANNED_ADMISSION with initials");
    const booking = copy.plannedAdmissions.find((row) => row.initials === TYPED_TEXT_NOT_KEPT)!;
    const info = resolveSubjectPatient(booking, copy);
    expect(info.displayName).toBe("Initials not kept on this device");
    expect(info.initials).toBe("UP");
  });

  it("holds patient specific criteria as numbered placeholders, and refuses typed ones", () => {
    const copy = deviceCopy("SET_DISCHARGE_CRITERIA with a patient specific criterion");
    const admission = copy.admissions.find((row) =>
      row.dischargeCriteria?.items.some((item) => item.criterion === typedCriterionNotKept(1)),
    );
    expect(admission).toBeDefined();
    expect(isValidStoredWardFlowState(copy)).toBe(true);
    const item = admission!.dischargeCriteria!.items.find((entry) => entry.criterion === typedCriterionNotKept(1))!;
    item.criterion = "Synthetic typed criterion";
    expect(isValidStoredWardFlowState(copy)).toBe(false);
  });

  it("numbers several typed criteria apart so each can still be ticked on its own", () => {
    expect(typedCriterionNotKept(1)).toBe(TYPED_TEXT_NOT_KEPT);
    expect(typedCriterionNotKept(2)).toBe(`${TYPED_TEXT_NOT_KEPT} (2)`);
  });
});
