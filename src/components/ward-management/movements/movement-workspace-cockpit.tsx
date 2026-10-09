/* src/components/ward-management/movements/movement-workspace-cockpit.tsx
 *
 * The elevated, modern Executive Clinical Movement Cockpit.
 * Replaces the outdated wall-of-text layout with a high-density, beautifully structured
 * operational workspace for psychiatric bed coordination in WA health services.
 *
 * Preserves 100% of event reducer dispatches, clinical safety invariants, and automated test hooks.
 */

"use client";
import { MovementWorkflowActions } from "./movement-workflow-actions";
import { SupportNotificationChecklist } from "./support-notification-checklist";

import { useState } from "react";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  Hospital,
  ShieldCheck,
  Truck,
  Activity,
  ArrowRight,
  Sparkles,
} from "lucide-react";

import { ContextualBackLink } from "@/components/contextual-back-link";
import { WardChip, type WardChipLevel } from "@/components/ward-management/ward-chip";
import { WardFigure, WardFigureStrip } from "@/components/ward-management/ward-figure";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import {
  clockState,
  formatInstantWithDay,
  formatRemaining,
  minutesUntil,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import {
  BLOCKERS_MEANING_NOTHING_IS_BLOCKING,
  MOVEMENT_STAGES,
  REFERRAL_GENDERS,
  STEP_BACK_REASONS,
  stepBackReasonLabels,
  type LegalForm,
  type Movement,
  type MovementId,
  type MovementStage,
  type ReferralGender,
  type StepBackReason,
  type Unit,
} from "@/components/ward-management/ward-model";
import {
  CANCEL_TRANSPORT_REASONS,
  DIVERSION_REASONS,
  STOP_TRANSPORT_REASONS,
  TRANSPORT_WHEREABOUTS,
  URGENT_MARK_REASONS,
  changeReasonLabels,
  withdrawalReasonLabels,
  type CancelTransportReason,
  type DiversionReason,
  type StopTransportReason,
  type TransportWhereabouts,
  type UrgentMarkReason,
} from "@/components/ward-management/ward-change-reasons";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import {
  candidateReason,
  eligibility,
  type EligibilityVerdict,
  type GateResult,
} from "@/components/ward-management/ward-eligibility";
import {
  destinationNoLongerLawful,
  eligibleCandidatesAmong,
  examinationRevokedWhileBedHeld,
  EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE,
  isOpen,
  movementHealthService,
  orphanedTransport,
  restrictionNotice,
  stageCopy,
  transportNeedState,
  transportStatusLabel,
} from "@/components/ward-management/ward-derivations";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { communityTeamById } from "@/components/ward-management/community/community-derivations";
import { legalFormNameLabelFirst } from "@/components/ward-management/ward-legal-forms";
import {
  attentionItems,
  legalFormReadinessLine,
  declineReasonLabels,
  stageChangeReasonLabel,
  stageReachedAt,
  trackStepSentence,
  unresolvedOriginDepartment,
  urgentFigureFlags,
  type Attention,
  type StepState,
} from "@/components/ward-management/movements/movement-workspace-derivations";

import styles from "./movement-workspace-cockpit.module.css";

const URGENT_FLAG_UNCHOSEN = "Choose why this patient is being flagged urgent first.";
const CANCEL_TRANSPORT_UNCHOSEN = "Choose why the transport job is being cancelled first.";
const WITHDRAW_REASON_UNCHOSEN = "Choose why the acceptance is being withdrawn first.";
const STEP_BACK_UNCHOSEN = "Choose both the target stage and the reason first.";

export function MovementWorkspaceCockpit({
  movementId,
  embedded = false,
}: {
  movementId: MovementId;
  embedded?: boolean;
}) {
  const { dispatch, movements, units, patients, referrals } = useWardFlow();
  const now = useWardFlowClock();

  const patient: Movement | undefined = movements.find((candidate) => candidate.id === movementId);
  const mastheadInfo = patient ? resolveSubjectPatient(patient, { patients, referrals, movements }) : undefined;
  const mastheadName = mastheadInfo?.patient ? mastheadInfo.displayName : undefined;

  const [blockerDraft, setBlockerDraft] = useState("");
  const [showClosedEligibility, setShowClosedEligibility] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState<StepBackReason | undefined>(undefined);
  const [stepBackTo, setStepBackTo] = useState<MovementStage | undefined>(undefined);
  const [stepBackReason, setStepBackReason] = useState<StepBackReason | undefined>(undefined);
  const [cancelTransportReason, setCancelTransportReason] = useState<CancelTransportReason | undefined>(undefined);
  const [stopTransportReason, setStopTransportReason] = useState<StopTransportReason | undefined>(undefined);
  const [stopTransportWhereabouts, setStopTransportWhereabouts] = useState<TransportWhereabouts | undefined>(undefined);
  const [diversionReason, setDiversionReason] = useState<DiversionReason | undefined>(undefined);
  const [diversionPlace, setDiversionPlace] = useState<TransportWhereabouts | undefined>(undefined);
  const [urgentFlagReason, setUrgentFlagReason] = useState<UrgentMarkReason | undefined>(undefined);
  const [genderRecordDraft, setGenderRecordDraft] = useState<ReferralGender | undefined>(undefined);

  if (!patient) {
    return null;
  }

  const destination = patient.acceptedUnitId ? units.find((unit) => unit.id === patient.acceptedUnitId) : undefined;
  const verdict = destination ? eligibility(patient, destination, now) : undefined;
  const candidates = eligibleCandidatesAmong(patient, units, now).filter(
    (candidate: { unit: Unit; verdict: EligibilityVerdict }) => candidate.unit.id !== destination?.id,
  );
  const cohortUnitCount = units.filter((unit: Unit) => unit.cohort === patient.cohort).length;
  const usableCandidates = candidates.filter(
    (candidate: { unit: Unit; verdict: EligibilityVerdict }) =>
      candidate.verdict.eligible && !patient.declines.some((decline) => decline.unitId === candidate.unit.id),
  );
  const genderRecordableHere =
    patient.gender === undefined &&
    candidates.some((candidate: { unit: Unit; verdict: EligibilityVerdict }) =>
      candidate.verdict.gates.some((gate: GateResult) => gate.gate === "gender_designation" && !gate.pass),
    );
  const open = isOpen(patient);
  const destinationRestriction = destination ? restrictionNotice(patient, destination) : undefined;
  const blockerIsActive = !BLOCKERS_MEANING_NOTHING_IS_BLOCKING.some((inactive) => inactive === patient.blocker.trim());
  const unitName = (unitId: string) => units.find((unit) => unit.id === unitId)?.name ?? unitId;
  const originEd = allEmergencyDepartments().find((department) => department.id === patient.originEdId);
  const service = movementHealthService(patient);
  const destinationService = destination ? siteByCode(destination.siteCode)?.service : undefined;
  const attention = attentionItems({ movement: patient, units, now, destination, open, blockerIsActive });
  const reachedIndex = MOVEMENT_STAGES.indexOf(patient.stage);

  const answeredCount = patient.declines.length + (patient.acceptedUnitId === undefined ? 0 : 1);
  const acceptedName = patient.acceptedUnitId === undefined ? undefined : unitName(patient.acceptedUnitId);
  const referredSub =
    patient.referredUnitIds.length > 0
      ? `Waiting on ${patient.referredUnitIds.map((unitId) => unitName(unitId)).join(", ")}.`
      : answeredCount > 0
        ? `No referral is open. ${patient.declines.length === 0 ? "No ward declined" : `${patient.declines.length} ward${patient.declines.length === 1 ? "" : "s"} declined`}${acceptedName ? `, and ${acceptedName} accepted.` : " and none accepted."}`
        : patient.withdrawnReferrals.length > 0
          ? `No referral is open. ${patient.withdrawnReferrals.length} ${patient.withdrawnReferrals.length === 1 ? "was" : "were"} withdrawn, and no ward has answered.`
          : "No ward has been asked to take this patient.";

  const ranMinutes = Math.max((open ? now : (patient.closure?.at ?? now)) - patient.openedAt, 0);

  const deadline = patient.legalForm?.dueAt;
  const deadlineBreached = open && deadline !== undefined && clockState(deadline, now) === "breached";
  const pullExpired = open && patient.pullExpiresAt !== undefined && patient.pullExpiresAt <= now;

  const { flagged, withheldFlags } = urgentFigureFlags({
    deadlineBreached,
    declined: open && patient.declines.length > 0,
    pullExpired,
  });

  const changeEvents = [
    ...patient.statusChanges.map((change) => ({
      kind: "legal" as const,
      at: change.at,
      by: change.by,
      reasonLabel: changeReasonLabels[change.reason],
      detail: `${change.from} → ${change.to}`,
    })),
    ...patient.urgencyChanges.map((change) => ({
      kind: "urgency" as const,
      at: change.at,
      by: change.by,
      reasonLabel: changeReasonLabels[change.reason],
      detail: `Tier ${change.from} → Tier ${change.to}`,
    })),
  ].sort((a, b) => a.at - b.at);

  const timeline: Array<{ at: Instant; label: string }> = [
    { at: patient.openedAt, label: "Movement opened" },
    ...(patient.pullExpiresAt !== undefined && patient.pullExpiresAt <= now
      ? [
          {
            at: patient.pullExpiresAt,
            label: `The pull on the bed${destination ? ` at ${destination.name}` : ""} ran out`,
          },
        ]
      : []),
    ...(patient.legalForm?.dueAt !== undefined && patient.legalForm.dueAt <= now
      ? [
          {
            at: patient.legalForm.dueAt,
            label: `The deadline on the ${legalFormNameLabelFirst(patient.legalForm)} passed`,
          },
        ]
      : []),
    ...(patient.transportNeed
      ? [
          {
            at: patient.transportNeed.at,
            label: patient.transportNeed.needed ? "Recorded as needing transport" : "Recorded as needing no transport",
          },
        ]
      : []),
    ...patient.stageChanges.map((change) => {
      const reasonLabel = change.reason === undefined ? undefined : stageChangeReasonLabel(change.reason);
      const suffix = reasonLabel ? ` · ${reasonLabel}` : "";
      const unwind = patient.unwinds.find(
        (candidate) =>
          candidate.at === change.at &&
          candidate.by === change.by &&
          (candidate.kind === "acceptance_withdrawn" || candidate.kind === "stage_corrected"),
      );
      if (unwind?.kind === "acceptance_withdrawn") {
        const ward = unwind.unitId === undefined ? "a ward the record does not name" : unitName(unwind.unitId);
        return { at: change.at, label: `Acceptance by ${ward} withdrawn, by ${change.by}${suffix}` };
      }
      if (unwind?.kind === "stage_corrected") {
        return {
          at: change.at,
          label:
            `Stage record corrected to ${stageCopy[change.to].label}, by ${change.by}${suffix} — ` +
            `no bed released, no transport cancelled, no acceptance undone`,
        };
      }
      return {
        at: change.at,
        label: `Stage ${change.from ? `${stageCopy[change.from].label} → ` : ""}${stageCopy[change.to].label}, by ${change.by}${suffix}`,
      };
    }),
    ...patient.statusChanges.map((change) => ({
      at: change.at,
      label: `Legal status ${change.from} → ${change.to}, by ${change.by} · ${changeReasonLabels[change.reason]}`,
    })),
    ...patient.urgencyChanges.map((change) => ({
      at: change.at,
      label: `Urgency Tier ${change.from} → Tier ${change.to}, by ${change.by} · ${changeReasonLabels[change.reason]}`,
    })),
    ...patient.declines.map((decline) => ({
      at: decline.at,
      label: `${unitName(decline.unitId)} declined · ${declineReasonLabels[decline.reason]}`,
    })),
    ...patient.withdrawnReferrals.map((withdrawal) => ({
      at: withdrawal.at,
      label: `Referral to ${unitName(withdrawal.unitId)} · ${withdrawalReasonLabels[withdrawal.reason]}`,
    })),
    ...(patient.examination
      ? [{ at: patient.examination.at, label: `Examined · ${patient.examination.outcome.replaceAll("_", " ")}` }]
      : []),
    ...(patient.escalation ? [{ at: patient.escalation.at, label: `Escalated to ${patient.escalation.contact}` }] : []),
    ...(patient.acceptedAt !== undefined && patient.acceptedUnitId !== undefined
      ? [{ at: patient.acceptedAt, label: `Accepted by ${unitName(patient.acceptedUnitId)}` }]
      : []),
    ...(patient.transport?.acceptedAt !== undefined
      ? [{ at: patient.transport.acceptedAt, label: `Transport accepted by ${patient.transport.provider}` }]
      : []),
    ...(patient.transport?.enRouteAt !== undefined
      ? [{ at: patient.transport.enRouteAt, label: "Transport en route" }]
      : []),
    ...(patient.transport?.collectedAt !== undefined
      ? [{ at: patient.transport.collectedAt, label: "Patient collected" }]
      : []),
    ...(patient.transport?.arrivedAt !== undefined
      ? [{ at: patient.transport.arrivedAt, label: "Arrived at destination" }]
      : []),
    ...(patient.transport?.cancelledAt !== undefined
      ? [{ at: patient.transport.cancelledAt, label: "Transport cancelled" }]
      : []),
    ...(patient.closure
      ? [
          {
            at: patient.closure.at,
            label: patient.closure.outcome === "arrived" ? "Closed — the patient arrived" : "Closed — did not proceed",
          },
        ]
      : []),
  ].sort((a, b) => a.at - b.at);

  const untimed: string[] = [];
  if (patient.stageChanges.length === 0 && reachedIndex > 0) {
    untimed.push(
      `This movement has reached step ${reachedIndex + 1} of ${MOVEMENT_STAGES.length}, ${stageCopy[patient.stage].label.toLowerCase()}. Nothing recorded when it moved between the steps, so no stage transition appears above.`,
    );
  }
  if (patient.acceptedUnitId !== undefined && patient.acceptedAt === undefined) {
    untimed.push(`${unitName(patient.acceptedUnitId)} accepted this patient. No time was recorded for the acceptance.`);
  }
  if (patient.pullExpiresAt !== undefined) {
    untimed.push(
      "A bed was pulled for this patient. The record holds the moment that pull runs out, but nothing recorded the moment it was pulled.",
    );
  }
  if (patient.transport !== undefined && patient.transport.escortRequired) {
    untimed.push(
      "An escort is required for this journey. Nothing records when that was decided, or whether one has been found — the model has no field for either.",
    );
  }

  const stageChipLevel: WardChipLevel = !open
    ? patient.closure?.outcome === "arrived"
      ? "accepted"
      : "cancelled"
    : "routine";
  const stageChipText = !open
    ? patient.closure
      ? patient.closure.outcome === "arrived"
        ? "Closed — arrived"
        : "Closed — did not proceed"
      : "Arrived"
    : stageCopy[patient.stage].label;

  const initials = mastheadName
    ? mastheadName
        .split(" ")
        .map((p: string) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : patient.id.slice(3, 5);

  /* The eligibility block */
  const eligibilityBlock = (
    <div data-testid="ward-console-eligibility-summary" className={styles.operationalColumn}>
      {!open ? (
        <p className={styles.actionSay}>
          <strong>This is a calculation against the wards as they are right now</strong> — not a record of what was true
          when this movement closed. Nothing recorded that, and there is no snapshot to show. Read it as &ldquo;what
          these wards could take today&rdquo;, never as an offer that was open to this patient.
        </p>
      ) : null}

      <div className={styles.panelCard}>
        <div className={styles.panelCardHeader}>
          <div className={styles.panelTitleGroup}>
            <Hospital className={styles.readinessCardIcon} size={18} aria-hidden="true" />
            <h2 className={styles.panelCardTitle}>{destination ? destination.name : "No destination chosen"}</h2>
          </div>
          {destination ? (
            <span className={styles.panelCountBadge}>{verdict?.eligible ? "Eligible" : "Not eligible"}</span>
          ) : null}
        </div>
        <div className={styles.panelCardBody}>
          <p className={styles.panelBlurb}>
            {destination
              ? `Every check below is about this patient against ${destination.name} specifically — the occupancy and allocatable figures are that ward's, not a network total.`
              : "Nobody has chosen a destination for this patient, so there is nothing to check them against yet."}
          </p>
          {destination ? (
            <div className={styles.destinationHero}>
              <div className={styles.destHeroTitle}>{destination.name}</div>
              <p className={styles.destHeroLede}>{verdict ? candidateReason(verdict) : "Not yet calculated"}</p>
              {destinationRestriction ? (
                <p
                  className={styles.candidateRisk}
                  data-testid="ward-console-destination-restriction"
                  data-restriction={destinationRestriction.level}
                >
                  {destinationRestriction.text}
                </p>
              ) : null}
              {verdict ? (
                <ul className={styles.gateList}>
                  {verdict.gates.map((gate) => (
                    <li key={gate.gate} className={styles.gateItem} data-pass={gate.pass ? "true" : "false"}>
                      {gate.pass ? (
                        <CheckCircle2 className={styles.gatePass} size={15} aria-hidden="true" />
                      ) : (
                        <CircleAlert className={styles.gateFail} size={15} aria-hidden="true" />
                      )}
                      <span>{gate.detail}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className={styles.actionSay}>
              {patient.referredUnitIds.length > 0
                ? `${patient.referredUnitIds.length} ward${patient.referredUnitIds.length === 1 ? " is" : "s are"} still waiting to answer, and none has accepted, so no destination is recorded.`
                : patient.declines.length > 0
                  ? `Every ward that was asked has answered, and all ${patient.declines.length} declined.`
                  : "No ward has been asked to take this patient yet."}
            </p>
          )}
        </div>
      </div>

      <section className={styles.panelCard}>
        <div className={styles.panelCardHeader}>
          <div className={styles.panelTitleGroup}>
            <Sparkles className={styles.readinessCardIcon} size={18} aria-hidden="true" />
            <h2 className={styles.panelCardTitle}>Other wards, ranked</h2>
          </div>
          <span className={styles.panelCountBadge}>
            {candidates.length} of {cohortUnitCount}
          </span>
        </div>
        <div className={styles.panelCardBody}>
          <p className={styles.panelBlurb}>
            Ranked among the {cohortUnitCount} {patient.cohort.toLowerCase()} wards in the network — the rest take a
            different cohort and were never candidates for this patient. At most three are listed. Being listed here is
            not an offer and not a decision — a ward that has already declined this movement still appears, marked.
          </p>

          {candidates.length > 0 && usableCandidates.length === 0 ? (
            <p className={styles.blockerAlertBanner} data-testid="ward-console-no-usable-alternative">
              No ward on this list could take this patient. Every one of them has either already declined this movement
              or fails a check of its own, so this is a ranking of what was considered, not a set of places left to try.
            </p>
          ) : null}

          {genderRecordableHere ? (
            <div className={styles.controlRow} data-testid="ward-console-record-gender">
              <select
                aria-label="Record gender"
                className={styles.controlSelect}
                data-testid="ward-console-record-gender-select"
                value={genderRecordDraft ?? ""}
                onChange={(event) =>
                  setGenderRecordDraft(event.target.value === "" ? undefined : (event.target.value as ReferralGender))
                }
              >
                <option value="">Choose…</option>
                {REFERRAL_GENDERS.map((gender) => (
                  <option key={gender} value={gender}>
                    {gender}
                  </option>
                ))}
              </select>
              <button
                type="button"
                data-testid="ward-console-record-gender-submit"
                className={styles.controlButton}
                disabled={genderRecordDraft === undefined}
                onClick={() => {
                  if (genderRecordDraft === undefined) return;
                  dispatch({
                    type: "RECORD_MOVEMENT_GENDER",
                    role: "coordinator",
                    now,
                    movementId: patient.id,
                    gender: genderRecordDraft,
                  });
                  setGenderRecordDraft(undefined);
                }}
              >
                Record gender
              </button>
            </div>
          ) : null}

          <ul className={styles.candidateTable} data-testid="ward-console-alternatives">
            {candidates.length === 0 ? (
              <li className={styles.candidateRow}>
                <span className={styles.candidateNote}>
                  No other ward in the network ranked at all for this patient&rsquo;s requirements. That is a statement
                  about the ranking, not a statement that no bed exists anywhere.
                </span>
              </li>
            ) : null}
            {candidates.map((candidate: { unit: Unit; verdict: EligibilityVerdict }) => {
              const notice = restrictionNotice(patient, candidate.unit);
              const declined = patient.declines.some((decline) => decline.unitId === candidate.unit.id);
              const reason = candidateReason(candidate.verdict);
              const reasonAddsSomething =
                !candidate.verdict.eligible && !(declined && reason.toLowerCase().startsWith("already declined"));
              return (
                <li className={styles.candidateRow} key={candidate.unit.id}>
                  <div className={styles.candidateMain}>
                    <strong className={styles.candidateName}>{candidate.unit.name}</strong>
                    {reasonAddsSomething ? <span className={styles.candidateNote}>{reason}</span> : null}
                    {notice ? (
                      <span className={styles.candidateRisk} data-restriction={notice.level}>
                        {notice.text}
                      </span>
                    ) : null}
                  </div>
                  <div className={styles.candidateChips}>
                    {declined ? <WardChip level="routine">Already declined</WardChip> : null}
                    <b className={styles.candidateVerdict}>
                      {candidate.verdict.eligible ? "Eligible" : "Not eligible"}
                    </b>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );

  if (embedded) {
    return (
      <div className={styles.embeddedActions}>
        <MovementWorkflowActions movement={patient} />
        {renderActions(patient)}
      </div>
    );
  }

  return (
    <div className={styles.cockpitRoot} data-testid="ward-patient-workspace">
      {/* 0. Header Breadcrumb */}
      <header className={styles.workspaceHeader}>
        <ContextualBackLink
          fallbackHref="/mockups/ward-flow"
          aria-label="Back to Ward Flow"
          className={styles.backLink}
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </ContextualBackLink>
        <div>
          <span>Ward Flow</span>
          <span className={styles.headerCrumb}>Movement {patient.id}</span>
        </div>
      </header>

      {/* Main Landmark: Exactly one main#main-content */}
      <main id="main-content" className={styles.cockpitRoot}>
        {/* =========================================================================
            1. EXECUTIVE CLINICAL MASTHEAD
            ========================================================================= */}
        <section className={styles.mastheadCard} aria-labelledby="movement-masthead-title">
          <div className={styles.mastheadTop}>
            <div className={styles.patientIdentityGroup}>
              <div className={styles.patientAvatar} aria-hidden="true">
                {initials}
              </div>
              <div className={styles.identityText}>
                <div className={styles.eyebrowRow}>
                  <span>Movement Workspace</span>
                  <span>·</span>
                  <span>{patient.id}</span>
                </div>
                {/* Single <h1> Landmark for this route */}
                <h1 id="movement-masthead-title" className={styles.mastheadTitle}>
                  {mastheadName ? `${mastheadName} (${patient.id})` : patient.id} —{" "}
                  {originEd ? `in ${originEd.name}` : unresolvedOriginDepartment(patient)}
                </h1>
                <div className={styles.clinicalDemographicsPill}>
                  <span>{patient.cohort}</span>
                  <span className={styles.demographicSep}>·</span>
                  <span>{patient.security}</span>
                  <span className={styles.demographicSep}>·</span>
                  <span>{patient.legalStatus}</span>
                  {patient.sex ? (
                    <>
                      <span className={styles.demographicSep}>·</span>
                      <span>{patient.sex}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div className={styles.mastheadActions}>
              <WardChip level={stageChipLevel}>{stageChipText}</WardChip>
              <WardChip level="routine">Tier {patient.urgency}</WardChip>
              {patient.flaggedUrgent ? (
                <WardChip level={open ? "urgent" : "routine"}>
                  {open ? "Flagged urgent" : "Was flagged urgent"}
                </WardChip>
              ) : null}
              {patient.specialling ? <WardChip level="routine">Specialling</WardChip> : null}
            </div>
          </div>

          {/* Route & Trajectory Banner */}
          <div className={styles.trajectoryLine}>
            <span className={styles.trajectoryOrigin}>
              {originEd ? originEd.name : unresolvedOriginDepartment(patient)}
            </span>
            <ArrowRight size={14} className={styles.trajectoryArrow} aria-hidden="true" />
            <span className={styles.trajectoryDest}>
              {destination
                ? `${open ? "Bound for" : "Was bound for"} ${destination.name}${destinationService ? `, ${destinationService}` : ""}.`
                : patient.referredUnitIds.length > 0
                  ? `No destination yet — ${patient.referredUnitIds.length} referral${patient.referredUnitIds.length === 1 ? " is" : "s are"} still open.`
                  : patient.declines.length > 0
                    ? `No destination yet. ${patient.declines.length} ward${patient.declines.length === 1 ? " has" : "s have"} declined and none has accepted.`
                    : patient.referralAbsence?.reason === "none_raised"
                      ? "No destination yet. It is recorded that no ward has been asked."
                      : "No destination yet. Nothing is recorded about whether a ward has been asked."}
            </span>
          </div>

          {/* Closure Panel if closed */}
          {!open ? (
            <div data-testid="workspace-closure-banner" className={styles.closureBanner}>
              <h2 className={styles.closureTitle}>
                {patient.closure?.outcome === "arrived"
                  ? "This movement is closed — the patient arrived"
                  : "This movement is closed — it did not proceed"}
                {patient.closure ? ` · ${formatInstantWithDay(patient.closure.at, now)}` : ""}
              </h2>
              <p className={styles.closureReason}>
                {patient.closure
                  ? patient.closure.reason
                  : "The patient has arrived. No closure record was written, so nothing on this movement says why it ended or who ended it."}
              </p>
              <p className={styles.closureMeta}>
                {patient.closure
                  ? `It ran ${splitDuration(ranMinutes)} from opening to closing, and stopped at step ${reachedIndex + 1} of ${MOVEMENT_STAGES.length}, ${stageCopy[patient.stage].label.toLowerCase()}.`
                  : `It ran ${splitDuration(ranMinutes)} from opening, and the last stage recorded is ${stageCopy[patient.stage].label.toLowerCase()}.`}
              </p>
            </div>
          ) : null}
          {/* Advisory carer/PSP/MHAS checklist: renders only for an involuntary patient's completed arrival. */}
          <SupportNotificationChecklist movementId={patient.id} />
        </section>

        {/* =========================================================================
            2. HORIZONTAL 7-STAGE TRAJECTORY STEPPER
            ========================================================================= */}
        <section className={styles.stepperContainer} aria-labelledby="stepper-title">
          <div className={styles.stepperHeader}>
            <h2 id="stepper-title" className={styles.stepperTitle}>
              {open ? "Where this has got to" : "Where this stopped"}
            </h2>
            <span className={styles.stepperCountBadge}>
              {reachedIndex + 1} of {MOVEMENT_STAGES.length}
            </span>
          </div>
          <ol className={styles.stepperTrack} data-testid="ward-console-track">
            {MOVEMENT_STAGES.map((stage, idx) => {
              const state: StepState =
                idx < reachedIndex ? "done" : idx > reachedIndex ? "ahead" : open ? "current" : "stopped";
              const at = state === "ahead" ? undefined : stageReachedAt(patient, stage);
              return (
                <li key={stage} className={styles.stepperStep} data-state={state}>
                  <div className={styles.stepIndicatorRow}>
                    <span className={styles.stepNumber}>{idx + 1}</span>
                    {state === "done" ? (
                      <CheckCircle2 className={styles.stepIcon} aria-hidden="true" />
                    ) : state === "current" ? (
                      <Activity className={styles.stepIcon} aria-hidden="true" />
                    ) : (
                      <span className={styles.stepIcon} aria-hidden="true" />
                    )}
                  </div>
                  <strong className={styles.stepLabel}>
                    {idx + 1}. {stageCopy[stage].label}
                  </strong>
                  <span className={styles.stepWhen}>{trackStepSentence(patient, state, at, now)}</span>
                </li>
              );
            })}
          </ol>
        </section>

        {/* =========================================================================
            3. TELEMETRY & FIGURE STRIP
            ========================================================================= */}
        <section data-testid="ward-console-figures" aria-label="Movement figures">
          <WardFigureStrip>
            <WardFigure
              label={open ? "Time since this movement opened" : "How long this movement ran"}
              value={splitDuration(ranMinutes)}
              sub={`Opened ${formatInstantWithDay(patient.openedAt, now)}`}
            />
            <WardFigure
              label={open ? "Step reached" : "Step it stopped at"}
              value={`${reachedIndex + 1} of ${MOVEMENT_STAGES.length}`}
              sub={stageCopy[patient.stage].label}
            />
            <WardFigure
              label="Referrals still open"
              value={patient.referredUnitIds.length === 0 ? "None" : String(patient.referredUnitIds.length)}
              sub={referredSub}
            />
            <WardFigure
              label="Wards that declined"
              value={patient.declines.length === 0 ? "None" : String(patient.declines.length)}
              flagged={flagged.has("declines")}
              sub={
                patient.declines.length === 0
                  ? "No ward has refused this patient"
                  : patient.declines.map((decline) => unitName(decline.unitId)).join(", ")
              }
            />
            {deadline !== undefined && patient.legalForm ? (
              <WardFigure
                label={`Deadline on the ${legalFormNameLabelFirst(patient.legalForm)}`}
                value={formatRemaining(minutesUntil(deadline, now))}
                flagged={flagged.has("deadline")}
                sub={`Due ${formatInstantWithDay(deadline, now)} — the deadline this record holds, not a claim about what the Act requires`}
              />
            ) : null}
            {patient.pullExpiresAt !== undefined ? (
              <WardFigure
                label="Hold on the bed"
                value={formatRemaining(minutesUntil(patient.pullExpiresAt, now))}
                flagged={flagged.has("pull")}
                sub={`${patient.pullExpiresAt <= now ? "Ran out" : "Runs out"} ${formatInstantWithDay(patient.pullExpiresAt, now)}`}
              />
            ) : null}
          </WardFigureStrip>
          {withheldFlags.length > 0 ? (
            <p className={styles.withheldFlagNote} data-testid="ward-console-withheld-flags">
              {withheldFlags.length === 1
                ? `Also urgent, and not highlighted above: ${withheldFlags[0]}. At most two figures carry amber, so that this screen still points somewhere.`
                : `Also urgent, and not highlighted above: ${withheldFlags.join("; ")}. At most two figures carry amber, so that this screen still points somewhere.`}
            </p>
          ) : null}
        </section>

        {/* =========================================================================
            4. TWO-COLUMN COCKPIT (OPERATIONAL CORE & ACTION COMMAND CENTER)
            ========================================================================= */}
        <div className={styles.cockpitGrid}>
          {/* LEFT: Operational Core (Destination, Clearance Matrix, Audit) */}
          <div className={styles.operationalColumn}>
            {/* Attention Rail (Embedded as prominent operational alert card) */}
            <div className={styles.panelCard}>
              <div className={styles.panelCardHeader}>
                <div className={styles.panelTitleGroup}>
                  <AlertTriangle className={styles.readinessCardIcon} size={18} aria-hidden="true" />
                  <h2 className={styles.panelCardTitle}>{open ? "Needs attention" : "Why this stopped"}</h2>
                </div>
                {open ? <span className={styles.panelCountBadge}>{attention.length}</span> : null}
              </div>
              <div className={styles.panelCardBody}>
                <ul className={styles.attentionList} data-testid="ward-console-attention">
                  {attention.map((item: Attention) => (
                    <li className={styles.attentionItem} key={item.key} data-level={item.level}>
                      <div className={styles.attentionHead}>
                        <span className={styles.attentionWho}>{item.who}</span>
                        <WardChip level={item.level}>{item.chip}</WardChip>
                      </div>
                      <span className={styles.attentionSay}>{item.say}</span>
                    </li>
                  ))}
                  {attention.length === 0 ? (
                    <li className={styles.attentionItem} data-level="accepted">
                      <div className={styles.attentionHead}>
                        <span className={styles.attentionWho}>Nothing outstanding</span>
                        <WardChip level="accepted">Clear</WardChip>
                      </div>
                      <span className={styles.attentionSay}>
                        Every check this page can make came back clear: no recorded deadline is close or past, no bed
                        pull has run out, no ward has declined without an acceptance, no escort is outstanding, and
                        nobody has recorded a blocker. That is the checks passing, not a guarantee that nothing is
                        wrong.
                      </span>
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>

            {/* Destination & Ranked Cohort Alternative Wards */}
            {open ? eligibilityBlock : null}

            {/* 4-Pillar Clinical Readiness Matrix */}
            <div className={styles.panelCard}>
              <div className={styles.panelCardHeader}>
                <div className={styles.panelTitleGroup}>
                  <ShieldCheck className={styles.readinessCardIcon} size={18} aria-hidden="true" />
                  <h2 className={styles.panelCardTitle}>{open ? "Readiness" : "Readiness when this stopped"}</h2>
                </div>
              </div>
              <div className={styles.panelCardBody}>
                <p className={styles.panelBlurb}>
                  {open
                    ? "The four things that have to be true before this patient can travel. This says only where each one stands — the fact itself is set out in full further down, and anything needing action is in Needs attention."
                    : "The four things that would have had to be true before this patient could travel. This movement closed, so none of them is outstanding now; this is where each one stood."}
                </p>

                <ul className={styles.readinessMatrix} data-testid="ward-console-readiness">
                  <li className={styles.readinessCard}>
                    <div className={styles.readinessCardHeader}>
                      <FileCheck2 size={16} className={styles.readinessCardIcon} aria-hidden="true" />
                      <strong>Legal status</strong>
                    </div>
                    <span className={styles.readinessCardBody}>
                      {patient.statusChanges.length === 0
                        ? "Recorded. No change to it has been recorded since this movement opened."
                        : `Recorded, and changed ${patient.statusChanges.length} time${patient.statusChanges.length === 1 ? "" : "s"} since this movement opened.`}
                    </span>
                    <span className={styles.readinessCardWhere}>What the status is, under Legal and forms below.</span>
                  </li>

                  <li className={styles.readinessCard}>
                    <div className={styles.readinessCardHeader}>
                      <ShieldCheck size={16} className={styles.readinessCardIcon} aria-hidden="true" />
                      <strong>Form readiness</strong>
                    </div>
                    <span className={styles.readinessCardBody}>{formReadinessState(patient.legalForm, now)}</span>
                    {patient.legalForm ? (
                      <span className={styles.readinessCardWhere}>
                        The form and its deadline, under Legal and forms below.
                      </span>
                    ) : null}
                  </li>

                  <li className={styles.readinessCard}>
                    <div className={styles.readinessCardHeader}>
                      <Truck size={16} className={styles.readinessCardIcon} aria-hidden="true" />
                      <strong>Transport</strong>
                    </div>
                    <span className={styles.readinessCardBody}>{transportReadinessState(patient, open)}</span>
                    <span className={styles.readinessCardWhere}>
                      The job, provider, escort and form, under Transport below.
                    </span>
                  </li>

                  <li className={styles.readinessCard}>
                    <div className={styles.readinessCardHeader}>
                      <CircleAlert size={16} className={styles.gateFail} aria-hidden="true" />
                      <strong>What is holding it up</strong>
                    </div>
                    <span className={styles.readinessCardBody}>
                      {blockerReadinessState(patient, open, blockerIsActive)}
                    </span>
                    <span className={styles.readinessCardWhere}>
                      {open
                        ? blockerIsActive
                          ? "Needs attention, at the top of this page, quotes it in full."
                          : "What you can do here, below, is where one is recorded."
                        : "What you can do here, below, shows the note itself."}
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <MovementWorkflowActions movement={patient} />
            {/* Legal and Forms Detail Panel */}
            <div data-testid="ward-console-legal-panel" className={styles.panelCard}>
              <div className={styles.panelCardHeader}>
                <div className={styles.panelTitleGroup}>
                  <FileCheck2 className={styles.readinessCardIcon} size={18} aria-hidden="true" />
                  <h2 className={styles.panelCardTitle}>Legal and forms</h2>
                </div>
              </div>
              <div className={styles.panelCardBody}>
                <p className={styles.panelBlurb}>
                  What this record holds about this patient&apos;s status and the form beside it. It is not a statement
                  of what the Mental Health Act requires.
                </p>
                <dl className={styles.factGrid}>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Legal status</dt>
                    <dd className={styles.factValue}>{patient.legalStatus}</dd>
                  </div>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Form</dt>
                    <dd className={styles.factValue}>
                      {patient.legalForm ? legalFormReadinessLine(patient.legalForm, now) : "No legal form recorded"}
                    </dd>
                  </div>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Status changes</dt>
                    <dd className={styles.factValue}>
                      {patient.statusChanges.length === 0
                        ? "None recorded since the movement opened. That is not the same as none having happened."
                        : `${patient.statusChanges.length} recorded — listed in full below.`}
                    </dd>
                  </div>
                </dl>
                {destinationNoLongerLawful(patient, units) ? (
                  <p className={styles.candidateRisk}>
                    {destinationNoLongerLawful(patient, units)?.name} is not authorised to receive this patient under
                    their current status. The acceptance predates the status change.
                  </p>
                ) : null}
              </div>
            </div>

            {/* Transport Logistics Panel */}
            <div data-testid="ward-console-transport-panel" className={styles.panelCard}>
              <div className={styles.panelCardHeader}>
                <div className={styles.panelTitleGroup}>
                  <Truck className={styles.readinessCardIcon} size={18} aria-hidden="true" />
                  <h2 className={styles.panelCardTitle}>Transport</h2>
                </div>
              </div>
              <div className={styles.panelCardBody}>
                <p className={styles.panelBlurb}>
                  Only what the transport record holds, and the one place on this page that holds it. There is no
                  estimated arrival time anywhere in this model, and no risk documentation.
                </p>
                <dl className={styles.factGrid}>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Is transport needed?</dt>
                    <dd className={styles.factValue}>{transportNeedSentence(patient, now)}</dd>
                  </div>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Job</dt>
                    <dd className={styles.factValue}>{transportReadinessLine(patient, open)}</dd>
                  </div>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Provider</dt>
                    <dd className={styles.factValue}>
                      {patient.transport
                        ? patient.transport.provider
                        : "No provider is recorded, because no job exists."}
                    </dd>
                  </div>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Escort</dt>
                    <dd className={styles.factValue}>
                      {patient.transport === undefined
                        ? "No job exists, so nothing has been recorded about an escort."
                        : patient.transport.escortRequired
                          ? "An escort is required for this journey. The record does not say whether one has been found — there is no field for that."
                          : "No escort is required for this journey."}
                    </dd>
                  </div>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Form the provider asked for</dt>
                    <dd className={styles.factValue}>
                      {patient.transport?.formRequired ?? "None is recorded against the transport job."}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Movement Facts Panel */}
            <div className={styles.panelCard}>
              <div className={styles.panelCardHeader}>
                <h2 className={styles.panelCardTitle}>Movement facts</h2>
              </div>
              <div className={styles.panelCardBody}>
                <dl className={styles.factGrid}>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>{open ? "Current stage" : "Stopped at"}</dt>
                    <dd className={styles.factValue}>{stageCopy[patient.stage].label}</dd>
                  </div>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Owner</dt>
                    <dd className={styles.factValue}>{patient.owner}</dd>
                  </div>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Origin department</dt>
                    <dd className={styles.factValue}>
                      {originEd ? originEd.name : unresolvedOriginDepartment(patient)}
                    </dd>
                  </div>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Accepted by</dt>
                    <dd className={styles.factValue}>
                      {patient.acceptedUnitId
                        ? `${unitName(patient.acceptedUnitId)}${patient.acceptedAt === undefined ? " — no time recorded" : `, ${formatInstantWithDay(patient.acceptedAt, now)}`}`
                        : "No ward has accepted this patient."}
                    </dd>
                  </div>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Recorded by hand as holding this up</dt>
                    <dd className={styles.factValue}>
                      Kept in one place: What you can do here, below, beside the controls that change it.
                    </dd>
                  </div>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Health service of the origin department</dt>
                    <dd className={styles.factValue}>{service ?? "Origin service not identified"}</dd>
                  </div>
                  <div className={styles.factRow}>
                    <dt className={styles.factLabel}>Setting</dt>
                    <dd className={styles.factValue}>
                      {patient.cohort} · {patient.security} · {patient.sex}
                      {patient.specialling ? " · specialling required" : ""}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Declines Section */}
            <div data-testid="ward-patient-declines" className={styles.panelCard}>
              <div className={styles.panelCardHeader}>
                <h2 className={styles.panelCardTitle}>Declines</h2>
                {patient.declines.length > 0 ? (
                  <span className={styles.panelCountBadge}>{patient.declines.length}</span>
                ) : null}
              </div>
              <div className={styles.panelCardBody}>
                {patient.declines.length > 0 ? (
                  <ol className={styles.timelineList}>
                    {patient.declines.map((decline, index) => (
                      <li className={styles.timelineItem} key={`${decline.unitId}-${decline.at}-${index}`}>
                        <time className={styles.timelineWhen}>{formatInstantWithDay(decline.at, now)}</time>
                        <span className={styles.timelineWhat}>
                          {unitName(decline.unitId)} · {declineReasonLabels[decline.reason]}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={styles.actionSay}>No declines recorded for this movement.</p>
                )}
              </div>
            </div>

            {/* Status and Urgency Changes Section */}
            <div data-testid="ward-patient-changes" className={styles.panelCard}>
              <div className={styles.panelCardHeader}>
                <h2 className={styles.panelCardTitle}>Status and urgency changes</h2>
                {changeEvents.length > 0 ? <span className={styles.panelCountBadge}>{changeEvents.length}</span> : null}
              </div>
              <div className={styles.panelCardBody}>
                {changeEvents.length > 0 ? (
                  <ol className={styles.timelineList}>
                    {changeEvents.map((change, index) => (
                      <li className={styles.timelineItem} key={`${change.kind}-${change.at}-${index}`}>
                        <time className={styles.timelineWhen}>{formatInstantWithDay(change.at, now)}</time>
                        <span className={styles.timelineWhat}>
                          {change.kind === "legal" ? "Legal status" : "Urgency"} changed {change.detail} by {change.by}{" "}
                          · {change.reasonLabel}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={styles.actionSay}>No status or urgency changes recorded for this movement.</p>
                )}
              </div>
            </div>

            {/* Escalation Section */}
            <div data-testid="ward-patient-escalation" className={styles.panelCard}>
              <div className={styles.panelCardHeader}>
                <h2 className={styles.panelCardTitle}>Escalation</h2>
              </div>
              <div className={styles.panelCardBody}>
                {patient.escalation ? (
                  <dl className={styles.factGrid}>
                    <div className={styles.factRow}>
                      <dt className={styles.factLabel}>When</dt>
                      <dd className={styles.factValue}>{formatInstantWithDay(patient.escalation.at, now)}</dd>
                    </div>
                    <div className={styles.factRow}>
                      <dt className={styles.factLabel}>Units tried</dt>
                      <dd className={styles.factValue}>
                        {patient.escalation.triedUnitIds.map((unitId) => unitName(unitId)).join(", ")}
                      </dd>
                    </div>
                    <div className={styles.factRow}>
                      <dt className={styles.factLabel}>Contact</dt>
                      <dd className={styles.factValue}>{patient.escalation.contact}</dd>
                    </div>
                    <div className={styles.factRow}>
                      <dt className={styles.factLabel}>What came back</dt>
                      <dd className={styles.factValue}>No response is recorded for this escalation.</dd>
                    </div>
                  </dl>
                ) : (
                  <p className={styles.actionSay}>No escalation recorded for this movement.</p>
                )}
              </div>
            </div>

            {/* Audit Timeline Section */}
            <section className={styles.panelCard}>
              <div className={styles.panelCardHeader}>
                <h2 className={styles.panelCardTitle}>Audit timeline</h2>
                <span className={styles.panelCountBadge}>{timeline.length}</span>
              </div>
              <div className={styles.panelCardBody}>
                <ol className={styles.timelineList} data-testid="ward-console-timeline">
                  {timeline.map((event, index) => (
                    <li className={styles.timelineItem} key={`${event.at}-${index}`}>
                      <time className={styles.timelineWhen}>{formatInstantWithDay(event.at, now)}</time>
                      <span className={styles.timelineWhat}>{event.label}</span>
                    </li>
                  ))}
                </ol>
                {untimed.length > 0 ? (
                  <div className={styles.untimedBox} data-testid="ward-console-untimed">
                    <p className={styles.untimedTitle}>Happened, but nothing recorded when</p>
                    <ul className={styles.untimedList}>
                      {untimed.map((sentence) => (
                        <li key={sentence}>{sentence}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <details>
                  <summary className={styles.actionSay} style={{ cursor: "pointer", fontWeight: 600 }}>
                    Timeline coverage
                  </summary>
                  <p className={styles.actionSay} style={{ marginTop: "4px" }}>
                    Events with recorded times appear above. Events without a recorded time are listed separately.
                  </p>
                </details>
              </div>
            </section>

            {/* Closed eligibility reveal panel */}
            {!open ? (
              <>
                {renderActions(patient)}
                <div className={styles.panelCard}>
                  <div className={styles.panelCardHeader}>
                    <h2 className={styles.panelCardTitle}>Check what these wards could take today</h2>
                  </div>
                  <div className={styles.panelCardBody}>
                    <p className={styles.panelBlurb}>
                      An eligibility calculation against the wards as they are right now. It is not a record of what was
                      true when this movement closed, and it is not shown by default for that reason.
                    </p>
                    {showClosedEligibility ? (
                      eligibilityBlock
                    ) : (
                      <>
                        <p className={styles.actionSay}>
                          Nothing recorded which wards could have taken this patient at the moment this movement closed.
                          There is no snapshot — only a fresh calculation against today&rsquo;s occupancy, staffing and
                          bed state.
                        </p>
                        <button
                          type="button"
                          className={styles.controlButton}
                          data-testid="ward-console-reveal-eligibility"
                          onClick={() => setShowClosedEligibility(true)}
                        >
                          Check what these wards could take today
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* RIGHT: Action Command Center (Controls, Immediate Actions) */}
          <div className={styles.commandColumn}>{open ? renderActions(patient) : null}</div>
        </div>

        <WardPrototypeFooter
          testId="ward-console-governance"
          note="Synthetic prototype only · Eligibility is checked automatically; an authorised human confirms every destination · Not clinical severity"
        />
        <span id="ward-console-confirm-unavailable" className="sr-only">
          Confirming a destination is not built yet. Nothing is recorded when this control is activated.
        </span>
      </main>
    </div>
  );

  /**
   * Action Command Center rendering function
   */
  function renderActions(movement: Movement) {
    const earlierStages = MOVEMENT_STAGES.slice(0, Math.max(MOVEMENT_STAGES.indexOf(movement.stage), 0));
    const acceptedStageIndex = MOVEMENT_STAGES.indexOf(movement.stage);
    const orphanedJob = orphanedTransport(movement);

    return (
      <div className={styles.panelCard}>
        <div className={styles.panelCardHeader}>
          <div className={styles.panelTitleGroup}>
            <Activity className={styles.readinessCardIcon} size={18} aria-hidden="true" />
            <h2 className={styles.panelCardTitle}>What you can do here</h2>
          </div>
        </div>
        <div className={styles.panelCardBody}>
          <p className={styles.panelBlurb}>
            {open
              ? orphanedJob
                ? "Six controls, all of which record against this movement immediately, and the first is a transport job booked against a bed that is no longer held. Confirming a destination is not built yet."
                : "Five controls, all of which record against this movement immediately. Two of them correct something already recorded, and each asks why. Confirming a destination is not built yet."
              : "These controls are the same ones an open movement has. On a closed movement the reducer refuses them, and the reasons are stated rather than the buttons being hidden."}
          </p>

          <div className={styles.actionStack}>
            {/* 1. URGENT FLAG */}
            <section className={styles.actionSection} data-testid="ward-patient-urgent-flag">
              <h3 className={styles.actionSectionTitle}>Urgent flag</h3>
              <p className={styles.actionSay}>
                {movement.flaggedUrgent
                  ? open
                    ? "Flagged urgent. This patient leads the queue ahead of every urgency tier, including tier 1."
                    : "Flagged urgent. This movement is no longer in the queue, so the flag orders nothing now — removing it changes only the record."
                  : open
                    ? "Not flagged. This patient is ordered by urgency tier and waiting time, like everybody else."
                    : "Not flagged — and this movement is no longer running, so it is not in the queue at all. Flagging it would change nothing."}
              </p>
              {!open && !movement.flaggedUrgent ? null : movement.flaggedUrgent ? (
                <button
                  type="button"
                  className={styles.controlButton}
                  data-testid="ward-console-urgent-flag-toggle"
                  onClick={() =>
                    dispatch({
                      type: "CLEAR_MOVEMENT_URGENT_FLAG",
                      role: "coordinator",
                      now,
                      movementId: movement.id,
                    })
                  }
                >
                  Remove the urgent flag
                </button>
              ) : (
                <div className={styles.controlRow}>
                  <label className="sr-only" htmlFor="ward-console-urgent-flag-reason">
                    Why is this urgent?
                  </label>
                  <select
                    id="ward-console-urgent-flag-reason"
                    className={styles.controlSelect}
                    data-testid="ward-console-urgent-flag-reason"
                    value={urgentFlagReason ?? ""}
                    onChange={(chosen) => {
                      const value = chosen.target.value;
                      setUrgentFlagReason(
                        URGENT_MARK_REASONS.includes(value as UrgentMarkReason)
                          ? (value as UrgentMarkReason)
                          : undefined,
                      );
                    }}
                  >
                    <option value="">Choose a reason…</option>
                    {URGENT_MARK_REASONS.map((reason: UrgentMarkReason) => (
                      <option key={reason} value={reason}>
                        {changeReasonLabels[reason]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.controlButton}
                    data-testid="ward-console-urgent-flag-toggle"
                    aria-disabled={urgentFlagReason === undefined ? "true" : undefined}
                    aria-describedby={urgentFlagReason === undefined ? "ward-console-urgent-flag-blocked" : undefined}
                    title={urgentFlagReason === undefined ? URGENT_FLAG_UNCHOSEN : undefined}
                    onClick={
                      urgentFlagReason === undefined
                        ? ignoreUnavailableActivation
                        : () => {
                            dispatch({
                              type: "FLAG_MOVEMENT_URGENT",
                              role: "coordinator",
                              now,
                              movementId: movement.id,
                              reason: urgentFlagReason,
                            });
                            setUrgentFlagReason(undefined);
                          }
                    }
                  >
                    Flag this patient as urgent
                  </button>
                  {urgentFlagReason === undefined ? (
                    <span id="ward-console-urgent-flag-blocked" className="sr-only">
                      {URGENT_FLAG_UNCHOSEN}
                    </span>
                  ) : null}
                </div>
              )}
            </section>

            {/* 2. WHAT IS HOLDING THIS UP (BLOCKER) */}
            <section className={styles.actionSection} data-testid="ward-patient-blocker">
              <h3 className={styles.actionSectionTitle}>What is holding this up</h3>
              <p className={styles.actionSay}>{movement.blocker}</p>
              {examinationRevokedWhileBedHeld(movement) ? (
                <p
                  className={styles.candidateRisk}
                  data-testid="ward-console-examination-revoked-flag"
                  data-level="warning"
                >
                  {EXAMINATION_REVOKED_WHILE_BED_HELD_NOTICE}
                </p>
              ) : null}
              {!open ? (
                <p className={styles.actionSay}>
                  This movement is no longer running — the panel at the top of the page says why. The note above is what
                  was recorded before it stopped; nothing new can be recorded against it now.
                </p>
              ) : (
                <form
                  className={styles.controlRow}
                  onSubmit={(submitted) => {
                    submitted.preventDefault();
                    dispatch({
                      type: "RECORD_MOVEMENT_BLOCKER",
                      role: "coordinator",
                      now,
                      movementId: movement.id,
                      blocker: blockerDraft,
                    });
                    setBlockerDraft("");
                  }}
                >
                  <label className="sr-only" htmlFor="ward-console-blocker">
                    What is holding this up? Wards, roles and jobs only — never a patient&rsquo;s name, details or
                    clinical narrative.
                  </label>
                  <input
                    id="ward-console-blocker"
                    type="text"
                    className={styles.blockerInput}
                    data-testid="ward-console-blocker-input"
                    value={blockerDraft}
                    onChange={(changed) => setBlockerDraft(changed.target.value)}
                    placeholder="Awaiting single-room clean"
                  />
                  <button type="submit" className={styles.controlButton} disabled={blockerDraft.trim().length === 0}>
                    Record it
                  </button>
                  {blockerIsActive && (
                    <button
                      type="button"
                      className={styles.controlButton}
                      data-testid="ward-console-blocker-clear"
                      onClick={() =>
                        dispatch({
                          type: "CLEAR_MOVEMENT_BLOCKER",
                          role: "coordinator",
                          now,
                          movementId: movement.id,
                        })
                      }
                    >
                      Clear — nothing is holding this up
                    </button>
                  )}
                </form>
              )}
            </section>

            {/* 3. CONFIRM A DESTINATION */}
            <section className={styles.actionSection}>
              <h3 className={styles.actionSectionTitle}>Confirm a destination</h3>
              <p className={styles.actionSay}>
                Not built yet. Which record a confirmation writes, and in whose name, is a decision the owner still
                holds — so this control is deliberately inert and says so rather than being hidden.
              </p>
              <button
                type="button"
                aria-disabled="true"
                aria-describedby="ward-console-confirm-unavailable"
                title="Confirming a destination is not built yet — coming soon."
                className={styles.controlButton}
                onClick={ignoreUnavailableActivation}
              >
                Review &amp; confirm
              </button>
            </section>

            {/* 4. ORPHANED TRANSPORT JOB */}
            {orphanedJob ? (
              <section className={styles.actionSection} data-testid="ward-patient-orphaned-transport">
                <h3 className={styles.actionSectionTitle}>Transport booked with no bed held</h3>
                <p className={styles.actionSay}>
                  {orphanedJob.kind === "pull_released"
                    ? `The bed this job was booked against has been given back to the ward. ${orphanedJob.provider} is still recorded as collecting this patient, and nothing has told them otherwise. A replacement cannot be booked until this job is cancelled.`
                    : `The recorded stage has been moved back behind the booking. Correcting a stage does not release a bed, so the ward may still be holding one — check with them before cancelling ${orphanedJob.provider}.`}
                </p>
                <p className={styles.actionSay}>
                  {movement.transport?.bookedBy?.role === "ward" && movement.transport.bookedBy.unitId
                    ? `A transport job can be cancelled by the flow coordinator, by the referring emergency department, or by ${unitName(movement.transport.bookedBy.unitId)}, which booked it. No other ward — including the ward receiving this patient — can cancel it themselves.`
                    : movement.transport?.bookedBy?.role === "community" && movement.transport.bookedBy.placeId
                      ? `A transport job can be cancelled by the flow coordinator, by the referring emergency department, or by ${communityTeamById(movement.transport.bookedBy.placeId)?.name ?? "the community team"}, which booked it.`
                      : "A transport job can be cancelled by the flow coordinator or by the referring emergency department. Anyone else, including a ward with no recorded booking, cannot cancel it themselves — they have to ask one of those two."}
                </p>
                <div className={styles.controlRow}>
                  <label className="sr-only" htmlFor="ward-console-cancel-transport-reason">
                    Why is the job being cancelled?
                  </label>
                  <select
                    id="ward-console-cancel-transport-reason"
                    className={styles.controlSelect}
                    data-testid="ward-console-cancel-transport-reason"
                    value={cancelTransportReason ?? ""}
                    onChange={(chosen) => {
                      const value = chosen.target.value;
                      setCancelTransportReason(
                        CANCEL_TRANSPORT_REASONS.includes(value as CancelTransportReason)
                          ? (value as CancelTransportReason)
                          : undefined,
                      );
                    }}
                  >
                    <option value="">Choose a reason…</option>
                    {CANCEL_TRANSPORT_REASONS.map((reason: CancelTransportReason) => (
                      <option key={reason} value={reason}>
                        {changeReasonLabels[reason]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.controlButton}
                    data-testid="ward-console-cancel-transport"
                    aria-disabled={cancelTransportReason === undefined ? "true" : undefined}
                    aria-describedby={
                      cancelTransportReason === undefined ? "ward-console-cancel-transport-blocked" : undefined
                    }
                    title={cancelTransportReason === undefined ? CANCEL_TRANSPORT_UNCHOSEN : undefined}
                    onClick={
                      cancelTransportReason === undefined
                        ? ignoreUnavailableActivation
                        : () => {
                            dispatch({
                              type: "CANCEL_TRANSPORT",
                              role: "coordinator",
                              now,
                              movementId: movement.id,
                              reason: cancelTransportReason,
                            });
                            setCancelTransportReason(undefined);
                          }
                    }
                  >
                    Cancel the transport job
                  </button>
                  {cancelTransportReason === undefined ? (
                    <span id="ward-console-cancel-transport-blocked" className="sr-only">
                      {CANCEL_TRANSPORT_UNCHOSEN}
                    </span>
                  ) : null}
                </div>
              </section>
            ) : null}

            {/* 5. STOP TRANSPORT */}
            {!movement.closure &&
            movement.transport?.collectedAt !== undefined &&
            movement.transport.arrivedAt === undefined &&
            movement.transport.cancelledAt === undefined &&
            movement.transport.diversion === undefined ? (
              <section className={styles.actionSection} data-testid="ward-patient-stop-transport">
                <h3 className={styles.actionSectionTitle}>Stop transport</h3>
                <p className={styles.actionSay}>
                  The patient has already been collected. Stopping the job records where they are now and tells the
                  officer; the bed stays held until it is released.
                </p>
                <div className={styles.controlRow}>
                  <label className="sr-only" htmlFor="ward-console-stop-transport-reason">
                    Why is the journey being stopped?
                  </label>
                  <select
                    id="ward-console-stop-transport-reason"
                    className={styles.controlSelect}
                    data-testid="ward-console-stop-transport-reason"
                    value={stopTransportReason ?? ""}
                    onChange={(chosen) => {
                      const value = chosen.target.value;
                      setStopTransportReason(
                        STOP_TRANSPORT_REASONS.includes(value as StopTransportReason)
                          ? (value as StopTransportReason)
                          : undefined,
                      );
                    }}
                  >
                    <option value="">Choose a reason…</option>
                    {STOP_TRANSPORT_REASONS.map((reason: StopTransportReason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                  <label className="sr-only" htmlFor="ward-console-stop-transport-whereabouts">
                    Where is the patient now?
                  </label>
                  <select
                    id="ward-console-stop-transport-whereabouts"
                    className={styles.controlSelect}
                    data-testid="ward-console-stop-transport-whereabouts"
                    value={stopTransportWhereabouts ?? ""}
                    onChange={(chosen) => {
                      const value = chosen.target.value;
                      setStopTransportWhereabouts(
                        TRANSPORT_WHEREABOUTS.includes(value as TransportWhereabouts)
                          ? (value as TransportWhereabouts)
                          : undefined,
                      );
                    }}
                  >
                    <option value="">Choose a place…</option>
                    {TRANSPORT_WHEREABOUTS.map((place: TransportWhereabouts) => (
                      <option key={place} value={place}>
                        {place}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.controlButton}
                    data-testid="ward-console-stop-transport"
                    aria-disabled={
                      stopTransportReason === undefined || stopTransportWhereabouts === undefined ? "true" : undefined
                    }
                    aria-describedby={
                      stopTransportReason === undefined || stopTransportWhereabouts === undefined
                        ? "ward-console-stop-transport-blocked"
                        : undefined
                    }
                    title={
                      stopTransportReason === undefined || stopTransportWhereabouts === undefined
                        ? "Choose a reason and where the patient is first."
                        : undefined
                    }
                    onClick={
                      stopTransportReason === undefined || stopTransportWhereabouts === undefined
                        ? ignoreUnavailableActivation
                        : () => {
                            dispatch({
                              type: "STOP_TRANSPORT",
                              role: "coordinator",
                              now,
                              movementId: movement.id,
                              reason: stopTransportReason,
                              whereabouts: stopTransportWhereabouts,
                            });
                            setStopTransportReason(undefined);
                            setStopTransportWhereabouts(undefined);
                          }
                    }
                  >
                    Stop transport
                  </button>
                  {stopTransportReason === undefined || stopTransportWhereabouts === undefined ? (
                    <span id="ward-console-stop-transport-blocked" className="sr-only">
                      Choose a reason and where the patient is first.
                    </span>
                  ) : null}
                </div>
              </section>
            ) : null}

            {/* 6. RELEASE HELD BED (AFTER STOP TRANSPORT) */}
            {movement.transport?.stoppedAt !== undefined && movement.admissionId !== undefined ? (
              <section className={styles.actionSection} data-testid="ward-patient-release-held-bed">
                <h3 className={styles.actionSectionTitle}>Release the held bed</h3>
                <p className={styles.actionSay}>
                  Transport for this patient was stopped and the bed is still held. Releasing it gives the bed back to
                  the ward.
                </p>
                <button
                  type="button"
                  className={styles.controlButton}
                  data-testid="ward-console-release-held-bed"
                  onClick={() =>
                    dispatch({
                      type: "RELEASE_HELD_BED",
                      role: "coordinator",
                      now,
                      movementId: movement.id,
                    })
                  }
                >
                  Release the held bed
                </button>
              </section>
            ) : null}

            {/* 7. RECORD DIVERSION */}
            {!movement.closure &&
            movement.transport?.collectedAt !== undefined &&
            movement.transport.arrivedAt === undefined &&
            movement.transport.cancelledAt === undefined &&
            movement.transport.diversion === undefined ? (
              <section className={styles.actionSection} data-testid="ward-patient-record-diversion">
                <h3 className={styles.actionSectionTitle}>Record a diversion</h3>
                <p className={styles.actionSay}>
                  The patient is no longer going to the accepting ward. The bed stays held until it is released.
                </p>
                <div className={styles.controlRow}>
                  <label className="sr-only" htmlFor="ward-console-diversion-reason">
                    Why was the journey diverted?
                  </label>
                  <select
                    id="ward-console-diversion-reason"
                    className={styles.controlSelect}
                    data-testid="ward-console-diversion-reason"
                    value={diversionReason ?? ""}
                    onChange={(chosen) => {
                      const value = chosen.target.value;
                      setDiversionReason(
                        DIVERSION_REASONS.includes(value as DiversionReason) ? (value as DiversionReason) : undefined,
                      );
                    }}
                  >
                    <option value="">Choose a reason…</option>
                    {DIVERSION_REASONS.map((reason: DiversionReason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                  <label className="sr-only" htmlFor="ward-console-diversion-place">
                    Where is the patient now?
                  </label>
                  <select
                    id="ward-console-diversion-place"
                    className={styles.controlSelect}
                    data-testid="ward-console-diversion-place"
                    value={diversionPlace ?? ""}
                    onChange={(chosen) => {
                      const value = chosen.target.value;
                      setDiversionPlace(
                        TRANSPORT_WHEREABOUTS.includes(value as TransportWhereabouts)
                          ? (value as TransportWhereabouts)
                          : undefined,
                      );
                    }}
                  >
                    <option value="">Choose a place…</option>
                    {TRANSPORT_WHEREABOUTS.map((place: TransportWhereabouts) => (
                      <option key={place} value={place}>
                        {place}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.controlButton}
                    data-testid="ward-console-record-diversion"
                    aria-disabled={diversionReason === undefined || diversionPlace === undefined ? "true" : undefined}
                    aria-describedby={
                      diversionReason === undefined || diversionPlace === undefined
                        ? "ward-console-diversion-blocked"
                        : undefined
                    }
                    title={
                      diversionReason === undefined || diversionPlace === undefined
                        ? "Choose a reason and where the patient is first."
                        : undefined
                    }
                    onClick={
                      diversionReason === undefined || diversionPlace === undefined
                        ? ignoreUnavailableActivation
                        : () => {
                            dispatch({
                              type: "RECORD_DIVERSION",
                              role: "coordinator",
                              now,
                              movementId: movement.id,
                              reason: diversionReason,
                              place: diversionPlace,
                            });
                            setDiversionReason(undefined);
                            setDiversionPlace(undefined);
                          }
                    }
                  >
                    Record a diversion
                  </button>
                  {diversionReason === undefined || diversionPlace === undefined ? (
                    <span id="ward-console-diversion-blocked" className="sr-only">
                      Choose a reason and where the patient is first.
                    </span>
                  ) : null}
                </div>
              </section>
            ) : null}

            {/* 8. RELEASE DIVERTED BED */}
            {movement.transport?.diversion !== undefined && movement.admissionId !== undefined ? (
              <section className={styles.actionSection} data-testid="ward-patient-release-diverted-bed">
                <h3 className={styles.actionSectionTitle}>Release the held bed</h3>
                <p className={styles.actionSay}>
                  This patient was diverted and the bed is still held. Releasing it gives the bed back to the ward and
                  ends the journey.
                </p>
                <button
                  type="button"
                  className={styles.controlButton}
                  data-testid="ward-console-release-diverted-bed"
                  onClick={() =>
                    dispatch({
                      type: "RELEASE_DIVERTED_BED",
                      role: "coordinator",
                      now,
                      movementId: movement.id,
                    })
                  }
                >
                  Release the held bed
                </button>
              </section>
            ) : null}

            {/* 9. CORRECTION 1: WITHDRAW ACCEPTANCE */}
            <section className={styles.actionSection} data-testid="ward-patient-withdraw-acceptance">
              <h3 className={styles.actionSectionTitle}>Withdraw the ward&rsquo;s acceptance</h3>
              {!open ? (
                <p className={styles.actionSay}>
                  This movement is no longer running — the panel at the top of the page says why. An acceptance recorded
                  before it stopped stands as part of that record and cannot be withdrawn now.
                </p>
              ) : movement.acceptedUnitId === undefined ? (
                <p className={styles.actionSay}>
                  No ward has accepted this patient, so there is no acceptance to withdraw. If a ward said yes and this
                  page does not show it, that is a missing record rather than something to undo here.
                </p>
              ) : acceptedStageIndex < MOVEMENT_STAGES.indexOf("accepted_awaiting_bed") ? (
                <p className={styles.actionSay}>
                  {destination ? destination.name : "A ward"} accepted this patient and this page still says so, but the
                  recorded stage has been corrected back to {stageCopy[movement.stage].label}. Withdrawing is only
                  offered while the record says Accepted, awaiting bed — put the stage back to that first, or ring the
                  ward.
                </p>
              ) : movement.stage !== "accepted_awaiting_bed" ? (
                <p className={styles.actionSay}>
                  A bed has already been pulled for this patient, and withdrawing an acceptance past that point is not
                  built. It is a larger act — a ward is physically holding a bed, and further along a patient may
                  already be moving — and the owner is still deciding what it should do. Ring the ward.
                </p>
              ) : (
                <>
                  <p className={styles.actionSay}>
                    {destination ? destination.name : "The accepting ward"} said yes and is holding this patient on its
                    list. Withdrawing tells them that no longer stands, and returns this movement to Destination review.
                    It does not re-refer the patient to them — if you want them to consider this patient again, refer
                    again.
                  </p>
                  <div className={styles.controlRow}>
                    <label className="sr-only" htmlFor="ward-console-withdraw-reason">
                      Why is the acceptance being withdrawn?
                    </label>
                    <select
                      id="ward-console-withdraw-reason"
                      className={styles.controlSelect}
                      data-testid="ward-console-withdraw-reason"
                      value={withdrawReason ?? ""}
                      onChange={(chosen) => {
                        const value = chosen.target.value;
                        setWithdrawReason(
                          STEP_BACK_REASONS.includes(value as StepBackReason) ? (value as StepBackReason) : undefined,
                        );
                      }}
                    >
                      <option value="">Choose a reason…</option>
                      {STEP_BACK_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {stepBackReasonLabels[reason]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.controlButton}
                      data-testid="ward-console-withdraw-acceptance"
                      aria-disabled={withdrawReason === undefined ? "true" : undefined}
                      aria-describedby={withdrawReason === undefined ? "ward-console-withdraw-blocked" : undefined}
                      title={withdrawReason === undefined ? WITHDRAW_REASON_UNCHOSEN : undefined}
                      onClick={
                        withdrawReason === undefined
                          ? ignoreUnavailableActivation
                          : () => {
                              dispatch({
                                type: "WITHDRAW_ACCEPTANCE",
                                role: "coordinator",
                                now,
                                movementId: movement.id,
                                reason: withdrawReason,
                              });
                              setWithdrawReason(undefined);
                            }
                      }
                    >
                      Withdraw the acceptance
                    </button>
                    {withdrawReason === undefined ? (
                      <span id="ward-console-withdraw-blocked" className="sr-only">
                        {WITHDRAW_REASON_UNCHOSEN}
                      </span>
                    ) : null}
                  </div>
                </>
              )}
            </section>

            {/* 10. CORRECTION 2: STEP BACK STAGE */}
            <section className={styles.actionSection} data-testid="ward-patient-step-back-stage">
              <h3 className={styles.actionSectionTitle}>Correct the recorded stage</h3>
              {!open ? (
                <p className={styles.actionSay}>
                  This movement is no longer running — the panel at the top of the page says why. Its stage record is
                  closed and cannot be corrected here.
                </p>
              ) : earlierStages.length === 0 ? (
                <p className={styles.actionSay}>
                  This movement is at the first stage, so there is nothing earlier to correct it to.
                </p>
              ) : (
                <>
                  <p className={styles.actionSay}>
                    This corrects what the record says, and nothing else. It does not release a bed, cancel transport or
                    undo a ward&rsquo;s acceptance — use the control above for an acceptance. Use it when the stage on
                    this page is not what actually happened.
                  </p>
                  {movement.admissionId !== undefined ? (
                    <p className={styles.actionSay} data-testid="ward-console-step-back-still-holding">
                      This movement is still holding a ward bed. Correcting the stage leaves that bed held — use{" "}
                      <strong>Release the pulled bed</strong> if the ward should have it back.
                    </p>
                  ) : null}
                  <div className={styles.controlRow}>
                    <label className="sr-only" htmlFor="ward-console-step-back-to">
                      Which stage should the record say?
                    </label>
                    <select
                      id="ward-console-step-back-to"
                      className={styles.controlSelect}
                      data-testid="ward-console-step-back-to"
                      value={stepBackTo ?? ""}
                      onChange={(chosen) => {
                        const value = chosen.target.value;
                        setStepBackTo(
                          earlierStages.includes(value as MovementStage) ? (value as MovementStage) : undefined,
                        );
                      }}
                    >
                      <option value="">Choose a stage…</option>
                      {earlierStages.map((stage) => (
                        <option key={stage} value={stage}>
                          {stageCopy[stage].label}
                        </option>
                      ))}
                    </select>
                    <label className="sr-only" htmlFor="ward-console-step-back-reason">
                      Why is the record being corrected?
                    </label>
                    <select
                      id="ward-console-step-back-reason"
                      className={styles.controlSelect}
                      data-testid="ward-console-step-back-reason"
                      value={stepBackReason ?? ""}
                      onChange={(chosen) => {
                        const value = chosen.target.value;
                        setStepBackReason(
                          STEP_BACK_REASONS.includes(value as StepBackReason) ? (value as StepBackReason) : undefined,
                        );
                      }}
                    >
                      <option value="">Choose a reason…</option>
                      {STEP_BACK_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {stepBackReasonLabels[reason]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.controlButton}
                      data-testid="ward-console-step-back-stage"
                      aria-disabled={stepBackTo === undefined || stepBackReason === undefined ? "true" : undefined}
                      aria-describedby={
                        stepBackTo === undefined || stepBackReason === undefined
                          ? "ward-console-step-back-blocked"
                          : undefined
                      }
                      title={stepBackTo === undefined || stepBackReason === undefined ? STEP_BACK_UNCHOSEN : undefined}
                      onClick={
                        stepBackTo === undefined || stepBackReason === undefined
                          ? ignoreUnavailableActivation
                          : () => {
                              dispatch({
                                type: "STEP_BACK_STAGE",
                                role: "coordinator",
                                now,
                                movementId: movement.id,
                                to: stepBackTo,
                                reason: stepBackReason,
                              });
                              setStepBackTo(undefined);
                              setStepBackReason(undefined);
                            }
                      }
                    >
                      Correct the record
                    </button>
                    {stepBackTo === undefined || stepBackReason === undefined ? (
                      <span id="ward-console-step-back-blocked" className="sr-only">
                        {STEP_BACK_UNCHOSEN}
                      </span>
                    ) : null}
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    );
  }
}

function formReadinessState(legalForm: LegalForm | undefined, now: Instant): string {
  if (!legalForm) return "Not ready — no legal form recorded.";
  if (legalForm.dueAt === undefined) return "Recorded, with no deadline on it.";
  const state = clockState(legalForm.dueAt, now);
  if (state === "breached") return "Recorded, and its deadline has passed. Needs attention says by how much.";
  if (state === "critical" || state === "due") {
    return "Recorded, and its deadline is close. Needs attention says how close.";
  }
  return "Recorded, and its deadline is still ahead.";
}

function transportReadinessState(movement: Movement, open: boolean): string {
  if (!open && movement.transport === undefined) return "Nothing was arranged before this movement closed.";
  if (movement.transport) return "A transport job exists.";
  if (transportNeedState(movement) === "not_needed") return "None is needed, and somebody recorded that.";
  if (transportNeedState(movement) === "needed") return "Needed, and no job has been raised for it yet.";
  return "Nothing recorded either way — neither a job nor an answer about whether one is wanted.";
}

function blockerReadinessState(movement: Movement, open: boolean, blockerIsActive: boolean): string {
  if (!open) {
    if (blockerIsActive) {
      return "A note was recorded before this movement closed. Nothing is holding it up now, because nothing is moving.";
    }
    if (movement.blocker === "None — cleared") {
      return "Somebody recorded a blocker and cleared it before this movement closed.";
    }
    if (movement.blocker === "None — in transit") {
      return "Nothing was holding this up: the patient was in transit when it closed.";
    }
    if (movement.blocker === "None — handover complete") {
      return "Nothing was holding this up: handover was complete.";
    }
    if (movement.blocker === "None — the movement did not proceed") {
      return "Nothing was holding this up: the movement did not proceed.";
    }
    return "Nothing was recorded as holding this up.";
  }
  if (blockerIsActive) return "Somebody has recorded, by hand, something that is holding this up.";
  if (movement.blocker === "None — cleared") {
    return "Somebody recorded a blocker and then cleared it. Nothing is holding this up now.";
  }
  if (movement.blocker === "None — in transit") return "Nothing is holding this up: the patient is in transit.";
  if (movement.blocker === "None — handover complete") return "Nothing is holding this up: handover is complete.";
  if (movement.blocker === "None — the movement did not proceed") {
    return "Nothing is holding this up: the movement did not proceed.";
  }
  return "Nobody has recorded anything as holding this up.";
}

function transportNeedSentence(movement: Movement, now: Instant): string {
  const state = transportNeedState(movement);
  if (state === "needed") {
    return `Yes — recorded as needed${movement.transportNeed ? ` at ${formatInstantWithDay(movement.transportNeed.at, now)}` : ""}.`;
  }
  if (state === "not_needed")
    return "No — somebody recorded that this patient needs no transport. That is an answer, not a gap.";
  return "Nobody has recorded an answer either way. This is not the same as deciding transport is not needed.";
}

function transportReadinessLine(movement: Movement, open: boolean): string {
  if (!open && movement.closure && movement.transport === undefined) {
    return "No transport was arranged before this movement closed";
  }
  if (movement.transport) return transportStatusLabel(movement.transport);
  if (transportNeedState(movement) === "not_needed") return "No job has been raised, and none is wanted.";
  if (transportNeedState(movement) === "needed") return "No job has been raised for it yet.";
  return "No job has been raised.";
}
