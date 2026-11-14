// Mechanics and clock audit (14 Nov 2026), M2, D-MCA (Josh, 14 Nov 2026): an overdue Pull now (the
// signed 15 minute rule) is act now on the shared task list, so Home's Act now figure, the bell,
// Tasks, the phone menu, the Alerts Act now list and the act-now notifications all count it, by the
// same test the banner turns red on. Synthetic data only.
import { describe, expect, it } from "vitest";

import { alertGroupOf, alertKindOf, isQueueItem } from "@/components/ward-management/alerts/alerts-model";
import { bannerEntriesForDesk } from "@/components/ward-management/alerts/global-alert-view";
import {
  COORDINATOR_DESK_ACKNOWLEDGER_ID,
  PULL_NOW_ANSWER_MINUTES,
} from "@/components/ward-management/alerts/ward-broadcast-model";
import {
  activeActNowItems,
  inboxItemsForRole,
  newActNowItems,
  overduePullNowInboxItems,
  taskItems,
} from "@/components/ward-management/ward-act-now-items";
import { alertsNowFigures } from "@/components/ward-management/ward-alerts-figures";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { INBOX_CATEGORIES, inboxItemIsActNow } from "@/components/ward-management/ward-inbox-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const MOVEMENT = "WF-003";
const WARD = "rph-adult-secure";
const ROW_ID = `${INBOX_CATEGORIES.pull_now_overdue.idPrefix}${MOVEMENT}`;
const ANSWER_BY = NOW + PULL_NOW_ANSWER_MINUTES;

const raised = (): WardFlowState =>
  wardFlowReducer(seedWardFlowState(), { type: "RAISE_PULL_NOW", role: "coordinator", now: NOW, movementId: MOVEMENT });

const actNow = (state: WardFlowState, now: Instant) => activeActNowItems(state, now);
const coordinator = { role: "coordinator", id: COORDINATOR_DESK_ACKNOWLEDGER_ID };

describe("an overdue Pull now is act now everywhere the banner is red", () => {
  it("adds one red row once nobody answered by the answer time, in step with the coordinator's banner", () => {
    const state = raised();
    for (let now = ANSWER_BY - 2; now <= ANSWER_BY + 2; now += 1) {
      const row = actNow(state, now).find((item) => item.id === ROW_ID);
      const bannerRed =
        bannerEntriesForDesk(state.broadcastAlerts, state.movements, coordinator, now).find(
          (entry) => entry.alert.movementId === MOVEMENT,
        )?.tone === "act_now";
      expect(row !== undefined).toBe(bannerRed);
      expect(row !== undefined).toBe(now > ANSWER_BY);
    }
    const row = actNow(state, ANSWER_BY + 1).find((item) => item.id === ROW_ID)!;
    expect(row).toMatchObject({ tone: "danger", kind: "fact", movementId: MOVEMENT, since: ANSWER_BY });
    expect(row.detail).toMatch(/did not answer by \d\d:\d\d\. Chase the ward\./);
  });

  it("counts in the Act now figure the bell, Tasks dock, Home and phone menu read, and on Alerts' Act now list", () => {
    const state = raised();
    const before = alertsNowFigures(actNow(state, ANSWER_BY), 0).actNow;
    const after = alertsNowFigures(actNow(state, ANSWER_BY + 1), 0).actNow;
    expect(after - before).toBe(1);
    const row = taskItems(state, ANSWER_BY + 1).find((item) => item.id === ROW_ID)!;
    expect(inboxItemIsActNow(row.id)).toBe(true);
    expect(isQueueItem(row)).toBe(true);
    expect(alertKindOf(row.id)).toBe("pullnow");
    expect(alertGroupOf(row)).toBe("act");
    expect(inboxItemsForRole([row], "coordinator")).toHaveLength(1);
  });

  it("is a new act-now row for the notifier the minute it goes overdue", () => {
    const state = raised();
    const previous = new Set(actNow(state, ANSWER_BY).map((item) => item.id));
    expect(newActNowItems(previous, actNow(state, ANSWER_BY + 1)).map((item) => item.id)).toContain(ROW_ID);
  });

  it("leaves once the asked ward answers, and is never raised without the alerts", () => {
    const answered = wardFlowReducer(raised(), {
      type: "REPLY_BROADCAST_ALERT",
      role: "ward",
      now: NOW + 3,
      alertId: "BCAST-1",
      unitId: WARD,
      answer: "pulling_now",
    } as WardFlowEvent);
    expect(actNow(answered, ANSWER_BY + 1).some((item) => item.id === ROW_ID)).toBe(false);
    const withoutAlerts = { ...raised(), broadcastAlerts: undefined };
    expect(overduePullNowInboxItems({ ...withoutAlerts }, ANSWER_BY + 1)).toEqual([]);
  });

  it("is a real row: the coordinator can acknowledge and snooze it like any act-now row", () => {
    let state = raised();
    state = wardFlowReducer(state, {
      type: "ACKNOWLEDGE_INBOX_ITEM",
      role: "coordinator",
      now: ANSWER_BY + 2,
      inboxItemId: ROW_ID,
    } as WardFlowEvent);
    expect(state.inboxAcknowledgements[ROW_ID]).toHaveLength(1);
    state = wardFlowReducer(state, {
      type: "SNOOZE_INBOX_ITEM",
      role: "coordinator",
      now: ANSWER_BY + 2,
      inboxItemId: ROW_ID,
      until: ANSWER_BY + 20,
      reason: "waiting_on_ward",
    } as WardFlowEvent);
    expect(state.rejections.at(-1)?.reason ?? "").not.toMatch(/inbox/);
    expect(actNow(state, ANSWER_BY + 3).some((item) => item.id === ROW_ID)).toBe(false);
  });
});
