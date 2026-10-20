import { describe, expect, it } from "vitest";

import { referralWorkedOnBy, workedOnLine } from "@/components/ward-management/referrals/referral-worked-on";
import { taskItems } from "@/components/ward-management/ward-act-now-items";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Smart features idea 3 (overall review, 20 Oct 2026): "Being worked on by <desk>" on a referral. */
const NOW = NOW_ANCHOR;

function fixture() {
  const seeded = seedWardFlowState();
  const unit = seeded.units[0]!;
  const base = seeded.referrals[0]!;
  const referral: Referral = {
    ...base,
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward",
          unitId: unit.id,
          sex: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state: "queued",
        referredAt: NOW - 60,
      },
    ],
  };
  // A bed request raised from this referral that has a row on the task list now, so a desk can
  // claim that row.
  const live = taskItems(seeded, NOW).map((item) => item.id);
  const template = seeded.movements.find(
    (movement) => !movement.closure && live.some((id) => id.endsWith(`-${movement.id}`)),
  )!;
  const rowId = live.find((id) => id.endsWith(`-${template.id}`))!;
  const movement: Movement = { ...template, referralId: base.id };
  const state: WardFlowState = {
    ...seeded,
    referrals: seeded.referrals.map((candidate) => (candidate.id === base.id ? referral : candidate)),
    movements: seeded.movements.map((candidate) => (candidate.id === movement.id ? movement : candidate)),
  };
  return { state, referralId: base.id, unit, movement, rowId };
}

/** The records the note reads, with the task rows on the list at `now` as the live rows. */
const recordsOf = (state: WardFlowState, now: number = NOW) => {
  const live = new Set(taskItems(state, now).map((item) => item.id));
  return { ...state, rowIsLive: (rowId: string) => live.has(rowId) };
};

const desksOf = (state: WardFlowState, referralId: string, now: number = NOW) =>
  referralWorkedOnBy(
    state.referrals.find((referral) => referral.id === referralId)!,
    recordsOf(state, now),
  );

describe("referralWorkedOnBy", () => {
  it("names nobody until a desk opens or claims the referral", () => {
    const f = fixture();
    expect(desksOf(f.state, f.referralId)).toEqual([]);
    expect(workedOnLine([])).toBeUndefined();
  });

  it("names the ward that opened it, by the ward's name, until that ward answers", () => {
    const f = fixture();
    const opened = wardFlowReducer(f.state, {
      type: "MARK_REFERRAL_OPENED",
      role: "ward",
      now: NOW,
      referralId: f.referralId,
      unitId: f.unit.id,
      actingUnitId: f.unit.id,
    });
    expect(opened.rejections).toEqual([]);
    expect(desksOf(opened, f.referralId)).toEqual([f.unit.name]);
    expect(workedOnLine(desksOf(opened, f.referralId))).toBe(`Being worked on by ${f.unit.name}`);
  });

  it("names the desk that took the referral's task row, by its desk name and never a person", () => {
    const f = fixture();
    const taken = wardFlowReducer(f.state, {
      type: "TAKE_INBOX_ITEM_OWNERSHIP",
      role: "coordinator",
      now: NOW,
      inboxItemId: f.rowId,
    });
    expect(taken.rejections).toEqual([]);
    expect(desksOf(taken, f.referralId)).toEqual(["Bed coordinator"]);

    const opened = wardFlowReducer(taken, {
      type: "MARK_REFERRAL_OPENED",
      role: "ward",
      now: NOW + 1,
      referralId: f.referralId,
      unitId: f.unit.id,
      actingUnitId: f.unit.id,
    });
    expect(workedOnLine(desksOf(opened, f.referralId))).toBe(`Being worked on by Bed coordinator and ${f.unit.name}`);
  });

  it("says nothing once the referral is no longer waiting for answers", () => {
    const f = fixture();
    const opened = wardFlowReducer(f.state, {
      type: "MARK_REFERRAL_OPENED",
      role: "ward",
      now: NOW,
      referralId: f.referralId,
      unitId: f.unit.id,
      actingUnitId: f.unit.id,
    });
    const referral = opened.referrals.find((candidate) => candidate.id === f.referralId)!;
    const answered: Referral = {
      ...referral,
      destinations: referral.destinations.map((arm) => ({ ...arm, state: "declined" as const, decidedAt: NOW + 5 })),
    };
    expect(referralWorkedOnBy(answered, recordsOf(opened))).toEqual([]);
  });

  it("names nobody for a claim on a task row that has since cleared (claims are never released)", () => {
    const f = fixture();
    const rowId = f.rowId;
    const taken = wardFlowReducer(f.state, {
      type: "TAKE_INBOX_ITEM_OWNERSHIP",
      role: "coordinator",
      now: NOW,
      inboxItemId: rowId,
    });
    expect(taken.rejections).toEqual([]);
    const referral = taken.referrals.find((candidate) => candidate.id === f.referralId)!;
    const cleared = { ...recordsOf(taken), rowIsLive: (id: string) => id !== rowId };
    expect(referralWorkedOnBy(referral, cleared)).toEqual([]);
  });
});
