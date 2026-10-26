import { describe, expect, it } from "vitest";
import { senderPresentationLookup } from "@/components/ward-management/ward-sender-presentation";
import {
  filterWardPartialViewAt,
  mergeArchivedWardPartialView,
  type BoundWardPartialView,
  type WardPartialView,
} from "@/components/ward-management/ward-partial-view-contract";

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

describe("archived records beside the live display", () => {
  const context = "c".repeat(64);
  const live: BoundWardPartialView = { revision: 5, accessContext: context, view };
  const archivedReferral = {
    id: "RF-SYNTHETIC-ARCHIVED",
    kind: "sender" as const,
    state: "declined" as const,
    withdrawn: false,
    decidedAt: 10,
    visibleUntil: null,
    canWithdraw: false,
    informationNeeds: [],
  };
  const archivedMovement = {
    id: "WF-SYNTHETIC-ARCHIVED",
    kind: "sender" as const,
    visibleUntil: null,
    destinationStatus: "none_found" as const,
    nextStep: "escalate" as const,
    progress: "none_found" as const,
  };

  it("gives an archived record its sender progress instead of 'unavailable'", () => {
    const before = senderPresentationLookup(live.view, true);
    expect(before.referralFor({ id: archivedReferral.id })).toBeNull();
    expect(before.movementFor({ id: archivedMovement.id })).toBeNull();
    const merged = mergeArchivedWardPartialView(live, {
      version: 1,
      referrals: [archivedReferral],
      movements: [archivedMovement],
    });
    expect(merged.revision).toBe(5);
    expect(merged.accessContext).toBe(context);
    const after = senderPresentationLookup(merged.view, true);
    expect(after.referralFor({ id: archivedReferral.id })).toMatchObject({ kind: "sender", state: "declined" });
    expect(after.movementFor({ id: archivedMovement.id })).toMatchObject({ kind: "sender", progress: "none_found" });
    expect(Object.isFrozen(merged.view.referrals)).toBe(true);
  });

  it("lets the live row win, and falls back to the live display when the merge would be invalid", () => {
    const clash = mergeArchivedWardPartialView(live, {
      version: 1,
      referrals: [{ ...archivedReferral, id: "RF-SYNTHETIC-SENDER", state: "accepted" }],
      movements: [],
    });
    expect(clash.view.referrals.filter((row) => row.id === "RF-SYNTHETIC-SENDER")).toHaveLength(1);
    expect(clash.view.referrals.find((row) => row.id === "RF-SYNTHETIC-SENDER")).toMatchObject({ state: "declined" });
    const bad = mergeArchivedWardPartialView(live, {
      version: 1,
      referrals: [
        { ...archivedReferral, state: "queued", withdrawn: false, canWithdraw: true, informationNeeds: ["bogus"] },
      ],
      movements: [],
    } as unknown as WardPartialView);
    expect(bad).toBe(live);
  });
});
