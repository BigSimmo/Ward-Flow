// Clinical follow-up to audit M35 (Josh, 10 Nov 2026, D-130): a referral decline and an arrival each
// leave an audit row, like the other recorded decisions, so the weekly report's decline count can be
// checked against the trail. Synthetic seed only.
import { describe, expect, it } from "vitest";

import type { AuditEvent } from "@/components/ward-management/ward-audit";
import { classifyAuditEvent } from "@/components/ward-management/ward-audit";
import { GENDER_PLACEMENT_REASONS } from "@/components/ward-management/ward-change-reasons";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { ReferralDestination } from "@/components/ward-management/ward-model";
import { reportWeek, weeklyOperationsReport } from "@/components/ward-management/reports/weekly-report";
import { actionLabels, categoryLabels } from "@/components/ward-management/governance-shared";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

const at = (minutes: number) => NOW_ANCHOR + minutes;
const DAY_ZERO = new Date("2026-10-24T00:00:00.000Z");
const send = (state: WardFlowState, event: WardFlowEvent) => wardFlowReducer(state, event);
const newRows = (before: WardFlowState, after: WardFlowState): AuditEvent[] =>
  after.auditEvents.slice(before.auditEvents.length);

function declines(state: WardFlowState) {
  const report = weeklyOperationsReport(
    {
      movements: state.movements,
      referrals: state.referrals,
      admissions: state.admissions,
      patients: state.patients,
      units: state.units,
      bedReleases: state.bedReleases,
      leaveBeds: state.leaveBeds,
      edAccessTargetMinutes: state.configuration.edAccessTargetMinutes,
      now: at(30),
    },
    reportWeek(-1, at(30), DAY_ZERO),
  );
  return report.declines.placement + report.declines.referral;
}

describe("referral answers and arrivals leave an audit row", () => {
  it("classifies the three events", () => {
    expect(classifyAuditEvent({ type: "DECLINE" } as WardFlowEvent)).toBe("referral-answer");
    expect(classifyAuditEvent({ type: "DECLINE_REFERRAL" } as WardFlowEvent)).toBe("referral-answer");
    expect(classifyAuditEvent({ type: "PATIENT_ARRIVED" } as WardFlowEvent)).toBe("arrival");
    expect(categoryLabels["referral-answer"]).toBe("Referral answer");
    expect(categoryLabels.arrival).toBe("Arrival");
    expect(actionLabels.PATIENT_ARRIVED).toBe("Record arrival");
  });

  it("a ward's decline of a journey writes one accepted row, and the weekly count matches it", () => {
    const seed = seedWardFlowState();
    const referred = send(seed, {
      type: "REFER_TO_UNITS",
      role: "coordinator",
      now: at(1),
      movementId: "WF-012",
      unitIds: ["rgh-adult-secure"],
      genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
      genderPlacementChecked: true,
    } as WardFlowEvent);
    const declined = send(referred, {
      type: "DECLINE",
      role: "ward",
      now: at(2),
      movementId: "WF-012",
      unitId: "rgh-adult-secure",
      actingUnitId: "rgh-adult-secure",
      reason: "capability_mismatch",
    } as WardFlowEvent);
    expect(declined.rejections.length).toBe(seed.rejections.length);
    const rows = newRows(referred, declined);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      category: "referral-answer",
      action: "DECLINE",
      outcome: "accepted",
      subject: { kind: "movement", movementId: "WF-012" },
      details: { answer: "declined", unitId: "rgh-adult-secure", reason: "capability_mismatch" },
    });
    expect(declines(declined) - declines(seed)).toBe(
      declined.auditEvents.filter((row) => row.category === "referral-answer" && row.outcome === "accepted").length,
    );
  });

  it("a refused decline writes a refused row, never an accepted one", () => {
    const seed = seedWardFlowState();
    const after = send(seed, {
      type: "DECLINE",
      role: "ward",
      now: at(2),
      movementId: "WF-012",
      unitId: "no-such-ward",
      reason: "capability_mismatch",
    } as WardFlowEvent);
    expect(after.rejections.length).toBe(seed.rejections.length + 1);
    const rows = newRows(seed, after);
    expect(rows.map((row) => [row.category, row.outcome])).toEqual([["referral-answer", "denied"]]);
  });

  it("a destination's decline of a referral writes one accepted row with its fixed-list reason", () => {
    const community: ReferralDestination = { kind: "community_team", teamName: "Inner City Clinic" };
    const seeded = send(seedWardFlowState(), {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: at(0),
      ageBand: "Adult",
      destinations: [community],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      source: "community",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    } as WardFlowEvent);
    expect(seeded.rejections).toEqual([]);
    const referral = seeded.referrals.at(-1)!;
    const after = send(seeded, {
      type: "DECLINE_REFERRAL",
      role: "community",
      now: at(1),
      referralId: referral.id,
      destinationKind: "community_team",
      reason: "outside_the_teams_catchment",
    } as WardFlowEvent);
    expect(after.rejections).toEqual([]);
    expect(newRows(seeded, after)).toMatchObject([
      {
        category: "referral-answer",
        action: "DECLINE_REFERRAL",
        outcome: "accepted",
        subject: { kind: "referral", referralId: referral.id },
        details: { answer: "declined", reason: "outside_the_teams_catchment" },
      },
    ]);
  });

  it("an arrival writes one accepted row naming the receiving ward", () => {
    const seed = seedWardFlowState();
    const moving = seed.movements.find((m) => m.stage === "moving")!;
    const after = send(seed, {
      type: "PATIENT_ARRIVED",
      role: "coordinator",
      now: at(1),
      movementId: moving.id,
    } as WardFlowEvent);
    expect(after.rejections.length).toBe(seed.rejections.length);
    expect(newRows(seed, after)).toMatchObject([
      {
        category: "arrival",
        action: "PATIENT_ARRIVED",
        outcome: "accepted",
        subject: { kind: "movement", movementId: moving.id },
        details: { step: "arrived", unitId: moving.acceptedUnitId },
      },
    ]);
  });
});
