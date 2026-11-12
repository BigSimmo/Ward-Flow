"use client";

import { plural } from "../ward-plural";
import { confirmLeavingShell } from "../shell/ward-leave-guard";

import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { areCharacterShortcutsEnabled } from "@/components/ward-management/shell/ward-character-shortcuts";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { isOfficerJob, officerCancellationNotices } from "./officer-jobs";
import { useOfficerDiversionSave } from "./use-officer-diversion-save";
import { ReturnEarlyAlerts } from "@/components/ward-management/out-of-area/return-early-alerts";
import { useTransportCommandFeedback } from "./use-transport-command-feedback";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  ClipboardList,
  ListChecks,
  Lock,
  MapPin,
  Search,
  Shield,
  ShieldCheck,
  Ambulance,
  User,
  X,
} from "lucide-react";

import {
  Button,
  Card,
  CardBody,
  CardHead,
  EmptyState,
  FilterChip,
  FolderTabs,
  folderTabClasses,
  Hero,
  HeroAct,
  HeroBand,
  HeroFigures,
  HeroQuickChips,
  HeroTop,
  LiveChip,
  Icon,
  Kbd,
  Segmented,
  ShowMoreRow,
  SrOnly,
  StatusGlyph,
  StatusLine,
  TabPanel,
  Tabs,
  TextInput,
  cx,
  durMinutes,
  requestConfirm,
  tableClasses,
  useIsPhone,
  useModalFocus,
  type HeroChipItem,
} from "@/components/wf";
import { transportLeg } from "@/components/ward-management/ward-derivations";
import { transportDelay } from "@/components/ward-management/transport/transport-delay";
import { OfficerStageCell } from "./officer-stage-cell";
import { movementUmrn, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { formatDateOfBirth } from "@/components/ward-management/ward-patients";
import {
  formatInstant,
  formatInstantWithDay,
  formatSheetMoment,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { usePageLive } from "@/components/ward-management/ward-page-live";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import { transportEtaRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { TRANSPORT_PROVIDERS, type Movement, type Unit } from "@/components/ward-management/ward-model";
import { wardLabel } from "@/components/ward-management/ward-absence-labels";
import { movementOriginLabel, originSiteCode, sourceWardName } from "@/components/ward-management/ward-movement-origin";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import { changeReasonLabels } from "@/components/ward-management/ward-change-reasons";

import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import {
  OfficerFormsCell,
  PACK_SLOTS,
  jobIsInvoluntary,
  packCount,
  packNeedsForms,
  packOutstanding,
  packRequired,
} from "./officer-forms-pack";
import titles from "@/components/ward-management/page-top-title.module.css";
import styles from "./officer.module.css";
import { OfficerFormCheckDialog } from "./officer-form-check-dialog";
import { TransportExceptionDialog } from "@/components/ward-management/transport-exception-dialog";
import type { TransportExceptionInput } from "@/components/ward-management/ward-flow-events";
import { collectionGaps } from "@/components/ward-management/ward-transport-checks";
import { SYNTHETIC_COPY_LINE } from "@/components/ward-management/referrals/referral-letter";
import {
  type HighlightPill,
  type HistoryTab,
  arrivalsAxis,
  deliveredSinceStartOfDay,
  type JobsTab,
  LEG_TONE,
  OFFICER_ACTION_REJECTION_LABELS,
  OFFICER_LEG_STEPS,
  type OfficerLeg,
  type SortKey,
  acceptedBlockedReason,
  arrivedBlockedReason,
  collectedBlockedReason,
  enRouteBlockedReason,
  expectedArrival,
  nextActionVerb,
  officerLeg,
  pastWardEta,
  revokedHoldingBedReason,
  stageSince,
  stageStartedAt,
} from "./officer-screen-helpers";
import { renderArrivalsCard } from "./officer-arrivals-card";
import { OfficerOrderNote, useOfficerDelayedFilter } from "./officer-order-note";
import { type OfficerDetailTab, type OfficerJobDetailContext } from "./officer-job-detail";
import { OfficerJobPanel, formsMissingNote } from "./officer-job-panel";
import { OfficerDeliveredRow } from "./officer-history-row";
import {
  NeedsTransportCard,
  OfficerBookingPanel,
  heldClock,
  scrollToNeedsTransport,
  useNeedsTransport,
  withCrewLimit,
} from "./officer-needs-transport";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { hasOpenSheet } from "@/components/wf/sheet-focus";
import { useWardShellPublic } from "@/components/ward-management/shell/ward-shell-public-context";
import { replaceSearchParams, useLocationSearch } from "@/components/ward-management/ward-url-state";
import { fieldsMatchEveryWord } from "@/components/ward-management/search/search-text";
export {
  acceptedBlockedReason,
  enRouteBlockedReason,
  collectedBlockedReason,
  arrivedBlockedReason,
} from "./officer-screen-helpers";

// THE JOBS THIS PHONE SCREEN SHOWS: the predicate lives in `officer-jobs.ts` so Settings' workstation
// drawer counts the same jobs without importing this screen.
export { isOfficerJob };

/** ROLE BRANCH (officer): the officer's job list opens on this many rows, then "Show all". */
const OFFICER_JOB_ROWS = 8;
const CHIP_ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

/**
 * TRANSPORT PAGE A, 9 October 2026 (Josh picked direction A of the Transport mockups). The hero
 * counts the jobs by what each is waiting on; its pills, the provider row, the chips and the search
 * HIGHLIGHT rows and never hide one. The jobs table runs the full width until a patient is chosen,
 * then the job panel opens beside it (a bottom sheet on a phone) with the route, the four stage
 * actions, the forms pack, the booking facts, the arrival plan and activity. Arrivals sits under
 * the table. Closed work (delivered today, refused, cancelled) lives in History.
 *
 * **Left out, because the app has no such action or record:** Dispatch comms and Call ward (no
 * call is placed from this prototype), Stand down (the officer may not cancel a transport — see
 * `EVENT_ROLE.CANCEL_TRANSPORT`), the receiving nurse and bed on the arrival plan. Log booking and
 * Send to officer are Preview: `BOOK_TRANSPORT` is the sending team's event, and no event sends a
 * forms pack yet.
 */
export function OfficerScreen() {
  const { movements, units, rejections, patients, referrals, admissions, dayZero, notices } = useWardFlowSelect(
    "movements",
    "admissions",
    "units",
    "rejections",
    "patients",
    "referrals",
    "dayZero",
    "notices",
  );
  // Release gate (layout shift 0.144 on a phone, 31 Oct 2026): the kit's hook reads the server's
  // phone guess on first paint, so the phone hero is drawn at once instead of after the code runs.
  const isPhone = useIsPhone();
  const officerPatientName = useCallback(
    (movement: Movement) => {
      const info = resolveSubjectPatient(movement, { patients, referrals, movements });
      // Redesign (D-83): surname first at every width, as every other page lists people.
      return info.patient ? info.formalName : "Not recorded";
    },
    [patients, referrals, movements],
  );
  // Owner, 26 Sept 2026: undefined (not "Not recorded") lets the blocked-reason helpers below
  // fall back to their own "This patient" wording instead of printing a placeholder mid-sentence.
  const resolvedPatientName = (movement: Movement): string | undefined => {
    const info = resolveSubjectPatient(movement, { patients, referrals, movements });
    return info.patient ? info.formalName : undefined;
  };
  // D-39: the patient's UMRN is shown wherever the WF journey number used to be.
  const umrnLookup = useMemo(() => ({ patients, referrals, movements }), [patients, referrals, movements]);
  const umrnFor = useCallback((movement: Movement) => movementUmrn(movement, umrnLookup), [umrnLookup]);
  const nameFor = usePatientNameDisplay();
  const officerListPatientName = (movement: Movement) => nameFor(officerPatientName(movement), umrnFor(movement));
  const patientNameForMovementId = (movementId: string) => {
    const movement = movements.find((candidate) => candidate.id === movementId);
    return movement ? officerListPatientName(movement) : "Not recorded";
  };
  // Page tops (9 Nov 2026): the Demo pill pauses the desk, as on Alerts and Places.
  const live = usePageLive();
  const now = live.now;

  const [collectCheckId, setCollectCheckId] = useState<string | null>(null);
  // #236 (Josh, 27 Oct): jobs whose crew tapped "Identity checked with the sending team". Sent with Collected; no gate.
  const [identityCheckedIds, setIdentityCheckedIds] = useState<ReadonlySet<string>>(() => new Set());
  const accessLifetime = useWardShellPublic()?.accessLifetime;
  const identityCheckKey = (movement: Movement) =>
    JSON.stringify([accessLifetime, movement.id, movement.transport?.id]);
  const identityFor = (movement: Movement) => {
    const info = resolveSubjectPatient(movement, { patients, referrals, movements });
    return {
      name: info.patient ? info.formalName : "Name not recorded",
      umrn: info.umrn,
      dob: info.patient?.dateOfBirth ? formatDateOfBirth(info.patient.dateOfBirth) : "not recorded",
    };
  };
  const toggleIdentityChecked = (movement: Movement) =>
    setIdentityCheckedIds((current) => {
      const next = new Set(current);
      const key = identityCheckKey(movement);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const jobs = movements.filter(isOfficerJob);
  const cancellations = officerCancellationNotices(notices ?? [], now);
  const collectCheck = collectCheckId ? movements.find((movement) => movement.id === collectCheckId) : undefined;
  const unitFor = (movement: Movement): Unit | undefined =>
    movement.acceptedUnitId ? units.find((unit) => unit.id === movement.acceptedUnitId) : undefined;
  const destinationLabelFor = (movement: Movement) =>
    movement.acceptedUnitId
      ? wardLabel(movement.acceptedUnitId, unitFor(movement)?.name)
      : "No accepted destination recorded";
  // WF-J03: a ward-to-ward journey is collected from the sending ward, as Handover shows it.
  const originLabelFor = (movement: Movement) => {
    const sendingWard = sourceWardName(movement, admissions, units);
    if (sendingWard !== undefined) return sendingWard;
    const originEd = edById(movement.originEdId);
    return movementOriginLabel(movement, originEd && `${originEd.name} (${originEd.siteCode})`);
  };
  const originShortFor = (movement: Movement) =>
    sourceWardName(movement, admissions, units) ?? originSiteCode(movement) ?? originLabelFor(movement);

  // Highlights (Josh, 9 Oct 2026, page A): a pill, chip, provider or search lights rows up. Nothing
  // here hides a job, so the officer never loses a job behind a filter they forgot was on.
  const [searchQuery, setSearchQuery] = useState("");
  const [pill, setPill] = useState<HighlightPill | null>(null);
  const [providerHighlight, setProviderHighlight] = useState<string | null>(null);
  const [escortHighlight, setEscortHighlight] = useState(false);
  const [involuntaryHighlight, setInvoluntaryHighlight] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("next");
  const [jobsTab, setJobsTab] = useState<JobsTab>("jobs");
  const [historyTab, setHistoryTab] = useState<HistoryTab>("delivered");

  const late = (movement: Movement) => pastWardEta(movement, now);
  // Audit round 2, S-14: "To accept" holds only jobs the officer can accept now. A job whose bed is
  // not yet at handover is waiting on the sending team, not on the officer.
  const readyToAccept = (movement: Movement) =>
    movement.transport !== undefined &&
    officerLeg(movement.transport) === "Requested" &&
    acceptedBlockedReason(movement) === undefined;
  const matchesPill = (movement: Movement, which: HighlightPill): boolean => {
    const leg = movement.transport ? officerLeg(movement.transport) : undefined;
    if (which === "requested") return readyToAccept(movement);
    if (which === "accepted") return leg === "Accepted";
    if (which === "en_route") return leg === "En route";
    if (which === "collected") return leg === "Collected";
    if (which === "late") return late(movement);
    return packNeedsForms(movement);
  };
  const query = searchQuery.toLowerCase().trim();
  const matchesSearch = (movement: Movement) => {
    if (!query) return false;
    const transport = movement.transport;
    const originEd = edById(movement.originEdId);
    // Shown surname first, but found by either order: "Jane Smith" and "Smith, Jane" both match.
    const subject = resolveSubjectPatient(movement, { patients, referrals, movements });
    // Search audit, 8 Nov 2026: every word in any order ("Smith Jane", "UM 100001", "Jane SCGH").
    return fieldsMatchEveryWord(query, [
      officerPatientName(movement),
      subject.patient ? subject.displayName : "",
      umrnFor(movement),
      originEd ? `${originEd.name} ${originEd.siteCode}` : "",
      unitFor(movement)?.name ?? "",
      transport?.provider ?? "",
      transport?.cadNumber ?? "",
    ]);
  };
  const isHighlighted = (movement: Movement) =>
    (pill !== null && matchesPill(movement, pill)) ||
    (providerHighlight !== null && movement.transport?.provider === providerHighlight) ||
    (escortHighlight && movement.transport?.escortRequired === true) ||
    (involuntaryHighlight && jobIsInvoluntary(movement)) ||
    matchesSearch(movement);
  const anyHighlight =
    pill !== null || providerHighlight !== null || escortHighlight || involuntaryHighlight || query !== "";
  const highlightedCount = anyHighlight ? jobs.filter(isHighlighted).length : 0;
  const clearHighlights = () => {
    setSearchQuery("");
    setPill(null);
    setProviderHighlight(null);
    setEscortHighlight(false);
    setInvoluntaryHighlight(false);
  };

  // Next action first: late or delayed, then forms still to upload, then the jobs furthest along.
  const priority = (movement: Movement) => {
    // Audit round 2, A4-13 (phone): a job to accept is pinned to the top, oldest first, so a new
    // booking is the Next action rather than the last row.
    if (isPhone && readyToAccept(movement)) return -1;
    // Polish (9 Nov 2026): a Delayed job (past ETA or not accepted in time) leads with the late ones.
    if (late(movement) || transportDelay(movement, now) !== null) return 0;
    if (packOutstanding(movement)) return 1;
    const leg = movement.transport ? officerLeg(movement.transport) : undefined;
    return 2 + (3 - (leg ? OFFICER_LEG_STEPS.indexOf(leg) : 0));
  };
  // Feature 25: the one filter that hides jobs; its chip, phone row and note come with it.
  const delayed = useOfficerDelayedFilter(jobs, now, isPhone);
  const sortedJobs = [...delayed.jobs].sort((a, b) => {
    if (sortKey === "wait") return stageSince(a) - stageSince(b);
    if (sortKey === "eta") {
      return (
        (expectedArrival(a)?.at ?? Number.POSITIVE_INFINITY) - (expectedArrival(b)?.at ?? Number.POSITIVE_INFINITY)
      );
    }
    return priority(a) - priority(b) || stageSince(a) - stageSince(b);
  });

  // The panel opens only when a patient is chosen (Josh, 9 Oct 2026); until then the table is full width.
  // M3 (Josh, 3 Nov 2026): Movements' "Check in" links here with ?job=<movement id> and that job
  // opens. The first choice made on this page clears the link, so Close and Back behave as usual.
  const [pickedId, setPickedId] = useState<string | undefined>(undefined);
  const linkedJob = new URLSearchParams(useLocationSearch()).get("job") ?? undefined;
  const selectedId = pickedId ?? linkedJob;
  const setSelectedId = (next: string | undefined) => {
    if (linkedJob !== undefined) replaceSearchParams({ job: null });
    setPickedId(next);
  };
  const selectedJob = selectedId === undefined ? undefined : jobs.find((job) => job.id === selectedId);
  // ROLE BRANCH (officer): the officer's own desk (as-officer-home, Josh 31 Oct 2026). A long list opens on
  // its first rows, then "Show all"; a highlight, search or chosen job past the cut shows every row.
  const access = useEffectiveWardAccess();
  const officerDesk = access.role === "officer";
  const booking = useNeedsTransport(movements, access, { admissions, referrals });
  const raise = booking.crewRaise;
  const needing = booking.needing;
  const [showAllJobs, setShowAllJobs] = useState(false);
  const activeProviders = TRANSPORT_PROVIDERS.filter((provider) =>
    jobs.some((movement) => movement.transport?.provider === provider),
  );
  // ROLE BRANCH (officer): with one provider the providers row repeats the jobs line and highlights
  // every job, so the officer's desk shows it only for two or more.
  const showProviders = !officerDesk || activeProviders.length >= 2;
  const listedJobs =
    !officerDesk ||
    showAllJobs ||
    anyHighlight ||
    (selectedJob !== undefined && sortedJobs.indexOf(selectedJob) >= OFFICER_JOB_ROWS)
      ? sortedJobs
      : sortedJobs.slice(0, OFFICER_JOB_ROWS);

  const [formModalJob, setFormModalJob] = useState<Movement | null>(null);
  const { toastMessage, setToastMessage, reportOutcome } = useTransportCommandFeedback();
  const [verifiedChecks, setVerifiedChecks] = useState<Record<string, boolean[]>>({});
  const diversion = useOfficerDiversionSave(selectedJob, raise, (movement) =>
    setToastMessage({ message: `Diversion recorded for ${officerPatientName(movement)}.` }),
  );
  const toggleCheck = (movementId: string, index: number) => {
    setVerifiedChecks((prev) => {
      const currentList = prev[movementId] ?? [false, false, false, false];
      const updated = [...currentList];
      updated[index] = !updated[index];
      return { ...prev, [movementId]: updated };
    });
  };
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const formModalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // The job panel's tab (Details for each new job) and the pulled bed whose booking is being logged.
  const [detailTab, setDetailTab] = useState<OfficerDetailTab>("details");
  const [bookingId, setBookingId] = useState<string | undefined>(undefined);
  const selectJob = (id: string) => {
    if (!confirmLeavingShell(() => selectJob(id))) return;
    diversion.cancelDiversion();
    setDetailTab("details");
    setBookingId(undefined);
    setSelectedId(selectedId === id ? undefined : id);
  };
  const openJob = (id: string) => {
    if ((id !== selectedId || bookingId !== undefined) && !confirmLeavingShell(() => openJob(id))) return;
    if (id !== selectedId) {
      diversion.cancelDiversion();
      setDetailTab("details");
    }
    setBookingId(undefined);
    setSelectedId(id);
  };
  const clearJob = () => {
    diversion.cancelDiversion();
    setSelectedId(undefined);
    setBookingId(undefined);
  };
  const closeJob = () => {
    if (confirmLeavingShell(closeJob)) clearJob();
  };
  const openBooking = (id: string) => {
    if (!confirmLeavingShell(() => openBooking(id))) return;
    diversion.cancelDiversion();
    setSelectedId(undefined);
    setBookingId((current) => (current === id ? undefined : id));
  };
  const bookingMovement = bookingId === undefined ? undefined : needing.find((movement) => movement.id === bookingId);

  // The phone booking sheet's ref; a chosen job opens in the kit drawer, which owns its own focus.
  const sideRef = useRef<HTMLDivElement>(null);
  // Phone: the panel is a modal bottom sheet (takes focus, traps Tab, isolates the page, hands focus
  // back); wider screens keep it non-modal. isPhone is declared above officerPatientName, which reads it.
  // The form check opens over the phone job sheet, so it joins the shared modal contract: the
  // sheet and page behind are inert, focus starts on the first control, Tab wraps inside, Escape
  // closes only this dialog (handled first, before this screen's own Escape shortcut), and focus
  // returns to the trigger once the stack has released it.
  useModalFocus({
    open: formModalJob !== null,
    onClose: () => setFormModalJob(null),
    panelRef: formModalRef,
    returnFocusRef: lastTriggerRef,
    focusOnOpen: "immediate",
    keyPhase: "capture",
  });

  // Newest first: `rejections` is appended in raise order
  const officerRefusals = [...rejections]
    .reverse()
    .filter((rejection) => OFFICER_ACTION_REJECTION_LABELS[rejection.attempted] !== undefined);

  const cancelledTransports = movements.flatMap((m) =>
    (m.unwinds ?? [])
      .filter((u) => u.kind === "transport_cancelled")
      .map((u) => ({
        movementId: m.id,
        // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
        patientName: officerListPatientName(m),
        cadNumber: u.cadNumber ?? "CAD (dispatch) number not recorded",
        at: u.at,
        // A recorded reason is a code (e.g. `provider_unavailable`); show its plain label, never the code.
        note:
          (u.reason ? (changeReasonLabels[u.reason as keyof typeof changeReasonLabels] ?? u.reason) : undefined) ??
          "Cancelled transport / stand-down",
      })),
  );

  const deliveredToday = deliveredSinceStartOfDay(movements, now);

  // Hero counts. Each label names exactly the population its count holds.
  const legCount = (leg: OfficerLeg) => jobs.filter((job) => job.transport && officerLeg(job.transport) === leg).length;
  const inCustody = jobs.filter(
    (job) => job.transport?.collectedAt !== undefined && job.transport?.arrivedAt === undefined,
  ).length;
  const awaitingDeparture = jobs.filter(readyToAccept).length;
  const crewToSend = legCount("Accepted");
  const crewEnRoute = legCount("En route");
  const pastEta = jobs.filter(late).length;
  const formsOutstanding = jobs.filter(packNeedsForms).length;

  // Escape and "/" shortcut handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (e.defaultPrevented || hasOpenSheet()) return;
        if (formModalJob) {
          setFormModalJob(null);
          lastTriggerRef.current?.focus();
        } else if (selectedId !== undefined && !document.querySelector('[role="dialog"][aria-modal="true"]')) {
          replaceSearchParams({ job: null });
          setPickedId(undefined);
        }
      } else if (
        e.key === "/" &&
        areCharacterShortcutsEnabled() &&
        !formModalJob &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        document.activeElement?.tagName !== "SELECT"
      ) {
        e.preventDefault();
        setJobsTab("jobs");
        // The field sits in the Jobs panel, which only renders once the tab switch commits.
        requestAnimationFrame(() => searchInputRef.current?.focus());
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [formModalJob, selectedId]);

  const showToast = (msg: string) => {
    setToastMessage({ message: msg });
  };

  const undoTransportStep = (movementId: string) =>
    reportOutcome(
      movementId,
      () => raise("UNDO_TRANSPORT_STEP", { movementId }),
      "Undone. Back as it was.",
      "Undo",
      false,
    );
  const toastText = toastMessage?.isCurrent?.() === false ? undefined : toastMessage?.message;
  const toastUndoFor = toastText && toastMessage?.canUndo?.() !== false ? toastMessage?.undoMovementId : undefined;

  const runAccepted = (movement: Movement) =>
    reportOutcome(
      movement.id,
      () => raise("TRANSPORT_ACCEPTED", { movementId: movement.id }),
      `Transport accepted for ${officerPatientName(movement)}.`,
      "Transport acceptance",
    );
  const runEnRoute = (movement: Movement) =>
    reportOutcome(
      movement.id,
      () => raise("TRANSPORT_EN_ROUTE", { movementId: movement.id }),
      `Transport en route for ${officerPatientName(movement)}.`,
      "En route",
    );
  // Collected with no Form 4A or no fit to travel records a coded reason after confirmation.
  const runCollected = (movement: Movement) => {
    if (collectionGaps(movement).length > 0) {
      setCollectCheckId(movement.id);
      return;
    }
    void recordCollected(movement);
  };
  const recordCollected = (movement: Movement, exception?: TransportExceptionInput) =>
    reportOutcome(
      movement.id,
      () =>
        raise("PATIENT_COLLECTED", {
          movementId: movement.id,
          ...(exception ? { exception } : {}),
          ...(identityCheckedIds.has(identityCheckKey(movement)) ? { identityChecked: true as const } : {}),
        }),
      `Patient collected for ${officerPatientName(movement)}. In transit.`,
      "Collection",
    );
  // WF-22 (live test, 4 Nov 2026): arrival is confirmed first; the message after it offers Undo.
  const runDelivered = async (movement: Movement) => {
    const confirmed = await requestConfirm({
      title: "Record arrival at the ward?",
      message: `Record that ${officerPatientName(movement)} has arrived at the ward. You can undo it for a few seconds after.`,
      confirmLabel: "Record arrival",
      cancelLabel: "Not yet",
    });
    if (!confirmed) return;
    return reportOutcome(
      movement.id,
      () => raise("PATIENT_ARRIVED", { movementId: movement.id }),
      `Arrival at ward recorded for ${officerPatientName(movement)}. The receiving ward confirms the arrival.`,
      "Arrived at ward",
    );
  };

  /** The one action a job is waiting on, why it cannot be taken yet, and how to take it. */
  const nextStep = (movement: Movement) => withCrewLimit(officerStep(movement), booking.crewLimit);
  const officerStep = (movement: Movement) => {
    const transport = movement.transport;
    const leg = transport ? officerLeg(transport) : undefined;
    if (!leg) return undefined;
    const who = resolvedPatientName(movement);
    if (leg === "Requested") {
      return { leg, verb: "Accept", blocked: acceptedBlockedReason(movement, who), run: runAccepted };
    }
    if (leg === "Accepted") {
      return { leg, verb: "En route", blocked: enRouteBlockedReason(movement, who), run: runEnRoute };
    }
    if (leg === "En route") {
      return { leg, verb: "Collected", blocked: collectedBlockedReason(movement, who), run: runCollected };
    }
    return {
      leg,
      verb: "Arrived at ward",
      blocked: arrivedBlockedReason(movement, unitFor(movement), who),
      run: runDelivered,
    };
  };

  /**
   * Audit round 2, S-14: why the next step cannot be taken yet, printed (not a hover title) on
   * phone. A job still short of handover is waiting on the sending team, so it says so plainly.
   */
  const blockedNote = (movement: Movement): string | undefined => {
    const step = nextStep(movement);
    if (!step?.blocked) return undefined;
    if (
      step.leg === "Requested" &&
      !movement.closure &&
      movement.stage !== "handover_ready" &&
      !revokedHoldingBedReason(movement, "accepted for transport")
    ) {
      const sender = edShortName(edById(movement.originEdId)) || "the sending team";
      return `Waiting for ${sender} to mark handover ready.`;
    }
    return step.blocked;
  };

  const nextButton = (
    movement: Movement,
    testId: string,
    variant: "pri" | "sec",
    size: "sm" | "md" | "lg",
    describedBy?: string,
    openAfter = false,
  ) => {
    const step = nextStep(movement);
    if (!step) return null;
    return (
      <Button
        variant={step.blocked ? "sec" : variant}
        size={size}
        data-testid={`${testId}-${movement.id}`}
        aria-disabled={step.blocked ? "true" : undefined}
        aria-describedby={step.blocked ? describedBy : undefined}
        title={step.blocked ?? undefined}
        aria-label={`${step.verb}, ${officerListPatientName(movement)}`}
        onClick={(event) => {
          event.stopPropagation();
          if (step.blocked) return;
          step.run(movement);
          // Audit round 2, S-15 (phone): after advancing from the Next action card, the job's sheet
          // opens with its next milestone as the pinned primary, so the officer stays on this job.
          if (openAfter) openJob(movement.id);
        }}
      >
        {step.verb}
      </Button>
    );
  };

  const copyHandover = () => {
    const lines = sortedJobs.map((movement) => {
      const transport = movement.transport!;
      const expected = expectedArrival(movement);
      const eta = expected
        ? `${expected.booked ? "est." : "ward ETA"} ${formatSheetMoment(expected.at, dayZero)}${late(movement) ? ", late" : ""}`
        : "no ETA";
      return `${officerPatientName(movement)}: ${originShortFor(movement)} to ${destinationLabelFor(movement)}, ${transportLeg(transport)}, ${transport.provider}${transport.escortRequired ? ", escort" : ""}, ${eta}, ${packRequired(movement) ? `forms ${packCount(movement)} of ${PACK_SLOTS.length}` : "no forms needed"}`;
    });
    // Audit 1 (CS-12, Josh 20 Oct): the synthetic line first in every copy.
    const text = [
      SYNTHETIC_COPY_LINE,
      `Transport handover ${formatSheetMoment(now, dayZero)}. ${jobs.length} open, ${inCustody} on board, ${crewEnRoute} en route, ${pastEta} past ward ETA.`,
      ...lines,
    ].join("\n");
    copyTextToClipboard(text).then(
      () => showToast(`Handover copied, ${plural(jobs.length, "open job", "open jobs")}.`),
      () => showToast("Copying is not available in this browser."),
    );
  };

  const openFormModal = (movement: Movement, e: React.MouseEvent<HTMLElement>) => {
    lastTriggerRef.current = e.currentTarget;
    setFormModalJob(movement);
  };

  const closeFormModal = () => {
    setFormModalJob(null);
  };

  // Every open job with a recorded ward ETA or booking estimate. The axis runs from the earlier of
  // now and the first to the later of now and the last, so no window length is invented.
  const arrivals = jobs
    .map((movement) => {
      const expected = expectedArrival(movement);
      return expected ? { movement, eta: expected.at, booked: expected.booked } : undefined;
    })
    .filter((item): item is { movement: Movement; eta: Instant; booked: boolean } => item !== undefined)
    .sort((a, b) => a.eta - b.eta);
  // Axis clamped to now +/-48h, at most a dozen labels: a job eight days late drew ~200 and likely crashed the tab.
  const { left: arrivalsLeft, ticks: hourTicks } = arrivalsAxis(
    now,
    arrivals.map((item) => item.eta),
  );
  const upcoming = arrivals.filter((item) => item.eta >= now).length;
  const firstUpcoming = arrivals.findIndex((item) => item.eta >= now);

  const topJob = sortedJobs[0];

  /** Inspect form and Divert: the panel foot on desktop, the end of the sheet body on phone. */
  function detailExtraActions(job: Movement) {
    if (!job.transport) return null;
    return (
      <>
        <Button
          variant="sec"
          size="sm"
          icon={ListChecks}
          data-testid={`ward-officer-inspect-form-${job.id}`}
          onClick={(e) => openFormModal(job, e)}
        >
          Inspect form
        </Button>
        {!booking.crewLimit &&
        !job.closure &&
        job.transport.collectedAt !== undefined &&
        job.transport.arrivedAt === undefined &&
        job.transport.diversion === undefined ? (
          <Button
            variant="sec"
            size="sm"
            icon={MapPin}
            aria-expanded={diversion.diversionOpen}
            data-testid={`ward-officer-divert-${job.id}`}
            disabledReason={diversion.diversionPending ? "Saving" : undefined}
            onClick={() => {
              // The diversion form lives on the Details tab, so Divert from Forms or Activity shows it.
              setDetailTab("details");
              diversion.toggleDiversion();
            }}
          >
            Divert
          </Button>
        ) : null}
      </>
    );
  }

  // The job panel's render helpers (`officer-job-detail.tsx`) read this screen's state through this context.
  const detailContext: OfficerJobDetailContext = {
    blockedNote,
    destinationLabelFor,
    detailTab,
    setDetailTab,
    originShortFor,
    ...diversion,
    identityChecked: (movement: Movement) => identityCheckedIds.has(identityCheckKey(movement)),
    identityFor,
    isPhone,
    now,
    officerPatientName,
    originLabelFor,
    raise,
    resolvedPatientName,
    runAccepted,
    runCollected,
    runDelivered,
    runEnRoute,
    showToast,
    toggleIdentityChecked,
    unitFor,
  };

  const needCard = (
    <NeedsTransportCard
      needing={needing}
      now={now}
      isPhone={isPhone}
      bookingId={bookingId}
      nameFor={officerListPatientName}
      umrnFor={umrnFor}
      originShortFor={originShortFor}
      destinationLabelFor={destinationLabelFor}
      onLog={openBooking}
    />
  );
  // Page tops (Josh, 9 Nov 2026): one slate top as on Home. Three figures, the most urgent pulled bed
  // as the act row, the desk's own actions as chips (the desk's Quick bar steps aside), and the job
  // stages as one slim band that highlights rows.
  const togglePill = (which: HighlightPill) => setPill((current) => (current === which ? null : which));
  const firstNeed = needing[0];
  const firstHeld = firstNeed ? heldClock(firstNeed, now) : undefined;
  const providerChips: HeroChipItem[] =
    isPhone || !showProviders
      ? []
      : activeProviders.map((provider) => ({
          id: provider,
          label: provider.replace(/ service$/, ""),
          icon: <Ambulance {...CHIP_ICON} />,
          count: jobs.filter((movement) => movement.transport?.provider === provider).length,
          countTone: "quiet" as const,
          countLabel: "jobs",
          pressed: providerHighlight === provider,
          onClick: () => setProviderHighlight((prev) => (prev === provider ? null : provider)),
        }));
  const escortCount = jobs.filter((job) => job.transport?.escortRequired).length;
  const involuntaryCount = jobs.filter(jobIsInvoluntary).length;
  const highlightChips = (
    <>
      {delayed.chip}
      <FilterChip pressed={escortHighlight} onPressedChange={setEscortHighlight} count={escortCount}>
        Escort
      </FilterChip>
      <FilterChip pressed={involuntaryHighlight} onPressedChange={setInvoluntaryHighlight} count={involuntaryCount}>
        Involuntary
      </FilterChip>
    </>
  );
  const heroTop = (
    <HeroTop
      testId="ward-officer-top"
      figures={
        <HeroFigures
          items={[
            {
              id: "need",
              value: needing.length,
              label: "need transport",
              onClick: needing.length > 0 ? scrollToNeedsTransport : undefined,
              testId: "ward-officer-figure-need",
            },
            {
              id: "forms",
              value: formsOutstanding,
              label: "need forms",
              onClick: formsOutstanding > 0 ? () => togglePill("forms") : undefined,
              testId: "ward-officer-figure-forms",
            },
            {
              id: "late",
              value: pastEta,
              label: "past ward ETA",
              tone: pastEta > 0 ? "warning" : undefined,
              onClick: pastEta > 0 ? () => togglePill("late") : undefined,
              testId: "ward-officer-figure-late",
            },
          ]}
        />
      }
      act={
        firstNeed && firstHeld ? (
          <HeroAct
            tone="warning"
            testId="ward-officer-act"
            // The list is most urgent tier first, so its first row is not always the longest wait.
            title={`Most urgent · ${firstHeld.figure} ${firstHeld.label}`}
            action={{
              label: "Log booking",
              phoneLabel: "Log",
              onClick: () => openBooking(firstNeed.id),
              testId: "ward-officer-hero-log-booking",
            }}
          />
        ) : (
          <HeroAct tone="calm" testId="ward-officer-act" title="Every pulled bed has transport logged" />
        )
      }
      chips={
        <HeroQuickChips
          label="Transport actions"
          items={[
            {
              id: "copy",
              label: "Copy handover",
              icon: <ClipboardList {...CHIP_ICON} />,
              onClick: copyHandover,
              testId: "ward-officer-copy-handover",
            },
            ...providerChips,
            ...(isPhone
              ? [
                  {
                    id: "escort",
                    label: "Escort",
                    icon: <User {...CHIP_ICON} />,
                    count: escortCount,
                    countTone: "quiet" as const,
                    pressed: escortHighlight,
                    onClick: () => setEscortHighlight((on) => !on),
                  },
                  {
                    id: "involuntary",
                    label: "Involuntary",
                    icon: <Shield {...CHIP_ICON} />,
                    count: involuntaryCount,
                    countTone: "quiet" as const,
                    pressed: involuntaryHighlight,
                    onClick: () => setInvoluntaryHighlight((on) => !on),
                  },
                ]
              : []),
          ]}
        />
      }
      band={
        <HeroBand
          title="Job stages"
          variant="inline"
          testId="ward-officer-stages"
          cells={(
            [
              ["requested", "To accept", awaitingDeparture],
              ["accepted", "Crew to send", crewToSend],
              ["en_route", "En route", crewEnRoute],
              ["collected", "Collected", inCustody],
            ] as const
          ).map(([which, label, value]) => ({
            id: which,
            label,
            value,
            pressed: pill === which,
            onClick: () => togglePill(which),
            ariaLabel: `${label} ${value}, highlight these jobs`,
          }))}
        />
      }
    />
  );

  // Drawer review (6 Nov 2026): a chosen job opens in the kit drawer over the page, so the list keeps
  // its full width. Only the phone booking sheet still sits in the layout.
  const panelOpen = isPhone && bookingMovement !== undefined;
  const anyJobEta = jobs.some((movement) => expectedArrival(movement) !== undefined);
  // Site review 12 Oct 2026: a column that says the same thing on every row ("0 of 3" thirteen
  // times) says nothing; the hero's "Jobs need forms" and the job sheet still carry the count.
  const formsVary =
    jobs.length < 2 || new Set(jobs.map((movement) => (packRequired(movement) ? packCount(movement) : -1))).size > 1;
  useWardModalFocus(isPhone && panelOpen, sideRef, closeJob);

  return (
    <div className={styles.screen} data-testid="ward-officer-screen" data-ward-design="v8">
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          className={cx(styles.dispatchHero, titles.hero, folderTabClasses.hero)}
          // P195 (audit 27 Oct 2026, Josh 27 Oct): the h1 is the screen name; page tops (9 Nov 2026)
          // name the desk and say it is the live picture.
          title={
            <>
              Transport desk <span className={titles.soft}>right now</span>
            </>
          }
          aside={
            <LiveChip
              state={live.paused ? "paused" : "live"}
              onHero
              age={formatInstant(now)}
              onTogglePause={live.togglePause}
            />
          }
        >
          {heroTop}
        </Hero>
        {/* Page tops (9 Nov 2026): Jobs and History are the folder tabs under the top; on a desktop
            the Escort and Involuntary highlights sit beside them. */}
        <FolderTabs label="Transport views" value={jobsTab} testId="ward-officer-tabs">
          <Tabs
            className={folderTabClasses.switch}
            label="Job lists"
            idPrefix="ward-officer-jobs"
            value={jobsTab}
            onChange={setJobsTab}
            items={[
              { id: "jobs", label: "Jobs", count: jobs.length },
              {
                id: "history",
                label: "History",
                count: deliveredToday.length + officerRefusals.length + cancelledTransports.length,
              },
            ]}
          />
          {isPhone ? null : (
            <>
              <span className={folderTabClasses.rule} aria-hidden="true" />
              <div className={cx(folderTabClasses.filters, styles.tabFilters)} role="group" aria-label="Highlight jobs">
                {highlightChips}
              </div>
            </>
          )}
        </FolderTabs>

        {cancellations.length > 0 ? (
          // Redesign (31 Oct 2026): the page's own card and heading, at every width. The phone-only
          // Next action card style used to hide these notices on wider screens.
          <Card aria-labelledby="officer-cancellation-heading" data-testid="officer-cancellation-notices">
            <CardHead
              id="officer-cancellation-heading"
              title="Cancelled transport"
              meta={`${cancellations.length} ${cancellations.length === 1 ? "notice" : "notices"}`}
            />
            <CardBody>
              <ul className={styles.notices}>
                {cancellations.map((notice) => (
                  <li key={notice.id}>{notice.sentence}</li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : null}
        <ReturnEarlyAlerts desk={{ role: "officer" }} now={now} />

        {isPhone ? needCard : null}

        {/* Transport mock-up: phone only. On a larger screen the first row of the job list is the
            next action, and this card drew without its phone styles. */}
        {isPhone && topJob && topJob.transport ? (
          <Card className={styles.nextCard} aria-label="Next action">
            <div className={styles.nextCardHead}>
              <span className={styles.eyebrow}>Next action</span>
              <span className={styles.nextCardStage}>
                <StatusGlyph tone={LEG_TONE[officerLeg(topJob.transport) ?? "Requested"]} size={9} />
                {transportLeg(topJob.transport)}
              </span>
            </div>
            <strong className={styles.nextCardName}>{officerListPatientName(topJob)}</strong>
            <span className={styles.nextCardLine}>
              {/* B6-36: no leading separator when this desk is not shown the UMRN. */}
              {umrnFor(topJob) ? (
                <>
                  <span className={styles.mono}>{umrnFor(topJob)}</span> ·{" "}
                </>
              ) : null}
              {originShortFor(topJob)}
              <span aria-hidden="true"> → </span>
              <SrOnly> to </SrOnly>
              {destinationLabelFor(topJob)}
            </span>
            {late(topJob) && topJob.arrivalDetails ? (
              <span className={cx(styles.nextCardLine, styles.warnText)}>
                <StatusGlyph tone="warning" size={9} /> Past ward ETA{" "}
                {formatInstantWithDay(topJob.arrivalDetails.estimatedArrivalAt, now)}
              </span>
            ) : packOutstanding(topJob) ? (
              <span className={cx(styles.nextCardLine, styles.warnText)}>
                <StatusGlyph tone="warning" size={9} /> {PACK_SLOTS.length - packCount(topJob)} of {PACK_SLOTS.length}{" "}
                forms still to upload
              </span>
            ) : null}
            <div className={styles.nextCardActions}>
              <Button variant="sec" size="lg" onClick={() => openJob(topJob.id)}>
                Open
              </Button>
              {nextButton(
                topJob,
                "ward-officer-nextcard",
                "pri",
                "lg",
                isPhone ? `ward-officer-nextcard-unavailable-${topJob.id}` : undefined,
                isPhone,
              )}
            </div>
            {isPhone && blockedNote(topJob) ? (
              <p id={`ward-officer-nextcard-unavailable-${topJob.id}`} className={styles.nextNote}>
                <Icon icon={Lock} size={14} />
                {blockedNote(topJob)}
              </p>
            ) : null}
          </Card>
        ) : null}

        <div className={styles.layout} data-open={panelOpen ? "true" : undefined}>
          <div className={styles.leftColumn}>
            {isPhone ? null : needCard}
            <Card className={styles.jobsPanel} aria-label="Jobs">
              {/* ROLE BRANCH (officer): no "Choose a patient" hint over a list that says it already. */}
              {panelOpen || officerDesk ? null : (
                <div className={styles.tabsRow}>
                  <span className={styles.headNote}>Choose a patient to open their job</span>
                </div>
              )}

              <TabPanel idPrefix="ward-officer-jobs" id="jobs" hidden={jobsTab !== "jobs"}>
                <div className={styles.toolbar} role="search" aria-label="Find transport jobs">
                  <TextInput
                    ref={searchInputRef}
                    type="search"
                    enterKeyHint="search"
                    icon={Search}
                    boxClassName={styles.searchBox}
                    id="officer-transfer-search"
                    name="transferSearch"
                    placeholder="Patient, UMRN, ED, ward or CAD"
                    aria-label="Highlight transport jobs"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onClear={() => setSearchQuery("")}
                    trailing={searchQuery ? undefined : <Kbd>/</Kbd>}
                  />
                  {anyHighlight ? (
                    <span className={styles.highlightNote}>
                      <span aria-hidden="true">{highlightedCount} highlighted</span>
                      <span className="sr-only" role="status">
                        {highlightedCount} synthetic rows highlighted
                      </span>
                      <Button variant="ghost" size="sm" onClick={clearHighlights}>
                        Clear
                      </Button>
                    </span>
                  ) : null}
                  <span className={styles.toolbarSpacer} />
                  <span className={styles.sortGroup}>
                    <span className={styles.sortLabel}>Sort</span>
                    <Segmented
                      className={styles.sortControl}
                      label="Sort jobs"
                      value={sortKey}
                      onChange={setSortKey}
                      items={[
                        { id: "next", label: "Next action" },
                        { id: "wait", label: "Longest wait" },
                        ...(anyJobEta ? [{ id: "eta" as const, label: "ETA" }] : []),
                      ]}
                    />
                  </span>
                </div>

                {delayed.phoneRow}
                {/* Audit 24-1 decision 5: the next-action order is said on screen (not on the officer's phone). */}
                <OfficerOrderNote shown={jobs.length > 0 && sortKey === "next" && !(officerDesk && isPhone)} />
                {delayed.note}
                {jobs.length === 0 ? (
                  <p className={styles.placeholder} data-testid="ward-officer-empty">
                    No outstanding jobs: each has arrived or its movement has closed.
                  </p>
                ) : delayed.jobs.length === 0 ? null : (
                  <div className={styles.tableScroll}>
                    <table
                      className={`${tableClasses.table} ${styles.jobsTable}`}
                      aria-label="Outstanding transport jobs"
                    >
                      <thead>
                        <tr>
                          <th scope="col">Patient</th>
                          <th scope="col">Route</th>
                          <th scope="col">Stage</th>
                          <th scope="col" className={formsVary && !panelOpen ? undefined : styles.etaOff}>
                            Forms
                          </th>
                          {/* Device audit, 11 Oct 2026: the ETA column shows only when a job has one;
                              thirteen rows of "No ETA" said nothing. */}
                          <th scope="col" className={anyJobEta ? undefined : styles.etaOff}>
                            ETA
                          </th>
                          <th scope="col" className={cx(tableClasses.num, styles.nextCol)}>
                            Next
                          </th>
                        </tr>
                      </thead>
                      <tbody data-testid="ward-officer-joblist">
                        {listedJobs.map((movement) => {
                          const transport = movement.transport;
                          if (!transport) return null;
                          const active = movement.id === selectedJob?.id;
                          const lit = anyHighlight && isHighlighted(movement);
                          const leg = officerLeg(transport);
                          const step = nextStep(movement);
                          const stepStatusText = leg
                            ? step?.blocked
                              ? `blocked before ${nextActionVerb(leg).toLowerCase()}`
                              : `next ${nextActionVerb(leg).toLowerCase()}`
                            : undefined;
                          const since = stageStartedAt(movement);
                          const expected = expectedArrival(movement);
                          const isLate = late(movement);
                          const forms = packCount(movement);
                          return (
                            <tr
                              key={movement.id}
                              data-testid={`ward-officer-job-${movement.id}`}
                              data-highlight={lit ? "true" : undefined}
                              className={active ? `${tableClasses.selected} ${styles.jobRow}` : styles.jobRow}
                              aria-selected={active}
                            >
                              <td>
                                <button
                                  type="button"
                                  className={styles.selectButton}
                                  data-testid={`ward-officer-select-${movement.id}`}
                                  aria-current={active ? "true" : undefined}
                                  aria-expanded={active}
                                  onClick={() => selectJob(movement.id)}
                                >
                                  {/* Josh, 25 Sept 2026: the transport officer sees the patient's name. Same
                                      resolver as the Referral board; "Not recorded" when no single patient is
                                      linked, never a guess. */}
                                  <strong
                                    className={styles.jobName}
                                    data-testid={`ward-officer-patient-${movement.id}`}
                                  >
                                    {officerListPatientName(movement)}
                                  </strong>
                                  {isPhone && transport.escortRequired ? (
                                    <ShieldCheck size={14} className={styles.phEscort} aria-label="Escort required" />
                                  ) : null}
                                  <span className={styles.jobUmrn}>{umrnFor(movement)}</span>
                                </button>
                              </td>
                              <td className={styles.routeCell}>
                                {isPhone ? (
                                  // Phone (v10): from first, as the mockup's "ARM to ward" line reads,
                                  // with the larger screen's arrow and "to" spoken.
                                  <span className={styles.jobRoute}>
                                    <b>{originShortFor(movement)}</b>
                                    <span aria-hidden="true"> → </span>
                                    <SrOnly> to </SrOnly>
                                    {destinationLabelFor(movement)}
                                  </span>
                                ) : (
                                  // Redesign: from first, then the ward, as the job is driven. The route
                                  // wraps rather than ending in "…" when the job panel narrows the table.
                                  <span className={cx(styles.jobRoute, styles.routeWraps)}>
                                    <span className={styles.jobRouteFrom}>{originShortFor(movement)}</span>
                                    <span aria-hidden="true"> → </span>
                                    <SrOnly> to </SrOnly>
                                    <span className={styles.jobRouteTo}>{destinationLabelFor(movement)}</span>
                                  </span>
                                )}
                                <span className={styles.jobMeta}>
                                  {transport.provider.replace(/ service$/, "")}
                                  {transport.escortRequired ? " · escort" : ""}
                                  {transport.transportLegalStatus === "voluntary" ? " · voluntary" : ""}
                                </span>
                                {transport.escortRequired ? <span className={styles.jobEscort}>Escort</span> : null}
                              </td>
                              <td>
                                {leg && stepStatusText ? (
                                  <OfficerStageCell
                                    movementId={movement.id}
                                    leg={leg}
                                    stepStatusText={stepStatusText}
                                    stageTime={since !== undefined ? durMinutes(Math.max(0, now - since)) : undefined}
                                    bookedAt={transport.bookedAt}
                                    now={now}
                                    delay={transportDelay(movement, now)}
                                  >
                                    {/* With the job panel open, the Forms column folds in here. */}
                                    {panelOpen && !isPhone && packRequired(movement) ? formsMissingNote(forms) : null}
                                  </OfficerStageCell>
                                ) : (
                                  transportLeg(transport)
                                )}
                              </td>
                              <td className={formsVary && !panelOpen ? undefined : styles.etaOff}>
                                <OfficerFormsCell movement={movement} />
                              </td>
                              <td className={anyJobEta ? undefined : styles.etaOff}>
                                {expected ? (
                                  <span className={styles.etaCell}>
                                    {isLate ? <StatusGlyph tone="warning" size={9} /> : null}
                                    <b>{formatInstantWithDay(expected.at, now)}</b>
                                    <span className={isLate ? styles.warnText : styles.etaNote}>
                                      {isLate
                                        ? `${durMinutes(Math.max(0, now - expected.at))} late`
                                        : expected.booked
                                          ? "est."
                                          : transportEtaRemainingLabel(expected.at, now)}
                                    </span>
                                  </span>
                                ) : (
                                  <span className={styles.etaNote}>No ETA</span>
                                )}
                              </td>
                              <td className={tableClasses.num}>
                                {nextButton(movement, "ward-officer-next", "sec", "sm")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {listedJobs.length < sortedJobs.length ? (
                      <ShowMoreRow onClick={() => setShowAllJobs(true)}>Show all {sortedJobs.length} jobs</ShowMoreRow>
                    ) : null}
                  </div>
                )}
              </TabPanel>

              <TabPanel idPrefix="ward-officer-jobs" id="history" hidden={jobsTab !== "history"}>
                <div className={styles.historyHead}>
                  <span className={styles.muted}>Today, closed records</span>
                  <Tabs
                    label="History lists"
                    idPrefix="ward-officer-history"
                    value={historyTab}
                    onChange={setHistoryTab}
                    items={[
                      { id: "delivered", label: "Arrived today", count: deliveredToday.length },
                      { id: "refused", label: "Refused", count: officerRefusals.length },
                      { id: "cancelled", label: "Cancelled", count: cancelledTransports.length },
                    ]}
                  />
                </div>
                <TabPanel idPrefix="ward-officer-history" id="delivered" hidden={historyTab !== "delivered"}>
                  {deliveredToday.length > 0 ? (
                    <ul className={styles.plainList} data-testid="ward-officer-delivered">
                      {deliveredToday.map((movement) => (
                        <OfficerDeliveredRow
                          key={movement.id}
                          movementId={movement.id}
                          time={formatInstantWithDay(movement.transport!.arrivedAt!, now)}
                          name={officerListPatientName(movement)}
                          umrn={umrnFor(movement)}
                          destination={destinationLabelFor(movement)}
                          provider={movement.transport!.provider}
                        />
                      ))}
                    </ul>
                  ) : (
                    <div className={styles.filterEmpty}>
                      <EmptyState icon={Circle} title="Nothing delivered yet today." />
                    </div>
                  )}
                </TabPanel>
                <TabPanel idPrefix="ward-officer-history" id="refused" hidden={historyTab !== "refused"}>
                  {officerRefusals.length > 0 ? (
                    <section className={styles.refusals} aria-label="Refused" data-testid="ward-officer-refusals">
                      <div className={styles.panelBody} role="region" aria-label="Refused list" tabIndex={0}>
                        <ul className={styles.plainList}>
                          {officerRefusals.map((rejection) => (
                            <li key={rejection.id} className={styles.plainItem}>
                              <Icon icon={X} size={14} />
                              <span>
                                {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                                <strong>{patientNameForMovementId(rejection.movementId)}</strong> &mdash;{" "}
                                {OFFICER_ACTION_REJECTION_LABELS[rejection.attempted]} was refused: {rejection.reason}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className={styles.panelNote}>This session only.</p>
                    </section>
                  ) : (
                    <div className={styles.filterEmpty}>
                      <EmptyState icon={Circle} title="No action has been refused this session." />
                    </div>
                  )}
                </TabPanel>
                <TabPanel idPrefix="ward-officer-history" id="cancelled" hidden={historyTab !== "cancelled"}>
                  {cancelledTransports.length > 0 ? (
                    <section
                      className={styles.cancelledSection}
                      aria-label="Cancelled"
                      data-testid="ward-officer-cancelled-transports"
                    >
                      <div className={styles.panelBody} role="region" aria-label="Cancelled list" tabIndex={0}>
                        <ul className={styles.plainList}>
                          {cancelledTransports.map((item, idx) => (
                            <li key={`${item.movementId}-${idx}`} className={styles.plainItem}>
                              <StatusGlyph tone="closed" size={9} />
                              <span>
                                {/* Owner, 26 Sept 2026: the patient's name, not the WF journey number. */}
                                <strong>{item.patientName}</strong> &mdash; stand-down, CAD (dispatch) number:{" "}
                                <code>{item.cadNumber}</code> <span className={styles.muted}>({item.note})</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className={styles.panelNote}>This session only.</p>
                    </section>
                  ) : (
                    <div className={styles.filterEmpty}>
                      <EmptyState icon={Circle} title="No transport has been cancelled this session." />
                    </div>
                  )}
                </TabPanel>
              </TabPanel>
            </Card>

            {/* An empty Arrivals card ("0 still to come") is hidden (device audit, 11 Oct 2026). */}
            {renderArrivalsCard({
              arrivals,
              arrivalsLeft,
              destinationLabelFor,
              firstUpcoming,
              hourTicks,
              now,
              officerPatientName,
              openJob,
              umrnFor,
              upcoming,
            })}
          </div>

          {bookingMovement ? (
            <OfficerBookingPanel
              key={bookingMovement.id}
              sideRef={sideRef}
              movement={bookingMovement}
              name={officerListPatientName(bookingMovement)}
              umrn={umrnFor(bookingMovement)}
              route={`${originShortFor(bookingMovement)} → ${destinationLabelFor(bookingMovement)}`}
              now={now}
              isPhone={isPhone}
              raise={booking.raise}
              acting={booking.acting.get(bookingMovement.id) ?? {}}
              onClose={closeJob}
              onSaved={(name) => (clearJob(), showToast(`Transport booking logged for ${name}.`))}
            />
          ) : null}
          {!bookingMovement && selectedJob && selectedJob.transport ? (
            <OfficerJobPanel
              job={{ ...selectedJob, transport: selectedJob.transport }}
              name={officerPatientName(selectedJob)}
              umrn={umrnFor(selectedJob)}
              context={detailContext}
              tools={<>{detailExtraActions(selectedJob)}</>}
              onClose={closeJob}
            />
          ) : null}
        </div>

        <WardPrototypeFooter
          testId="ward-officer-governance"
          note="All outstanding jobs; closed movements excluded · Providers identify organisations · Not approved for clinical use"
        />
      </main>

      {/* Form verification dialog */}
      {formModalJob ? (
        <OfficerFormCheckDialog
          job={formModalJob}
          umrn={umrnFor(formModalJob)}
          patientName={officerPatientName(formModalJob)}
          verifiedChecks={verifiedChecks}
          dialogRef={formModalRef}
          onToggleCheck={toggleCheck}
          onClose={closeFormModal}
        />
      ) : null}

      {collectCheck ? (
        <TransportExceptionDialog
          open
          who={officerPatientName(collectCheck)}
          action="Collected"
          gaps={collectionGaps(collectCheck)}
          onClose={() => setCollectCheckId(null)}
          onConfirm={async (reason) => {
            const accepted = await recordCollected(collectCheck, { gaps: collectionGaps(collectCheck), reason });
            if (accepted) setCollectCheckId(null);
            return accepted;
          }}
          testId="ward-officer-collect-check"
        />
      ) : null}
      {toastText ? (
        <div className={styles.toast}>
          <StatusLine tone={toastMessage?.warning ? "warning" : "success"} title={toastText} />
          {toastUndoFor ? (
            <button
              type="button"
              className={styles.toastUndo}
              data-testid="ward-officer-toast-undo"
              onClick={() => undoTransportStep(toastUndoFor)}
            >
              Undo
            </button>
          ) : null}
          {toastMessage?.warning ? (
            <button
              type="button"
              className={styles.toastUndo}
              data-testid="ward-officer-toast-close"
              onClick={() => setToastMessage(null)}
            >
              Close
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
