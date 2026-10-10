import type { AuditDecision } from "../ward-audit";
import { enumValue, finiteInstant } from "../ward-audit";
import type { Instant } from "../ward-clock";
import type { WardFlowEvent, WardFlowRole } from "../ward-flow-events";
import type { WardFlowState } from "../ward-flow-reducer";
import { REFERRAL_DECLINE_REASONS, type Unit } from "../ward-model";
import { edById } from "../ward-sites";
import {
  PULL_NOW_ANSWER_MINUTES,
  PULL_NOW_LIVE_MINUTES,
  READY_AT_AHEAD_LIMIT_MINUTES,
} from "../ward-operational-defaults";
import {
  BED_CALL_ANSWERS,
  BED_CALL_MAX_BEDS,
  BROADCAST_CATEGORIES,
  DISPATCHABLE_BROADCAST_KINDS,
  PULL_NOW_ANSWERS,
  broadcastKind,
  BROADCAST_SEVERITIES,
  BROADCAST_TARGET_SCOPES,
  COORDINATOR_DESK_ACKNOWLEDGER_ID,
  isAlertActive,
  latestReplies,
  type BroadcastAlert,
  type BroadcastReply,
} from "./ward-broadcast-model";

export type RejectFn = (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;

function findUnit(state: WardFlowState, unitId: string): Unit | undefined {
  return state.units.find((candidate: Unit) => candidate.id === unitId);
}

/** A desk that may answer: a real ward, or (10 Oct 2026) a real ED, which has no `Unit` row. */
function isRealDesk(state: WardFlowState, unitId: string): boolean {
  return Boolean(findUnit(state, unitId) || edById(unitId));
}

/** The stages before a patient is pulled. Pull now means nothing once the bed is pulled. */
const PULL_NOW_STAGES = ["placement_requested", "destination_review", "accepted_awaiting_bed"];

/**
 * Handles broadcast alert events:
 * - DISPATCH_BROADCAST_ALERT
 * - ACKNOWLEDGE_BROADCAST_ALERT
 * - STAND_DOWN_BROADCAST_ALERT
 * - RAISE_PULL_NOW and REPLY_BROADCAST_ALERT (global alerts, 10 Oct 2026)
 */
export function reduceBroadcastAlertEvent(
  state: WardFlowState,
  event: WardFlowEvent,
  decision: AuditDecision,
  reject: RejectFn,
): WardFlowState | null {
  switch (event.type) {
    case "DISPATCH_BROADCAST_ALERT": {
      if (!event.title.trim() || !event.message.trim()) {
        return reject(state, event, "DISPATCH_BROADCAST_ALERT requires a non-empty title and message");
      }
      // Audit follow-up 2026-09-25: `severity`/`category`/`targetScope` are union-typed
      // (compile-time only), and `durationMinutes` used to silently fall back to 240 for any
      // value <= 0. Both shapes let an untyped or malformed dispatch through unchecked; refused
      // outright now, matching how the rest of this reducer treats a union-typed field.
      const severity = enumValue(BROADCAST_SEVERITIES, event.severity);
      if (severity === null) {
        return reject(state, event, "DISPATCH_BROADCAST_ALERT severity must be chosen from BROADCAST_SEVERITIES");
      }
      const category = enumValue(BROADCAST_CATEGORIES, event.category);
      if (category === null) {
        return reject(state, event, "DISPATCH_BROADCAST_ALERT category must be chosen from BROADCAST_CATEGORIES");
      }
      const targetScope = enumValue(BROADCAST_TARGET_SCOPES, event.targetScope);
      if (targetScope === null) {
        return reject(state, event, "DISPATCH_BROADCAST_ALERT targetScope must be chosen from BROADCAST_TARGET_SCOPES");
      }
      // finiteInstant rejects NaN and +/-Infinity as well as the <= 0 case `> 0` alone already
      // caught -- a non-finite duration would otherwise reach `expiresAt` below.
      if (finiteInstant(event.durationMinutes) === null || event.durationMinutes <= 0) {
        return reject(state, event, "DISPATCH_BROADCAST_ALERT durationMinutes must be a finite positive number");
      }
      const kind = event.kind === undefined ? "directive" : enumValue(DISPATCHABLE_BROADCAST_KINDS, event.kind);
      if (kind === null) {
        return reject(state, event, "DISPATCH_BROADCAST_ALERT kind must be a directive or a bed call");
      }
      const nextSeq = (state.broadcastSequence ?? 0) + 1;
      const alertId = `BCAST-${nextSeq}`;
      const duration = event.durationMinutes;
      const newAlert: BroadcastAlert = {
        id: alertId,
        ...(kind === "bed_call" ? { kind, replies: [] } : {}),
        title: event.title.trim(),
        message: event.message.trim(),
        severity,
        category,
        targetScope,
        targetScopeLabel: event.targetScopeLabel,
        durationMinutes: duration,
        dispatchedAt: event.now,
        expiresAt: (event.now + duration) as Instant,
        dispatchedByRole: event.role,
        dispatchedByName: event.dispatchedByName?.trim() || "State Bed Desk",
        status: "active",
        acknowledgedUnits: [],
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const existingAlerts = Array.isArray(state.broadcastAlerts) ? state.broadcastAlerts : [];
      return {
        ...state,
        broadcastAlerts: [newAlert, ...existingAlerts],
        broadcastSequence: nextSeq,
      };
    }

    case "ACKNOWLEDGE_BROADCAST_ALERT": {
      const existingAlerts = Array.isArray(state.broadcastAlerts) ? state.broadcastAlerts : [];
      const target = existingAlerts.find((a: BroadcastAlert) => a.id === event.alertId);
      if (!target) {
        return reject(state, event, `ACKNOWLEDGE_BROADCAST_ALERT alertId ${event.alertId} not found`);
      }
      // Audit follow-up 2026-09-25: three gaps closed together, all refusals rather than a
      // silent no-op — `unitId` was never checked against `state.units`, an alert that had
      // already expired or been stood down could still collect acknowledgements, and a repeat
      // acknowledgement from the same unit silently returned the unchanged state instead of
      // telling the caller why nothing happened.
      //
      // Owner ruling 2026-09-25: `WardBroadcastBanner`'s only real mount
      // (`src/app/mockups/ward-flow/layout.tsx`) passes no `currentUnitId`, so it always
      // acknowledges as `COORDINATOR_DESK_ACKNOWLEDGER_ID` — the one non-unit sender this
      // refusal exempts. Every other unrecognised unitId is still refused.
      if (event.unitId !== COORDINATOR_DESK_ACKNOWLEDGER_ID && !isRealDesk(state, event.unitId)) {
        return reject(state, event, `ACKNOWLEDGE_BROADCAST_ALERT unitId ${event.unitId} does not name a real unit`);
      }
      if (!isAlertActive(target, event.now)) {
        return reject(state, event, `ACKNOWLEDGE_BROADCAST_ALERT alertId ${event.alertId} is no longer active`);
      }
      if (target.acknowledgedUnits.includes(event.unitId)) {
        return reject(
          state,
          event,
          `ACKNOWLEDGE_BROADCAST_ALERT unit ${event.unitId} has already acknowledged alert ${event.alertId}`,
        );
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const updatedAlerts = existingAlerts.map((a: BroadcastAlert) =>
        a.id === event.alertId ? { ...a, acknowledgedUnits: [...a.acknowledgedUnits, event.unitId] } : a,
      );
      return {
        ...state,
        broadcastAlerts: updatedAlerts,
      };
    }

    case "STAND_DOWN_BROADCAST_ALERT": {
      const existingAlerts = Array.isArray(state.broadcastAlerts) ? state.broadcastAlerts : [];
      const target = existingAlerts.find((a: BroadcastAlert) => a.id === event.alertId);
      if (!target) {
        return reject(state, event, `STAND_DOWN_BROADCAST_ALERT alertId ${event.alertId} not found`);
      }
      // Audit follow-up 2026-09-25: standing down an already-stood-down alert used to silently
      // overwrite `stoodDownAt`/`stoodDownBy` with the new caller's values, discarding the
      // record of who actually stood it down and when.
      if (target.status === "stood_down") {
        return reject(state, event, `STAND_DOWN_BROADCAST_ALERT alertId ${event.alertId} is already stood down`);
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const updatedAlerts = existingAlerts.map((a: BroadcastAlert) =>
        a.id === event.alertId
          ? {
              ...a,
              status: "stood_down" as const,
              stoodDownAt: event.now,
              stoodDownBy: (event.stoodDownByRole ?? event.role) as WardFlowRole,
            }
          : a,
      );
      return {
        ...state,
        broadcastAlerts: updatedAlerts,
      };
    }

    case "RAISE_PULL_NOW": {
      const movement = state.movements.find((candidate) => candidate.id === event.movementId);
      if (!movement) {
        return reject(state, event, `RAISE_PULL_NOW movementId ${event.movementId} not found`);
      }
      if (movement.closure || !PULL_NOW_STAGES.includes(movement.stage)) {
        return reject(state, event, "RAISE_PULL_NOW needs a patient still waiting for a bed");
      }
      const existingAlerts = Array.isArray(state.broadcastAlerts) ? state.broadcastAlerts : [];
      if (
        existingAlerts.some(
          (alert) =>
            broadcastKind(alert) === "pull_now" && alert.movementId === movement.id && isAlertActive(alert, event.now),
        )
      ) {
        return reject(state, event, "RAISE_PULL_NOW already live for this patient");
      }
      // The accepting ward, else every ward still considering the referral. D-30 is kept by the
      // role table: only the coordinator raises this, for any hospital's patient.
      const declined = new Set(movement.declines.map((decline) => decline.unitId));
      const targetUnitIds = movement.acceptedUnitId
        ? [movement.acceptedUnitId]
        : movement.referredUnitIds.filter((unitId) => !declined.has(unitId) && findUnit(state, unitId));
      if (targetUnitIds.length === 0) {
        return reject(state, event, "RAISE_PULL_NOW has no ward to ask, refer the patient to wards first");
      }
      const names = targetUnitIds.map((unitId) => findUnit(state, unitId)?.name ?? unitId);
      const nextSeq = (state.broadcastSequence ?? 0) + 1;
      const newAlert: BroadcastAlert = {
        id: `BCAST-${nextSeq}`,
        kind: "pull_now",
        title: "Pull now",
        message: "Pull this patient into a bed as soon as possible.",
        severity: "critical",
        category: "capacity_gridlock",
        targetScope: "all",
        targetScopeLabel: names.length === 1 ? names[0] : `${names.length} wards`,
        durationMinutes: PULL_NOW_LIVE_MINUTES,
        dispatchedAt: event.now,
        expiresAt: (event.now + PULL_NOW_LIVE_MINUTES) as Instant,
        dispatchedByRole: event.role,
        dispatchedByName: "Bed coordinator",
        status: "active",
        acknowledgedUnits: [],
        replies: [],
        movementId: movement.id,
        targetUnitIds,
        answerBy: (event.now + PULL_NOW_ANSWER_MINUTES) as Instant,
      };
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      return { ...state, broadcastAlerts: [newAlert, ...existingAlerts], broadcastSequence: nextSeq };
    }

    case "REPLY_BROADCAST_ALERT": {
      const existingAlerts = Array.isArray(state.broadcastAlerts) ? state.broadcastAlerts : [];
      const target = existingAlerts.find((alert) => alert.id === event.alertId);
      if (!target) {
        return reject(state, event, `REPLY_BROADCAST_ALERT alertId ${event.alertId} not found`);
      }
      if (!isAlertActive(target, event.now)) {
        return reject(state, event, `REPLY_BROADCAST_ALERT alertId ${event.alertId} is no longer active`);
      }
      const kind = broadcastKind(target);
      if (kind === "directive") {
        return reject(state, event, "REPLY_BROADCAST_ALERT a directive is acknowledged, not answered");
      }
      if (!isRealDesk(state, event.unitId)) {
        return reject(state, event, `REPLY_BROADCAST_ALERT unitId ${event.unitId} does not name a real unit`);
      }
      if (kind === "pull_now" && !(target.targetUnitIds ?? []).includes(event.unitId)) {
        return reject(state, event, "REPLY_BROADCAST_ALERT this Pull now did not ask that ward");
      }
      if (kind === "bed_call" && !findUnit(state, event.unitId)) {
        return reject(state, event, "REPLY_BROADCAST_ALERT only a ward answers a bed call");
      }
      const answer = enumValue<string>(kind === "pull_now" ? PULL_NOW_ANSWERS : BED_CALL_ANSWERS, event.answer);
      if (answer === null) {
        return reject(state, event, "REPLY_BROADCAST_ALERT answer must be chosen from this alert's answers");
      }
      const reply: BroadcastReply = { unitId: event.unitId, answer: event.answer, at: event.now, role: event.role };
      if (answer === "can_take") {
        if (!Number.isInteger(event.beds) || (event.beds ?? 0) < 1 || (event.beds ?? 0) > BED_CALL_MAX_BEDS) {
          return reject(
            state,
            event,
            `REPLY_BROADCAST_ALERT beds must be a whole number from 1 to ${BED_CALL_MAX_BEDS}`,
          );
        }
        reply.beds = event.beds;
      }
      if (answer === "after_discharge" || answer === "bed_ready_at") {
        const readyAt = finiteInstant(event.readyAt);
        if (readyAt === null || readyAt <= event.now || readyAt > event.now + READY_AT_AHEAD_LIMIT_MINUTES) {
          return reject(state, event, "REPLY_BROADCAST_ALERT readyAt must be later today or tomorrow");
        }
        reply.readyAt = readyAt as Instant;
      }
      if (answer === "cannot" && kind === "pull_now") {
        if (!event.reason || !REFERRAL_DECLINE_REASONS.includes(event.reason)) {
          return reject(state, event, "REPLY_BROADCAST_ALERT Can't needs a reason from the decline reasons");
        }
        reply.reason = event.reason;
      }
      const current = latestReplies(target).get(event.unitId);
      if (
        current &&
        current.answer === reply.answer &&
        current.beds === reply.beds &&
        current.readyAt === reply.readyAt &&
        current.reason === reply.reason
      ) {
        return reject(state, event, "REPLY_BROADCAST_ALERT that desk already gave this answer");
      }
      decision.outcome = "accepted";
      decision.reasonCode = "none";
      const updatedAlerts = existingAlerts.map((alert) =>
        alert.id === target.id
          ? {
              ...alert,
              replies: [...(alert.replies ?? []), reply],
              // Answering is also receipt: the acknowledged count includes every desk that answered.
              acknowledgedUnits: alert.acknowledgedUnits.includes(event.unitId)
                ? alert.acknowledgedUnits
                : [...alert.acknowledgedUnits, event.unitId],
            }
          : alert,
      );
      return { ...state, broadcastAlerts: updatedAlerts };
    }

    default:
      return null;
  }
}
