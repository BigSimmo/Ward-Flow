import { describe, expect, it } from "vitest";

import {
  NO_FILTERS,
  boardRows,
  filterRows,
  type BoardRow,
} from "@/components/ward-management/delays/delays-board-model";
import { delayGroups } from "@/components/ward-management/delays/delays-derivations";
import { filtersFromSearch, filtersKey } from "@/components/ward-management/delays/delays-url-state";
import { WAITING_VIEWS, waitingHref } from "@/components/ward-management/delays/waiting-href";
import {
  inWaitingView,
  isForHandover,
  isFormDue,
  queuedReferralCount,
  waitingViewLabel,
} from "@/components/ward-management/delays/waiting-views";
import {
  defaultHandoverShift,
  handoverCutoff,
  isActNow,
  isDueBy,
  toHandoverRow,
} from "@/components/ward-management/handover/handover-model";
import { activeActNowItems } from "@/components/ward-management/ward-act-now-items";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * B4 saved views (Josh, 19 Oct 2026). Each view narrows the Delays board and never re-sorts it;
 * form times are the recorded due times only.
 */

const state = seedWardFlowState();
const UNITS = allUnits();
const T = DEFAULT_DUE_SOON_THRESHOLDS;
const ROWS = boardRows(delayGroups(state.movements, UNITS, NOW_ANCHOR, T), NOW_ANCHOR);
const nameOf = () => "";

function row(patch: Partial<BoardRow> & { flaggedUrgent?: boolean }): BoardRow {
  const { flaggedUrgent = false, ...rest } = patch;
  return {
    owner: "wards",
    dueIn: undefined,
    forHandover: false,
    movement: { flaggedUrgent } as Movement,
    ...rest,
  } as BoardRow;
}

describe("Form due", () => {
  it("holds a recorded due time within the 3 hour window, or already passed, and nothing without one", () => {
    expect(isFormDue(row({ dueIn: T.soonMinutes }), T)).toBe(true);
    expect(isFormDue(row({ dueIn: -30 }), T)).toBe(true);
    expect(isFormDue(row({ dueIn: T.soonMinutes + 1 }), T)).toBe(false);
    expect(isFormDue(row({ dueIn: undefined }), T)).toBe(false);
  });

  it("is labelled with the configured hours", () => {
    expect(waitingViewLabel("form", T)).toBe("Form due within 3 h");
    expect(waitingViewLabel("form", { ...T, soonMinutes: 90 })).toBe("Form due within 90 min");
  });
});

describe("Needs me now", () => {
  it("is the coordinator's own decision, a close form time, or a flagged journey", () => {
    expect(inWaitingView("needs-me", row({ owner: "yours" }), T)).toBe(true);
    expect(inWaitingView("needs-me", row({ dueIn: 60 }), T)).toBe(true);
    expect(inWaitingView("needs-me", row({ flaggedUrgent: true }), T)).toBe(true);
    expect(inWaitingView("needs-me", row({ owner: "transport", dueIn: T.soonMinutes + 60 }), T)).toBe(false);
  });
});

describe("For handover", () => {
  it("uses the Handover sheet's own act now and due by rules against the next handover", () => {
    const cutoff = handoverCutoff(defaultHandoverShift(NOW_ANCHOR), NOW_ANCHOR);
    for (const { movement } of ROWS) {
      const sheet = toHandoverRow(movement, UNITS, [], []);
      expect(isForHandover(movement, NOW_ANCHOR)).toBe(
        isActNow(sheet, NOW_ANCHOR) || isDueBy(sheet, NOW_ANCHOR, cutoff),
      );
    }
  });

  it("follows the shared act-now list, as the Handover sheet's Act now does", () => {
    const actNowIds = new Set(
      activeActNowItems(
        {
          movements: state.movements,
          units: UNITS,
          configuration: state.configuration,
          inboxSnoozes: state.inboxSnoozes,
        },
        NOW_ANCHOR,
      ).map((item) => item.movementId),
    );
    const cutoff = handoverCutoff(defaultHandoverShift(NOW_ANCHOR), NOW_ANCHOR);
    const rows = boardRows(delayGroups(state.movements, UNITS, NOW_ANCHOR, T), NOW_ANCHOR, actNowIds);
    for (const candidate of rows) {
      const sheet = {
        ...toHandoverRow(candidate.movement, UNITS, [], []),
        actNow: actNowIds.has(candidate.movement.id),
      };
      expect(candidate.forHandover).toBe(isActNow(sheet, NOW_ANCHOR) || isDueBy(sheet, NOW_ANCHOR, cutoff));
    }
    // A journey on the list for a reason the row's own times cannot show still counts.
    const quiet = ROWS.find(({ movement }) => !isForHandover(movement, NOW_ANCHOR))!.movement;
    expect(isForHandover(quiet, NOW_ANCHOR, true)).toBe(true);
  });

  it("counts a recorded form due before the next handover, and not one due after it", () => {
    const base = ROWS.find(({ movement }) => !movement.flaggedUrgent && movement.pullExpiresAt === undefined)!.movement;
    const cutoff = handoverCutoff(defaultHandoverShift(NOW_ANCHOR), NOW_ANCHOR);
    const form = (dueAt: number): Movement => ({ ...base, legalForm: { ...base.legalForm!, code: "1A", dueAt } });
    expect(isForHandover(form(cutoff - 1), NOW_ANCHOR)).toBe(true);
    expect(isForHandover(form(cutoff + 60), NOW_ANCHOR)).toBe(false);
  });
});

describe("views on the board", () => {
  it("narrow the rows and keep their order", () => {
    for (const view of WAITING_VIEWS) {
      const shown = filterRows(ROWS, { ...NO_FILTERS, view }, [], nameOf, T);
      const expected = ROWS.filter((candidate) => inWaitingView(view, candidate, T));
      expect(shown.map((candidate) => candidate.movement.id)).toEqual(
        expected.map((candidate) => candidate.movement.id),
      );
    }
  });

  it("the seed has people in every view, so each view is exercised", () => {
    for (const view of WAITING_VIEWS) expect(ROWS.some((candidate) => inWaitingView(view, candidate, T))).toBe(true);
  });

  it("round-trip through the address, and an unknown view is ignored", () => {
    expect(filtersFromSearch("?view=handover").view).toBe("handover");
    expect(filtersKey({ ...NO_FILTERS, view: "form" })).toBe("view=form");
    expect(filtersFromSearch("?view=everything").view).toBeNull();
  });
});

describe("links in", () => {
  it("open the board on one view, or on everyone", () => {
    expect(waitingHref()).toBe("/ward-flow/waiting");
    expect(waitingHref("needs-me")).toBe("/ward-flow/waiting?view=needs-me");
    expect(filtersFromSearch(new URL(waitingHref("form"), "https://x.test").search).view).toBe("form");
  });
});

describe("referrals not yet a movement", () => {
  it("counts the referral queue the Home queue works, narrowed to a chosen service", () => {
    expect(queuedReferralCount(state.referrals, null, UNITS)).toBe(referralQueueOrder(state.referrals).length);
    expect(queuedReferralCount(state.referrals, "North Metro", UNITS)).toBeLessThanOrEqual(
      queuedReferralCount(state.referrals, null, UNITS),
    );
  });
});
