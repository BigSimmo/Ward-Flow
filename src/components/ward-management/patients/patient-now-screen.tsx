"use client";

import { isTierOverdue } from "../ward-shared-figures";
import { scrollWardPageToTop, wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { useWardPageScrollLock } from "@/components/ward-management/ward-modal-focus";
import Link from "next/link";
import { patientChronologyHref } from "@/components/ward-management/reports/report-routes";
import {
  AlertCircle,
  BedDouble,
  Check,
  ChevronLeft,
  Clock,
  Copy,
  FileText,
  FileUp,
  RotateCcw,
  Scale,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { PatientHistoryTab, PatientCommunityTab, PatientDetailsTab, PatientDocumentsTab } from "./patient-dossier-tabs";
import { PatientRecordOverview } from "./patient-record-overview";
import { PatientFlightHeader, PatientRecordTabsRow } from "./patient-flight-header";
import pinnedStyles from "@/components/ward-management/ward-pinned-switch.module.css";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { ContextualBackLink } from "@/components/contextual-back-link";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { edById } from "@/components/ward-management/ward-sites";
import { callRows, type CallTarget } from "./patient-call-list";
import { PatientNowLayout, PatientSheetRow, PatientSheetRows } from "./patient-now-layouts";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type {
  Movement,
  TransportExceptionReason,
  TransportProvider,
  TransportLegalStatus,
} from "@/components/ward-management/ward-model";
import {
  absenceStepsFor,
  ABSENCE_STEP_LABELS,
  TRANSPORT_PROVIDERS,
  ARRIVAL_MODE_LABELS,
} from "@/components/ward-management/ward-model";
import { heldUnitGenderRefusal } from "@/components/ward-management/ward-flow-reducer";
import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import { UploadFormsModal } from "@/components/ward-management/referrals/upload-forms-modal";
import { acceptedWardReferralFor } from "@/components/ward-management/referrals/accepted-ward-referral";
import {
  activeCommunityTreatmentOrder,
  type Patient,
  type PatientId,
} from "@/components/ward-management/ward-patients";
import {
  LATE_ARRIVAL_GRACE_MINUTES,
  OPERATIONAL_DEFAULT_LABEL,
} from "@/components/ward-management/ward-operational-defaults";
import { PersonScreen } from "./person-screen";
import { PatientTransitOperations } from "./patient-transit-operations";
import { useUndoableStep } from "../use-undoable-step";
import { pullHoldRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { resolvePatientNowRecord } from "./patient-now-adapter";
import { PATIENT_MODES, patientMode, type PatientMode } from "./patient-mode";
import { buildPatientStatus, dayLabel, type PatientStatusContext } from "./patient-status-card";
import { PatientWardChangeCard, type LeaveKind, type WardChangeForm } from "./patient-ward-change-card";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import {
  TRANSPORT_EXCEPTION_REASON_LABELS,
  holdEndsBeforeEta,
  legalNowText,
  legalNowTransportStatus,
  transportExceptionText,
  transportStatusClashes,
} from "@/components/ward-management/ward-transport-checks";
import { formProgression } from "@/components/ward-management/legal-forms/legal-form-progression";
import { formTimeLeft } from "@/components/ward-management/legal-forms/legal-form-time-left";
import { useRoleGate, useRouteRole } from "@/components/ward-management/ward-role-gate";
import { usePathname } from "next/navigation";
import {
  PatientLastSeenCard,
  PatientLeaveCard,
  PatientLegalNowCard,
  PatientWhyCard,
  type ContactRow,
} from "./patient-now-cards";
import { movementHasBedHold } from "@/components/ward-management/ward-movement-bed-hold";
import { type PatientNowRecord, STAGES, clock, dur, fillTemplate } from "./patient-now-records";
import styles from "./patient-now.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import {
  Badge,
  Button,
  Card,
  CardHead,
  JourneyStrip,
  LiveChip,
  type JourneyStage,
  PhoneSheet,
  StatusGlyph,
  buttonClass,
  useIsPhone,
} from "@/components/wf";
import { patientJourneyStages } from "./patient-journey";
import { isOnOrder } from "../ward-stay-legal";
import { legalStatusTextIsInvoluntary } from "../ward-support-notifications";

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

/**
 * v10 phone movement hero: how many of the "Cannot move" cells are clear. Its own component, so the
 * status context (whose clearance handler remembers its trigger in a ref) is read as a prop rather
 * than during the screen's render.
 */
function PhoneClearFact({ mode, context }: { mode: PatientMode; context: PatientStatusContext }) {
  const status = buildPatientStatus(mode, context);
  const clear = status.cells.filter((cell) => cell.clear).length;
  return (
    <span className={styles.v6HeroFact}>
      <strong className={styles.v6HeroWait}>
        {clear} of {status.cells.length}
      </strong>
      <span className={styles.phFigLabel}>
        {clear < status.cells.length ? (
          <StatusGlyph tone={status.tone === "danger" ? "danger" : "warning"} size={9} />
        ) : null}
        Clear
      </span>
    </span>
  );
}

export function PatientNowScreen({
  patientId,
  movementId,
  initialExampleId = "WF-009",
  initialTaskAction,
}: PatientNowScreenProps) {
  const { patients, movements, referrals, admissions, units, leaveBeds, dispatch, dayZero, rejections } = useWardFlow();
  const now = useWardFlowClock();
  // Feature 11: actions follow the route's role (`ward-role-permissions.ts`, cross-role pairs listed there).
  const gate = useRoleGate();
  // A CTO is logged under the viewer's own role, never borrowed as the community team's.
  const routeRole = useRouteRole();
  const pathname = usePathname() ?? "";
  const clearanceGate = gate("RECORD_MOVEMENT_MEDICAL_CLEARANCE");
  // Audit A3-10 (13 Oct 2026): Mark absent offers the standard toast with Undo, as other moves do.
  const { run: runStep } = useUndoableStep({ dispatch, rejections, now, routeRole });

  // `now` is a demo-clock `Instant` (minutes from `dayZero`), not a wall-clock millisecond
  // timestamp, so the calendar date used to derive a patient's age must be rebuilt from `dayZero`.
  // `new Date(now)` would anchor to the 1970 epoch and render a negative age.
  const displayInstant = new Date(dayZero.getTime() + now * 60_000);
  const displayPerth = new Date(displayInstant.getTime() + 8 * 60 * 60_000);
  // Build a local-date value from Perth's calendar fields so age calculations do not depend on the browser zone.
  const displayToday = new Date(displayPerth.getUTCFullYear(), displayPerth.getUTCMonth(), displayPerth.getUTCDate());

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

  const isPhone = useIsPhone();
  const [activeTab, setActiveTab] = useState<TabKey>(initialTaskAction === "contact" ? "community" : "now");
  // The ward's change form on Now (leave, discharge date) and where its last attempt started, so a
  // refusal from the engine shows beside the form that caused it.
  // The open change form belongs to one stay, so moving to another patient never carries it over.
  const [wardFormFor, setWardFormFor] = useState<{ admissionId?: string; form: WardChangeForm }>({ form: "none" });
  // Where the rejection list stood at the last change, and for which stay, so a refusal never
  // follows the user to another patient.
  const [wardAttemptFor, setWardAttemptFor] = useState<{ admissionId: string; start: number }>();
  // The placement work opens as the Destination sheet; a task's Refer action lands there.
  const [nowSheet, setNowSheet] = useState<"destination" | "transport" | null>(
    initialTaskAction === "refer" ? "destination" : null,
  );
  function openOperations() {
    setActiveTab("now");
    setNowSheet("destination");
  }
  const [copied, setCopied] = useState(false);
  // Now mockups: destination and transport open as sheets from their cells.

  // Transport booking state & overrides
  const [showTransportForm, setShowTransportForm] = useState(false);
  const [showArrivalTimeModal, setShowArrivalTimeModal] = useState(false);
  const [showUploadFormsModal, setShowUploadFormsModal] = useState(false);
  const [showClearanceModal, setShowClearanceModal] = useState(false);
  useWardPageScrollLock(showClearanceModal);
  const clearanceTriggerRef = useRef<HTMLButtonElement | null>(null);
  const clearanceModalRef = useRef<HTMLDivElement | null>(null);
  const [clearanceDraft, setClearanceDraft] = useState<"" | "cleared" | "not-cleared">("");
  const [clearanceAttested, setClearanceAttested] = useState(false);
  const [transportCadDraft, setTransportCadDraft] = useState("");
  const [transportEtaDraft, setTransportEtaDraft] = useState("");
  const [transportProviderDraft, setTransportProviderDraft] = useState<TransportProvider>("Ambulance service");
  // Audit A4-7: the transport status starts from Legal now (the form in force), never a fixed
  // default. Undefined means "as Legal now"; Change opens the choice, and a status that differs from
  // Legal now asks for a recorded reason.
  const [transportLegalDraft, setTransportLegalDraft] = useState<TransportLegalStatus | undefined>(undefined);
  const [transportLegalChanging, setTransportLegalChanging] = useState(false);
  const [transportLegalReason, setTransportLegalReason] = useState<TransportExceptionReason | "">("");
  // Audit A4-6: a Save that cannot go through says why beside the field, never silently.
  const [transportFormErrors, setTransportFormErrors] = useState<{ cad?: string; eta?: string; legal?: string }>({});
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

  // The gate board mode: an open movement, then an occupied bed, otherwise not active.
  // D-38: the stay's held bed (leave or absence), joined by stay id, never by person.
  const stayLeaveBed = resolved.liveAdmission
    ? leaveBeds.find((bed) => bed.admissionId === resolved.liveAdmission?.id)
    : undefined;
  const mode = patientMode({
    movement: liveMovement,
    admission: resolved.liveAdmission,
    leaveBed: stayLeaveBed,
    patient: livePatient,
  });
  /* A3-13: absent without leave is the involuntary term under the Act. A voluntary patient who is
   * not back reads "Not back from leave"; the missing person steps stay the same. Either source
   * reading involuntary wins, as in the reducer's guards, so the return-order step is kept. */
  const voluntaryNow =
    /^voluntary\b/i.test((liveMovement?.legalStatus ?? livePatient?.legalStatus ?? "").trim()) &&
    !legalStatusTextIsInvoluntary(livePatient?.legalStatus);
  const modeMeta =
    mode === "awol" && voluntaryNow
      ? { ...PATIENT_MODES.awol, label: "Not back from leave", pill: "Not back from leave" }
      : PATIENT_MODES[mode];
  const isLiveBedflow = modeMeta.placing;
  // A movement's forms are the authority in force only while it is open or its stay is current.
  const stayCurrent = mode === "ward" || mode === "leave" || mode === "awol" || mode === "ed";
  const movementInForce = Boolean(
    liveMovement &&
    mode !== "idle" &&
    mode !== "cto" &&
    (!liveMovement.closure || (liveMovement.closure.outcome === "arrived" && stayCurrent)),
  );
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
    const absence = mode === "awol" ? stayLeaveBed?.absentWithoutLeave : undefined;
    if (absence) {
      // The missing person summary is the absence record only: when, where the bed is held, the steps.
      const steps = absenceStepsFor(voluntaryNow).map((step) => {
        const at = absence.steps.find((done) => done.step === step)?.at;
        return `${ABSENCE_STEP_LABELS[step]}: ${at === undefined ? "not recorded" : `done ${clock(at)}`}`;
      });
      const text = [
        `Ward Flow missing person summary — ${displayName}`,
        `${voluntaryNow ? "Not back from leave" : "Absent without leave"}, recorded ${clock(absence.since)}`,
        `Bed held on ${stayUnit?.name ?? "a ward not recorded"}`,
        ...steps,
      ].join("\n");
      navigator.clipboard?.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
      return;
    }
    const urgencyLabel = urgencyTier ? `Tier ${urgencyTier}` : "urgency not recorded";
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    const text = `Ward Flow Handover Summary — ${displayName} (${urgencyLabel})\nStatus: ${record.verdict.title}\nSince movement opened: ${waitedStr}\nNext Action: ${record.next[0]?.w ?? "Review"}`;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Keyboard navigation for tablist
  // Phone: a "contact" task opens on Community, so that tab stays on the phone's shorter list.
  const phoneKeepsCommunity = initialTaskAction === "contact";
  const TAB_KEYS: TabKey[] = isPhone
    ? isLiveBedflow && liveMovement
      ? ["now", "history", ...(phoneKeepsCommunity ? (["community"] as const) : []), "details", "documents"]
      : ["now", "history", ...(phoneKeepsCommunity ? (["community"] as const) : []), "documents"]
    : ["now", "history", "community", "details", "documents"];
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

  const legalNowStatus = liveMovement ? legalNowTransportStatus(liveMovement) : undefined;
  const transportLegalChoice = transportLegalDraft ?? legalNowStatus;
  const transportLegalClash = liveMovement !== undefined && transportStatusClashes(liveMovement, transportLegalChoice);
  const draftEtaAt = parseEtaToInstant(transportEtaDraft.trim(), now);
  // Audit A4-2: a quoted ETA after the bed hold ends is warned at once (never blocked).
  const draftHoldEnd = liveMovement ? holdEndsBeforeEta(liveMovement, draftEtaAt) : undefined;

  function openTransportForm() {
    setTransportCadDraft(displayCadNumber ?? "");
    setTransportEtaDraft(
      liveMovement?.transport?.estimatedAt !== undefined ? clock(liveMovement.transport.estimatedAt) : "",
    );
    setTransportLegalDraft(liveMovement?.transport?.transportLegalStatus);
    setTransportLegalChanging(false);
    setTransportLegalReason("");
    setTransportFormErrors({});
    setShowTransportForm(true);
  }

  function handleSaveTransportBooking(e: React.FormEvent) {
    e.preventDefault();
    const cleanCad = transportCadDraft.trim();
    const cleanEta = transportEtaDraft.trim();
    const estimatedAt = parseEtaToInstant(cleanEta, now);
    const errors: { cad?: string; eta?: string; legal?: string } = {};
    if (!cleanCad) errors.cad = "Enter the CAD number from the call";
    if (!cleanEta) errors.eta = "Enter the quoted ETA, for example 11:15";
    else if (estimatedAt === undefined) errors.eta = "Enter the ETA as HH:MM or minutes, for example 11:15 or 45m";
    if (transportLegalChoice === undefined) errors.legal = "Choose voluntary or involuntary";
    else if (transportLegalClash && transportLegalReason === "") errors.legal = "Choose why it differs from Legal now";
    setTransportFormErrors(errors);
    if (errors.cad || errors.eta || errors.legal || estimatedAt === undefined || transportLegalChoice === undefined)
      return;

    if (!liveMovement || !gate("BOOK_TRANSPORT").allowed) return;
    setBookingRejectionStart(rejections.length);
    {
      dispatch({
        type: "BOOK_TRANSPORT",
        role: routeRole,
        now,
        movementId: liveMovement.id,
        ...(routeRole === "ward" && liveMovement.acceptedUnitId ? { actingUnitId: liveMovement.acceptedUnitId } : {}),
        provider: transportProviderDraft,
        escortRequired: transportEscortDraft,
        cadNumber: cleanCad,
        transportLegalStatus: transportLegalChoice,
        estimatedAt,
        ...(transportLegalClash && transportLegalReason !== ""
          ? { exception: { gaps: ["legal_status_differs" as const], reason: transportLegalReason } }
          : {}),
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
  // Where they are right now, for the identity line under the name.
  const stayUnit = resolved.liveAdmission ? units.find((u) => u.id === resolved.liveAdmission?.unitId) : undefined;
  const where =
    mode === "find" || mode === "held"
      ? originName
      : mode === "transit"
        ? `On the way to ${acceptingUnit?.name ?? "the receiving ward"}`
        : mode === "leave"
          ? `On leave from ${stayUnit?.name ?? "the ward"}`
          : mode === "awol"
            ? `Missing from ${stayUnit?.name ?? "the ward"}`
            : mode === "ed"
              ? `At ED from ${stayUnit?.name ?? "the ward"}`
              : mode === "ward"
                ? (stayUnit?.name ?? acceptingUnit?.name)
                : livePatient?.suburb;
  const stayArrivedAt = resolved.liveAdmission?.arrivedAt;
  const stayDay =
    stayArrivedAt !== undefined && stayArrivedAt !== null
      ? Math.floor(Math.max(0, now - stayArrivedAt) / 1440) + 1
      : undefined;
  /* v10 Patient, phone: the stay the hero describes. On the ward it is the open stay; on a record
   * with nothing open it is the last stay that ended. Its own movement (the one that brought them)
   * gives the strip's first stages and the arrival line. Read only from recorded times. */
  const lastStay =
    mode === "idle" || mode === "cto"
      ? (resolved.stays ?? [])
          .filter((stay) => stay.leftAt !== null && stay.arrivedAt !== null)
          .sort((a, b) => (b.leftAt ?? 0) - (a.leftAt ?? 0))[0]
      : undefined;
  const heroStay = stayCurrent ? resolved.liveAdmission : lastStay;
  const heroStayMovement = heroStay?.movementId ? movements.find((m) => m.id === heroStay.movementId) : undefined;
  const heroStayUnitName = heroStay ? (units.find((u) => u.id === heroStay.unitId)?.name ?? "the ward") : undefined;
  const awaySince =
    mode === "leave"
      ? stayLeaveBed?.confirmedAt
      : mode === "awol"
        ? stayLeaveBed?.absentWithoutLeave?.since
        : mode === "ed"
          ? (resolved.liveAdmission?.awayAtEmergencyDepartmentSince ?? undefined)
          : undefined;
  const phoneStayStages: JourneyStage[] | undefined = (() => {
    if (!isPhone || isLiveBedflow || !heroStay || heroStay.arrivedAt === null) return undefined;
    // Audit A3-12: a missing person is not "On ward"; the absence card and figures carry the story.
    if (mode === "awol") return undefined;
    const arrivedAt = heroStay.arrivedAt;
    const before = heroStayMovement
      ? patientJourneyStages(heroStayMovement, arrivedAt).map((stage) => ({ ...stage, now: undefined }))
      : [];
    const stayEnd = heroStay.leftAt ?? awaySince ?? now;
    const stages: JourneyStage[] = [
      ...before,
      {
        id: "stay",
        label: `On ward, ${heroStayUnitName}`,
        minutes: Math.max(0, stayEnd - arrivedAt),
        now: heroStay.leftAt === null && awaySince === undefined ? true : undefined,
      },
    ];
    if (heroStay.leftAt === null && awaySince !== undefined)
      stages.push({
        id: "away",
        label: mode === "leave" ? "On leave" : "At ED",
        minutes: Math.max(0, now - awaySince),
        now: true,
      });
    return stages;
  })();
  const formMovement = movementInForce ? liveMovement : stayCurrent ? heroStayMovement : undefined;
  const ctoInForce = activeCommunityTreatmentOrder(livePatient);
  // Audit A3-3: one time left for a typed expiry, the same the Forms and Delays pages show.
  const formMovementLeft = formProgression(formMovement) ? undefined : formTimeLeft(formMovement, now);
  const movementTimeLeft =
    isLiveBedflow && !formProgression(liveMovement) ? formTimeLeft(liveMovement, now) : undefined;
  // Audit S-6: an ended form with Form 6A still to record says so, never "In force".
  const formMovementNext = formProgression(formMovement);
  const phoneLegal = ctoInForce
    ? { value: ctoInForce.form, label: "In force" }
    : formMovementNext
      ? { value: formMovementNext.nextCode, label: "To record", tone: "warning" as const }
      : formMovement?.legalForm
        ? {
            value: formMovement.legalForm.code,
            label: formMovementLeft ? formMovementLeft.text : "In force",
            ...(formMovementLeft && formMovementLeft.standing !== "later"
              ? { tone: formMovementLeft.actNow ? ("danger" as const) : ("warning" as const) }
              : {}),
          }
        : {
            // A figure, so the status's first word ("Voluntary"); the full words are on Legal now.
            value:
              (
                (mode === "idle"
                  ? livePatient?.legalStatus
                  : (liveMovement?.legalStatus ?? livePatient?.legalStatus)) ?? "Not recorded"
              ).split(" ")[0] ?? "Not recorded",
            label: "Legal status",
          };
  // Audit S-32: the leave sheet names the form in force and says when the person is on an order.
  const stayLegalStatusNow = liveMovement?.legalStatus ?? livePatient?.legalStatus;
  const leaveLegal = {
    form: [
      ctoInForce
        ? `Form ${ctoInForce.form}`
        : formMovement?.legalForm
          ? `Form ${formMovement.legalForm.code}`
          : "No form recorded",
      stayLegalStatusNow ?? "legal status not recorded",
    ].join(" · "),
    onOrder: isOnOrder(stayLegalStatusNow),
  };
  const heroStayOrigin = heroStayMovement ? edById(heroStayMovement.originEdId)?.name : undefined;
  const phoneStatusFoot =
    mode === "ward" && heroStay?.arrivedAt != null
      ? `Arrived ${dayLabel(heroStay.arrivedAt, dayZero).replace(",", "")}${heroStay.arrivedAt >= 0 ? ` ${clock(heroStay.arrivedAt)}` : ""}${heroStayOrigin ? ` from ${heroStayOrigin}` : ""}`
      : (mode === "idle" || mode === "cto") && lastStay?.leftAt != null
        ? `No open placement or stay · discharged ${dayLabel(lastStay.leftAt, dayZero)}`
        : undefined;

  // D-38 ward actions on the stay, raised under the viewer's own role (the coordinator may take every
  // action, Josh 10 Oct 2026) and scoped to the ward the stay is on.
  function recordReturn() {
    if (stayLeaveBed && gate("END_LEAVE_BED").allowed)
      dispatch({
        type: "END_LEAVE_BED",
        role: routeRole,
        now,
        leaveBedId: stayLeaveBed.id,
        actingUnitId: stayLeaveBed.unitId,
      });
  }
  function markAbsent() {
    const stay = resolved?.liveAdmission;
    if (stay && gate("RECORD_ABSENT_WITHOUT_LEAVE").allowed)
      runStep(
        {
          type: "RECORD_ABSENT_WITHOUT_LEAVE",
          role: routeRole,
          now,
          admissionId: stay.id,
          actingUnitId: stay.unitId,
        },
        {
          success: "Marked absent without leave",
          undo: (at) => ({
            type: "UNDO_ABSENT_WITHOUT_LEAVE",
            role: routeRole,
            now: at,
            admissionId: stay.id,
            ...(routeRole === "ward" ? { actingUnitId: stay.unitId } : {}),
          }),
          undone: "Undone. Back on leave.",
        },
      );
  }
  const wardForm: WardChangeForm = wardFormFor.admissionId === resolved?.liveAdmission?.id ? wardFormFor.form : "none";
  function setWardForm(form: WardChangeForm) {
    setWardFormFor({ admissionId: resolved?.liveAdmission?.id, form });
  }
  // Leave, gone to ED and the discharge date, from the change card. Each remembers where the
  // rejection list stood, so the card can say when the engine refused.
  function recordLeave(expectedReturn: number, kind: LeaveKind) {
    const stay = resolved?.liveAdmission;
    if (!stay || !gate("RECORD_LEAVE_BED").allowed) return;
    setWardAttemptFor({ admissionId: stay.id, start: rejections.length });
    dispatch({
      type: "RECORD_LEAVE_BED",
      role: routeRole,
      now,
      unitId: stay.unitId,
      actingUnitId: stay.unitId,
      admissionId: stay.id,
      expectedReturn,
      kind,
    });
    setWardForm("none");
  }
  function goneToEd() {
    const stay = resolved?.liveAdmission;
    if (!stay || !gate("RECORD_AWAY_AT_EMERGENCY_DEPARTMENT").allowed) return;
    setWardAttemptFor({ admissionId: stay.id, start: rejections.length });
    dispatch({
      type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
      role: routeRole,
      now,
      admissionId: stay.id,
      actingUnitId: stay.unitId,
    });
    setWardForm("none");
  }
  function returnFromEd() {
    const stay = resolved?.liveAdmission;
    if (!stay || !gate("RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT").allowed) return;
    setWardAttemptFor({ admissionId: stay.id, start: rejections.length });
    dispatch({
      type: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
      role: routeRole,
      now,
      admissionId: stay.id,
      actingUnitId: stay.unitId,
    });
  }
  function saveDischarge(expectedDischargeAt: number) {
    const stay = resolved?.liveAdmission;
    if (!stay || !gate("UPDATE_EXPECTED_DISCHARGE").allowed) return;
    setWardAttemptFor({ admissionId: stay.id, start: rejections.length });
    dispatch({
      type: "UPDATE_EXPECTED_DISCHARGE",
      role: routeRole,
      now,
      admissionId: stay.id,
      expectedDischargeAt,
      actingUnitId: stay.unitId,
    });
    setWardForm("none");
  }
  const wardAttemptStart =
    wardAttemptFor && wardAttemptFor.admissionId === resolved?.liveAdmission?.id ? wardAttemptFor.start : undefined;
  const wardRejection =
    wardAttemptStart !== undefined
      ? rejections
          .slice(wardAttemptStart)
          .filter(
            (rejection) =>
              rejection.attempted === "RECORD_LEAVE_BED" ||
              rejection.attempted === "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT" ||
              rejection.attempted === "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT" ||
              rejection.attempted === "UPDATE_EXPECTED_DISCHARGE",
          )
          .at(-1)
      : undefined;
  const edReturnRefusal =
    wardRejection?.attempted === "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT" ? wardRejection.reason : undefined;
  const wardRefusal = edReturnRefusal ? undefined : wardRejection?.reason;

  const acceptedWardFor = acceptedWardReferralFor(livePatient?.id, referrals, units, { movements, admissions });
  const statusContext: PatientStatusContext = {
    movement: liveMovement,
    admission: resolved.liveAdmission,
    patient: livePatient,
    acceptedUnitName: acceptingUnit?.name ?? stayUnit?.name,
    // Decision 2 (site review, 12 Oct 2026): the Bed value opens the ward, the Transport value the
    // movement's own page with its transport job (not linked when that is this page already).
    bedHref:
      (acceptingUnit ?? stayUnit) !== undefined
        ? `/mockups/ward-flow/ward/${encodeURIComponent((acceptingUnit ?? stayUnit)!.id)}`
        : undefined,
    acceptedReferral: acceptedWardFor
      ? {
          unitName: acceptedWardFor.unitName,
          boardHref: `/mockups/ward-flow/ward/${encodeURIComponent(acceptedWardFor.unitId)}`,
        }
      : undefined,
    transportHref:
      liveMovement && !pathname.includes(`/movements/${encodeURIComponent(liveMovement.id)}`)
        ? `/mockups/ward-flow/movements/${encodeURIComponent(liveMovement.id)}`
        : undefined,
    hasBedHold: liveMovement ? movementHasBedHold(liveMovement, admissions) : false,
    now,
    dayZero,
    onOpenPlacement: () => setNowSheet("destination"),
    onClearance: (event) => {
      clearanceTriggerRef.current = event.currentTarget;
      setClearanceDraft("");
      setClearanceAttested(false);
      setShowClearanceModal(true);
    },
    onBookTransport: () => {
      openTransportForm();
      setNowSheet("transport");
    },
    onArrivalTime: () => {
      setShowArrivalTimeModal(true);
    },
    leaveBed: stayLeaveBed,
    stayUnitName: stayUnit?.name,
    onRecordReturn: recordReturn,
    onMarkAbsent: markAbsent,
    onDischargeDate: () => {
      setWardForm("discharge");
      requestAnimationFrame(() =>
        document.getElementById("pn-ward-change")?.scrollIntoView({ block: "center", behavior: wardScrollBehavior() }),
      );
    },
    onReturnFromEd: returnFromEd,
    edReturnRefusal,
    onAbsenceStep: (step) => {
      const stay = resolved.liveAdmission;
      if (!stay || !gate("RECORD_ABSENCE_STEP").allowed) return;
      dispatch({
        type: "RECORD_ABSENCE_STEP",
        role: routeRole,
        now,
        admissionId: stay.id,
        actingUnitId: stay.unitId,
        step,
      });
    },
    onRecordCto: () => {
      if (livePatient && gate("RECORD_COMMUNITY_TREATMENT_ORDER").allowed)
        dispatch({ type: "RECORD_COMMUNITY_TREATMENT_ORDER", role: routeRole, now, patientId: livePatient.id });
    },
    onEndCto: () => {
      if (livePatient && gate("END_COMMUNITY_TREATMENT_ORDER").allowed)
        dispatch({ type: "END_COMMUNITY_TREATMENT_ORDER", role: routeRole, now, patientId: livePatient.id });
    },
    roleLimit: (eventType) => gate(eventType).reason,
    handoverRefusal:
      mode === "held" && liveMovement ? (heldUnitGenderRefusal({ units }, liveMovement, now) ?? undefined) : undefined,
    // Audit A4-9: once every gate is clear the next step is pinned (phone), with Undo on its toast.
    onHandoverReady: () => {
      if (!liveMovement || !gate("HANDOVER_READY").allowed) return;
      runStep(
        { type: "HANDOVER_READY", role: routeRole, now, movementId: liveMovement.id },
        {
          success: "Handover ready. The transport officer can now accept the job.",
          undo: (at) => ({ type: "UNDO_ED_STEP", role: routeRole, now: at, movementId: liveMovement.id }),
          undone: "Undone. Back as it was.",
        },
      );
    },
  };

  // Who to call now, from the record only. Phone numbers are not held in this prototype.
  const contacts: ContactRow[] = [];
  if (mode === "find" || mode === "held") {
    if (originName) contacts.push({ name: originName, role: "Sending ED, nurse in charge" });
    if (acceptingUnit) contacts.push({ name: acceptingUnit.name, role: "Receiving ward" });
  } else if (mode === "transit") {
    if (acceptingUnit) contacts.push({ name: acceptingUnit.name, role: "Receiving ward" });
    if (isTransportBooked && liveMovement?.transport)
      contacts.push({
        name: liveMovement.transport.provider,
        role: displayCadNumber ? `Transport, CAD ${displayCadNumber}` : "Transport",
      });
    if (originName) contacts.push({ name: originName, role: "Sending ED" });
  } else if ((mode === "ward" || mode === "leave" || mode === "awol" || mode === "ed") && (stayUnit ?? acceptingUnit)) {
    const wardUnit = stayUnit ?? acceptingUnit;
    if (wardUnit) contacts.push({ name: wardUnit.name, role: "Ward, nurse in charge" });
    const police = stayLeaveBed?.absentWithoutLeave?.steps.find((done) => done.step === "police_notified")?.at;
    if (mode === "awol" && police !== undefined) contacts.push({ name: "Police", role: `Notified ${clock(police)}` });
  }
  if (livePatient?.catchmentCommunityTeam)
    contacts.push({ name: livePatient.catchmentCommunityTeam, role: "Catchment community team" });
  if (livePatient?.generalPractitioner && !isLiveBedflow)
    contacts.push({ name: livePatient.generalPractitioner, role: "GP" });

  /* Who to call: the same people, each looked up in the On-call directory for a mock number. */
  const originEd = liveMovement ? edById(liveMovement.originEdId) : undefined;
  const callTargets: CallTarget[] = contacts.map((row) => {
    if (originEd && row.name === originName)
      return { kind: "ed", name: row.name, role: row.role, siteCode: originEd.siteCode, line: "liaison" };
    const wardUnit = units.find((unit) => unit.name === row.name);
    if (wardUnit) return { kind: "ward", name: row.name, role: row.role, unitId: wardUnit.id };
    if (row.name === livePatient?.catchmentCommunityTeam) return { kind: "team", name: row.name, role: row.role };
    if (isTransportBooked && row.name === liveMovement?.transport?.provider)
      return { kind: "transport", name: row.name, role: row.role };
    return { kind: "plain", name: row.name, role: row.role };
  });
  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: "now", label: modeMeta.quiet ? "Overview" : "Now" },
    { key: "history", label: "History", count: record.presentations.length },
    { key: "community", label: "Community", count: record.community.teams.length },
    { key: "details", label: "Details" },
    { key: "documents", label: "Documents", count: documentCount },
  ];
  /* v10 Patient, Phone: "Segmented control: Now, History, Forms." */
  /* v10 Movement, Phone: "Now, History, Details, Docs" while a movement is live. */
  const phoneMovement = isPhone && isLiveBedflow && liveMovement !== undefined;
  const phoneTabs = phoneMovement
    ? tabs
        .filter((tab) => tab.key !== "community" || phoneKeepsCommunity)
        .map((tab) =>
          tab.key === "documents" ? { ...tab, label: "Docs", count: undefined } : { ...tab, count: undefined },
        )
    : tabs
        .filter(
          (tab) =>
            tab.key === "now" ||
            tab.key === "history" ||
            tab.key === "documents" ||
            (tab.key === "community" && phoneKeepsCommunity),
        )
        .map((tab) => (tab.key === "documents" ? { ...tab, label: "Forms" } : tab));
  const canWithdraw =
    liveMovement !== undefined &&
    !liveMovement.closure &&
    ["placement_requested", "destination_review"].includes(liveMovement.stage) &&
    !liveMovement.acceptedUnitId;

  /* Transport dispatch and the arrival plan, in the Transport sheet opened from the Transport cell
     (device audit 11 Oct 2026: the dispatch block is off Now). */
  const transportSection =
    (mode === "held" || mode === "transit") && liveMovement ? (
      <section
        className={`${styles.sec} ${styles.transportSec}`}
        aria-labelledby="pnTransportHeading"
        data-testid="ward-patient-transport-section"
      >
        <div className={styles.transportHeader}>
          <div className={styles.transportTitleCluster}>
            <span className={styles.transportIcon} aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                  className={isTransportBooked ? styles.transportActionBtnSecondary : styles.transportActionBtn}
                  onClick={openTransportForm}
                  data-testid="ward-patient-book-transport-btn"
                >
                  {isTransportBooked ? "Update Booking Details" : "Mark as Booked"}
                </button>
              )}
            </div>
          )}
        </div>

        {liveMovement && bookingRejection && <p role="alert">Booking was not recorded: {bookingRejection.reason}</p>}
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
                  CAD (dispatch) number <span aria-hidden="true">*</span>
                </label>
                <input
                  id="transport-cad"
                  type="text"
                  className={styles.transportInput}
                  placeholder="e.g. CAD-84920"
                  value={transportCadDraft}
                  onChange={(e) => {
                    setTransportCadDraft(e.target.value);
                    setTransportFormErrors((errors) => ({ ...errors, cad: undefined }));
                  }}
                  aria-required="true"
                  aria-invalid={transportFormErrors.cad ? "true" : undefined}
                  aria-describedby={transportFormErrors.cad ? "transport-cad-error" : undefined}
                  data-testid="ward-patient-input-cad"
                />
                {transportFormErrors.cad ? (
                  <span id="transport-cad-error" className={styles.transportFieldNote}>
                    <StatusGlyph tone="danger" size={9} />
                    {transportFormErrors.cad}
                  </span>
                ) : null}
              </div>

              <div className={styles.transportFormField}>
                <label htmlFor="transport-eta" className={styles.transportFormLabel}>
                  Quoted ETA by Transport Company <span aria-hidden="true">*</span>
                </label>
                <input
                  id="transport-eta"
                  type="text"
                  className={styles.transportInput}
                  placeholder="e.g. 11:15 or ~45m"
                  value={transportEtaDraft}
                  onChange={(e) => {
                    setTransportEtaDraft(e.target.value);
                    setTransportFormErrors((errors) => ({ ...errors, eta: undefined }));
                  }}
                  aria-required="true"
                  aria-invalid={transportFormErrors.eta ? "true" : undefined}
                  aria-describedby={
                    transportFormErrors.eta
                      ? "transport-eta-error"
                      : draftHoldEnd !== undefined
                        ? "transport-eta-hold"
                        : undefined
                  }
                  data-testid="ward-patient-input-eta"
                />
                {transportFormErrors.eta ? (
                  <span id="transport-eta-error" className={styles.transportFieldNote}>
                    <StatusGlyph tone="danger" size={9} />
                    {transportFormErrors.eta}
                  </span>
                ) : draftHoldEnd !== undefined ? (
                  <span
                    id="transport-eta-hold"
                    className={styles.transportFieldNote}
                    data-testid="ward-patient-eta-after-hold"
                  >
                    <StatusGlyph tone="warning" size={9} />
                    Arrives after the hold ends at {clock(draftHoldEnd)}. Extend the hold or rebook.
                  </span>
                ) : null}
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

              <div className={styles.transportFormField} data-testid="ward-patient-transport-legal">
                {transportLegalChanging || legalNowStatus === undefined ? (
                  <>
                    <label htmlFor="transport-legal" className={styles.transportFormLabel}>
                      Transport legal status
                    </label>
                    <select
                      id="transport-legal"
                      className={styles.transportSelect}
                      value={transportLegalChoice ?? ""}
                      onChange={(e) => setTransportLegalDraft((e.target.value || undefined) as TransportLegalStatus)}
                      aria-invalid={transportFormErrors.legal ? "true" : undefined}
                      data-testid="ward-patient-select-legal"
                    >
                      {transportLegalChoice === undefined ? <option value="">Choose</option> : null}
                      <option value="involuntary">Involuntary</option>
                      <option value="voluntary">Voluntary</option>
                    </select>
                  </>
                ) : (
                  <>
                    <span className={styles.transportFormLabel}>Transport legal status</span>
                    <span className={styles.transportLegalRead} data-testid="ward-patient-legal-from-form">
                      <span>{formatTransportLegalStatus(transportLegalChoice)}, from Legal now</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setTransportLegalChanging(true)}
                        data-testid="ward-patient-change-legal"
                      >
                        Change
                      </Button>
                    </span>
                  </>
                )}
                <span className={styles.transportFieldNote}>Legal now: {legalNowText(liveMovement)}</span>
              </div>
            </div>

            {transportLegalClash ? (
              <div className={styles.transportFormField} data-testid="ward-patient-legal-clash">
                <span className={styles.transportFieldNote}>
                  <StatusGlyph tone="warning" size={9} />
                  Differs from Legal now ({legalNowText(liveMovement)}). Record why.
                </span>
                <label htmlFor="transport-legal-reason" className={styles.transportFormLabel}>
                  Reason
                </label>
                <select
                  id="transport-legal-reason"
                  className={styles.transportSelect}
                  value={transportLegalReason}
                  onChange={(e) => setTransportLegalReason(e.target.value as TransportExceptionReason | "")}
                  aria-invalid={transportFormErrors.legal ? "true" : undefined}
                  data-testid="ward-patient-legal-reason"
                >
                  <option value="">Choose a reason</option>
                  {(Object.keys(TRANSPORT_EXCEPTION_REASON_LABELS) as TransportExceptionReason[]).map((value) => (
                    <option key={value} value={value}>
                      {TRANSPORT_EXCEPTION_REASON_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {transportFormErrors.legal ? (
              <span className={styles.transportFieldNote} data-testid="ward-patient-legal-error">
                <StatusGlyph tone="danger" size={9} />
                {transportFormErrors.legal}
              </span>
            ) : null}

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
              {/* Audit A4-5: the shared Button carries its own colours, so Save is visible in the
                  sheet, which renders outside this page's token scope. */}
              <Button type="button" variant="sec" size="sm" onClick={() => setShowTransportForm(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="pri"
                size="sm"
                data-testid="ward-patient-confirm-transport-btn"
                {...gate("BOOK_TRANSPORT").buttonProps}
              >
                Save transport booking
              </Button>
              {gate("BOOK_TRANSPORT").note}
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
            {liveMovement.transport &&
            transportStatusClashes(liveMovement, liveMovement.transport.transportLegalStatus) ? (
              <div className={styles.transportFact} data-testid="ward-patient-transport-legal-clash">
                <span className={styles.transportFactLabel}>Legal now</span>
                <span className={styles.transportFieldNote}>
                  <StatusGlyph tone="warning" size={9} />
                  {legalNowText(liveMovement)}, differs from the booking
                </span>
              </div>
            ) : null}
            {holdEndsBeforeEta(liveMovement, liveMovement.transport?.estimatedAt) !== undefined ? (
              <div className={styles.transportFact} data-testid="ward-patient-transport-hold-before-eta">
                <span className={styles.transportFactLabel}>Bed hold</span>
                <span className={styles.transportFieldNote}>
                  <StatusGlyph tone="warning" size={9} />
                  Ends {clock(liveMovement.pullExpiresAt!)}, before the ETA. Extend the hold or rebook.
                </span>
              </div>
            ) : null}
            {(liveMovement.transport?.exceptions ?? []).map((exception) => (
              <div
                key={`${exception.step}-${exception.at}`}
                className={styles.transportFact}
                data-testid="ward-patient-transport-exception"
              >
                <span className={styles.transportFactLabel}>
                  {exception.step === "collected" ? "Collected" : "Booked"} {clock(exception.at)} with
                </span>
                <span className={styles.transportFieldNote}>{transportExceptionText(exception)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Empty state when not booked */}
        {!liveMovement || (!isTransportBooked && !showTransportForm) ? (
          <div className={styles.transportEmptyState}>
            <p className={styles.transportEmptyText}>
              {liveMovement ? (
                <>
                  No transport vehicle has been logged for this patient yet. Once arranged by phone with the transport
                  provider, click <strong>Mark as Booked</strong> to record the CAD (dispatch) number and quoted ETA.
                </>
              ) : (
                "No linked transport record displayed."
              )}
            </p>
          </div>
        ) : null}
      </section>
    ) : null;
  const arrivalSection =
    (mode === "held" || mode === "transit") && liveMovement ? (
      <>
        {(isPulled || hasArrivalPlan) && (
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
                  <AlertCircle
                    size={18}
                    style={{ flexShrink: 0, marginTop: 2, color: "var(--wf-danger)" }}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>Arrival Overdue:</strong> Patient is more than {LATE_ARRIVAL_GRACE_MINUTES} minutes past
                    estimated arrival time ({clock(liveMovement?.arrivalDetails?.estimatedArrivalAt ?? now)} AWST).
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
      </>
    ) : null;

  /* Now tab: one next step; destination and transport open as sheets. */
  const openTab = (tab: TabKey) => {
    setActiveTab(tab);
    requestAnimationFrame(() => document.getElementById(`pntab-${tab}`)?.focus());
  };
  const nowPanel = (
    <PatientNowLayout
      mode={mode}
      context={statusContext}
      statusCardProps={{
        barLead:
          isPhone && !phoneMovement ? (
            <Button
              iconOnly
              icon={Copy}
              aria-label={copied ? "Copied" : isLiveBedflow ? "Copy handover" : "Copy summary"}
              onClick={handleCopySummary}
            />
          ) : undefined,
        // Phone keeps the patient's own New referral (preselected) when there is no stay to act on.
        barMain:
          isPhone && (mode === "idle" || mode === "cto") ? (
            <Link
              href={
                livePatient
                  ? `/mockups/ward-flow/referrals/new?patientId=${encodeURIComponent(livePatient.id)}`
                  : "/mockups/ward-flow/referrals/new"
              }
              className={buttonClass({ variant: "pri" })}
              data-testid="ward-person-refer-outpatient"
            >
              <FileText size={16} aria-hidden="true" />
              New referral
            </Link>
          ) : undefined,
        phoneFoot: phoneStatusFoot,
      }}
      legal={
        mode !== "idle" || isPhone ? (
          <PatientLegalNowCard
            movement={movementInForce ? liveMovement : undefined}
            patient={livePatient}
            onAllForms={() => openTab("documents")}
            now={now}
            absent={mode === "awol"}
          />
        ) : null
      }
      why={
        isLiveBedflow && liveMovement ? (
          <PatientWhyCard
            title="Why they're here"
            chip={`Opened ${clock(liveMovement.openedAt)}`}
            history={resolved.liveReferral?.history}
            fallback={record.reason}
            movement={liveMovement}
            patient={livePatient}
          />
        ) : mode === "ward" || mode === "ed" ? (
          <PatientWhyCard
            title="Why admitted"
            chip={stayUnit ? stayUnit.name : undefined}
            history={resolved.liveReferral?.history}
            fallback={record.reason}
            patient={livePatient}
          />
        ) : null
      }
      change={
        <>
          {mode === "ward" ? (
            <PatientWardChangeCard
              key={resolved.liveAdmission?.id}
              now={now}
              dayZero={dayZero}
              form={wardForm}
              onFormChange={setWardForm}
              onRecordLeave={recordLeave}
              onGoneToEd={goneToEd}
              onSaveDischarge={saveDischarge}
              dischargeInBar={isPhone && resolved.liveAdmission?.state === "occupied"}
              refusal={wardRefusal}
              roleLimit={(eventType) => gate(eventType).reason}
              leaveLegal={leaveLegal}
            />
          ) : null}
          {mode === "leave" && stayLeaveBed ? (
            <PatientLeaveCard
              dueBack={formatInstantWithDay(stayLeaveBed.expectedReturn, now)}
              voluntary={voluntaryNow}
              onMarkAbsent={markAbsent}
            />
          ) : null}
          {mode === "awol" && stayLeaveBed?.absentWithoutLeave ? (
            <PatientLastSeenCard
              wardName={stayUnit?.name}
              voluntary={voluntaryNow}
              since={clock(stayLeaveBed.absentWithoutLeave.since)}
              onRecordReturn={recordReturn}
            />
          ) : null}
          {(mode === "idle" || mode === "cto") && !isPhone ? (
            <PatientRecordOverview patient={livePatient} record={record} onOpen={openTab} />
          ) : null}
          {/* Device audit (11 Oct 2026): the journey ribbon sits below the body, not in the hero, so
              the hero holds the status and the steps only. The phone keeps its own card above. */}
          {isLiveBedflow && liveMovement && !phoneMovement ? (
            <section className={styles.sec} aria-labelledby="pn-journey-head">
              <h3 id="pn-journey-head" className={styles.secH}>
                Journey so far
              </h3>
              <JourneyStrip
                label="Journey since this movement opened"
                stages={patientJourneyStages(liveMovement, now)}
                formatDuration={dur}
                note={false}
              />
            </section>
          ) : null}
        </>
      }
      calls={callRows(callTargets, now)}
      sheetRows={
        isLiveBedflow && liveMovement ? (
          <PatientSheetRows>
            <PatientSheetRow
              icon={<BedDouble size={16} aria-hidden="true" />}
              title="Destination"
              sub={
                acceptingUnit
                  ? `${acceptingUnit.name} accepted · bed hold and placement`
                  : liveMovement.referredUnitIds.length > 0
                    ? `${liveMovement.referredUnitIds.length} wards asked · shortlist`
                    : "Shortlist eligible wards · none asked"
              }
              onOpen={() => setNowSheet("destination")}
              testId="ward-patient-destination-row"
            />
            {mode === "held" || mode === "transit" ? (
              <PatientSheetRow
                icon={<Truck size={16} aria-hidden="true" />}
                title="Transport"
                sub={
                  isTransportBooked
                    ? `${displayProvider}${displayCadNumber ? ` · CAD ${displayCadNumber}` : ""}`
                    : "Not booked · booking, arrival plan, documents"
                }
                onOpen={() => setNowSheet("transport")}
                testId="ward-patient-transport-row"
              />
            ) : null}
            <PatientSheetRow
              icon={<RotateCcw size={16} aria-hidden="true" />}
              title={canWithdraw ? "Withdraw referral" : "Review and corrections"}
              sub={canWithdraw ? "Closes the movement and frees any held bed" : "Step back with a recorded reason"}
              onOpen={() => setNowSheet("destination")}
            />
          </PatientSheetRows>
        ) : null
      }
      phoneMore={
        isPhone ? (
          <PatientSheetRows>
            {tabs
              .filter((tab) => tab.key === "community" || tab.key === "details")
              .map((tab) => (
                <PatientSheetRow
                  key={tab.key}
                  icon={<FileText size={16} aria-hidden="true" />}
                  title={tab.label}
                  sub={
                    tab.key === "community"
                      ? record.community.teams.length > 0
                        ? `${record.community.teams.length} ${record.community.teams.length === 1 ? "team" : "teams"} on record`
                        : // A4-20, S-27: Who to call lists the catchment team from the patient record, so
                          // this row reads the same field rather than denying a team that list shows.
                          livePatient?.catchmentCommunityTeam
                          ? "Catchment team, care not confirmed"
                          : "No community team on record"
                      : "UMRN, date of birth, where they live"
                  }
                  onOpen={() => {
                    setActiveTab(tab.key);
                    requestAnimationFrame(scrollWardPageToTop);
                  }}
                />
              ))}
          </PatientSheetRows>
        ) : null
      }
    />
  );

  /* The record tabs. On a phone they render beside the record (below), pinned under the header. */
  const recordTabs = (
    <div className={styles.v6Tabs} role="tablist" aria-label="The record" onKeyDown={handleTabKeyDown}>
      {(isPhone ? phoneTabs : tabs).map((tab) => (
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
  );

  return (
    <main
      id="main-content"
      className={styles.screen}
      data-testid="ward-person-screen"
      data-ward-design="v6"
      data-ward-rebuilt-screen="patient-now"
      data-bedflow={isLiveBedflow ? "live" : "inactive"}
      data-patient-mode={mode}
      data-active-tab={activeTab}
    >
      <div className={styles.v6Page}>
        {livePatient?.confidential && (
          <div className={styles.v6Confidential} role="alert" data-testid="ward-patient-confidential-banner">
            <strong>Restricted record</strong>
            <span>This record has restricted access flags. Handle it under the clinical privacy protocol.</span>
          </div>
        )}
        {/* Gate board (9 Oct 2026): the hero names the mode, the stages show only while a placement is
            open, and the header stays the mode's header on every tab. */}
        <section className={styles.v6Summary} id="pnSubject" aria-label="Patient summary">
          <PatientFlightHeader
            displayName={displayName}
            preferredName={preferredName}
            patient={livePatient}
            displayToday={displayToday}
            isLiveBedflow={isLiveBedflow}
            quiet={modeMeta.quiet && !isPhone}
            statePill={
              <span className={styles.gbPill} data-testid="ward-patient-mode-pill">
                <StatusGlyph tone={modeMeta.tone} size={10} />
                {modeMeta.pill}
              </span>
            }
            phoneEyebrow={
              phoneMovement ? (
                // A3-20: the phone hero keeps the desktop's tier, bed type and specialling on one line.
                `Movement · Tier ${urgencyTier ?? "not recorded"} · ${(liveMovement?.security ?? "not recorded").toLowerCase()}${liveMovement?.specialling ? " · 1:1 specialling" : ""}`
              ) : (
                <span className={styles.phEyebrow}>
                  <StatusGlyph tone={modeMeta.tone} size={10} />
                  {modeMeta.pill}
                </span>
              )
            }
            phoneFootKind="actions"
            phoneFoot={
              phoneMovement ? (
                <div className={styles.phHeroActions}>
                  <ContextualBackLink
                    fallbackHref="/mockups/ward-flow/movements"
                    className={buttonClass({ variant: "onHero" })}
                    data-testid="ward-patient-phone-movements-back"
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                    Movements
                  </ContextualBackLink>
                  <Button variant="onHero" icon={Copy} onClick={handleCopySummary}>
                    {copied ? "Copied" : "Copy handover"}
                  </Button>
                </div>
              ) : undefined
            }
            location={where}
            statusDetail={
              isLiveBedflow
                ? `Stage ${currentStageIndex + 1} / 7 · ${STAGES[currentStageIndex].label}`
                : liveMovement?.closure && liveMovement.stage !== "arrived"
                  ? "Referral closed · no active transfer"
                  : liveMovement?.stage === "arrived"
                    ? "Arrived · transfer complete"
                    : modeMeta.label
            }
            facts={
              phoneMovement ? (
                <span className={styles.v6HeroFacts} data-testid="ward-patient-phone-figures">
                  <span className={styles.v6HeroFact}>
                    <strong className={styles.v6HeroWait}>{waitedStr}</strong>
                    <span>Since opened</span>
                  </span>
                  <span className={styles.v6HeroFact}>
                    <strong className={styles.v6HeroWait}>
                      {currentStageIndex + 1} of {STAGES.length}
                    </strong>
                    <span>Stage</span>
                  </span>
                  <PhoneClearFact mode={mode} context={statusContext} />
                  {movementTimeLeft ? (
                    <span className={styles.v6HeroFact} data-testid="ward-patient-hero-form-left">
                      <strong className={styles.v6HeroWait}>{movementTimeLeft.text}</strong>
                      <span className={styles.phFigLabel}>
                        {movementTimeLeft.standing !== "later" ? (
                          <StatusGlyph tone={movementTimeLeft.tone} size={9} />
                        ) : null}
                        {movementTimeLeft.code}
                      </span>
                    </span>
                  ) : null}
                </span>
              ) : isPhone && !isLiveBedflow ? (
                /* v10 Patient, phone: three figures, the value over its label, from the record. */
                <span className={styles.v6HeroFacts} data-testid="ward-patient-phone-figures">
                  {(mode === "idle" || mode === "cto"
                    ? [
                        // shell-24 (13 Oct 2026): no Discharged figure for someone never admitted.
                        ...(lastStay == null
                          ? []
                          : [
                              {
                                key: "discharged",
                                value:
                                  lastStay?.leftAt != null
                                    ? now - lastStay.leftAt < 6 * 1440
                                      ? dayLabel(lastStay.leftAt, dayZero).replace(",", "").split(" ")[0]
                                      : dayLabel(lastStay.leftAt, dayZero)
                                          .replace(",", "")
                                          .split(" ")
                                          .slice(1)
                                          .join(" ")
                                    : "None",
                                label: "Discharged",
                              },
                            ]),
                        { key: "orders", value: ctoInForce ? "1" : "0", label: "Orders" },
                        { key: "presentations", value: String(record.presentations.length), label: "Presentations" },
                      ]
                    : mode === "leave" && stayLeaveBed
                      ? [
                          {
                            key: "due",
                            value: clock(stayLeaveBed.expectedReturn),
                            label: "Due back",
                            tone: "neutral" as const,
                          },
                          now > stayLeaveBed.expectedReturn
                            ? { key: "from", value: dur(now - stayLeaveBed.expectedReturn), label: "Overdue" }
                            : { key: "from", value: dur(stayLeaveBed.expectedReturn - now), label: "From now" },
                          { key: "legal", ...phoneLegal },
                        ]
                      : mode === "awol" && stayLeaveBed?.absentWithoutLeave
                        ? [
                            {
                              key: "absent",
                              value: dur(Math.max(0, now - stayLeaveBed.absentWithoutLeave.since)),
                              label: "Absent",
                              tone: "danger" as const,
                            },
                            {
                              key: "steps",
                              // A3-13: the same step list the status card counts.
                              value: `${absenceStepsFor(voluntaryNow).filter((step) => stayLeaveBed.absentWithoutLeave!.steps.some((done) => done.step === step)).length}/${absenceStepsFor(voluntaryNow).length}`,
                              label: "Steps done",
                            },
                            { key: "legal", ...phoneLegal },
                          ]
                        : mode === "ed" && awaySince !== undefined
                          ? [
                              {
                                key: "away",
                                value: dur(Math.max(0, now - awaySince)),
                                label: "At ED",
                                tone: "warning" as const,
                              },
                              {
                                key: "bed",
                                value:
                                  resolved.liveAdmission?.bedNumber !== undefined
                                    ? `Bed ${String(resolved.liveAdmission.bedNumber).padStart(2, "0")}`
                                    : "Bed",
                                label: "Held",
                              },
                              { key: "legal", ...phoneLegal },
                            ]
                          : [
                              {
                                key: "day",
                                value: stayDay !== undefined ? `Day ${stayDay}` : "Day not recorded",
                                label: "On ward",
                                tone: "success" as const,
                              },
                              { key: "legal", ...phoneLegal },
                              {
                                key: "out",
                                value:
                                  typeof resolved.liveAdmission?.expectedDischargeAt === "number"
                                    ? dayLabel(resolved.liveAdmission.expectedDischargeAt, dayZero).replace(",", "")
                                    : "None",
                                label: "Expected out",
                              },
                            ]
                  ).map(
                    (fig: {
                      key: string;
                      value: string;
                      label: string;
                      tone?: "success" | "warning" | "danger" | "neutral";
                    }) => (
                      <span key={fig.key} className={styles.v6HeroFact}>
                        <strong className={styles.v6HeroWait}>{fig.value}</strong>
                        <span className={styles.phFigLabel}>
                          {fig.tone ? <StatusGlyph tone={fig.tone} size={9} /> : null}
                          {fig.label}
                        </span>
                      </span>
                    ),
                  )}
                </span>
              ) : isLiveBedflow && liveMovement ? (
                <span className={styles.v6HeroFacts}>
                  <span className={styles.v6HeroFact}>
                    <StatusGlyph tone={tierTone} size={9} />
                    Tier {urgencyTier ?? "not recorded"} · {(liveMovement.security ?? "not recorded").toLowerCase()}
                  </span>
                  {isTierOverdue(urgencyTier, now - liveMovement.openedAt) ? (
                    <span className={styles.v6HeroFact}>
                      <StatusGlyph tone="danger" size={9} />
                      Overdue wait · {waitedStr}
                    </span>
                  ) : null}
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
                  {movementTimeLeft ? (
                    <span className={styles.v6HeroFact} data-testid="ward-patient-hero-form-left">
                      {movementTimeLeft.standing !== "later" ? (
                        <StatusGlyph tone={movementTimeLeft.tone} size={9} />
                      ) : (
                        <Scale size={14} aria-hidden="true" />
                      )}
                      {movementTimeLeft.code} · <strong className={styles.v6HeroWait}>{movementTimeLeft.text}</strong>
                    </span>
                  ) : null}
                </span>
              ) : (
                <span className={styles.v6HeroFacts}>
                  <span className={styles.v6HeroFact}>
                    <Scale size={14} aria-hidden="true" />
                    {/* Not active: the patient record's own status, not a closed movement's. */}
                    {mode === "cto"
                      ? "Community treatment order, Form 5A"
                      : ((mode === "idle"
                          ? livePatient?.legalStatus
                          : (liveMovement?.legalStatus ?? livePatient?.legalStatus)) ?? "Legal status not recorded")}
                  </span>
                  {(mode === "leave" || mode === "awol" || mode === "ed") && (
                    <span className={styles.v6HeroFact}>
                      <BedDouble size={14} aria-hidden="true" />
                      Bed held
                    </span>
                  )}
                  {mode === "awol" && stayLeaveBed?.absentWithoutLeave ? (
                    <span className={styles.v6HeroFact}>
                      <Clock size={14} aria-hidden="true" />
                      <strong className={styles.v6HeroWait}>
                        {dur(Math.max(0, now - stayLeaveBed.absentWithoutLeave.since))}
                      </strong>
                      absent since {clock(stayLeaveBed.absentWithoutLeave.since)}
                    </span>
                  ) : null}
                  {(mode === "ward" || mode === "leave" || mode === "ed") && stayDay !== undefined ? (
                    <span className={styles.v6HeroFact}>
                      <strong className={styles.v6HeroWait}>Day {stayDay}</strong>
                      on the ward
                    </span>
                  ) : null}
                  {stayCurrent && resolved.liveAdmission ? (
                    <span className={styles.v6HeroFact} data-testid="ward-patient-hero-discharge">
                      {typeof resolved.liveAdmission.expectedDischargeAt === "number" ? (
                        <>
                          <strong>
                            {dayLabel(resolved.liveAdmission.expectedDischargeAt, dayZero).replace(",", "")}
                          </strong>
                          discharge date
                        </>
                      ) : (
                        <>
                          <strong>None</strong>
                          discharge date yet
                        </>
                      )}
                    </span>
                  ) : null}
                </span>
              )
            }
            journey={
              phoneStayStages ? (
                <JourneyStrip
                  surface="hero"
                  label="This record's last stay"
                  stages={phoneStayStages}
                  formatDuration={(minutes) =>
                    minutes >= 1440
                      ? `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`
                      : dur(minutes)
                  }
                  note={false}
                  className={`${styles.v6Journey} ${styles.phStayStrip}`}
                />
              ) : undefined
            }
            steps={
              phoneMovement ? (
                <div className={styles.phDots}>
                  <span className={styles.phDotRow} aria-hidden="true">
                    {STAGES.map((stage, i) => (
                      <span
                        key={stage.id}
                        className={styles.phDot}
                        data-s={i < currentStageIndex ? "done" : i === currentStageIndex ? "now" : "next"}
                      />
                    ))}
                  </span>
                  <span>
                    <span className="sr-only">
                      Stage {currentStageIndex + 1} of {STAGES.length}:{" "}
                    </span>
                    {STAGES[currentStageIndex].label}
                  </span>
                </div>
              ) : isLiveBedflow ? (
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
            tabs={recordTabs}
            actions={
              <>
                {modeMeta.quiet ? null : (
                  // v10 phone: the movement page reads "Live HH:MM", the patient page a plain "Live".
                  <LiveChip state="live" age={phoneMovement ? undefined : null} onHero />
                )}
                {isPhone ? null : (
                  <Button variant="onHero" size="sm" icon={Copy} onClick={handleCopySummary}>
                    {copied
                      ? "Copied"
                      : isLiveBedflow
                        ? "Copy handover"
                        : mode === "awol"
                          ? "Copy missing person summary"
                          : "Copy summary"}
                  </Button>
                )}
                {(mode === "idle" || mode === "cto") && !isPhone ? (
                  <Link
                    href={
                      livePatient
                        ? `/mockups/ward-flow/referrals/new?patientId=${encodeURIComponent(livePatient.id)}`
                        : "/mockups/ward-flow/referrals/new"
                    }
                    className={buttonClass({ variant: modeMeta.quiet ? "pri" : "light", size: "sm" })}
                    data-testid="ward-person-refer-outpatient"
                  >
                    <FileText size={14} aria-hidden="true" />
                    New referral
                  </Link>
                ) : null}
              </>
            }
          />

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
        </section>

        {/* Phone (Josh, 12 Oct 2026): the record tabs pin under the phone header, as Home's queue
            switch does. They sit in the page column beside the record they pin over. */}
        {isPhone ? <PatientRecordTabsRow tabs={recordTabs} className={pinnedStyles.pinnedSwitch} /> : null}

        <section className={styles.v6Main} id="pnTabs" aria-label="The record">
          <div className={styles.v6TabBody} id="pnBody" tabIndex={0}>
            {/* Tab 1: NOW. Only what is true at this moment: the status card, the work for this mode,
                then why they are here, legal now and who to call. */}
            <div
              className={`${styles.v6TabPane} ${styles.gbNow}`}
              role="tabpanel"
              id="pnpane-now"
              aria-labelledby="pntab-now"
              hidden={activeTab !== "now"}
            >
              {nowPanel}
            </div>

            {/* Tab 2: HISTORY */}
            <div
              className={styles.v6TabPane}
              role="tabpanel"
              id="pnpane-history"
              aria-labelledby="pntab-history"
              hidden={activeTab !== "history"}
            >
              <PatientHistoryTab
                record={record}
                movement={liveMovement}
                dayZero={dayZero}
                unitName={(id) => units.find((u) => u.id === id)?.name}
                stays={resolved.stays}
                absence={stayLeaveBed?.absentWithoutLeave}
                absenceVoluntary={voluntaryNow}
                chronologyHref={livePatient ? patientChronologyHref(livePatient.id) : undefined}
                open={!modeMeta.quiet}
                onBackToNow={() => {
                  setActiveTab("now");
                  requestAnimationFrame(() => document.getElementById("pntab-now")?.focus());
                }}
              />
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
                stayOpen={!modeMeta.quiet}
                onRecordCto={statusContext.onRecordCto}
                onEndCto={statusContext.onEndCto}
                recordCtoUnavailable={gate("RECORD_COMMUNITY_TREATMENT_ORDER").reason}
                endCtoUnavailable={gate("END_COMMUNITY_TREATMENT_ORDER").reason}
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
                movementInForce={movementInForce}
                patient={livePatient}
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
              {/* A4-32: say why Save is not yet available, beside it. */}
              {clearanceGate.allowed && (!clearanceDraft || !clearanceAttested) ? (
                <p id="clearanceSaveReason" className={styles.clearanceReason}>
                  {!clearanceDraft ? "Choose the outcome to save" : "Tick the statement to save"}
                </p>
              ) : null}
              <button type="button" className={styles.ctl} onClick={closeClearanceModal}>
                Close
              </button>
              <button
                type="button"
                className={`${styles.ctl} ${styles.ctlPrimary}`}
                aria-disabled={
                  !clearanceDraft || !clearanceAttested || !liveMovement || !clearanceGate.allowed ? "true" : undefined
                }
                aria-describedby={
                  clearanceGate.allowed && (!clearanceDraft || !clearanceAttested)
                    ? "clearanceSaveReason"
                    : clearanceGate.buttonProps["aria-describedby"]
                }
                onClick={(e) => {
                  if (!liveMovement || !clearanceDraft || !clearanceAttested || !clearanceGate.allowed) {
                    ignoreUnavailableActivation(e);
                    return;
                  }
                  dispatch({
                    type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
                    role: routeRole,
                    now,
                    movementId: liveMovement.id,
                    cleared: clearanceDraft === "cleared",
                  });
                  closeClearanceModal();
                }}
              >
                Save clearance outcome
              </button>
              {clearanceGate.note}
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
      {liveMovement ? (
        <>
          <PhoneSheet
            open={nowSheet === "destination"}
            onClose={() => setNowSheet(null)}
            title="Destination and placement"
            description={acceptingUnit ? `${acceptingUnit.name} accepted` : "No ward has accepted yet"}
            height="tall"
            placement={isPhone ? "bottom" : "right"}
          >
            {/* B5 (site review, 12 Oct 2026): the sheet renders outside this page's `main`, so it
                carries the page's design attribute itself; without it the deck lost its card and
                button styles ("Hold the bed" read as plain text). */}
            <div data-ward-design="v6">
              <PatientTransitOperations key={liveMovement.id} movement={liveMovement} showMetrics={false} bare />
            </div>
          </PhoneSheet>
          <PhoneSheet
            open={nowSheet === "transport"}
            onClose={() => setNowSheet(null)}
            title="Transport"
            description={isTransportBooked ? `${displayProvider} booked` : "Not booked yet"}
            height="tall"
            placement={isPhone ? "bottom" : "right"}
          >
            {transportSection}
            {arrivalSection}
          </PhoneSheet>
        </>
      ) : null}
      <WardPrototypeFooter testId="ward-patient-now-governance" />
    </main>
  );
}
