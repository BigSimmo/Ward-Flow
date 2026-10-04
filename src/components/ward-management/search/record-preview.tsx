"use client";

import { useEffect, useState } from "react";
import { formTitleForCode } from "@/lib/form-register";
import Link from "next/link";

import {
  elapsedLabel,
  isOpen,
  referralForMovement,
  stageCopy,
  transportStatusLabel,
} from "@/components/ward-management/ward-derivations";
import { MOVEMENT_STAGES } from "@/components/ward-management/ward-model";
import type { Movement, Referral, ReferralState, Unit } from "@/components/ward-management/ward-model";
import {
  declinedAddressings,
  referralState,
  referralDestinationLabel,
  referralAddressingStateLabel,
} from "@/components/ward-management/ward-referrals";
import { patientDisplayName, patientAgeYears, type Patient } from "@/components/ward-management/ward-patients";
import { calendarDateOf, demoDayZero, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { departmentLabel } from "@/components/ward-management/ward-absence-labels";
import { edById } from "@/components/ward-management/ward-sites";
import { withSendingTeam } from "@/components/ward-management/referrals/referral-sending-team";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { LONG_WAIT_MINUTES, LONG_WAIT_TEXT } from "@/components/ward-management/ward-operational-defaults";
import { waitedHours } from "./search-filters";

import styles from "./record-preview.module.css";
import searchStyles from "./search.module.css";

const NOT_RECORDED = "Not recorded";

export type PreviewSelection =
  | { kind: "person"; patient: Patient }
  | { kind: "movement"; movement: Movement }
  | { kind: "referral"; referral: Referral };

export type MovementSummary = {
  id: string;
  stageLabel: string;
  departmentText: string;
  destinationCell: string;
  elapsedText: string;
};

function originDepartmentText(movement: Movement): string {
  const originEd = edById(movement.originEdId);
  return departmentLabel(movement.originEdId, originEd && `${originEd.name} (${originEd.siteCode})`);
}

export function buildMovementSummary(movement: Movement, units: Unit[], now: number): MovementSummary {
  const destination = movement.acceptedUnitId
    ? units.find((candidate) => candidate.id === movement.acceptedUnitId)
    : undefined;
  const askedNames = movement.referredUnitIds
    .map((id) => units.find((candidate) => candidate.id === id)?.name)
    .filter((name): name is string => name !== undefined);
  const destinationCell = destination
    ? destination.name
    : movement.referredUnitIds.length > 0
      ? `${movement.referredUnitIds.length} ward${movement.referredUnitIds.length === 1 ? "" : "s"} asked, none has accepted${askedNames.length > 0 ? ` — ${askedNames.join(", ")}` : ""}`
      : "No destination chosen";
  return {
    id: movement.id,
    stageLabel: stageCopy[movement.stage].label,
    departmentText: originDepartmentText(movement),
    destinationCell,
    elapsedText: elapsedLabel(movement, now),
  };
}

export type ReferralSummary = {
  id: string;
  originLine: string;
  declineNote: string;
};

export function buildReferralSummary(referral: Referral): ReferralSummary {
  const declinedCount = declinedAddressings(referral).length;
  const totalCount = referral.destinations.length;
  const state = referralState(referral);
  let declineNote: string;
  if (state === "accepted") {
    declineNote =
      declinedCount > 0
        ? `${declinedCount} of ${totalCount} destination${totalCount === 1 ? "" : "s"} declined before another destination accepted.`
        : "no destination declined before acceptance.";
  } else if (state === "declined") {
    declineNote = `${declinedCount} of ${totalCount} destination${totalCount === 1 ? "" : "s"} declined; no destination accepted.`;
  } else {
    declineNote =
      declinedCount > 0
        ? `${declinedCount} of ${totalCount} destination${totalCount === 1 ? "" : "s"} already declined; no destination has accepted yet.`
        : "waiting for a decision; no destination has accepted yet.";
  }
  return {
    id: referral.id,
    originLine: withSendingTeam(
      `Referral from ${referral.originSiteCode} · ${referral.ageBand} · ${referral.homeRegion}`,
      referral,
    ),
    declineNote,
  };
}

function referralStateSentence(state: ReferralState): string {
  switch (state) {
    case "accepted":
      return "Accepted — a destination has agreed.";
    case "declined":
      return "Declined — every destination said no.";
    case "queued":
      return "Queued — still waiting for a decision.";
  }
}

function linkedReferralFor(patient: Patient, referrals: Referral[]): Referral | undefined {
  return referrals.find((candidate) => candidate.patientId === patient.id);
}

function linkedOpenMovementFor(referral: Referral, movements: Movement[]): Movement | undefined {
  const candidate = movements.find((movement) => movement.referralId === referral.id);
  return candidate && isOpen(candidate) ? candidate : undefined;
}

/**
 * What a recorded legal form IS, taken from the Chief Psychiatrist's register, and NOTHING about
 * what it authorises or how long it has left.
 *
 * 🔴 THIS FUNCTION USED TO INVENT ALL THREE, AND ONE OF THEM WAS CLINICALLY WRONG. Until
 * 2026-09-18 it returned, hard-coded:
 *
 *   Form 1A -> "Mandatory 24h statutory window for authorised assessment", "18h remaining"
 *   Form 4A -> "Authorises apprehension and conveyancing to authorised place", "42h remaining"
 *   Form 5A -> "Involuntary inpatient treatment order",
 *              "Schedule 1 Authorised Hospital admission authorised", "5 days remaining"
 *
 * rendered under a field labelled "Statutory Authority".
 *
 * 🔴 **FORM 5A IS A COMMUNITY TREATMENT ORDER.** `src/lib/form-register.ts` titles 5A "Community
 * Treatment Order" and 6A "Inpatient treatment order in authorised hospital". The preview was
 * putting 6A's MEANING on 5A's CODE — telling a coordinator that a person living in the community
 * under conditions was detained in hospital. Those two orders carry different legal authority over
 * the same patient, and the screen asserted the wrong one with a countdown beside it.
 *
 * ⚠️ THE SAME MISTAKE, THE SAME DIRECTION, FOR THE THIRD TIME IN THIS CODEBASE.
 * `tests/ward-form-labels-from-register.test.ts` exists because `patient-now-records.ts` once
 * carried "Form 3B, inpatient treatment order"; `search-filters.ts` records fixing "Form 5A
 * (Involuntary)" on 2026-09-14 and notes that Ward Flow cannot record a 5A at all. This file was
 * missed both times. That is why the title is now READ FROM THE REGISTER rather than typed here:
 * a hand-copied clinical title is a thing that drifts, and this one drifted into a different order.
 *
 * ⚠️ AND THE DURATIONS WERE INVENTED, WHICH THE OWNER RULED AGAINST DIRECTLY (18 Sept): the app
 * works out no limits itself — a clinician types the expiry written on the form. "18h remaining"
 * was not read from anything; nor was the claim that a form "authorises apprehension".
 */
function legalStatutoryInfo(legalStatus: string) {
  const code = legalStatus.replace(/^Form\s+/i, "").trim();
  const registerTitle = formTitleForCode(code);
  if (registerTitle) {
    return {
      title: registerTitle,
      req: "Recorded on this patient. This prototype does not hold what the form authorises.",
      countdown: "Expiry not recorded",
    };
  }
  // Any status without a form. The record holds the status and nothing about its authority: a
  // "Voluntary admission agreement" with "Consent verified", and a completed statutory discharge,
  // used to be typed in here (25 September 2026 audit, A5).
  return {
    title: "No legal form recorded",
    req: NOT_RECORDED,
    countdown: /^Voluntary/i.test(legalStatus) ? "Voluntary status" : "Expiry not recorded",
  };
}

/** A movement's own legal record: its form when one is recorded, otherwise its status. */
function movementLegalStatus(movement: Movement): string {
  return movement.legalForm ? `Form ${movement.legalForm.code}` : movement.legalStatus;
}

/** The legal pill's colour. Only a voluntary status wears the voluntary colour. */
function legalClassFor(legalStatus: string): string {
  if (legalStatus === "Form 1A") return styles.form1a;
  if (legalStatus === "Form 4A") return styles.form4a;
  if (legalStatus === "Form 5A") return styles.form5a;
  return /^Voluntary/i.test(legalStatus) ? styles.voluntary : "";
}

function ageText(patient: Patient | undefined, today: Date): string {
  const years = patient ? patientAgeYears(patient, today) : Number.NaN;
  return Number.isFinite(years) && years >= 0 ? `${years} years` : "Age not recorded";
}

type ClinicalHistory = {
  priorAdmissions: string;
  lastDischarge: string;
  communityKeyWorker: string;
  knownRiskProfile: string;
};

/**
 * Ward Flow records no admission history and no risk profile. Prior admissions, a last discharge
 * ("18 days ago · RPH Ward 8") and a risk protocol used to be typed in here by presence and by
 * seeded surname (25 September 2026 audit, A5). The community team is the one fact the record may
 * hold.
 */
function deriveClinicalHistory(patient?: Patient): ClinicalHistory {
  return {
    priorAdmissions: "Not recorded in Ward Flow",
    lastDischarge: "Not recorded in Ward Flow",
    communityKeyWorker: patient?.catchmentCommunityTeam ?? NOT_RECORDED,
    knownRiskProfile: "Not recorded in Ward Flow",
  };
}

const NO_CLINICAL_NOTE = "No clinical note is recorded in Ward Flow.";

export function RecordPreview({
  selection,
  referrals,
  movements,
  patients,
  units,
  now,
  dayZero,
  onClose,
}: {
  selection: PreviewSelection | null;
  referrals: Referral[];
  movements: Movement[];
  patients: Patient[];
  units: Unit[];
  now: number;
  dayZero?: Date;
  onClose: () => void;
}) {
  const activeDayZero = dayZero ?? demoDayZero(new Date());
  const activeDate = calendarDateOf(now, activeDayZero);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const [actionNotice, setActionNotice] = useState<string | null>(null);
  // Clear the notice when the selection changes. Adjusting state during render (React's documented
  // pattern for resetting state on a prop change) avoids the extra effect-driven render.
  const [noticeSelection, setNoticeSelection] = useState(selection);
  if (noticeSelection !== selection) {
    setNoticeSelection(selection);
    setActionNotice(null);
  }

  if (selection === null) {
    return (
      <WardPanel title="Selected person" testId="ward-patient-search-preview" headingLevel={2}>
        <p className={styles.idle} data-testid="ward-patient-search-preview-idle">
          Select a person or an open movement below to preview their record here — the list stays on screen.
        </p>
      </WardPanel>
    );
  }

  if (selection.kind === "person") {
    const { patient } = selection;
    const referral = linkedReferralFor(patient, referrals);
    const referralSummary = referral ? buildReferralSummary(referral) : null;
    const linkedMovement = referral ? linkedOpenMovementFor(referral, movements) : undefined;
    const movementSummary = linkedMovement ? buildMovementSummary(linkedMovement, units, now) : null;
    const movementStageIndex = linkedMovement ? MOVEMENT_STAGES.indexOf(linkedMovement.stage) : -1;

    // Presence and Dossier derivations
    // With no open movement and no referral the record says nothing about where the person is or
    // what is planned, so this default says so. "NOT IN HOSPITAL · COMMUNITY OUTPATIENT", an
    // outpatient stage and "Tier 3" used to be assumed here (25 September 2026 audit, A5).
    let presenceStatus: "live" | "community" = "community";
    let bannerTitle = "NO OPEN MOVEMENT OR REFERRAL";
    let bannerTag = "No open episode";
    let waitTimeHours = 0;
    let disposition = NOT_RECORDED;
    let targetWard = "No ward requested";
    let currentStage = "No open movement";
    let transportStatus = NOT_RECORDED;
    let nurseEscort = false;
    let originSite = patient.catchmentCommunityTeam ?? NOT_RECORDED;
    let legalStatus = patient.legalStatus ?? NOT_RECORDED;
    let urgency = NOT_RECORDED;
    let recordOpenedAt: number | undefined = referral?.raisedAt;

    if (linkedMovement && movementSummary) {
      presenceStatus = "live";
      bannerTitle = "CURRENTLY LIVE IN HOSPITAL";
      bannerTag = movementSummary.departmentText.includes("ED")
        ? "Emergency Dept"
        : linkedMovement.stage === "moving"
          ? "In-Transit"
          : "Inpatient Ward";
      waitTimeHours = waitedHours(linkedMovement, now);
      disposition =
        linkedMovement.stage === "moving"
          ? "In-Transit"
          : linkedMovement.acceptedUnitId
            ? "Bed hold active"
            : "Unplaced";
      targetWard = movementSummary.destinationCell;
      currentStage = movementSummary.stageLabel;
      transportStatus = transportStatusLabel(linkedMovement.transport);
      nurseEscort = "escort" in linkedMovement && linkedMovement.escort !== undefined;
      originSite = movementSummary.departmentText;
      legalStatus = movementLegalStatus(linkedMovement);
      urgency = `Tier ${linkedMovement.urgency}`;
      recordOpenedAt = linkedMovement.openedAt;
    } else if (referral) {
      const isComm =
        referral.originSiteCode.includes("CMHT") ||
        referral.originSiteCode.includes("Clinic") ||
        (referral.homeRegion as unknown as string) === "Community";
      if (isComm) {
        presenceStatus = "community";
        bannerTitle = "NOT IN HOSPITAL · COMMUNITY OUTPATIENT";
        bannerTag = "Community Case";
        disposition = "Community management";
        targetWard = "Not admitted";
        currentStage = "Outpatient";
        originSite = referral.originSiteCode;
        urgency = `Tier ${referral.urgency}`;
      } else {
        presenceStatus = "live";
        bannerTitle = "CURRENTLY LIVE IN HOSPITAL";
        bannerTag = "Emergency Dept";
        waitTimeHours = Math.max(0, (now - referral.raisedAt) / 60);
        disposition = "Unplaced";
        targetWard = "Pending allocation";
        currentStage = "Referred";
        originSite = `${referral.originSiteCode} ED`;
        urgency = `Tier ${referral.urgency}`;
      }
    }

    const isBreaching = waitTimeHours * 60 >= LONG_WAIT_MINUTES;
    const statutory = legalStatutoryInfo(legalStatus);
    const displayName = patientDisplayName(patient);
    const history = deriveClinicalHistory(patient);
    const referralHref = `/mockups/ward-flow/referrals/new?patientId=${encodeURIComponent(patient.id)}`;
    const legalClass = legalClassFor(legalStatus);

    let tierClass = styles.tier3;
    if (urgency === "Tier 1") tierClass = styles.tier1;
    else if (urgency === "Tier 2") tierClass = styles.tier2;
    else if (urgency === "Discharged") tierClass = styles.discharged;

    return (
      <WardPanel title="Selected person" testId="ward-patient-search-preview" headingLevel={2}>
        <div className={styles.body}>
          {/* Close Action */}
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            data-testid="ward-patient-search-preview-close"
          >
            Close preview
          </button>

          {/* 1. Sovereign Presence State Banner */}
          <div className={`${styles.presenceBannerCard} ${styles[presenceStatus]}`}>
            <div className={styles.presenceBannerLeft}>
              <span className={`${styles.presenceDot} ${styles[presenceStatus]}`} />
              <strong>{bannerTitle}</strong>
            </div>
            <span className={styles.presenceSettingTag}>{bannerTag}</span>
          </div>

          {/* 2. Patient Identity & Core Status Badges */}
          <div className={styles.dossierHeader}>
            <div className={styles.dossierTitleRow}>
              <h3 className={styles.dossierName}>{displayName}</h3>
              <span className={styles.dossierUrm}>{patient.umrn}</span>
            </div>
            <div className={styles.dossierMetaRow}>
              <span className={styles.metaDemographics}>
                {ageText(patient, activeDate)} · born {patient.dateOfBirth} · {patient.sex ?? "Sex unrecorded"}
              </span>
              {patient.aboriginalOrTorresStraitIslanderStatus ? (
                <span className={styles.atsiPill}>Aboriginal (ATSI)</span>
              ) : null}
              <span className={styles.metaDivider}>·</span>
              <span className={styles.metaService}>{patient.catchmentCommunityTeam ?? NOT_RECORDED}</span>
            </div>
            <div className={styles.dossierStatusStrip}>
              <span className={`${styles.tierBadge} ${tierClass}`}>{urgency}</span>
              <span className={`${styles.statusPill} ${legalClass}`}>{legalStatus}</span>
              <span className={styles.dispositionBadge}>{disposition}</span>
            </div>
            <div className={styles.dossierActions}>
              <Link className={styles.openLink} href={`/mockups/ward-flow/people/${patient.id}`}>
                Open full record
              </Link>
              <Link
                className={styles.referLink}
                href={`/mockups/ward-flow/referrals/new?patientId=${patient.id}`}
                data-testid="ward-patient-preview-raise-referral"
              >
                Raise referral for this patient &rarr;
              </Link>
            </div>
          </div>

          {/* 3. Statutory Legal Authority Card (recorded forms) */}
          <div className={styles.statutoryCard}>
            <div className={styles.statutoryHead}>
              <span className={styles.statutoryTitle}>
                {legalStatus} · {statutory.title}
              </span>
              <span className={styles.statutoryCountdown}>{statutory.countdown}</span>
            </div>
            <div className={styles.statutoryDetailsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statItemLabel}>Recorded form</span>
                <span className={styles.statItemValue}>{statutory.req}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statItemLabel}>Hospital Wait Time</span>
                <span className={styles.statItemValue} style={{ fontWeight: 600, color: "var(--ink)" }}>
                  {waitTimeHours > 0 ? `${waitTimeHours.toFixed(1)}h` : "None (Not admitted)"}{" "}
                  {isBreaching ? `(waiting ${LONG_WAIT_TEXT})` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Placement & Movement Trajectory */}
          <div className={styles.dossierSection}>
            <span className={styles.sectionTitle}>Placement & Movement Trajectory</span>
            <div className={styles.trajectoryGrid}>
              <div className={styles.trajBox}>
                <span className={styles.trajLabel}>Originating Site</span>
                <span className={styles.trajValue}>{originSite}</span>
              </div>
              <div className={styles.trajBox}>
                <span className={styles.trajLabel}>Target Ward / Unit</span>
                <span className={`${styles.trajValue} ${styles.strong}`}>{targetWard}</span>
              </div>
              <div className={styles.trajBox}>
                <span className={styles.trajLabel}>Current Stage</span>
                <span className={styles.trajValue}>{currentStage}</span>
              </div>
              <div className={styles.trajBox}>
                <span className={styles.trajLabel}>Conveyance & Escort</span>
                <span className={styles.trajValue}>
                  {transportStatus}
                  {nurseEscort ? " · Nurse escort" : ""}
                </span>
              </div>
            </div>

            {/* Preserved Referral & Movement Ties with exact testids */}
            <section className={styles.tieSection} data-testid="ward-patient-search-preview-referral">
              <h4 className={styles.tieHeading}>Referral</h4>
              {referral && referralSummary ? (
                <p className={styles.tieBody}>
                  <strong>{referralSummary.id}</strong> — {referralStateSentence(referralState(referral))}
                  <br />
                  {referralSummary.originLine} — {referralSummary.declineNote}
                </p>
              ) : (
                <p className={styles.tieEmpty}>No referral is linked to this record.</p>
              )}
            </section>

            <section className={styles.tieSection} data-testid="ward-patient-search-preview-movement">
              <h4 className={styles.tieHeading}>Movement</h4>
              {movementSummary && linkedMovement ? (
                <>
                  <div
                    className={searchStyles.stepper}
                    role="img"
                    aria-label={`Stage ${movementStageIndex + 1} of ${MOVEMENT_STAGES.length}: ${movementSummary.stageLabel}`}
                    data-testid="ward-patient-search-preview-stepper"
                  >
                    {MOVEMENT_STAGES.map((stageId, index) => (
                      <span
                        key={stageId}
                        className={searchStyles.stageBar}
                        data-s={index < movementStageIndex ? "done" : index === movementStageIndex ? "now" : "todo"}
                      />
                    ))}
                  </div>
                  <p className={searchStyles.stageLine}>
                    <strong>{movementSummary.stageLabel}</strong>
                    <span>
                      {" "}
                      · Stage {movementStageIndex + 1} of {MOVEMENT_STAGES.length}
                    </span>
                  </p>
                  <p className={styles.tieBody}>
                    {movementSummary.departmentText} · {movementSummary.destinationCell} · {movementSummary.elapsedText}
                  </p>
                  <Link
                    className={searchStyles.primaryAction}
                    href={`/mockups/ward-flow/movements/${linkedMovement.id}`}
                  >
                    {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                    Open this movement
                  </Link>
                </>
              ) : referral ? (
                <p className={styles.tieEmpty}>
                  No open movement is linked to this referral. No current movement, so no stage is shown.
                </p>
              ) : (
                <p className={styles.tieEmpty}>
                  No referral is linked, so no movement can be, either. No current movement, so no stage is shown.
                </p>
              )}
            </section>
          </div>

          {/* 5. Clinical Presentation & Care Summary */}
          <div className={styles.dossierSection}>
            <span className={styles.sectionTitle}>Clinical Presentation & Care Summary</span>
            <div className={styles.clinicalNoteCard}>{NO_CLINICAL_NOTE}</div>
          </div>

          {/* Previous Presentations & History (Image 4) */}
          <div className={styles.dossierSection}>
            <span className={styles.sectionTitle}>Previous Presentations & History</span>
            <div className={styles.historyCard}>
              <div className={styles.historyGrid}>
                <div className={styles.historyItem}>
                  <span className={styles.historyLabel}>Prior Admissions (12m)</span>
                  <span className={styles.historyVal}>{history.priorAdmissions}</span>
                </div>
                <div className={styles.historyItem}>
                  <span className={styles.historyLabel}>Last Discharge</span>
                  <span className={styles.historyVal}>{history.lastDischarge}</span>
                </div>
                <div className={styles.historyItem}>
                  <span className={styles.historyLabel}>Community Key Worker</span>
                  <span className={styles.historyVal}>{history.communityKeyWorker}</span>
                </div>
                <div className={styles.historyItem}>
                  <span className={styles.historyLabel}>Known Risk / Protocol</span>
                  <span className={styles.historyVal}>{history.knownRiskProfile}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 6. Clinical Audit Milestones (Connected Vertical Timeline) */}
          <div className={styles.dossierSection}>
            <span className={styles.sectionTitle}>Audit Milestones</span>
            {/* Only the time the record itself opened. Two further entries at fixed times ("10:42
                Operational state verified by Bed Coordinator", "08:15 Transport logistics update") and
                a fixed 06:30 on this one used to be typed in (25 September 2026 audit, A5). */}
            <div className={styles.milestoneTimeline}>
              <div className={styles.timelineNode}>
                <span className={styles.timelineNodeBullet} aria-hidden="true" />
                <div className={styles.timelineTimeRow}>
                  <span className={styles.timelineMonoTime}>
                    {recordOpenedAt === undefined ? NOT_RECORDED : `${formatInstantWithDay(recordOpenedAt, now)} AWST`}
                  </span>
                </div>
                <span className={styles.timelineEventText}>Record active from origin site ({originSite})</span>
              </div>
            </div>
          </div>

          {/* D4 Inline Notice Banner */}
          {actionNotice && (
            <div className={styles.d4Notice} role="status">
              <span>{actionNotice}</span>
              <button
                type="button"
                className={styles.d4NoticeDismiss}
                onClick={() => setActionNotice(null)}
                aria-label="Dismiss notice"
              >
                ✕
              </button>
            </div>
          )}

          {/* 7. Coordinator Action Bar */}
          <div className={styles.dossierActionBar}>
            {presenceStatus === "live" ? (
              <>
                {linkedMovement ? (
                  <Link href={`/mockups/ward-flow/movements/${linkedMovement.id}`} className={styles.btnPrimary}>
                    <span>View Movement</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                ) : (
                  <Link
                    href={referralHref}
                    className={styles.btnPrimary}
                    data-testid="ward-patient-preview-request-bed"
                  >
                    <span>Request Bed</span>
                  </Link>
                )}
                <button
                  type="button"
                  className={styles.btnSecondary}
                  title="Bed allocation is not recorded from this preview."
                  onClick={() => setActionNotice("Bed allocation is not recorded from this preview.")}
                >
                  Bed Allocation
                </button>
                {linkedMovement ? (
                  <Link
                    href={`/mockups/ward-flow/movements/${linkedMovement.id}`}
                    className={styles.btnSecondary}
                    data-testid="ward-patient-preview-transport-order"
                  >
                    Transport Order
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    title="No movement is linked, so transport cannot be booked."
                    onClick={() =>
                      setActionNotice("Transport is not recorded yet — open a movement to book transport.")
                    }
                  >
                    Transport Order
                  </button>
                )}
              </>
            ) : (
              <>
                <Link
                  href={referralHref}
                  className={styles.btnPrimary}
                  data-testid="ward-patient-preview-create-referral"
                >
                  Create Referral
                </Link>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  title="Past admission history is not recorded in this prototype."
                  onClick={() => setActionNotice("Past admission history is not recorded yet.")}
                >
                  Past Admissions
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  title="Contact logging is not recorded from this preview."
                  onClick={() => setActionNotice("Contact with the team is not recorded yet.")}
                >
                  Contact Team
                </button>
              </>
            )}
          </div>
        </div>
      </WardPanel>
    );
  }

  if (selection.kind === "referral") {
    const { referral } = selection;
    const summary = buildReferralSummary(referral);
    const linkedPatient =
      referral.patientId !== undefined ? patients.find((candidate) => candidate.id === referral.patientId) : undefined;
    const linkedMovement = linkedOpenMovementFor(referral, movements);

    const isComm =
      referral.originSiteCode.includes("CMHT") ||
      referral.originSiteCode.includes("Clinic") ||
      (referral.homeRegion as unknown as string) === "Community";
    const presenceStatus = isComm ? "community" : "live";
    const bannerTitle = isComm ? "NOT IN HOSPITAL · COMMUNITY REFERRAL" : "QUEUED REFERRAL · AWAITING ACCEPTANCE";
    const bannerTag = isComm ? "Community Referral" : "Acute Referral";
    const subjectName = linkedPatient ? patientDisplayName(linkedPatient) : `Referral ${referral.id}`;
    const subjectSubtitle = linkedPatient
      ? `${linkedPatient.umrn} · ${ageText(linkedPatient, activeDate)} · ${linkedPatient.sex ?? "Sex unrecorded"} · DOB ${linkedPatient.dateOfBirth}`
      : `Queued referral · Age cohort: ${referral.ageBand}`;

    return (
      <WardPanel title={`Selected referral: ${subjectName}`} testId="ward-patient-search-preview" headingLevel={2}>
        <div className={styles.previewDossier}>
          {/* Dossier Header */}
          <div className={styles.dossierHeader}>
            <div className={styles.dossierIdentity}>
              <div className={styles.dossierSubject}>{subjectName}</div>
              <div className={styles.dossierSubtitle}>{subjectSubtitle}</div>
            </div>
            <button
              type="button"
              className={styles.closeDossierBtn}
              onClick={onClose}
              aria-label="Close dossier preview"
              title="Close (Esc)"
            >
              Close
            </button>
          </div>

          {/* 1. Presence Status Banner */}
          <div className={`${styles.presenceBanner} ${styles[presenceStatus]}`}>
            <span className={styles.presenceBannerTitle}>{bannerTitle}</span>
            <span className={styles.presenceBannerTag}>{bannerTag}</span>
          </div>

          {/* 2. Quick Clinical Metrics Strip */}
          <div className={styles.quickMetricsStrip}>
            <div className={styles.quickMetricCard}>
              <span className={styles.metricLabel}>Origin Site</span>
              <span className={styles.metricVal}>{referral.originSiteCode}</span>
            </div>
            <div className={styles.quickMetricCard}>
              <span className={styles.metricLabel}>Home Region</span>
              <span className={styles.metricVal}>{referral.homeRegion}</span>
            </div>
            <div className={styles.quickMetricCard}>
              <span className={styles.metricLabel}>Age Cohort</span>
              <span className={styles.metricVal}>{referral.ageBand}</span>
            </div>
            <div className={styles.quickMetricCard}>
              <span className={styles.metricLabel}>Destinations</span>
              <span className={styles.metricVal}>{referral.destinations.length}</span>
            </div>
          </div>

          {/* 3. Destinations Addressed */}
          <div className={styles.dossierSection}>
            <span className={styles.sectionTitle}>Destinations Addressed</span>
            <p className={styles.statutoryReq}>{summary.declineNote}</p>
            <ul className={styles.timeline}>
              {referral.destinations.map((dest, idx) => {
                const destLabel = referralDestinationLabel(dest.destination);
                const stateLabel = referralAddressingStateLabel(dest);
                return (
                  <li key={idx} className={styles.timelineItem}>
                    <strong>{destLabel}</strong>: {stateLabel}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* 4. Linked Person Tie */}
          <div className={styles.dossierSection}>
            <span className={styles.sectionTitle}>Linked Person</span>
            {linkedPatient ? (
              <p className={styles.tieLink}>
                <Link href={`/mockups/ward-flow/people/${linkedPatient.id}`}>
                  {patientDisplayName(linkedPatient)} ({linkedPatient.umrn})
                </Link>{" "}
                — open person record
              </p>
            ) : (
              <p className={styles.tieEmpty}>No person record is linked to this referral.</p>
            )}
          </div>

          {/* 5. Linked Movement Tie */}
          {linkedMovement && (
            <div className={styles.dossierSection}>
              <span className={styles.sectionTitle}>Linked Movement</span>
              {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
              <p className={styles.tieLink}>
                <Link href={`/mockups/ward-flow/movements/${linkedMovement.id}`}>{subjectName}</Link> — open movement
                record
              </p>
            </div>
          )}

          {/* Previous Presentations & History (Image 4) */}
          <div className={styles.dossierSection}>
            <span className={styles.sectionTitle}>Previous Presentations & History</span>
            <div className={styles.historyCard}>
              <div className={styles.historyGrid}>
                <div className={styles.historyItem}>
                  <span className={styles.historyLabel}>Prior Admissions (12m)</span>
                  <span className={styles.historyVal}>{deriveClinicalHistory(linkedPatient).priorAdmissions}</span>
                </div>
                <div className={styles.historyItem}>
                  <span className={styles.historyLabel}>Last Discharge</span>
                  <span className={styles.historyVal}>{deriveClinicalHistory(linkedPatient).lastDischarge}</span>
                </div>
                <div className={styles.historyItem}>
                  <span className={styles.historyLabel}>Community Key Worker</span>
                  <span className={styles.historyVal}>{deriveClinicalHistory(linkedPatient).communityKeyWorker}</span>
                </div>
                <div className={styles.historyItem}>
                  <span className={styles.historyLabel}>Known Risk / Protocol</span>
                  <span className={styles.historyVal}>{deriveClinicalHistory(linkedPatient).knownRiskProfile}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Milestones (Connected Vertical Timeline) */}
          <div className={styles.dossierSection}>
            <span className={styles.sectionTitle}>Audit Milestones</span>
            {/* Only the time the referral was raised; see the matching note in the person preview. */}
            <div className={styles.milestoneTimeline}>
              <div className={styles.timelineNode}>
                <span className={styles.timelineNodeBullet} aria-hidden="true" />
                <div className={styles.timelineTimeRow}>
                  <span className={styles.timelineMonoTime}>{formatInstantWithDay(referral.raisedAt, now)} AWST</span>
                </div>
                <span className={styles.timelineEventText}>
                  Record active from origin site ({referral.originSiteCode})
                </span>
              </div>
            </div>
          </div>

          {/* D4 Inline Notice Banner */}
          {actionNotice && (
            <div className={styles.d4Notice} role="status">
              <span>{actionNotice}</span>
              <button
                type="button"
                className={styles.d4NoticeDismiss}
                onClick={() => setActionNotice(null)}
                aria-label="Dismiss notice"
              >
                ✕
              </button>
            </div>
          )}

          {/* 6. Coordinator Action Bar */}
          <div className={styles.dossierActionBar}>
            <Link href="/mockups/ward-flow/referrals" className={styles.btnPrimary}>
              <span>Intake Board</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
            <button
              type="button"
              className={styles.btnSecondary}
              title="Not wired in this prototype."
              onClick={() => setActionNotice("Contact Referrer: Not wired in this prototype.")}
            >
              Contact Referrer
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              title="Not wired in this prototype."
              onClick={() => setActionNotice("Cancel Referral: Not wired in this prototype.")}
            >
              Cancel Referral
            </button>
          </div>
        </div>
      </WardPanel>
    );
  }

  // selection.kind === "movement"
  const { movement } = selection;
  const summary = buildMovementSummary(movement, units, now);
  const referral = referralForMovement(movement, referrals);
  const linkedPatient = resolveSubjectPatient(movement, { patients, referrals, movements }).patient;

  const presenceStatus: "live" | "past" = isOpen(movement) ? "live" : "past";
  const bannerTitle = isOpen(movement) ? "CURRENTLY LIVE IN HOSPITAL" : "PAST PATIENT · HISTORICAL RECORD";
  const bannerTag =
    movement.stage === "moving"
      ? "In-Transit"
      : summary.departmentText.includes("ED")
        ? "Emergency Dept"
        : "Inpatient Ward";
  const waitTimeHours = waitedHours(movement, now);
  const isBreaching = waitTimeHours * 60 >= LONG_WAIT_MINUTES;
  const disposition =
    movement.stage === "moving" ? "In-Transit" : movement.acceptedUnitId ? "Bed hold active" : "Unplaced";
  const targetWard = summary.destinationCell;
  const currentStage = summary.stageLabel;
  const transportStatus = transportStatusLabel(movement.transport);
  const nurseEscort = "escort" in movement && movement.escort !== undefined;
  const originSite = summary.departmentText;
  // The movement's own legal record and urgency. A default "Form 1A", a fixed "Tier 1" and an age
  // of 38 used to stand in here (25 September 2026 audit, A5).
  const legalStatus = movementLegalStatus(movement);
  const urgency = `Tier ${movement.urgency}`;
  const statutory = legalStatutoryInfo(legalStatus);
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
  const subjectName = linkedPatient ? patientDisplayName(linkedPatient) : "Unknown Patient";
  const subjectUrm = linkedPatient ? linkedPatient.umrn : "UMRN not recorded";
  const history = deriveClinicalHistory(linkedPatient);
  const legalClass = legalClassFor(legalStatus);

  return (
    <WardPanel title="Selected movement" testId="ward-patient-search-preview" headingLevel={2}>
      <div className={styles.body}>
        {/* Close Action */}
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          data-testid="ward-patient-search-preview-close"
        >
          Close preview
        </button>

        {/* 1. Sovereign Presence State Banner */}
        <div className={`${styles.presenceBannerCard} ${styles[presenceStatus]}`}>
          <div className={styles.presenceBannerLeft}>
            <span className={`${styles.presenceDot} ${styles[presenceStatus]}`} />
            <strong>{bannerTitle}</strong>
          </div>
          <span className={styles.presenceSettingTag}>{bannerTag}</span>
        </div>

        {/* 2. Patient Identity & Core Status Badges */}
        <div className={styles.dossierHeader}>
          <div className={styles.dossierTitleRow}>
            <h3 className={styles.dossierName}>{subjectName}</h3>
            <span className={styles.dossierUrm}>{subjectUrm}</span>
          </div>
          <div className={styles.dossierMetaRow}>
            <span className={styles.metaDemographics}>
              {ageText(linkedPatient, activeDate)} · {linkedPatient?.sex ?? "Sex unrecorded"} · {summary.stageLabel}
            </span>
            {linkedPatient?.aboriginalOrTorresStraitIslanderStatus ? (
              <span className={styles.atsiPill}>Aboriginal (ATSI)</span>
            ) : null}
            <span className={styles.metaDivider}>·</span>
            <span className={styles.metaService}>{summary.departmentText}</span>
          </div>
          <div className={styles.dossierStatusStrip}>
            <span className={`${styles.tierBadge} ${styles.tier1}`}>{urgency}</span>
            <span className={`${styles.statusPill} ${legalClass}`}>{legalStatus}</span>
            <span className={styles.dispositionBadge}>{disposition}</span>
          </div>
          <div>
            <Link className={styles.openLink} href={`/mockups/ward-flow/movements/${movement.id}`}>
              Open full record
            </Link>
          </div>
        </div>

        {/* 3. Statutory Legal Authority Card (recorded forms) */}
        <div className={styles.statutoryCard}>
          <div className={styles.statutoryHead}>
            <span className={styles.statutoryTitle}>
              {legalStatus} · {statutory.title}
            </span>
            <span className={styles.statutoryCountdown}>{statutory.countdown}</span>
          </div>
          <div className={styles.statutoryDetailsGrid}>
            <div className={styles.statItem}>
              <span className={styles.statItemLabel}>Recorded form</span>
              <span className={styles.statItemValue}>{statutory.req}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statItemLabel}>Hospital Wait Time</span>
              <span className={styles.statItemValue} style={{ fontWeight: 600, color: "var(--ink)" }}>
                {waitTimeHours > 0 ? `${waitTimeHours.toFixed(1)}h` : "None (Not admitted)"}{" "}
                {isBreaching ? `(waiting ${LONG_WAIT_TEXT})` : ""}
              </span>
            </div>
          </div>
        </div>

        {/* 4. Placement & Movement Trajectory */}
        <div className={styles.dossierSection}>
          <span className={styles.sectionTitle}>Placement & Movement Trajectory</span>
          <div className={styles.trajectoryGrid}>
            <div className={styles.trajBox}>
              <span className={styles.trajLabel}>Originating Site</span>
              <span className={styles.trajValue}>{originSite}</span>
            </div>
            <div className={styles.trajBox}>
              <span className={styles.trajLabel}>Target Ward / Unit</span>
              <span className={`${styles.trajValue} ${styles.strong}`}>{targetWard}</span>
            </div>
            <div className={styles.trajBox}>
              <span className={styles.trajLabel}>Current Stage</span>
              <span className={styles.trajValue}>{currentStage}</span>
            </div>
            <div className={styles.trajBox}>
              <span className={styles.trajLabel}>Conveyance & Escort</span>
              <span className={styles.trajValue}>
                {transportStatus}
                {nurseEscort ? " · Nurse escort" : ""}
              </span>
            </div>
          </div>

          <section className={styles.tieSection} data-testid="ward-patient-search-preview-referral">
            <h4 className={styles.tieHeading}>Referral</h4>
            {referral ? (
              <p className={styles.tieBody}>
                <strong>{referral.id}</strong> — {buildReferralSummary(referral).originLine}
              </p>
            ) : (
              <p className={styles.tieEmpty}>No referral is linked to this movement.</p>
            )}
          </section>

          <section className={styles.tieSection} data-testid="ward-patient-search-preview-person">
            <h4 className={styles.tieHeading}>Person</h4>
            {linkedPatient ? (
              <Link className={styles.openLink} href={`/mockups/ward-flow/people/${linkedPatient.id}`}>
                {patientDisplayName(linkedPatient)} · {linkedPatient.umrn}
              </Link>
            ) : referral ? (
              <p className={styles.tieEmpty}>This referral carries no linked person record.</p>
            ) : (
              <p className={styles.tieEmpty}>No referral is linked, so no person record can be, either.</p>
            )}
          </section>
        </div>

        {/* 5. Clinical Presentation & Care Summary */}
        <div className={styles.dossierSection}>
          <span className={styles.sectionTitle}>Clinical Presentation & Care Summary</span>
          <div className={styles.clinicalNoteCard}>{NO_CLINICAL_NOTE}</div>
        </div>

        {/* Previous Presentations & History (Image 4) */}
        <div className={styles.dossierSection}>
          <span className={styles.sectionTitle}>Previous Presentations & History</span>
          <div className={styles.historyCard}>
            <div className={styles.historyGrid}>
              <div className={styles.historyItem}>
                <span className={styles.historyLabel}>Prior Admissions (12m)</span>
                <span className={styles.historyVal}>{history.priorAdmissions}</span>
              </div>
              <div className={styles.historyItem}>
                <span className={styles.historyLabel}>Last Discharge</span>
                <span className={styles.historyVal}>{history.lastDischarge}</span>
              </div>
              <div className={styles.historyItem}>
                <span className={styles.historyLabel}>Community Key Worker</span>
                <span className={styles.historyVal}>{history.communityKeyWorker}</span>
              </div>
              <div className={styles.historyItem}>
                <span className={styles.historyLabel}>Known Risk / Protocol</span>
                <span className={styles.historyVal}>{history.knownRiskProfile}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 6. Clinical Audit Milestones (Connected Vertical Timeline) */}
        <div className={styles.dossierSection}>
          <span className={styles.sectionTitle}>Audit Milestones</span>
          {/* Only the time the movement opened; see the matching note in the person preview. */}
          <div className={styles.milestoneTimeline}>
            <div className={styles.timelineNode}>
              <span className={styles.timelineNodeBullet} aria-hidden="true" />
              <div className={styles.timelineTimeRow}>
                <span className={styles.timelineMonoTime}>{formatInstantWithDay(movement.openedAt, now)} AWST</span>
              </div>
              <span className={styles.timelineEventText}>Record active from origin site ({originSite})</span>
            </div>
          </div>
        </div>

        {/* D4 Inline Notice Banner */}
        {actionNotice && (
          <div className={styles.d4Notice} role="status">
            <span>{actionNotice}</span>
            <button
              type="button"
              className={styles.d4NoticeDismiss}
              onClick={() => setActionNotice(null)}
              aria-label="Dismiss notice"
            >
              ✕
            </button>
          </div>
        )}

        {/* 7. Coordinator Action Bar */}
        <div className={styles.dossierActionBar}>
          <Link href={`/mockups/ward-flow/movements/${movement.id}`} className={styles.btnPrimary}>
            <span>View Movement</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
          <button
            type="button"
            className={styles.btnSecondary}
            title="Bed allocation is not recorded from this preview."
            onClick={() => setActionNotice("Bed allocation is not recorded from this preview.")}
          >
            Bed Allocation
          </button>
          <Link
            href={`/mockups/ward-flow/movements/${movement.id}`}
            className={styles.btnSecondary}
            data-testid="ward-patient-preview-movement-transport"
          >
            Transport Order
          </Link>
        </div>
      </div>
    </WardPanel>
  );
}
