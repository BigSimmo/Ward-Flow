import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer, INBOX_CATEGORIES } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { dueShort, type HandoverRow } from "@/components/ward-management/handover/handover-model";
import { bedHoldLapsed } from "@/components/ward-management/ward-bed-hold";
import { blockedDischargesByReason } from "@/components/ward-management/statistics/statistics-derivations";
import { causeOf } from "@/components/ward-management/delays/delays-derivations";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { absenceInboxItems } from "@/components/ward-management/ward-absence-tasks";
import { isOnOrder, stayLegalStatus } from "@/components/ward-management/ward-stay-legal";
import { inboxRowExists } from "@/components/ward-management/ward-inbox-reducer";
import { eligibleCandidatesAmong, buildActionInbox } from "@/components/ward-management/ward-derivations";
import { BED_RELEASE_BLOCKERS } from "@/components/ward-management/ward-change-reasons";
import { wardReferralInboxEntries } from "@/components/ward-management/referrals/referral-inbox";
import { WARD_SCENARIOS } from "@/components/ward-management/ward-scenarios";
import { NOW_ANCHOR as now } from "@/components/ward-management/ward-sites";

const copy = () => JSON.parse(JSON.stringify(seedWardFlowState())) as ReturnType<typeof seedWardFlowState>;

function onOrderAbsenceState() {
  const state = copy();
  const admission = state.admissions.find(
    (stay) => stay.state === "occupied" && isOnOrder(stayLegalStatus(stay, state)),
  )!;
  expect(admission).toBeDefined();
  const absent = wardFlowReducer(state, {
    type: "RECORD_ABSENT_WITHOUT_LEAVE",
    role: "ward",
    now,
    actingUnitId: admission.unitId,
    admissionId: admission.id,
  });
  expect(absent.rejections).toHaveLength(0);
  expect(isValidStoredWardFlowState(absent)).toBe(true);
  return absent;
}

describe("audit domain boundary regressions, 16 October 2026", () => {
  it.each([null, NaN, Infinity, "700"])("R02 rejects malformed expiry %s at restoration", (expiry) => {
    const state = copy();
    expect(isValidStoredWardFlowState(state)).toBe(true);
    const movement = state.movements.find((row) => row.stage === "pulled")!;
    Object.assign(movement, { pullExpiresAt: expiry });
    expect(isValidStoredWardFlowState(state)).toBe(false);
    movement.pullExpiresAt = now + 60;
    expect(isValidStoredWardFlowState(state)).toBe(true);
    delete movement.pullExpiresAt;
    expect(isValidStoredWardFlowState(state)).toBe(true);
  });

  it.each([null, NaN, Infinity, "700"])("R02 printed due text tolerates unexpected expiry %s", (expiry) => {
    const row = { stage: "pulled", pullExpiresAt: expiry } as unknown as HandoverRow;
    expect(dueShort(row, now)).toBeNull();
    expect(dueShort({ ...row, formDueAt: now + 30, formCode: "Form" }, now)).toContain("Form due");
    expect(dueShort({ ...row, pullExpiresAt: now + 10 }, now)).toContain("Pull ends");
  });

  it("R07 refuses unknown discharge blockers while retaining all known and null values", () => {
    const state = copy();
    const admission = state.admissions.find((row) => row.state === "occupied")!;
    Object.assign(admission, { blockReason: "SYNTHETIC-UNKNOWN-BLOCKER" });
    expect(isValidStoredWardFlowState(state)).toBe(false);
    for (const reason of [null, ...BED_RELEASE_BLOCKERS]) {
      admission.blockReason = reason;
      expect(isValidStoredWardFlowState(state)).toBe(true);
      expect(() => blockedDischargesByReason(state.admissions)).not.toThrow();
    }
  });

  it("R05 distinguishes stale-only capacity from a genuinely unavailable bed", () => {
    const state = copy();
    const movement = state.movements.find((row) => row.id === "WF-302")!;
    const unit = eligibleCandidatesAmong(movement, state.units, now, state.units.length).find(
      (row) => row.verdict.eligible,
    )!.unit;
    const stale = {
      ...unit,
      allocatable: { ...unit.allocatable, confirmedAt: now - unit.allocatable.staleAfterMinutes - 1 },
    };
    expect(
      eligibleCandidatesAmong(movement, [stale], now, 1)[0]
        .verdict.gates.filter((gate) => !gate.pass)
        .map((gate) => gate.gate),
    ).toEqual(["capacity_freshness"]);
    expect(
      buildActionInbox([movement], now, [stale]).some((row) =>
        row.id.startsWith(INBOX_CATEGORIES.no_eligible_bed.idPrefix),
      ),
    ).toBe(false);
    expect(causeOf(movement, [stale], now, DEFAULT_DUE_SOON_THRESHOLDS)).not.toBe("no_eligible_bed");
    const full = { ...unit, allocatable: { ...unit.allocatable, value: 0 }, allocatableLocked: 0 };
    expect(causeOf(movement, [full], now, DEFAULT_DUE_SOON_THRESHOLDS)).toBe("no_eligible_bed");
  });

  it("R10 expires a hold at equality, using the same boundary as bedHold", () => {
    const state = copy();
    const movement = state.movements.find((row) => row.stage === "pulled")!;
    delete movement.legalForm;
    delete movement.examination;
    movement.blocker = "";
    movement.pullExpiresAt = now;
    expect(bedHoldLapsed(now, now)).toBe(true);
    expect(causeOf(movement, state.units, now, DEFAULT_DUE_SOON_THRESHOLDS)).toBe("bed_pull_expired");
    movement.pullExpiresAt = now + 1;
    expect(causeOf(movement, state.units, now, DEFAULT_DUE_SOON_THRESHOLDS)).toBe("awaiting_bed_ready");
  });

  it.each(WARD_SCENARIOS)(
    "R06 gives %s answered ward referrals a real recipient and keeps their answers visible",
    (scenario) => {
      const state = seedWardFlowState(scenario);
      let answered = 0;
      for (const referral of state.referrals)
        for (const arm of referral.destinations) {
          if (arm.destination.kind !== "psychiatric_ward" || arm.state === "queued") continue;
          answered += 1;
          const unitId = arm.destination.unitId;
          expect(state.units.some((unit) => unit.id === unitId)).toBe(true);
          expect(
            wardReferralInboxEntries(state.referrals, unitId!).find((entry) => entry.id === referral.id)?.state,
          ).toBe(arm.state);
          if (arm.acceptedUnitId) expect(unitId).toBe(arm.acceptedUnitId);
        }
      expect(answered).toBeGreaterThan(0);
      if (scenario === "standard") {
        expect(
          state.referrals.find((referral) => referral.id === "RF-001")!.destinations[0].destination,
        ).not.toHaveProperty("unitId");
      }
    },
  );

  it("R44 acknowledges an admission-backed absence and refuses a missing absence row", () => {
    const state = onOrderAbsenceState();
    const bed = state.leaveBeds.find((row) => row.absentWithoutLeave !== undefined)!;
    const inboxItemId = INBOX_CATEGORIES.absent_without_leave.idPrefix + bed.admissionId;
    expect(isValidStoredWardFlowState(state)).toBe(true);
    expect(absenceInboxItems(state, now).some((row) => row.id === inboxItemId)).toBe(true);
    expect(inboxRowExists(state, inboxItemId)).toBe(true);
    const next = wardFlowReducer(state, { type: "ACKNOWLEDGE_INBOX_ITEM", role: "coordinator", now, inboxItemId });
    expect(next.rejections).toHaveLength(0);
    expect(next.inboxAcknowledgements[inboxItemId]).toEqual([{ at: now, by: "Flow coordinator" }]);
    const missing = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now,
      inboxItemId: INBOX_CATEGORIES.absent_without_leave.idPrefix + "MISSING",
    });
    expect(missing.rejections).toHaveLength(1);
    expect(missing.inboxAcknowledgements).toBe(state.inboxAcknowledgements);
    expect(missing.admissions).toBe(state.admissions);
    const wrongCategory = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now,
      inboxItemId: INBOX_CATEGORIES.planned_arrival_overdue.idPrefix + state.movements[0].id,
    });
    expect(wrongCategory.rejections).toHaveLength(1);
    const wrongRole = wardFlowReducer(state, { type: "ACKNOWLEDGE_INBOX_ITEM", role: "ward", now, inboxItemId });
    expect(wrongRole.rejections).toHaveLength(1);
    expect(wrongRole.inboxAcknowledgements).toBe(state.inboxAcknowledgements);
  });

  it("R44 refuses an AWOL id for a valid voluntary stay that has no derived inbox row", () => {
    const state = copy();
    const bed = state.leaveBeds[0];
    const admission = state.admissions.find((stay) => stay.id === bed.admissionId)!;
    const movement = state.movements.find((row) => row.id === admission.movementId);
    const patient = state.patients.find((row) => row.id === admission.patientId)!;
    if (movement) movement.legalStatus = "Voluntary";
    patient.legalStatus = "Voluntary";
    bed.absentWithoutLeave = { since: now - 1, steps: [] };
    const inboxItemId = INBOX_CATEGORIES.absent_without_leave.idPrefix + admission.id;
    expect(admission.state).toBe("occupied");
    expect(isValidStoredWardFlowState(state)).toBe(true);
    expect(isOnOrder(stayLegalStatus(admission, state))).toBe(false);
    expect(absenceInboxItems(state, now).some((row) => row.id === inboxItemId)).toBe(false);
    expect(inboxRowExists(state, inboxItemId)).toBe(false);
    const next = wardFlowReducer(state, { type: "ACKNOWLEDGE_INBOX_ITEM", role: "coordinator", now, inboxItemId });
    expect(next.rejections).toHaveLength(1);
    expect(next.inboxAcknowledgements).toBe(state.inboxAcknowledgements);
    expect(next.admissions).toBe(state.admissions);
    expect(next.leaveBeds).toBe(state.leaveBeds);
  });

  it.each(["departed", "missing admission", "returned"])("R44 refuses an absent-stay row after %s", (lifecycle) => {
    const state = onOrderAbsenceState();
    const bed = state.leaveBeds.find((row) => row.absentWithoutLeave !== undefined)!;
    const admission = state.admissions.find((stay) => stay.id === bed.admissionId)!;
    const inboxItemId = INBOX_CATEGORIES.absent_without_leave.idPrefix + admission.id;
    expect(absenceInboxItems(state, now).some((row) => row.id === inboxItemId)).toBe(true);
    if (lifecycle === "departed") admission.state = "departed";
    if (lifecycle === "missing admission")
      state.admissions = state.admissions.filter((stay) => stay.id !== admission.id);
    if (lifecycle === "returned") delete bed.absentWithoutLeave;
    expect(absenceInboxItems(state, now).some((row) => row.id === inboxItemId)).toBe(false);
    expect(inboxRowExists(state, inboxItemId)).toBe(false);
    const next = wardFlowReducer(state, { type: "ACKNOWLEDGE_INBOX_ITEM", role: "coordinator", now, inboxItemId });
    expect(next.rejections).toHaveLength(1);
    expect(next.inboxAcknowledgements).toBe(state.inboxAcknowledgements);
    expect(next.admissions).toBe(state.admissions);
    expect(next.leaveBeds).toBe(state.leaveBeds);
  });

  it("R24 audits a wrong-ward departure refusal as scope without changing the stay", () => {
    const state = copy();
    const admission = state.admissions.find((row) => row.state === "occupied")!;
    const next = wardFlowReducer(state, {
      type: "RECORD_LEAVING",
      role: "ward",
      actingUnitId: state.units.find((unit) => unit.id !== admission.unitId)!.id,
      now,
      admissionId: admission.id,
      leavingDestination: "discharged-to-the-community",
    });
    expect(next.rejections).toHaveLength(1);
    expect(next.admissions).toBe(state.admissions);
    expect(next.auditEvents.at(-1)?.reasonCode).toBe("scope");
  });

  it("R25 attributes broadcast stand-down to its actual actor", () => {
    const state = copy();
    const alert = state.broadcastAlerts[0];
    state.broadcastAlerts = [{ ...alert, id: "synthetic-alert", status: "active" }];
    const next = wardFlowReducer(state, {
      type: "STAND_DOWN_BROADCAST_ALERT",
      role: "coordinator",
      now,
      alertId: "synthetic-alert",
      stoodDownByRole: "ed",
    });
    expect(next.rejections).toHaveLength(0);
    expect(next.broadcastAlerts[0].stoodDownBy).toBe("coordinator");
    const denied = wardFlowReducer(state, {
      type: "STAND_DOWN_BROADCAST_ALERT",
      role: "ed",
      now,
      alertId: "synthetic-alert",
      stoodDownByRole: "coordinator",
    });
    expect(denied.rejections).toHaveLength(1);
    expect(denied.broadcastAlerts).toBe(state.broadcastAlerts);
  });
});
