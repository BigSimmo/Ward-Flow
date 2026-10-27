import { describe, expect, it } from "vitest";

import { auditActivity } from "@/components/ward-management/shell/ward-desk-audit";

const now = Date.parse("2026-10-27T13:00:00.000Z");
const row = (sequence: string, action: string, outcome: string, committed_at: string) => ({
  sequence,
  action,
  outcome,
  committed_at,
});

describe("P056: Activity from the server audit", () => {
  it("lists another desk's recorded changes newest first, in words, with no event code", () => {
    const shown = auditActivity(
      [
        row("4", "CONFIRM_CAPACITY", "rejected", "2026-10-27T11:00:00.000Z"),
        row("5", "CLOSE_UNIT", "accepted", "2026-10-27T12:00:00.000Z"),
      ],
      now,
    );
    expect(shown.changes.map((change) => change.text)).toEqual(["Close unit.", "Confirm capacity was refused."]);
    expect(shown.tones).toEqual({ "audit:5": "info", "audit:4": "danger" });
    expect(shown.lastEventAt).toBe(Date.parse("2026-10-27T12:00:00.000Z"));
    expect(JSON.stringify(shown)).not.toMatch(/CLOSE_UNIT|CONFIRM_CAPACITY/);
  });

  it("leaves out a row with an unreadable time and shows at most 20", () => {
    const many = Array.from({ length: 25 }, (_, index) =>
      row(String(index + 1), "CLOSE_UNIT", "accepted", new Date(now - index * 60_000).toISOString()),
    );
    const shown = auditActivity([...many, row("99", "CLOSE_UNIT", "accepted", "not a time")], now);
    expect(shown.changes).toHaveLength(20);
    expect(shown.changes.some((change) => change.id === "audit:99")).toBe(false);
  });

  it("is empty, with no last event, when the desk's audit has no rows", () => {
    expect(auditActivity([], now)).toEqual({ changes: [], tones: {}, lastEventAt: undefined });
  });
});

describe("Codex P2 on #1039: audit actions keep the Activity filter categories", () => {
  it("files declines, escalations, referrals and transfers under their filters, and the rest under other", () => {
    const shown = auditActivity(
      [
        row("1", "DECLINE", "accepted", "2026-10-27T12:01:00.000Z"),
        row("2", "RECORD_ESCALATION", "accepted", "2026-10-27T12:02:00.000Z"),
        row("3", "RAISE_REFERRAL", "accepted", "2026-10-27T12:03:00.000Z"),
        row("4", "RECEIVE_REFERRAL", "accepted", "2026-10-27T12:04:00.000Z"),
        row("5", "PULL_PATIENT", "accepted", "2026-10-27T12:05:00.000Z"),
        row("6", "CLOSE_UNIT", "accepted", "2026-10-27T12:06:00.000Z"),
        row("7", "DECLINE", "rejected", "2026-10-27T12:07:00.000Z"),
      ],
      now,
    );
    expect(Object.fromEntries(shown.changes.map((change) => [change.id, change.category]))).toEqual({
      "audit:1": "decline",
      "audit:2": "escalation",
      "audit:3": "referral",
      "audit:4": "referral",
      "audit:5": "transfer",
      "audit:6": "other",
      "audit:7": "other",
    });
  });
});
