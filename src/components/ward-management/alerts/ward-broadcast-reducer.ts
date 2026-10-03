import type { AuditDecision } from "../ward-audit";
import { enumValue, finiteInstant } from "../ward-audit";
import type { Instant } from "../ward-clock";
import type { WardFlowEvent, WardFlowRole } from "../ward-flow-events";
import type { WardFlowState } from "../ward-flow-reducer";
import type { Unit } from "../ward-model";
import {
  BROADCAST_CATEGORIES,
  BROADCAST_SEVERITIES,
  BROADCAST_TARGET_SCOPES,
  COORDINATOR_DESK_ACKNOWLEDGER_ID,
  isAlertActive,
  type BroadcastAlert,
} from "./ward-broadcast-model";

export type RejectFn = (state: WardFlowState, event: WardFlowEvent, reason: string) => WardFlowState;

function findUnit(state: WardFlowState, unitId: string): Unit | undefined {
  return state.units.find((candidate: Unit) => candidate.id === unitId);
}

/**
 * Handles broadcast alert events:
 * - DISPATCH_BROADCAST_ALERT
 * - ACKNOWLEDGE_BROADCAST_ALERT
 * - STAND_DOWN_BROADCAST_ALERT
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
      const nextSeq = (state.broadcastSequence ?? 0) + 1;
      const alertId = `BCAST-${nextSeq}`;
      const duration = event.durationMinutes;
      const newAlert: BroadcastAlert = {
        id: alertId,
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
      if (event.unitId !== COORDINATOR_DESK_ACKNOWLEDGER_ID && !findUnit(state, event.unitId)) {
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

    default:
      return null;
  }
}
