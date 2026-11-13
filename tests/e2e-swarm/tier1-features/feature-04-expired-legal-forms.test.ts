import { describe, expect, it } from "vitest";
import { handoverLines } from "@/components/ward-management/legal-forms/legal-forms-view";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("Tier 1 - Feature 04: Expired Legal Forms Handover Alert Retention", () => {
  const now = NOW_ANCHOR; // 642 minutes (10:42 AWST)
  const windowMinutes = 480; // 8-hour shift window

  const createMockMovement = (id: string, code: string, dueAt: number, patientName: string): Movement => {
    return {
      id,
      stage: "pulled",
      legalStatus: "Involuntary",
      legalForm: {
        code,
        dueAt,
        receivedAt: now - 360,
      },
      flaggedUrgent: false,
      urgency: 2,
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      gender: "Female",
      openedAt: now - 360,
      statusChanges: [],
      urgencyChanges: [],
      overrides: [],
      owner: "ed",
      referredUnitIds: [],
      declines: [],
      blocker: "None",
      observation: "general",
      highAcuity: false,
    } as unknown as Movement;
  };

  const nameOf = (m: Movement) => `Patient-${m.id}`;

  it("retains expired legal orders (left < 0) with a prominent ⚠️ EXPIRED alert badge", () => {
    // Order expired 2 hours (120 minutes) ago
    const expiredMovement = createMockMovement("WF-EXP-1", "1A", now - 120, "Alice");
    const lines = handoverLines([expiredMovement], now, nameOf, windowMinutes);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("⚠️ EXPIRED");
    expect(lines[0]).toContain("[2h ago]");
    expect(lines[0]).toContain("Form 1A");
    expect(lines[0]).toContain("Patient-WF-EXP-1");
  });

  it("retains imminent legal orders due within the shift handover window", () => {
    // Order due in 90 minutes
    const imminentMovement = createMockMovement("WF-IMM-1", "3A", now + 90, "Bob");
    const lines = handoverLines([imminentMovement], now, nameOf, windowMinutes);

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("⚠️ EXPIRED");
    expect(lines[0]).toContain("Form 3A");
    expect(lines[0]).toContain("Patient-WF-IMM-1");
  });

  it("excludes distant legal orders due beyond the shift window", () => {
    // Order due in 10 hours (600 minutes > 480 window)
    const distantMovement = createMockMovement("WF-DIST-1", "5A", now + 600, "Charlie");
    const lines = handoverLines([distantMovement], now, nameOf, windowMinutes);

    expect(lines).toHaveLength(0);
  });

  it("sorts multiple legal orders chronologically: expired first, then soonest due", () => {
    const expired1 = createMockMovement("WF-EXP-1", "1A", now - 180, "Diana"); // 3h ago
    const expired2 = createMockMovement("WF-EXP-2", "1A", now - 60, "Edward"); // 1h ago
    const imminent = createMockMovement("WF-IMM-1", "6A", now + 30, "Fiona"); // in 30m

    const lines = handoverLines([imminent, expired1, expired2], now, nameOf, windowMinutes);

    expect(lines).toHaveLength(3);
    // Oldest expiry first
    expect(lines[0]).toContain("Patient-WF-EXP-1");
    expect(lines[0]).toContain("3h ago");
    expect(lines[1]).toContain("Patient-WF-EXP-2");
    expect(lines[1]).toContain("1h ago");
    expect(lines[2]).toContain("Patient-WF-IMM-1");
  });

  it("correctly calculates hours elapsed for orders expired recently (e.g. 15 minutes ago defaults to 1h ago)", () => {
    const recentlyExpired = createMockMovement("WF-EXP-3", "1A", now - 15, "George");
    const lines = handoverLines([recentlyExpired], now, nameOf, windowMinutes);

    expect(lines).toHaveLength(1);
    // Math.max(1, Math.round(15 / 60)) = 1h ago
    expect(lines[0]).toContain("⚠️ EXPIRED [1h ago]: Form 1A");
  });
});
