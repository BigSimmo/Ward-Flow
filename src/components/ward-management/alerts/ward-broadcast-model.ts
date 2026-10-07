import type { Instant } from "@/components/ward-management/ward-clock";
import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";

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

export interface BroadcastAlert {
  id: string;
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
}

export interface BroadcastTemplate {
  id: string;
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
];

export function isAlertActive(alert: BroadcastAlert, now: Instant): boolean {
  if (alert.status !== "active") return false;
  return now < alert.expiresAt;
}

export function getActiveBroadcastAlert(alerts: readonly BroadcastAlert[], now: Instant): BroadcastAlert | undefined {
  // Return the highest severity active alert, newest first
  const activeAlerts = alerts.filter((a) => isAlertActive(a, now));
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
