"use client";

import Link from "next/link";
import {
  AlertCircle,
  BedDouble,
  Check,
  Clock,
  Copy,
  FileText,
  FileUp,
  Gauge,
  MapPin,
  Scale,
  ShieldCheck,
  TriangleAlert,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { PatientHistoryTab, PatientCommunityTab, PatientDetailsTab, PatientDocumentsTab } from "./patient-dossier-tabs";
import { PatientClinicalSummary } from "./patient-clinical-summary";
import { PatientTrackerFacts } from "./patient-tracker-facts";
import { PatientRecordOverview } from "./patient-record-overview";
import { PatientFlightHeader } from "./patient-flight-header";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { edById } from "@/components/ward-management/ward-sites";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { Movement, TransportProvider, TransportLegalStatus } from "@/components/ward-management/ward-model";
import { TRANSPORT_PROVIDERS, ARRIVAL_MODE_LABELS } from "@/components/ward-management/ward-model";
import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import { UploadFormsModal } from "@/components/ward-management/referrals/upload-forms-modal";
import type { Patient, PatientId } from "@/components/ward-management/ward-patients";
import {
  LATE_ARRIVAL_GRACE_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";
import { PersonScreen } from "./person-screen";
import { PatientTransitOperations } from "./patient-transit-operations";
import { pullHoldRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { resolvePatientNowRecord } from "./patient-now-adapter";
import { type PatientNowRecord, STAGES, clock, dur, fillTemplate } from "./patient-now-records";
import styles from "./patient-now.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { Badge, Button, Card, CardHead, LiveChip, StatusGlyph, buttonClass } from "@/components/wf";

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
  initialTaskAction?: "refer" | "contact";
  initialExampleId?: "WF-009" | "WF-004";
}

type TabKey = "now" | "history" | "community" | "details" | "documents";

export function PatientNowScreen({
  patientId,
  movementId,
  initialExampleId = "WF-009",
  initialTaskAction,
}: PatientNowScreenProps) {
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

  const [activeTab, setActiveTab] = useState<TabKey>(initialTaskAction === "contact" ? "community" : "now");
  const [nowView, setNowView] = useState<"auto" | "clinical" | "operations">(
    initialTaskAction === "refer" ? "operations" : "auto",
  );
  const operationsRef = useRef<HTMLDivElement | null>(null);
  function openOperations() {
    setActiveTab("now");
    setNowView("operations");
    requestAnimationFrame(() => {
      operationsRef.current?.focus();
      operationsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }
  const [copied, setCopied] = useState(false);

  // Transport booking state & overrides
  const [showTransportForm, setShowTransportForm] = useState(false);
  const [showArrivalTimeModal, setShowArrivalTimeModal] = useState(false);
  const [showUploadFormsModal, setShowUploadFormsModal] = useState(false);
  const [showClearanceModal, setShowClearanceModal] = useState(false);
  const clearanceTriggerRef = useRef<HTMLButtonElement | null>(null);
  const clearanceModalRef = useRef<HTMLDivElement | null>(null);
  const [clearanceDraft, setClearanceDraft] = useState<"" | "cleared" | "not-cleared">("");
  const [clearanceAttested, setClearanceAttested] = useState(false);
  const [transportCadDraft, setTransportCadDraft] = useState("");
  const [transportEtaDraft, setTransportEtaDraft] = useState("");
  const [transportProviderDraft, setTransportProviderDraft] = useState<TransportProvider>("Ambulance service");
  const [transportLegalDraft, setTransportLegalDraft] = useState<TransportLegalStatus>("involuntary");
  const [transportEscortDraft, setTransportEscortDraft] = useState(false);
  const [bookingRejectionStart, setBookingRejectionStart] = useState<number>();

  const closeClearanceModal = useCallback(() => {
    setShowClearanceModal(false);
    clearanceTriggerRef.current?.focus();
  }, [setShowClearanceModal]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!showClearanceModal) return;
      if (event.key === "Escape") {
        closeClearanceModal();
        return;
      }
      if (event.key === "Tab" && clearanceModalRef.current) {
        const focusable = clearanceModalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          last.focus();
          event.preventDefault();
        } else if (!event.shiftKey && document.activeElement === last) {
          first.focus();
          event.preventDefault();
        }
      }
    }
    if (showClearanceModal) {
      window.addEventListener("keydown", handleKeyDown);
      queueMicrotask(() => {
        const first = clearanceModalRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        first?.focus();
      });
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showClearanceModal, closeClearanceModal]);

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
  const [expandedStageIndex, setExpandedStageIndex] = useState<number | null>(null);
  const [focusedStageIndex, setFocusedStageIndex] = useState<number>(currentStageIndex);
  const [prevStageIndex, setPrevStageIndex] = useState(currentStageIndex);
  const stageButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (prevStageIndex !== currentStageIndex) {
    setPrevStageIndex(currentStageIndex);
    setExpandedStageIndex(null);
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
  const isLiveBedflow = Boolean(liveMovement && !liveMovement.closure && liveMovement.stage !== "arrived");
  const effectiveNowView = nowView === "auto" ? (isLiveBedflow ? "operations" : "clinical") : nowView;
  const isPulled = isLiveBedflow && liveMovement?.pullExpiresAt !== undefined;

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
  const isTransportBooked = liveMovement?.transport !== undefined && liveMovement.transport.cancelledAt === undefined;
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

  const originName = liveMovement ? (edById(liveMovement.originEdId)?.name ?? "Origin not recorded") : undefined;
  const tierTone = urgencyTier === 1 ? "danger" : urgencyTier === 2 ? "warning" : "neutral";
  const documentCount = record.documents.length + uploadedForms.length;
  const expandedStage = isLiveBedflow && expandedStageIndex !== null ? STAGES[expandedStageIndex] : undefined;
  const expandedStageDetail = expandedStage ? getStageBedflowDetail(expandedStage.id, liveMovement) : undefined;
  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: "now", label: "Now", count: (liveMovement?.withdrawnReferrals.length ?? 0) + 1 },
    { key: "history", label: "History", count: record.presentations.length },
    { key: "community", label: "Community", count: record.community.teams.length },
    { key: "details", label: "Details" },
    { key: "documents", label: "Documents", count: documentCount },
  ];

  return (
    <main
      id="main-content"
      className={styles.screen}
      data-testid="ward-person-screen"
      data-ward-design="v6"
      data-ward-rebuilt-screen="patient-now"
      data-bedflow={isLiveBedflow ? "live" : "inactive"}
      data-active-tab={activeTab}
    >
      <div className={styles.v6Page}>
        {livePatient?.confidential && (
          <div className={styles.v6Confidential} role="alert" data-testid="ward-patient-confidential-banner">
            <strong>Restricted record</strong>
            <span>This record has restricted access flags. Handle it under the clinical privacy protocol.</span>
          </div>
        )}
        {/* v6 (Patient.png): the hero, the stage detail when a stage is open, the readiness and next
            step cards, then the movement facts. */}
        <section className={styles.v6Summary} id="pnSubject" aria-label="Patient summary">
          <PatientFlightHeader
            displayName={displayName}
            preferredName={preferredName}
            patient={livePatient}
            displayToday={displayToday}
            isLiveBedflow={isLiveBedflow}
            location={originName ?? livePatient?.suburb}
            statusDetail={
              isLiveBedflow
                ? `Stage ${currentStageIndex + 1} / 7 · ${STAGES[currentStageIndex].label}`
                : liveMovement?.stage === "arrived"
                  ? "Arrived · transfer complete"
                  : liveMovement?.closure
                    ? "Referral closed · no active transfer"
                    : "No active transfer"
            }
            facts={
              isLiveBedflow && liveMovement ? (
                <span className={styles.v6HeroFacts}>
                  <span className={styles.v6HeroFact}>
                    <StatusGlyph tone={tierTone} size={9} />
                    Tier {urgencyTier ?? "not recorded"} · {(liveMovement.security ?? "not recorded").toLowerCase()}
                  </span>
                  {liveMovement.specialling ? (
                    <span className={styles.v6HeroFact}>
                      <StatusGlyph tone="warning" size={9} />
                      1:1 specialling
                    </span>
                  ) : null}
                  <span className={styles.v6HeroFact}>
                    <Clock size={14} aria-hidden="true" />
                    <strong className={styles.v6HeroWait}>{waitedStr}</strong>
                    since opened
                  </span>
                </span>
              ) : null
            }
            steps={
              isLiveBedflow ? (
                <ol
                  className={styles.v6Steps}
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
                      <li key={s.id} className={styles.v6Step} data-s={stateAttr}>
                        <button
                          type="button"
                          id={`stage-header-${s.id}`}
                          ref={(el) => {
                            stageButtonRefs.current[i] = el;
                          }}
                          tabIndex={focusedStageIndex === i ? 0 : -1}
                          aria-current={stateAttr === "now" ? "step" : undefined}
                          className={styles.v6StepBtn}
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
                        >
                          <span className={styles.v6StepMark} aria-hidden="true">
                            {stateAttr === "recorded" ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : i + 1}
                          </span>
                          <span className={styles.v6StepLabel}>{s.label}</span>
                          <span className="sr-only">, {whenText}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              ) : null
            }
            tabs={
              <div className={styles.v6Tabs} role="tablist" aria-label="The record" onKeyDown={handleTabKeyDown}>
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    className={styles.v6Tab}
                    type="button"
                    role="tab"
                    id={`pntab-${tab.key}`}
                    aria-controls={`pnpane-${tab.key}`}
                    aria-selected={activeTab === tab.key}
                    tabIndex={activeTab === tab.key ? 0 : -1}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                    {tab.count !== undefined ? (
                      <span className={styles.v6TabCount} id={`pncount-${tab.key}`}>
                        {tab.count}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            }
            actions={
              <>
                <LiveChip state="live" onHero />
                <Button variant="onHero" size="sm" icon={Copy} onClick={handleCopySummary}>
                  {copied ? "Copied" : "Copy handover"}
                </Button>
                {liveMovement ? (
                  <Button
                    variant="light"
                    size="sm"
                    icon={BedDouble}
                    onClick={openOperations}
                    data-testid="ward-person-refer"
                  >
                    Place them
                  </Button>
                ) : (
                  <Link
                    href={
                      livePatient
                        ? `/mockups/ward-flow/referrals/new?patientId=${encodeURIComponent(livePatient.id)}`
                        : "/mockups/ward-flow/referrals/new"
                    }
                    className={buttonClass({ variant: "light", size: "sm" })}
                    data-testid="ward-person-refer-outpatient"
                  >
                    + Raise Inpatient Referral
                  </Link>
                )}
              </>
            }
          />
          {!liveMovement && (
            <div className={styles.v6Notice} data-testid="ward-community-masthead">
              Patient record only. No linked movement is displayed; active community care is not established by this
              record.
            </div>
          )}

          {expandedStage && expandedStageDetail ? (
            <Card
              className={styles.v6StagePanel}
              id={`stage-panel-${expandedStage.id}`}
              role="region"
              aria-labelledby={`stage-header-${expandedStage.id}`}
              data-testid={`ward-patient-stage-panel-${expandedStage.id}`}
            >
              <CardHead
                title={expandedStage.label}
                aside={
                  <Badge tone={expandedStageDetail.badgeTone === "accent" ? "info" : "neutral"}>
                    {expandedStageDetail.statusText}
                  </Badge>
                }
              />
              <div className={styles.v6StagePanelBody}>
                <p>{expandedStageDetail.summary}</p>
                {expandedStageDetail.milestones.length > 0 && (
                  <ul className={styles.v6Milestones}>
                    {expandedStageDetail.milestones.map((m, mi) => (
                      <li key={mi}>
                        {m.time && <span className={styles.v6Mono}>{m.time}</span>}
                        <span>
                          {m.label}. {m.detail}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Button size="sm" onClick={openOperations}>
                  Review stage actions
                </Button>
              </div>
            </Card>
          ) : null}

          {/* The readiness and next step cards stay on every tab: their shortcuts open Now, Details and
              Documents. The facts strip belongs to Now, as in the v6 tab mockups. */}
          <div className={styles.v6SummaryRow}>
            {/* Readiness: the movement's own gate verdict, or the plain statement that none is recorded. */}
            <Card className={styles.v6Gates}>
              <CardHead
                icon={TriangleAlert}
                title={
                  <span className={styles.v6GateTitle} data-tone={record.verdict.tone}>
                    {record.verdict.title}
                  </span>
                }
                aside={
                  <Badge tone={record.verdict.gates.length > 0 ? "danger" : "neutral"}>
                    {record.verdict.gates.length > 0
                      ? `${record.verdict.gates.length} missing gates`
                      : "No gate assessment recorded"}
                  </Badge>
                }
              />
              {record.verdict.gates.length > 0 ? (
                <ul className={styles.v6GateList}>
                  {record.verdict.gates.map((gate, i) => (
                    <li key={i} className={styles.v6Gate}>
                      <StatusGlyph tone="closed" size={10} />
                      <div className={styles.v6GateText}>
                        <strong>
                          {gate.label} <span className={styles.v6GateVerdict}>{gate.verdict}</span>
                        </strong>
                        <span>{gate.detail}</span>
                      </div>
                      {gate.label.toLowerCase().includes("bed") ? (
                        <Button size="sm" onClick={openOperations}>
                          View movement referrals
                        </Button>
                      ) : (
                        <button
                          ref={clearanceTriggerRef}
                          type="button"
                          className={buttonClass({ size: "sm" })}
                          onClick={() => setShowClearanceModal(true)}
                        >
                          Request ED clearance
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className={styles.v6GateClear}>
                  <strong>Transfer readiness not assessed here</strong>
                  <span>
                    {fillTemplate(record.verdict.none ?? "No movement gate assessment is recorded.", templateContext)}
                  </span>
                </div>
              )}
            </Card>

            <Card className={styles.v6Next}>
              <div className={styles.v6NextBody} role="region" aria-label="Next steps">
                <span className={styles.v6Eyebrow}>Next step</span>
                {record.next[0] ? (
                  <>
                    <strong>Next: {fillTemplate(record.next[0].w, templateContext)}</strong>
                    <span>{fillTemplate(record.next[0].d, templateContext)}</span>
                  </>
                ) : (
                  <span>No next steps recorded.</span>
                )}
              </div>
              <div className={styles.v6QuickLinks}>
                <button
                  type="button"
                  className={styles.v6QuickLink}
                  onClick={() => {
                    const target = liveMovement ? "now" : "details";
                    setActiveTab(target);
                    if (liveMovement) setNowView("clinical");
                    requestAnimationFrame(() => document.getElementById(`pntab-${target}`)?.focus());
                  }}
                >
                  <ShieldCheck size={15} aria-hidden="true" />
                  {liveMovement ? "Clinical checks" : "Patient details"}
                  <span className={styles.v6QuickLinkMeta}>
                    {liveMovement
                      ? liveMovement.medicalClearance
                        ? liveMovement.medicalClearance.cleared
                          ? "Clearance recorded"
                          : "Not cleared"
                        : "Unassessed"
                      : "Record"}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.v6QuickLink}
                  onClick={() => {
                    setActiveTab("documents");
                    requestAnimationFrame(() => document.getElementById("pntab-documents")?.focus());
                  }}
                >
                  <FileText size={15} aria-hidden="true" />
                  Documents
                  <span className={styles.v6QuickLinkMeta}>{documentCount}</span>
                </button>
              </div>
            </Card>
          </div>

          {/* The movement facts strip: where now, priority, legal authority, transport or hold. */}
          <Card className={styles.v6Facts} aria-label="Current bedflow snapshot" hidden={activeTab !== "now"}>
            <div className={styles.v6Fact}>
              <MapPin size={16} aria-hidden="true" className={styles.v6FactIcon} />
              <div>
                <span className={styles.v6Eyebrow}>{isLiveBedflow ? "Where now" : "Record context"}</span>
                <strong>{originName ?? livePatient?.suburb ?? "Location not recorded"}</strong>
                <small>
                  {liveMovement
                    ? `To ${acceptingUnit?.name ?? "destination under review"}`
                    : "No active bedflow journey"}
                </small>
              </div>
            </div>
            <div className={styles.v6Fact}>
              <Gauge size={16} aria-hidden="true" className={styles.v6FactIcon} />
              <div>
                <span className={styles.v6Eyebrow}>Priority and need</span>
                <strong>
                  {isLiveBedflow
                    ? `Tier ${urgencyTier ?? "not recorded"} · ${liveMovement?.security ?? "Not recorded"}`
                    : "No transfer priority"}
                </strong>
                <small>
                  {isLiveBedflow
                    ? `${waitedStr} since opened${liveMovement?.specialling ? " · 1:1 specialling" : ""}`
                    : "Clinical record available below"}
                </small>
              </div>
            </div>
            <div className={styles.v6Fact}>
              <Scale size={16} aria-hidden="true" className={styles.v6FactIcon} />
              <div>
                <span className={styles.v6Eyebrow}>Legal authority</span>
                <strong>{liveMovement?.legalStatus ?? livePatient?.legalStatus ?? "Not recorded"}</strong>
                <small>
                  {liveMovement?.legalForm
                    ? `Form ${liveMovement.legalForm.code}${liveMovement.legalForm.dueAt !== undefined ? ` · due ${clock(liveMovement.legalForm.dueAt)} AWST` : ""}`
                    : "No legal form recorded"}
                </small>
              </div>
            </div>
            <div className={styles.v6Fact} data-attention={isLiveBedflow && (isHoldExpired || isOverdue)}>
              <Truck size={16} aria-hidden="true" className={styles.v6FactIcon} />
              <div>
                <span className={styles.v6Eyebrow}>{isLiveBedflow ? "Transport or hold" : "Care link"}</span>
                <strong>
                  {isLiveBedflow
                    ? isTransportBooked
                      ? `${displayProvider} · ${displayEta ?? "ETA pending"}`
                      : hasArrivalPlan
                        ? `Arrival ${clock(liveMovement!.arrivalDetails!.estimatedArrivalAt)} AWST`
                        : pullExpiresAt !== undefined
                          ? pullHoldRemainingLabel(pullExpiresAt, now)
                          : "Not booked"
                    : (livePatient?.catchmentCommunityTeam ?? "Not recorded")}
                </strong>
                <small>
                  {isLiveBedflow
                    ? liveMovement?.arrivalDetails?.trackingNumber
                      ? liveMovement.arrivalDetails.trackingNumber
                      : displayCadNumber
                        ? `CAD ${displayCadNumber}`
                        : "CAD not recorded"
                    : "Recorded catchment · care status unconfirmed"}
                </small>
              </div>
            </div>
          </Card>

          {/* Pulled Bed & Arrival Coordination Section */}
          {isPulled && (
            <details className={styles.arrivalDisclosure}>
              <summary>Arrival plan & transport documents</summary>
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
                      {liveMovement?.arrivalDetails?.trackingNumber || displayCadNumber || "Not recorded"}
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
            </details>
          )}
        </section>

        {/* v6: the record pane, with the live journey rail beside it on Now. */}
        <div className={styles.v6Grid} data-rail={activeTab === "now"}>
          <section className={styles.v6Main} id="pnTabs" aria-label="The record">
            <div className={styles.v6TabBody} id="pnBody" tabIndex={0}>
              {/* Tab 1: NOW */}
              <div
                className={styles.v6TabPane}
                role="tabpanel"
                id="pnpane-now"
                aria-labelledby="pntab-now"
                hidden={activeTab !== "now"}
              >
                {liveMovement && (
                  <>
                    <div className={styles.nowViewSwitch} role="group" aria-label="Now view">
                      <button
                        type="button"
                        aria-pressed={effectiveNowView === "clinical"}
                        onClick={() => setNowView("clinical")}
                      >
                        Clinical overview
                      </button>
                      <button type="button" aria-pressed={effectiveNowView === "operations"} onClick={openOperations}>
                        Transit operations
                      </button>
                      <span>One record · clinical context and bedflow</span>
                    </div>
                    <div
                      id="patient-operations"
                      ref={operationsRef}
                      tabIndex={-1}
                      hidden={effectiveNowView !== "operations"}
                      aria-label="Transit operations workspace"
                    >
                      <PatientTransitOperations key={liveMovement.id} movement={liveMovement} />
                    </div>
                  </>
                )}
                {!liveMovement ? (
                  <PatientRecordOverview
                    patient={livePatient}
                    record={record}
                    onOpen={(tab) => {
                      setActiveTab(tab);
                      requestAnimationFrame(() => document.getElementById(`pntab-${tab}`)?.focus());
                    }}
                  />
                ) : (
                  <div className={styles.clinicalView} hidden={effectiveNowView !== "clinical"}>
                    <PatientClinicalSummary
                      movement={liveMovement}
                      patient={livePatient}
                      record={record}
                      receivingWardName={acceptingUnit?.name}
                      bedState={
                        admissions.find((a) => a.id === liveMovement.admissionId || a.movementId === liveMovement.id)
                          ?.state
                      }
                      onCoordinate={openOperations}
                      onClearance={(event) => {
                        clearanceTriggerRef.current = event.currentTarget;
                        setClearanceDraft("");
                        setClearanceAttested(false);
                        setShowClearanceModal(true);
                      }}
                    />
                    <details className={styles.legacyTransportDisclosure}>
                      <summary>Transport booking record</summary>
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
                                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
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
                              <span
                                className={styles.transportFactValue}
                                data-testid="ward-patient-transport-authority"
                              >
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
                    </details>
                  </div>
                )}
              </div>

              {/* Tab 2: HISTORY */}
              <div
                className={styles.v6TabPane}
                role="tabpanel"
                id="pnpane-history"
                aria-labelledby="pntab-history"
                hidden={activeTab !== "history"}
              >
                <PatientHistoryTab record={record} movement={liveMovement} />
              </div>

              {/* Tab 3: COMMUNITY */}
              <div
                className={styles.v6TabPane}
                role="tabpanel"
                id="pnpane-community"
                aria-labelledby="pntab-community"
                hidden={activeTab !== "community"}
              >
                <PatientCommunityTab
                  record={record}
                  patient={livePatient}
                  movement={liveMovement}
                  receivingWardName={acceptingUnit?.name}
                />
              </div>

              {/* Tab 4: DETAILS */}
              <div
                className={styles.v6TabPane}
                role="tabpanel"
                id="pnpane-details"
                aria-labelledby="pntab-details"
                hidden={activeTab !== "details"}
              >
                <PatientDetailsTab
                  patient={livePatient}
                  movement={liveMovement}
                  displayName={displayName}
                  preferredName={preferredName}
                />
              </div>

              {/* Tab 5: DOCUMENTS */}
              <div
                className={styles.v6TabPane}
                role="tabpanel"
                id="pnpane-documents"
                aria-labelledby="pntab-documents"
                hidden={activeTab !== "documents"}
              >
                <PatientDocumentsTab
                  record={{
                    ...record,
                    documents: record.documents.map((d) => ({
                      ...d,
                      code: fillTemplate(d.code, templateContext),
                      name: fillTemplate(d.name, templateContext),
                      status: fillTemplate(d.status, templateContext),
                    })),
                  }}
                  movement={liveMovement}
                  now={now}
                  onRecordDocument={() => setShowUploadFormsModal(true)}
                />
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
          {activeTab === "now" ? (
            <div className={styles.v6Rail}>
              <Card className={styles.v6RailCard} id="pnJourney" aria-labelledby="pnJourneyH">
                <div className={styles.v6RailStatus} data-live={isLiveBedflow}>
                  <span className={styles.v6Eyebrow}>
                    <StatusGlyph tone={isLiveBedflow ? "success" : "neutral"} size={9} />
                    {isLiveBedflow ? "LIVE BEDFLOW" : "NOT IN LIVE BEDFLOW"}
                  </span>
                  <h2 id="pnJourneyH">{isLiveBedflow ? "Live journey" : "Record overview"}</h2>
                  <p>
                    {isLiveBedflow
                      ? `Tier ${urgencyTier ?? "not recorded"} · ${waitedStr} since opened`
                      : "No active placement or transport. Patient information remains available."}
                  </p>
                </div>
                {!isLiveBedflow ? (
                  <div className={styles.v6RailFacts} data-testid="ward-community-overview-card">
                    <dl>
                      <div>
                        <dt>Recorded catchment</dt>
                        <dd>{livePatient?.catchmentCommunityTeam ?? "Not recorded"}</dd>
                      </div>
                      <div>
                        <dt>Transfer status</dt>
                        <dd>
                          {liveMovement?.stage === "arrived"
                            ? "Arrived"
                            : liveMovement?.closure
                              ? "Closed"
                              : "No linked movement"}
                        </dd>
                      </div>
                    </dl>
                    <p>Review History, Community and Documents for recorded information.</p>
                  </div>
                ) : null}
                {isLiveBedflow && liveMovement && (
                  <PatientTrackerFacts
                    movement={liveMovement}
                    now={now}
                    destination={acceptingUnit?.name}
                    bedState={
                      admissions.find((a) => a.id === liveMovement.admissionId || a.movementId === liveMovement.id)
                        ?.state
                    }
                    onCoordinate={openOperations}
                  />
                )}
              </Card>
            </div>
          ) : null}
        </div>
      </div>

      {showClearanceModal && (
        <div
          className={styles.clearanceModalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="clearanceModalTitle"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeClearanceModal();
          }}
        >
          <div className={styles.clearanceModalBox} ref={clearanceModalRef}>
            <div className={styles.clearanceModalHead}>
              <h2 id="clearanceModalTitle" className={styles.clearanceModalTitle}>
                Record treating-team medical clearance
              </h2>
              <button
                type="button"
                className={styles.clearanceModalClose}
                onClick={closeClearanceModal}
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
              <label className={styles.clearanceField}>
                Treating-team clearance outcome
                <select
                  value={clearanceDraft}
                  onChange={(event) => setClearanceDraft(event.target.value as typeof clearanceDraft)}
                >
                  <option value="">Choose stated outcome</option>
                  <option value="cleared">Medical clearance provided</option>
                  <option value="not-cleared">Not medically cleared</option>
                </select>
              </label>
              <label className={styles.clearanceAttestation}>
                <input
                  type="checkbox"
                  checked={clearanceAttested}
                  onChange={(event) => setClearanceAttested(event.target.checked)}
                />
                This is the treating team&apos;s stated outcome.
              </label>
              <p>No notification is sent. This records the stated outcome in the shared synthetic journey.</p>
            </div>
            <div className={styles.clearanceModalFoot}>
              <button type="button" className={styles.ctl} onClick={closeClearanceModal}>
                Close
              </button>
              <button
                type="button"
                className={`${styles.ctl} ${styles.ctlPrimary}`}
                disabled={!clearanceDraft || !clearanceAttested || !liveMovement}
                onClick={() => {
                  if (!liveMovement || !clearanceDraft || !clearanceAttested) return;
                  dispatch({
                    type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
                    role: "ed",
                    now,
                    movementId: liveMovement.id,
                    cleared: clearanceDraft === "cleared",
                  });
                  closeClearanceModal();
                }}
              >
                Save clearance outcome
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
      <WardPrototypeFooter testId="ward-patient-now-governance" />
    </main>
  );
}
