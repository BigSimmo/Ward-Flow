import { describe, expect, it } from "vitest";

import {
  REAL_IDENTIFIER_WARNING,
  looksLikeRealIdentifier,
  realIdentifierWarning,
} from "@/components/ward-management/ward-real-identifier-guard";
import { isPastLimit } from "@/components/ward-management/ward-timed-rule";
import { DEFAULT_BROADCAST_DURATION_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { WA_BROADCAST_TEMPLATES } from "@/components/ward-management/alerts/ward-broadcast-model";
import { broadcastDraftBaseline } from "@/components/ward-management/alerts/broadcast-draft";
import {
  referralNotOpenedUnitIds,
  NOT_OPENED_TAG_MINUTES,
} from "@/components/ward-management/referrals/referral-not-opened";

describe("real-looking identifier guard (R-STRUCT-35)", () => {
  it("flags 8-digit record numbers, Medicare numbers and mobiles, never synthetic ones", () => {
    expect(looksLikeRealIdentifier("12345678")).toBe(true);
    expect(looksLikeRealIdentifier("2123 45670 1")).toBe(true);
    expect(looksLikeRealIdentifier("0412 345 678")).toBe(true);
    expect(looksLikeRealIdentifier("+61 412 345 678")).toBe(true);
    expect(looksLikeRealIdentifier("UM100047")).toBe(false);
    expect(looksLikeRealIdentifier("")).toBe(false);
    expect(looksLikeRealIdentifier("08 5550 1017")).toBe(false);
  });
  it("gives one plain warning and nothing otherwise", () => {
    expect(realIdentifierWarning(["UM100001", undefined, "0412345678"])).toBe(REAL_IDENTIFIER_WARNING);
    expect(realIdentifierWarning(["UM100001", ""])).toBeUndefined();
  });
});

describe("one boundary rule (R-HOME-14)", () => {
  it("fires strictly after the limit", () => {
    expect(isPastLimit(30, 30)).toBe(false);
    expect(isPastLimit(31, 30)).toBe(true);
  });
  it("tags a referral Not opened yet only after the limit", () => {
    const referral = (ageMinutes: number) =>
      ({
        raisedAt: 1000 - ageMinutes,
        destinations: [
          { destination: { kind: "psychiatric_ward", unitId: "u1" }, referredAt: 1000 - ageMinutes, state: "queued" },
        ],
      }) as never;
    expect(referralNotOpenedUnitIds(referral(NOT_OPENED_TAG_MINUTES), 1000 as never)).toEqual([]);
    expect(referralNotOpenedUnitIds(referral(NOT_OPENED_TAG_MINUTES + 1), 1000 as never)).toEqual(["u1"]);
  });
});

describe("default broadcast length (R-HOME-21)", () => {
  it("starts the composer on 4 hours", () => {
    expect(DEFAULT_BROADCAST_DURATION_MINUTES).toBe(240);
    const first = WA_BROADCAST_TEMPLATES.find((template) => template.id === "wa-adult-bed-call");
    expect(first?.defaultDurationMinutes).toBe(240);
    expect(broadcastDraftBaseline("wa-adult-bed-call").durationMinutes).toBe(240);
  });
});

describe("7-day discharge plan prompt (R-HOME-11)", () => {
  it("adds one quiet info row naming the signed line, and none for zero", async () => {
    const { wardLiveFormAlerts } = await import("@/components/ward-management/ward/ward-screen-derivations");
    const base = {
      resolvePatientIdentity: () => ({ formalName: "Synthetic Person" }) as never,
      accepted: [],
      now: 100,
      thresholds: {} as never,
      overdueLeaveBeds: [],
      unit: { name: "Synthetic Ward" } as never,
    };
    expect(wardLiveFormAlerts(base).liveFormAlerts).toEqual([]);
    const rows = wardLiveFormAlerts({ ...base, longStayNoPlanCount: 2 }).liveFormAlerts;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: "long-stay-no-plan", tone: "info" });
    expect(rows[0]?.text).toContain("2 stays have reached 7 days");
    expect(rows[0]?.text).toContain("Clears when an expected discharge date is recorded");
  });
});
