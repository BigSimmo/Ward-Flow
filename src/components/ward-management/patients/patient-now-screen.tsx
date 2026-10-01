"use client";

import Link from "next/link";
import { ArrowLeft, Clock, FileUp, FileText, AlertCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { ContextualBackLink } from "@/components/contextual-back-link";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { edById, unitById } from "@/components/ward-management/ward-sites";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { Movement, TransportProvider, TransportLegalStatus } from "@/components/ward-management/ward-model";
import { TRANSPORT_PROVIDERS, ARRIVAL_MODE_LABELS } from "@/components/ward-management/ward-model";
import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import { UploadFormsModal } from "@/components/ward-management/referrals/upload-forms-modal";
import { patientAgeYears, type Patient, type PatientId } from "@/components/ward-management/ward-patients";
import {
  LATE_ARRIVAL_GRACE_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";
import { PersonScreen } from "./person-screen";
import { transportLeg } from "@/components/ward-management/ward-derivations";
import { pullHoldRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { resolvePatientNowRecord } from "./patient-now-adapter";
import { type PatientNowRecord, STAGES, clock, dur, fillTemplate } from "./patient-now-records";
import styles from "./patient-now.module.css";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";

/**
 * Ward, site and emergency-department names read from the one data layer (`ward-sites.ts`) that
 * owns them, rather than typed a second time here — `tests/ward-flow-data-boundary.test.ts` fails
 * closed on any file outside that layer stating one of these names as its own string literal.
 */
interface StagePresentationDetail {
  statusText: string;
  badgeTone: "good" | "danger" | "warn" | "neutral" | "accent";
  summary: string;
  milestones: Array<{ time?: string; label: string; detail: string }>;
}

function getStageBedflowDetail(stageId: string, liveMovement?: Movement): StagePresentationDetail {
  if (!liveMovement)
    return {
      statusText: "Not recorded",
      badgeTone: "neutral",
      summary: "No linked movement displayed.",
      milestones: [],
    };
  const changes = liveMovement.stageChanges.filter((change) => change.to === stageId);
  const current = liveMovement.stage === stageId;
  return {
    statusText: current ? "Current recorded stage" : changes.length ? "Previously recorded" : "No transition recorded",
    badgeTone: current ? "accent" : "neutral",
    summary: current
      ? `Current movement stage: ${STAGES.find((stage) => stage.id === stageId)?.label ?? stageId}.`
      : "Historical transitions are shown only when recorded.",
    milestones: changes.map((change) => ({
      time: clock(change.at),
      label: "Stage recorded",
      detail: `Recorded by ${change.by}${change.reason ? `: ${change.reason}` : ""}.`,
    })),
  };
}

function renderInlineText(text: string) {
  if (!text.includes("<b>")) return text;
  const parts = text.split(/(<b>.*?<\/b>)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("<b>") && part.endsWith("</b>")) {
      return <strong key={idx}>{part.slice(3, -4)}</strong>;
    }
    return part;
  });
}

/**
 * Turns a typed `HH:MM` time string into minutes from midnight (0–1439).
 * Same HH:MM parser the ED booking popup uses — local copy matching ed-screen.tsx.
 * Refuses rather than guesses: returns undefined if blank, malformed, or out of range.
 */
function minutesFromTimeInput(value: string): number | undefined {
  const clean = value.replace(/\s*AWST\s*/i, "").trim();
  const parts = clean.split(":");
  if (parts.length !== 2) return undefined;
  const [rawHours, rawMinutes] = parts;
  if (!rawHours || !rawMinutes) return undefined;
  if (rawHours.length < 1 || rawHours.length > 2 || rawMinutes.length !== 2) return undefined;
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return undefined;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return undefined;
  return hours * 60 + minutes;
}

function instantFromEstimatedTimeInputs(timeValue: string, day: "today" | "tomorrow", now: number): number | undefined {
  const minuteOfDay = minutesFromTimeInput(timeValue);
  if (minuteOfDay === undefined) return undefined;
  const startOfToday = Math.floor(now / 1440) * 1440;
  return startOfToday + (day === "tomorrow" ? 1440 : 0) + minuteOfDay;
}

function parseEtaToInstant(value: string, now: number): number | undefined {
  const clean = value.trim();
  if (!clean) return undefined;

  // Relative minutes: "~45m", "45m", "~30", "+45", "45 min", "45"
  const relMatch = clean.match(/^[~+]?\s*(\d+)\s*(?:m|min|mins|minutes)?$/i);
  if (relMatch && !clean.includes(":")) {
    const mins = Number(relMatch[1]);
    if (Number.isFinite(mins) && mins >= 0) {
      return now + mins;
    }
  }

  // HH:MM clock time matching ed-screen.tsx instantFromEstimatedTimeInputs
  const isTomorrow = /tomorrow/i.test(clean);
  const cleanTime = clean.replace(/\s*tomorrow\s*/i, "").trim();
  return instantFromEstimatedTimeInputs(cleanTime, isTomorrow ? "tomorrow" : "today", now);
}

function formatTransportLegalStatus(status?: string): string {
  if (!status) return "Not recorded";
  if (status === "involuntary") return "Involuntary";
  if (status === "voluntary") return "Voluntary";
  return status;
}

interface PatientNowScreenProps {
  patientId?: string;
  movementId?: string;
  initialExampleId?: "WF-009" | "WF-004";
}

type TabKey = "now" | "history" | "community" | "details" | "documents";

export function PatientNowScreen({ patientId, movementId, initialExampleId = "WF-009" }: PatientNowScreenProps) {
  const { patients, movements, referrals, admissions, units, dispatch, dayZero, rejections } = useWardFlow();
  const now = useWardFlowClock();

  // `now` is a demo-clock `Instant` (minutes from `dayZero`), not a wall-clock millisecond
  // timestamp, so the calendar date used to derive a patient's age must be rebuilt from `dayZero`.
  // `new Date(now)` would anchor to the 1970 epoch and render a negative age.
  const displayToday = new Date(dayZero.getTime() + now * 60_000);

  // Selected scenario / record ID, seeded from the route and re-synced on client-side navigation:
  // the WF-009/WF-004 toggle buttons also call setSelectedId but without changing `routeId`, so the
  // effect below only fires on a real route change and never clobbers a toggle override.
  const routeId = movementId ?? patientId ?? initialExampleId;
  const [selectedId, setSelectedId] = useState<string>(routeId);

  const [previousRouteId, setPreviousRouteId] = useState(routeId);
  if (previousRouteId !== routeId) {
    setPreviousRouteId(routeId);
    setSelectedId(routeId);
  }

  const [activeTab, setActiveTab] = useState<TabKey>("now");
  const [selectedEpisodeIndex, setSelectedEpisodeIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<"all" | "emergency" | "inpatient">("all");

  // Transport booking state & overrides
  const [showTransportForm, setShowTransportForm] = useState(false);
  const [showArrivalTimeModal, setShowArrivalTimeModal] = useState(false);
  const [showUploadFormsModal, setShowUploadFormsModal] = useState(false);
  const [showClearanceModal, setShowClearanceModal] = useState(false);
  const [clearanceConfirmed, setClearanceConfirmed] = useState(false);
  const [clearanceUrgent, setClearanceUrgent] = useState(true);
  const [transportCadDraft, setTransportCadDraft] = useState("");
  const [transportEtaDraft, setTransportEtaDraft] = useState("");
  const [transportProviderDraft, setTransportProviderDraft] = useState<TransportProvider>("Ambulance service");
  const [transportLegalDraft, setTransportLegalDraft] = useState<TransportLegalStatus>("involuntary");
  const [transportEscortDraft, setTransportEscortDraft] = useState(false);
  const [bookingRejectionStart, setBookingRejectionStart] = useState<number>();

  // Synchronize document title
  useEffect(() => {
    document.title = "Patient - Ward Flow";
  }, []);

  // Dynamically resolve the patient record
  const resolved = useMemo(() => {
    return resolvePatientNowRecord(selectedId, patients, movements, referrals, admissions, units, now);
  }, [selectedId, patients, movements, referrals, admissions, units, now]);

  // Current stage index for Journey
  const currentStageIndex = resolved?.currentStageIndex ?? 0;
  const [expandedStageIndex, setExpandedStageIndex] = useState<number | null>(currentStageIndex);
  const [focusedStageIndex, setFocusedStageIndex] = useState<number>(currentStageIndex);
  const [prevStageIndex, setPrevStageIndex] = useState(currentStageIndex);
  const stageButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (prevStageIndex !== currentStageIndex) {
    setPrevStageIndex(currentStageIndex);
    setExpandedStageIndex(currentStageIndex);
    setFocusedStageIndex(currentStageIndex);
  }

  // If the ID is completely unknown to the system, render the governed missing state
  if (!resolved) {
    return <PersonScreen patientId={(patientId ?? movementId ?? "") as PatientId} />;
  }

  const record: PatientNowRecord = resolved.record;
  const liveMovement = resolved.liveMovement ?? movements.find((m) => m.id === selectedId);
  const livePatient = resolved.livePatient as (Patient & { confidential?: boolean }) | undefined;

  // Helper values
  const waitedStr = liveMovement ? dur(Math.max(0, now - liveMovement.openedAt)) : "Not recorded";
  const urgencyTier = liveMovement?.urgency;

  // Pulled bed derived values
  const isPulled = liveMovement?.stage === "pulled" || Boolean(liveMovement?.acceptedUnitId);

  const acceptingUnit = liveMovement?.acceptedUnitId
    ? units.find((u) => u.id === liveMovement.acceptedUnitId)
    : undefined;
  const acceptingWardName = acceptingUnit?.name ?? "Accepting Inpatient Ward";

  const hasArrivalPlan = Boolean(liveMovement?.arrivalDetails);
  const isOverdue = Boolean(
    liveMovement?.arrivalDetails &&
    now > liveMovement.arrivalDetails.estimatedArrivalAt + LATE_ARRIVAL_GRACE_MINUTES &&
    liveMovement.stage !== "arrived",
  );
  const pullExpiresAt = liveMovement?.pullExpiresAt;
  const isHoldExpired = !hasArrivalPlan && pullExpiresAt !== undefined && now >= pullExpiresAt;
  const uploadedForms = liveMovement?.uploadedForms ?? [];

  const targetMovement = liveMovement;

  // Display names
  const displayName = resolved.displayName;
  const preferredName = resolved.preferredName;

  // Copy handover summary
  function handleCopySummary() {
    const urgencyLabel = urgencyTier ? `Tier ${urgencyTier}` : "urgency not recorded";
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    const text = `Ward Flow Handover Summary — ${displayName} (${urgencyLabel})\nStatus: ${record.verdict.title}\nSince movement opened: ${waitedStr}\nNext Action: ${record.next[0]?.w ?? "Review"}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Keyboard navigation for tablist
  const TAB_KEYS: TabKey[] = ["now", "history", "community", "details", "documents"];
  function handleTabKeyDown(e: ReactKeyboardEvent) {
    const currentIndex = TAB_KEYS.indexOf(activeTab);
    let nextIndex = -1;
    if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % TAB_KEYS.length;
    else if (e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + TAB_KEYS.length) % TAB_KEYS.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = TAB_KEYS.length - 1;

    if (nextIndex !== -1) {
      e.preventDefault();
      const nextKey = TAB_KEYS[nextIndex];
      setActiveTab(nextKey);
      const btn = document.getElementById(`pntab-${nextKey}`);
      btn?.focus();
    }
  }

  // Transport derived values and booking action
  const isTransportBooked = liveMovement?.transport !== undefined;
  const displayCadNumber = liveMovement?.transport?.cadNumber;
  const displayEta =
    liveMovement?.transport?.estimatedAt !== undefined
      ? `${clock(liveMovement.transport.estimatedAt)} AWST`
      : undefined;
  const displayProvider = liveMovement?.transport?.provider ?? "Not recorded";
  const displayLegalStatus = liveMovement?.transport?.transportLegalStatus
    ? formatTransportLegalStatus(liveMovement.transport.transportLegalStatus)
    : "Not recorded";
  const displayEscort = liveMovement?.transport?.escortRequired;
  const bookingRejection =
    bookingRejectionStart !== undefined
      ? rejections
          .slice(bookingRejectionStart)
          .find((rejection) => rejection.attempted === "BOOK_TRANSPORT" && rejection.movementId === selectedId)
      : undefined;

  function handleSaveTransportBooking(e: React.FormEvent) {
    e.preventDefault();
    const cleanCad = transportCadDraft.trim();
    const cleanEta = transportEtaDraft.trim();
    const estimatedAt = parseEtaToInstant(cleanEta, now);
    if (!cleanCad || estimatedAt === undefined) return;

    if (!liveMovement) return;
    setBookingRejectionStart(rejections.length);
    {
      dispatch({
        type: "BOOK_TRANSPORT",
        role: "ed",
        now,
        movementId: liveMovement.id,
        provider: transportProviderDraft,
        escortRequired: transportEscortDraft,
        cadNumber: cleanCad,
        transportLegalStatus: transportLegalDraft,
        estimatedAt,
      });
    }

    setShowTransportForm(false);
  }

  // Fill templates for record strings. D5: `due` is never computed — it is the live
  // movement's own `legalForm.dueAt`, typed or authored, never `now + <offset>` — and
  // `formname` is the register's own title for whatever code that movement actually carries
  // (`legalFormName`), never a hand-written "Form 4A".
  const templateContext = {
    due: liveMovement?.legalForm?.dueAt ?? null,
    formname: liveMovement?.legalForm ? legalFormName(liveMovement.legalForm) : "No legal form recorded",
    formcode: liveMovement?.legalForm?.code,
    escalated: now - 38,
    handover: 14 * 60,
    pulled: now - 45,
    transport: now - 15,
    fit: now - 55,
    dest: acceptingUnit?.name ?? "No destination recorded",
    declined: {},
  };

  // SVGs for presentation history timeline (2019-2027)
  const yFrom = 2019;
  const yTo = 2027;
  const x0 = 34;
  const x1 = 966;
  const baseY = 74;
  const getPx = (y: number) => x0 + ((y - yFrom) / (yTo - yFrom)) * (x1 - x0);

  const rawPresentations = record.presentations;

  const presentations = rawPresentations.filter((p) => {
    if (historyFilter === "emergency") {
      return (
        Boolean(p.current) ||
        p.to.toLowerCase().includes("discharged from ed") ||
        p.los.includes("h") ||
        p.where.includes("ED") ||
        p.where.includes("Health Campus")
      );
    }
    if (historyFilter === "inpatient") {
      return !p.current && !p.to.toLowerCase().includes("discharged from ed") && p.to !== "no destination yet";
    }
    return true;
  });

  return (
    <main
      id="main-content"
      className={styles.screen}
      data-testid="ward-person-screen"
      data-ward-design="third-edition"
      data-ward-rebuilt-screen="patient-now"
    >
      <div className={styles.scroll}>
        {livePatient?.confidential && (
          <div className={styles.confidentialBanner} role="alert" data-testid="ward-patient-confidential-banner">
            <span className={styles.confidentialIcon} aria-hidden="true">
              🔒
            </span>
            <div>
              <strong>RESTRICTED / CONFIDENTIAL RECORD</strong>
              <p>This record has restricted access flags enabled. Handle according to clinical privacy protocol.</p>
            </div>
          </div>
        )}
        {/* Executive Clinical Top Bar */}
        <section className={styles.topCard} id="pnSubject" aria-label="Patient summary">
          <div className={styles.patientMetaRow}>
            {/* Identity Cluster */}
            <div className={styles.patientPrimary} data-testid="ward-person-identity">
              <div className={styles.nameLine}>
                <ContextualBackLink
                  fallbackHref="/mockups/ward-flow"
                  className={styles.backBtn}
                  aria-label="Back to previous page"
                  title="Back to previous page"
                  data-testid="ward-patient-back-button"
                >
                  <ArrowLeft className={styles.backIcon} aria-hidden="true" />
                  <span className={styles.backLabel}>Back</span>
                </ContextualBackLink>
                <h1 className={styles.nameWho}>
                  {displayName} {preferredName && <span className={styles.knownPill}>known as {preferredName}</span>}
                </h1>
                <LegalLimitsNotChecked />
                {livePatient?.confidential && (
                  <span className={styles.confidentialPill} data-testid="ward-patient-confidential-pill">
                    CONFIDENTIAL
                  </span>
                )}
              </div>

              <div className={styles.demographicChips}>
                <span className={styles.demoChip}>
                  <strong>UMRN</strong> <span className={styles.tabularNum}>{livePatient?.umrn ?? "UM100023"}</span>
                </span>
                <span className={styles.demoDivider}>·</span>
                <span className={styles.demoChip}>
                  <strong>DOB</strong>{" "}
                  {livePatient ? (
                    <>
                      <span className={styles.tabularNum}>{livePatient.dateOfBirth}</span> (
                      <span className={styles.tabularNum}>{patientAgeYears(livePatient, displayToday)}y</span>)
                    </>
                  ) : (
                    <span className={styles.tabularNum}>Not recorded · age not recorded</span>
                  )}
                </span>
                <span className={styles.demoDivider}>·</span>
                <span className={styles.demoChip}>
                  <strong>Sex</strong> {livePatient?.sex ?? "Not recorded"}
                </span>
                <span className={styles.demoDivider}>·</span>
                <span className={styles.demoChip}>
                  <strong>Location</strong>{" "}
                  {liveMovement ? (edById(liveMovement.originEdId)?.name ?? "Origin not recorded") : "Not recorded"}
                </span>
                <span className={styles.demoDivider}>·</span>
                <span className={styles.demoChip}>
                  <strong>Legal</strong>{" "}
                  {liveMovement
                    ? `${liveMovement.legalStatus ?? "Not recorded"}${liveMovement.legalForm ? ` · ${legalFormName(liveMovement.legalForm)}` : " · no legal form recorded"}`
                    : "Not recorded"}
                </span>
              </div>
            </div>

            {/* Status & Priority Cluster */}
            <div className={styles.episodeStatusCluster}>
              {liveMovement ? (
                <>
                  <span className={`${styles.teleBadge} ${styles.teleBadgeTier1}`} data-tier={urgencyTier ?? undefined}>
                    Tier {urgencyTier ?? 1} · Most Urgent
                  </span>
                  <span className={`${styles.teleBadge} ${styles.teleBadgeAcuity}`}>
                    {liveMovement.security === "Secure" ? "Locked Adult Bed · 1:1" : "Open Adult Bed"}
                  </span>
                  {liveMovement.legalForm && (
                    <span className={`${styles.teleBadge} ${styles.teleBadgeLegal}`}>
                      {legalFormName(liveMovement.legalForm)}
                    </span>
                  )}
                  <span className={`${styles.teleBadge} ${styles.teleBadgeClock}`}>
                    <span className={styles.pulseDot} />
                    Wait: {waitedStr}
                  </span>
                  <span className={styles.statusPillBadge}>
                    {isTransportBooked ? "Bed Accepted · Transport Booked" : record.verdict.short}
                  </span>
                </>
              ) : (
                <>
                  <span className={`${styles.teleBadge} ${styles.teleBadgeLegal}`}>Community Outpatient Dossier</span>
                  <span className={styles.statusPillBadge}>{record.verdict.short}</span>
                </>
              )}
            </div>
          </div>

          {!liveMovement && (
            <div className={styles.communityMasthead} data-testid="ward-community-masthead">
              <div className={styles.commBadge}>Community Outpatient Dossier</div>
              <div className={styles.commTitle}>Peel Community Mental Health Service · Active Outpatient Care</div>
              <div className={styles.commDesc}>
                Patient is currently managed in community outpatient care. No active emergency department transit or
                inpatient bed pull is underway. To initiate inpatient admission or transfer, raise a coordinated intake
                referral.
              </div>
            </div>
          )}

          {/* Action Toolbar */}
          <div className={styles.topToolbar}>
            <div className={styles.actionControls}>
              {liveMovement ? (
                <Link
                  href={`/mockups/ward-flow/movements/${liveMovement.id}`}
                  className={`${styles.ctl} ${styles.ctlPrimary}`}
                  data-open-movement={liveMovement.id}
                  data-testid="ward-person-refer"
                >
                  Open the movement
                </Link>
              ) : (
                <Link
                  href="/mockups/ward-flow/referrals/new"
                  className={`${styles.ctl} ${styles.ctlPrimary}`}
                  data-testid="ward-person-refer-outpatient"
                >
                  + Raise Inpatient Referral
                </Link>
              )}
              <div className={styles.compactNext} role="region" aria-label="Next steps">
                {record.next[0] ? (
                  <>
                    <strong>Next: {fillTemplate(record.next[0].w, templateContext)}</strong>
                    <span>{fillTemplate(record.next[0].d, templateContext)}</span>
                  </>
                ) : (
                  <span>No next steps recorded.</span>
                )}
              </div>
              <button type="button" className={styles.ctl} onClick={handleCopySummary}>
                {copied ? "Copied!" : "Copy handover summary"}
              </button>
            </div>
          </div>

          {/* Pulled Bed & Arrival Coordination Section */}
          {isPulled && (
            <div className={styles.pulledBanner} data-testid="ward-patient-pulled-banner">
              <div className={styles.pulledBannerHeader}>
                <div className={styles.pulledBadgeCluster}>
                  <span className={styles.pulledStatusBadge}>Bed Pulled &amp; Reserved</span>
                  <span className={styles.pulledWardTarget}>
                    Accepting Ward: <strong>{acceptingWardName}</strong>
                  </span>
                </div>
                {hasArrivalPlan ? (
                  <span className={styles.pulledClockBadge}>
                    <Clock size={14} aria-hidden="true" />
                    <span>ETA: {clock(liveMovement?.arrivalDetails?.estimatedArrivalAt ?? now + 120)} AWST</span>
                  </span>
                ) : pullExpiresAt !== undefined ? (
                  <span
                    className={styles.pulledClockBadge}
                    data-tone={isHoldExpired ? "danger" : "normal"}
                    data-testid="ward-patient-pull-hold-remaining"
                  >
                    <Clock size={14} aria-hidden="true" />
                    <span>Bed pull {pullHoldRemainingLabel(pullExpiresAt, now)}</span>
                  </span>
                ) : null}
              </div>

              {isOverdue && (
                <div
                  className={styles.pulledOverdueAlert}
                  role="alert"
                  data-testid="ward-patient-overdue-alert"
                  title={OPERATIONAL_DEFAULT_LABEL}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                  <div>
                    <strong>Arrival Overdue:</strong> Patient is more than {LATE_ARRIVAL_GRACE_MINUTES} minutes past
                    estimated arrival time ({clock(liveMovement!.arrivalDetails!.estimatedArrivalAt)} AWST).
                    Notification is not recorded here.
                  </div>
                </div>
              )}

              <div className={styles.pulledDetailsGrid}>
                <div className={styles.pulledDetailItem}>
                  <span className={styles.pulledDetailLabel}>Arrival Mode</span>
                  <span className={styles.pulledDetailValue}>
                    {hasArrivalPlan && liveMovement?.arrivalDetails?.mode
                      ? ARRIVAL_MODE_LABELS[liveMovement.arrivalDetails.mode]
                      : "Default / Pending Confirmation"}
                  </span>
                </div>
                <div className={styles.pulledDetailItem}>
                  <span className={styles.pulledDetailLabel}>Tracking / CAD (dispatch) number</span>
                  <span className={styles.pulledDetailValue}>
                    {liveMovement?.arrivalDetails?.trackingNumber || "Not recorded"}
                  </span>
                </div>
                <div className={styles.pulledDetailItem}>
                  <span className={styles.pulledDetailLabel}>Hold Status</span>
                  <span className={styles.pulledDetailValue}>
                    {hasArrivalPlan
                      ? "Hold clock cleared (Arrival time scheduled)"
                      : isHoldExpired
                        ? "4h window passed — review the hold"
                        : "4h standard countdown active"}
                  </span>
                </div>
              </div>

              <div className={styles.pulledActionRow}>
                <div className={styles.pulledActionBtns}>
                  <button
                    type="button"
                    className={`${styles.pulledActionBtn} ${styles.pulledActionBtnPrimary}`}
                    onClick={() => setShowArrivalTimeModal(true)}
                    data-testid="ward-patient-update-arrival-btn"
                  >
                    <Clock size={15} aria-hidden="true" />
                    <span>{hasArrivalPlan ? "Edit Arrival Time" : "Update Arrival Time"}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.pulledActionBtn}
                    onClick={() => setShowUploadFormsModal(true)}
                    data-testid="ward-patient-upload-forms-btn"
                  >
                    <FileUp size={15} aria-hidden="true" />
                    <span>Record transport document details</span>
                  </button>
                </div>

                {hasArrivalPlan && liveMovement?.arrivalDetails && (
                  <span style={{ fontSize: "var(--t-0, 0.75rem)", color: "var(--muted)" }}>
                    Updated by {liveMovement.arrivalDetails.recordedBy} at{" "}
                    {clock(liveMovement.arrivalDetails.recordedAt)}
                  </span>
                )}
              </div>

              {uploadedForms.length > 0 && (
                <div className={styles.pulledFormsList} data-testid="ward-patient-uploaded-forms">
                  <div className={styles.pulledFormsHeader}>
                    <FileText size={14} aria-hidden="true" />
                    <span>Transport document details ({uploadedForms.length}) — file contents not stored</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {uploadedForms.map((form) => (
                      <div key={form.id} className={styles.pulledFormChip}>
                        <span style={{ fontWeight: 600 }}>{form.formName}</span>
                        <span className={styles.pulledFormChipMeta}>
                          {form.fileName} · {clock(form.uploadedAt)} ({form.uploadedBy})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Barriers & Blockers High-Impact Section */}
          <div className={styles.barrierCardContainer}>
            <div className={styles.barrierHeader}>
              <h3 className={styles.verdictHeading} data-tone={record.verdict.tone}>
                {record.verdict.title}
              </h3>
              <span className={styles.barrierSummaryBadge}>
                {record.verdict.gates.length > 0
                  ? `${record.verdict.gates.length} missing gates`
                  : "No gate assessment recorded"}
              </span>
            </div>

            {record.verdict.gates.length > 0 ? (
              <div className={styles.barrierGrid}>
                {record.verdict.gates.map((gate, i) => (
                  <div key={i} className={styles.barrierCard}>
                    <div className={styles.barrierCardTop}>
                      <span className={styles.barrierIcon} aria-hidden="true">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path d="M2 2L10 10M10 2L2 10" />
                        </svg>
                      </span>
                      <div className={styles.barrierMain}>
                        <div className={styles.barrierLabelRow}>
                          <span className={styles.barrierLabel}>{gate.label}</span>
                          <span className={styles.barrierVerdictPill}>{gate.verdict}</span>
                        </div>
                        <p className={styles.barrierDetail}>{gate.detail}</p>
                      </div>
                    </div>
                    <div className={styles.barrierCardAction}>
                      {gate.label.toLowerCase().includes("bed") ? (
                        <button
                          type="button"
                          className={styles.barrierActionBtn}
                          onClick={() => {
                            setActiveTab("now");
                          }}
                        >
                          View movement referrals &rarr;
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.barrierActionBtn}
                          onClick={() => setShowClearanceModal(true)}
                        >
                          Request ED Clearance &rarr;
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.barrierCardClear}>
                <div className={styles.barrierMain}>
                  <span className={styles.barrierLabel}>Transfer readiness not assessed here</span>
                  <p className={styles.barrierDetail}>
                    {fillTemplate(record.verdict.none ?? "No movement gate assessment is recorded.", templateContext)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Grid below: Left is Journey, Right is 5 Tabs */}
        <div className={styles.pnGrid}>
          {/* Journey Panel */}
          <section className={styles.panel} id="pnJourney" aria-labelledby="pnJourneyH">
            <div className={styles.ph}>
              <h2 id="pnJourneyH" className={styles.panelTitle}>
                {liveMovement ? "Journey" : "Community Trajectory"}
              </h2>
              <span className={styles.badgeCount}>
                {liveMovement ? `Stage ${currentStageIndex + 1} of ${STAGES.length}` : "Active Care"}
              </span>
            </div>

            <div className={styles.journeyBody}>
              {!liveMovement ? (
                <div className={styles.communityOverviewCard} data-testid="ward-community-overview-card">
                  <div className={styles.commMetricGroup}>
                    <span className={styles.commMetricLabel}>Assigned Community Service</span>
                    <span className={styles.commMetricValue}>
                      {livePatient?.catchmentCommunityTeam ?? "Peel Community Mental Health Service"}
                    </span>
                    <span className={styles.commMetricSub}>Mandurah Community Health Centre</span>
                  </div>
                  <div className={styles.commMetricGroup}>
                    <span className={styles.commMetricLabel}>Care Coordinator</span>
                    <span className={styles.commMetricValue}>Sarah Jenkins, RN (CNS)</span>
                    <span className={styles.commMetricSub}>Direct contact: (08) 9531 8000</span>
                  </div>
                  <div className={styles.commMetricGroup}>
                    <span className={styles.commMetricLabel}>Current Treatment Plan</span>
                    <span className={styles.commMetricValue}>Paliperidone palmitate depot 150mg monthly</span>
                    <span className={styles.commMetricSub}>Active Community Case Management</span>
                  </div>
                  <div className={styles.commMetricGroup}>
                    <span className={styles.commMetricLabel}>Consultant Psychiatrist</span>
                    <span className={styles.commMetricValue}>Dr L. Van Der Merwe</span>
                    <span className={styles.commMetricSub}>Next clinic outpatient review: 14 Oct 2026</span>
                  </div>
                </div>
              ) : (
                <ol
                  className={styles.jrn}
                  aria-label={`The seven stages. Stage ${currentStageIndex + 1} of ${STAGES.length}, ${STAGES[currentStageIndex].label}, is current`}
                >
                  {STAGES.map((s, i) => {
                    const recordedTransition = liveMovement?.stageChanges.find((change) => change.to === s.id);
                    const stateAttr = liveMovement?.stage === s.id ? "now" : recordedTransition ? "recorded" : "todo";
                    const isExpanded = expandedStageIndex === i;
                    const detail = getStageBedflowDetail(s.id, liveMovement);
                    const firstTime = detail.milestones.find((m) => m.time)?.time;
                    const whenText =
                      stateAttr === "recorded"
                        ? `Recorded ${firstTime ?? ""}`.trim()
                        : stateAttr === "now"
                          ? `${waitedStr} since opened`
                          : "No transition recorded";
                    return (
                      <li key={s.id} className={styles.jst} data-s={stateAttr}>
                        <div className={styles.jIndicatorCol}>
                          <span className={styles.jnode} aria-hidden="true">
                            {i + 1}
                          </span>
                          {i < STAGES.length - 1 && <span className={styles.jline} />}
                        </div>
                        <div className={styles.jcontent}>
                          <button
                            type="button"
                            id={`stage-header-${s.id}`}
                            ref={(el) => {
                              stageButtonRefs.current[i] = el;
                            }}
                            tabIndex={focusedStageIndex === i ? 0 : -1}
                            className={styles.stageButton}
                            aria-expanded={isExpanded}
                            aria-controls={`stage-panel-${s.id}`}
                            data-testid={`ward-patient-stage-btn-${s.id}`}
                            onClick={() => {
                              setFocusedStageIndex(i);
                              setExpandedStageIndex(isExpanded ? null : i);
                            }}
                            onKeyDown={(e) => {
                              let nextIndex: number | null = null;
                              if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                                e.preventDefault();
                                nextIndex = (i + 1) % STAGES.length;
                              } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                                e.preventDefault();
                                nextIndex = (i - 1 + STAGES.length) % STAGES.length;
                              } else if (e.key === "Home") {
                                e.preventDefault();
                                nextIndex = 0;
                              } else if (e.key === "End") {
                                e.preventDefault();
                                nextIndex = STAGES.length - 1;
                              } else if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setExpandedStageIndex(isExpanded ? null : i);
                              }
                              if (nextIndex !== null) {
                                setFocusedStageIndex(nextIndex);
                                stageButtonRefs.current[nextIndex]?.focus();
                              }
                            }}
                            title={`Click to ${isExpanded ? "collapse" : "view"} bedflow details for ${s.label}`}
                          >
                            <div className={styles.jnameRow}>
                              <span className={styles.jname}>{s.label}</span>
                              <div className={styles.stageRightCluster}>
                                {whenText && <span className={styles.jwhen}>{whenText}</span>}
                                <svg
                                  className={`${styles.stageChevron} ${isExpanded ? styles.stageChevronOpen : ""}`}
                                  width="12"
                                  height="12"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  aria-hidden="true"
                                >
                                  <polyline points="4 6 8 10 12 6" />
                                </svg>
                              </div>
                            </div>
                          </button>

                          {isExpanded && (
                            <div
                              id={`stage-panel-${s.id}`}
                              role="region"
                              aria-labelledby={`stage-header-${s.id}`}
                              className={styles.stageDetailBox}
                              data-testid={`ward-patient-stage-panel-${s.id}`}
                            >
                              <div className={styles.stageDetailHeader}>
                                <span className={styles.stageDetailBadge} data-tone={detail.badgeTone}>
                                  {detail.statusText}
                                </span>
                              </div>
                              <p className={styles.stageDetailSummary}>{detail.summary}</p>
                              {detail.milestones.length > 0 && (
                                <ul className={styles.stageMilestoneList}>
                                  {detail.milestones.map((m, mi) => (
                                    <li key={mi} className={styles.stageMilestoneItem}>
                                      {m.time && <span className={styles.stageMilestoneTime}>{m.time}</span>}
                                      <span className={styles.stageMilestoneLabel}>{m.label}:</span>
                                      <span className={styles.stageMilestoneText}>{m.detail}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              <dl className={`${styles.slFacts} ${styles.jfoot}`}>
                <dt>Since movement opened</dt>
                <dd>{waitedStr}</dd>
                <dt>Acuity need</dt>
                <dd>
                  {liveMovement
                    ? `${liveMovement.security === "Secure" ? "Locked" : "Open"} adult bed${liveMovement.specialling ? " (1:1)" : ""}`
                    : "No active movement recorded"}
                </dd>
              </dl>
            </div>
          </section>

          {/* Record Tabs Panel */}
          <section className={`${styles.panel} ${styles.tabsPanel}`} id="pnTabs">
            <div className={styles.tabbar} role="tablist" aria-label="The record" onKeyDown={handleTabKeyDown}>
              <button
                className={styles.tabBtn}
                type="button"
                role="tab"
                id="pntab-now"
                aria-controls="pnpane-now"
                aria-selected={activeTab === "now"}
                tabIndex={activeTab === "now" ? 0 : -1}
                onClick={() => setActiveTab("now")}
              >
                Now
                <span className={styles.tabNum} id="pncount-now">
                  {(liveMovement?.withdrawnReferrals.length ?? 0) + 1}
                </span>
              </button>

              <button
                className={styles.tabBtn}
                type="button"
                role="tab"
                id="pntab-history"
                aria-controls="pnpane-history"
                aria-selected={activeTab === "history"}
                tabIndex={activeTab === "history" ? 0 : -1}
                onClick={() => setActiveTab("history")}
              >
                History
                <span className={styles.tabNum} id="pncount-history">
                  {record.presentations.length}
                </span>
              </button>

              <button
                className={styles.tabBtn}
                type="button"
                role="tab"
                id="pntab-community"
                aria-controls="pnpane-community"
                aria-selected={activeTab === "community"}
                tabIndex={activeTab === "community" ? 0 : -1}
                onClick={() => setActiveTab("community")}
              >
                Community
                <span className={styles.tabNum} id="pncount-community">
                  {record.community.teams.length}
                </span>
              </button>

              <button
                className={styles.tabBtn}
                type="button"
                role="tab"
                id="pntab-details"
                aria-controls="pnpane-details"
                aria-selected={activeTab === "details"}
                tabIndex={activeTab === "details" ? 0 : -1}
                onClick={() => setActiveTab("details")}
              >
                Details
              </button>

              <button
                className={styles.tabBtn}
                type="button"
                role="tab"
                id="pntab-documents"
                aria-controls="pnpane-documents"
                aria-selected={activeTab === "documents"}
                tabIndex={activeTab === "documents" ? 0 : -1}
                onClick={() => setActiveTab("documents")}
              >
                Documents
                <span className={styles.tabNum} id="pncount-documents">
                  {record.documents.length}
                </span>
              </button>
            </div>

            <div className={styles.tabBody} id="pnBody" tabIndex={0}>
              {/* Tab 1: NOW */}
              <div
                className={styles.tabPane}
                role="tabpanel"
                id="pnpane-now"
                aria-labelledby="pntab-now"
                hidden={activeTab !== "now"}
              >
                <div className={styles.pnCols}>
                  {/* Left Column */}
                  <div className={styles.pnNowLeft}>
                    <div className={styles.sec}>
                      <div className={styles.referralFilterRow}>
                        <h3 className={styles.secH} style={{ margin: 0 }}>
                          This presentation
                          <span className={styles.count}>
                            {(liveMovement?.withdrawnReferrals.length ?? 0) + 1} events
                          </span>
                        </h3>
                      </div>

                      <ol className={styles.tline}>
                        {liveMovement ? (
                          <>
                            <li className={styles.tev}>
                              <span className={styles.tnode} aria-hidden="true" />
                              <span className={styles.twhen}>{clock(liveMovement.openedAt)}</span>
                              <span className={styles.twhat}>
                                Journey opened at{" "}
                                <strong>{edById(liveMovement.originEdId)?.name ?? "Emergency Department"}</strong>.
                              </span>
                            </li>
                            {liveMovement.legalForm && (
                              <li className={styles.tev}>
                                <span className={styles.tnode} aria-hidden="true" />
                                <span className={styles.twhen}>{clock(liveMovement.openedAt)}</span>
                                <span className={styles.twhat}>
                                  Legal status: <strong>{legalFormName(liveMovement.legalForm)}</strong> recorded.
                                </span>
                              </li>
                            )}
                            {liveMovement.withdrawnReferrals.map((withdrawal, index) => (
                              <li key={`${withdrawal.unitId}-${index}`} className={styles.tev} data-tone="warn">
                                <span className={styles.tnode} aria-hidden="true" />
                                <span className={styles.twhen}>—</span>
                                <span className={styles.twhat}>
                                  <strong>{unitById(withdrawal.unitId)?.name ?? "Ward"} referral withdrawn</strong>
                                  {withdrawal.reason ? `: ${withdrawal.reason.replace(/_/g, " ")}.` : "."}
                                </span>
                              </li>
                            ))}
                            {liveMovement.acceptedUnitId && (
                              <li className={styles.tev} data-tone="good">
                                <span className={styles.tnode} aria-hidden="true" />
                                <span className={styles.twhen}>—</span>
                                <span className={styles.twhat}>
                                  <strong>{unitById(liveMovement.acceptedUnitId)?.name ?? "Ward"} accepted.</strong>
                                </span>
                              </li>
                            )}
                            {liveMovement.transport && (
                              <li className={styles.tev}>
                                <span className={styles.tnode} aria-hidden="true" />
                                <span className={styles.twhen}>—</span>
                                <span className={styles.twhat}>
                                  Transport {transportLeg(liveMovement.transport)?.toLowerCase() ?? "booked"} with{" "}
                                  {liveMovement.transport.provider ?? "provider not recorded"}.
                                </span>
                              </li>
                            )}
                          </>
                        ) : (
                          <li className={styles.tev}>
                            <span className={styles.tnode} aria-hidden="true" />
                            <span className={styles.twhen}>Recorded</span>
                            <span className={styles.twhat}>
                              {record.early[0]?.what ?? "No active movement recorded."}
                            </span>
                          </li>
                        )}
                      </ol>
                    </div>

                    <div className={styles.sec}>
                      <h3 className={styles.secH}>Clinical presentation</h3>
                      <p className={styles.pnStory}>“{record.reason}”</p>
                    </div>

                    <div className={styles.sec}>
                      <h3 className={styles.secH}>Requirements</h3>
                      <dl className={styles.slFacts}>
                        <dt>Bed</dt>
                        <dd>
                          {liveMovement
                            ? `${liveMovement.security === "Secure" ? "Locked" : "Open"}, adult`
                            : "Community care"}
                        </dd>
                        <dt>Nursing</dt>
                        <dd>
                          {liveMovement
                            ? liveMovement.specialling
                              ? "One to one specialling"
                              : "Standard"
                            : "Not recorded"}
                        </dd>
                        <dt>Urgency</dt>
                        <dd>
                          {urgencyTier
                            ? `Tier ${urgencyTier}${urgencyTier === 1 ? ", most urgent" : ""}`
                            : "Not recorded"}
                        </dd>
                        <dt>Transport</dt>
                        <dd>
                          {liveMovement?.transport
                            ? `Status: ${transportLeg(liveMovement.transport) ?? "Booked"}`
                            : "No transport job recorded"}
                        </dd>
                        <dt>Fit to travel</dt>
                        <dd>
                          {liveMovement?.medicalClearance
                            ? liveMovement.medicalClearance.cleared
                              ? "Clearance recorded"
                              : "Not cleared"
                            : "Not assessed"}
                        </dd>
                        <dt>Community team</dt>
                        <dd>{record.community.teams[0]?.name ?? "No team information recorded"}</dd>
                        <dt>Catchment</dt>
                        <dd>{livePatient?.catchmentCommunityTeam ?? "Not recorded"}</dd>
                      </dl>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className={styles.pnNowRight}>
                    <div className={styles.sec}>
                      <h3 className={styles.secH}>
                        Referrals
                        <span className={styles.count}>{`${liveMovement?.referredUnitIds.length ?? 0} referred`}</span>
                      </h3>

                      {!liveMovement ? (
                        <p className={styles.pnAbsence}>No linked movement or ward referral record displayed.</p>
                      ) : liveMovement.acceptedUnitId ? (
                        <div>
                          <p className={styles.destBadge} data-k="accepted">
                            Accepted by {unitById(liveMovement.acceptedUnitId)?.name ?? "destination ward"}.
                          </p>
                        </div>
                      ) : (
                        <div className={styles.rows}>
                          {liveMovement.referredUnitIds.length > 0 ? (
                            <table className={styles.referralTable} aria-label="Network bed placement status">
                              <thead>
                                <tr>
                                  <th scope="col">Unit / Facility</th>
                                  <th scope="col">Status</th>
                                  <th scope="col">Outcome / Re-Ask Condition</th>
                                </tr>
                              </thead>
                              <tbody>
                                {liveMovement.referredUnitIds.map((uid) => {
                                  const unit = unitById(uid);
                                  const withdrawal = liveMovement.withdrawnReferrals.find((w) => w.unitId === uid);
                                  const isAccepted = liveMovement.acceptedUnitId === uid;
                                  return (
                                    <tr key={uid}>
                                      <td className={styles.unitNameCell}>
                                        {unit?.name ?? uid}
                                        <div style={{ fontSize: "var(--t-0)", color: "var(--muted)", fontWeight: 400 }}>
                                          {unit
                                            ? `${unit.cohort} · ${unit.lockedBeds > 0 ? "Secure" : "Open"}`
                                            : "Inpatient Unit"}
                                        </div>
                                      </td>
                                      <td>
                                        {isAccepted ? (
                                          <span
                                            className={styles.teleBadge}
                                            style={{ background: "var(--good-soft)", color: "var(--good-ink)" }}
                                          >
                                            Accepted
                                          </span>
                                        ) : withdrawal ? (
                                          <span className={styles.statusBadgeDeclined}>Declined</span>
                                        ) : (
                                          <span
                                            className={styles.teleBadge}
                                            style={{ background: "var(--surface-2)", color: "var(--ink-soft)" }}
                                          >
                                            Referred
                                          </span>
                                        )}
                                      </td>
                                      <td className={styles.reAskCell}>
                                        {isAccepted ? (
                                          <strong>Bed Allocated</strong>
                                        ) : withdrawal?.reason ? (
                                          <>
                                            {withdrawal.reason.replace(/_/g, " ")}.{" "}
                                            <strong>Re-check after shift handover</strong>
                                          </>
                                        ) : (
                                          "Awaiting response from bed manager"
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          ) : (
                            <p className={styles.pnAbsence}>Placement request active across network wards.</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className={styles.sec}>
                      <h3 className={styles.secH}>
                        Next steps<span className={styles.count}>{record.next.length}</span>
                      </h3>
                      <ol className={styles.nsteps}>
                        {record.next.map((n, i) => (
                          <li key={i} className={styles.nstep} data-tone={n.tone ?? undefined}>
                            <b>{fillTemplate(n.w, templateContext)}</b>
                            <span>{fillTemplate(n.d, templateContext)}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div className={styles.sec}>
                      <h3 className={styles.secH}>
                        Who to contact<span className={styles.count}>{record.ring.length}</span>
                      </h3>
                      <div className={styles.contactGrid}>
                        {record.ring.map((c, i) => (
                          <div key={i} className={styles.contactCard} data-tone={c.tone ?? undefined}>
                            <div className={styles.contactTop}>
                              <span className={styles.contactWho}>{c.who}</span>
                              <span className={styles.contactExt}>
                                {c.who.includes("ED")
                                  ? "Ext 8140"
                                  : c.who.includes("Coordinator") || c.who.includes("State")
                                    ? "Speed Dial 41"
                                    : "Ext 2209"}
                              </span>
                            </div>
                            <span className={styles.contactRole}>{fillTemplate(c.role, templateContext)}</span>
                            {c.note && <p className={styles.contactNote}>{fillTemplate(c.note, templateContext)}</p>}
                          </div>
                        ))}
                      </div>
                      <p className={styles.pnLadder}>{renderInlineText(record.ladder)}</p>
                    </div>

                    <div className={styles.sec}>
                      <h3 className={styles.secH}>Legal authority</h3>
                      <dl className={styles.slFacts}>
                        <dt>Status</dt>
                        <dd>{liveMovement?.legalStatus ?? "Not recorded"}</dd>
                        <dt>Form</dt>
                        <dd>
                          {liveMovement?.legalForm
                            ? `${legalFormName(liveMovement.legalForm)}${
                                liveMovement.legalForm.dueAt !== undefined
                                  ? `. Due ${clock(liveMovement.legalForm.dueAt)}.`
                                  : ". No deadline is recorded for it."
                              }`
                            : "No legal form recorded."}
                        </dd>
                      </dl>
                    </div>

                    <section
                      className={`${styles.sec} ${styles.transportSec}`}
                      aria-labelledby="pnTransportHeading"
                      data-testid="ward-patient-transport-section"
                    >
                      <div className={styles.transportHeader}>
                        <div className={styles.transportTitleCluster}>
                          <span className={styles.transportIcon} aria-hidden="true">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <rect x="1" y="3" width="15" height="13" />
                              <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
                              <circle cx="5.5" cy="18.5" r="2.5" />
                              <circle cx="18.5" cy="18.5" r="2.5" />
                            </svg>
                          </span>
                          <h3 id="pnTransportHeading" className={styles.secH} style={{ margin: 0 }}>
                            {liveMovement ? "Transport dispatch" : "Transport"}
                          </h3>
                        </div>
                        {liveMovement && (
                          <div className={styles.transportStatusCluster}>
                            <span
                              className={styles.transportBadge}
                              data-booked={isTransportBooked ? "true" : "false"}
                              data-testid="ward-patient-transport-badge"
                            >
                              {isTransportBooked ? "✓ Transport Booked" : "Awaiting Transport Booking"}
                            </span>
                            {!showTransportForm && (
                              <button
                                type="button"
                                className={
                                  isTransportBooked ? styles.transportActionBtnSecondary : styles.transportActionBtn
                                }
                                onClick={() => {
                                  setTransportCadDraft(displayCadNumber ?? "");
                                  setTransportEtaDraft(displayEta ?? "");
                                  setShowTransportForm(true);
                                }}
                                data-testid="ward-patient-book-transport-btn"
                              >
                                {isTransportBooked ? "Update Booking Details" : "Mark as Booked"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {liveMovement && bookingRejection && (
                        <p role="alert">Booking was not recorded: {bookingRejection.reason}</p>
                      )}
                      {/* Form for logging/updating transport */}
                      {liveMovement && showTransportForm && (
                        <form
                          className={styles.transportForm}
                          onSubmit={handleSaveTransportBooking}
                          data-testid="ward-patient-transport-form"
                        >
                          <div className={styles.transportFormGrid}>
                            <div className={styles.transportFormField}>
                              <label htmlFor="transport-cad" className={styles.transportFormLabel}>
                                CAD (dispatch) number <span style={{ color: "var(--danger)" }}>*</span>
                              </label>
                              <input
                                id="transport-cad"
                                type="text"
                                className={styles.transportInput}
                                placeholder="e.g. CAD-84920"
                                value={transportCadDraft}
                                onChange={(e) => setTransportCadDraft(e.target.value)}
                                required
                                data-testid="ward-patient-input-cad"
                              />
                            </div>

                            <div className={styles.transportFormField}>
                              <label htmlFor="transport-eta" className={styles.transportFormLabel}>
                                Quoted ETA by Transport Company
                              </label>
                              <input
                                id="transport-eta"
                                type="text"
                                className={styles.transportInput}
                                placeholder="e.g. 11:15 or ~45m"
                                value={transportEtaDraft}
                                onChange={(e) => setTransportEtaDraft(e.target.value)}
                                data-testid="ward-patient-input-eta"
                              />
                            </div>

                            <div className={styles.transportFormField}>
                              <label htmlFor="transport-provider" className={styles.transportFormLabel}>
                                Transport Provider
                              </label>
                              <select
                                id="transport-provider"
                                className={styles.transportSelect}
                                value={transportProviderDraft}
                                onChange={(e) => setTransportProviderDraft(e.target.value as TransportProvider)}
                                data-testid="ward-patient-select-provider"
                              >
                                {TRANSPORT_PROVIDERS.map((p) => (
                                  <option key={p} value={p}>
                                    {p}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className={styles.transportFormField}>
                              <label htmlFor="transport-legal" className={styles.transportFormLabel}>
                                Transport Legal Status
                              </label>
                              <select
                                id="transport-legal"
                                className={styles.transportSelect}
                                value={transportLegalDraft}
                                onChange={(e) => setTransportLegalDraft(e.target.value as TransportLegalStatus)}
                                data-testid="ward-patient-select-legal"
                              >
                                <option value="involuntary">Involuntary</option>
                                <option value="voluntary">Voluntary</option>
                              </select>
                            </div>
                          </div>

                          <div className={styles.transportCheckboxRow}>
                            <input
                              id="transport-escort"
                              type="checkbox"
                              checked={transportEscortDraft}
                              onChange={(e) => setTransportEscortDraft(e.target.checked)}
                              data-testid="ward-patient-checkbox-escort"
                            />
                            <label htmlFor="transport-escort">Clinical escort required for transfer</label>
                          </div>

                          <div className={styles.transportFormActions}>
                            <button
                              type="button"
                              className={styles.transportActionBtnSecondary}
                              onClick={() => setShowTransportForm(false)}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className={styles.transportActionBtn}
                              data-testid="ward-patient-confirm-transport-btn"
                            >
                              Save Transport Booking
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Display booked facts */}
                      {isTransportBooked && !showTransportForm && (
                        <div className={styles.transportGrid} data-testid="ward-patient-transport-details">
                          <div className={styles.transportFact}>
                            <span className={styles.transportFactLabel}>CAD (dispatch) number</span>
                            <span className={styles.transportFactValue} data-testid="ward-patient-cad-number">
                              {displayCadNumber || "Not recorded"}
                            </span>
                          </div>
                          <div className={styles.transportFact}>
                            <span className={styles.transportFactLabel}>Quoted ETA</span>
                            <span className={styles.transportFactValue} data-testid="ward-patient-transport-eta">
                              {displayEta || "Not recorded"}
                            </span>
                          </div>
                          <div className={styles.transportFact}>
                            <span className={styles.transportFactLabel}>Transport Provider</span>
                            <span className={styles.transportFactValue} data-testid="ward-patient-transport-provider">
                              {displayProvider}
                            </span>
                          </div>
                          <div className={styles.transportFact}>
                            <span className={styles.transportFactLabel}>Authority / Escort</span>
                            <span className={styles.transportFactValue} data-testid="ward-patient-transport-authority">
                              {displayLegalStatus}{" "}
                              {displayEscort === undefined
                                ? "· Escort not recorded"
                                : displayEscort
                                  ? "· Escort req."
                                  : "· No escort"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Empty state when not booked */}
                      {!liveMovement || (!isTransportBooked && !showTransportForm) ? (
                        <div className={styles.transportEmptyState}>
                          <p className={styles.transportEmptyText}>
                            {liveMovement ? (
                              <>
                                No transport vehicle has been logged for this patient yet. Once arranged by phone with
                                the transport provider, click <strong>Mark as Booked</strong> to record the CAD
                                (dispatch) number and quoted ETA.
                              </>
                            ) : (
                              "No linked transport record displayed."
                            )}
                          </p>
                        </div>
                      ) : null}
                    </section>
                  </div>
                </div>
              </div>

              {/* Tab 2: HISTORY */}
              <div
                className={styles.tabPane}
                role="tabpanel"
                id="pnpane-history"
                aria-labelledby="pntab-history"
                hidden={activeTab !== "history"}
              >
                <div className={styles.sec}>
                  <div className={styles.referralFilterRow}>
                    <h3 className={styles.secH} style={{ margin: 0 }}>
                      Presentations
                      <span className={styles.count}>{presentations.length}</span>
                      {/* Josh, 25 Sept 2026: the past presentations are written for the sample scenarios,
                          not recorded, so the history says it is an example. */}
                      {record.presentations.length > 0 ? (
                        <span className={styles.count} data-testid="pn-history-example-label">
                          Example history
                        </span>
                      ) : null}
                    </h3>

                    <div className={styles.segmentedControl} role="group" aria-label="History filter">
                      <button
                        type="button"
                        className={styles.segmentBtn}
                        aria-pressed={historyFilter === "all"}
                        onClick={() => setHistoryFilter("all")}
                      >
                        All ({rawPresentations.length})
                      </button>
                      <button
                        type="button"
                        className={styles.segmentBtn}
                        aria-pressed={historyFilter === "emergency"}
                        onClick={() => setHistoryFilter("emergency")}
                      >
                        Emergency
                      </button>
                      <button
                        type="button"
                        className={styles.segmentBtn}
                        aria-pressed={historyFilter === "inpatient"}
                        onClick={() => setHistoryFilter("inpatient")}
                      >
                        Inpatient
                      </button>
                    </div>
                  </div>

                  {/* Multi-year Timeline SVG Chart */}
                  <div className={`${styles.pnScrollX} ${styles.pnChart}`}>
                    <svg
                      viewBox="0 0 1000 110"
                      className={styles.historyTimelineSvg}
                      role="img"
                      aria-label="Multi-year presentation frequency timeline from 2019 to 2027"
                    >
                      {/* Grid lines and year marks */}
                      {[2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027].map((year) => {
                        const px = getPx(year);
                        return (
                          <g key={year}>
                            <line className={styles.gridLine} x1={px} y1={20} x2={px} y2={baseY} />
                            {year < 2027 && (
                              <text className={styles.tickText} x={px} y={96} textAnchor="middle">
                                {year}
                              </text>
                            )}
                          </g>
                        );
                      })}

                      {/* Presentation Episode Mark circles */}
                      {presentations.map((p, i) => {
                        const px = getPx(p.year);
                        const isCurrent = Boolean(p.current);
                        const isSelected = selectedEpisodeIndex === i;
                        return (
                          <button
                            key={i}
                            type="button"
                            className={styles.cmark}
                            aria-label={`${p.date}, ${p.where} to ${p.to}, ${p.los}. Open this presentation.`}
                            aria-pressed={isSelected}
                            onClick={() => setSelectedEpisodeIndex(i)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedEpisodeIndex(i);
                              }
                            }}
                            style={{ cursor: "pointer", background: "none", border: "none", padding: 0 }}
                          >
                            <circle className={styles.chalo} cx={px} cy={baseY} r={13} />
                            <circle
                              className={styles.pnMark}
                              cx={px}
                              cy={baseY}
                              r={isCurrent ? 7 : 5}
                              data-current={isCurrent ? "true" : undefined}
                              stroke={isSelected ? "var(--gilt)" : undefined}
                              strokeWidth={isSelected ? 2 : undefined}
                            />
                          </button>
                        );
                      })}

                      <text
                        x={getPx(2026.62)}
                        y={baseY - 17}
                        textAnchor="end"
                        className={styles.tickText}
                        style={{ fill: "var(--accent-ink)", fontWeight: 600 }}
                      >
                        open now
                      </text>
                    </svg>
                  </div>

                  {/* Presentation Episode Cards */}
                  <div className={styles.rows} style={{ marginTop: "14px" }}>
                    {presentations.map((p, i) => (
                      <div
                        key={i}
                        className={styles.row}
                        style={{
                          border: selectedEpisodeIndex === i ? "1px solid var(--accent)" : undefined,
                        }}
                      >
                        <span className={styles.rowTop}>
                          <strong>
                            {p.date} · {p.where}
                          </strong>
                          <span className={styles.when}>{p.los}</span>
                        </span>
                        <span className={styles.rowSub}>
                          Destination: <strong>{p.to}</strong> · Outcome: {p.outcome}
                        </span>
                        {p.story && <span className={styles.rowWho}>{p.story}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tab 3: COMMUNITY */}
              <div
                className={styles.tabPane}
                role="tabpanel"
                id="pnpane-community"
                aria-labelledby="pntab-community"
                hidden={activeTab !== "community"}
              >
                <div className={styles.sec}>
                  <h3 className={styles.secH}>
                    Community team
                    <span className={styles.count}>
                      {record.community.teams.length ? `${record.community.teams.length} on record` : "none"}
                    </span>
                  </h3>

                  {record.community.teams.length > 0 ? (
                    <div className={styles.rows}>
                      {record.community.teams.map((t, i) => (
                        <div key={i} className={styles.row}>
                          <span className={styles.rowTop}>
                            <strong>{t.name}</strong>
                            <span className={styles.when}>{t.state}</span>
                          </span>
                          <span className={styles.rowSub}>{t.note}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.pnAbsence}>{record.community.absent}</p>
                  )}
                </div>

                <div className={styles.sec}>
                  <h3 className={styles.secH}>Follow up</h3>
                  <p className={styles.pnProse}>{record.community.followUp}</p>
                </div>
              </div>

              {/* Tab 4: DETAILS */}
              <div
                className={styles.tabPane}
                role="tabpanel"
                id="pnpane-details"
                aria-labelledby="pntab-details"
                hidden={activeTab !== "details"}
              >
                <div className={styles.sec} data-testid="ward-person-placement-details">
                  <h3 className={styles.secH}>Identity</h3>
                  <dl className={styles.slFacts}>
                    <dt>Name</dt>
                    <dd>{displayName}</dd>
                    <dt>Preferred name</dt>
                    <dd>{preferredName ?? "None recorded"}</dd>
                    {/* Owner, 26 Sept 2026: dropped the WF journey number row — Record number (UMRN) below already carries the identifier. */}
                    <dt>Record number</dt>
                    <dd>{livePatient?.umrn ?? "Not recorded"}</dd>
                    <dt>Date of birth</dt>
                    <dd>{livePatient?.dateOfBirth ?? "Not recorded"}</dd>
                    <dt>Age band</dt>
                    <dd>{liveMovement?.cohort ?? "Not recorded"}</dd>
                    <dt>Sex</dt>
                    <dd>{liveMovement?.sex ?? livePatient?.sex ?? "Not recorded"}</dd>
                    <dt>Gender</dt>
                    <dd>{liveMovement?.gender ?? livePatient?.gender ?? "Not recorded"}</dd>
                  </dl>
                </div>

                <div className={styles.sec}>
                  <h3 className={styles.secH}>Location and care</h3>
                  <dl className={styles.slFacts}>
                    <dt>Address</dt>
                    <dd>{livePatient?.address ?? "Not recorded"}</dd>
                    <dt>Suburb</dt>
                    <dd>{livePatient?.suburb ?? "Not recorded"}</dd>
                    <dt>Aboriginal or Torres Strait Islander status</dt>
                    <dd>{livePatient?.aboriginalOrTorresStraitIslanderStatus ?? "Not stated"}</dd>
                    <dt>GP</dt>
                    <dd>{livePatient?.generalPractitioner ?? "Not recorded"}</dd>
                    <dt>Interpreter / preferred language</dt>
                    <dd>{livePatient?.interpreterLanguage ?? "Not recorded"}</dd>
                    <dt>Catchment community team</dt>
                    <dd>{livePatient?.catchmentCommunityTeam ?? "Not recorded"}</dd>
                    <dt>Legal status</dt>
                    <dd>{liveMovement?.legalStatus ?? livePatient?.legalStatus ?? "Not recorded"}</dd>
                    <dt>Health service</dt>
                    <dd>Not recorded</dd>
                    <dt>Owner</dt>
                    <dd>{liveMovement?.owner?.trim() || "Not recorded"}</dd>
                  </dl>
                </div>
              </div>

              {/* Tab 5: DOCUMENTS */}
              <div
                className={styles.tabPane}
                role="tabpanel"
                id="pnpane-documents"
                aria-labelledby="pntab-documents"
                hidden={activeTab !== "documents"}
              >
                <div className={styles.sec}>
                  <h3 className={styles.secH}>
                    Documents<span className={styles.count}>{record.documents.length}</span>
                  </h3>

                  <div className={styles.tableWrap}>
                    <table className={styles.dataTable}>
                      <thead>
                        <tr>
                          <th scope="col">Type</th>
                          <th scope="col">Document</th>
                          <th scope="col">From</th>
                          <th scope="col">Date</th>
                          <th scope="col">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {record.documents.map((d, i) => (
                          <tr key={i}>
                            <td>
                              <span className={styles.fcode}>{fillTemplate(d.code, templateContext)}</span>
                            </td>
                            <td>{fillTemplate(d.name, templateContext)}</td>
                            <td>{d.from}</td>
                            <td>{d.when}</td>
                            <td>
                              <span className={styles.statusPill} data-status={d.status}>
                                {fillTemplate(d.status, templateContext)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Discreet provenance legal notice */}
              <div className={styles.pnFoot}>
                <p className={styles.provenanceSentence}>
                  Every figure on this screen is invented — nobody here is a real person and nothing here is a clinical
                  record.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {showClearanceModal && (
        <div
          className={styles.clearanceModalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="clearanceModalTitle"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowClearanceModal(false);
          }}
        >
          <div className={styles.clearanceModalBox}>
            <div className={styles.clearanceModalHead}>
              <h2 id="clearanceModalTitle" className={styles.clearanceModalTitle}>
                Request Emergency Department Medical Clearance
              </h2>
              <button
                type="button"
                className={styles.clearanceModalClose}
                onClick={() => setShowClearanceModal(false)}
                aria-label="Close dialog"
              >
                &times;
              </button>
            </div>
            <div className={styles.clearanceModalBody}>
              <p>
                Record the medical clearance provided by the treating team. This prototype does not determine fitness
                for transport or legal transfer requirements.
              </p>
              <div
                style={{
                  background: "var(--surface-2)",
                  padding: "10px",
                  borderRadius: "var(--r1)",
                  fontSize: "var(--t-0)",
                  border: "1px solid var(--line)",
                }}
              >
                <strong>Current Status:</strong> Fit to travel: <em>Not Assessed</em>
                <br />
                <strong>Required Sign-off:</strong> Emergency Medicine Consultant / Senior Registrar on duty at{" "}
                {liveMovement
                  ? (edById(liveMovement.originEdId)?.name ?? "Emergency Department")
                  : "Emergency Department"}
                .
              </div>
              <p>Submit request notification to ED triage &amp; Duty Medical Officer:</p>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "var(--t-0)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={clearanceUrgent}
                  onChange={(e) => setClearanceUrgent(e.target.checked)}
                />{" "}
                Flag request as high urgency (bed placement dependent)
              </label>
              {clearanceConfirmed && (
                <div
                  role="status"
                  style={{
                    background: "var(--good-soft)",
                    color: "var(--good-ink)",
                    padding: "8px 12px",
                    borderRadius: "var(--r1)",
                    fontSize: "var(--t-0)",
                    fontWeight: 600,
                  }}
                >
                  ✓ Clearance request dispatched to ED Duty Doctor.
                </div>
              )}
            </div>
            <div className={styles.clearanceModalFoot}>
              <button type="button" className={styles.ctl} onClick={() => setShowClearanceModal(false)}>
                Close
              </button>
              <button
                type="button"
                className={`${styles.ctl} ${styles.ctlPrimary}`}
                onClick={() => {
                  setClearanceConfirmed(true);
                  setTimeout(() => {
                    setShowClearanceModal(false);
                    setClearanceConfirmed(false);
                  }, 1200);
                }}
              >
                Dispatch Clearance Request
              </button>
            </div>
          </div>
        </div>
      )}

      {targetMovement && (
        <>
          <ArrivalTimeModal
            isOpen={showArrivalTimeModal}
            onClose={() => setShowArrivalTimeModal(false)}
            movement={targetMovement}
          />
          <UploadFormsModal
            isOpen={showUploadFormsModal}
            onClose={() => setShowUploadFormsModal(false)}
            movement={targetMovement}
          />
        </>
      )}
    </main>
  );
}
