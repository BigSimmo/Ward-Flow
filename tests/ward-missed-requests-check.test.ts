import { describe, expect, it } from "vitest";

import { dailyCheckId, dailyCheckRecord } from "@/components/ward-management/coordinator/daily-check";
import {
  missedRequestCheck,
  openRequestsByPerson,
} from "@/components/ward-management/coordinator/missed-requests-check";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Referral } from "@/components/ward-management/ward-model";

const NOW = 2 * 24 * 60;
const WINDOW = CLINICAL_VALUES.missedRequestWindow.value;

function fixture() {
  const state = seedWardFlowState();
  const base = state.movements[0]!;
  const movement = (id: string, patch: Partial<Movement>): Movement => ({
    ...base,
    id: id as Movement["id"],
    patientId: undefined,
    referralId: undefined,
    stage: "placement_requested",
    stageChanges: [],
    unwinds: [],
    declines: [],
    referredAt: undefined,
    referredUnitIds: [],
    waitlistedUnitIds: undefined,
    acceptedUnitId: undefined,
    heldBedNumber: undefined,
    closure: undefined,
    openedAt: NOW - 10,
    ...patch,
  });
  const check = (movements: Movement[], referrals: Referral[] = []) =>
    missedRequestCheck({ movements, referrals, patients: state.patients, now: NOW });
  return { state, movement, check };
}

describe("missedRequestCheck", () => {
  it("lists an open request with no ward asked once the window has passed", () => {
    const f = fixture();
    const items = f.check([
      f.movement("MV-old", { openedAt: NOW - WINDOW }),
      f.movement("MV-new", { openedAt: NOW - WINDOW + 1 }),
      f.movement("MV-asked", { openedAt: NOW - WINDOW * 3, referredUnitIds: [f.state.units[0]!.id] }),
      // Asked once; every ward since withdrawn. A ward was asked, so this is not "no ward asked".
      f.movement("MV-asked-before", { openedAt: NOW - WINDOW * 3, referredAt: NOW - WINDOW * 2 }),
      f.movement("MV-closed", {
        openedAt: NOW - WINDOW * 3,
        closure: { at: NOW - 5, outcome: "did_not_proceed", reason: "no_longer_required" } as Movement["closure"],
      }),
    ]);
    expect(items.map((item) => item.key)).toEqual(["no_ward_asked:MV-old"]);
    expect(items[0]!.since).toBe(NOW);
  });

  it("lists the same recorded person with two open requests, by the person link only", () => {
    const f = fixture();
    const personId = f.state.patients[0]!.id;
    const items = f.check([
      f.movement("MV-a", { patientId: personId, referredUnitIds: [f.state.units[0]!.id] }),
      f.movement("MV-b", { patientId: personId, referredUnitIds: [f.state.units[1]!.id] }),
      f.movement("MV-c", { referredUnitIds: [f.state.units[1]!.id] }),
    ]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "two_requests", movementIds: ["MV-a", "MV-b"] });
  });

  it("counts a referral still waiting on a ward or ED as an open request, once", () => {
    const f = fixture();
    const personId = f.state.patients[0]!.id;
    const unitId = f.state.units[0]!.id;
    const template = f.state.referrals[0]!;
    const referral = (id: string, raisedAt: number, state: "queued" | "accepted", withdrawnAt?: number): Referral => ({
      ...template,
      id,
      patientId: personId,
      raisedAt,
      destinations: [
        {
          destination: { kind: "psychiatric_ward", unitId },
          state,
          ...(withdrawnAt === undefined ? {} : { withdrawnAt }),
        } as Referral["destinations"][number],
      ],
    });

    // Two referrals waiting on wards, and no bed request at all.
    const twoReferrals = f.check([], [referral("RF-1", NOW - 60, "queued"), referral("RF-2", NOW - 30, "queued")]);
    expect(twoReferrals).toEqual([
      {
        kind: "two_requests",
        key: `two_requests:${personId}`,
        movementIds: [],
        referralIds: ["RF-1", "RF-2"],
        since: NOW - 30,
      },
    ]);

    // A referral with an open bed request raised from it is that bed request, not a second request.
    const raised = f.check(
      [f.movement("MV-a", { referralId: "RF-1", referredUnitIds: [unitId] })],
      [referral("RF-1", NOW - 60, "queued")],
    );
    expect(raised).toEqual([]);

    // Answered or withdrawn referrals are not open.
    const settled = f.check(
      [f.movement("MV-a", { patientId: personId, referredUnitIds: [unitId] })],
      [referral("RF-2", NOW - 60, "accepted"), referral("RF-3", NOW - 60, "queued", NOW - 5)],
    );
    expect(settled).toEqual([]);

    // The shared matcher itself, oldest first, for the duplicate bed request warning to reuse.
    const shared = openRequestsByPerson({
      movements: [f.movement("MV-a", { patientId: personId, openedAt: NOW - 10 })],
      referrals: [referral("RF-1", NOW - 60, "queued")],
      patients: f.state.patients,
    });
    expect(shared.get(personId)).toEqual([
      { kind: "referral", id: "RF-1", openedAt: NOW - 60 },
      { kind: "movement", id: "MV-a", openedAt: NOW - 10 },
    ]);
  });

  it("lists one numbered bed held for two open requests", () => {
    const f = fixture();
    const unitId = f.state.units[0]!.id;
    const held = (id: string, heldBedNumber: number) =>
      f.movement(id, { stage: "pulled", acceptedUnitId: unitId, heldBedNumber, referredUnitIds: [unitId] });
    const items = f.check([held("MV-1", 4), held("MV-2", 4), held("MV-3", 5)]);
    expect(items.map((item) => item.kind)).toEqual(["bed_held_twice"]);
    expect(items[0]!.movementIds).toEqual(["MV-1", "MV-2"]);
  });

  it("lists a bed referral an ED accepted with no bed request raised from it", () => {
    const f = fixture();
    const template = f.state.referrals[0]!;
    const edReferral = (id: string, decidedAt: number): Referral => ({
      ...template,
      id,
      destinations: [
        {
          destination: { kind: "emergency_department", edId: "RPH", purpose: "bed" },
          state: "accepted",
          decidedAt,
        } as Referral["destinations"][number],
      ],
    });
    const items = f.check(
      [f.movement("MV-raised", { referralId: "RF-raised", referredUnitIds: [f.state.units[0]!.id] })],
      [edReferral("RF-missed", NOW - WINDOW), edReferral("RF-raised", NOW - WINDOW), edReferral("RF-recent", NOW - 5)],
    );
    expect(items.map((item) => item.key)).toEqual(["no_bed_request:RF-missed"]);
  });

  it("says nothing on a network where every request is asked and none is doubled", () => {
    const f = fixture();
    expect(f.check([f.movement("MV-ok", { referredUnitIds: [f.state.units[0]!.id] })])).toEqual([]);
  });
});

describe('Daily check "Mark all checked" (overall review, 20 Oct 2026; P027 wording)', () => {
  const complete = (state: ReturnType<typeof seedWardFlowState>, inboxItemId: string, role = "coordinator") =>
    wardFlowReducer(state, { type: "COMPLETE_INBOX_ITEM", role: role as "coordinator", now: NOW + 5, inboxItemId });

  it("records the role and the time against today's check, once a day", () => {
    const state = seedWardFlowState();
    expect(dailyCheckRecord(state.inboxCompletions, NOW + 5)).toBeUndefined();

    const checked = complete(state, dailyCheckId(NOW + 5));
    expect(checked.rejections).toEqual([]);
    expect(dailyCheckRecord(checked.inboxCompletions, NOW + 5)).toEqual({
      at: NOW + 5,
      by: "Bed coordinator",
      kind: "completed",
    });
    // Nothing else moves: the rules behind the list still run on the same records.
    expect(checked.movements).toEqual(state.movements);
    expect(checked.referrals).toEqual(state.referrals);

    // A second tick the same day is refused; the next day starts unticked.
    expect(complete(checked, dailyCheckId(NOW + 5)).rejections).toHaveLength(1);
    expect(dailyCheckRecord(checked.inboxCompletions, NOW + 24 * 60)).toBeUndefined();
    expect(dailyCheckId(NOW + 24 * 60)).not.toBe(dailyCheckId(NOW));
  });

  it("is the coordinator's alone and names a day, nothing else", () => {
    const state = seedWardFlowState();
    expect(complete(state, dailyCheckId(NOW), "ward").rejections).toHaveLength(1);
    expect(complete(state, "daily-check-WF-001").rejections).toHaveLength(1);
    expect(complete(state, "daily-check-day-1.5").rejections).toHaveLength(1);
  });
});
