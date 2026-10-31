"use client";

import { SAVE_NOT_CONFIRMED } from "@/components/ward-management/ward-save-failure";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { patientChronologyHref } from "@/components/ward-management/reports/report-routes";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
  PatientHistoryTab,
  PatientCommunityTab,
  PatientDetailsTab,
  PatientDocumentsTab,
} from "@/components/ward-management/patients/patient-dossier-tabs";
import { PatientRecordTabsRow } from "@/components/ward-management/patients/patient-flight-header";
import pinnedStyles from "@/components/ward-management/ward-pinned-switch.module.css";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import { edById } from "@/components/ward-management/ward-sites";
import { type CallTarget } from "@/components/ward-management/patients/patient-call-list";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { TransportExceptionReason } from "@/components/ward-management/ward-model";
import { absenceStepsFor, ABSENCE_STEP_LABELS } from "@/components/ward-management/ward-model";
import { heldUnitGenderRefusal } from "@/components/ward-management/ward-flow-reducer";
import type { UploadFormsModalProps } from "@/components/ward-management/referrals/upload-forms-modal";
import { acceptedWardReferralFor } from "@/components/ward-management/referrals/accepted-ward-referral";
import { SYNTHETIC_COPY_LINE } from "@/components/ward-management/referrals/referral-letter";
import { activeCommunityTreatmentOrder, type Patient } from "@/components/ward-management/ward-patients";
import { LATE_ARRIVAL_GRACE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { WardMovementNotFound } from "@/components/ward-management/ward-movement-not-found";
import dynamic from "next/dynamic";
import { preloadWhenIdle } from "@/components/ward-management/preload-when-idle";
// The arrival-time dialog has no initial-page content. Load it only after its action is opened.
// (Document details load through the cancellable UploadFormsModal below.)
const ArrivalTimeModal = dynamic(() =>
  import("@/components/ward-management/referrals/arrival-time-modal").then((m) => m.ArrivalTimeModal),
);
// F-10: transit operations only draw inside the Destination sheet, so their code loads on its own,
// fetched once the page is idle, rather than with the patient page. D-91: the mock-up's fork, whose
// Ask wards list is the one Find a ward list.
const loadTransitOperations = () => import("./patient-transit-operations");
const PatientTransitOperations = dynamic(() => loadTransitOperations().then((m) => m.PatientTransitOperations));
// Document details have no closed-state work. Keep their code off the first load, with the same
// idle preload as Transit operations and a cancellable, focus-managed dialog while loading.
const loadUploadForms = () => import("@/components/ward-management/referrals/upload-forms-modal");
const UploadFormsCloseContext = createContext<(() => void) | null>(null);
function UploadFormsPending({ failed = false }: { failed?: boolean }) {
  const onClose = useContext(UploadFormsCloseContext);
  if (!onClose) return null;
  return (
    <Dialog open onClose={onClose} title="Record document details">
      <p role={failed ? "alert" : "status"}>
        {failed
          ? "Document details could not load. Close this dialog and reload the page before trying again."
          : "Loading document details…"}
      </p>
    </Dialog>
  );
}
function UploadFormsUnavailable() {
  return <UploadFormsPending failed />;
}
const UploadFormsModal = dynamic<UploadFormsModalProps>(
  () =>
    loadUploadForms().then(
      (module) => module.UploadFormsModal,
      () => UploadFormsUnavailable,
    ),
  { loading: () => <UploadFormsPending /> },
);
preloadWhenIdle(loadTransitOperations, loadUploadForms);
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { resolvePatientNowRecord } from "@/components/ward-management/patients/patient-now-adapter";
import { PATIENT_MODES, patientMode } from "@/components/ward-management/patients/patient-mode";
import { dayLabel, type PatientStatusContext } from "@/components/ward-management/patients/patient-status-card";
import { type LeaveKind, type WardChangeForm } from "@/components/ward-management/patients/patient-ward-change-card";
import { calendarDateOf, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import type { TransportBookingAnswers } from "@/components/ward-management/ward-transport-checks";
import {
  BLANK_TRANSPORT_BOOKING,
  type TransportBookingSubmission,
} from "@/components/ward-management/transport/transport-booking-form";
import { formProgression } from "@/components/ward-management/legal-forms/legal-form-progression";
import { formTimeLeft } from "@/components/ward-management/legal-forms/legal-form-time-left";
import {
  requiredRoleForPermission,
  setDeskRole,
  useRoleGate,
  useRouteRole,
} from "@/components/ward-management/ward-role-gate";
import { usePathname } from "next/navigation";
import { type ContactRow } from "@/components/ward-management/patients/patient-now-cards";
import { movementHasBedHold } from "@/components/ward-management/ward-movement-bed-hold";
import {
  type PatientNowRecord,
  STAGES,
  clock,
  dur,
  fillTemplate,
} from "@/components/ward-management/patients/patient-now-records";
import styles from "@/components/ward-management/patients/patient-now.module.css";
import { PatientArchivePanel } from "@/components/ward-management/patients/patient-archive-panel";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { MeetingActionsDue } from "@/components/ward-management/bed-meeting/meeting-actions-due";
import { useIsDatesOnlyStay } from "@/components/ward-management/shell/ward-access";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { Dialog, type JourneyStage, PhoneSheet, useIsPhone, useModalFocus } from "@/components/wf";
import { patientJourneyStages } from "@/components/ward-management/patients/patient-journey";
import { isOnOrder } from "@/components/ward-management/ward-stay-legal";
import { legalStatusTextIsInvoluntary } from "@/components/ward-management/ward-support-notifications";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import {
  type TabKey,
  formatTransportLegalStatus,
  getStageBedflowDetail,
} from "@/components/ward-management/patients/patient-now-screen-helpers";
import { renderArrivalSection } from "@/components/ward-management/patients/patient-now-arrival-section";
import { PatientRedesignPanel } from "./patient-redesign-panel";
import { PatientNowSummary } from "@/components/ward-redesign/patient/patient-now-summary-redesign";
import { renderTransportSection } from "@/components/ward-management/patients/patient-now-transport-section";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { originName as movementOriginName } from "@/components/ward-management/ward-movement-origin";

// Both local and shared dispatches report an outcome. Keep the current draft until accepted,
// and fence the completion so an old patient's save cannot dismiss another patient's form.
function usePatientFormSave(scope: string) {
  const scopeToken = useMemo(() => ({ id: scope }), [scope]);
  const currentScope = useRef<object | null>(scopeToken);
  useLayoutEffect(() => {
    currentScope.current = scopeToken;
    return () => {
      currentScope.current = null;
    };
  }, [scopeToken]);
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ scope: object; message: string }>();
  function submit(record: () => ReturnType<WardCommandDispatch>, onAccepted: () => void) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(undefined);
    const submittedScope = scopeToken;
    const finish = (outcome?: WardCommandOutcome | void) => {
      inFlight.current = false;
      setPending(false);
      if (currentScope.current !== submittedScope) return;
      if (outcome?.status === "accepted" && outcome.isCurrent?.() !== false) onAccepted();
      else
        setError({
          scope: submittedScope,
          message: outcome?.message ?? SAVE_NOT_CONFIRMED,
        });
    };
    try {
      const completion = record();
      if (completion && "then" in completion) void completion.then(finish, () => finish());
      else finish(completion);
    } catch {
      finish();
    }
  }
  return {
    pending,
    error: error?.scope === scopeToken ? error.message : undefined,
    clearError: () => setError(undefined),
    submit,
  };
}

interface PatientNowScreenProps {
  patientId?: string;
  movementId?: string;
  initialTaskAction?: "refer" | "contact";
  initialExampleId?: "WF-009" | "WF-004";
  /** DR-11: the tab title. The movement route passes "Movement record — Ward Flow"; never a name. */
  documentTitle?: string;
}

export function PatientRedesign({
  patientId,
  movementId,
  initialExampleId = "WF-009",
  initialTaskAction,
  documentTitle = "Patient — Ward Flow",
}: PatientNowScreenProps) {
  const thresholds = useDueSoonThresholds();
  const { patients, movements, referrals, admissions, units, leaveBeds, dispatch, dayZero, rejections } =
    useWardFlowSelect(
      "patients",
      "movements",
      "referrals",
      "admissions",
      "units",
      "leaveBeds",
      "dispatch",
      "dayZero",
      "rejections",
    );
  const now = useWardFlowClock();
  // D-65: the held bed review warning is paused behind its own flag until the hold time is reviewed.
  const awolHoldReview = useWardFeatureFlag("awol-bed-hold-review");
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
  // `new Date(now)` would anchor to the 1970 epoch and render a negative age. The real moment, as the
  // engine passes it: `patientAgeYears` reads its Perth day. A local midnight built here was shifted
  // to Perth a second time, a year low on the birthday east of Perth (Audit 1, CS-18, Josh 20 Oct).
  const displayToday = calendarDateOf(now, dayZero);

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
  const clearanceTriggerRef = useRef<HTMLButtonElement | null>(null);
  const clearanceModalRef = useRef<HTMLDivElement | null>(null);
  const [clearanceDraft, setClearanceDraft] = useState<"" | "cleared" | "not-cleared">("");
  const [clearanceAttested, setClearanceAttested] = useState(false);
  // A34: the one transport booking form's answers. Legal status starts from Legal now (audit A4-7),
  // and a status that differs from Legal now asks for a recorded reason.
  const [transportAnswers, setTransportAnswers] = useState<TransportBookingAnswers>(BLANK_TRANSPORT_BOOKING);
  const [transportLegalReason, setTransportLegalReason] = useState<TransportExceptionReason | "">("");
  const transportSave = usePatientFormSave(selectedId);
  const clearanceSave = usePatientFormSave(selectedId);
  const [bookingRejectionStart, setBookingRejectionStart] = useState<number>();

  const closeClearanceModal = useCallback(() => {
    if (!clearanceSave.pending) setShowClearanceModal(false);
  }, [clearanceSave.pending]);

  // The shared modal contract: the page behind is inert and held still, focus starts on the first
  // control, Tab wraps inside the box, Escape closes only this top layer, and focus returns to the
  // button that opened it.
  const { rootRef: clearanceBackdropRef } = useModalFocus({
    open: showClearanceModal,
    onClose: closeClearanceModal,
    panelRef: clearanceModalRef,
    returnFocusRef: clearanceTriggerRef,
    focusOnOpen: "immediate",
  });

  // Synchronize document title
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  const isDatesOnlyStay = useIsDatesOnlyStay();
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
  // The open stage card belongs to the tab it was opened on; another tab starts with it closed.
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab);
  if (prevActiveTab !== activeTab) {
    setPrevActiveTab(activeTab);
    setExpandedStageIndex(null);
  }

  // An id the system does not know gets the one not-found page, which never echoes the id. The
  // older governed dossier that used to render here was retired (Josh, 21 Oct 2026).
  if (!resolved) {
    return <WardMovementNotFound requestedId="" reason="not-a-person-id" />;
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

  // Display names. Redesign (owner rule D-83): surname first, "Surname, First", read from the
  // resolver's formal name rather than the given-name-first display name.
  const displayName = livePatient
    ? resolveSubjectPatient({ patientId: livePatient.id }, { patients: [livePatient] }).formalName
    : resolved.displayName;
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
        SYNTHETIC_COPY_LINE,
        `Ward Flow missing person summary — ${displayName}`,
        `${voluntaryNow ? "Not back from leave" : "Absent without leave"}, recorded ${clock(absence.since)}`,
        `Bed held on ${stayUnit?.name ?? "a ward not recorded"}`,
        ...steps,
      ].join("\n");
      void copyTextToClipboard(text).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        },
        // A refused copy leaves the button as it was, as before the shared helper.
        () => undefined,
      );
      return;
    }
    const urgencyLabel = urgencyTier ? `Tier ${urgencyTier}` : "urgency not recorded";
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    // Audit 1 (CS-12, Josh 20 Oct): the synthetic line first in every copy.
    const text = `${SYNTHETIC_COPY_LINE}\nWard Flow Handover Summary — ${displayName} (${urgencyLabel})\nStatus: ${record.verdict.title}\nSince movement opened: ${waitedStr}\nNext Action: ${record.next[0]?.w ?? "Review"}`;
    void copyTextToClipboard(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      // A refused copy leaves the button as it was, as before the shared helper.
      () => undefined,
    );
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
      ? `${formatInstantWithDay(liveMovement.transport.estimatedAt, now)} AWST`
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

  function openTransportForm() {
    if (isTransportBooked || transportSave.pending) return;
    transportSave.clearError();
    setBookingRejectionStart(undefined);
    setTransportAnswers(BLANK_TRANSPORT_BOOKING);
    setTransportLegalReason("");
    setShowTransportForm(true);
  }

  // A ward books, and adds a CAD number that was to follow, as the sending ward.
  const transportActingUnitId =
    routeRole === "ward" && liveMovement
      ? ((liveMovement.referralId
          ? referrals.find((referral) => referral.id === liveMovement.referralId)?.originUnitId
          : undefined) ?? admissions.find((admission) => admission.id === liveMovement.sourceAdmissionId)?.unitId)
      : undefined;

  function saveTransportBooking(booking: TransportBookingSubmission) {
    if (transportSave.pending || !liveMovement || !gate("BOOK_TRANSPORT").allowed) return;
    setBookingRejectionStart(rejections.length);
    transportSave.submit(
      () =>
        dispatch({
          type: "BOOK_TRANSPORT",
          role: routeRole,
          now,
          movementId: liveMovement.id,
          ...(transportActingUnitId ? { actingUnitId: transportActingUnitId } : {}),
          ...booking,
        }),
      () => setShowTransportForm(false),
    );
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

  const originName = liveMovement ? (movementOriginName(liveMovement) ?? "Origin not recorded") : undefined;
  const tierTone = urgencyTier === 1 ? "danger" : urgencyTier === 2 ? "warning" : "neutral";
  // WT-06 (walk-through, 26 Oct 2026): the charts attached to the referral count as documents.
  const referralCharts = resolved.liveReferral?.intake?.charts ?? [];
  const documentCount = record.documents.length + uploadedForms.length + referralCharts.length;
  const expandedStage = isLiveBedflow && expandedStageIndex !== null ? STAGES[expandedStageIndex] : undefined;
  const expandedStageDetail = expandedStage ? getStageBedflowDetail(expandedStage.id, liveMovement) : undefined;
  // Where they are right now, for the identity line under the name.
  const stayUnit = resolved.liveAdmission ? units.find((u) => u.id === resolved.liveAdmission?.unitId) : undefined;
  const where =
    mode === "find" || mode === "held"
      ? originName
      : mode === "transit"
        ? // Handover ready is still in the ED, awaiting collection: only Moving is on the way.
          `${liveMovement?.stage === "moving" ? "On the way to" : "Ready to go to"} ${acceptingUnit?.name ?? "the receiving ward"}`
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
  const formMovementLeft = formProgression(formMovement) ? undefined : formTimeLeft(formMovement, now, thresholds);
  const movementTimeLeft =
    isLiveBedflow && !formProgression(liveMovement) ? formTimeLeft(liveMovement, now, thresholds) : undefined;
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
  const heroStayOrigin = heroStayMovement ? movementOriginName(heroStayMovement) : undefined;
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
  function recordLeave(expectedReturn: number, kind: LeaveKind, psychiatristAuthorised?: boolean) {
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
      // #101 (Josh, 27 Oct 2026): the authority tick, asked only for a patient on an order.
      ...(psychiatristAuthorised === undefined ? {} : { psychiatristAuthorised }),
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
    awolHoldReview,
    movement: liveMovement,
    admission: resolved.liveAdmission,
    stayWithheld: isDatesOnlyStay(resolved.liveAdmission?.id),
    patient: livePatient,
    acceptedUnitName: acceptingUnit?.name ?? stayUnit?.name,
    // Decision 2 (site review, 12 Oct 2026): the Bed value opens the ward, the Transport value the
    // movement's own page with its transport job (not linked when that is this page already).
    bedHref:
      (acceptingUnit ?? stayUnit) !== undefined
        ? `/ward-flow/ward/${encodeURIComponent((acceptingUnit ?? stayUnit)!.id)}`
        : undefined,
    acceptedReferral: acceptedWardFor
      ? {
          unitName: acceptedWardFor.unitName,
          boardHref: `/ward-flow/ward/${encodeURIComponent(acceptedWardFor.unitId)}?tab=board`,
        }
      : undefined,
    transportHref:
      liveMovement && !pathname.includes(movementHref(liveMovement.id)) ? movementHref(liveMovement.id) : undefined,
    hasBedHold: liveMovement ? movementHasBedHold(liveMovement, admissions) : false,
    now,
    dayZero,
    onOpenPlacement: () => setNowSheet("destination"),
    onClearance: (event) => {
      if (clearanceSave.pending) return;
      clearanceSave.clearError();
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
  // D-76: a journey from a community team has the team as its sender, not an ED.
  const sender = liveMovement?.originEdId === undefined && liveMovement ? "Sending community team" : "Sending ED";
  if (mode === "find" || mode === "held") {
    if (originName)
      contacts.push({ name: originName, role: sender === "Sending ED" ? "Sending ED, nurse in charge" : sender });
    if (acceptingUnit) contacts.push({ name: acceptingUnit.name, role: "Receiving ward" });
  } else if (mode === "transit") {
    if (acceptingUnit) contacts.push({ name: acceptingUnit.name, role: "Receiving ward" });
    if (isTransportBooked && liveMovement?.transport)
      contacts.push({
        name: liveMovement.transport.provider,
        role: displayCadNumber ? `Transport, CAD ${displayCadNumber}` : "Transport",
      });
    if (originName) contacts.push({ name: originName, role: sender });
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
  /* v10 Movement, Phone: "Now, History, Details, Documents" while a movement is live. The UX audit
   * (21 Oct 2026) gave the phone the desktop's tab name, "Documents", so the two never disagree. */
  const phoneMovement = isPhone && isLiveBedflow && liveMovement !== undefined;
  const phoneTabs = phoneMovement
    ? tabs.filter((tab) => tab.key !== "community" || phoneKeepsCommunity).map((tab) => ({ ...tab, count: undefined }))
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
  const transportSection = renderTransportSection({
    bookingRejection,
    transportPending: transportSave.pending,
    transportSaveError: transportSave.error,
    displayCadNumber,
    displayEscort,
    displayEta,
    displayLegalStatus,
    displayProvider,
    displayName,
    gate,
    routeRole,
    transportActingUnitId,
    isTransportBooked,
    liveMovement,
    mode,
    now,
    openTransportForm,
    saveTransportBooking,
    setShowTransportForm,
    setTransportAnswers,
    setTransportLegalReason,
    showTransportForm,
    transportAnswers,
    transportLegalReason,
  });
  const arrivalSection = renderArrivalSection({
    acceptingWardName,
    displayCadNumber,
    hasArrivalPlan,
    isHoldExpired,
    isOverdue,
    isPulled,
    liveMovement,
    mode,
    now,
    pullExpiresAt,
    setShowArrivalTimeModal,
    setShowUploadFormsModal,
    uploadedForms,
  });

  /* Now tab: one next step; destination and transport open as sheets. */
  const openTab = (tab: TabKey) => {
    setActiveTab(tab);
    requestAnimationFrame(() => document.getElementById(`pntab-${tab}`)?.focus());
  };
  const nowPanel = (
    <PatientRedesignPanel
      acceptingUnit={acceptingUnit}
      callTargets={callTargets}
      canWithdraw={canWithdraw}
      clearanceGate={clearanceGate}
      copied={copied}
      dayZero={dayZero}
      displayCadNumber={displayCadNumber}
      displayProvider={displayProvider}
      gate={gate}
      goneToEd={goneToEd}
      handleCopySummary={handleCopySummary}
      isLiveBedflow={isLiveBedflow}
      isPhone={isPhone}
      isTransportBooked={isTransportBooked}
      leaveLegal={leaveLegal}
      liveMovement={liveMovement}
      livePatient={livePatient}
      markAbsent={markAbsent}
      mode={mode}
      movementInForce={movementInForce}
      now={now}
      openTab={openTab}
      pathname={pathname}
      phoneMovement={phoneMovement}
      phoneStatusFoot={phoneStatusFoot}
      record={record}
      recordLeave={recordLeave}
      recordReturn={recordReturn}
      resolved={resolved}
      saveDischarge={saveDischarge}
      setActiveTab={setActiveTab}
      setNowSheet={setNowSheet}
      setWardForm={setWardForm}
      statusContext={statusContext}
      stayLeaveBed={stayLeaveBed}
      stayUnit={stayUnit}
      tabs={tabs}
      voluntaryNow={voluntaryNow}
      wardForm={wardForm}
      wardRefusal={wardRefusal}
    />
  );

  /* The record tabs. On a phone they render beside the record (below), pinned under the header. */
  const recordTabs = (
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tab stop: arrow keys bubble up from the focused tab, option or item
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
        {/* Gate board (9 Oct 2026): the hero names the mode, the stages show only while a placement is
            open, and the header stays the mode's header on every tab. */}
        <PatientNowSummary
          awaySince={awaySince}
          copied={copied}
          ctoInForce={ctoInForce}
          currentStageIndex={currentStageIndex}
          dayZero={dayZero}
          displayName={displayName}
          displayToday={displayToday}
          expandedStage={expandedStage}
          expandedStageDetail={expandedStageDetail}
          expandedStageIndex={expandedStageIndex}
          focusedStageIndex={focusedStageIndex}
          handleCopySummary={handleCopySummary}
          isLiveBedflow={isLiveBedflow}
          isPhone={isPhone}
          lastStay={lastStay}
          liveMovement={liveMovement}
          livePatient={livePatient}
          mode={mode}
          modeMeta={modeMeta}
          movementTimeLeft={movementTimeLeft}
          now={now}
          openOperations={openOperations}
          phoneLegal={phoneLegal}
          phoneMovement={phoneMovement}
          phoneStayStages={phoneStayStages}
          preferredName={preferredName}
          record={record}
          recordTabs={recordTabs}
          resolved={resolved}
          setExpandedStageIndex={setExpandedStageIndex}
          setFocusedStageIndex={setFocusedStageIndex}
          stageButtonRefs={stageButtonRefs}
          statusContext={statusContext}
          stayCurrent={stayCurrent}
          stayDay={stayDay}
          stayLeaveBed={stayLeaveBed}
          tierTone={tierTone}
          urgencyTier={urgencyTier}
          voluntaryNow={voluntaryNow}
          waitedStr={waitedStr}
          where={where}
        />
        {/* Restricted record (27 Oct 2026): the notice sits under the hero, so the hero stays the first
            thing under the header and keeps its band join (wf/band.ts). */}
        {livePatient?.confidential && (
          <div className={styles.v6Confidential} role="alert" data-testid="ward-patient-confidential-banner">
            <strong>Restricted record</strong>
            <span>This record has restricted access flags. Handle it under the clinical privacy protocol.</span>
          </div>
        )}

        {/* Phone (Josh, 12 Oct 2026): the record tabs pin under the phone header, as Home's queue
            switch does. They sit in the page column beside the record they pin over. */}
        {isPhone ? <PatientRecordTabsRow tabs={recordTabs} className={pinnedStyles.pinnedSwitch} /> : null}

        <section className={styles.v6Main} id="pnTabs" aria-label="The record">
          <div className={styles.v6TabBody} id="pnBody">
            {/* Tab 1: NOW. Only what is true at this moment: the status card, the work for this mode,
                then why they are here, legal now and who to call. */}
            <div
              className={`${styles.v6TabPane} ${styles.gbNow}`}
              role="tabpanel"
              id="pnpane-now"
              aria-labelledby="pntab-now"
              hidden={activeTab !== "now"}
            >
              {/* Overall review, 20 Oct 2026: the owner of a bed meeting action marks it done here. */}
              <MeetingActionsDue subject={liveMovement && { kind: "movement", id: liveMovement.id }} />
              <MeetingActionsDue
                subject={resolved.liveAdmission && { kind: "admission", id: resolved.liveAdmission.id }}
              />
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
              {!gate("RECORD_COMMUNITY_TREATMENT_ORDER").allowed ? (
                <div className="lockline">
                  <button
                    type="button"
                    className="lockline"
                    onClick={() =>
                      setDeskRole(
                        requiredRoleForPermission(
                          "RECORD_COMMUNITY_TREATMENT_ORDER",
                          gate("RECORD_COMMUNITY_TREATMENT_ORDER").reason,
                        ).role,
                        pathname,
                      )
                    }
                    data-testid="ward-patient-role-switch-community"
                  >
                    Switch to{" "}
                    {
                      requiredRoleForPermission(
                        "RECORD_COMMUNITY_TREATMENT_ORDER",
                        gate("RECORD_COMMUNITY_TREATMENT_ORDER").reason,
                      ).label
                    }{" "}
                    desk →
                  </button>
                </div>
              ) : null}
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
                referralCharts={referralCharts}
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
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- a backdrop click closes it for the pointer, and Escape closes it from the keyboard
        <div
          ref={clearanceBackdropRef}
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
                disabled={clearanceSave.pending}
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
                  disabled={clearanceSave.pending}
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
                  disabled={clearanceSave.pending}
                  checked={clearanceAttested}
                  onChange={(event) => setClearanceAttested(event.target.checked)}
                />
                This is the treating team&apos;s stated outcome.
              </label>
              <p>No notification is sent. This records the stated outcome in the shared synthetic journey.</p>
            </div>
            <div className={styles.clearanceModalFoot}>
              {clearanceSave.error && <p role="alert">Clearance was not recorded: {clearanceSave.error}</p>}
              {clearanceSave.pending && <p role="status">Saving clearance outcome…</p>}
              {/* A4-32: say why Save is not yet available, beside it. */}
              {clearanceGate.allowed && (!clearanceDraft || !clearanceAttested) ? (
                <p id="clearanceSaveReason" className={styles.clearanceReason}>
                  {!clearanceDraft ? "Choose the outcome to save" : "Tick the statement to save"}
                </p>
              ) : null}
              <button
                type="button"
                className={styles.ctl}
                disabled={clearanceSave.pending}
                onClick={closeClearanceModal}
              >
                Close
              </button>
              <button
                type="button"
                className={`${styles.ctl} ${styles.ctlPrimary}`}
                aria-busy={clearanceSave.pending}
                aria-disabled={
                  clearanceSave.pending ||
                  !clearanceDraft ||
                  !clearanceAttested ||
                  !liveMovement ||
                  !clearanceGate.allowed
                    ? "true"
                    : undefined
                }
                aria-describedby={
                  clearanceGate.allowed && (!clearanceDraft || !clearanceAttested)
                    ? "clearanceSaveReason"
                    : clearanceGate.buttonProps["aria-describedby"]
                }
                onClick={(e) => {
                  if (
                    clearanceSave.pending ||
                    !liveMovement ||
                    !clearanceDraft ||
                    !clearanceAttested ||
                    !clearanceGate.allowed
                  ) {
                    ignoreUnavailableActivation(e);
                    return;
                  }
                  clearanceSave.submit(
                    () =>
                      dispatch({
                        type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
                        role: routeRole,
                        now,
                        movementId: liveMovement.id,
                        cleared: clearanceDraft === "cleared",
                      }),
                    () => setShowClearanceModal(false),
                  );
                }}
              >
                {clearanceSave.pending ? "Saving clearance outcome…" : "Save clearance outcome"}
              </button>
              {clearanceGate.note}
            </div>
          </div>
        </div>
      )}

      {targetMovement && showArrivalTimeModal && (
        <ArrivalTimeModal
          isOpen={showArrivalTimeModal}
          onClose={() => setShowArrivalTimeModal(false)}
          movement={targetMovement}
        />
      )}
      {targetMovement && showUploadFormsModal && (
        <UploadFormsCloseContext.Provider value={() => setShowUploadFormsModal(false)}>
          <UploadFormsModal isOpen onClose={() => setShowUploadFormsModal(false)} movement={targetMovement} />
        </UploadFormsCloseContext.Provider>
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
            height="content"
            placement={isPhone ? "bottom" : "right"}
          >
            {transportSection}
            {arrivalSection}
          </PhoneSheet>
        </>
      ) : null}
      {livePatient ? <PatientArchivePanel patientId={livePatient.id} displayName={displayName} /> : null}
      <WardPrototypeFooter testId="ward-patient-now-governance" />
    </main>
  );
}
