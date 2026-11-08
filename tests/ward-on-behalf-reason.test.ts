import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { readOpenedDischargeRecord } from "@/components/ward-management/ward-discharge-records";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import {
  ON_BEHALF_REASONS,
  ON_BEHALF_REASON_REFUSAL,
  isOnBehalfReason,
} from "@/components/ward-management/ward-on-behalf-reason";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { validSharedCommand } from "../backend/ward-flow/command-schemas";

// D-80 item 17: a coordinator opening a ward's clinical record gives an "on behalf of the ward" reason.
const coordinator = { role: "coordinator" } as const;
function fixture() {
  const state = seedWardFlowState();
  const admission = state.admissions.find((row) => row.patientId !== null && row.state === "occupied");
  if (!admission) throw new Error("Linked occupied admission fixture required");
  admission.expectedDischargeAt = NOW_ANCHOR + 30;
  const open = {
    type: "OPEN_DISCHARGE_RECORD",
    now: NOW_ANCHOR,
    admissionId: admission.id,
    expectedGeneration: 0,
    requestId: 4,
  } as const;
  return { state, admission, open, ward: { role: "ward", actingUnitId: admission.unitId } as const };
}
const handle = { generation: 0, requestId: 4 };
/** The state as it is saved: plain JSON. */
const stored = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe("coordinator on behalf of the ward reason (D-80 item 17)", () => {
  it("refuses a coordinator's opening without a reason, logs the refusal and opens nothing", () => {
    const { state, admission, open } = fixture();
    const refused = wardFlowReducer(state, { ...open, ...coordinator });
    expect(readOpenedDischargeRecord(refused, coordinator, admission.id, handle)).toEqual({ status: "denied" });
    expect(refused.auditEvents.at(-1)).toMatchObject({
      category: "record-access",
      action: "OPEN_DISCHARGE_RECORD",
      outcome: "denied",
      reasonCode: "invalid-payload",
    });
    expect(refused.rejections.at(-1)?.reason).toBe(ON_BEHALF_REASON_REFUSAL);
  });

  it("refuses a reason that is not on the closed list, such as typed words", () => {
    const { state, admission, open } = fixture();
    const typed = { ...open, ...coordinator, onBehalfReason: "asked by phone" } as unknown as Parameters<
      typeof wardFlowReducer
    >[1];
    const refused = wardFlowReducer(state, typed);
    expect(readOpenedDischargeRecord(refused, coordinator, admission.id, handle)).toEqual({ status: "denied" });
    expect(JSON.stringify(refused.auditEvents)).not.toContain("asked by phone");
  });

  it("opens with a listed reason and records it in the record access log", () => {
    const { state, admission, open } = fixture();
    for (const { id } of ON_BEHALF_REASONS) {
      const opened = wardFlowReducer(state, { ...open, ...coordinator, onBehalfReason: id });
      expect(readOpenedDischargeRecord(opened, coordinator, admission.id, handle).status).toBe("allowed");
      expect(opened.auditEvents.at(-1)).toMatchObject({
        category: "record-access",
        action: "OPEN_DISCHARGE_RECORD",
        outcome: "accepted",
        details: { requestId: 4, onBehalfReason: id },
      });
      // The saved workspace keeps the reason: the stored-state check accepts the logged opening.
      expect(isValidStoredWardFlowState(stored(opened))).toBe(true);
    }
  });

  it("asks no reason of the ward opening its own record, and refuses one it sends", () => {
    const { state, admission, open, ward } = fixture();
    const opened = wardFlowReducer(state, { ...open, ...ward });
    expect(readOpenedDischargeRecord(opened, ward, admission.id, handle).status).toBe("allowed");
    expect(opened.auditEvents.at(-1)?.details).not.toHaveProperty("onBehalfReason");
    const refused = wardFlowReducer(state, { ...open, ...ward, onBehalfReason: "ward-asked" });
    expect(refused.auditEvents.at(-1)).toMatchObject({ outcome: "denied", reasonCode: "invalid-payload" });
  });

  it("refuses a stored logged opening whose reason is off the list", () => {
    const { state, open } = fixture();
    const opened = wardFlowReducer(state, { ...open, ...coordinator, onBehalfReason: "bed-flow" });
    const tampered = stored(opened);
    expect(isValidStoredWardFlowState(tampered)).toBe(true);
    (tampered.auditEvents.at(-1)!.details as { onBehalfReason?: string }).onBehalfReason = "typed words";
    expect(isValidStoredWardFlowState(tampered)).toBe(false);
  });

  it("knows only the listed reasons", () => {
    expect(ON_BEHALF_REASONS.every(({ id }) => isOnBehalfReason(id))).toBe(true);
    expect(isOnBehalfReason("other")).toBe(false);
    expect(isOnBehalfReason(undefined)).toBe(false);
  });
});

describe("the shared server's command check (D-80 item 17)", () => {
  it("passes a listed reason and refuses any other value before the reducer", () => {
    const command = {
      type: "OPEN_DISCHARGE_RECORD",
      role: "coordinator",
      now: NOW_ANCHOR,
      admissionId: "AD-1",
      expectedGeneration: 0,
      requestId: 1,
    };
    expect(validSharedCommand({ ...command, onBehalfReason: "ward-asked" })).toBe(true);
    expect(validSharedCommand({ ...command, onBehalfReason: "asked by phone" })).toBe(false);
  });
});
