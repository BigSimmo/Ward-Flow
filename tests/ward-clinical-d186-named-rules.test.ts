import { describe, expect, it } from "vitest";

import {
  communityReferralBlockedReason,
  dischargeChoiceBlockedReason,
  transportLegalFormNotice,
} from "@/components/ward-management/ed/ed-blocked-reasons";
import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";
import { PLANNED_ADMISSION_LEGAL_STATUSES } from "@/components/ward-management/ward-admissions";
import { expectFlagKindFor } from "@/components/ward-management/ward-derivations";
import { stayLegalStatusIsInvoluntary } from "@/components/ward-management/ward-discharge-records";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { legalFormStatusWarning } from "@/components/ward-management/ward-legal-form-fit";
import { isDetained, isNotVoluntary } from "@/components/ward-management/ward-legal-meaning";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { LegalStatus, Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * D-186 item 4 (Josh, 13 Nov 2026): the two named legal rules are used everywhere. Each helper
 * below used to write "not voluntary" or "detained" out by hand; it now calls the named rule. This
 * proves each one gives the same answer as the rule for every `LegalStatus` value, so the change
 * is a rename of the meaning and moves no clinical value. Synthetic seed data only.
 */

// A total record, so a fifth `LegalStatus` cannot be added without this list growing with it.
const EVERY: Record<LegalStatus, true> = {
  Voluntary: true,
  "Referred for psychiatric examination": true,
  "Detained awaiting examination": true,
  "Involuntary inpatient": true,
};
const ALL = Object.keys(EVERY) as LegalStatus[];

describe("the status list itself", () => {
  it("covers every LegalStatus value the booking list carries", () => {
    expect([...ALL].sort()).toEqual([...PLANNED_ADMISSION_LEGAL_STATUSES].sort());
  });
});

describe("D-186 item 4: the replaced hand-written meanings equal the named rules", () => {
  it.each(ALL)("%s: the old 'not Voluntary' expression equals isNotVoluntary", (status) => {
    const optional: LegalStatus | undefined = status;
    expect(optional !== undefined && optional !== "Voluntary").toBe(isNotVoluntary(status));
    expect(status !== "Voluntary").toBe(isNotVoluntary(status));
  });

  it("an unchosen status (undefined) is neither, as the old guarded expression read it", () => {
    const none: LegalStatus | undefined = undefined;
    expect(none !== undefined && none !== "Voluntary").toBe(isNotVoluntary(none));
    expect(isDetained(none)).toBe(false);
  });
});

function edMovement(status: LegalStatus): Movement {
  const base = seedWardFlowState().movements.find((m) => m.id === "WF-002")!;
  return {
    ...base,
    legalStatus: status,
    legalForm: undefined,
    examination: undefined,
    closure: undefined,
    transport: undefined,
    edOutcome: undefined,
  };
}

function withMovement(movement: Movement): WardFlowState {
  const state = seedWardFlowState();
  return { ...state, movements: state.movements.map((m) => (m.id === movement.id ? movement : m)) };
}

describe("D-186 item 4: each changed helper follows isNotVoluntary for every status", () => {
  it.each(ALL)("%s: the ED community referral and discharge choice gates", (status) => {
    const movement = edMovement(status);
    const blocked = "Not offered until the examination outcome is recorded.";
    expect(communityReferralBlockedReason(movement) === blocked).toBe(isNotVoluntary(status));
    expect(dischargeChoiceBlockedReason(movement) === blocked).toBe(isNotVoluntary(status));
  });

  it.each(ALL)("%s: the transport Form 4A notice", (status) => {
    expect(transportLegalFormNotice(edMovement(status)) !== undefined).toBe(isNotVoluntary(status));
  });

  it.each(ALL)("%s: the expectation review flag kind", (status) => {
    const longAgo = NOW_ANCHOR - 30 * 24 * 60;
    expect(expectFlagKindFor(status, longAgo, NOW_ANCHOR)).toBe(
      isNotVoluntary(status) ? "involuntary_7d" : "voluntary_48h",
    );
  });

  it.each(ALL)("%s: the legal form fit warning for no form chosen", (status) => {
    expect(legalFormStatusWarning(status, null) !== null).toBe(isNotVoluntary(status));
  });

  it("the legal form fit warning still says nothing while the status is unanswered", () => {
    expect(legalFormStatusWarning(undefined, null)).toBeNull();
    expect(legalFormStatusWarning("", null)).toBeNull();
  });

  it.each(ALL)("%s: the stay's own legal record", (status) => {
    const movement = edMovement(status);
    const admission = { id: "adm-d186", movementId: movement.id } as unknown as Admission;
    expect(stayLegalStatusIsInvoluntary({ movements: [movement] }, admission, movement)).toBe(isNotVoluntary(status));
  });

  it("a stay with no legal record is not involuntary", () => {
    const admission = { id: "adm-d186-none" } as unknown as Admission;
    expect(stayLegalStatusIsInvoluntary({ movements: [] }, admission, undefined)).toBe(false);
  });
});

describe("D-186 item 4: the reducer's two legal form gates follow isNotVoluntary", () => {
  it.each(ALL)("%s: RECORD_ED_OUTCOME for discharge before an examination outcome", (status) => {
    const before = withMovement(edMovement(status));
    const after = wardFlowReducer(before, {
      type: "RECORD_ED_OUTCOME",
      role: "ed",
      now: NOW_ANCHOR + 10,
      movementId: "WF-002",
      outcome: "for_discharge",
    });
    const legalRefusal = after.rejections
      .slice(before.rejections.length)
      .some((r) => r.reason.includes("examination outcome"));
    expect(legalRefusal).toBe(isNotVoluntary(status));
  });

  it.each(ALL)("%s: REFER_TO_COMMUNITY_TEAM before an examination outcome", (status) => {
    const before = withMovement(edMovement(status));
    const after = wardFlowReducer(before, {
      type: "REFER_TO_COMMUNITY_TEAM",
      role: "ed",
      now: NOW_ANCHOR + 10,
      movementId: "WF-002",
      team: communityTeamOptions()[0]!,
    });
    const legalRefusal = after.rejections
      .slice(before.rejections.length)
      .some((r) => r.reason.includes("is on a legal form"));
    expect(legalRefusal).toBe(isNotVoluntary(status));
  });
});
