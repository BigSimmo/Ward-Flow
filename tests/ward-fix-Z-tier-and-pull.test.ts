import { describe, expect, it } from "vitest";

import { bedMeetingAgenda } from "@/components/ward-management/bed-meeting/bed-meeting-agenda";
import { edReferralStatus } from "@/components/ward-management/ed/ed-referral-status";
import { PULL_NO_LIMIT_RECORDED } from "@/components/ward-management/ward-bed-hold";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { TIER_NOT_RECORDED, urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { tierOverdueAfterMinutes } from "@/components/ward-management/ward-shared-figures";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * D-187 (Josh, 13 Nov 2026). F-30 (Q33, T12): a referral with no urgency tier reads "Tier not
 * recorded" and keeps tier 3's overdue window, unchanged. F-46 (Q34, T13): a pull past its limit
 * stays pulled until a person releases it, and a pull with no limit recorded says so instead of
 * nothing or the configured default. Synthetic seed data only.
 */

describe("D-187 F-30: a referral with no urgency tier", () => {
  it("reads Tier not recorded, never a tier", () => {
    expect(urgencyTierLabel(undefined)).toBe(TIER_NOT_RECORDED);
    expect(TIER_NOT_RECORDED).toBe("Tier not recorded");
    expect(urgencyTierLabel(3)).toBe("Tier 3 · least urgent");
  });

  it("keeps today's overdue window, tier 3's (no window value changes)", () => {
    expect(tierOverdueAfterMinutes(undefined)).toBe(tierOverdueAfterMinutes(3));
  });
});

const seeded = seedWardFlowState().movements;
const pulledMovement = (extra: Partial<Movement> = {}): Movement => ({
  ...seeded.find((candidate) => candidate.originEdId !== undefined)!,
  stage: "pulled",
  closure: undefined,
  edOutcome: undefined,
  declines: [],
  acceptedUnitId: undefined,
  admissionId: undefined,
  pullExpiresAt: undefined,
  transport: undefined,
  transportNeed: undefined,
  referredUnitIds: [],
  ...extra,
});

describe("D-187 F-46: a pull with no limit recorded says so", () => {
  it("on the ED's referral status, instead of the configured default", () => {
    const status = edReferralStatus(pulledMovement(), {
      acceptedUnitName: undefined,
      fallback: "In department",
      referredTo: undefined,
      now: 1_000,
    });
    expect(status.line).toBe(`Accepted, bed pulled, ${PULL_NO_LIMIT_RECORDED.toLowerCase()}`);
    expect(status.line).not.toMatch(/\d+h pull time limit/);
    expect(status.steps?.find((step) => step.detail === PULL_NO_LIMIT_RECORDED)).toBeDefined();
  });

  it("on the bed meeting's pulled-bed list, last, rather than being left off", () => {
    const now = 1_000;
    const withLimit = pulledMovement({ id: "WF-Z-LIMIT", pullExpiresAt: now + 60 });
    const noLimit = pulledMovement({ id: "WF-Z-NOLIMIT" });
    const agenda = bedMeetingAgenda(
      { movements: [noLimit, withLimit], admissions: [], bedReleases: [], units: [] },
      now,
    );
    const holds = agenda.find((section) => section.id === "holds")!;
    expect(holds.items.map((item) => item.record.id)).toEqual(["WF-Z-LIMIT", "WF-Z-NOLIMIT"]);
    expect(holds.items[1]).toMatchObject({ detail: "Pulled bed", value: PULL_NO_LIMIT_RECORDED });
  });
});

describe("D-187 F-46: a pull past its limit stays pulled until a person releases it", () => {
  const MOVEMENT_ID = "WF-009";
  const UNIT_ID = "rph-adult-secure";

  it("is not released by time passing", () => {
    let state: WardFlowState = seedWardFlowState();
    for (const event of [
      { type: "REFER_TO_UNITS", role: "coordinator", unitIds: [UNIT_ID] },
      { type: "ACCEPT_IN_PRINCIPLE", role: "ward", unitId: UNIT_ID, actingUnitId: UNIT_ID },
      { type: "PULL_PATIENT", role: "ward", unitId: UNIT_ID, actingUnitId: UNIT_ID },
    ] as const) {
      state = wardFlowReducer(state, { ...event, now: NOW_ANCHOR, movementId: MOVEMENT_ID } as never);
    }
    expect(state.rejections).toEqual([]);
    const pulled = state.movements.find((movement) => movement.id === MOVEMENT_ID)!;
    expect(pulled.stage).toBe("pulled");
    const limit = pulled.pullExpiresAt!;
    expect(limit).toBeGreaterThan(NOW_ANCHOR);

    const later = wardFlowReducer(state, {
      type: "ADVANCE_CLOCK",
      role: "coordinator",
      now: NOW_ANCHOR,
      minutes: limit - NOW_ANCHOR + 24 * 60,
    });
    const after = later.movements.find((movement) => movement.id === MOVEMENT_ID)!;
    expect(after.stage).toBe("pulled");
    expect(after.pullExpiresAt).toBe(limit);
    expect(after.admissionId).toBe(pulled.admissionId);
  });
});
