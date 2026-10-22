// The department's recorded events, as timeline rows. Split out of `ed-screen.tsx` unchanged (fix
// list 2.5 and 9.6, 15 Oct 2026).
import type { Instant } from "@/components/ward-management/ward-clock";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { WardFlowContextValue } from "@/components/ward-management/ward-flow-provider";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { LONG_WAIT_MINUTES, LONG_WAIT_TEXT } from "@/components/ward-management/ward-operational-defaults";
import { DECLINE_REASON_LABELS } from "@/components/ward-management/ward-referrals";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { movementMedicalClearance } from "./ed-screen-model";

type TimelineEventCategory = "bed_search" | "arrivals" | "clinical" | "transport";

export type TimelineEvent = {
  min: Instant;
  tone?: "danger" | "warn" | "good" | "quiet" | "info" | "purple" | null;
  what: string | React.ReactNode;
  by?: string | null;
  id?: string;
  category?: TimelineEventCategory;
  categoryLabel?: string;
  patientName?: string;
  movementId?: string;
  referralId?: string;
  badgeText?: string;
  badgeTone?: "danger" | "warn" | "good" | "quiet" | "info" | "purple";
  primaryText?: string;
  secondaryText?: string;
  unitName?: string;
  detailText?: string;
  isOpenMovement?: boolean;
  waitMinutes?: number;
};

// D-78: the one decline list's own wording, so the ED reads what the ward and coordinator chose.
const TIMELINE_DECLINE_REASON_LABELS: Record<string, string> = {
  ...DECLINE_REASON_LABELS,
  outside_catchment: "Outside catchment area",
  needs_inpatient_care: "Requires inpatient admission",
  declined_or_unreachable: "Patient declined or unreachable",
  open_to_peer_team: "Already open to peer community team",
};

function formatTimelineDeclineReason(reason: string): string {
  if (TIMELINE_DECLINE_REASON_LABELS[reason]) {
    return TIMELINE_DECLINE_REASON_LABELS[reason];
  }
  return reason.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const TIMELINE_EXAM_OUTCOME_LABELS: Record<string, string> = {
  inpatient_order: "Inpatient treatment order",
  community_order: "Community treatment order",
  revoked: "Revoked — does not proceed",
  further_examination_ordered: "Further examination ordered",
};

export function formatTimelineExamOutcome(outcome: string): string {
  if (TIMELINE_EXAM_OUTCOME_LABELS[outcome]) {
    return TIMELINE_EXAM_OUTCOME_LABELS[outcome];
  }
  return outcome.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Every recorded event at this department in the last 24 hours, newest first.
 *
 * ⚠️ Built on every render and read by nothing since the 24 hour timeline left the ED page (device
 * audit, 11 Oct 2026; it is now a link to the Governance audit). Kept as it was so splitting the
 * file changed no behaviour; removing it is a separate decision.
 */
export function edDepartmentTimelineEvents({
  movements,
  units,
  referrals,
  registryPatients,
  thisEdId,
  now,
}: {
  movements: WardFlowContextValue["movements"];
  units: WardFlowContextValue["units"];
  referrals: WardFlowContextValue["referrals"];
  registryPatients: WardFlowContextValue["patients"];
  thisEdId: string;
  now: Instant;
}): TimelineEvent[] {
  const timelineEvents: TimelineEvent[] = [];
  for (const m of movements) {
    if (m.originEdId !== thisEdId) continue;
    const isMovementOpen = isOpen(m);
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    const patientInfo = resolveSubjectPatient(m, {
      patients: registryPatients,
      referrals,
      movements,
    });
    if (now - m.openedAt <= 24 * 60 || isMovementOpen) {
      const isLongWait = now - m.openedAt > LONG_WAIT_MINUTES && isMovementOpen;
      timelineEvents.push({
        id: `arrival-${m.id}-${m.openedAt}`,
        min: m.openedAt,
        tone: isLongWait ? "warn" : "quiet",
        category: "arrivals",
        categoryLabel: "Arrivals & Departures",
        patientName: patientInfo.displayName,
        movementId: m.id,
        badgeText: "Arrived",
        badgeTone: isLongWait ? "warn" : "quiet",
        primaryText: "Arrived at Emergency Department",
        detailText: isLongWait ? `Waiting ${splitDuration(now - m.openedAt)} (${LONG_WAIT_TEXT})` : undefined,
        by: null,
        isOpenMovement: isMovementOpen,
        what: (
          <>
            <b>{patientInfo.displayName}</b> arrived at the department
            {isLongWait && (
              <span>
                {" "}
                &mdash; waiting {LONG_WAIT_TEXT} ({splitDuration(now - m.openedAt)})
              </span>
            )}
          </>
        ),
      });
    }
    const mc = movementMedicalClearance(m, referrals);
    if (mc?.cleared && now - mc.at <= 24 * 60) {
      timelineEvents.push({
        id: `mc-${m.id}-${mc.at}`,
        min: mc.at,
        tone: "good",
        category: "clinical",
        categoryLabel: "Clinical & Legal",
        patientName: patientInfo.displayName,
        movementId: m.id,
        badgeText: "Medically Cleared",
        badgeTone: "good",
        primaryText: "Medically cleared for mental health pathway",
        by: null,
        isOpenMovement: isMovementOpen,
        what: (
          <>
            <b>{patientInfo.displayName}</b> medically cleared
          </>
        ),
      });
    }
    if (m.examination && now - m.examination.at <= 24 * 60) {
      const outcomeLabel = formatTimelineExamOutcome(m.examination.outcome);
      timelineEvents.push({
        id: `exam-${m.id}-${m.examination.at}`,
        min: m.examination.at,
        tone: "info",
        category: "clinical",
        categoryLabel: "Clinical & Legal",
        patientName: patientInfo.displayName,
        movementId: m.id,
        badgeText: "Examined",
        badgeTone: "info",
        primaryText: "Psychiatric examination completed",
        detailText: outcomeLabel,
        by: null,
        isOpenMovement: isMovementOpen,
        what: (
          <>
            <b>{patientInfo.displayName}</b> examined &mdash; {outcomeLabel}
          </>
        ),
      });
    }
    if (m.legalFormReceivedAt && now - m.legalFormReceivedAt <= 24 * 60) {
      const formCode = m.legalForm ? `Form ${m.legalForm.code}` : "Legal Form";
      const formFull = m.legalForm ? legalFormName(m.legalForm) : "Statutory form received";
      timelineEvents.push({
        id: `form-${m.id}-${m.legalFormReceivedAt}`,
        min: m.legalFormReceivedAt,
        tone: "purple",
        category: "clinical",
        categoryLabel: "Clinical & Legal",
        patientName: patientInfo.displayName,
        movementId: m.id,
        badgeText: formCode,
        badgeTone: "purple",
        primaryText: `${formCode} received`,
        detailText: formFull,
        by: null,
        isOpenMovement: isMovementOpen,
        what: (
          <>
            <b>{patientInfo.displayName}</b> {formCode} received
          </>
        ),
      });
    }
    if (m.declines) {
      for (const d of m.declines) {
        if (d.at !== undefined && now - d.at <= 24 * 60) {
          const targetUnit = units.find((u) => u.id === d.unitId);
          const unitName = targetUnit?.name ?? d.unitId;
          const formattedReason = formatTimelineDeclineReason(d.reason);
          timelineEvents.push({
            id: `decline-${m.id}-${d.unitId}-${d.at}`,
            min: d.at,
            tone: "warn",
            category: "bed_search",
            categoryLabel: "Bed searches",
            patientName: patientInfo.displayName,
            movementId: m.id,
            badgeText: "Bed Declined",
            badgeTone: "warn",
            unitName,
            primaryText: `Declined by ${unitName}`,
            detailText: formattedReason,
            by: null,
            isOpenMovement: isMovementOpen,
            what: (
              <>
                <b>{patientInfo.displayName}</b> {unitName} declined: &ldquo;{formattedReason}&rdquo;
              </>
            ),
          });
        }
      }
    }
    if (m.acceptedAt && m.acceptedUnitId && now - m.acceptedAt <= 24 * 60) {
      const targetUnit = units.find((u) => u.id === m.acceptedUnitId);
      const unitName = targetUnit?.name ?? m.acceptedUnitId;
      timelineEvents.push({
        id: `accept-${m.id}-${m.acceptedUnitId}-${m.acceptedAt}`,
        min: m.acceptedAt,
        tone: "good",
        category: "bed_search",
        categoryLabel: "Bed searches",
        patientName: patientInfo.displayName,
        movementId: m.id,
        badgeText: "Bed Accepted",
        badgeTone: "good",
        unitName,
        primaryText: `Bed offer accepted by ${unitName}`,
        by: null,
        isOpenMovement: isMovementOpen,
        what: (
          <>
            <b>{patientInfo.displayName}</b> {unitName} accepted
          </>
        ),
      });
    }
    if (
      m.transport &&
      (m.transport.acceptedAt ?? m.openedAt) &&
      now - (m.transport.acceptedAt ?? m.openedAt) <= 24 * 60
    ) {
      const bookedTime = m.transport.acceptedAt ?? m.openedAt;
      const bookedByRole = m.transport.bookedBy?.role ? WARD_FLOW_ROLE_LABELS[m.transport.bookedBy.role] : null;
      timelineEvents.push({
        id: `transport-${m.id}-${bookedTime}`,
        min: bookedTime,
        tone: "good",
        category: "transport",
        categoryLabel: "Transport",
        patientName: patientInfo.displayName,
        movementId: m.id,
        badgeText: "Transport Booked",
        badgeTone: "good",
        primaryText: m.transport.provider,
        detailText: m.transport.cadNumber
          ? `CAD: ${m.transport.cadNumber}`
          : m.transport.escortRequired
            ? "Clinical escort required"
            : undefined,
        by: bookedByRole,
        isOpenMovement: isMovementOpen,
        what: (
          <>
            <b>{patientInfo.displayName}</b> transport booked with {m.transport.provider}
          </>
        ),
      });
    }
    if (m.leftDepartmentAt && now - m.leftDepartmentAt <= 24 * 60) {
      timelineEvents.push({
        id: `left-${m.id}-${m.leftDepartmentAt}`,
        min: m.leftDepartmentAt,
        tone: "quiet",
        category: "arrivals",
        categoryLabel: "Arrivals & Departures",
        patientName: patientInfo.displayName,
        movementId: m.id,
        badgeText: "Departed",
        badgeTone: "quiet",
        primaryText: "Departed from Emergency Department",
        by: null,
        isOpenMovement: false,
        what: (
          <>
            <b>{patientInfo.displayName}</b> marked left the department
          </>
        ),
      });
    }
  }

  for (const r of referrals) {
    const hasEdDest = r.destinations.some(
      (d) => d.destination.kind === "emergency_department" && d.destination.edId === thisEdId,
    );
    if (!hasEdDest) continue;
    const rPatientInfo = resolveSubjectPatient(r, {
      patients: registryPatients,
      referrals,
    });
    const patientDisplayName = rPatientInfo.displayName;

    if (now - r.raisedAt <= 24 * 60) {
      timelineEvents.push({
        id: `ref-raised-${r.id}-${r.raisedAt}`,
        min: r.raisedAt,
        tone: "quiet",
        category: "bed_search",
        categoryLabel: "Bed searches",
        patientName: patientDisplayName,
        referralId: r.id,
        badgeText: "Referral Raised",
        badgeTone: "quiet",
        primaryText: `Referral raised (${r.ageBand.toLowerCase()} cohort)`,
        by: null,
        what: (
          <>
            <b>{rPatientInfo.umrn}</b> referral raised, {r.ageBand.toLowerCase()}
          </>
        ),
      });
    }
    if (r.triagedAt !== undefined && now - r.triagedAt <= 24 * 60) {
      timelineEvents.push({
        id: `ref-triaged-${r.id}-${r.triagedAt}`,
        min: r.triagedAt,
        tone: "quiet",
        category: "arrivals",
        categoryLabel: "Arrivals & Departures",
        patientName: patientDisplayName,
        referralId: r.id,
        badgeText: "Triaged",
        badgeTone: "quiet",
        primaryText: "Triaged in department",
        by: null,
        what: (
          <>
            <b>{rPatientInfo.umrn}</b> triaged in department
          </>
        ),
      });
    }
  }

  timelineEvents.sort((a, b) => b.min - a.min);
  return timelineEvents;
}
