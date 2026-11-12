import { describe, expect, it } from "vitest";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import {
  buildActionInbox,
  deriveNextWardsAfterRefusal,
  isOpen,
} from "../src/components/ward-management/ward-derivations";
import { activeSnooze, currentInboxOwner, partitionSnoozed } from "../src/components/ward-management/ward-inbox-snooze";
import { TRANSPORT_PROVIDERS } from "../src/components/ward-management/ward-model";
import { ABORIGINAL_OR_TORRES_STRAIT_ISLANDER_STATUSES } from "../src/components/ward-management/ward-patient-aboriginal-status";
import { readyBedsNow } from "../src/components/ward-management/ward-bed-states";
import {
  changesSinceLastLook,
  takeLastLookSnapshot,
} from "../src/components/ward-management/coordinator/since-last-look";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "../src/components/ward-management/ward-clock";
import { isValidStoredWardFlowState } from "../src/components/ward-management/ward-flow-storage-validation";

const now = 642;
function send(state: WardFlowState, event: WardFlowEvent) {
  const next = wardFlowReducer(state, event);
  expect(next.rejections).toEqual(state.rejections);
  return next;
}

describe("workflow audit regressions", () => {
  it.each([0, 8])("retires cancelled transport metadata even with a %i minute gap", (gap) => {
    let state = seedWardFlowState();
    const movementId = "WF-005",
      row = `transport-${movementId}`;
    state = send(state, {
      type: "SNOOZE_INBOX_ITEM",
      role: "coordinator",
      now,
      inboxItemId: row,
      until: now + 240,
      reason: "awaiting_call_back",
    });
    state = send(state, { type: "TAKE_INBOX_ITEM_OWNERSHIP", role: "coordinator", now, inboxItemId: row });
    const originalJob = state.movements.find((m) => m.id === movementId)!.transport!.id;
    const unrelatedSnoozes = state.inboxSnoozes;
    state = send(state, {
      type: "CANCEL_TRANSPORT",
      role: "coordinator",
      now: now + gap,
      movementId,
      reason: "provider_unavailable",
    });
    expect(state.inboxSnoozes[row]?.[0]).toEqual(unrelatedSnoozes[row]?.[0]);
    state = send(state, {
      type: "BOOK_TRANSPORT",
      role: "ed",
      now: now + gap,
      movementId,
      provider: TRANSPORT_PROVIDERS[0],
      escortRequired: false,
      cadNumber: "CAD-STUB-0002",
      transportLegalStatus: "voluntary",
      estimatedAt: now + 60,
    });
    state = send(state, { type: "TRANSPORT_ACCEPTED", role: "officer", now: now + gap, movementId });
    state = JSON.parse(JSON.stringify(state)) as WardFlowState;
    expect(isValidStoredWardFlowState(state)).toBe(true);
    expect(state.movements.find((m) => m.id === movementId)!.transport!.id).not.toBe(originalJob);
    const items = buildActionInbox(state.movements.filter(isOpen), now + gap + 1, state.units);
    const item = items.find((i) => i.id === row)!;
    expect(item).toBeDefined();
    expect(currentInboxOwner(state.inboxOwnership[row], item.since)).toBeUndefined();
    expect(partitionSnoozed(items, state.inboxSnoozes, now + gap + 1).active.map((i) => i.id)).toContain(row);
    // A legitimate snooze and ownership of the replacement in its first minute still work.
    state = send(state, {
      type: "SNOOZE_INBOX_ITEM",
      role: "coordinator",
      now: now + gap,
      inboxItemId: row,
      until: now + gap + 30,
      reason: "awaiting_call_back",
    });
    state = send(state, { type: "TAKE_INBOX_ITEM_OWNERSHIP", role: "coordinator", now: now + gap, inboxItemId: row });
    expect(activeSnooze(state.inboxSnoozes[row], now + gap + 1, item.since)).toBeDefined();
    expect(currentInboxOwner(state.inboxOwnership[row], item.since)).toBeDefined();
  });

  it("adds no inbox metadata when a cancelled booking had no snooze or owner", () => {
    let state = seedWardFlowState();
    const movementId = "WF-005";
    const before = { snoozes: state.inboxSnoozes, ownership: state.inboxOwnership };
    state = send(state, {
      type: "CANCEL_TRANSPORT",
      role: "coordinator",
      now,
      movementId,
      reason: "provider_unavailable",
    });
    expect(state.inboxSnoozes).toEqual(before.snoozes);
    expect(state.inboxOwnership).toEqual(before.ownership);
  });

  it("uses the board's Ready count in the change summary when a bed is already pulled", () => {
    let state = send(seedWardFlowState(), {
      type: "PULL_PATIENT",
      role: "coordinator",
      now,
      movementId: "WF-003",
      unitId: "rph-adult-secure",
    });
    const unit = state.units.find((u) => u.id === "rph-adult-secure")!;
    const before = takeLastLookSnapshot(state, now, DEFAULT_DUE_SOON_THRESHOLDS);
    const readyBefore = readyBedsNow(unit, state.admissions, state.bedReleases, [
      ...state.movements,
      ...state.referrals,
    ]);
    state = send(state, {
      type: "CONFIRM_CAPACITY",
      role: "ward",
      now: now + 1,
      unitId: unit.id,
      actingUnitId: unit.id,
      value: 2,
      expectedRevision: unit.allocatable.revision ?? 0,
    });
    const currentUnit = state.units.find((u) => u.id === unit.id)!;
    const after = takeLastLookSnapshot(state, now + 1, DEFAULT_DUE_SOON_THRESHOLDS);
    const readyAfter = readyBedsNow(currentUnit, state.admissions, state.bedReleases, [
      ...state.movements,
      ...state.referrals,
    ]);
    expect(readyAfter - readyBefore).toBe(1);
    expect(after.readyByUnit[unit.id]).toBe(readyAfter);
    expect(changesSinceLastLook(JSON.parse(JSON.stringify(before)), after, state)?.bedsFreed).toEqual([
      { unitId: unit.id, unitName: unit.name, count: 1 },
    ]);
  });

  it("never compares Ready counts with a picture taken on the old basis", () => {
    const state = seedWardFlowState();
    const after = takeLastLookSnapshot(state, now + 1, DEFAULT_DUE_SOON_THRESHOLDS);
    const unitId = Object.keys(after.readyByUnit).find((id) => after.readyByUnit[id]! > 0)!;
    // A picture saved before this release: no basis, and a lower Ready count for the same ward.
    const old = takeLastLookSnapshot(state, now, DEFAULT_DUE_SOON_THRESHOLDS);
    delete old.readyBasis;
    old.readyByUnit = { ...old.readyByUnit, [unitId]: after.readyByUnit[unitId]! - 1 };
    expect(changesSinceLastLook(JSON.parse(JSON.stringify(old)), after, state)?.bedsFreed ?? []).toEqual([]);
  });

  it.each([undefined, ...ABORIGINAL_OR_TORRES_STRAIT_ISLANDER_STATUSES])(
    "archives unused registrations with demographic answer %s",
    (status) => {
      let state = send(seedWardFlowState(), {
        type: "ADD_PATIENT",
        role: "coordinator",
        now,
        umrn: "SYN-ARCHIVE-AUDIT",
        givenName: "Synthetic",
        familyName: "Audit",
        dateOfBirth: "1980-01-01",
        ...(status === undefined ? {} : { aboriginalOrTorresStraitIslanderStatus: status }),
      });
      const patient = state.patients.at(-1)!;
      state = send(state, { type: "ARCHIVE_PATIENT", role: "coordinator", now, patientId: patient.id, reason: "test" });
      expect(state.patients.some((p) => p.id === patient.id)).toBe(false);
      expect(state.auditEvents.at(-1)?.outcome).toBe("accepted");
    },
  );

  it.each([false, true])("uses append order to break equal-minute refusal ties (reversed %s)", (reverse) => {
    let state = seedWardFlowState();
    const wards = reverse ? ["gry-older-adult", "bty-older-adult"] : ["bty-older-adult", "gry-older-adult"];
    for (const unitId of wards)
      state = send(state, {
        type: "DECLINE",
        role: "coordinator",
        now,
        movementId: "WF-013",
        unitId,
        reason: "capability_mismatch",
      });
    const movement = state.movements.find((m) => m.id === "WF-013")!;
    expect(deriveNextWardsAfterRefusal(movement, [], now)?.latestDecline.unitId).toBe(wards.at(-1));
  });
});
