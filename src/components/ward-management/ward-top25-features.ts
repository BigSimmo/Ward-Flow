import type { Admission } from "@/components/ward-management/ward-admissions";
import {
  DEFAULT_BROADCAST_DURATION_MINUTES,
  DEFAULT_BROADCAST_EXTENSION_MINUTES,
  type WardBroadcastAlert,
} from "@/components/ward-management/alerts/ward-broadcast-model";
import {
  extendBroadcastAlert,
  initialWardBroadcastState,
  wardBroadcastReducer,
} from "@/components/ward-management/alerts/ward-broadcast-reducer";
import { openBedsFree, unitHasOpenBeds } from "@/components/ward-management/ward-bed-designation";
import {
  DISCHARGE_DELAY_REASONS,
  dischargeDelayMetadata,
  dischargeDelayReasonLabels,
  type DischargeDelayMetadata,
  type DischargeDelayReason,
} from "@/components/ward-management/ward-change-reasons";
import type { Instant } from "@/components/ward-management/ward-clock";
import {
  deriveAfternoonDischarges,
  deriveRefusalRecoveryAction,
  deriveSilentWards,
  deriveTopCompatibleWards,
  type CompatibleWardCandidate,
  type RefusalRecoveryAction,
  type SilentWardNotice,
} from "@/components/ward-management/ward-derivations";
import {
  CLD_DEFAULT_CONDITIONS,
  deriveEddDriftBadge,
  evaluateCriteriaLedDischarge,
  type CldDefaultCondition,
  type CriteriaLedDischargeEvaluation,
  type EddDriftBadge,
} from "@/components/ward-management/ward-discharge-dates";
import type { BedRelease, Unit } from "@/components/ward-management/ward-model";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import {
  SUPPORT_SERVICE_TYPES,
  dispatchParallelDischargeSupport,
  type SupportServiceDispatch,
  type SupportServiceType,
} from "@/components/ward-management/ward-support-notifications";

export {
  // #1 Afternoon Discharge & Parallel Support-Service Unblocker
  deriveAfternoonDischarges,
  dispatchParallelDischargeSupport,
  SUPPORT_SERVICE_TYPES,
  type SupportServiceDispatch,
  type SupportServiceType,
  // #2 One-Tap Multi-Ward Parallel Referral Fan-Out
  deriveTopCompatibleWards,
  type CompatibleWardCandidate,
  // #3 Inline Refusal Recovery & Guided Next-Best Action
  deriveRefusalRecoveryAction,
  type RefusalRecoveryAction,
  // #5 T-Minus 24h Discharge Prep & Early Barrier Tagging
  DISCHARGE_DELAY_REASONS,
  dischargeDelayReasonLabels,
  dischargeDelayMetadata,
  type DischargeDelayReason,
  type DischargeDelayMetadata,
  // #7 Automated Silent-Ward Escalation & Re-Allocation Loop
  deriveSilentWards,
  type SilentWardNotice,
  // #9 Criteria-Led Discharge (CLD) Weekend & Morning Unlocker
  CLD_DEFAULT_CONDITIONS,
  evaluateCriteriaLedDischarge,
  type CldDefaultCondition,
  type CriteriaLedDischargeEvaluation,
  // #21 EDD Drift & Confidence Indicator
  deriveEddDriftBadge,
  type EddDriftBadge,
  // #25 Broadcast Alert Auto-Expiry & Stand-Down Lifecycle
  DEFAULT_BROADCAST_DURATION_MINUTES,
  DEFAULT_BROADCAST_EXTENSION_MINUTES,
  extendBroadcastAlert,
  initialWardBroadcastState,
  wardBroadcastReducer,
  type WardBroadcastAlert,
};

function toMinutesOrNaN(value: Instant | string): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return Number.NaN;
  return Math.floor(parsed / 60_000);
}

function toMinutes(value: Instant | string): number {
  const m = toMinutesOrNaN(value);
  return Number.isNaN(m) ? 0 : m;
}

// ============================================================================
// #4 — "Preparing / Cleaning" Ghost-Bed Auto-Expiry & One-Tap Clear
// ============================================================================

export interface GhostPreparingBedInput {
  id: string;
  unitId: string;
  status?: "preparing" | "available" | "occupied" | "blocked";
  preparing?: boolean;
  preparingStartedAt?: Instant | string;
  confirmedAt?: Instant | string;
}

export interface GhostPreparingBedAlert {
  id: string;
  unitId: string;
  elapsedMinutes: number;
  actionLabel: string;
}

export function deriveGhostPreparingBeds(
  beds: readonly (BedRelease | GhostPreparingBedInput)[],
  now: Instant | string,
  thresholdMinutes = 61,
): GhostPreparingBedAlert[] {
  const nowMin = toMinutes(now);
  const alerts: GhostPreparingBedAlert[] = [];
  for (const bed of beds) {
    const isPreparing =
      ("preparing" in bed && bed.preparing === true) || ("status" in bed && bed.status === "preparing");
    if (!isPreparing) continue;
    const rawStart =
      "preparingStartedAt" in bed && bed.preparingStartedAt !== undefined
        ? bed.preparingStartedAt
        : "confirmedAt" in bed && bed.confirmedAt !== undefined
          ? bed.confirmedAt
          : undefined;
    if (rawStart === undefined) continue;
    const startMin = toMinutesOrNaN(rawStart);
    if (Number.isNaN(startMin)) continue;
    const elapsedMinutes = Math.max(0, nowMin - startMin);
    if (elapsedMinutes >= thresholdMinutes) {
      alerts.push({
        id: bed.id,
        unitId: bed.unitId,
        elapsedMinutes,
        actionLabel: "Cleaning Complete — Open Bed",
      });
    }
  }
  return alerts;
}

export function completeCleanAndOpenBed<
  T extends {
    id: string;
    availableBeds?: number;
    preparingBeds?: number;
    allocatable?: number;
    empty?: number;
    openBedsNow?: number;
    preparing?: boolean;
    cleanedBedIds?: string[];
  },
>(unit: T, bedId?: string): T {
  const next = { ...unit };
  if (bedId && Array.isArray(next.cleanedBedIds) && next.cleanedBedIds.includes(bedId)) {
    return unit;
  }
  const hasPreparingBed =
    (typeof next.preparingBeds === "number" ? next.preparingBeds > 0 : false) || next.preparing === true;
  if (!hasPreparingBed) return unit;
  if (typeof next.availableBeds === "number") {
    next.availableBeds = next.availableBeds + 1;
  }
  if (typeof next.preparingBeds === "number") {
    next.preparingBeds = Math.max(0, next.preparingBeds - 1);
  }
  if (typeof next.allocatable === "number") {
    next.allocatable = next.allocatable + 1;
  }
  if (typeof next.openBedsNow === "number") {
    next.openBedsNow = next.openBedsNow + 1;
  }
  if ("preparing" in next && typeof next.preparing === "boolean") {
    // With a count, the flag follows it: the unit stops preparing only when its last preparing bed opens.
    const noneLeftPreparing =
      typeof next.preparingBeds === "number" ? next.preparingBeds === 0 : !bedId || bedId === next.id;
    if (noneLeftPreparing) next.preparing = false;
  }
  if (bedId) {
    next.cleanedBedIds = [...(next.cleanedBedIds ?? []), bedId];
  }
  return next;
}

// ============================================================================
// #5 — T-Minus 24h Discharge Prep & Early Barrier Tagging
// ============================================================================

export interface TMinus24hCandidate {
  id: string;
  unitId: string;
  edd?: Instant | string | null;
  expectedDischargeAt?: Instant | null;
  state?: Admission["state"];
}

export function deriveTMinus24hDischargePrompts<T extends TMinus24hCandidate>(
  admissions: readonly T[],
  now: Instant | string,
): T[] {
  const nowMin = toMinutes(now);
  return admissions.filter((adm) => {
    if (adm.state !== undefined && adm.state !== "occupied" && adm.state !== "pulled") {
      return false;
    }
    const rawEdd = adm.edd !== undefined ? adm.edd : adm.expectedDischargeAt;
    if (rawEdd === null || rawEdd === undefined) return false;
    const eddMin = toMinutesOrNaN(rawEdd);
    if (Number.isNaN(eddMin)) return false;
    const diff = eddMin - nowMin;
    return diff > 0 && diff <= 24 * 60;
  });
}

// ============================================================================
// #6 — Role-Scoped "Needs You" Action Inbox (Zero-Noise Triage)
// ============================================================================

export interface RoleNeedsYouItem {
  id: string;
  role: string;
  title: string;
  priority: number;
  detail?: string;
  actionLabel?: string;
}

export function deriveRoleNeedsYouItems(items: readonly RoleNeedsYouItem[], activeRole: string): RoleNeedsYouItem[] {
  return items.filter((item) => item.role === activeRole).sort((a, b) => a.priority - b.priority);
}

// ============================================================================
// #7 — Automated Silent-Ward Escalation & 1-Click Unchanged Confirmation
// ============================================================================

export function confirmUnitBedsUnchanged<
  T extends { id: string; lastUpdated?: Instant | string; confirmedAt?: Instant | string },
>(unit: T, now: Instant | string): T {
  const next = { ...unit };
  if ("lastUpdated" in next) {
    next.lastUpdated = now;
  }
  if ("confirmedAt" in next) {
    next.confirmedAt = now;
  }
  return next;
}

// ============================================================================
// #8 — HDU / Secure-to-Acute Step-Down Pull Board
// ============================================================================

export interface StepDownCandidateInput {
  id: string;
  fromUnitId: string;
  securityLevel: "HDU" | "Secure";
  stepDownReady?: boolean;
  dischargeDestination?: string;
  dischargeDelayReason?: DischargeDelayReason;
  cohort: string;
}

export interface StepDownTargetUnitInput {
  id: string;
  name?: string;
  securityLevel?: string;
  security?: string;
  availableBeds?: number;
  allocatable?: number | { value: number };
  cohort?: string;
  ageBand?: string;
}

export interface StepDownMatch {
  candidateId: string;
  fromUnitId: string;
  securityLevel: "HDU" | "Secure";
  compatibleOpenUnitIds: string[];
}

export function deriveStepDownPullBoard(
  candidates: readonly StepDownCandidateInput[],
  units: readonly (Unit | StepDownTargetUnitInput)[],
): StepDownMatch[] {
  const matches: StepDownMatch[] = [];
  for (const cand of candidates) {
    // A planned destination alone is not readiness to leave HDU or secure care: it must be confirmed.
    if (cand.stepDownReady !== true) continue;
    const compatibleOpenUnitIds = units
      .filter((u) => {
        const isRealUnit = "lockedBeds" in u;
        const open = isRealUnit
          ? unitHasOpenBeds(u as Unit)
          : ("securityLevel" in u && u.securityLevel ? u.securityLevel : "security" in u ? u.security : "Open") ===
            "Open";
        const avail = isRealUnit
          ? Math.min(boundedBedAvailability(u as Unit).available, openBedsFree(u as Unit))
          : "availableBeds" in u && typeof u.availableBeds === "number"
            ? u.availableBeds
            : "allocatable" in u && typeof u.allocatable === "number"
              ? u.allocatable
              : "allocatable" in u &&
                  u.allocatable &&
                  typeof u.allocatable === "object" &&
                  "value" in u.allocatable &&
                  typeof u.allocatable.value === "number"
                ? u.allocatable.value
                : 0;
        const unitCohort = "cohort" in u && u.cohort ? u.cohort : "ageBand" in u ? u.ageBand : "Adult";
        return open && avail > 0 && unitCohort === cand.cohort;
      })
      .map((u) => u.id);
    if (compatibleOpenUnitIds.length > 0) {
      matches.push({
        candidateId: cand.id,
        fromUnitId: cand.fromUnitId,
        securityLevel: cand.securityLevel,
        compatibleOpenUnitIds,
      });
    }
  }
  return matches;
}

// ============================================================================
// #11 — Community Treatment Order (CTO) & 7-Day Follow-Up Handshake
// ============================================================================

export interface CtoFollowUpInput {
  admissionId: string;
  isCto: boolean;
  assignedCaseManager: string | null;
  followUpAppointmentAt: Instant | string | null;
  /** Departure time. When given, the follow-up must fall within the 7 days after it. */
  referenceAt?: Instant | string | null;
  communityTreatmentOrder?: {
    clinic?: string | null;
    nextReviewOn?: Instant | string | null;
  } | null;
}

export interface CtoFollowUpHandshake {
  admissionId: string;
  warningActive: boolean;
  blocksDischarge: false;
  missingFields: string[];
  summary: string;
  clearsCommunityFollowUpDelay: boolean;
}

export function deriveCtoFollowUpHandshake(input: CtoFollowUpInput): CtoFollowUpHandshake {
  if (!input.isCto) {
    return {
      admissionId: input.admissionId,
      warningActive: false,
      blocksDischarge: false,
      missingFields: [],
      summary: "Not a CTO discharge",
      clearsCommunityFollowUpDelay: true,
    };
  }
  // A clinic is a place, not a named case manager, so it never stands in for one.
  const effectiveManager = input.assignedCaseManager || null;
  const effectiveFollowUp = input.followUpAppointmentAt ?? input.communityTreatmentOrder?.nextReviewOn ?? null;
  const missingFields: string[] = [];
  if (!effectiveManager || !effectiveManager.trim()) {
    missingFields.push("assignedCaseManager");
  }
  if (
    effectiveFollowUp === null ||
    effectiveFollowUp === "" ||
    (typeof effectiveFollowUp === "string" && Number.isNaN(Date.parse(effectiveFollowUp))) ||
    (typeof effectiveFollowUp === "number" && !Number.isFinite(effectiveFollowUp))
  ) {
    missingFields.push("followUpAppointmentAt");
  } else if (input.referenceAt !== undefined && input.referenceAt !== null) {
    const followUpMin = toMinutesOrNaN(effectiveFollowUp);
    const referenceMin = toMinutesOrNaN(input.referenceAt);
    if (
      !Number.isNaN(followUpMin) &&
      !Number.isNaN(referenceMin) &&
      (followUpMin < referenceMin || followUpMin - referenceMin > 7 * 24 * 60)
    ) {
      missingFields.push("followUpAppointmentAt");
    }
  }
  const warningActive = missingFields.length > 0;
  return {
    admissionId: input.admissionId,
    warningActive,
    blocksDischarge: false,
    missingFields,
    summary: warningActive
      ? "Advisory: record community case manager and 7-day follow-up slot before departure"
      : "CTO community handover complete",
    clearsCommunityFollowUpDelay: !warningActive,
  };
}

// ============================================================================
// #12 — Stuck-Handover SLA Timer & Escalation Nudge
// ============================================================================

export interface StuckHandoverInput {
  movementId: string;
  acceptedAt: Instant | string;
  stage: string;
  slaMinutes?: number;
}

export interface StuckHandoverSlaResult {
  movementId: string;
  elapsedMinutes: number;
  isStuck: boolean;
  promptsNudge: boolean;
  actionLabel: string;
}

export function deriveStuckHandoverSla(input: StuckHandoverInput, now: Instant | string): StuckHandoverSlaResult {
  const elapsedMinutes = Math.max(0, toMinutes(now) - toMinutes(input.acceptedAt));
  const threshold = input.slaMinutes ?? 60;
  const isMovingOrArrived =
    input.stage === "in_transit" || input.stage === "moving" || input.stage === "arrived" || input.stage === "placed";
  const isStuck = !isMovingOrArrived && elapsedMinutes >= threshold;
  return {
    movementId: input.movementId,
    elapsedMinutes,
    isStuck,
    promptsNudge: isStuck,
    actionLabel: isStuck ? "Nudge Sending Team / Request Transport" : "Within handover target",
  };
}

// ============================================================================
// #13 — ED 8h / 12h / 24h Breach Prevention Escalation Ladder
// ============================================================================

export interface EdWaiterInput {
  id: string;
  arrivedAt: Instant | string;
}

export type EdEscalationTier = "24h_critical" | "12h_escalate" | "8h_warning" | "normal";

export interface EdBreachLadderEntry {
  id: string;
  waitHours: number;
  tier: EdEscalationTier;
  edgeAct: boolean;
  actionLabel: string;
}

export function deriveEdBreachLadder(waiters: readonly EdWaiterInput[], now: Instant | string): EdBreachLadderEntry[] {
  const nowMin = toMinutes(now);
  return waiters
    .map((w) => {
      const elapsedMinutes = Math.max(0, nowMin - toMinutes(w.arrivedAt));
      const waitHours = Math.floor(elapsedMinutes / 60);
      let tier: EdEscalationTier = "normal";
      let actionLabel = "Standard placement review";
      if (waitHours >= 24) {
        tier = "24h_critical";
        actionLabel = "Executive Escalation & Priority Pull";
      } else if (waitHours >= 12) {
        tier = "12h_escalate";
        actionLabel = "State Coordinator Multi-Ward Broadcast";
      } else if (waitHours >= 8) {
        tier = "8h_warning";
        actionLabel = "Early Duty Consultant Review";
      }
      return {
        id: w.id,
        waitHours,
        tier,
        edgeAct: waitHours >= 22,
        actionLabel,
      };
    })
    .sort((a, b) => b.waitHours - a.waitHours);
}

// ============================================================================
// #14 — Pre-Flight Admissions Packet (4-Tick Clearance Card)
// ============================================================================

export interface PreFlightPacketInput {
  medicalClearance: boolean;
  legalPaperwork: boolean;
  contrabandSearch: boolean;
  medicationChart: boolean;
}

export interface PreFlightPacketResult {
  allComplete: boolean;
  completedCount: number;
  totalCount: 4;
  missingItems: (keyof PreFlightPacketInput)[];
}

export function derivePreFlightAdmissionsPacket(input: PreFlightPacketInput): PreFlightPacketResult {
  const keys: (keyof PreFlightPacketInput)[] = [
    "medicalClearance",
    "legalPaperwork",
    "contrabandSearch",
    "medicationChart",
  ];
  const missingItems = keys.filter((k) => !input[k]);
  return {
    allComplete: missingItems.length === 0,
    completedCount: 4 - missingItems.length,
    totalCount: 4,
    missingItems,
  };
}

// ============================================================================
// #15 — Cleaning-Bed Pre-Match (Transport-During-Clean Overlap)
// ============================================================================

export function canPreMatchCleaningBed(bed: {
  id: string;
  status?: "preparing" | "available" | "occupied" | "blocked";
  preparing?: boolean;
  medicalClearanceStatus?: "cleared" | "pending_labs_2h" | "unfit";
  medicalDeterioration?: { at?: Instant | string; resumedAt?: Instant | string } | null;
}): boolean {
  if (bed.medicalDeterioration?.at !== undefined && bed.medicalDeterioration.resumedAt === undefined) {
    return false;
  }
  if (bed.medicalClearanceStatus === "unfit") {
    return false;
  }
  if (bed.preparing === true) return true;
  return bed.status === "preparing" || bed.status === "available";
}

// ============================================================================
// #16 — Inter-Ward Step-Down Swap Matcher (1-for-1 Mutual Exchange)
// ============================================================================

export interface InterWardSwapRequest {
  id: string;
  fromUnitId: string;
  toUnitId: string;
  reason?: string;
}

export interface InterWardSwapPair {
  requestA: InterWardSwapRequest;
  requestB: InterWardSwapRequest;
  unitA: string;
  unitB: string;
}

export function deriveInterWardStepDownSwaps(requests: readonly InterWardSwapRequest[]): InterWardSwapPair[] {
  const used = new Set<string>();
  const pairs: InterWardSwapPair[] = [];
  for (let i = 0; i < requests.length; i += 1) {
    const reqA = requests[i];
    if (!reqA || used.has(reqA.id)) continue;
    for (let j = i + 1; j < requests.length; j += 1) {
      const reqB = requests[j];
      if (!reqB || used.has(reqB.id)) continue;
      const isDirectMutualSwap = reqA.fromUnitId === reqB.toUnitId && reqA.toUnitId === reqB.fromUnitId;
      const isStepDownChain =
        (reqA.reason === "step_down" && reqB.reason === "ed_to_hdu" && reqB.toUnitId === reqA.fromUnitId) ||
        (reqB.reason === "step_down" && reqA.reason === "ed_to_hdu" && reqA.toUnitId === reqB.fromUnitId);
      if (isDirectMutualSwap || isStepDownChain) {
        used.add(reqA.id);
        used.add(reqB.id);
        pairs.push({
          requestA: reqA,
          requestB: reqB,
          unitA: reqA.fromUnitId,
          unitB: reqA.toUnitId,
        });
        break;
      }
    }
  }
  return pairs;
}

// ============================================================================
// #17 — 8-Second Undo Hairline Window on Destructive Decisions
// ============================================================================

export interface UndoWindowState {
  actionId: string;
  label: string;
  createdAtMs: number;
  durationMs: number;
  canUndo: boolean;
}

export function createUndoWindowState(input: {
  actionId: string;
  label: string;
  createdAtMs: number;
  durationMs?: number;
}): UndoWindowState {
  return {
    actionId: input.actionId,
    label: input.label,
    createdAtMs: input.createdAtMs,
    durationMs: input.durationMs ?? 8000,
    canUndo: true,
  };
}

// ============================================================================
// #19 — Paper-Form Statutory Expiry Radar (4h Amber / 1h Red & 48h/24h/<6h)
// ============================================================================

export interface PaperLegalFormInput {
  id: string;
  formType: string;
  expiresAt?: Instant | string;
  dueAt?: Instant | string;
}

export interface PaperLegalExpiryRadarItem {
  id: string;
  formType: string;
  remainingMinutes: number;
  urgency: "expired" | "critical_1h" | "warning_4h" | "normal" | "unrecorded";
  edgeAct: boolean;
}

export function derivePaperLegalExpiryRadar(
  forms: readonly PaperLegalFormInput[],
  now: Instant | string,
): PaperLegalExpiryRadarItem[] {
  const nowMin = toMinutes(now);
  return forms
    .map((form) => {
      const rawExpiry = form.expiresAt ?? form.dueAt;
      const expiryMin = rawExpiry !== undefined ? toMinutesOrNaN(rawExpiry) : Number.NaN;
      if (Number.isNaN(expiryMin)) {
        // No usable expiry was recorded. That is unknown, never a deadline that has passed.
        return {
          id: form.id,
          formType: form.formType,
          remainingMinutes: 0,
          urgency: "unrecorded" as const,
          edgeAct: false,
        };
      }
      const remainingMinutes = expiryMin - nowMin;
      let urgency: PaperLegalExpiryRadarItem["urgency"] = "normal";
      if (remainingMinutes <= 0) {
        urgency = "expired";
      } else if (remainingMinutes <= 60) {
        urgency = "critical_1h";
      } else if (remainingMinutes <= 240) {
        urgency = "warning_4h";
      }
      return {
        id: form.id,
        formType: form.formType,
        remainingMinutes: Math.max(0, remainingMinutes),
        urgency,
        edgeAct: remainingMinutes <= 360,
      };
    })
    .sort((a, b) => {
      if ((a.urgency === "unrecorded") !== (b.urgency === "unrecorded")) return a.urgency === "unrecorded" ? 1 : -1;
      return a.remainingMinutes - b.remainingMinutes;
    });
}

// ============================================================================
// #20 — Marooned Long-Stay Patient Escalation Dossier
// ============================================================================

export interface MaroonedPatientCandidate {
  id: string;
  umrn?: string;
  daysDelayed: number;
  hoursDelayed?: number;
  barrierCategory: string;
  clinicallyReadyForDischarge: boolean;
}

export interface MaroonedPatientDossierEntry extends MaroonedPatientCandidate {
  estimatedBedDaysSaved: number;
  escalationSummary: string;
}

export function deriveMaroonedPatientDossier(
  candidates: readonly MaroonedPatientCandidate[],
  options?: { minDaysDelayed?: number },
): MaroonedPatientDossierEntry[] {
  const minDays = options?.minDaysDelayed ?? 7;
  return candidates
    .filter(
      (c) =>
        c.clinicallyReadyForDischarge &&
        (c.daysDelayed >= minDays || (c.hoursDelayed !== undefined && c.hoursDelayed > 72)),
    )
    .sort((a, b) => b.daysDelayed - a.daysDelayed)
    .map((c) => ({
      ...c,
      estimatedBedDaysSaved: c.daysDelayed,
      escalationSummary: `${c.umrn ? `[${c.umrn}] ` : ""}${c.daysDelayed}d delayed (${c.barrierCategory}) — ready for executive escalation dossier`,
    }));
}

// ============================================================================
// #23 — Mobile Walk-Round Bottom-Sheet (`390×844` Thumb-Zone Mode)
// ============================================================================

export const PHONE_WALK_ROUND_VIEWPORT = {
  width: 390,
  height: 844,
  rowHeightPx: 52,
} as const;

// ============================================================================
// #24 — AWOL / Unauthorised Leave Immediate Safety & Bed-Hold Tracker
// ============================================================================

export interface AwolRecordInput {
  patientId: string;
  unitId: string;
  reportedAt: Instant | string;
  wapolNotified: boolean;
  nextOfKinNotified: boolean;
  bedHeld: boolean;
  completedSteps?: number;
}

export interface AwolTrackerSummary {
  patientId: string;
  unitId: string;
  elapsedMinutes: number;
  wapolNotified: boolean;
  nextOfKinNotified: boolean;
  bedHeld: boolean;
  reportedAt: Instant | string;
  bedStatus: "held_on_awol" | "released";
  holdWarningActive: boolean;
  completedSteps: number;
  totalSteps: 6;
  fractionLabel: string;
}

export function deriveAwolTrackerSummary(record: AwolRecordInput, now: Instant | string): AwolTrackerSummary {
  const elapsedMinutes = Math.max(0, toMinutes(now) - toMinutes(record.reportedAt));
  const defaultSteps = (record.wapolNotified ? 1 : 0) + (record.nextOfKinNotified ? 1 : 0) + (record.bedHeld ? 1 : 0);
  const completedSteps = Math.max(0, Math.min(6, record.completedSteps ?? defaultSteps));
  return {
    ...record,
    elapsedMinutes,
    bedStatus: record.bedHeld ? "held_on_awol" : "released",
    holdWarningActive: elapsedMinutes >= 240,
    completedSteps,
    totalSteps: 6,
    fractionLabel: `${completedSteps}/6 steps done`,
  };
}
