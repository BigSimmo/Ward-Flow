// Batch 3 items 21 and 23 (feature build plan; D-136 item 2, 10 Nov 2026). Item 21: near the end of a
// shift the handover page lists a desk's own open work with "Hand to"; the receiving desk taps Accept,
// and until then the item stays with the sender. Item 23: "Carer wants a call back", best after a
// typed time, shown in handover's promises due once that time comes and cleared when ticked off.
// Synthetic data only.
import { describe, expect, it } from "vitest";

import type { HandedItemRef, HandoverWorkEvent, WorkDesk } from "@/components/ward-management/handover-work-events";
import {
  HANDOVER_OWN_WORK_LEAD_MINUTES,
  carerCallbacksDue,
  incomingHandOvers,
  itemOwner,
  nextClockInstant,
  ownWorkItems,
  ownWorkListOpen,
  pendingHandOver,
} from "@/components/ward-management/handover-work-model";
import { promisesHeroAct } from "@/components/ward-management/handover/handover-open-promises";
import {
  currentReferralOwner,
  referralClosedForFollowUp,
} from "@/components/ward-management/referrals/referral-owner-and-calls-model";
import { shiftEndInstant } from "@/components/ward-management/ward-board-time-features";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const demo = seedWardFlowState();
// The rules below start from no carer callback or hand-over; the demo's own example rows are checked last.
const seed: WardFlowState = { ...demo, carerCallbacks: [], handedItems: [] };
const stay = seed.admissions.find((admission) => admission.state === "occupied")!;
const WARD = stay.unitId;
const otherWard = seed.units.find((unit) => unit.id !== WARD)!.id;
const wardDesk: WorkDesk = { role: "ward", unitId: WARD };
const coordinatorDesk: WorkDesk = { role: "coordinator" };

const apply = (state: WardFlowState, event: HandoverWorkEvent) => wardFlowReducer(state, event);
const refused = (before: WardFlowState, after: WardFlowState) => after.rejections.length > before.rejections.length;

/** A ward records a carer callback on its own patient, best after one hour from now. */
function withCallback(at = NOW_ANCHOR, bestAfter = NOW_ANCHOR + 60): WardFlowState {
  const state = apply(seed, {
    type: "RECORD_CARER_CALLBACK",
    role: "ward",
    now: at,
    admissionId: stay.id,
    bestAfter,
    actingUnitId: WARD,
  });
  expect(refused(seed, state)).toBe(false);
  return state;
}

/** Which of the given desks list the item as their own. "One owner" means exactly one of them. */
function owners(state: WardFlowState, item: HandedItemRef, desks: readonly WorkDesk[]): WorkDesk[] {
  const key = JSON.stringify(item);
  return desks.filter((desk) => ownWorkItems(state, desk).some((row) => JSON.stringify(row.item) === key));
}

describe("end-of-shift handover of your own work (item 21)", () => {
  it("reads its lead time from the signed clinical value, never a bare number", () => {
    expect(HANDOVER_OWN_WORK_LEAD_MINUTES).toBe(CLINICAL_VALUES.handoverOwnWorkLead.value);
    expect(HANDOVER_OWN_WORK_LEAD_MINUTES).toBe(30);
  });

  it("opens the list 30 minutes before the shift ends, and not at 31", () => {
    const end = shiftEndInstant(NOW_ANCHOR);
    expect(ownWorkListOpen(end - HANDOVER_OWN_WORK_LEAD_MINUTES)).toBe(true);
    expect(ownWorkListOpen(end - HANDOVER_OWN_WORK_LEAD_MINUTES - 1)).toBe(false);
    expect(ownWorkListOpen(end - 1)).toBe(true);
  });

  it("keeps one owner at all times: an unaccepted hand-over leaves the item with its sender", () => {
    let state = withCallback();
    const callback = state.carerCallbacks![0]!;
    const item: HandedItemRef = { kind: "callback", callbackId: callback.id };
    const desks = [wardDesk, coordinatorDesk];
    expect(owners(state, item, desks)).toEqual([wardDesk]);

    const handed = apply(state, {
      type: "HAND_OVER_ITEM",
      role: "ward",
      now: NOW_ANCHOR + 5,
      item,
      toRole: "coordinator",
      actingUnitId: WARD,
    });
    expect(refused(state, handed)).toBe(false);
    state = handed;
    // Not accepted: still the ward's, shown to the ward as handed, and to the coordinator to accept.
    expect(itemOwner(state, item)).toEqual(wardDesk);
    expect(owners(state, item, desks)).toEqual([wardDesk]);
    expect(ownWorkItems(state, wardDesk)[0]!.pending?.to).toEqual(coordinatorDesk);
    expect(incomingHandOvers(state, coordinatorDesk).map((record) => record.id)).toEqual(["HI-1"]);
    expect(incomingHandOvers(state, wardDesk)).toEqual([]);

    const accepted = apply(state, {
      type: "ACCEPT_HANDED_ITEM",
      role: "coordinator",
      now: NOW_ANCHOR + 9,
      handedItemId: "HI-1",
    });
    expect(refused(state, accepted)).toBe(false);
    expect(itemOwner(accepted, item)).toEqual(coordinatorDesk);
    expect(owners(accepted, item, desks)).toEqual([coordinatorDesk]);
    expect(incomingHandOvers(accepted, coordinatorDesk)).toEqual([]);
    expect(pendingHandOver(accepted, item)).toBeUndefined();
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(accepted)))).toBe(true);
  });

  it("lets only the owner hand an item on, and only the named desk accept it", () => {
    const state = withCallback();
    const item: HandedItemRef = { kind: "callback", callbackId: state.carerCallbacks![0]!.id };
    const notOwner = apply(state, {
      type: "HAND_OVER_ITEM",
      role: "coordinator",
      now: NOW_ANCHOR,
      item,
      toRole: "ward",
    });
    expect(refused(state, notOwner)).toBe(true);
    const handed = apply(state, {
      type: "HAND_OVER_ITEM",
      role: "ward",
      now: NOW_ANCHOR,
      item,
      toRole: "coordinator",
      actingUnitId: WARD,
    });
    const wrongDesk = apply(handed, {
      type: "ACCEPT_HANDED_ITEM",
      role: "ward",
      now: NOW_ANCHOR + 1,
      handedItemId: "HI-1",
      actingUnitId: otherWard,
    });
    expect(refused(handed, wrongDesk)).toBe(true);
    expect(itemOwner(wrongDesk, item)).toEqual(wardDesk);
  });

  it("lets a hand-over lapse when its item closes, so a stale Accept moves nothing", () => {
    const state = withCallback();
    const callbackId = state.carerCallbacks![0]!.id;
    const handed = apply(state, {
      type: "HAND_OVER_ITEM",
      role: "ward",
      now: NOW_ANCHOR,
      item: { kind: "callback", callbackId },
      toRole: "coordinator",
      actingUnitId: WARD,
    });
    const made = apply(handed, {
      type: "MARK_CARER_CALLBACK_MADE",
      role: "ward",
      now: NOW_ANCHOR + 2,
      callbackId,
      actingUnitId: WARD,
    });
    expect(incomingHandOvers(made, coordinatorDesk)).toEqual([]);
    const late = apply(made, {
      type: "ACCEPT_HANDED_ITEM",
      role: "coordinator",
      now: NOW_ANCHOR + 3,
      handedItemId: "HI-1",
    });
    expect(refused(made, late)).toBe(true);
  });

  it("hands a referral on through its owner record, so every screen reads the same owner", () => {
    const referral = seed.referrals.find((candidate) => !referralClosedForFollowUp(candidate))!;
    let state = wardFlowReducer(seed, {
      type: "ASSIGN_REFERRAL",
      role: "coordinator",
      now: NOW_ANCHOR,
      referralId: referral.id,
      owner: "coordinator",
    });
    const item: HandedItemRef = { kind: "referral", referralId: referral.id };
    state = apply(state, { type: "HAND_OVER_ITEM", role: "coordinator", now: NOW_ANCHOR + 1, item, toRole: "ed" });
    expect(currentReferralOwner(state.referrals.find((row) => row.id === referral.id)!)?.owner).toBe("coordinator");
    const accepted = apply(state, {
      type: "ACCEPT_HANDED_ITEM",
      role: "ed",
      now: NOW_ANCHOR + 2,
      handedItemId: "HI-1",
    });
    expect(refused(state, accepted)).toBe(false);
    expect(currentReferralOwner(accepted.referrals.find((row) => row.id === referral.id)!)?.owner).toBe("ed");
    expect(owners(accepted, item, [coordinatorDesk, { role: "ed" }])).toEqual([{ role: "ed" }]);
  });
});

describe("carer callback (item 23)", () => {
  it("shows in promises due once its best-after time comes, and not before", () => {
    const state = withCallback(NOW_ANCHOR, NOW_ANCHOR + 60);
    expect(carerCallbacksDue(state, NOW_ANCHOR + 59)).toEqual([]);
    expect(carerCallbacksDue(state, NOW_ANCHOR + 60).map((record) => record.admissionId)).toEqual([stay.id]);
    expect(promisesHeroAct([], NOW_ANCHOR + 60, false, () => undefined, 1)?.title).toBe("1 carer call back due");
    expect(promisesHeroAct([], NOW_ANCHOR + 60, false, () => undefined, 0)).toBeUndefined();
  });

  it("is cleared from promises due when ticked off", () => {
    const state = withCallback(NOW_ANCHOR, NOW_ANCHOR + 60);
    const made = apply(state, {
      type: "MARK_CARER_CALLBACK_MADE",
      role: "coordinator",
      now: NOW_ANCHOR + 70,
      callbackId: state.carerCallbacks![0]!.id,
    });
    expect(refused(state, made)).toBe(false);
    expect(carerCallbacksDue(made, NOW_ANCHOR + 70)).toEqual([]);
    const again = apply(made, {
      type: "MARK_CARER_CALLBACK_MADE",
      role: "coordinator",
      now: NOW_ANCHOR + 71,
      callbackId: state.carerCallbacks![0]!.id,
    });
    expect(refused(made, again)).toBe(true);
  });

  it("keeps no carer name or number: a stored callback with any other field is refused on restore", () => {
    const state = withCallback();
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
    const typed = JSON.parse(JSON.stringify(state)) as WardFlowState & { carerCallbacks: Record<string, unknown>[] };
    typed.carerCallbacks[0]!.carerPhone = "0400 000 000";
    expect(isValidStoredWardFlowState(typed)).toBe(false);
  });

  it("takes a typed time as the next time that clock face comes round, within a day", () => {
    expect(nextClockInstant(15 * 60, NOW_ANCHOR)).toBe(NOW_ANCHOR - (NOW_ANCHOR % 1440) + 15 * 60);
    expect(nextClockInstant(8 * 60, NOW_ANCHOR)).toBe(NOW_ANCHOR - (NOW_ANCHOR % 1440) + 1440 + 8 * 60);
    const past = apply(seed, {
      type: "RECORD_CARER_CALLBACK",
      role: "ward",
      now: NOW_ANCHOR,
      admissionId: stay.id,
      bestAfter: NOW_ANCHOR - 30,
      actingUnitId: WARD,
    });
    expect(refused(seed, past)).toBe(true);
  });

  it("lets a ward record a call back for its own patients only, and asking again moves the time", () => {
    const foreign = apply(seed, {
      type: "RECORD_CARER_CALLBACK",
      role: "ward",
      now: NOW_ANCHOR,
      admissionId: stay.id,
      bestAfter: NOW_ANCHOR + 30,
      actingUnitId: otherWard,
    });
    expect(refused(seed, foreign)).toBe(true);
    const state = withCallback(NOW_ANCHOR, NOW_ANCHOR + 30);
    const moved = apply(state, {
      type: "RECORD_CARER_CALLBACK",
      role: "coordinator",
      now: NOW_ANCHOR + 1,
      admissionId: stay.id,
      bestAfter: NOW_ANCHOR + 120,
    });
    expect(moved.carerCallbacks).toHaveLength(1);
    expect(moved.carerCallbacks![0]!.bestAfter).toBe(NOW_ANCHOR + 120);
  });
});

describe("demo example rows (items 21 and 23)", () => {
  it("seeds a call back the ward owes and one handed to that ward, waiting for Accept", () => {
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(demo)))).toBe(true);
    const [owed, handed] = demo.carerCallbacks ?? [];
    expect(owed?.owner.role).toBe("ward");
    const ward: WorkDesk = { role: "ward", unitId: owed!.unitId };
    expect(incomingHandOvers(demo, ward).map((record) => record.item)).toEqual([
      { kind: "callback", callbackId: handed!.id },
    ]);
    // Not accepted, so still the coordinator's.
    expect(itemOwner(demo, { kind: "callback", callbackId: handed!.id })).toEqual(coordinatorDesk);
    expect(carerCallbacksDue(demo, NOW_ANCHOR)).toEqual([]);
    expect(carerCallbacksDue(demo, NOW_ANCHOR + 30).map((record) => record.id)).toEqual([owed!.id]);
  });
});
