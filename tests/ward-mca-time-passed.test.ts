// Mechanics and clock audit (14 Nov 2026), L2 and L3, D-210 (Josh, 14 Nov 2026): one "has this time
// passed?" rule, and a pulled bed's running-out mark from the Settings warnings. Synthetic data only.
import { describe, expect, it } from "vitest";

import { PULL_NOW_ANSWER_MINUTES, isPullNowOverdue } from "@/components/ward-management/alerts/ward-broadcast-model";
import { plannedRows } from "@/components/ward-management/coordinator/planned-model";
import { isActNow, type HandoverRow } from "@/components/ward-management/handover/handover-model";
import { plannedAdmissionIsOverdue, type PlannedAdmission } from "@/components/ward-management/ward-admissions";
import { bedHold, bedHoldLapsed } from "@/components/ward-management/ward-bed-hold";
import { bedReviewDue } from "@/components/ward-management/ward-bed-closure-review";
import {
  clockState,
  DEFAULT_DUE_SOON_THRESHOLDS,
  dueSoonThresholdsOf,
  isClockBreached,
  isTimePassed,
  MINUTES_PER_DAY,
} from "@/components/ward-management/ward-clock";
import { decisionTargetReading } from "@/components/ward-management/ward-decision-targets";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { undoWindowRefusal, UNDO_WINDOW_MINUTES } from "@/components/ward-management/ward-undo";

const DUE = 15 * 60;

describe("isTimePassed: the one clock rule", () => {
  it("is passed only once the clock is strictly after the due minute", () => {
    expect(isTimePassed(DUE, DUE - 1)).toBe(false);
    expect(isTimePassed(DUE, DUE)).toBe(false);
    expect(isTimePassed(DUE, DUE + 1)).toBe(true);
    expect(isTimePassed(undefined, DUE)).toBe(false);
    expect(isTimePassed(null, DUE)).toBe(false);
    expect(isTimePassed(Number.NaN, DUE)).toBe(false);
    expect(isTimePassed(Number.POSITIVE_INFINITY, DUE)).toBe(false);
  });

  it("agrees with a legal breach at every minute either side of the due time", () => {
    for (let now = DUE - 5; now <= DUE + 5; now += 1) {
      const legal = isClockBreached(DUE, now);
      expect(isTimePassed(DUE, now)).toBe(legal);
      expect(clockState(DUE, now, DEFAULT_DUE_SOON_THRESHOLDS) === "breached").toBe(legal);
      // A pull, a closed bed's review and a planned admission pass on the same minute.
      expect(bedHoldLapsed(DUE, now)).toBe(legal);
      expect(bedHold(DUE, now, DEFAULT_DUE_SOON_THRESHOLDS)?.state === "lapsed").toBe(legal);
      expect(bedReviewDue({ bedNumber: 1, closedAt: 0, reviewAt: DUE } as never, now)).toBe(legal);
      expect(
        plannedAdmissionIsOverdue({ state: "booked", expectedArrivalAt: DUE } as unknown as PlannedAdmission, now),
      ).toBe(legal);
      const row = { pullExpiresAt: DUE, stage: "pulled" } as unknown as HandoverRow;
      expect(isActNow(row, now)).toBe(legal);
    }
  });

  it("makes a Pull now overdue, and a decision target overdue, only after their minute", () => {
    const raised = wardFlowReducer(seedWardFlowState(), {
      type: "RAISE_PULL_NOW",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId: "WF-003",
    });
    const alert = raised.broadcastAlerts[0]!;
    const answerBy = NOW_ANCHOR + PULL_NOW_ANSWER_MINUTES;
    expect(isPullNowOverdue(alert, answerBy)).toBe(false);
    expect(isPullNowOverdue(alert, answerBy + 1)).toBe(true);

    const seed = seedWardFlowState();
    const base = seed.movements.find((m) => !m.closure && m.stage === "accepted_awaiting_bed" && m.acceptedUnitId)!;
    const movement = { ...base, acceptedAt: 600 } as Movement;
    const due = 600 + seed.configuration.transferAcceptanceTargetMinutes;
    expect(decisionTargetReading(movement, due, seed.configuration)?.overdue).toBe(false);
    expect(decisionTargetReading(movement, due + 1, seed.configuration)?.overdue).toBe(true);
  });

  it("keeps a planned time upcoming at its own minute and marks it past the minute after", () => {
    const seed = seedWardFlowState();
    const base = seed.movements.find((m) => !m.closure && m.stage === "accepted_awaiting_bed" && m.acceptedUnitId)!;
    const movement = { ...base, plannedMoveAt: DUE } as Movement;
    const rows = (now: number) =>
      plannedRows({
        movements: [movement],
        admissions: [],
        plannedAdmissions: [],
        units: seed.units,
        configuration: seed.configuration,
        now,
        until: now + 8 * 60,
        endOfDay: MINUTES_PER_DAY,
        nameOf: () => ({ formalName: "SYNTHETIC, Person" }) as never,
      }).find((row) => row.id === `move:${movement.id}`)?.past;
    expect(rows(DUE - 1)).toBe(false);
    expect(rows(DUE)).toBe(false);
    expect(rows(DUE + 1)).toBe(true);
  });

  it("offers Undo for exactly as long as the engine accepts it", () => {
    const at = 600;
    expect(undoWindowRefusal(at, at + UNDO_WINDOW_MINUTES)).toBeNull();
    expect(undoWindowRefusal(at, at + UNDO_WINDOW_MINUTES + 1)).not.toBeNull();
    // The out-of-area Flag early button shows while `!isTimePassed(at + UNDO_WINDOW_MINUTES, now)`.
    expect(!isTimePassed(at + UNDO_WINDOW_MINUTES, at + UNDO_WINDOW_MINUTES)).toBe(true);
    expect(!isTimePassed(at + UNDO_WINDOW_MINUTES, at + UNDO_WINDOW_MINUTES + 1)).toBe(false);
  });
});

describe("a pulled bed's running-out mark (L3)", () => {
  it("follows the Settings act-now warning, inclusive, as a legal form's critical lane does", () => {
    const end = 15 * 60;
    for (const settings of [{}, { dueSoonUrgentMinutes: 120, dueSoonMinutes: 240 }, { dueSoonUrgentMinutes: 30 }]) {
      const thresholds = dueSoonThresholdsOf(settings);
      for (let left = 0; left <= 200; left += 1) {
        const now = end - left;
        const hold = bedHold(end, now, thresholds)!;
        expect(hold.state === "at-risk").toBe(clockState(end, now, thresholds) === "critical");
      }
    }
  });

  it("marks a pull 90 minutes from its end as running out when Settings warn at 2 hours", () => {
    const thresholds = dueSoonThresholdsOf({ dueSoonUrgentMinutes: 120, dueSoonMinutes: 240 });
    expect(bedHold(900, 810, thresholds)?.state).toBe("at-risk");
    expect(bedHold(900, 810, DEFAULT_DUE_SOON_THRESHOLDS)?.state).toBe("held");
  });
});
