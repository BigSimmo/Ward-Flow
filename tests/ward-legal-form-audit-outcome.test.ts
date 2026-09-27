import { describe, expect, it } from "vitest";

import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { LEGAL_FORM_RECEIPT_CORRECTION_REASONS } from "@/components/ward-management/ward-change-reasons";

/**
 * Audit 2026-09-25: RECORD_LEGAL_FORM_EXPIRY and CORRECT_LEGAL_FORM_RECEIPT are audited as
 * "legal-form", but neither set its decision, so a stored change was written to the audit trail
 * as "denied / transition".
 */

const ED_ID = allEmergencyDepartments()[0]!.id;
const NOW = 9 * 60;

function raise1A() {
  const before = seedWardFlowState();
  const after = wardFlowReducer(before, {
    type: "RAISE_REFERRAL",
    role: "ed",
    now: NOW,
    edId: ED_ID,
    draft: {
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      specialling: false,
      highAcuity: false,
      legalStatus: "Detained awaiting examination",
      urgency: 2,
      legalFormCode: "1A",
    },
  });
  expect(after.rejections).toEqual([]);
  const created = after.movements.find((movement) => !before.movements.some((existing) => existing.id === movement.id));
  return { state: after, movementId: created!.id };
}

describe("legal-form events are audited with the outcome they actually had", () => {
  it("records a successful expiry entry as accepted", () => {
    const { state, movementId } = raise1A();
    const next = wardFlowReducer(state, {
      type: "RECORD_LEGAL_FORM_EXPIRY",
      role: "ed",
      now: NOW + 10,
      movementId,
      dueAt: NOW + 72 * 60,
    });
    expect(next.rejections).toEqual([]);
    const row = next.auditEvents.at(-1)!;
    expect(row.category).toBe("legal-form");
    expect(row.outcome).toBe("accepted");
  });

  it("records a successful receipt correction as accepted", () => {
    const { state, movementId } = raise1A();
    const received = wardFlowReducer(state, {
      type: "RECORD_LEGAL_FORM_RECEIVED",
      role: "ed",
      now: NOW + 20,
      movementId,
    });
    expect(received.rejections).toEqual([]);
    const corrected = wardFlowReducer(received, {
      type: "CORRECT_LEGAL_FORM_RECEIPT",
      role: "ed",
      now: NOW + 30,
      movementId,
      reason: LEGAL_FORM_RECEIPT_CORRECTION_REASONS[0]!,
    });
    expect(corrected.rejections).toEqual([]);
    const row = corrected.auditEvents.at(-1)!;
    expect(row.category).toBe("legal-form");
    expect(row.outcome).toBe("accepted");
  });

  it("still records a refused expiry as denied", () => {
    const { state, movementId } = raise1A();
    const next = wardFlowReducer(state, {
      type: "RECORD_LEGAL_FORM_EXPIRY",
      role: "ed",
      now: NOW + 10,
      movementId,
      dueAt: Number.NaN,
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.auditEvents.at(-1)!.outcome).toBe("denied");
  });
});
