import { describe, expect, it } from "vitest";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Referral } from "@/components/ward-management/ward-model";
import type { SenderReferralPartialView } from "@/components/ward-management/ward-partial-view-contract";
import {
  referralPresentation,
  referralPresentationLists,
  movementPresentation,
} from "@/components/ward-management/ward-partial-view-presenters";
import {
  decidedReferrals,
  recentlyDecidedReferrals,
  referralQueueOrder,
  referralState,
  referralWithdrawable,
} from "@/components/ward-management/ward-referrals";

const source = seedWardFlowState();
const referral = source.referrals[0]!;
const masked: Referral = { ...referral, destinations: [] };
const summary: SenderReferralPartialView = {
  id: referral.id,
  kind: "sender",
  state: "queued",
  withdrawn: false,
  decidedAt: null,
  canWithdraw: true,
  informationNeeds: ["legal_form_copy"],
};

describe("response-only sender presentation", () => {
  it("retains queued status and the withdrawal hint when foreign request arms have been removed", () => {
    expect(referralWithdrawable(masked)).toBe(false);
    expect(referralPresentation(masked, summary)).toMatchObject({
      kind: "sender",
      state: "queued",
      withdrawn: false,
      canWithdraw: true,
      decidedAt: null,
    });
    expect(masked.destinations).toEqual([]);
  });

  it("uses the full-source decided result instead of treating an empty copy as queued", () => {
    expect(referralState(masked)).toBe("queued");
    expect(
      referralPresentation(masked, { ...summary, state: "declined", canWithdraw: false, decidedAt: 100 }),
    ).toMatchObject({
      state: "declined",
      decidedAt: 100,
      canWithdraw: false,
    });
  });

  it("makes a missing or wrong-record required summary explicitly unavailable", () => {
    for (const value of [null, { ...summary, id: "RF-SYNTHETIC-OTHER" }]) {
      expect(referralPresentation(masked, value)).toEqual({ kind: "unavailable" });
    }
    expect(referralPresentation(referral, undefined).kind).toBe("record");
  });

  it("keeps current record-only queue, history and display-cap results unchanged", () => {
    const lists = referralPresentationLists(source.referrals, () => undefined);
    expect(lists.queued).toEqual(referralQueueOrder(source.referrals));
    expect(lists.decided).toEqual(decidedReferrals(source.referrals));
    expect(lists.recentlyDecided).toEqual(recentlyDecidedReferrals(source.referrals));
    expect(lists.unavailable).toEqual([]);
  });

  it("classifies masked queued, declined, accepted and withdrawn records without fabricated arms", () => {
    const rows = ["queued", "declined", "accepted", "withdrawn", "missing"].map((suffix, index) => ({
      ...masked,
      id: `RF-SYNTHETIC-${suffix}`,
      raisedAt: index,
      urgency: 2 as const,
    }));
    const summaries = new Map(
      rows.slice(0, 4).map((row, index) => [
        row.id,
        {
          ...summary,
          id: row.id,
          state: index === 1 ? ("declined" as const) : index === 2 ? ("accepted" as const) : ("queued" as const),
          withdrawn: index === 3,
          canWithdraw: index === 0,
          decidedAt: index === 0 ? null : index * 100,
        },
      ]),
    );
    const before = JSON.stringify(rows);
    const lists = referralPresentationLists(rows, (row) => summaries.get(row.id) ?? null);
    expect(lists.queued.map((row) => row.id)).toEqual([rows[0]!.id]);
    expect(lists.decided.map((row) => row.id)).toEqual(rows.slice(1, 4).map((row) => row.id));
    expect(lists.recentlyDecided.map((row) => row.id)).toEqual([rows[3]!.id, rows[2]!.id, rows[1]!.id]);
    expect(lists.unavailable.map((row) => row.id)).toEqual([rows[4]!.id]);
    expect(JSON.stringify(rows)).toBe(before);
  });

  it("preserves longest-wait-first and urgency-tie ordering for mixed record and summary rows", () => {
    const rows = [
      { ...referral, id: "RF-SYNTHETIC-RECENT", raisedAt: 200, urgency: 1 as const },
      { ...referral, id: "RF-SYNTHETIC-OLD", raisedAt: 100, urgency: 3 as const },
      { ...referral, id: "RF-SYNTHETIC-TIE", raisedAt: 100, urgency: 1 as const },
    ].map((row) => ({
      ...row,
      destinations: [{ ...referral.destinations[0]!, state: "queued" as const, withdrawnAt: undefined }],
    }));
    const expected = referralQueueOrder(rows).map((row) => row.id);
    const maskedRows = rows.map((row, index) => (index === 0 ? row : { ...row, destinations: [] }));
    expect(
      referralPresentationLists(maskedRows, (row) =>
        row.id === rows[0]!.id ? undefined : { ...summary, id: row.id },
      ).queued.map((row) => row.id),
    ).toEqual(expected);
  });

  it("retains the existing history display cap without truncating its denominator", () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({ ...masked, id: `RF-SYNTHETIC-${index}` }));
    const lists = referralPresentationLists(rows, (row) => ({
      ...summary,
      id: row.id,
      state: "declined",
      canWithdraw: false,
      decidedAt: Number(row.id.split("-").at(-1)),
    }));
    expect(lists.decided).toHaveLength(12);
    expect(lists.recentlyDecided).toHaveLength(
      recentlyDecidedReferrals(
        rows.map((row, index) => ({
          ...row,
          destinations: [{ ...referral.destinations[0]!, state: "declined", decidedAt: index }],
        })),
      ).length,
    );
    expect(lists.recentlyDecided[0]!.id).toBe(rows[11]!.id);
  });

  it("keeps escalation truth separate from empty destination arrays and from action authority", () => {
    const movement = { ...source.movements[0]!, referredUnitIds: [], declines: [] };
    expect(
      movementPresentation(movement, {
        id: movement.id,
        kind: "sender",
        destinationStatus: "none_found",
        progress: "escalated",
        nextStep: "wait",
      }),
    ).toEqual({ kind: "sender", progress: "escalated", nextStep: "wait" });
    expect(movementPresentation(movement, null)).toEqual({ kind: "unavailable" });
    expect(
      movementPresentation(movement, {
        id: "WF-SYNTHETIC-OTHER",
        kind: "sender",
        destinationStatus: "accepted",
        progress: "accepted",
        nextStep: "pull",
      }),
    ).toEqual({ kind: "unavailable" });
  });
});
