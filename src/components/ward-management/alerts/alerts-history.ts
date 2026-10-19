// The Alerts screen's History tab: what this session recorded, newest first. Moved out of
// `alerts-screen.tsx` to keep it under the line cap.
import type { WfTone } from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { snoozeReasonLabel } from "@/components/ward-management/ward-inbox-snooze";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { EventLogEntry } from "@/components/ward-management/ward-event-log";
import type { Movement } from "@/components/ward-management/ward-model";

import {
  ALERT_KIND_LABELS,
  admissionIdOfInboxId,
  alertKindOf,
  bookingOfInboxId,
  movementIdOfInboxId,
  personIdOfInboxId,
  resolveAlertSubject,
} from "./alerts-model";

export type HistoryEntry = {
  id: string;
  at: Instant;
  tone: WfTone;
  title: string;
  sub: string;
  by: string;
  action: boolean;
};

export function alertsHistory({
  inboxAcknowledgements,
  inboxOwnership,
  inboxSnoozes,
  eventLog,
  broadcastAlerts,
  movements,
  umrnLookup,
  units,
  plannedAdmissions,
  admissions,
  now,
}: {
  inboxAcknowledgements: WardFlowState["inboxAcknowledgements"];
  inboxOwnership: WardFlowState["inboxOwnership"];
  inboxSnoozes: WardFlowState["inboxSnoozes"];
  eventLog: readonly EventLogEntry[] | undefined;
  broadcastAlerts: WardFlowState["broadcastAlerts"] | undefined;
  movements: WardFlowState["movements"];
  umrnLookup: Parameters<typeof resolveAlertSubject>[2];
  units: WardFlowState["units"];
  plannedAdmissions: WardFlowState["plannedAdmissions"] | undefined;
  admissions: WardFlowState["admissions"];
  now: Instant;
}): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  const about = (inboxItemId: string) => {
    const movementId = movementIdOfInboxId(inboxItemId);
    const movement = movements.find((candidate: Movement) => candidate.id === movementId);
    const booking = bookingOfInboxId(inboxItemId, plannedAdmissions);
    const dischargeAdmissionId = admissionIdOfInboxId(inboxItemId);
    const admission =
      dischargeAdmissionId !== undefined ? admissions.find((stay) => stay.id === dischargeAdmissionId) : undefined;
    const subject = resolveAlertSubject(
      movement,
      movementId,
      umrnLookup,
      units,
      booking,
      admission,
      personIdOfInboxId(inboxItemId),
    );
    const kind = alertKindOf(inboxItemId);
    return `${kind ? ALERT_KIND_LABELS[kind] : "Alert"} for ${subject.displayName} ${subject.umrn}`;
  };
  for (const [id, list] of Object.entries(inboxAcknowledgements)) {
    list.forEach((entry, index) =>
      entries.push({
        id: `ack-${id}-${index}`,
        at: entry.at,
        tone: "success",
        title: "Acknowledged",
        sub: about(id),
        by: entry.by,
        action: true,
      }),
    );
  }
  for (const [id, list] of Object.entries(inboxOwnership)) {
    list.forEach((entry, index) =>
      entries.push({
        id: `own-${id}-${index}`,
        at: entry.at,
        tone: "success",
        title: "Taken",
        sub: about(id),
        by: entry.by,
        action: true,
      }),
    );
  }
  for (const [id, list] of Object.entries(inboxSnoozes)) {
    list.forEach((entry, index) =>
      entries.push({
        id: `snooze-${id}-${index}`,
        at: entry.at,
        tone: "neutral",
        title:
          entry.kind === "snoozed"
            ? `Snoozed to ${formatInstantWithDay(entry.until, now)}, ${snoozeReasonLabel(entry.reason).toLowerCase()}`
            : "Returned to the queue",
        sub: about(id),
        by: entry.by,
        action: true,
      }),
    );
  }
  (eventLog ?? []).forEach((entry, index) => {
    if (entry.type !== "RELEASE_PULL" || !entry.accepted || entry.now === undefined) return;
    const movement = movements.find((candidate: Movement) => candidate.id === entry.movementId);
    const subject = resolveAlertSubject(movement, entry.movementId, umrnLookup, units);
    entries.push({
      id: `release-${index}`,
      at: entry.now,
      tone: "success",
      title: "Bed released",
      sub: `${subject.displayName} ${subject.umrn}`,
      by: entry.role ? WARD_FLOW_ROLE_LABELS[entry.role] : "Role not recorded",
      action: true,
    });
  });
  for (const alert of broadcastAlerts ?? []) {
    entries.push({
      id: `bc-${alert.id}`,
      at: alert.dispatchedAt,
      tone: "info",
      title: `Broadcast sent: ${alert.title}`,
      sub: alert.targetScopeLabel,
      by: alert.dispatchedByName,
      action: false,
    });
    if (alert.stoodDownAt !== undefined) {
      entries.push({
        id: `bc-down-${alert.id}`,
        at: alert.stoodDownAt,
        tone: "neutral",
        title: `Broadcast stood down: ${alert.title}`,
        sub: alert.targetScopeLabel,
        by: alert.stoodDownBy ?? "Role not recorded",
        action: false,
      });
    }
  }
  return entries.sort((a, b) => b.at - a.at);
}
