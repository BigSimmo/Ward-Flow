// Settings' pure helpers: rule wording and diffs, the configuration audit lines, the surge preset,
// the tab from the hash and the masked diagnostics copy. Moved out of `settings-screen.tsx`.
import type { AuditEvent } from "@/components/ward-management/ward-audit";
import { type WardConfiguration } from "@/components/ward-management/ward-configuration";
import {
  ED_ACCESS_TARGET_RANGE_MINUTES,
  MORNING_ROLLUP_TIME_MINUTES,
  PARALLEL_REFERRAL_CAP_RANGE,
} from "@/components/ward-management/ward-model";
import {
  DUE_SOON_MINUTES,
  DUE_SOON_URGENT_MINUTES,
  DUE_SOON_URGENT_RANGE_MINUTES,
  WARD_ANSWER_TARGET_MINUTES,
  TRANSFER_ACCEPTANCE_TARGET_MINUTES,
  TRANSPORT_BOOKED_TARGET_MINUTES,
} from "@/components/ward-management/ward-operational-defaults";
import {
  FORECAST_ED_RISK_LEAD_MINUTES,
  FORECAST_SHORT_ALERT_BEDS,
  FORECAST_WORSE_ALERT_BEDS,
} from "@/components/ward-management/ward-operational-defaults";
import { type WfTone } from "@/components/wf";
import { SETTINGS_TABS, type SettingsTab } from "./settings-search-index";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";

/** 24-hour clock time, `HH:MM`, for the morning count. */
export function clock24(minutesFromMidnight: number): string {
  const hours = Math.floor(minutesFromMidnight / 60);
  const mins = minutesFromMidnight % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Compact duration for rule values: "45m", "4h", "1h 15m". */
export function shortDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** The settings a phone shows on its first screen (Find a setting lands there, not in a sheet). */
export const PHONE_QUICK_SETTINGS: ReadonlySet<string> = new Set(["theme", "density", "buzz"]);

export function wardsText(count: number): string {
  return `${count} ${count === 1 ? "ward" : "wards"}`;
}

/**
 * The first due-time warning (`dueSoonUrgentMinutes`) must stay before the second
 * (`dueSoonMinutes`) or `validateConfiguration` refuses the save. Always adjusts the first value
 * down to one of its own steps below the second, whichever control changed.
 */
export function clampDueSoonUrgent(urgentCandidate: number, soonValue: number): number {
  const withinOwnRange = Math.max(
    DUE_SOON_URGENT_RANGE_MINUTES.min,
    Math.min(DUE_SOON_URGENT_RANGE_MINUTES.max, urgentCandidate),
  );
  return Math.min(withinOwnRange, soonValue - DUE_SOON_URGENT_RANGE_MINUTES.step);
}

/** The six rules with optional fields filled in, so drafts compare like for like. */
export function fullRules(value: WardConfiguration) {
  return {
    ed: value.edAccessTargetMinutes,
    cap: value.parallelReferralCap,
    hold: value.pullHoldMinutes,
    morning: value.morningRollupDeadlineMinutes ?? MORNING_ROLLUP_TIME_MINUTES,
    urgent: value.dueSoonUrgentMinutes ?? DUE_SOON_URGENT_MINUTES,
    soon: value.dueSoonMinutes ?? DUE_SOON_MINUTES,
    referralTarget: value.referralDecisionTargetMinutes ?? WARD_ANSWER_TARGET_MINUTES,
    transferTarget: value.transferAcceptanceTargetMinutes ?? TRANSFER_ACCEPTANCE_TARGET_MINUTES,
    transportTarget: value.transportBookedTargetMinutes ?? TRANSPORT_BOOKED_TARGET_MINUTES,
    forecastShort: value.forecastShortBeds ?? FORECAST_SHORT_ALERT_BEDS,
    forecastEdLead: value.forecastEdLeadMinutes ?? FORECAST_ED_RISK_LEAD_MINUTES,
    forecastWorse: value.forecastWorseBeds ?? FORECAST_WORSE_ALERT_BEDS,
  };
}

/** One phrase per rule that moved, in page order ("ED target 24h to 20h"). */
export function ruleDiffs(before: WardConfiguration, after: WardConfiguration): string[] {
  const a = fullRules(before);
  const b = fullRules(after);
  const parts: string[] = [];
  if (a.ed !== b.ed) parts.push(`ED target ${a.ed / 60}h to ${b.ed / 60}h`);
  if (a.cap !== b.cap) parts.push(`Wards asked ${a.cap} to ${b.cap}`);
  if (a.hold !== b.hold) parts.push(`Pull time limit ${shortDuration(a.hold)} to ${shortDuration(b.hold)}`);
  if (a.morning !== b.morning) parts.push(`Morning bed numbers due ${clock24(a.morning)} to ${clock24(b.morning)}`);
  if (a.soon !== b.soon) {
    parts.push(`Early warning ${shortDuration(a.soon)} to ${shortDuration(b.soon)}`);
  }
  if (a.urgent !== b.urgent) {
    parts.push(`Final warning ${shortDuration(a.urgent)} to ${shortDuration(b.urgent)}`);
  }
  if (a.referralTarget !== b.referralTarget) {
    parts.push(`Referral decision ${shortDuration(a.referralTarget)} to ${shortDuration(b.referralTarget)}`);
  }
  if (a.transferTarget !== b.transferTarget) {
    parts.push(`Transfer acceptance ${shortDuration(a.transferTarget)} to ${shortDuration(b.transferTarget)}`);
  }
  if (a.transportTarget !== b.transportTarget) {
    parts.push(`Transport booked ${shortDuration(a.transportTarget)} to ${shortDuration(b.transportTarget)}`);
  }
  if (a.forecastShort !== b.forecastShort) {
    parts.push(`Bed type short alert ${a.forecastShort} to ${b.forecastShort} beds`);
  }
  if (a.forecastEdLead !== b.forecastEdLead) {
    parts.push(`Access target forecast alert ${shortDuration(a.forecastEdLead)} to ${shortDuration(b.forecastEdLead)}`);
  }
  if (a.forecastWorse !== b.forecastWorse) {
    parts.push(`Forecast worse alert ${a.forecastWorse} to ${b.forecastWorse} beds`);
  }
  return parts;
}

export type ConfigurationAuditEvent = Extract<AuditEvent, { category: "configuration" }>;

export function isConfigurationEvent(event: AuditEvent): event is ConfigurationAuditEvent {
  return event.category === "configuration";
}

export const CHANGE_OUTCOME_TONE: Record<ConfigurationAuditEvent["outcome"], WfTone> = {
  accepted: "success",
  partial: "warning",
  denied: "closed",
  stale: "closed",
};

export const CHANGE_OUTCOME_PREFIX: Record<ConfigurationAuditEvent["outcome"], string> = {
  accepted: "",
  partial: "Partly applied: ",
  denied: "Refused: ",
  stale: "Refused: ",
};

/** One line for a recorded rule save: the first figure that moved, and how many more did. */
export function configurationChangeText(before: WardConfiguration | null, after: WardConfiguration | null): string {
  if (!before || !after) return "Coordination rules";
  const parts = ruleDiffs(before, after);
  if (parts.length === 0) return "Rules saved unchanged";
  return parts.length === 1 ? parts[0] : `${parts[0]}, ${parts.length - 1} more`;
}

export function isSurgePreset(value: WardConfiguration): boolean {
  return (
    value.parallelReferralCap === PARALLEL_REFERRAL_CAP_RANGE.max &&
    value.edAccessTargetMinutes === ED_ACCESS_TARGET_RANGE_MINUTES.min &&
    value.pullHoldMinutes === 120
  );
}

export function readTabFromHash(): SettingsTab | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.slice(1);
  return SETTINGS_TABS.some((tab) => tab.id === hash) ? (hash as SettingsTab) : null;
}

export function maskDiagnosticPatient(patient: DiagnosticPatientInput): { id?: string } {
  return {
    ...(patient.id !== undefined ? { id: patient.id } : {}),
  };
}

export function maskDiagnosticMovement(movement: DiagnosticMovementInput): {
  id: string;
  stage?: unknown;
  originEdId?: unknown;
  acceptedUnitId?: unknown;
  admissionId?: unknown;
  openedAt?: unknown;
  acceptedAt?: unknown;
  pulledAt?: unknown;
  arrivedAt?: unknown;
} {
  const allowed = [
    "stage",
    "originEdId",
    "acceptedUnitId",
    "admissionId",
    "openedAt",
    "acceptedAt",
    "pulledAt",
    "arrivedAt",
  ] as const;
  return {
    id: movement.id,
    ...Object.fromEntries(allowed.flatMap((key) => (movement[key] !== undefined ? [[key, movement[key]]] : []))),
  };
}

export type DiagnosticPatientInput = {
  id?: string;
  umrn?: string;
  mrn?: string;
  givenName?: string;
  familyName?: string;
  preferredName?: string;
  displayName?: string;
  name?: string;
  [key: string]: unknown;
};

export type DiagnosticMovementInput = {
  id: string;
  patientName?: string;
  patientUmrn?: string;
  patientMrn?: string;
  mrn?: string;
  [key: string]: unknown;
};

export async function copySettingsDiagnostics(state: {
  configuration: WardConfiguration;
  movements?: readonly DiagnosticMovementInput[];
  patients?: readonly DiagnosticPatientInput[];
}): Promise<string> {
  const maskedPatients = (state.patients ?? []).map(maskDiagnosticPatient);
  const maskedMovements = (state.movements ?? []).map(maskDiagnosticMovement);

  const payload = {
    product: "Ward Flow Statewide Bed Coordination",
    version: 6,
    exportedAt: new Date().toISOString(),
    configuration: state.configuration,
    movementCount: (state.movements ?? []).length,
    patientCount: (state.patients ?? []).length,
    movements: maskedMovements,
    patients: maskedPatients,
  };

  const text = JSON.stringify(payload, null, 2);
  await copyTextToClipboard(text);
  return text;
}
