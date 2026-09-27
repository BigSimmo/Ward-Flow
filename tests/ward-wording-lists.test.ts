// tests/ward-wording-lists.test.ts
//
// Owner item 55 (docs/ward-flow/owner-answers-2026-09-17.md: "Wording lists confirmed;
// 'Another reason — needs follow-up' means the same from an ED.") confirmed four wording
// lists, verbatim in docs/ward-flow/owner-wording-page-2026-09-02.md ("A. Lists a clinician
// picks from", rows #3, #9, #10, #11). This pins each against its source constant and label
// map exactly as docs/ward-flow/plans/2026-09-17-build-plan-screens.md §1 locates them:
//
//   #3  a ward declines a referral    — DECLINE_REASON_LABELS (ward-referrals.ts:917-956),
//                                        keyed by REFERRAL_DECLINE_REASONS (ward-model.ts:1411-1419)
//   #9  escalation contacts           — ESCALATION_CONTACTS (ward-change-reasons.ts:68-75)
//   #10 urgency change reasons        — URGENCY_CHANGE_REASONS (ward-change-reasons.ts:12) +
//                                        changeReasonLabels (:408-411)
//   #11 legal status change reasons   — LEGAL_STATUS_CHANGE_REASONS (ward-change-reasons.ts:15) +
//                                        changeReasonLabels (:408-411)
//
// URGENT_MARK_REASONS (#2) is deliberately EXCLUDED — the referrals plan's Q1 changes it, and
// pinning it here would make this file the thing that goes red for someone else's work.
//
// PULL_RELEASE_REASONS (unused) and RELEASE_PULL_REASONS (#8, ward-change-reasons.ts:23-28) are
// two separate vocabularies on the same screen concept and are deliberately NOT pinned here —
// the build plan's own §1 note is that they must never be merged into one list, and adding
// either here is exactly the kind of "helpful" consolidation that would do it.
//
// Test-only, per the build plan's task J1: this file makes no source edit. If any assertion
// below is red, the source differs from the owner's confirmed wording — hand back the exact
// difference rather than changing the source to match.
import { describe, expect, it } from "vitest";

import {
  ESCALATION_CONTACTS,
  LEGAL_STATUS_CHANGE_REASONS,
  URGENCY_CHANGE_REASONS,
  changeReasonLabels,
} from "@/components/ward-management/ward-change-reasons";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import {
  ED_DECLINE_REASONS,
  REFERRAL_DECLINE_REASONS,
  type ReferralDestination,
} from "@/components/ward-management/ward-model";
import { DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { FIXTURE_HISTORY } from "./helpers/ward-referral-history";

const NOW = NOW_ANCHOR;

describe("ward wording lists (item 55, owner answers 2026-09-17)", () => {
  describe("#3 — a ward declines a referral (ward-referrals.ts:917-956, ward-model.ts:1411-1419)", () => {
    it("holds exactly the seven decline reasons, in this order, ending in the confirmed catch-all", () => {
      expect(REFERRAL_DECLINE_REASONS).toEqual([
        "no_suitable_bed",
        "age_band_not_provided_here",
        "sex_designation_unavailable",
        "secure_bed_unavailable",
        "belongs_to_another_service",
        "referred_elsewhere",
        "another_reason",
      ]);
    });

    it("labels every decline reason with the owner-confirmed sentence, verbatim", () => {
      expect(REFERRAL_DECLINE_REASONS.map((reason) => DECLINE_REASON_LABELS[reason])).toEqual([
        "No suitable bed",
        "Age band not provided here",
        "Sex designation unavailable",
        "Secure bed unavailable",
        "Belongs to another service",
        "Referred elsewhere",
        "Another reason — needs follow-up",
      ]);
    });
  });

  describe("#9 — escalation contacts (ward-change-reasons.ts:68-75)", () => {
    it("holds exactly the six contacts, in this order", () => {
      expect(ESCALATION_CONTACTS).toEqual([
        "State bed coordination desk",
        "Duty psychiatrist",
        "Bed management",
        "Nurse unit manager (destination ward)",
        "Escort or transport provider",
        "Other service",
      ]);
    });
  });

  describe("#10 — urgency change reasons (ward-change-reasons.ts:12, :408-411)", () => {
    it("holds exactly the three reasons, in this order", () => {
      expect(URGENCY_CHANGE_REASONS).toEqual(["reassessed", "new_information", "correcting_an_error"]);
    });

    it("labels every urgency-change reason with the owner-confirmed word, verbatim", () => {
      expect(URGENCY_CHANGE_REASONS.map((reason) => changeReasonLabels[reason])).toEqual([
        "Reassessed",
        "New information",
        "Correcting an error",
      ]);
    });
  });

  describe("#11 — legal status change reasons (ward-change-reasons.ts:15, :408-411)", () => {
    it("holds exactly the two reasons, in this order", () => {
      expect(LEGAL_STATUS_CHANGE_REASONS).toEqual(["recorded_by_treating_team", "correcting_an_error"]);
    });

    it("labels every legal-status-change reason with the owner-confirmed word, verbatim", () => {
      expect(LEGAL_STATUS_CHANGE_REASONS.map((reason) => changeReasonLabels[reason])).toEqual([
        "Recorded by treating team",
        "Correcting an error",
      ]);
    });
  });
});

// Item 55's second half: "'Another reason — needs follow-up' means the same from an ED." An
// ED-addressed DECLINE_REFERRAL shares the ward's own `another_reason` value and
// `DECLINE_REASON_LABELS` entry (ward-model.ts:1442-1466's `ED_DECLINE_REASONS` is
// `REFERRAL_DECLINE_REASONS` with the four bed-shaped reasons filtered OUT, never a
// re-typed list), so the same sentence reaches all three surfaces named in task J1.
describe("an ED-addressed 'another reason' shows the same confirmed sentence as a ward's (item 55)", () => {
  it("is offered on the ED decline picker's own option list (ed-screen.tsx:1693-1695 renders ED_DECLINE_REASONS through DECLINE_REASON_LABELS)", () => {
    expect(ED_DECLINE_REASONS).toContain("another_reason");
    expect(DECLINE_REASON_LABELS.another_reason).toBe("Another reason — needs follow-up");
  });

  it("is offered in referral-match's own decline controls (referral-match.tsx:294-298 and :721-725 render REFERRAL_DECLINE_REASONS through the same label map)", () => {
    expect(REFERRAL_DECLINE_REASONS).toContain("another_reason");
    expect(DECLINE_REASON_LABELS.another_reason).toBe("Another reason — needs follow-up");
  });

  it("reaches the referrer's notice unchanged when an ED destination declines with another_reason (ward-flow-reducer.ts:4520-4533)", () => {
    const received = wardFlowReducer(seedWardFlowState(), {
      type: "RECEIVE_REFERRAL",
      role: "community",
      now: NOW,
      ageBand: "Adult",
      destinations: [
        {
          kind: "emergency_department",
          edId: "peel-ed",
          purpose: "psychiatric_review",
        } satisfies ReferralDestination,
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "named", name: "Armadale" },
      // Only `ed_medical` resolves to a notice-receiving referrer (`referralReferrer`,
      // ward-flow-reducer.ts:1179-1183) — the other five sources raise no decline notice at
      // all, by design. This case must use it, or the assertion below proves nothing.
      source: "ed_medical",
      urgency: 2,
      originSiteCode: "SCGH",
      transportNeeded: false,
      ...FIXTURE_HISTORY,
    });
    expect(received.rejections, "the fixture referral itself must be accepted, or this test proves nothing").toEqual(
      [],
    );
    const referral = received.referrals.at(-1)!;

    const after = wardFlowReducer(received, {
      type: "DECLINE_REFERRAL",
      role: "coordinator",
      now: NOW,
      referralId: referral.id,
      destinationKind: "emergency_department",
      reason: "another_reason",
    });
    expect(after.rejections, "the ED decline itself must be accepted, or this test proves nothing").toEqual([]);

    const notice = after.notices.find((candidate) => candidate.kind === "referral_declined");
    expect(notice, "no referral_declined notice was raised").toBeDefined();
    expect(notice?.sentence).toContain("Another reason — needs follow-up");
  });
});
