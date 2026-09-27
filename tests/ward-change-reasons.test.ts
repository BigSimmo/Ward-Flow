// tests/ward-change-reasons.test.ts
import { describe, expect, it } from "vitest";

import {
  CANCEL_TRANSPORT_REASONS,
  changeReasonLabels,
  ESCALATION_CONTACTS,
  LEGAL_STATUS_CHANGE_REASONS,
  RELEASE_PULL_REASONS,
  URGENCY_CHANGE_REASONS,
  URGENT_MARK_REASONS,
  type CancelTransportReason,
  type LegalStatusChangeReason,
  type ReleasePullReason,
  type UrgencyChangeReason,
  type UrgentMarkReason,
} from "../src/components/ward-management/ward-change-reasons";
import { STEP_BACK_REASONS, stepBackReasonLabels } from "../src/components/ward-management/ward-model";

describe("ward-change-reasons", () => {
  it("holds exactly the three urgency-change reasons, in this order", () => {
    expect(URGENCY_CHANGE_REASONS).toEqual(["reassessed", "new_information", "correcting_an_error"]);
  });

  it("holds exactly the two legal-status-change reasons, in this order", () => {
    expect(LEGAL_STATUS_CHANGE_REASONS).toEqual(["recorded_by_treating_team", "correcting_an_error"]);
  });

  // Task 3: the undo the prototype has never had. Same discipline, same pinned order.
  it("holds exactly the four release-hold reasons, in this order", () => {
    expect(RELEASE_PULL_REASONS).toEqual([
      "patient_no_longer_coming",
      "bed_needed_for_another_patient",
      "ward_withdrew_the_bed",
      "pull_made_in_error",
    ]);
  });

  it("holds exactly the four cancel-transport reasons, in this order", () => {
    expect(CANCEL_TRANSPORT_REASONS).toEqual([
      "provider_unavailable",
      "patient_not_ready",
      "destination_changed",
      "job_created_in_error",
    ]);
  });

  /**
   * Item 37 (2026-09-17): nine and ten, the owner's delegation to Ward Lead ("You decide") and the
   * plan's own proposal, added between the six settings-shaped reasons and the two catch-alls —
   * "Another reason, not listed here" MUST stay last, which is the whole reason for pinning ORDER
   * here rather than only membership (the "gives every union member a label" test below sorts
   * before comparing and so cannot catch a reordering on its own).
   */
  it("holds exactly the ten urgent-mark reasons, in this order, with both catch-alls last", () => {
    expect(URGENT_MARK_REASONS).toEqual([
      "cannot_safely_prevent_leaving",
      "cannot_be_observed_safely_here",
      "safety_of_others_in_this_setting",
      "no_psychiatric_cover_at_this_site",
      "needs_medical_care_unavailable_here",
      "escort_in_place_and_unsustainable",
      "cannot_protect_from_others_here",
      "setting_unsuitable_for_age_group",
      "this_setting_cannot_continue_current_care",
      "another_reason_not_listed",
    ]);
  });

  it("labels every urgency-change reason with real, non-empty text", () => {
    for (const reason of URGENCY_CHANGE_REASONS) {
      expect(changeReasonLabels[reason]).toBeTruthy();
      expect(changeReasonLabels[reason].length).toBeGreaterThan(0);
    }
  });

  it("labels every legal-status-change reason with real, non-empty text", () => {
    for (const reason of LEGAL_STATUS_CHANGE_REASONS) {
      expect(changeReasonLabels[reason]).toBeTruthy();
      expect(changeReasonLabels[reason].length).toBeGreaterThan(0);
    }
  });

  it("labels every release-hold reason with real, non-empty text", () => {
    for (const reason of RELEASE_PULL_REASONS) {
      expect(changeReasonLabels[reason]).toBeTruthy();
      expect(changeReasonLabels[reason].length).toBeGreaterThan(0);
    }
  });

  it("labels every cancel-transport reason with real, non-empty text", () => {
    for (const reason of CANCEL_TRANSPORT_REASONS) {
      expect(changeReasonLabels[reason]).toBeTruthy();
      expect(changeReasonLabels[reason].length).toBeGreaterThan(0);
    }
  });

  // Task 6 (spec item 11): the escalation contact, chosen never typed. Pinned order matches the
  // exact product-owner list from the brief — "Other service" is the one deliberate general
  // entry, never a seventh entry and never reworded.
  it("holds exactly the six escalation contacts, in this order", () => {
    expect(ESCALATION_CONTACTS).toEqual([
      "State bed coordination desk",
      "Duty psychiatrist",
      "Bed management",
      "Nurse unit manager (destination ward)",
      "Escort or transport provider",
      "Other service",
    ]);
  });

  // Content-free, synthetic-data guard: none of the eight rulings in the brief permits a reason
  // describing a patient, a diagnosis, a clinical judgement or a legal requirement. This asserts
  // it structurally rather than trusting a comment — a reason string is never free text (every
  // reason picker in this task is a `<select>` over these fixed lists), so this check on the
  // fixed lists themselves is a check on every reason the product can ever record.
  it("never names a clinical, diagnostic or statutory concept in a reason value or label", () => {
    const forbiddenTokens = [
      "patient",
      "diagnos",
      "deteriorat",
      "order made",
      "section",
      "act 2014",
      "mental health act",
      "detained",
      "involuntary",
    ];
    const allText = [
      ...URGENCY_CHANGE_REASONS,
      ...LEGAL_STATUS_CHANGE_REASONS,
      ...Object.values(changeReasonLabels),
      // Task 6: ESCALATION_CONTACTS carries no separate label map (its values ARE the rendered
      // text — see the comment above its definition), so it is checked here directly rather than
      // through changeReasonLabels.
      ...ESCALATION_CONTACTS,
      // ⚠️ **ADDED 2026-09-06 WITH THE STEP-BACK LABELS THEMSELVES.** `stepBackReasonLabels` lives
      // in `ward-model.ts` rather than `ward-change-reasons.ts` — that file cannot key a map by
      // `StepBackReason` without an import cycle, since `ward-model` imports it. **Labels written
      // outside this scan would have been the only reason text in the product held to no
      // content-free bar at all**, which is the gap that matters rather than which file they sit in.
      //
      // The VALUES are deliberately not scanned: `the_patient_situation_changed` carries the
      // forbidden token, exactly as `patient_no_longer_coming` and `patient_not_ready` already do
      // above. Those are fixed by the product brief and never rendered; the label is the part this
      // repository controls, and "The situation changed" is what a coordinator reads.
      ...Object.values(stepBackReasonLabels),
    ].map((value) => value.toLowerCase());

    for (const text of allText) {
      for (const token of forbiddenTokens) {
        expect(text.includes(token), `"${text}" contains the forbidden token "${token}"`).toBe(false);
      }
    }
  });

  /**
   * The same total-coverage property `changeReasonLabels` gets below, for the one reason list that
   * does not live in `ward-change-reasons.ts`. Without it a fifth step-back reason could be added
   * with no label and nothing would say so until a picker rendered a raw snake_case value on a
   * coordinator's screen.
   *
   * The `Record<StepBackReason, string>` type already makes a MISSING label a compile error; this
   * catches the other direction — an ORPHAN label for a reason that has been removed — which the
   * type cannot see, and it is checkable where the type is erased.
   */
  it("gives every step-back reason a label, and no label an orphan entry", () => {
    expect(STEP_BACK_REASONS.length, "the step-back reason list is empty, so this checks nothing").toBeGreaterThan(0);
    for (const reason of STEP_BACK_REASONS) {
      expect(Object.keys(stepBackReasonLabels)).toContain(reason);
    }
    expect(Object.keys(stepBackReasonLabels).sort()).toEqual([...STEP_BACK_REASONS].sort());
    for (const label of Object.values(stepBackReasonLabels)) {
      expect(
        label.trim().length,
        "a step-back label is empty, so a picker would render a blank option",
      ).toBeGreaterThan(0);
    }
  });

  it("gives every union member a label and no label an orphan entry", () => {
    const allReasons: (
      UrgencyChangeReason | LegalStatusChangeReason | ReleasePullReason | CancelTransportReason | UrgentMarkReason
    )[] = [
      ...URGENCY_CHANGE_REASONS,
      ...LEGAL_STATUS_CHANGE_REASONS,
      ...RELEASE_PULL_REASONS,
      ...CANCEL_TRANSPORT_REASONS,
      ...URGENT_MARK_REASONS,
    ];
    // Every reason in all four lists resolves to a label.
    for (const reason of allReasons) {
      expect(Object.keys(changeReasonLabels)).toContain(reason);
    }
    // "correcting_an_error" is shared by the urgency and legal-status lists, so the label map has
    // exactly TWELVE unique keys, not thirteen — this pins that de-duplication rather than letting
    // a stray extra key (a typo'd duplicate) slip in unnoticed. Task 3's two new lists (Release
    // Hold, Cancel Transport) share no value with any other list, so each of their eight entries
    // adds exactly one key.
    expect(Object.keys(changeReasonLabels).sort()).toEqual(
      [
        "correcting_an_error",
        "new_information",
        "reassessed",
        "recorded_by_treating_team",
        "patient_no_longer_coming",
        "bed_needed_for_another_patient",
        "ward_withdrew_the_bed",
        "pull_made_in_error",
        "provider_unavailable",
        "patient_not_ready",
        "destination_changed",
        "job_created_in_error",
        // The urgent-mark reasons: cut from ten to six on 2026-08-31, then the catch-all
        // reinstated by the owner on 2026-09-03 (seven), then nine and ten added 2026-09-17 on
        // his delegation to Ward Lead (item 37) — back to ten, the number he originally saw.
        // ⚠️ The owner saw the ten, delegated the choice, and pre-accepted the result
        // sight-unseen in his own words: "I accept that for now to be changed later." So the
        // shape is his, the selection is a session's, and the acceptance is PROVISIONAL — see
        // `URGENT_MARK_REASONS`' own docblock, which names the four that went and why each one
        // went, and the two ADDED back on 2026-09-17.
        //
        // Pinned here for the same reason as every other entry: an added, renamed or REINSTATED
        // reason must turn this red rather than arrive quietly. ⚠️ And every one of the first
        // eight describes what a SETTING cannot do rather than a fact about the person — the
        // property that dissolved the who-may-see-a-reason question. A person-shaped reason added
        // back here reopens it.
        "cannot_be_observed_safely_here",
        "no_psychiatric_cover_at_this_site",
        "cannot_safely_prevent_leaving",
        "needs_medical_care_unavailable_here",
        "safety_of_others_in_this_setting",
        "escort_in_place_and_unsustainable",
        // ⚠️ REINSTATED 2026-09-03 on the owner's ruling, and this test did exactly what the
        // comment above promised: it went red rather than letting the seventh arrive quietly.
        "this_setting_cannot_continue_current_care",
        // ⚠️ THE EIGHTH, added 2026-09-03 on the owner's ruling that the seventh is the broadest
        // of the dropped options but not a true "none of these apply". PLACEHOLDER COPY — the
        // shape is his, the words are not yet confirmed.
        "another_reason_not_listed",
        // ⚠️ NINE AND TEN, added 2026-09-17 (item 37) — see `URGENT_MARK_REASONS`' own docblock.
        // Placed before the two catch-alls above in the real list; `.sort()` here means this test
        // pins MEMBERSHIP only, and `"holds exactly the ten urgent-mark reasons, in this order,
        // with both catch-alls last"` above pins the order this test cannot see.
        "cannot_protect_from_others_here",
        "setting_unsuitable_for_age_group",
      ].sort(),
    );
  });
});
