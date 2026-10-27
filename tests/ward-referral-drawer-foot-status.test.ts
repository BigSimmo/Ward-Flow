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
    contactAttempted: true,
    itemsLeft: contactNeeded,
    itemsTotal: 9,
  });
}

describe("referral drawer footer after a refused Send (#823)", () => {
  const refusal = referralContactError(EMPTY_CONTACT)!;

  it("uses a real contact refusal, so the case below is not vacuous", () => {
    expect(refusal).toMatch(/^Enter your name/);
  });

  it("reads the live contact count while contact details are still missing", () => {
    expect(status(refusal, 2)).toMatchObject({ tone: "danger", first: "2 contact details needed" });
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
  function foot(itemsLeft: number, contactNeeded: number) {
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
      contactNeeded,
      contactAttempted: false,
      itemsLeft,
      itemsTotal: 19,
    }).first;
  }

  it("says only contact details remain, and that they are asked at Send", () => {
    expect(foot(5, 5)).toBe("5 contact details needed at Send");
    expect(foot(1, 1)).toBe("1 contact detail needed at Send");
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
