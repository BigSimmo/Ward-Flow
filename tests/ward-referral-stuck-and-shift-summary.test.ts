/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import { shiftWindow, wardShiftSummary } from "@/components/ward-management/board/ward-shift-summary";
import { bedMeetingSheet } from "@/components/ward-management/capacity/bed-meeting-derivations";
import {
  noReplyLine,
  referralNoReplyWaits,
  stuckReferralsByPlace,
} from "@/components/ward-management/referrals/referral-no-reply";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { DEFAULT_DUE_SOON_THRESHOLDS, minuteOfDay } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Items 16 and 17 from Josh's 25 Oct 2026 list: the "Stuck: no reply" timer, its line on the
 * bed-meeting sheet, and the recorded-only ward shift summary. Synthetic seed data only.
 */

const state = seedWardFlowState();
const ward = state.units[0]!;
const base = state.referrals[0]!;
const limit = { referralDecisionTargetMinutes: 120 };

/** One referral, raised at `raisedAt`, waiting on `ward` (and optionally answered at `decidedAt`). */
function referral(id: string, raisedAt: number, arm: Partial<Referral["destinations"][number]> = {}): Referral {
  return {
    ...base,
    id,
    raisedAt,
    destinations: [{ destination: { kind: "psychiatric_ward", unitId: ward.id }, state: "queued", ...arm }],
  } as Referral;
}

describe("referral stuck: no reply within the Settings limit", () => {
  it("counts from the place's own referred time and flags only past the limit", () => {
    const sent = referral("RF-T1", NOW_ANCHOR - 500, { referredAt: NOW_ANCHOR - 100 });
    const [inside] = referralNoReplyWaits(sent, NOW_ANCHOR, limit, state.units);
    expect(inside).toMatchObject({ waitedMinutes: 100, pastLimit: false, place: ward.name });
    expect(noReplyLine([inside!])).toBeUndefined();

    const [past] = referralNoReplyWaits(sent, NOW_ANCHOR + 30, limit, state.units);
    expect(past!.pastLimit).toBe(true);
    expect(noReplyLine([past!])).toBe(`Stuck: no reply from ${ward.name} for 2h 10m (limit 2h 00m)`);
  });

  it("falls back to the raised time, and stops once the ward's answer is recorded", () => {
    expect(referralNoReplyWaits(referral("RF-T2", NOW_ANCHOR - 200), NOW_ANCHOR, limit, state.units)[0]).toMatchObject({
      waitedMinutes: 200,
      pastLimit: true,
    });
    const answered = referral("RF-T3", NOW_ANCHOR - 300, { state: "declined", decidedAt: NOW_ANCHOR - 10 });
    expect(referralNoReplyWaits(answered, NOW_ANCHOR, limit, state.units)).toEqual([]);
  });

  it("does not time a front-door referral to an emergency department, which triage answers", () => {
    const toEd = {
      ...referral("RF-T9", NOW_ANCHOR - 600),
      destinations: [{ destination: { kind: "emergency_department", siteCode: "RPH" }, state: "queued" }],
    } as unknown as Referral;
    expect(referralNoReplyWaits(toEd, NOW_ANCHOR, limit, state.units)).toEqual([]);
  });

  it("keeps timing a community team's reply after a ward has accepted", () => {
    const mixed = {
      ...referral("RF-T10", NOW_ANCHOR - 300),
      destinations: [
        { destination: { kind: "psychiatric_ward", unitId: ward.id }, state: "accepted", decidedAt: NOW_ANCHOR - 200 },
        { destination: { kind: "community_team", teamId: "team-x" }, state: "queued" },
      ],
    } as unknown as Referral;
    const waits = referralNoReplyWaits(mixed, NOW_ANCHOR, limit, state.units);
    expect(waits).toHaveLength(1);
    expect(waits[0]!.pastLimit).toBe(true);
  });

  it("follows the limit set in Settings", () => {
    const sent = referral("RF-T4", NOW_ANCHOR - 90);
    expect(referralNoReplyWaits(sent, NOW_ANCHOR, limit, state.units)[0]!.pastLimit).toBe(false);
    expect(
      referralNoReplyWaits(sent, NOW_ANCHOR, { referralDecisionTargetMinutes: 60 }, state.units)[0]!.pastLimit,
    ).toBe(true);
  });

  it("groups stuck referrals by ward for the bed-meeting sheet, counts only", () => {
    const referrals = [referral("RF-T5", NOW_ANCHOR - 400), referral("RF-T6", NOW_ANCHOR - 150)];
    expect(stuckReferralsByPlace(referrals, NOW_ANCHOR, limit, state.units)).toEqual([
      { place: ward.name, referrals: 2, longestMinutes: 400 },
    ]);
    const sheet = bedMeetingSheet({
      units: state.units,
      movements: state.movements,
      bedReleases: state.bedReleases,
      admissions: state.admissions,
      leaveBeds: state.leaveBeds,
      now: NOW_ANCHOR,
      thresholds: DEFAULT_DUE_SOON_THRESHOLDS,
      service: null,
      nameOf: () => "Synthetic",
      referrals,
      referralLimitMinutes: 120,
    });
    expect(sheet.stuckReferrals).toEqual({
      limitMinutes: 120,
      places: [{ place: ward.name, referrals: 2, longestMinutes: 400 }],
      morePlaces: 0,
    });
  });
});

describe("ward shift summary from recorded times", () => {
  it("uses the 07:00, 15:00 and 23:00 shifts, with night wrapping past midnight", () => {
    const day = NOW_ANCHOR - minuteOfDay(NOW_ANCHOR);
    expect(shiftWindow(day + 10 * 60, "current")).toMatchObject({ id: "day", from: day + 7 * 60, to: day + 15 * 60 });
    expect(shiftWindow(day + 10 * 60, "previous")).toMatchObject({ id: "night", from: day - 60, to: day + 7 * 60 });
    expect(shiftWindow(day + 2 * 60, "current")).toMatchObject({ id: "night", from: day - 60 });
    expect(shiftWindow(day + 23 * 60, "current")).toMatchObject({ id: "night", from: day + 23 * 60 });
  });

  it("counts only this ward's records whose time falls inside the shift", () => {
    const now = NOW_ANCHOR;
    const { from } = shiftWindow(now, "current");
    const template = state.admissions.find((admission) => admission.unitId === ward.id)!;
    const admission = (patch: Partial<Admission>): Admission => ({ ...template, ...patch });
    const admissions = [
      admission({ id: "A1", arrivedAt: from + 1 }),
      admission({ id: "A2", arrivedAt: from - 1 }),
      admission({ id: "A3", state: "departed", leftAt: from + 5 }),
      admission({ id: "A4", unitId: "another-ward", arrivedAt: from + 2 }),
    ].map((entry) => ({
      ...entry,
      pulledAt: null,
      dischargeConfirmedAt: null,
      dischargeDateMoves: 0,
      observationChanges: [],
    }));
    const accepted = referral("RF-T7", from - 60, { state: "accepted", decidedAt: now });
    const stuck = referral("RF-T8", now - 500);
    const summary = wardShiftSummary({
      unit: ward,
      admissions: [
        ...admissions,
        admission({
          id: "A5",
          arrivedAt: null,
          pulledAt: null,
          dischargeConfirmedAt: null,
          dischargeDateMoves: 0,
          observationChanges: [],
        }),
      ],
      referrals: [accepted, stuck],
      configuration: limit,
      now,
      which: "current",
    });
    expect(summary).toMatchObject({
      arrived: 1,
      left: 1,
      referralsAccepted: 1,
      referralsDeclined: 0,
      referralsAwaitingReply: 1,
      referralsStuck: 1,
    });
  });
});
