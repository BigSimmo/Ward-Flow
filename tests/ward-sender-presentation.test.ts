import { describe, expect, it } from "vitest";
import { senderPresentationLookup } from "@/components/ward-management/ward-sender-presentation";
import { filterWardPartialViewAt, type WardPartialView } from "@/components/ward-management/ward-partial-view-contract";

const view: WardPartialView = {
  version: 1,
  referrals: [
    {
      id: "RF-SYNTHETIC-SENDER",
      kind: "sender",
      state: "declined",
      withdrawn: false,
      decidedAt: 100,
      visibleUntil: 200,
      canWithdraw: false,
      informationNeeds: [],
    },
    { id: "RF-SYNTHETIC-RECEIVER", kind: "restricted", restriction: "receiving" },
    { id: "RF-SYNTHETIC-GRANT", kind: "restricted", restriction: "grant" },
  ],
  movements: [
    {
      id: "WF-SYNTHETIC-SENDER",
      kind: "sender",
      visibleUntil: 200,
      destinationStatus: "awaiting_answer",
      nextStep: "wait",
      progress: "escalated",
    },
    { id: "WF-SYNTHETIC-RECEIVER", kind: "restricted", restriction: "receiving" },
  ],
};

describe("sender display lookup", () => {
  it("returns only current sender entries without reconstructing a domain record", () => {
    const lookup = senderPresentationLookup(view, true);
    expect(lookup.referralFor({ id: "RF-SYNTHETIC-SENDER" })).toBe(view.referrals[0]);
    expect(lookup.movementFor({ id: "WF-SYNTHETIC-SENDER" })).toBe(view.movements[0]);
  });

  it("preserves existing scoped receiving and grant presentations", () => {
    const lookup = senderPresentationLookup(view, true);
    expect(lookup.referralFor({ id: "RF-SYNTHETIC-RECEIVER" })).toBeUndefined();
    expect(lookup.referralFor({ id: "RF-SYNTHETIC-GRANT" })).toBeUndefined();
    expect(lookup.movementFor({ id: "WF-SYNTHETIC-RECEIVER" })).toBeUndefined();
  });

  it.each([null, view])("marks missing required summaries unavailable: %j", (current) => {
    const lookup = senderPresentationLookup(current, true);
    expect(lookup.referralFor({ id: "RF-SYNTHETIC-ABSENT" })).toBeNull();
    expect(lookup.movementFor({ id: "WF-SYNTHETIC-ABSENT" })).toBeNull();
  });

  it("does not apply sender hints to other roles", () => {
    const lookup = senderPresentationLookup(view, false);
    expect(lookup.referralFor({ id: "RF-SYNTHETIC-SENDER" })).toBeUndefined();
    expect(lookup.movementFor({ id: "WF-SYNTHETIC-SENDER" })).toBeUndefined();
    expect(senderPresentationLookup(null, false).referralFor({ id: "RF-SYNTHETIC-ABSENT" })).toBeUndefined();
  });

  it("never uses a matching identifier from the other collection", () => {
    const lookup = senderPresentationLookup(view, true);
    expect(lookup.referralFor({ id: "WF-SYNTHETIC-SENDER" })).toBeNull();
    expect(lookup.movementFor({ id: "RF-SYNTHETIC-SENDER" })).toBeNull();
  });

  it("uses the filtered current display at the inclusive deadline and after expiry", () => {
    const before = senderPresentationLookup(filterWardPartialViewAt(view, 200), true);
    expect(before.referralFor({ id: "RF-SYNTHETIC-SENDER" })).toBe(view.referrals[0]);
    const after = senderPresentationLookup(filterWardPartialViewAt(view, 201), true);
    expect(after.referralFor({ id: "RF-SYNTHETIC-SENDER" })).toBeNull();
    expect(after.movementFor({ id: "WF-SYNTHETIC-SENDER" })).toBeNull();
    expect(after.referralFor({ id: "RF-SYNTHETIC-RECEIVER" })).toBeUndefined();
    expect(view.referrals).toHaveLength(3);
    expect(view.movements).toHaveLength(2);
  });
});
