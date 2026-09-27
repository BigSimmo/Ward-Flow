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
    name: "Metropolitan HDU 100% Occupancy (Statewide Bed Gridlock)",
    title: "Critical HDU Capacity: Immediate Discharge & Step-Down Review",
    severity: "critical",
    category: "capacity_gridlock",
    targetScope: "all",
    targetScopeLabel: "All 23 Inpatient Wards & 8 ED Desks",
    defaultDurationMinutes: 240,
    defaultMessage:
      "URGENT: Metropolitan High Dependency Unit (HDU) capacity at 100% across NMHS, SMHS, and EMHS. All adult inpatient units requested to expedite morning discharge verifications, identify immediate step-down candidates to open wards, and report potential surge beds to the State Bed Desk.",
  },
  {
    id: "wa-ed-prolonged-surge",
    name: "Metropolitan ED Inflow / Acute Overcrowding (>24h Wait)",
    title: "Prolonged ED Stays Exceeding Thresholds: Prioritize Ward Placements",
    severity: "critical",
    category: "ed_surge",
    targetScope: "metro_adult",
    targetScopeLabel: "Metropolitan Adult Units Only",
    defaultDurationMinutes: 240,
    defaultMessage:
      "CRITICAL: Multiple patients exceeding 24 hours in emergency departments at Fiona Stanley, Sir Charles Gairdner, and Royal Perth hospitals. Catchment inpatient units instructed to pull and admit accepted referrals without delay to decompress acute emergency desks.",
  },
  {
    id: "wa-ed-bypass-advisory",
    name: "Temporary Emergency Liaison Bypass / Infrastructure Delay",
    title: "Emergency Mental Health Liaison Desk Capacity Constraint",
    severity: "warning",
    category: "ed_surge",
    targetScope: "ed_liaison",
    targetScopeLabel: "Emergency Liaison Consoles (8 Hubs)",
    defaultDurationMinutes: 180,
    defaultMessage:
      "OPERATIONAL ADVISORY: Fiona Stanley Emergency Mental Health Liaison desk experiencing severe infrastructure and physical assessment constraints. St John ambulance and voluntary mental health presentations requested to divert to Fremantle or Rockingham General where clinically suitable.",
  },
  {
    id: "wa-camhs-bed-gridlock",
    name: "CAMHS / Adolescent Acute Bed Gridlock",
    title: "State Adolescent Surge: Zero CAMHS Secure Beds Available",
    severity: "critical",
    category: "clinical_stream",
    targetScope: "adolescent",
    targetScopeLabel: "Adolescent & CAMHS Units (PCH & Bentley)",
    defaultDurationMinutes: 360,
    defaultMessage:
      "SURGE ALERT: Perth Children's Hospital Ward 5A and Bentley Adolescent Unit at maximum operational capacity with zero available beds. Coordinate urgent step-down to community CAMHS assertive outreach; delay elective inpatient admissions.",
  },
  {
    id: "wa-forensic-full-advisory",
    name: "Graylands Frankland Centre Forensic Surge",
    title: "State Forensic Service High-Security Beds Fully Committed",
    severity: "warning",
    category: "clinical_stream",
    targetScope: "forensic",
    targetScopeLabel: "Forensic & High Acuity Units",
    defaultDurationMinutes: 480,
    defaultMessage:
      "HIGH-ACUITY ADVISORY: Graylands Frankland Centre secure beds fully committed. All custodial transfers from court and prison watch-houses require direct case conference with the State Forensic Clinical Director and State Bed Desk.",
  },
  {
    id: "wa-transport-transit-delay",
    name: "Secure Mental Health Transport Network Delay",
    title: "Inter-Hospital Mental Health Transport Backlog (90-120 min Delays)",
    severity: "warning",
    category: "transport_delay",
    targetScope: "all",
    targetScopeLabel: "All 23 Inpatient Wards & 8 ED Desks",
    defaultDurationMinutes: 180,
    defaultMessage:
      "LOGISTICS ADVISORY: St John and contractor secure psychiatric transport vehicles experiencing widespread 90-120 minute transfer delays across the metropolitan area. Referring facilities must maintain current patient hold status and monitor statutory form validity.",
  },
  {
    id: "wa-wachs-aeromedical-delay",
    name: "Regional WACHS Severe Weather / Transit Delay",
    title: "Regional Aeromedical Patient Transfers Suspended Due to Weather",
    severity: "advisory",
    category: "transport_delay",
    targetScope: "regional_wachs",
    targetScopeLabel: "WACHS Regional Facilities & Rural Hubs",
    defaultDurationMinutes: 720,
    defaultMessage:
      "REGIONAL LOGISTICS: Royal Flying Doctor Service (RFDS) and WACHS aeromedical patient transfers from the Pilbara and Kimberley grounded due to cyclonic weather warning. Regional hospital holding beds authorized for 24-hour extension.",
  },
  {
    id: "wa-infection-bypass-protocol",
    name: "Infection Control Protocol / Unit Admission Bypass",
    title: "Unit Admission Suspension: Respiratory Outbreak Protocol",
    severity: "warning",
    category: "unit_closure",
    targetScope: "older_adult",
    targetScopeLabel: "Psychogeriatric & Older Adult Units",
    defaultDurationMinutes: 480,
    defaultMessage:
      "CLINICAL DIRECTIVE: Selby Lodge Psychogeriatric Unit temporarily closed to new admissions following confirmation of respiratory illness cluster. Pending older adult referrals to be re-routed via Osborne Park Hospital Older Adult Service.",
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
