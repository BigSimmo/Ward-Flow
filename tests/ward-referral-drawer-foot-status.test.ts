import { describe, expect, it } from "vitest";
import {
  drawerFootStatus,
  drawerRailHeading,
} from "@/components/ward-management/referrals/referral-drawer-foot-status";
import { referralContactError } from "@/components/ward-management/referrals/referral-submission";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const EMPTY_CONTACT = { name: "", email: "", phone: "", role: "", location: "" };

function status(flowError: string | null, contactNeeded: number) {
  return drawerFootStatus({
    view: "new",
    inboxWard: undefined,
    inboxWardCount: 0,
    sentReferralId: null,
    sentAt: null,
    now: NOW_ANCHOR,
    recipientLabels: ["Test ward"],
    submissionAwaitingRecord: false,
    flowError,
    confirmationOpen: true,
    contactNeeded,
    itemsLeft: 0,
    itemsTotal: 9,
    warningCount: contactNeeded,
  });
}

describe("referral drawer footer after a refused Send (#823)", () => {
  const refusal = referralContactError(EMPTY_CONTACT)!;

  it("uses a real contact refusal, so the case below is not vacuous", () => {
    expect(refusal).toMatch(/^Enter your name/);
  });

  // FORM-REF (Josh, 5 Nov 2026): missing contact details warn and Send still goes ahead.
  it("reads the live contact count as a warning while contact details are still missing", () => {
    expect(status(refusal, 2)).toMatchObject({
      tone: "warning",
      first: "Ready to send · 2 contact details not recorded",
    });
  });

  it("clears the 'Enter your name…' warning as soon as the contact fields are valid", () => {
    const foot = status(refusal, 0);
    expect(foot.first).toBe("Ready to send");
    expect(foot.tone).toBe("success");
  });

  it("still shows any other Send refusal", () => {
    expect(status("Check the patient, urgency and selected recipients.", 0)).toMatchObject({
      tone: "danger",
      first: "Check the patient, urgency and selected recipients.",
      alert: true,
    });
  });

  it("still shows a too-long contact field, which the count does not cover", () => {
    expect(status("Shorten your name, role or location to 200 characters.", 0).first).toBe(
      "Shorten your name, role or location to 200 characters.",
    );
  });
});

describe("referral drawer footer once every step is done (P155)", () => {
  function foot(itemsLeft: number, warningCount: number) {
    return drawerFootStatus({
      view: "new",
      inboxWard: undefined,
      inboxWardCount: 0,
      sentReferralId: null,
      sentAt: null,
      now: NOW_ANCHOR,
      recipientLabels: ["Test ward"],
      submissionAwaitingRecord: false,
      flowError: null,
      confirmationOpen: false,
      contactNeeded: 0,
      itemsLeft,
      itemsTotal: 19,
      warningCount,
    }).first;
  }

  // FORM-REF: what warns is named once every blocking item is in; it never counts as still needed.
  it("says every required item is in and how many warn", () => {
    expect(foot(0, 5)).toBe("All required items in · 5 not recorded");
    expect(foot(0, 1)).toBe("All required items in · 1 not recorded");
  });

  it("keeps the overall count while step items also remain", () => {
    expect(foot(7, 5)).toBe("7 of 19 items still needed");
    expect(foot(3, 0)).toBe("3 of 19 items still needed");
    expect(foot(0, 0)).toBe("All items in");
  });
});

describe("referral rail heading (P051)", () => {
  it("says Before you send while items remain and Ready to send when none do", () => {
    expect(drawerRailHeading(19)).toBe("Before you send");
    expect(drawerRailHeading(1)).toBe("Before you send");
    expect(drawerRailHeading(0)).toBe("Ready to send");
  });
});
