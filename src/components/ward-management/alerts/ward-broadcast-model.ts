import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";
import type { Movement, ReferralDeclineReason } from "@/components/ward-management/ward-model";

export type BroadcastSeverity = "critical" | "warning" | "advisory";

// Runtime membership lists for the three fields below — `event.severity` etc. are union-typed
// (compile-time only), so an untyped or malformed dispatch could otherwise carry any string
// straight into stored state. The reducer checks DISPATCH_BROADCAST_ALERT against these.
export const BROADCAST_SEVERITIES: readonly BroadcastSeverity[] = ["critical", "warning", "advisory"];

export type BroadcastCategory =
  "capacity_gridlock" | "ed_surge" | "unit_closure" | "transport_delay" | "clinical_stream" | "statutory_advisory";

export const BROADCAST_CATEGORIES: readonly BroadcastCategory[] = [
  "capacity_gridlock",
  "ed_surge",
  "unit_closure",
  "transport_delay",
  "clinical_stream",
  "statutory_advisory",
];

export type BroadcastTargetScope =
  "all" | "metro_adult" | "ed_liaison" | "forensic" | "adolescent" | "older_adult" | "regional_wachs";

export const BROADCAST_TARGET_SCOPES: readonly BroadcastTargetScope[] = [
  "all",
  "metro_adult",
  "ed_liaison",
  "forensic",
  "adolescent",
  "older_adult",
  "regional_wachs",
];

/**
 * The one non-unit sender ACKNOWLEDGE_BROADCAST_ALERT accepts. `WardBroadcastBanner` is mounted
 * with no `currentUnitId` at its only real call site (`src/app/mockups/ward-flow/layout.tsx`), so
 * its acknowledgement falls back to this id rather than a real ward/ED unit — the coordinator
 * desk acknowledging on behalf of no specific unit. Every other unrecognised unitId is refused.
 */
export const COORDINATOR_DESK_ACKNOWLEDGER_ID = "coordinator-desk";

/**
 * GLOBAL ALERTS (Josh picked option A, 10 Oct 2026). Three kinds share the one banner slot:
 * - `directive`: the original broadcast, answered by acknowledging. Absent `kind` means this.
 * - `bed_call`: a directive that asks wards a set question, answered by `REPLY_BROADCAST_ALERT`.
 * - `pull_now`: one patient, raised by the coordinator, answered by the asked wards.
 */
export type BroadcastKind = "directive" | "bed_call" | "pull_now";
export const BROADCAST_KINDS: readonly BroadcastKind[] = ["directive", "bed_call", "pull_now"];
/** The two kinds a coordinator sends from the compose form. Pull now is raised from a patient. */
export const DISPATCHABLE_BROADCAST_KINDS: readonly BroadcastKind[] = ["directive", "bed_call"];

export const BED_CALL_ANSWERS = ["can_take", "after_discharge", "cannot"] as const;
export const PULL_NOW_ANSWERS = ["pulling_now", "bed_ready_at", "cannot"] as const;
export type BedCallAnswer = (typeof BED_CALL_ANSWERS)[number];
export type PullNowAnswer = (typeof PULL_NOW_ANSWERS)[number];
export type BroadcastAnswer = BedCallAnswer | PullNowAnswer;

export const BROADCAST_ANSWER_LABELS: Record<BroadcastAnswer, string> = {
  can_take: "Can take",
  after_discharge: "After a discharge",
  cannot: "Can't",
  pulling_now: "Pulling now",
  bed_ready_at: "Bed ready at",
};

/** Beds a ward may offer on a bed call. Chosen from chips, never typed. */
export const BED_CALL_MAX_BEDS = 4;
/** "Ready at" choices, minutes from now. Chosen, never typed. */
export const READY_IN_CHOICES: readonly number[] = [30, 60, 120, 240];
// Timing defaults live in the named-defaults module, labelled as Josh's defaults.
export { PULL_NOW_ANSWER_MINUTES } from "@/components/ward-management/ward-operational-defaults";

export interface BroadcastReply {
  /** The ward or ED desk that answered (`state.units` id or an ED id). */
  unitId: string;
  answer: BroadcastAnswer;
  at: Instant;
  role: WardFlowRole;
  /** `can_take` only. */
  beds?: number;
  /** `after_discharge` and `bed_ready_at` only. */
  readyAt?: Instant;
  /** `cannot` on a Pull now only, from the wards' own decline reasons. */
  reason?: ReferralDeclineReason;
}

export interface BroadcastAlert {
  id: string;
  /** Absent on every alert saved before 10 Oct 2026, which were all directives. */
  kind?: BroadcastKind;
  title: string;
  message: string;
  severity: BroadcastSeverity;
  category: BroadcastCategory;
  targetScope: BroadcastTargetScope;
  targetScopeLabel: string;
  durationMinutes: number;
  dispatchedAt: Instant;
  expiresAt: Instant;
  dispatchedByRole: WardFlowRole;
  dispatchedByName: string;
  status: "active" | "stood_down" | "expired";
  acknowledgedUnits: string[];
  stoodDownAt?: Instant;
  stoodDownBy?: string;
  /** Every answer in order. A desk may change its answer; its latest one is current. */
  replies?: BroadcastReply[];
  /** `pull_now` only: the movement the alert is about. */
  movementId?: string;
  /** `pull_now` only: the wards asked to pull, read from the movement when it was raised. */
  targetUnitIds?: string[];
  /** `pull_now` only: when an unanswered alert returns to the coordinator. */
  answerBy?: Instant;
}

export interface BroadcastTemplate {
  id: string;
  /** Absent means a directive. */
  kind?: "directive" | "bed_call";
  name: string;
  title: string;
  severity: BroadcastSeverity;
  category: BroadcastCategory;
  targetScope: BroadcastTargetScope;
  targetScopeLabel: string;
  defaultDurationMinutes: number;
  defaultMessage: string;
}

/**
 * Realistic Western Australian Mental Health flow broadcast templates.
 * Based on statewide coordination across NMHS, SMHS, EMHS, and WACHS.
 */
export const WA_BROADCAST_TEMPLATES: readonly BroadcastTemplate[] = [
  {
    id: "wa-metro-hdu-gridlock",
    name: "Demo: metro HDU full",
    title: "Demo: HDU full — check discharges",
    severity: "critical",
    category: "capacity_gridlock",
    targetScope: "all",
    targetScopeLabel: "All 23 Inpatient Wards & 8 ED Desks",
    defaultDurationMinutes: 240,
    defaultMessage:
      "Demo alert. Not a live broadcast. Metropolitan HDU is shown full in this prototype. Check morning discharges and step-down candidates.",
  },
  {
    id: "wa-ed-prolonged-surge",
    name: "Demo: long ED waits",
    title: "Demo: ED waits over 24 hours",
    severity: "critical",
    category: "ed_surge",
    targetScope: "metro_adult",
    targetScopeLabel: "Metropolitan Adult Units Only",
    defaultDurationMinutes: 240,
    defaultMessage:
      "Demo alert. Not a live broadcast. Several ED waits at Fiona Stanley, Sir Charles Gairdner and Royal Perth are over 24 hours in this scenario. Place accepted referrals.",
  },
  {
    id: "wa-ed-bypass-advisory",
    name: "Demo: ED liaison busy",
    title: "Demo: ED liaison desk constrained",
    severity: "warning",
    category: "ed_surge",
    targetScope: "ed_liaison",
    targetScopeLabel: "Emergency Liaison Consoles (8 Hubs)",
    defaultDurationMinutes: 180,
    defaultMessage:
      "Demo alert. Not a live broadcast. Fiona Stanley ED liaison is shown as constrained. Where suitable, presentations go to Fremantle or Rockingham General.",
  },
  {
    id: "wa-camhs-bed-gridlock",
    name: "Demo: adolescent beds full",
    title: "Demo: no CAMHS secure beds",
    severity: "critical",
    category: "clinical_stream",
    targetScope: "adolescent",
    targetScopeLabel: "Adolescent & CAMHS Units (PCH & Bentley)",
    defaultDurationMinutes: 360,
    defaultMessage:
      "Demo alert. Not a live broadcast. PCH Ward 5A and Bentley Adolescent Unit are shown full. Use community CAMHS outreach in this scenario.",
  },
  {
    id: "wa-forensic-full-advisory",
    name: "Demo: forensic beds full",
    title: "Demo: forensic beds full",
    severity: "warning",
    category: "clinical_stream",
    targetScope: "forensic",
    targetScopeLabel: "Forensic & High Acuity Units",
    defaultDurationMinutes: 480,
    defaultMessage:
      "Demo alert. Not a live broadcast. Graylands Frankland Centre secure beds fully committed in this scenario. Custodial transfers need a case conference first.",
  },
  {
    id: "wa-transport-transit-delay",
    name: "Demo: transport delayed",
    title: "Demo: hospital transport delayed",
    severity: "warning",
    category: "transport_delay",
    targetScope: "all",
    targetScopeLabel: "All 23 Inpatient Wards & 8 ED Desks",
    defaultDurationMinutes: 180,
    defaultMessage:
      "Demo alert. Not a live broadcast. Secure psychiatric transport is shown 90–120 minutes late. Hold current patients and watch form times.",
  },
  {
    id: "wa-wachs-aeromedical-delay",
    name: "Demo: regional flights paused",
    title: "Demo: regional air transfers paused",
    severity: "advisory",
    category: "transport_delay",
    targetScope: "regional_wachs",
    targetScopeLabel: "WACHS Regional Facilities & Rural Hubs",
    defaultDurationMinutes: 720,
    defaultMessage:
      "Demo alert. Not a live broadcast. RFDS and WACHS air transfers from the Pilbara and Kimberley are paused for weather in this scenario.",
  },
  {
    id: "wa-infection-bypass-protocol",
    name: "Demo: unit closed to admissions",
    title: "Demo: admissions paused — outbreak",
    severity: "warning",
    category: "unit_closure",
    targetScope: "older_adult",
    targetScopeLabel: "Psychogeriatric & Older Adult Units",
    defaultDurationMinutes: 480,
    defaultMessage:
      "Demo alert. Not a live broadcast. Selby Lodge is closed to new admissions in this scenario. Route older-adult referrals via Osborne Park.",
  },
  {
    id: "wa-adult-bed-call",
    kind: "bed_call",
    name: "Demo: bed call, adult beds today",
    title: "Demo: bed call for adult beds today",
    severity: "warning",
    category: "capacity_gridlock",
    targetScope: "metro_adult",
    targetScopeLabel: "Metropolitan Adult Units Only",
    defaultDurationMinutes: 120,
    defaultMessage:
      "Demo alert. Not a live broadcast. Adult patients are waiting in metro EDs in this scenario. Tell the desk how many you can take today.",
  },
];

export function isAlertActive(alert: BroadcastAlert, now: Instant): boolean {
  if (alert.status !== "active") return false;
  return now < alert.expiresAt;
}

export function broadcastKind(alert: BroadcastAlert): BroadcastKind {
  return alert.kind ?? "directive";
}

/** Each desk's current answer: its latest reply. */
export function latestReplies(alert: BroadcastAlert): Map<string, BroadcastReply> {
  const byUnit = new Map<string, BroadcastReply>();
  for (const reply of alert.replies ?? []) byUnit.set(reply.unitId, reply);
  return byUnit;
}

/**
 * A Pull now nobody asked has answered by its answer time. It goes back to the coordinator as act
 * now. Derived, never stored, so it cannot disagree with the replies.
 */
/** The stages before a patient is pulled. Pull now means nothing once the bed is pulled. */
export const PULL_NOW_LIVE_STAGES: readonly Movement["stage"][] = [
  "placement_requested",
  "destination_review",
  "accepted_awaiting_bed",
];

/**
 * The patient is still waiting for the bed this Pull now asked for. A pull recorded since the alert
 * was sent ends it for good, so a later RELEASE_PULL back to `accepted_awaiting_bed` does not
 * revive an answered, overdue alert; the coordinator sends a fresh one if it is still needed.
 */
export function pullNowStillWaiting(alert: BroadcastAlert, movement: Movement | undefined): boolean {
  if (!movement || movement.closure || !PULL_NOW_LIVE_STAGES.includes(movement.stage)) return false;
  return !movement.stageChanges.some((change) => change.to === "pulled" && change.at >= alert.dispatchedAt);
}

export function isPullNowOverdue(alert: BroadcastAlert, now: Instant): boolean {
  if (broadcastKind(alert) !== "pull_now" || !isAlertActive(alert, now) || alert.answerBy === undefined) return false;
  if (now < alert.answerBy) return false;
  const answered = latestReplies(alert);
  return !(alert.targetUnitIds ?? []).some((unitId) => answered.has(unitId));
}

/**
 * Which desk an alert is waiting on: a Pull now waits on its asked wards, a bed call on wards, a
 * directive on every ward, ED and the coordinator desk. Team and officer desks never answer here.
 */
export function alertAsksDesk(alert: BroadcastAlert, desk: { role: string; id: string | null }): boolean {
  if (!desk.id) return false;
  const kind = broadcastKind(alert);
  if (kind === "pull_now") return desk.role === "ward" && (alert.targetUnitIds ?? []).includes(desk.id);
  if (kind === "bed_call") {
    return desk.role === "ward" && (alert.targetUnitIds === undefined || alert.targetUnitIds.includes(desk.id));
  }
  // The coordinator desk acknowledges as COORDINATOR_DESK_ACKNOWLEDGER_ID (owner ruling 2026-09-25).
  return desk.role === "ward" || desk.role === "ed" || desk.role === "coordinator";
}

/** Whether this desk has already answered (a reply, or an acknowledgement for a directive). */
export function deskHasAnswered(alert: BroadcastAlert, deskId: string): boolean {
  return broadcastKind(alert) === "directive"
    ? alert.acknowledgedUnits.includes(deskId)
    : latestReplies(alert).has(deskId);
}

export function getActiveBroadcastAlert(alerts: readonly BroadcastAlert[], now: Instant): BroadcastAlert | undefined {
  // Return the highest severity active directive or bed call, newest first. A Pull now is about
  // one patient and has its own place on the Alerts page and in the banner.
  const activeAlerts = alerts.filter((a) => isAlertActive(a, now) && broadcastKind(a) !== "pull_now");
  if (activeAlerts.length === 0) return undefined;

  const severityOrder: Record<BroadcastSeverity, number> = {
    critical: 3,
    warning: 2,
    advisory: 1,
  };

  return [...activeAlerts].sort((a, b) => {
    const diff = severityOrder[b.severity] - severityOrder[a.severity];
    if (diff !== 0) return diff;
    return b.dispatchedAt - a.dispatchedAt;
  })[0];
}

export function formatTimeRemaining(expiresAt: Instant, now: Instant): string {
  const remaining = expiresAt - now;
  if (remaining <= 0) return "Expired";
  const hours = Math.floor(remaining / 60);
  const minutes = remaining % 60;
  if (hours === 0) return `${minutes}m remaining`;
  if (minutes === 0) return `${hours}h remaining`;
  return `${hours}h ${minutes}m remaining`;
}
