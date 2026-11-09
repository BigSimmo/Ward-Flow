import { describe, expect, it } from "vitest";

import {
  alertsToShow,
  defaultAlertPreferences,
  deskSeesStaffRequests,
  inQuietHours,
  parseAlertPreferences,
  quietHoursText,
  type AlertPreferences,
} from "@/components/ward-management/shell/ward-alert-preferences";
import type { InboxItem } from "@/components/ward-management/ward-derivations";

const item = (id: string, tone: InboxItem["tone"]) => ({ id, tone, title: id }) as unknown as InboxItem;
const prefs = (patch: Partial<AlertPreferences> = {}): AlertPreferences => ({
  ...defaultAlertPreferences("coordinator"),
  ...patch,
});

describe("smart alert preferences (item 20)", () => {
  it("adds nothing beyond act now until the person chooses it", () => {
    expect(defaultAlertPreferences("ward")).toEqual({
      dueSoon: false,
      staffRequests: false,
      quiet: { on: false, start: 22 * 60, end: 7 * 60 },
    });
  });

  it("handles an overnight window that wraps past midnight", () => {
    const quiet = { on: true, start: 22 * 60, end: 7 * 60 };
    expect(inQuietHours(23 * 60, quiet)).toBe(true);
    expect(inQuietHours(3 * 60, quiet)).toBe(true);
    expect(inQuietHours(7 * 60, quiet)).toBe(false);
    expect(inQuietHours(12 * 60, quiet)).toBe(false);
    expect(inQuietHours(23 * 60, { ...quiet, on: false })).toBe(false);
    expect(quietHoursText(quiet)).toBe("22:00 to 07:00");
  });

  it("always lets act now through, even in quiet hours", () => {
    const fresh = [item("red", "danger"), item("amber", "warning")];
    const quiet = { on: true, start: 22 * 60, end: 7 * 60 };
    const night = alertsToShow(fresh, prefs({ dueSoon: true, quiet }), 2 * 60);
    expect(night.actNow.map((row) => row.id)).toEqual(["red"]);
    expect(night.dueSoon).toEqual([]);
    expect(night.held).toBe(1);
    const day = alertsToShow(fresh, prefs({ dueSoon: true, quiet }), 10 * 60);
    expect(day.dueSoon.map((row) => row.id)).toEqual(["amber"]);
    expect(alertsToShow(fresh, prefs(), 10 * 60).dueSoon).toEqual([]);
  });

  it("keeps only well-formed stored values and offers staff requests to coordinating desks only", () => {
    expect(parseAlertPreferences("not json", "ed")).toEqual(defaultAlertPreferences("ed"));
    expect(parseAlertPreferences(JSON.stringify({ dueSoon: true, staffRequests: true }), "ward")).toMatchObject({
      dueSoon: true,
      staffRequests: false,
    });
    expect(
      parseAlertPreferences(
        JSON.stringify({ staffRequests: true, quiet: { on: true, start: 9999, end: 1 } }),
        "coordinator",
      ),
    ).toMatchObject({ staffRequests: true, quiet: { on: false } });
    expect(deskSeesStaffRequests("bed_manager")).toBe(true);
    expect(deskSeesStaffRequests("ed")).toBe(false);
  });
});
