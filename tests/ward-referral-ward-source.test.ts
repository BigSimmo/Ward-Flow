// Role access plan (Josh, 15 Oct 2026): a ward raises a ward-to-ward referral in its own name.
// The reducer takes `RECEIVE_REFERRAL` from role `ward` only as source `psychiatric_ward` with a
// real sending ward, as it takes role `ed` only as `ed_medical` (R9), so a ward cannot file a
// referral under another source. The sending ward must be the caller's own (`actingUnitId`).
import { describe, expect, it } from "vitest";

import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { REFERRAL_SOURCES, type ReferralSource } from "../src/components/ward-management/ward-model";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

const WARD_REFUSAL = "raised as role ward must carry source psychiatric_ward";

const otherSources = REFERRAL_SOURCES.filter((source) => source !== "psychiatric_ward");

function receiveFromWard(
  source: ReferralSource,
  state: WardFlowState,
  originUnitId?: string,
  actingUnitId: string | undefined = originUnitId,
) {
  const unit = state.units[0];
  return wardFlowReducer(state, {
    type: "RECEIVE_REFERRAL",
    role: "ward",
    now: NOW_ANCHOR,
    ageBand: unit.cohort,
    destinations: [
      {
        kind: "psychiatric_ward",
        sex: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    ],
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Armadale" },
    source,
    ...(originUnitId === undefined ? {} : { originUnitId }),
    ...(actingUnitId === undefined ? {} : { actingUnitId }),
    urgency: 2,
    originSiteCode: unit.siteCode,
    transportNeeded: false,
    ...FIXTURE_HISTORY,
  });
}

function newRejections(before: WardFlowState, after: WardFlowState): string[] {
  return after.rejections.slice(before.rejections.length).map((rejection) => rejection.reason);
}

describe("a ward raises a referral only as the sending ward", () => {
  it("has other sources to test, so the loop below is not vacuous", () => {
    expect(otherSources.length).toBeGreaterThan(0);
  });

  it("accepts a ward referral with source psychiatric_ward and a real sending ward", () => {
    const before = seedWardFlowState();
    const after = receiveFromWard("psychiatric_ward", before, before.units[0].id);
    expect(newRejections(before, after)).toEqual([]);
    expect(after.referrals.length).toBe(before.referrals.length + 1);
    const created = after.referrals.at(-1);
    expect(created?.source).toBe("psychiatric_ward");
    expect(created?.originUnitId).toBe(before.units[0].id);
  });

  it.each(otherSources.map((source) => [source] as const))("refuses a ward referral filed as %s", (source) => {
    const before = seedWardFlowState();
    const after = receiveFromWard(source, before, before.units[0].id);
    expect(newRejections(before, after).some((reason) => reason.includes(WARD_REFUSAL))).toBe(true);
    expect(after.referrals.length).toBe(before.referrals.length);
  });

  it("refuses a ward referral that names no sending ward", () => {
    const before = seedWardFlowState();
    const after = receiveFromWard("psychiatric_ward", before);
    expect(after.referrals.length).toBe(before.referrals.length);
    expect(newRejections(before, after).some((reason) => reason.includes("must name a real originUnitId"))).toBe(true);
  });

  it("refuses a ward referral sent in another ward's name", () => {
    const before = seedWardFlowState();
    const [acting, other] = before.units;
    const after = receiveFromWard("psychiatric_ward", before, other.id, acting.id);
    expect(after.referrals.length).toBe(before.referrals.length);
    expect(newRejections(before, after).some((reason) => reason.includes("must send from its own ward"))).toBe(true);
  });

  it("refuses a ward referral that does not say which ward is raising it", () => {
    const before = seedWardFlowState();
    const after = receiveFromWard("psychiatric_ward", before, before.units[0].id, "");
    expect(after.referrals.length).toBe(before.referrals.length);
    expect(newRejections(before, after).some((reason) => reason.includes("must send from its own ward"))).toBe(true);
  });
});
