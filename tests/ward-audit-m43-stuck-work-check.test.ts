// M43 (master audit list, 10 Nov 2026; absorbs M73): the support check that flags referrals stuck
// past a set age and rising refusals (scripts/ward-flow/stuck-work-check.ts). Synthetic data only.
import { describe, expect, it } from "vitest";

import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { stuckWorkReport } from "../scripts/ward-flow/stuck-work-check";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

const NOW = NOW_ANCHOR;
const DAY = 24 * 60;

function withNewReferral(state: WardFlowState): { state: WardFlowState; referralId: string } {
  const next = wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW,
    ageBand: "Adult",
    destinations: [
      {
        kind: "psychiatric_ward",
        sex: "Female",
        gender: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source: "community",
    urgency: 2,
    originSiteCode: "SCGH",
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  } as WardFlowEvent);
  expect(next.rejections).toEqual([]);
  return { state: next, referralId: next.referrals.at(-1)!.id };
}

const flaggedIds = (state: WardFlowState, now: number) =>
  stuckWorkReport(state, now).stuckReferrals.map((entry) => entry.referralId);

describe("M43: stuck referrals past a set age", () => {
  it("flags a referral waiting for an answer only once it passes the age, with its age", () => {
    const { state, referralId } = withNewReferral(seedWardFlowState());
    expect(flaggedIds(state, NOW + DAY)).not.toContain(referralId);
    const report = stuckWorkReport(state, NOW + DAY + 1);
    expect(report.stuckReferrals).toContainEqual({
      referralId,
      state: "waiting for an answer",
      ageMinutes: DAY + 1,
    });
    expect(report.flagged).toBe(true);
  });

  it("does not flag a referral the referrer took back", () => {
    const { state, referralId } = withNewReferral(seedWardFlowState());
    const withdrawn: WardFlowState = {
      ...state,
      referrals: state.referrals.map((referral) =>
        referral.id === referralId
          ? { ...referral, destinations: referral.destinations.map((arm) => ({ ...arm, withdrawnAt: NOW + 5 })) }
          : referral,
      ),
    };
    expect(flaggedIds(withdrawn, NOW + 2 * DAY)).not.toContain(referralId);
  });

  it("flags a ward-accepted referral with no journey started, and clears it once one starts", () => {
    const { state, referralId } = withNewReferral(seedWardFlowState());
    const accepted = wardFlowReducer(state, {
      type: "ACCEPT_REFERRAL",
      role: "ward",
      now: NOW + 10,
      referralId,
      destinationKind: "psychiatric_ward",
      unitId: "scgh-adult-open",
      actingUnitId: "scgh-adult-open",
    } as WardFlowEvent);
    expect(accepted.rejections).toEqual([]);
    const report = stuckWorkReport(accepted, NOW + 2 * DAY);
    expect(report.stuckReferrals.find((entry) => entry.referralId === referralId)?.state).toBe("accepted, no journey");
    const started: WardFlowState = {
      ...accepted,
      movements: [...accepted.movements, { ...accepted.movements[0]!, id: "WF-M43-SYNTHETIC" as const, referralId }],
    };
    expect(flaggedIds(started, NOW + 2 * DAY)).not.toContain(referralId);
  });
});

describe("M43: rising refusals", () => {
  const denied = (at: number) => ({ at, outcome: "denied" }) as WardFlowState["auditEvents"][number];
  const base = { referrals: [], movements: [] };

  it("flags three or more refusals in the latest window when the window before had fewer", () => {
    const window = 6 * 60;
    const auditEvents = [denied(NOW - window - 10), denied(NOW - 30), denied(NOW - 20), denied(NOW - 10)];
    const report = stuckWorkReport({ ...base, auditEvents }, NOW);
    expect(report.refusals).toEqual({ latestWindow: 3, previousWindow: 1, rising: true });
    expect(report.flagged).toBe(true);
  });

  it("does not flag a steady or single refusal", () => {
    const window = 6 * 60;
    const steady = [NOW - window - 30, NOW - window - 20, NOW - window - 10, NOW - 30, NOW - 20, NOW - 10].map(denied);
    expect(stuckWorkReport({ ...base, auditEvents: steady }, NOW).refusals.rising).toBe(false);
    expect(stuckWorkReport({ ...base, auditEvents: [denied(NOW - 5)] }, NOW).flagged).toBe(false);
  });
});
