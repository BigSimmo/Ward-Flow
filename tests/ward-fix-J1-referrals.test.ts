import { describe, expect, it } from "vitest";

import {
  acceptedReferralsAwaitingPull,
  startsAcceptedJourney,
} from "@/components/ward-management/referrals/accepted-awaiting-pull";
import { EMPTY_DOCUMENTATION, intakeCharts } from "@/components/ward-management/referrals/referral-flow-panels";
import {
  referralIntakeError,
  type ReferralIntakeDetails,
} from "@/components/ward-management/referrals/referral-submission";
import {
  NO_PATIENT_KEY,
  recordedBedSecurity,
  sampleProfile,
  transportRequested,
} from "@/components/ward-management/referrals/ward-referral-drawer-model";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { observationAt } from "@/components/ward-management/ward-observation";
import { acceptedAddressing } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { awaitingWardAnswer, waitlistStands } from "@/components/ward-management/ward-waitlist";

/** Audit 9 referral fixes (Josh, 13 Nov 2026: "yes to all your recommendations"). Synthetic seed only. */

function dispatch(state: WardFlowState, event: Record<string, unknown>): WardFlowState {
  return wardFlowReducer(state, event as unknown as WardFlowEvent);
}

function intakeWith(charts: ReturnType<typeof intakeCharts>, documents = false): ReferralIntakeDetails {
  return {
    catchment: { teamName: "Synthetic Community Team", confirmed: true },
    reasonForReferral: "Synthetic reason",
    legalStatus: "Voluntary",
    riskFlags: [],
    medicalClearance: { cleared: true },
    triageAndRampCompleted: false,
    ...charts,
    additionalDocuments: documents,
    referrer: { name: "Demo Referrer", role: "Registrar", phone: "0400000000", email: "", location: "" },
  } as ReferralIntakeDetails;
}

describe("A9-05: No suitable bed is a wait list answer, not a waiting request or a refusal", () => {
  const seed = seedWardFlowState();
  const movement = seed.movements.find(
    (candidate) =>
      !candidate.closure &&
      candidate.stage === "destination_review" &&
      candidate.referredUnitIds.some((unitId) => !waitlistStands(candidate, unitId)),
  )!;
  const unitId = movement.referredUnitIds.find((id) => !waitlistStands(movement, id))!;
  const unit = seed.units.find((candidate) => candidate.id === unitId)!;
  const declined = dispatch(seed, {
    type: "DECLINE",
    role: "ward",
    now: NOW_ANCHOR,
    movementId: movement.id,
    unitId,
    actingUnitId: unitId,
    reason: "no_suitable_bed",
  });
  const after = declined.movements.find((candidate) => candidate.id === movement.id)!;

  it("records the answer and leaves the ward's awaiting list", () => {
    expect(declined.rejections).toHaveLength(seed.rejections.length);
    expect(awaitingWardAnswer(movement, unitId)).toBe(true);
    expect(waitlistStands(after, unitId)).toBe(true);
    expect(awaitingWardAnswer(after, unitId)).toBe(false);
  });

  it("does not read as Already declined, so the ward can still accept when a bed frees", () => {
    const gate = eligibility(after, unit, NOW_ANCHOR).gates.find((entry) => entry.gate === "prior_decline");
    expect(gate?.pass).toBe(true);
    expect(gate?.detail).not.toMatch(/Already declined/u);
  });

  it("an ordinary refusal still reads as declined", () => {
    const refused = dispatch(seed, {
      type: "DECLINE",
      role: "ward",
      now: NOW_ANCHOR,
      movementId: movement.id,
      unitId,
      actingUnitId: unitId,
      reason: "capability_mismatch",
    });
    const refusedMovement = refused.movements.find((candidate) => candidate.id === movement.id)!;
    const gate = eligibility(refusedMovement, unit, NOW_ANCHOR).gates.find((entry) => entry.gate === "prior_decline");
    expect(gate?.pass).toBe(false);
  });
});

describe("A9-06: a referral to a community team can be sent without charts", () => {
  it("the short form's charts pass the intake check", () => {
    expect(referralIntakeError(intakeWith(intakeCharts(EMPTY_DOCUMENTATION, true)))).toBeNull();
  });

  it("a ward referral still needs its charts attached or marked to follow", () => {
    expect(referralIntakeError(intakeWith({ charts: [] }))).toMatch(/medication and observation charts/u);
    expect(referralIntakeError(intakeWith(intakeCharts(EMPTY_DOCUMENTATION, false)))).toBeNull();
  });

  it("no charts is only for a community referral with no documents", () => {
    expect(referralIntakeError(intakeWith({ charts: [], chartsNotNeeded: true }, true))).not.toBeNull();
    expect(
      referralIntakeError(intakeWith({ charts: [], chartsNotNeeded: true, chartsToFollow: ["medication"] })),
    ).not.toBeNull();
  });

  it("the engine accepts it for a community team and refuses it for a ward", () => {
    const seed = seedWardFlowState();
    const base = {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW_ANCHOR,
      patientId: seed.patients[0]!.id,
      ageBand: "Adult",
      suburb: { kind: "unknown", reason: "not_known" },
      source: "community",
      originSiteCode: "ARM",
      sendingTeamName: "Synthetic Community Service",
      urgency: 3,
      transportNeeded: false,
      history: "",
      intake: intakeWith(intakeCharts(EMPTY_DOCUMENTATION, true)),
    };
    const sent = dispatch(seed, {
      ...base,
      destinations: [{ kind: "community_team", teamName: "Synthetic Community Team", purpose: "follow_up" }],
    });
    const toWard = dispatch(seed, {
      ...base,
      destinations: [
        {
          kind: "psychiatric_ward",
          unitId: seed.units[0]!.id,
          sex: "Female",
          gender: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
    });
    expect(toWard.rejections.at(-1)?.reason ?? "").toMatch(/charts/u);
    // The community send fails for no charts reason (other checks are not this fix's concern).
    expect(
      sent.rejections
        .slice(seed.rejections.length)
        .map((entry) => entry.reason)
        .join(";"),
    ).not.toMatch(/charts/u);
  });
});

describe("A9-10 (Q2 ruling): bed security starts from the record or empty, never Open", () => {
  it("nothing recorded starts empty", () => {
    expect(recordedBedSecurity("")).toBe("");
    expect(recordedBedSecurity("Not recorded")).toBe("");
    expect(recordedBedSecurity("Open")).toBe("Open");
    expect(recordedBedSecurity("Secure")).toBe("Secure");
  });

  it("a new or unchosen person has no recorded bed security", () => {
    const record = { ...seedWardFlowState(), dayZero: new Date(Date.UTC(2026, 7, 15)) };
    expect(sampleProfile(NO_PATIENT_KEY, record, NOW_ANCHOR).security).toBe("");
    expect(sampleProfile("custom", record, NOW_ANCHOR).security).toBe("");
  });
});

describe("A9-11: transport left Not chosen is no transport request", () => {
  it("only a chosen vehicle on a ward referral asks for transport", () => {
    expect(transportRequested("ward", "")).toBe(false);
    expect(transportRequested("ward", "Family or carer")).toBe(false);
    expect(transportRequested("ward", "Mental Health Transport")).toBe(true);
    expect(transportRequested("community", "Mental Health Transport")).toBe(false);
  });
});

describe("A9-13: the Referrals panel's pull starts the movement every screen reads", () => {
  const accept = (state: WardFlowState, referralId: string, unitId: string) =>
    dispatch(state, {
      type: "ACCEPT_REFERRAL",
      role: "coordinator",
      now: NOW_ANCHOR + 1,
      referralId,
      destinationKind: "psychiatric_ward",
      unitId,
    });

  it("an ambulance referral recorded at an ED, accepted at a ward, can be pulled in one step", () => {
    const seed = seedWardFlowState();
    const referral = seed.referrals.find((entry) => entry.id === "RF-011")!;
    expect(referral.source).toBe("ambulance");
    expect(startsAcceptedJourney(referral)).toBe(true);
    const accepted = accept(seed, "RF-011", "arm-adult-open");
    expect(accepted.rejections).toHaveLength(seed.rejections.length);
    const item = acceptedReferralsAwaitingPull(accepted.referrals, accepted.units, accepted.movements).find(
      (entry) => entry.referral.id === "RF-011",
    );
    expect(item?.unitId).toBe("arm-adult-open");

    const arm = acceptedAddressing(item!.referral)!;
    if (arm.destination.kind !== "psychiatric_ward") throw new Error("not a ward arm");
    const pulled = dispatch(accepted, {
      type: "RAISE_REFERRAL",
      role: "coordinator",
      now: NOW_ANCHOR + 2,
      edId: "fsh-ed",
      referralId: "RF-011",
      acceptedUnitId: "arm-adult-open",
      pullBed: true,
      draft: {
        cohort: item!.referral.ageBand,
        security: arm.destination.secureBedNeeded ? "Secure" : "Open",
        sex: arm.destination.sex,
        gender: arm.destination.gender,
        highAcuity: arm.destination.highAcuityNursingNeeded === true,
        observation: observationAt("general"),
        legalStatus: "Voluntary",
        legalFormCode: null,
        urgency: item!.referral.urgency,
      },
    });
    const journey = pulled.movements.find((movement) => movement.referralId === "RF-011" && !movement.closure);
    expect(pulled.rejections.slice(accepted.rejections.length)).toEqual([]);
    expect(journey?.stage).toBe("pulled");
    expect(journey?.acceptedUnitId).toBe("arm-adult-open");
    expect(journey?.originEdId).toBe("fsh-ed");
    expect(pulled.movements.length).toBe(accepted.movements.length + 1);
  });

  it("a ward-to-ward transfer and a referral away from any ED keep their own paths", () => {
    expect(startsAcceptedJourney({ source: "psychiatric_ward", originSiteCode: "FSH" })).toBe(false);
    expect(startsAcceptedJourney({ source: "gp", originSiteCode: "NO-SUCH-SITE" })).toBe(false);
    expect(startsAcceptedJourney({ source: "inter_hospital", originSiteCode: "FSH" })).toBe(false);
    expect(startsAcceptedJourney({ source: "ambulance", originSiteCode: "NO-SUCH-SITE" })).toBe(false);
    expect(startsAcceptedJourney({ source: "community", originSiteCode: undefined })).toBe(true);
    expect(startsAcceptedJourney({ source: "ed_medical", originSiteCode: undefined })).toBe(true);
  });
});
