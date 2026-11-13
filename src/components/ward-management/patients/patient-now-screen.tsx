"use client";

import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { edActingPlaceId } from "@/components/ward-management/ward-role-access";
import { useWardFormSave } from "../use-ward-form-save";
import { resolveSubjectPatient } from "../ward-patient-resolver";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { patientChronologyHref } from "@/components/ward-management/reports/report-routes";
import {
  Suspense,
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

import { hasCommunityEngagement, recordExtrasFor } from "./patient-record-extras";
import { PatientRecordTabsRow } from "./patient-flight-header";
import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import { edById } from "@/components/ward-management/ward-sites";
import { type CallTarget } from "./patient-call-list";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import type { TransportExceptionReason } from "@/components/ward-management/ward-model";
import { absenceStepsFor, ABSENCE_STEP_LABELS } from "@/components/ward-management/ward-model";
import { heldUnitGenderRefusal } from "@/components/ward-management/ward-flow-reducer";
import type { UploadFormsModalProps } from "@/components/ward-management/referrals/upload-forms-modal";
import { acceptedWardReferralFor } from "@/components/ward-management/referrals/accepted-ward-referral";
import { SYNTHETIC_COPY_LINE } from "@/components/ward-management/ward-clipboard";
import { activeCommunityTreatmentOrder, type Patient } from "@/components/ward-management/ward-patients";
import { LATE_ARRIVAL_GRACE_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { WardMovementNotFound } from "@/components/ward-management/ward-movement-not-found";
import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";
import { preloadWhenIdle } from "../preload-when-idle";
// The arrival-time dialog has no initial-page content. Load it only after its action is opened.
// (Document details load through the cancellable UploadFormsModal below.)
// Care and safety (Josh, 9 Nov 2026) sits below the first screen of the Now tab, so its code loads
// on its own rather than with the patient page's first load.
const PatientCarePlansCard = dynamic(
  withLoadRetry(() => import("./patient-care-plans-card").then((m) => m.PatientCarePlansCard)),
);
const ArrivalTimeModal = dynamic(
  withLoadRetry(() => import("../referrals/arrival-time-modal").then((m) => m.ArrivalTimeModal)),
);
// F-10: transit operations only draw inside the Destination sheet, so their code loads on its own,
// fetched once the page is idle, rather than with the patient page.
const loadTransitOperations = () => import("./patient-transit-operations");
const PatientTransitOperations = dynamic(
  withLoadRetry(() => loadTransitOperations().then((m) => m.PatientTransitOperations)),
);
// Document details have no closed-state work. Keep their code off the first load, with the same
// idle preload as Transit operations and a cancellable, focus-managed dialog while loading.
const loadUploadForms = () => import("../referrals/upload-forms-modal");
const UploadFormsCloseContext = createContext<(() => void) | null>(null);
function UploadFormsPending() {
  const onClose = useContext(UploadFormsCloseContext);
  if (!onClose) return null;
  return (
    <Dialog open onClose={onClose} title="Record document details">
      <p role="status">Loading document details…</p>
    </Dialog>
  );
}
// A failed fetch reaches withLoadRetry, which shows Try again and Close (the render site passes onClose).
const UploadFormsModal = dynamic<UploadFormsModalProps>(
  withLoadRetry(() => loadUploadForms().then((module) => module.UploadFormsModal)),
  { loading: () => <UploadFormsPending /> },
);
// The History, Community, Details and Documents tabs draw nothing until opened, so their code
// stays off the phone's first load and is fetched once the page is idle, like Transit operations.
const loadHistoryTab = () => import("./patient-history-tab");
const loadCommunityTab = () => import("./patient-community-tab");
const loadDetailsTab = () => import("./patient-details-tab");
const loadDocumentsTab = () => import("./patient-documents-tab");
// Each pane wraps its tab in its own Suspense: without one, a tab whose code has not arrived yet
// hid the whole page (React's fallback), and the arrow-key focus on the record tabs fell to the body.
const PatientHistoryTab = dynamic(withLoadRetry(() => loadHistoryTab().then((m) => m.PatientHistoryTab)));
const PatientCommunityTab = dynamic(withLoadRetry(() => loadCommunityTab().then((m) => m.PatientCommunityTab)));
const PatientDetailsTab = dynamic(withLoadRetry(() => loadDetailsTab().then((m) => m.PatientDetailsTab)));
const PatientDocumentsTab = dynamic(withLoadRetry(() => loadDocumentsTab().then((m) => m.PatientDocumentsTab)));
// Triage and risk (built 7 Nov 2026): the signed triages and the Triage action, on Now. Loaded with
// the page's other lazy parts so the movement page's phone first load does not grow.
const PatientTriageCard = dynamic(
  withLoadRetry(() => import("../triage/patient-triage-card").then((m) => m.PatientTriageCard)),
);
const CarerCallbackCard = dynamic(
  withLoadRetry(() => import("@/components/ward-management/carer-callback-card").then((m) => m.CarerCallbackCard)),
);
// Where the hours went, on History. It comes from the same download as the Now tab's handover pack.
const PatientJourneyHours = dynamic(
  withLoadRetry(() => import("./patient-journey-extras").then((m) => m.PatientJourneyHours)),
);
preloadWhenIdle(
  loadTransitOperations,
  loadUploadForms,
  loadHistoryTab,
  loadCommunityTab,
  loadDetailsTab,
  loadDocumentsTab,
);
import { useUndoableStep } from "../use-undoable-step";
import { resolvePatientNowRecord } from "./patient-now-adapter";
import { PATIENT_MODES, patientMode } from "./patient-mode";
import {
  dayLabel,
  referralWaitingForTriage,
  statusCardFocusTargets,
  type PatientStatusContext,
} from "./patient-status-card";
import { focusAfterAction, handFocusTo } from "../focus-after-action";
import { cadNumberLine } from "@/components/ward-management/ward-cad-number";
import type { LeaveKind, WardChangeForm } from "./patient-ward-change-card";
import {
  calendarDateOf,
  formatInstantWithDay,
  formatSince,
  perthClockTime,
  perthIsoDay,
} from "@/components/ward-management/ward-clock";
import type { TransportBookingAnswers } from "@/components/ward-management/ward-transport-checks";
import {
  BLANK_TRANSPORT_BOOKING,
  type TransportBookingSubmission,
} from "@/components/ward-management/transport/transport-booking-form";
import { formProgression } from "@/components/ward-management/ward-legal-form-progression";
import { formTimeLeft } from "@/components/ward-management/legal-forms/legal-form-time-left";
import {
  requiredRoleForPermission,
  roleLimitFrom,
  useDeskRoleSwitch,
  useRoleGate,
  ReadOnlyRecordActions,
  useRouteRole,
} from "@/components/ward-management/ward-role-gate";
import { usePathname } from "next/navigation";
import { type ContactRow } from "./patient-now-cards";
import { movementHasBedHold } from "@/components/ward-management/ward-movement-bed-hold";
import { type PatientNowRecord, STAGES, clock, fillTemplate } from "./patient-now-records";
import styles from "./patient-now.module.css";
import { PatientArchivePanel } from "./patient-archive-panel";
import { PatientGlance, patientStateTag } from "./patient-glance";
import { bookedPlannedAdmissionFor, openReferralFor, openReferralSentTo } from "./patient-open-work";
import { referralSafetyFacts } from "./patient-referral-safety";
import { patientCareJourney } from "./patient-care-journey";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { MeetingActionsDue } from "@/components/ward-management/bed-meeting/meeting-actions-due";
import { useCanOpenHref, useIsDatesOnlyStay } from "@/components/ward-management/shell/ward-access";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { Dialog, PhoneSheet, cx, folderTabClasses, useIsPhone } from "@/components/wf";
import { PatientClearanceDialog, type ClearanceDraft } from "./patient-clearance-dialog";
import { isOnOrder } from "../ward-stay-legal";
import { TIER_NOT_RECORDED } from "../ward-priority";
import { legalStatusTextIsInvoluntary } from "../ward-support-notifications";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { type TabKey, formatTransportLegalStatus, getStageBedflowDetail } from "./patient-now-screen-helpers";
import { renderArrivalSection } from "./patient-now-arrival-section";
import { PatientNowPanel } from "./patient-now-panel";
import { PatientNowSummary } from "./patient-now-summary";
import { renderTransportSection } from "./patient-now-transport-section";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { movementTransferNotesText } from "@/components/ward-management/referral-notes-text";
import { originName as movementOriginName } from "@/components/ward-management/ward-movement-origin";
import { useClockZoneLabel } from "@/components/ward-management/use-clock-zone-label";

interface PatientNowScreenProps {
  patientId?: string;
  movementId?: string;
  initialTaskAction?: "refer" | "contact";
  initialExampleId?: "WF-009" | "WF-004";
  /** DR-11: the tab title. The movement route passes "Movement record — Ward Flow"; never a name. */
  documentTitle?: string;
}

/**
 * The Legal status figure: the status's first word ("Voluntary"), but "Not recorded" stays whole
 * rather than shrinking to "Not" or "Legal".
 */
export function legalStatusFigure(status: string | undefined): string {
  const words = status?.trim();
  if (!words || /^(?:legal status )?not recorded$/i.test(words)) return "Not recorded";
  return words.split(" ")[0] ?? "Not recorded";
}

export function PatientNowScreen({
  patientId,
  movementId,
  initialExampleId = "WF-009",
  initialTaskAction,
  documentTitle = "Patient — Ward Flow",
}: PatientNowScreenProps) {
  const thresholds = useDueSoonThresholds();
  const {
    patients,
    movements,
    referrals,
    admissions,
    units,
    leaveBeds,
    dispatch,
    dayZero,
    rejections,
    worldGeneration,
    plannedAdmissions,
    triages,
  } = useWardFlowSelect(
    "patients",
    "movements",
    "referrals",
    "admissions",
    "units",
    "leaveBeds",
    "dispatch",
    "dayZero",
    "rejections",
    "worldGeneration",
    "plannedAdmissions",
    "triages",
  );
  const now = useWardFlowClock();
  // The held bed review warning sits behind its own flag: paused by D-65, on by default since 20 Oct 2026.
  const awolHoldReview = useWardFeatureFlag("awol-bed-hold-review");
  // Feature 11: actions follow the route's role (`ward-role-permissions.ts`, cross-role pairs listed there).
  const deskSwitch = useDeskRoleSwitch();
  // WF-21 (live test, 4 Nov 2026): as in `useRoleGate`, only a coordinator's desk can switch desks
  // (a shared session offers its own desk chooser instead).
  const access = useEffectiveWardAccess();
  const accessRole = access.role;
  const canSwitchDesk = deskSwitch.shared ? deskSwitch.canSwitch : accessRole === "coordinator";
  // A CTO is logged under the viewer's own role, never borrowed as the community team's.
  const routeRole = useRouteRole();
  // Access audit (31 Oct 2026): a link this desk cannot open is left off, never a dead end.
  const canOpenHref = useCanOpenHref();
  const openable = (href: string | undefined) => (href !== undefined && canOpenHref(href) ? href : undefined);
  const pathname = usePathname() ?? "";
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
  // The record tabs opened so far (see openedTabs below the tab list).
  const [openedTabs, setOpenedTabs] = useState<ReadonlySet<TabKey>>(() => new Set([activeTab]));
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
  // F-57 (A5-18): counts saved bookings, so the heading takes focus in the commit that closes the form,
  // before the panel's own fallback puts it on Close.
  const [transportSaved, setTransportSaved] = useState(0);
  useLayoutEffect(() => {
    if (transportSaved === 0) return;
    const heading = document.getElementById("pnTransportHeading");
    const active = document.activeElement;
    const lost = active === null || active === document.body || !active.isConnected;
    if (heading && lost) handFocusTo(heading);
  }, [transportSaved]);
  const [showArrivalTimeModal, setShowArrivalTimeModal] = useState(false);
  const [showUploadFormsModal, setShowUploadFormsModal] = useState(false);
  const [showClearanceModal, setShowClearanceModal] = useState(false);
  const clearanceTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [clearanceDraft, setClearanceDraft] = useState<ClearanceDraft>("");
  const [clearanceAttested, setClearanceAttested] = useState(false);
  const zone = useClockZoneLabel();
  // A34: the one transport booking form's answers. Legal status starts from Legal now (audit A4-7),
  // and a status that differs from Legal now asks for a recorded reason.
  const [transportAnswers, setTransportAnswers] = useState<TransportBookingAnswers>(BLANK_TRANSPORT_BOOKING);
  const [transportLegalReason, setTransportLegalReason] = useState<TransportExceptionReason | "">("");
  // Draft ownership follows the edited movement, not just its patient route.
  const resolved = useMemo(() => {
    return resolvePatientNowRecord(selectedId, patients, movements, referrals, admissions, units, now, zone);
  }, [selectedId, patients, movements, referrals, admissions, units, now, zone]);
  const gate = useRoleGate({ patientId: resolved?.livePatient?.id });
  const clearanceGate = gate("RECORD_MOVEMENT_MEDICAL_CLEARANCE");
  const readOnlyRecord = clearanceGate.reason === "Exceptional access is read only.";
  const liveMovement = resolved?.liveMovement ?? movements.find((m) => m.id === selectedId);
  const movementScope = `${worldGeneration}:${selectedId}:${liveMovement?.id ?? ""}`;
  const transportSave = useWardFormSave(movementScope);
  const clearanceSave = useWardFormSave(movementScope);
  const wardSave = useWardFormSave(`${worldGeneration}:${resolved?.liveAdmission?.id ?? selectedId}`);
  const [previousMovementScope, setPreviousMovementScope] = useState(movementScope);
  if (previousMovementScope !== movementScope) {
    setPreviousMovementScope(movementScope);
    setShowClearanceModal(false);
    setClearanceDraft("");
    setClearanceAttested(false);
    setShowTransportForm(false);
    setTransportAnswers(BLANK_TRANSPORT_BOOKING);
    setTransportLegalReason("");
  }
  const [bookingRejectionStart, setBookingRejectionStart] = useState<number>();

  const closeClearanceModal = useCallback(() => {
    if (!clearanceSave.pending) setShowClearanceModal(false);
  }, [clearanceSave.pending, setShowClearanceModal]);

  // Synchronize document title
  useEffect(() => {
    document.title = documentTitle;
  }, [documentTitle]);

  const isDatesOnlyStay = useIsDatesOnlyStay();

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
  const livePatient = resolved.livePatient as (Patient & { confidential?: boolean }) | undefined;

  // Helper values
  const waitedStr = liveMovement ? formatSince(liveMovement.openedAt, now) : "Not recorded";
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
  // D-187 (F-46): a pulled bed with no limit recorded is still pulled, and its banner says so.
  const isPulled = isLiveBedflow && (liveMovement?.pullExpiresAt !== undefined || liveMovement?.stage === "pulled");

  const acceptingUnit = liveMovement?.acceptedUnitId
    ? units.find((u) => u.id === liveMovement.acceptedUnitId)
    : undefined;
  const acceptingWardName = acceptingUnit?.name ?? "Accepting ward";

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
    const urgencyLabel = urgencyTier ? `Tier ${urgencyTier}` : TIER_NOT_RECORDED;
    // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
    // Audit 1 (CS-12, Josh 20 Oct): the synthetic line first in every copy.
    const text = `${SYNTHETIC_COPY_LINE}\nWard Flow handover summary — ${displayName} (${urgencyLabel})\nStatus: ${record.verdict.title}\nSince movement opened: ${waitedStr}\nNext action: ${record.next[0]?.w ?? "Review"}`;
    void copyTextToClipboard(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      // A refused copy leaves the button as it was, as before the shared helper.
      () => undefined,
    );
  }

  // Item 27 (10 Nov 2026): the transfer as plain recorded facts, for the notes, once a ward accepted.
  const transferNotes = () =>
    liveMovement
      ? movementTransferNotesText(liveMovement, { patientName: displayName, units, admissions, now })
      : undefined;

  // Keyboard navigation for tablist
  // Round 2 (Josh, 1 Nov 2026): Community shows only when community engagement is noted (a team
  // episode or a CTO); a catchment match alone stays in Details. The phone keeps every tab (Q121).
  const showCommunity = hasCommunityEngagement(livePatient?.id, livePatient?.communityTreatmentOrder);
  const extras = recordExtrasFor(livePatient?.id);
  // A "contact" task opens on Community; with no engagement noted, Now (Who to call) takes it.
  if (activeTab === "community" && !showCommunity) setActiveTab("now");
  // A record tab mounts the first time it is opened and stays mounted, so its code is not on the
  // first load and its own state (search, filters, open rows) survives switching tabs.
  if (!openedTabs.has(activeTab)) setOpenedTabs(new Set([...openedTabs, activeTab]));
  const TAB_KEYS: TabKey[] = [
    "now",
    "history",
    ...(showCommunity ? (["community"] as const) : []),
    "details",
    "documents",
  ];
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
      ? `${formatInstantWithDay(liveMovement.transport.estimatedAt, now)} ${zone}`
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
    transportSave.forget();
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
      () => {
        // F-57 (A5-18): the form, and the Save pressed, go away while the Transport panel stays open.
        // Focus goes to the panel's heading, above the booking just saved (`transportHeadingRef`).
        setTransportSaved((count) => count + 1);
        setShowTransportForm(false);
      },
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
  // Page tops (QA, 10 Nov 2026): the phone's one identity line names the ED by its short name ("ARM ED").
  const originEdCode = liveMovement?.originEdId === undefined ? undefined : edById(liveMovement.originEdId)?.siteCode;
  const where =
    mode === "find" || mode === "held"
      ? isPhone && originEdCode
        ? `${originEdCode} ED`
        : originName
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
  const awaySince =
    mode === "leave"
      ? stayLeaveBed?.confirmedAt
      : mode === "awol"
        ? stayLeaveBed?.absentWithoutLeave?.since
        : mode === "ed"
          ? (resolved.liveAdmission?.awayAtEmergencyDepartmentSince ?? undefined)
          : undefined;
  const formMovement = movementInForce ? liveMovement : stayCurrent ? heroStayMovement : undefined;
  const ctoInForce = activeCommunityTreatmentOrder(livePatient);
  const movementTimeLeft =
    isLiveBedflow && !formProgression(liveMovement) ? formTimeLeft(liveMovement, now, thresholds, dayZero) : undefined;
  // Redesign (Josh, 30 Oct 2026): one place per fact. The phone hero no longer repeats the legal
  // figure; Legal now carries the form, its typed end and Form 6A still to record.
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
    if (!stayLeaveBed || !gate("END_LEAVE_BED").allowed) return;
    const leaveBed = stayLeaveBed;
    // Tier 1 item 6 (Josh, 4 Nov 2026): a return tapped by mistake comes back from its toast.
    runStep(
      { type: "END_LEAVE_BED", role: routeRole, now, leaveBedId: leaveBed.id, actingUnitId: leaveBed.unitId },
      {
        success: "Returned from leave",
        undo: (at) => ({
          type: "UNDO_BED_STEP",
          role: routeRole,
          now: at,
          leaveBedId: leaveBed.id,
          ...(routeRole === "ward" ? { actingUnitId: leaveBed.unitId } : {}),
        }),
        undone: "Undone. Back on leave.",
      },
    );
  }
  function markAbsent() {
    const stay = resolved?.liveAdmission;
    // D-187 item 16 (Q38): the Undo message names what it restores. Marked absent from leave, the
    // person goes back on leave; marked absent from the ward, they go back on the ward.
    const fromLeave = stayLeaveBed !== undefined && stayLeaveBed.absentWithoutLeave === undefined;
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
          undone: fromLeave ? "Undone. Back on leave." : "Undone. Back on the ward.",
        },
      );
  }
  const wardForm: WardChangeForm = wardFormFor.admissionId === resolved?.liveAdmission?.id ? wardFormFor.form : "none";
  function showWardForm(form: WardChangeForm) {
    wardSave.forget();
    setWardFormFor({ admissionId: resolved?.liveAdmission?.id, form });
  }
  // Every opening path (the change card and the status card's discharge date) waits for an
  // in-flight or held save: forgetting it would drop its refusal or leave an accepted form open.
  function setWardForm(form: WardChangeForm) {
    if (wardSave.pending) return;
    showWardForm(form);
  }
  // Leave, gone to ED and the discharge date, from the change card. Each remembers where the
  // rejection list stood, so the card can say when the engine refused.
  function recordLeave(expectedReturn: number, kind: LeaveKind, psychiatristAuthorised?: boolean) {
    const stay = resolved?.liveAdmission;
    if (!stay || !gate("RECORD_LEAVE_BED").allowed) return;
    setWardAttemptFor({ admissionId: stay.id, start: rejections.length });
    wardSave.submit(
      () =>
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
        }),
      () => showWardForm("none"),
    );
  }
  function goneToEd() {
    const stay = resolved?.liveAdmission;
    if (!stay || !gate("RECORD_AWAY_AT_EMERGENCY_DEPARTMENT").allowed) return;
    setWardAttemptFor({ admissionId: stay.id, start: rejections.length });
    wardSave.submit(
      () =>
        dispatch({
          type: "RECORD_AWAY_AT_EMERGENCY_DEPARTMENT",
          role: routeRole,
          now,
          admissionId: stay.id,
          actingUnitId: stay.unitId,
        }),
      () => showWardForm("none"),
    );
  }
  function returnFromEd() {
    const stay = resolved?.liveAdmission;
    if (!stay || !gate("RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT").allowed) return;
    setWardAttemptFor({ admissionId: stay.id, start: rejections.length });
    // No form to close: the At ED card shows the save in flight and any failure on its Return cell.
    wardSave.submit(
      () =>
        dispatch({
          type: "RECORD_RETURNED_FROM_EMERGENCY_DEPARTMENT",
          role: routeRole,
          now,
          admissionId: stay.id,
          actingUnitId: stay.unitId,
        }),
      () => {},
    );
  }
  function saveDischarge(expectedDischargeAt: number) {
    const stay = resolved?.liveAdmission;
    if (!stay || !gate("UPDATE_EXPECTED_DISCHARGE").allowed) return;
    setWardAttemptFor({ admissionId: stay.id, start: rejections.length });
    wardSave.submit(
      () =>
        dispatch({
          type: "UPDATE_EXPECTED_DISCHARGE",
          role: routeRole,
          now,
          admissionId: stay.id,
          expectedDischargeAt,
          actingUnitId: stay.unitId,
        }),
      () => showWardForm("none"),
    );
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
  // A16-11 (Josh, 13 Nov 2026): a referral awaiting an answer and a booked planned admission are open
  // work, so a person with only those is never "Not active".
  const openReferral = acceptedWardFor ? undefined : openReferralFor(livePatient?.id, referrals);
  const plannedBooking = bookedPlannedAdmissionFor(livePatient?.id, plannedAdmissions);
  const waitingForTriage = referralWaitingForTriage(livePatient?.id, referrals, triages);
  const statusContext: PatientStatusContext = {
    awolHoldReview,
    movement: liveMovement,
    admission: resolved.liveAdmission,
    stayWithheld: isDatesOnlyStay(resolved.liveAdmission?.id),
    patient: livePatient,
    acceptedUnitName: acceptingUnit?.name ?? stayUnit?.name,
    // Decision 2 (site review, 12 Oct 2026): the Bed value opens the ward, the Transport value the
    // movement's own page with its transport job (not linked when that is this page already).
    bedHref: openable(
      (acceptingUnit ?? stayUnit) !== undefined
        ? `/ward-flow/ward/${encodeURIComponent((acceptingUnit ?? stayUnit)!.id)}`
        : undefined,
    ),
    acceptedReferral: acceptedWardFor
      ? {
          unitName: acceptedWardFor.unitName,
          boardHref: openable(`/ward-flow/ward/${encodeURIComponent(acceptedWardFor.unitId)}?tab=board`),
        }
      : undefined,
    openReferral: openReferral
      ? {
          sentTo: openReferralSentTo(openReferral),
          owner: openReferral.communityOnly ? "Community team" : openReferral.wards > 0 ? "Ward" : "Receiving service",
          raisedAt: openReferral.raisedAt,
        }
      : undefined,
    // A9-20(a): only read when nothing else is open, so a ward answer or a stay still leads.
    referralWaitingForTriage: waitingForTriage,
    plannedAdmission: plannedBooking
      ? {
          unitName: units.find((unit) => unit.id === plannedBooking.unitId)?.name ?? "a ward not recorded",
          expectedArrivalAt: plannedBooking.expectedArrivalAt,
        }
      : undefined,
    transportHref: openable(
      liveMovement && !pathname.includes(movementHref(liveMovement.id)) ? movementHref(liveMovement.id) : undefined,
    ),
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
      clearanceSave.forget();
      setShowClearanceModal(true);
    },
    onBookTransport: () => {
      openTransportForm();
      setNowSheet("transport");
    },
    // K37 / F-101 (Josh, 13 Nov 2026): Change beside "Not needed" records that transport is needed,
    // the same event the ED row's Change sends, so Log booking comes back. Undo on its toast.
    onTransportNeeded: () => {
      if (!liveMovement || !gate("RECORD_TRANSPORT_NEED").allowed) return;
      const movementId = liveMovement.id;
      runStep(
        {
          type: "RECORD_TRANSPORT_NEED",
          role: routeRole,
          now,
          movementId,
          needed: true,
          ...(transportActingUnitId ? { actingUnitId: transportActingUnitId } : {}),
          ...(routeRole === "ed" ? { actingPlaceId: edActingPlaceId(access, liveMovement.originEdId) } : {}),
        },
        {
          success: "Recorded: transport needed",
          // A ward recorded it as the sending ward, so its Undo names that ward too, or the
          // engine's "only the ward that made this decision" check refuses it.
          undo: (at) => ({
            type: "UNDO_ED_STEP",
            role: routeRole,
            now: at,
            movementId,
            ...(transportActingUnitId ? { actingUnitId: transportActingUnitId } : {}),
          }),
          undone: "Undone. Back as it was.",
        },
      );
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
    edReturnPending: mode === "ed" && wardSave.pending,
    edReturnSaveError: mode === "ed" ? wardSave.error : undefined,
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
    // Tier 1 item 6 (Josh, 4 Nov 2026): recording or ending an order offers Undo on its toast.
    onRecordCto: () => {
      if (!livePatient || !gate("RECORD_COMMUNITY_TREATMENT_ORDER").allowed) return;
      const patientId = livePatient.id;
      runStep(
        { type: "RECORD_COMMUNITY_TREATMENT_ORDER", role: routeRole, now, patientId },
        {
          success: "Community treatment order recorded",
          undo: (at) => ({ type: "UNDO_PATIENT_RECORD", role: routeRole, now: at, patientId }),
        },
      );
    },
    onEndCto: () => {
      if (!livePatient || !gate("END_COMMUNITY_TREATMENT_ORDER").allowed) return;
      const patientId = livePatient.id;
      runStep(
        { type: "END_COMMUNITY_TREATMENT_ORDER", role: routeRole, now, patientId },
        {
          success: "Community treatment order ended",
          undo: (at) => ({ type: "UNDO_PATIENT_RECORD", role: routeRole, now: at, patientId }),
        },
      );
    },
    // F-54 (A9-35): `null` for an action this desk can never take, so the status card leaves it out.
    roleLimit: roleLimitFrom(gate),
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
        role: displayCadNumber ? `Transport, ${cadNumberLine(displayCadNumber)}` : "Transport",
      });
    if (originName) contacts.push({ name: originName, role: sender });
  } else if ((mode === "ward" || mode === "leave" || mode === "awol" || mode === "ed") && (stayUnit ?? acceptingUnit)) {
    const wardUnit = stayUnit ?? acceptingUnit;
    if (wardUnit) contacts.push({ name: wardUnit.name, role: "Ward, nurse in charge" });
    const police = stayLeaveBed?.absentWithoutLeave?.steps.find((done) => done.step === "police_notified")?.at;
    if (mode === "awol" && police !== undefined) contacts.push({ name: "Police", role: `Notified ${clock(police)}` });
  }
  // Round 2 (1 Nov 2026): with a community team actively caring, the case manager is the first call
  // in the community and the team is named as caring, not as a catchment.
  const activeCommunity = recordExtrasFor(livePatient?.id)?.community?.find((item) => item.status === "active");
  if (activeCommunity)
    contacts.push({
      name: activeCommunity.caseManager.name,
      // PT1: the title WA community teams use for the person who holds the care.
      role: `Care coordinator, ${activeCommunity.team}`,
      phone: activeCommunity.caseManager.phone,
    });
  if (livePatient?.catchmentCommunityTeam)
    contacts.push({
      name: livePatient.catchmentCommunityTeam,
      role:
        activeCommunity?.team === livePatient.catchmentCommunityTeam
          ? "Community team, caring now"
          : "Catchment community team",
    });
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
    return { kind: "plain", name: row.name, role: row.role, phone: row.phone };
  });
  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: "now", label: "Now" },
    { key: "history", label: "History", count: record.presentations.length + (extras?.episodes.length ?? 0) },
    ...(showCommunity ? [{ key: "community" as const, label: "Community" }] : []),
    { key: "details", label: "Details" },
    { key: "documents", label: "Documents", count: documentCount + (extras?.documents.length ?? 0) },
  ];
  const phoneMovement = isPhone && isLiveBedflow && liveMovement !== undefined;
  // The phone shows the same tabs as the desktop, counts included (page tops, QA 10 Nov 2026).
  // Phone audit (1 Nov 2026): "Documents" was cut to "Documen" at 390 px; "Docs" lets all five fit.
  const phoneTabs = tabs.map((tab) => ({
    ...tab,
    label: tab.key === "documents" ? "Docs" : tab.label,
  }));
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
    zone,
  });

  /* Now tab: one next step; destination and transport open as sheets. */
  const openTab = (tab: TabKey) => {
    setActiveTab(tab);
    requestAnimationFrame(() => document.getElementById(`pntab-${tab}`)?.focus());
  };
  // PT1 (Josh, 3 Nov 2026): the band leads with legal, observation and risk for every state.
  // H10: risk flags and the working diagnosis come from the one referral the movement in focus
  // names, and only when this desk's scoped workspace holds it (patient-referral-safety.ts).
  // D-186 Q7: the band's movement is the one legal reading's (the adapter keeps the rule it had here:
  // the live movement in force, else the current stay's own, else the live movement).
  const legalNow = resolved.legalNow;
  const glanceMovement = legalNow.movement;
  const referralSafety = referralSafetyFacts(
    glanceMovement,
    glanceMovement?.referralId === undefined
      ? undefined
      : referrals.find((referral) => referral.id === glanceMovement.referralId),
  );
  const referralWhen =
    referralSafety.kind === "shown" ? dayLabel(referralSafety.raisedAt, dayZero).replace(",", "") : undefined;
  const activeCommunityEpisode = recordExtrasFor(livePatient?.id)?.community?.find(
    (episode) => episode.status === "active",
  );
  const stateTag = patientStateTag({
    mode,
    movement: liveMovement,
    communityActive: Boolean(ctoInForce || activeCommunityEpisode),
    openWork:
      acceptedWardFor || plannedBooking || (openReferral && !openReferral.communityOnly)
        ? "bed"
        : openReferral
          ? "community"
          : undefined,
    waitingForTriage,
  });
  // PT1 round 3 (Josh, 3 Nov 22:29Z): the patient's journey in six plain steps, from the record.
  const careSteps = patientCareJourney({
    mode,
    movement: glanceMovement,
    stay: heroStay,
    stayCurrent,
    stayDay,
    communityTeam: activeCommunityEpisode?.team,
    ctoInForce: Boolean(ctoInForce),
    day: (at) => dayLabel(at, dayZero).replace(",", ""),
  });
  // The band's typed expiry for the form in force, for a ward stay as well as a live placement. A form
  // a person recorded as ended has no expiry in force (currentLegalDueAt, A1); a form with a next form
  // to record shows that prompt on the band instead.
  const bandTimeLeft =
    glanceMovement && !formProgression(glanceMovement)
      ? formTimeLeft(glanceMovement, now, thresholds, dayZero)
      : undefined;
  const glance = (
    <PatientGlance
      mode={mode}
      patient={livePatient}
      movement={glanceMovement}
      legalNow={legalNow}
      admission={stayCurrent ? resolved.liveAdmission : undefined}
      leaveBed={stayLeaveBed}
      stayWithheld={statusContext.stayWithheld}
      formTimeLeft={bandTimeLeft}
      riskFlags={referralSafety.kind === "shown" ? referralSafety.riskFlags : undefined}
      riskFlagsWhen={referralWhen}
      riskNotShared={referralSafety.kind === "not_shared"}
      healthAlerts={recordExtrasFor(livePatient?.id)?.alerts}
      onOpenForms={() => openTab("documents")}
      onOpenDetails={() => openTab("details")}
      recordCto={
        livePatient
          ? { onClick: statusContext.onRecordCto, reason: gate("RECORD_COMMUNITY_TREATMENT_ORDER").reason }
          : undefined
      }
    />
  );
  const nowPanel = (
    <PatientNowPanel
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
      handoverRiskFlags={
        glanceMovement !== liveMovement
          ? undefined
          : referralSafety.kind === "not_shared"
            ? "not_shared"
            : referralSafety.kind === "shown"
              ? referralSafety.riskFlags
              : undefined
      }
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
      patientName={displayName}
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
      wardPending={wardSave.pending}
      wardRefusal={wardRefusal}
      wardSaveError={wardSave.error}
      notices={
        <>
          {/* Overall review, 20 Oct 2026: the owner of a bed meeting action marks it done here. */}
          <MeetingActionsDue subject={liveMovement && { kind: "movement", id: liveMovement.id }} />
          <MeetingActionsDue subject={resolved.liveAdmission && { kind: "admission", id: resolved.liveAdmission.id }} />
        </>
      }
      tiles={
        <>
          <PatientTriageCard patientId={livePatient?.id} />
          <CarerCallbackCard tile admissionId={resolved.liveAdmission?.id} movementId={liveMovement?.id} />
        </>
      }
      care={
        // Care plans and safety flags (Josh, 9 Nov 2026): the plan, hearing date, carer told and
        // cultural support, on the record's own facts.
        livePatient ? (
          <PatientCarePlansCard
            patient={livePatient}
            role={routeRole}
            now={now}
            todayIso={perthIsoDay(displayToday)}
            nowClock={perthClockTime(displayToday)}
            hasCarer={(extras?.supports.length ?? 0) > 0}
            episodes={extras?.episodes}
            gate={gate}
            run={(event, success, onRefused) => runStep(event, { success, onRefused })}
          />
        ) : null
      }
    />
  );

  /* The record tabs. On a phone they render beside the record (below), pinned under the header. */
  const recordTabs = (
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tab stop: arrow keys bubble up from the focused tab, option or item
    <div
      className={cx(styles.v6FolderSwitch, folderTabClasses.switch)}
      role="tablist"
      aria-label="The record"
      onKeyDown={handleTabKeyDown}
    >
      {(isPhone ? phoneTabs : tabs).map((tab) => (
        <button
          key={tab.key}
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

  const content = (
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
      {readOnlyRecord ? (
        <p role="status">Exceptional access is read only. Clinical and record changes are unavailable.</p>
      ) : null}
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
          transferNotes={liveMovement?.acceptedUnitId ? transferNotes : undefined}
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
          phoneMovement={phoneMovement}
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
          glance={glance}
          stateTag={stateTag}
          careSteps={careSteps}
          onOpenHistory={() => openTab("history")}
          onOpenForms={() => openTab("documents")}
          tabValue={activeTab}
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
        {isPhone ? <PatientRecordTabsRow tabs={recordTabs} value={activeTab} /> : null}

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
              {openedTabs.has("history") ? (
                <Suspense fallback={null}>
                  <PatientHistoryTab
                    record={record}
                    patientId={livePatient?.id}
                    movement={liveMovement}
                    dayZero={dayZero}
                    unitName={(id) => units.find((u) => u.id === id)?.name}
                    stays={resolved.stays}
                    absence={stayLeaveBed?.absentWithoutLeave}
                    absenceVoluntary={voluntaryNow}
                    chronologyHref={openable(livePatient ? patientChronologyHref(livePatient.id) : undefined)}
                    hours={
                      isLiveBedflow && liveMovement ? (
                        <PatientJourneyHours movement={liveMovement} now={now} />
                      ) : undefined
                    }
                    open={!modeMeta.quiet}
                    onBackToNow={() => {
                      setActiveTab("now");
                      requestAnimationFrame(() => document.getElementById("pntab-now")?.focus());
                    }}
                  />
                </Suspense>
              ) : null}
            </div>

            {/* Tab 3: COMMUNITY */}
            <div
              className={styles.v6TabPane}
              role="tabpanel"
              id="pnpane-community"
              aria-labelledby="pntab-community"
              hidden={activeTab !== "community"}
            >
              {openedTabs.has("community") ? (
                <Suspense fallback={null}>
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
                </Suspense>
              ) : null}
              {canSwitchDesk && !gate("RECORD_COMMUNITY_TREATMENT_ORDER").allowed ? (
                <div className="lockline">
                  <button
                    type="button"
                    className="lockline"
                    onClick={() =>
                      deskSwitch.switchDesk(
                        requiredRoleForPermission(
                          "RECORD_COMMUNITY_TREATMENT_ORDER",
                          gate("RECORD_COMMUNITY_TREATMENT_ORDER").reason,
                        ).role,
                        pathname,
                      )
                    }
                    data-testid="ward-patient-role-switch-community"
                  >
                    {deskSwitch.shared
                      ? "Choose a desk"
                      : `Switch to ${
                          requiredRoleForPermission(
                            "RECORD_COMMUNITY_TREATMENT_ORDER",
                            gate("RECORD_COMMUNITY_TREATMENT_ORDER").reason,
                          ).label
                        } desk`}{" "}
                    →
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
              {openedTabs.has("details") ? (
                <Suspense fallback={null}>
                  <PatientDetailsTab
                    patient={livePatient}
                    movement={liveMovement}
                    referralSafety={referralSafety}
                    referralWhen={referralWhen}
                    displayName={displayName}
                    preferredName={preferredName}
                    foot={
                      livePatient ? <PatientArchivePanel patientId={livePatient.id} displayName={displayName} /> : null
                    }
                  />
                </Suspense>
              ) : null}
            </div>

            {/* Tab 5: DOCUMENTS */}
            <div
              className={styles.v6TabPane}
              role="tabpanel"
              id="pnpane-documents"
              aria-labelledby="pntab-documents"
              hidden={activeTab !== "documents"}
            >
              {openedTabs.has("documents") ? (
                <Suspense fallback={null}>
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
                </Suspense>
              ) : null}
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

      <PatientClearanceDialog
        open={showClearanceModal}
        onClose={closeClearanceModal}
        returnFocusRef={clearanceTriggerRef}
        patientName={displayName}
        umrn={livePatient?.umrn}
        gate={clearanceGate}
        hasJourney={Boolean(liveMovement)}
        draft={clearanceDraft}
        onDraftChange={setClearanceDraft}
        attested={clearanceAttested}
        onAttestedChange={setClearanceAttested}
        pending={clearanceSave.pending}
        error={clearanceSave.error}
        onSave={() => {
          if (!liveMovement) return;
          clearanceSave.submit(
            () =>
              dispatch({
                type: "RECORD_MOVEMENT_MEDICAL_CLEARANCE",
                role: routeRole,
                now,
                movementId: liveMovement.id,
                cleared: clearanceDraft === "cleared",
                ...(routeRole === "ed" ? { actingPlaceId: edActingPlaceId(access, liveMovement.originEdId) } : {}),
              }),
            () => setShowClearanceModal(false),
          );
        }}
      />

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
            onClose={() => {
              setNowSheet(null);
              // F-57 (A5-18): Esc gives focus back to what opened the panel. When a booking has
              // replaced that control, focus goes to the status card's transport step instead.
              focusAfterAction(() => statusCardFocusTargets(null));
            }}
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
      <WardPrototypeFooter testId="ward-patient-now-governance" />
    </main>
  );
  return <ReadOnlyRecordActions value={readOnlyRecord}>{content}</ReadOnlyRecordActions>;
}
