import { describe, expect, it } from "vitest";

/**
 * Features 6, 37 and 13 (9 Nov 2026): the discharge date trail and its slip, the discharge
 * checklist, and the community team's follow-up reply.
 */
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { DischargeDeskEvent } from "@/components/ward-management/discharges/discharge-check-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import {
  DISCHARGE_DATE_TRAIL_LIMIT,
  dischargeDateSlipDays,
  isDischargeDateTrail,
  nextDischargeDateTrail,
  slippingDischarges,
} from "@/components/ward-management/ward-discharge-date-trail";
import {
  dischargeChecklist,
  dischargeChecklistTally,
  isFollowUpReply,
  outstandingDischargeChecks,
} from "@/components/ward-management/ward-discharge-checklist";
import { eddMovedBadge } from "@/components/ward-management/ward/ward-bed-tone";
import { EDD_SLIP_FLAG_DAYS } from "@/components/ward-management/ward-operational-defaults";

const DAY = MINUTES_PER_DAY;

function stay(state: WardFlowState, id?: string) {
  const found = state.admissions.find((admission) =>
    id ? admission.id === id : admission.state === "occupied" && admission.expectedDischargeAt !== null,
  );
  if (!found) throw new Error("the seed has no such stay");
  return found;
}

const reduce = (state: WardFlowState, event: Record<string, unknown>) =>
  wardFlowReducer(state, { role: "ward", now: NOW_ANCHOR + 5, ...event } as WardFlowEvent);

describe("discharge date trail (feature 6)", () => {
  it("keeps the first date and appends each move, bounded", () => {
    const first = nextDischargeDateTrail(undefined, null, 10 * DAY, 0);
    expect(first).toEqual({ firstExpectedAt: 10 * DAY, revisions: [] });
    const moved = nextDischargeDateTrail(first, 10 * DAY, 14 * DAY, 60);
    expect(moved).toEqual({
      firstExpectedAt: 10 * DAY,
      revisions: [{ at: 60, previousExpectedAt: 10 * DAY, expectedAt: 14 * DAY }],
    });
    expect(nextDischargeDateTrail(moved, 14 * DAY, 14 * DAY, 90)).toBe(moved);
    // A stay saved before trails existed starts its trail at its earlier date.
    expect(nextDischargeDateTrail(undefined, 5 * DAY, 6 * DAY, 1)?.firstExpectedAt).toBe(5 * DAY);
    let trail = first;
    for (let index = 1; index <= DISCHARGE_DATE_TRAIL_LIMIT + 5; index += 1)
      trail = nextDischargeDateTrail(trail, (9 + index) * DAY, (10 + index) * DAY, index);
    expect(trail?.revisions).toHaveLength(DISCHARGE_DATE_TRAIL_LIMIT);
    expect(trail?.firstExpectedAt).toBe(10 * DAY);
    expect(isDischargeDateTrail(trail)).toBe(true);
    expect(isDischargeDateTrail({ firstExpectedAt: 1, revisions: [], note: "x" })).toBe(false);
  });

  it("measures slip in whole days, never below nought, and lists only stays over the flag", () => {
    const trail = { firstExpectedAt: 0, revisions: [] };
    expect(dischargeDateSlipDays({ dischargeDateTrail: trail, expectedDischargeAt: 5 * DAY })).toBe(5);
    expect(dischargeDateSlipDays({ dischargeDateTrail: trail, expectedDischargeAt: -2 * DAY })).toBe(0);
    expect(dischargeDateSlipDays({ expectedDischargeAt: 5 * DAY })).toBeNull();
    // Counted by calendar day, not elapsed hours: 22:00 to 08:00 four days later is four days.
    const late = { firstExpectedAt: 22 * 60, revisions: [] };
    expect(dischargeDateSlipDays({ dischargeDateTrail: late, expectedDischargeAt: 4 * DAY + 8 * 60 })).toBe(4);
    expect(dischargeDateSlipDays({ dischargeDateTrail: trail, expectedDischargeAt: 3 * DAY + 22 * 60 })).toBe(3);
    const rows = slippingDischarges(
      [
        { admissionId: "a", unitId: "u", departed: false, dischargeDateTrail: trail, expectedDischargeAt: 4 * DAY },
        { admissionId: "b", unitId: "u", departed: false, dischargeDateTrail: trail, expectedDischargeAt: 9 * DAY },
        { admissionId: "c", unitId: "u", departed: false, dischargeDateTrail: trail, expectedDischargeAt: 3 * DAY },
        { admissionId: "d", unitId: "u", departed: true, dischargeDateTrail: trail, expectedDischargeAt: 9 * DAY },
      ],
      EDD_SLIP_FLAG_DAYS,
    );
    expect(rows.map((row) => [row.admissionId, row.slipDays])).toEqual([
      ["b", 9],
      ["a", 4],
    ]);
  });

  it("UPDATE_EXPECTED_DISCHARGE records the trail, and the badge says the drift", () => {
    let state = seedWardFlowState();
    const admission = stay(state);
    const start = admission.expectedDischargeAt!;
    state = reduce(state, {
      type: "UPDATE_EXPECTED_DISCHARGE",
      admissionId: admission.id,
      actingUnitId: admission.unitId,
      expectedDischargeAt: start + 2 * DAY,
    });
    state = reduce(state, {
      type: "UPDATE_EXPECTED_DISCHARGE",
      admissionId: admission.id,
      actingUnitId: admission.unitId,
      expectedDischargeAt: start + 5 * DAY,
      now: NOW_ANCHOR + 10,
    });
    const updated = stay(state, admission.id);
    const trail = updated.dischargeDateTrail!;
    expect(trail.revisions.at(-1)).toEqual({
      at: NOW_ANCHOR + 10,
      previousExpectedAt: start + 2 * DAY,
      expectedAt: start + 5 * DAY,
    });
    expect(updated.dischargeDateMoves).toBe(admission.dischargeDateMoves + 2);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(state)))).toBe(true);
    expect(eddMovedBadge(2, 5)).toBe("Date moved 2 times, 5 days later");
    expect(eddMovedBadge(1, 4)).toBe("Date moved 1 time, 4 days later");
    expect(eddMovedBadge(1, 2)).toBeNull();
    expect(eddMovedBadge(2, null)).toBe("Date moved 2 times");
  });

  it("seeds a few drifting stays for the demo", () => {
    const state = seedWardFlowState();
    const rows = slippingDischarges(
      state.admissions.map((admission) => ({
        admissionId: admission.id,
        unitId: admission.unitId,
        departed: admission.state === "departed",
        dischargeDateTrail: admission.dischargeDateTrail,
        expectedDischargeAt: admission.expectedDischargeAt,
      })),
      EDD_SLIP_FLAG_DAYS,
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const admission of state.admissions)
      if (admission.dischargeDateTrail) {
        const revisions = admission.dischargeDateTrail.revisions;
        expect(revisions).toHaveLength(admission.dischargeDateMoves);
        // The last move is when the current date was set, after arrival, and the moves are in order.
        expect(revisions.at(-1)?.at).toBe(admission.dischargeDateSetAt);
        expect(revisions.at(-1)?.expectedAt).toBe(admission.expectedDischargeAt);
        for (const [index, revision] of revisions.entries()) {
          expect(revision.at).toBeGreaterThanOrEqual(admission.arrivedAt ?? -Infinity);
          if (index > 0) expect(revision.at).toBeGreaterThan(revisions[index - 1]!.at);
        }
      }
  });
});

describe("discharge checklist (feature 37)", () => {
  it("reads a ticked item first, then the discharge list and follow-up record, else outstanding", () => {
    const rows = dischargeChecklist({
      dischargeChecks: { gp_letter: { state: "done", at: 1, by: "ward" } },
      followUp: { state: "arranged" },
      dependencies: [{ kind: "pharmacy", owner: "pharmacy", state: "not_needed", at: 1, by: "Ward" }],
    });
    expect(rows.map((row) => [row.item, row.state, row.source])).toEqual([
      ["community_follow_up", "done", "follow_up"],
      ["medicines", "not_needed", "discharge_list"],
      ["carer_told", "outstanding", "none"],
      ["gp_letter", "done", "ticked"],
    ]);
    expect(dischargeChecklistTally(rows)).toEqual({ settled: 3, total: 4 });
    expect(outstandingDischargeChecks(rows)).toEqual(["Carer or family told"]);
  });

  it("keeps an item the discharge list holds outstanding, even with follow-up arranged", () => {
    const rows = dischargeChecklist({
      followUp: { state: "arranged" },
      dependencies: [{ kind: "community_follow_up", owner: "community_team", state: "outstanding", at: 1, by: "Ward" }],
    });
    expect([rows[0]?.item, rows[0]?.state, rows[0]?.source]).toEqual([
      "community_follow_up",
      "outstanding",
      "discharge_list",
    ]);
  });

  it("shows the community team's reply on the follow-up item", () => {
    const rows = dischargeChecklist({
      followUpReply: { state: "declined", reason: "Outside catchment", at: 1, by: "community" },
    });
    expect(rows[0]?.detail).toBe("Team reply: Declined: Outside catchment");
  });

  it("RECORD_DISCHARGE_CHECK records the state, and refuses another ward, an unlisted item or a repeat", () => {
    const before = seedWardFlowState();
    const admission = stay(before);
    const tick = (state: WardFlowState, fields: Record<string, unknown> = {}) =>
      reduce(state, {
        type: "RECORD_DISCHARGE_CHECK",
        admissionId: admission.id,
        actingUnitId: admission.unitId,
        item: "carer_told",
        state: "done",
        ...fields,
      });
    const after = tick(before);
    expect(stay(after, admission.id).dischargeChecks?.carer_told).toEqual({
      state: "done",
      at: NOW_ANCHOR + 5,
      by: "ward",
    });
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(after)))).toBe(true);
    for (const [state, fields] of [
      [before, { actingUnitId: "some-other-ward" }],
      [before, { item: "lunch" }],
      [before, { state: "maybe" }],
      [before, { role: "ed" }],
      [after, {}],
    ] as const) {
      expect(tick(state, fields).admissions).toEqual(state.admissions);
    }
  });
});

describe("the discharge desk event union", () => {
  it("names the checklist and follow-up reply events, so the shared event list carries both", () => {
    const types: DischargeDeskEvent["type"][] = ["RECORD_DISCHARGE_CHECK", "RECORD_FOLLOW_UP_REPLY"];
    expect(new Set(types).size).toBe(2);
  });
});

describe("community follow-up reply (feature 13)", () => {
  // AD-RPHS-14 came from a referral naming the Midland team.
  const team = "midland";
  const reply = (state: WardFlowState, fields: Record<string, unknown> = {}) =>
    reduce(state, {
      type: "RECORD_FOLLOW_UP_REPLY",
      role: "community",
      actingTeamId: team,
      admissionId: "AD-RPHS-14",
      reply: "declined",
      declineReason: "Outside catchment",
      ...fields,
    });

  it("records the team's reply with its reason, and the ward reads it back", () => {
    const after = reply(seedWardFlowState());
    const recorded = stay(after, "AD-RPHS-14").followUpReply;
    expect(recorded).toEqual({ state: "declined", reason: "Outside catchment", at: NOW_ANCHOR + 5, by: "community" });
    expect(isFollowUpReply(recorded)).toBe(true);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(after)))).toBe(true);
  });

  it("refuses another team, a ward, a decline with no reason, a reason without a decline and a repeat", () => {
    const before = seedWardFlowState();
    const after = reply(before);
    for (const [state, fields] of [
      [before, { actingTeamId: "inner-city-clinic" }],
      [before, { actingTeamId: undefined }],
      [before, { role: "ward" }],
      [before, { declineReason: undefined }],
      [before, { declineReason: "Too busy" }],
      [before, { reply: "accepted" }],
      [after, {}],
    ] as const) {
      expect(reply(state, fields).admissions).toEqual(state.admissions);
    }
    expect(
      stay(reply(before, { reply: "accepted", declineReason: undefined }), "AD-RPHS-14").followUpReply?.state,
    ).toBe("accepted");
  });
});
