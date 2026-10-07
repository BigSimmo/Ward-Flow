import { describe, expect, it } from "vitest";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { ReferralIntakeDetails } from "@/components/ward-management/referrals/referral-submission";
import { referralIntakeError } from "@/components/ward-management/referrals/referral-submission";
import { wardReferralInboxEntries } from "@/components/ward-management/referrals/referral-inbox";
import { referralState, edReferralsFor } from "@/components/ward-management/ward-referrals";
import { communityScopedReferral } from "@/components/ward-management/ward-referral-visibility";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const intake: ReferralIntakeDetails = {
  catchment: { teamName: "Inner City Clinic", service: "East Metro", confirmed: true },
  reasonForReferral: "Synthetic referral for assessment",
  legalStatus: "Voluntary",
  riskFlags: ["absconding"],
  medicalClearance: {
    cleared: false,
    expectedAt: "2026-10-07T18:00+08:00",
    contactName: "Demo Doctor",
    contactPhone: "0412345678",
  },
  triageAndRampCompleted: false,
  additionalDocuments: false,
  charts: ["medication", "observation"].map((kind) => ({
    kind: kind as "medication" | "observation",
    name: `${kind}.pdf`,
    mimeType: "application/pdf",
    sizeBytes: 4,
    base64: "JVBERg==",
  })),
  referrer: { name: "Demo Sender", phone: "0412345678", email: "demo@example.com", role: "Nurse", location: "SCGH ED" },
};

function event(): Extract<WardFlowEvent, { type: "RECEIVE_REFERRAL" }> {
  return {
    type: "RECEIVE_REFERRAL",
    role: "community",
    now: NOW_ANCHOR,
    ageBand: "Adult",
    homeRegion: "Perth Metropolitan",
    suburb: { kind: "named", name: "Perth" },
    source: "community",
    urgency: 2,
    originSiteCode: "SCGH",
    transportNeeded: false,
    history: "Synthetic patient story",
    intake,
    destinations: ["scgh-adult-open", "arm-adult-open"].map((unitId) => ({
      kind: "psychiatric_ward",
      unitId,
      sex: "Female",
      gender: "Female",
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
      highAcuityNursingNeeded: false,
    })),
  };
}

describe("confirmed drawer submissions use the shared referral engine", () => {
  it("creates one referral with distinct ward recipients and a complete dossier", () => {
    const state = wardFlowReducer(seedWardFlowState(), event());
    expect(state.rejections).toHaveLength(0);
    const created = state.referrals.at(-1)!;
    expect(created.destinations).toHaveLength(2);
    expect(created.intake).toEqual(intake);
    const own = wardReferralInboxEntries(state.referrals, "scgh-adult-open").find((entry) => entry.id === created.id)!;
    expect(own.intake?.referrer.email).toBe("demo@example.com");
    expect(JSON.stringify(own)).not.toContain("arm-adult-open");
    expect(wardReferralInboxEntries(state.referrals, "rph-adult-secure").some((entry) => entry.id === created.id)).toBe(
      false,
    );
  });
  it("refuses duplicate recipients, unknown wards and an ambiguous ward answer", () => {
    const seed = seedWardFlowState();
    const payload = event();
    expect(
      wardFlowReducer(seed, { ...payload, destinations: [payload.destinations[0], payload.destinations[0]] })
        .rejections,
    ).toHaveLength(1);
    expect(
      wardFlowReducer(seed, {
        ...payload,
        destinations: [{ ...payload.destinations[0], unitId: "imaginary-ward" } as (typeof payload.destinations)[0]],
      }).rejections,
    ).toHaveLength(1);
    const state = wardFlowReducer(seed, payload);
    const next = wardFlowReducer(state, {
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now: NOW_ANCHOR,
      referralId: state.referrals.at(-1)!.id,
      destinationKind: "psychiatric_ward",
      reason: "another_reason",
    });
    expect(next.rejections.at(-1)?.reason).toMatch(/Name the ward/);
  });
  it("declining one recipient keeps the other waiting; accepting the other preserves the refusal", () => {
    const received = wardFlowReducer(seedWardFlowState(), event());
    const id = received.referrals.at(-1)!.id;
    const declined = wardFlowReducer(received, {
      type: "DECLINE_REFERRAL",
      role: "ward",
      now: NOW_ANCHOR,
      referralId: id,
      destinationKind: "psychiatric_ward",
      unitId: "arm-adult-open",
      reason: "another_reason",
    });
    expect(declined.referrals.at(-1)!.destinations.map((arm) => arm.state)).toEqual(["queued", "declined"]);
    expect(referralState(declined.referrals.at(-1)!)).toBe("queued");
    const accepted = wardFlowReducer(declined, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW_ANCHOR,
      referralId: id,
      destinationKind: "psychiatric_ward",
      unitId: "scgh-adult-open",
    });
    expect(accepted.rejections).toHaveLength(0);
    expect(accepted.referrals.at(-1)!.destinations.map((arm) => arm.state)).toEqual(["accepted", "declined"]);
  });
  it("an acceptance cancels another live recipient and rejects an unaddressed ward", () => {
    const received = wardFlowReducer(seedWardFlowState(), event());
    const id = received.referrals.at(-1)!.id;
    const rejected = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW_ANCHOR,
      referralId: id,
      destinationKind: "psychiatric_ward",
      unitId: "rph-adult-secure",
    });
    expect(rejected.rejections).toHaveLength(1);
    const accepted = wardFlowReducer(received, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW_ANCHOR,
      referralId: id,
      destinationKind: "psychiatric_ward",
      unitId: "scgh-adult-open",
    });
    expect(accepted.referrals.at(-1)!.destinations.map((arm) => arm.state)).toEqual(["accepted", "cancelled"]);
  });
  it("waitlisting remains live and affects only the answering recipient", () => {
    const received = wardFlowReducer(seedWardFlowState(), event());
    const next = wardFlowReducer(received, {
      type: "DECLINE_REFERRAL",
      role: "ward",
      now: NOW_ANCHOR,
      referralId: received.referrals.at(-1)!.id,
      destinationKind: "psychiatric_ward",
      unitId: "arm-adult-open",
      reason: "no_suitable_bed",
      waitlist: true,
    });
    expect(next.referrals.at(-1)!.destinations[0].waitlistedAt).toBeUndefined();
    expect(next.referrals.at(-1)!.destinations[1].waitlistedAt).toBe(NOW_ANCHOR);
    expect(referralState(next.referrals.at(-1)!)).toBe("queued");
  });
  it("routes ED and community submissions to their own existing inbox selectors", () => {
    const edState = wardFlowReducer(seedWardFlowState(), {
      ...event(),
      destinations: [{ kind: "emergency_department", edId: "rph-ed", purpose: "psychiatric_review" }],
    });
    const ed = edState.referrals.at(-1)!;
    expect(
      edReferralsFor(edState.referrals, "rph-ed", "psychiatric_review").some((entry) => entry.referral.id === ed.id),
    ).toBe(true);
    expect(
      edReferralsFor(edState.referrals, "scgh-ed", "psychiatric_review").some((entry) => entry.referral.id === ed.id),
    ).toBe(false);
    const communityState = wardFlowReducer(seedWardFlowState(), {
      ...event(),
      destinations: [{ kind: "community_team", teamName: "Inner City Clinic" }],
    });
    expect(communityScopedReferral(communityState.referrals.at(-1)!)?.addressing.destination.teamName).toBe(
      "Inner City Clinic",
    );
  });
  it("validates documentation and contact fields at the engine boundary", () => {
    expect(referralIntakeError(intake)).toBeNull();
    for (const invalid of [
      { ...intake, referrer: { ...intake.referrer, email: "bad" } },
      { ...intake, catchment: { ...intake.catchment, confirmed: false } },
      { ...intake, medicalClearance: { cleared: false } },
      { ...intake, charts: [intake.charts[0]] },
      { ...intake, charts: [{ ...intake.charts[0], base64: "truncated" }, intake.charts[1]] },
    ]) {
      const state = wardFlowReducer(seedWardFlowState(), { ...event(), intake: invalid as ReferralIntakeDetails });
      expect(state.rejections).toHaveLength(1);
    }
  });
});
