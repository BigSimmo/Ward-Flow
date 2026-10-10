import { describe, expect, it } from "vitest";

import { bannerEntriesForDesk, replyBoard } from "../src/components/ward-management/alerts/global-alert-view";
import {
  COORDINATOR_DESK_ACKNOWLEDGER_ID,
  PULL_NOW_ANSWER_MINUTES,
  getActiveBroadcastAlert,
  isPullNowOverdue,
} from "../src/components/ward-management/alerts/ward-broadcast-model";
import type { Instant } from "../src/components/ward-management/ward-clock";
import { RELEASE_PULL_REASONS } from "../src/components/ward-management/ward-change-reasons";
import type { WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import { isValidStoredWardFlowState } from "../src/components/ward-management/ward-flow-storage-validation";
import { seedWardFlowState, wardFlowReducer } from "../src/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "../src/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
type State = ReturnType<typeof seedWardFlowState>;

const raise = (state: State, movementId: string, role: WardFlowEvent["role"] = "coordinator") =>
  wardFlowReducer(state, { type: "RAISE_PULL_NOW", role, now: NOW, movementId });

const reply = (state: State, fields: Partial<WardFlowEvent & { type: "REPLY_BROADCAST_ALERT" }>) =>
  wardFlowReducer(state, {
    type: "REPLY_BROADCAST_ALERT",
    role: "ward",
    now: NOW,
    alertId: "BCAST-1",
    unitId: "rph-adult-secure",
    answer: "pulling_now",
    ...fields,
  } as WardFlowEvent);

const lastRefusal = (state: State) => state.rejections.at(-1)?.reason;

describe("Pull now (global alerts, 10 Oct 2026)", () => {
  it("asks the accepting ward, with a 15 minute answer time", () => {
    const next = raise(seedWardFlowState(), "WF-003");
    const [alert] = next.broadcastAlerts;
    expect(alert).toMatchObject({ kind: "pull_now", movementId: "WF-003", targetUnitIds: ["rph-adult-secure"] });
    expect(alert.answerBy).toBe(NOW + PULL_NOW_ANSWER_MINUTES);
    expect(alert.severity).toBe("critical");
  });

  it("asks every ward still considering the referral when nobody has accepted, skipping declines", () => {
    const next = raise(seedWardFlowState(), "WF-017");
    expect(next.broadcastAlerts[0].targetUnitIds).toEqual(["bty-adult-secure"]);
  });

  it("refuses a patient with no ward left to ask, a duplicate, and any role but the coordinator", () => {
    const seed = seedWardFlowState();
    expect(raise(seed, "WF-009").broadcastAlerts).toHaveLength(0);
    expect(lastRefusal(raise(seed, "WF-009"))).toMatch(/no ward to ask/);
    const once = raise(seed, "WF-003");
    expect(raise(once, "WF-003").broadcastAlerts).toHaveLength(1);
    expect(raise(seed, "WF-003", "ward").broadcastAlerts).toHaveLength(0);
  });

  it("takes an answer only from a ward it asked, from the fixed list", () => {
    const raised = raise(seedWardFlowState(), "WF-003");
    expect(reply(raised, { unitId: "fsh-older-adult" }).broadcastAlerts[0].replies).toHaveLength(0);
    expect(reply(raised, { answer: "can_take" as never }).broadcastAlerts[0].replies).toHaveLength(0);
    expect(reply(raised, { answer: "cannot" }).broadcastAlerts[0].replies).toHaveLength(0);
    const answered = reply(raised, { answer: "cannot", reason: "no_suitable_bed" });
    expect(answered.broadcastAlerts[0].replies?.[0]).toMatchObject({ answer: "cannot", reason: "no_suitable_bed" });
    expect(answered.broadcastAlerts[0].acknowledgedUnits).toEqual(["rph-adult-secure"]);
  });

  it("returns to the coordinator as act now when nobody answers in time, and not once a ward has", () => {
    const raised = raise(seedWardFlowState(), "WF-003");
    const later = (NOW + PULL_NOW_ANSWER_MINUTES) as Instant;
    expect(isPullNowOverdue(raised.broadcastAlerts[0], NOW)).toBe(false);
    expect(isPullNowOverdue(raised.broadcastAlerts[0], later)).toBe(true);
    const coordinator = { role: "coordinator", id: COORDINATOR_DESK_ACKNOWLEDGER_ID };
    expect(bannerEntriesForDesk(raised.broadcastAlerts, raised.movements, coordinator, later)[0].tone).toBe("act_now");
    const answered = reply(raised, { answer: "bed_ready_at", readyAt: (NOW + 60) as Instant });
    expect(isPullNowOverdue(answered.broadcastAlerts[0], later)).toBe(false);
  });

  it("shows red to the asked ward until it answers, and nothing to other wards or ED", () => {
    const raised = raise(seedWardFlowState(), "WF-003");
    const asked = { role: "ward", id: "rph-adult-secure" };
    expect(bannerEntriesForDesk(raised.broadcastAlerts, raised.movements, asked, NOW)[0]).toMatchObject({
      tone: "act_now",
      needsAnswer: true,
    });
    expect(
      bannerEntriesForDesk(raised.broadcastAlerts, raised.movements, { role: "ward", id: "fsh-older-adult" }, NOW),
    ).toEqual([]);
    expect(bannerEntriesForDesk(raised.broadcastAlerts, raised.movements, { role: "ed", id: "fsh-ed" }, NOW)).toEqual(
      [],
    );
    const answered = reply(raised, {});
    expect(bannerEntriesForDesk(answered.broadcastAlerts, answered.movements, asked, NOW)[0].tone).toBe("waiting");
  });

  it("ends for good once the patient is pulled, even if the pull is then released", () => {
    const raised = raise(seedWardFlowState(), "WF-003");
    const pulled = wardFlowReducer(raised, {
      type: "PULL_PATIENT",
      role: "ward",
      now: NOW,
      movementId: "WF-003",
      unitId: "rph-adult-secure",
    });
    expect(pulled.movements.find((m) => m.id === "WF-003")?.stage).toBe("pulled");
    const released = wardFlowReducer(pulled, {
      type: "RELEASE_PULL",
      role: "ward",
      now: NOW,
      movementId: "WF-003",
      reason: RELEASE_PULL_REASONS[0],
      actingUnitId: "rph-adult-secure",
    } as WardFlowEvent);
    expect(released.movements.find((m) => m.id === "WF-003")?.stage).toBe("accepted_awaiting_bed");
    const later = (NOW + PULL_NOW_ANSWER_MINUTES) as Instant;
    const coordinator = { role: "coordinator", id: COORDINATOR_DESK_ACKNOWLEDGER_ID };
    expect(bannerEntriesForDesk(released.broadcastAlerts, released.movements, coordinator, later)).toEqual([]);
    expect(reply(released, {}).broadcastAlerts[0].replies).toHaveLength(0);
    expect(raise(released, "WF-003").broadcastAlerts).toHaveLength(2);
  });

  it("refuses to restore a save whose reply carries an unknown answer or reason", () => {
    const answered = reply(raise(seedWardFlowState(), "WF-003"), { answer: "cannot", reason: "no_suitable_bed" });
    const stored = JSON.parse(JSON.stringify(answered)) as State;
    expect(isValidStoredWardFlowState(stored)).toBe(true);
    const withReply = (fields: Record<string, unknown>) => {
      const copy = JSON.parse(JSON.stringify(stored));
      Object.assign(copy.broadcastAlerts[0].replies[0], fields);
      return copy;
    };
    expect(isValidStoredWardFlowState(withReply({ reason: "typed note" }))).toBe(false);
    expect(isValidStoredWardFlowState(withReply({ answer: "maybe" }))).toBe(false);
  });

  it("stays out of the directive slot", () => {
    const raised = raise(seedWardFlowState(), "WF-003");
    expect(getActiveBroadcastAlert(raised.broadcastAlerts, NOW)).toBeUndefined();
  });
});

describe("Bed call replies", () => {
  const bedCall = (targetScope: "all" | "metro_adult" | "ed_liaison" = "all") =>
    wardFlowReducer(seedWardFlowState(), {
      type: "DISPATCH_BROADCAST_ALERT",
      role: "coordinator",
      now: NOW,
      title: "Bed call",
      message: "How many adult beds can you take today?",
      severity: "warning",
      category: "capacity_gridlock",
      targetScope,
      targetScopeLabel: "Target",
      durationMinutes: 120,
      dispatchedByName: "Desk",
      kind: "bed_call",
    });

  it("counts answers and beds offered, and keeps each ward's latest answer", () => {
    let state = bedCall();
    state = reply(state, { unitId: "rph-adult-secure", answer: "can_take", beds: 2 });
    state = reply(state, { unitId: "fsh-older-adult", answer: "cannot" });
    state = reply(state, { unitId: "rph-adult-secure", answer: "can_take", beds: 1 });
    const board = replyBoard(state.broadcastAlerts[0], state.units);
    expect(board.answered).toBe(2);
    expect(board.bedsOffered).toBe(1);
    expect(board.rows).toHaveLength(state.units.length);
    expect(board.rows[0].reply).toBeUndefined();
  });

  it("asks only the wards its target covers", () => {
    const state = bedCall("metro_adult");
    const asked = state.broadcastAlerts[0].targetUnitIds ?? [];
    expect(asked).toContain("rph-adult-secure");
    expect(asked).not.toContain("fsh-older-adult");
    expect(replyBoard(state.broadcastAlerts[0], state.units).rows).toHaveLength(asked.length);
    expect(reply(state, { unitId: "fsh-older-adult", answer: "cannot" }).broadcastAlerts[0].replies).toHaveLength(0);
    expect(bedCall("ed_liaison").broadcastAlerts).toHaveLength(0);
  });

  it("refuses a bed count outside 1 to 4, a repeat answer, and an answer from an ED", () => {
    const state = bedCall();
    expect(reply(state, { answer: "can_take", beds: 0 }).broadcastAlerts[0].replies).toHaveLength(0);
    expect(reply(state, { answer: "can_take", beds: 5 }).broadcastAlerts[0].replies).toHaveLength(0);
    const once = reply(state, { answer: "cannot" });
    expect(reply(once, { answer: "cannot" }).broadcastAlerts[0].replies).toHaveLength(1);
    expect(reply(state, { unitId: "fsh-ed", role: "ed", answer: "cannot" }).broadcastAlerts[0].replies).toHaveLength(0);
  });

  it("refuses an answer to a plain directive, which is acknowledged instead", () => {
    const directive = wardFlowReducer(seedWardFlowState(), {
      type: "DISPATCH_BROADCAST_ALERT",
      role: "coordinator",
      now: NOW,
      title: "Directive",
      message: "Review discharges.",
      severity: "critical",
      category: "capacity_gridlock",
      targetScope: "all",
      targetScopeLabel: "All units",
      durationMinutes: 120,
      dispatchedByName: "Desk",
    });
    const answered = reply(directive, { answer: "cannot" });
    expect(answered.broadcastAlerts[0].replies ?? []).toHaveLength(0);
    expect(lastRefusal(answered)).toMatch(/acknowledged, not answered/);
  });
});
