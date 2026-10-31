"use client";

import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { areCharacterShortcutsEnabled } from "@/components/ward-management/shell/ward-character-shortcuts";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { isOfficerJob, officerCancellationNotices } from "./officer-jobs";
import { useTransportCommandFeedback } from "./use-transport-command-feedback";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock, Copy, ListChecks, Lock, MapPin, Search, ShieldCheck, X } from "lucide-react";

import {
  Button,
  Card,
  CardBody,
  CardFoot,
  CardHead,
  EmptyState,
  FilterChip,
  Hero,
  HeroChip,
  HeroChips,
  LiveChip,
  HeroStat,
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
  phoneRows,
  tableClasses,
  useIsPhone,
  useModalFocus,
  type WfTone,
} from "@/components/wf";
import { transportLeg } from "@/components/ward-management/ward-derivations";
import { movementUmrn, resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { formatDateOfBirth } from "@/components/ward-management/ward-patients";
import { dayOf, formatInstantWithDay, formatSheetMoment, type Instant } from "@/components/ward-management/ward-clock";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import { transportEtaRemainingLabel } from "@/components/ward-management/ward-board-time-features";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { TRANSPORT_PROVIDERS, type Movement, type Unit } from "@/components/ward-management/ward-model";
import { wardLabel } from "@/components/ward-management/ward-absence-labels";
import { movementOriginLabel, originSiteCode } from "@/components/ward-management/ward-movement-origin";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import {
  changeReasonLabels,
  type DiversionReason,
  type TransportWhereabouts,
} from "@/components/ward-management/ward-change-reasons";

import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import { PACK_SLOTS, packCount, packForm, packNeedsForms, packOutstanding, packRequired } from "./officer-forms-pack";
import styles from "./officer.module.css";
import { OfficerFormCheckDialog } from "./officer-form-check-dialog";
import { TransportExceptionDialog } from "@/components/ward-management/transport-exception-dialog";
import type { TransportExceptionInput } from "@/components/ward-management/ward-flow-events";
import { collectionGaps } from "@/components/ward-management/ward-transport-checks";
import { SYNTHETIC_COPY_LINE } from "@/components/ward-management/referrals/referral-letter";
import {
  type HighlightPill,
  type HistoryTab,
  type JobsTab,
  LEG_TONE,
  OFFICER_ACTION_REJECTION_LABELS,
  OFFICER_LEG_STEPS,
  type OfficerLeg,
  PHONE_PILLS,
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
  transportLegalStatusLabel,
} from "./officer-screen-helpers";
import { renderArrivalsCard } from "./officer-arrivals-card";
import { OfficerOrderNote } from "./officer-order-note";
import { renderDetail, renderPhoneNextStep, type OfficerJobDetailContext } from "./officer-job-detail";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { useHoldOpenForm } from "@/components/ward-management/use-hold-open-form";
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
  const { movements, units, rejections, patients, referrals, dayZero, notices } = useWardFlowSelect(
    "movements",
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
  const now = useWardFlowClock();
  const raise = useWardRaise("officer");

  const [collectCheckId, setCollectCheckId] = useState<string | null>(null);
  // #236 (Josh, 27 Oct 2026): jobs whose crew tapped "Identity checked with the sending team". Sent
  // with the Collected step; never a gate on it.
  const [identityCheckedIds, setIdentityCheckedIds] = useState<ReadonlySet<string>>(() => new Set());
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
      if (next.has(movement.id)) next.delete(movement.id);
      else next.add(movement.id);
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
  const originLabelFor = (movement: Movement) => {
    const originEd = edById(movement.originEdId);
    return movementOriginLabel(movement, originEd && `${originEd.name} (${originEd.siteCode})`);
  };
  const originShortFor = (movement: Movement) => originSiteCode(movement) ?? originLabelFor(movement);

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
    const haystack = [
      officerPatientName(movement),
      subject.patient ? subject.displayName : "",
      umrnFor(movement),
      originEd ? `${originEd.name} ${originEd.siteCode}` : "",
      unitFor(movement)?.name ?? "",
      transport?.provider ?? "",
      transport?.cadNumber ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  };
  const isHighlighted = (movement: Movement) =>
    (pill !== null && matchesPill(movement, pill)) ||
    (providerHighlight !== null && movement.transport?.provider === providerHighlight) ||
    (escortHighlight && movement.transport?.escortRequired === true) ||
    (involuntaryHighlight && movement.transport?.transportLegalStatus === "involuntary") ||
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

  // Next action first: late, then forms still to upload, then the jobs furthest along.
  const priority = (movement: Movement) => {
    // Audit round 2, A4-13 (phone): a job to accept is pinned to the top, oldest first, so a new
    // booking is the Next action rather than the last row.
    if (isPhone && readyToAccept(movement)) return -1;
    if (late(movement)) return 0;
    if (packOutstanding(movement)) return 1;
    const leg = movement.transport ? officerLeg(movement.transport) : undefined;
    return 2 + (3 - (leg ? OFFICER_LEG_STEPS.indexOf(leg) : 0));
  };
  const sortedJobs = [...jobs].sort((a, b) => {
    if (sortKey === "wait") return stageSince(a) - stageSince(b);
    if (sortKey === "eta") {
      return (
        (expectedArrival(a)?.at ?? Number.POSITIVE_INFINITY) - (expectedArrival(b)?.at ?? Number.POSITIVE_INFINITY)
      );
    }
    return priority(a) - priority(b) || stageSince(a) - stageSince(b);
  });

  // The panel opens only when a patient is chosen (Josh, 9 Oct 2026); until then the table is full width.
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const selectedJob = selectedId === undefined ? undefined : jobs.find((job) => job.id === selectedId);
  // ROLE BRANCH (officer): the transport officer's own desk (as-officer-home, Josh 31 Oct 2026). A
  // long list opens on its first rows, then "Show all"; a highlight, a search or a chosen job past
  // the cut shows every row, so nothing lit is ever hidden.
  const officerDesk = useEffectiveWardAccess().role === "officer";
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
  const [diversionOpen, setDiversionOpen] = useState(false);
  useHoldOpenForm(diversionOpen); // Audit CS3-01: the diversion form is held from opening.
  const [diversionReason, setDiversionReason] = useState<DiversionReason | undefined>(undefined);
  const [diversionPlace, setDiversionPlace] = useState<TransportWhereabouts | undefined>(undefined);
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
  const resetDiversion = () => {
    setDiversionOpen(false);
    setDiversionReason(undefined);
    setDiversionPlace(undefined);
  };
  const selectJob = (id: string) => {
    resetDiversion();
    setSelectedId((current) => (current === id ? undefined : id));
  };
  const openJob = (id: string) => {
    if (id !== selectedId) resetDiversion();
    setSelectedId(id);
  };
  const closeJob = () => {
    resetDiversion();
    setSelectedId(undefined);
  };
  // Between the phone sheet and the two-column layout the panel stacks above the lists, so a
  // newly chosen job is scrolled into view rather than opening off-screen.
  const sideRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedId === undefined || typeof window.matchMedia !== "function") return;
    if (!window.matchMedia("(min-width: 48.0625rem) and (max-width: 62.5rem)").matches) return;
    sideRef.current?.scrollIntoView?.({ behavior: wardScrollBehavior(), block: "start" });
  }, [selectedId]);
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

  // Delivered today: closed jobs leave the live list and land here, newest first.
  const deliveredToday = movements
    .filter(
      (movement) => movement.transport?.arrivedAt !== undefined && dayOf(movement.transport.arrivedAt) === dayOf(now),
    )
    .sort((a, b) => b.transport!.arrivedAt! - a.transport!.arrivedAt!);

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

  const nextArrival = jobs
    .map((movement) => ({ movement, at: expectedArrival(movement)?.at }))
    .filter((item): item is { movement: Movement; at: Instant } => item.at !== undefined && item.at >= now)
    .sort((a, b) => a.at - b.at)[0];

  // Escape and "/" shortcut handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (formModalJob) {
          setFormModalJob(null);
          lastTriggerRef.current?.focus();
        } else if (selectedId !== undefined && !document.querySelector('[role="dialog"][aria-modal="true"]')) {
          setSelectedId(undefined);
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
          ...(identityCheckedIds.has(movement.id) ? { identityChecked: true as const } : {}),
        }),
      `Patient collected for ${officerPatientName(movement)}. In transit.`,
      "Collection",
    );
  const runDelivered = (movement: Movement) =>
    reportOutcome(
      movement.id,
      () => raise("PATIENT_ARRIVED", { movementId: movement.id }),
      `Arrival at ward recorded for ${officerPatientName(movement)}. The receiving ward confirms the arrival.`,
      "Arrived at ward",
    );

  /** The one action a job is waiting on, why it cannot be taken yet, and how to take it. */
  const nextStep = (movement: Movement) => {
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
      () => showToast(`Handover copied, ${jobs.length} open jobs.`),
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
  const arrivalsStart = Math.min(now, ...arrivals.map((item) => item.eta));
  const arrivalsEnd = Math.max(now, ...arrivals.map((item) => item.eta));
  const arrivalsSpan = Math.max(arrivalsEnd - arrivalsStart, 1);
  const arrivalsLeft = (at: Instant) => `${((at - arrivalsStart) / arrivalsSpan) * 100}%`;
  const hourTicks: Instant[] = [];
  for (let tick = Math.ceil(arrivalsStart / 60) * 60; tick <= arrivalsEnd; tick += 60) hourTicks.push(tick);
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
        {!job.closure &&
        job.transport.collectedAt !== undefined &&
        job.transport.arrivedAt === undefined &&
        job.transport.diversion === undefined ? (
          <Button
            variant="sec"
            size="sm"
            icon={MapPin}
            aria-expanded={diversionOpen}
            data-testid={`ward-officer-divert-${job.id}`}
            onClick={() => setDiversionOpen((open) => !open)}
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
    diversionOpen,
    diversionPlace,
    diversionReason,
    identityChecked: (movement: Movement) => identityCheckedIds.has(movement.id),
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
    setDiversionOpen,
    setDiversionPlace,
    setDiversionReason,
    showToast,
    toggleIdentityChecked,
    unitFor,
  };

  // Larger screen: the shared hero chip every other page uses (site review U5). Phone keeps its own
  // v10 design of three plain figures, so it stays on `HeroStat` and its phone styles.
  const pillStat = (which: HighlightPill, value: number, label: string, short: string, tone?: WfTone) =>
    isPhone ? (
      <HeroStat
        className={cx(styles.heroPill, PHONE_PILLS.includes(which) ? undefined : styles.deskOnly)}
        value={value}
        label={
          <>
            <span className={styles.longLabel}>{label}</span>
            <span className={styles.shortLabel}>{short}</span>
          </>
        }
        tone={tone}
        pressed={pill === which}
        onToggle={() => setPill((current) => (current === which ? null : which))}
      />
    ) : (
      <HeroChip
        key={which}
        value={value}
        label={label}
        tone={tone}
        pressed={pill === which}
        onPress={() => setPill((current) => (current === which ? null : which))}
      />
    );

  const heroPillStats = (
    <>
      {pillStat("requested", awaitingDeparture, "To accept", "To accept", "neutral")}
      {pillStat("accepted", crewToSend, "Crew to send", "To send", "neutral")}
      {pillStat("en_route", crewEnRoute, "Crew en route", "En route", "info")}
      {/* Redesign: the stage column's own word for the same state, so one state has one word. */}
      {pillStat("collected", inCustody, "Collected", "Collected", "info")}
      {pillStat("late", pastEta, "Past ward ETA", "Past ETA", pastEta > 0 ? "warning" : "neutral")}
      {/* F-23 (phone review, Oct 2026): outstanding forms take the warning glyph on phone, not the
          grey circle "0 Late" shows. A warning only: En route is never blocked. */}
      {pillStat(
        "forms",
        formsOutstanding,
        "Jobs need forms",
        "Need forms", // Redesign: says what the count is, like To accept beside it.
        // Redesign: amber at every width, as the rows' own form marks are.
        formsOutstanding > 0 ? "warning" : "neutral",
      )}
    </>
  );

  // Hero tools: beside the title on the larger screen, under the figures on phone (v10).
  // Phone (Josh, 31 Oct 2026): Copy handover and Arrivals are Home's 40px hero pills, side by side
  // (the kit's `phoneRows.heroPills` / `phoneRows.heroPill`).
  const heroTools = (
    <div className={isPhone ? phoneRows.heroPills : styles.heroTools}>
      {nextArrival ? (
        <span className={styles.nextArrival} title="Next expected arrival">
          <Icon icon={Clock} size={14} />
          Next arrival <b>{formatInstantWithDay(nextArrival.at, now)}</b>
          <span className={styles.nextArrivalPlace}>{destinationLabelFor(nextArrival.movement)}</span>
        </span>
      ) : null}
      {/* ROLE BRANCH (officer): on a phone the hero is for today's figures; handover is an
          end-of-shift step, so its button moves under the job list. */}
      {officerDesk && isPhone ? null : (
        <Button
          variant="onHero"
          size="sm"
          icon={Copy}
          className={isPhone ? phoneRows.heroPill : styles.copyButton}
          onClick={copyHandover}
          aria-label="Copy handover"
          title="Copy a plain text summary of open jobs"
        >
          <span className={styles.longLabel}>Copy handover</span>
        </Button>
      )}
      {/* Phone (v10): Arrivals jumps to the arrivals list below the jobs. */}
      {isPhone && upcoming > 0 ? (
        <Button
          variant="onHero"
          size="sm"
          icon={Clock}
          className={cx(styles.phArrivalsButton, phoneRows.heroPill)}
          onClick={() =>
            document
              .getElementById("ward-officer-arrivals-heading")
              ?.scrollIntoView({ block: "start", behavior: wardScrollBehavior() })
          }
        >
          Arrivals <span className={styles.phArrivalsCount}>{upcoming}</span>
        </Button>
      ) : null}
    </div>
  );

  const panelOpen = selectedJob !== undefined && selectedJob.transport !== undefined;
  const anyJobEta = jobs.some((movement) => expectedArrival(movement) !== undefined);
  // Site review 12 Oct 2026: a column that says the same thing on every row ("0 of 3" thirteen
  // times) says nothing; the hero's "Jobs need forms" and the job sheet still carry the count.
  const formsVary =
    jobs.length < 2 || new Set(jobs.map((movement) => (packRequired(movement) ? packCount(movement) : -1))).size > 1;
  useWardModalFocus(isPhone && panelOpen, sideRef, closeJob);
  // Redesign: the count only. The stage chips below already split it, and "waiting" means an ED wait elsewhere.
  const jobsLine = `${jobs.length} ${jobs.length === 1 ? "job" : "jobs"} open`;

  return (
    <div className={styles.screen} data-testid="ward-officer-screen" data-ward-design="v8">
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          className={styles.dispatchHero}
          // P195 (audit 27 Oct 2026, Josh 27 Oct): the h1 is the screen name. Redesign: the eyebrow
          // no longer repeats it, and the work it holds sits beside the title. ROLE BRANCH (officer):
          // a short eyebrow names the desk, as the other role homes do, so the phone hero's first
          // row is not the Demo chip alone.
          eyebrow={officerDesk ? "Jobs · Transport desk" : undefined}
          title="Transport"
          titleMeta={jobsLine}
          aside={isPhone ? <LiveChip state="live" onHero /> : heroTools}
          barAside={isPhone ? heroTools : undefined}
          bar={
            isPhone ? (
              <div className={styles.heroPills} role="group" aria-label="Highlight jobs">
                {heroPillStats}
              </div>
            ) : (
              <HeroChips label="Highlight jobs">{heroPillStats}</HeroChips>
            )
          }
          foot={
            showProviders ? (
              <div className={styles.fleetPanel} role="group" aria-label="Highlight jobs by provider">
                <span className={styles.fleetLabel}>Providers</span>
                {activeProviders.map((provider) => {
                  const providerJobs = jobs.filter((movement) => movement.transport?.provider === provider);
                  const moving = providerJobs.filter((movement) => {
                    const leg = transportLeg(movement.transport);
                    return leg === "En route" || leg === "Collected";
                  }).length;
                  const isSelected = providerHighlight === provider;
                  const jobCount = `${providerJobs.length} ${providerJobs.length === 1 ? "job" : "jobs"}`;
                  return (
                    <button
                      key={provider}
                      type="button"
                      className={styles.fleetButton}
                      onClick={() => setProviderHighlight((prev) => (prev === provider ? null : provider))}
                      title={isSelected ? "Stop highlighting this provider" : `Highlight ${provider} jobs`}
                      aria-pressed={isSelected}
                      // Redesign: the job count on screen; how many are moving is in the spoken label.
                      aria-label={`${provider}, ${jobCount}, ${moving} moving`}
                    >
                      <span className={styles.fleetName}>{provider.replace(/ service$/, "")}</span>
                      <span className={styles.fleetCounts}>{jobCount}</span>
                    </button>
                  );
                })}
              </div>
            ) : undefined
          }
        />

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

        {topJob && topJob.transport ? (
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

        {isPhone && showProviders ? (
          <div className={styles.phProviders} role="group" aria-label="Highlight jobs by provider">
            {/* Zero providers are hidden (device audit, 11 Oct 2026): "0 Ambulance" took the row
                and pushed a real one off screen. */}
            {activeProviders.map((provider) => {
              const isSelected = providerHighlight === provider;
              return (
                <button
                  key={provider}
                  type="button"
                  className={styles.phProvider}
                  onClick={() => setProviderHighlight((prev) => (prev === provider ? null : provider))}
                  title={isSelected ? "Stop highlighting this provider" : `Highlight ${provider} jobs`}
                  aria-pressed={isSelected}
                >
                  <span className={styles.phProviderCount}>
                    {jobs.filter((movement) => movement.transport?.provider === provider).length}
                  </span>
                  {provider.replace(/ service$/, "")}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className={styles.layout} data-open={panelOpen ? "true" : undefined}>
          <div className={styles.leftColumn}>
            <Card className={styles.jobsPanel} aria-label="Jobs">
              <div className={styles.tabsRow}>
                <Tabs
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
                <span className={styles.headNote}>
                  {/* ROLE BRANCH (officer): no "Choose a patient" hint over a list that says it already. */}
                  {panelOpen
                    ? "Highlights never hide a job"
                    : officerDesk
                      ? null
                      : "Choose a patient to open their job"}
                </span>
              </div>

              <TabPanel idPrefix="ward-officer-jobs" id="jobs" hidden={jobsTab !== "jobs"}>
                <div className={styles.toolbar} role="search" aria-label="Find transport jobs">
                  <TextInput
                    ref={searchInputRef}
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
                  <FilterChip
                    pressed={escortHighlight}
                    onPressedChange={setEscortHighlight}
                    count={jobs.filter((job) => job.transport?.escortRequired).length}
                  >
                    Escort
                  </FilterChip>
                  <FilterChip
                    pressed={involuntaryHighlight}
                    onPressedChange={setInvoluntaryHighlight}
                    count={jobs.filter((job) => job.transport?.transportLegalStatus === "involuntary").length}
                  >
                    Involuntary
                  </FilterChip>
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

                {/* ROLE BRANCH (officer): on a phone the list is the content; the order note stays on the
                    larger screen, where the Sort control it explains is shown. */}
                <OfficerOrderNote shown={jobs.length > 0 && sortKey === "next" && !(officerDesk && isPhone)} />
                {jobs.length === 0 ? (
                  <p className={styles.placeholder} data-testid="ward-officer-empty">
                    No transport job is currently outstanding &mdash; every job has either arrived or its movement has
                    closed.
                  </p>
                ) : (
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
                          <th scope="col" className={formsVary ? undefined : styles.etaOff}>
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
                          const legIndex = leg ? OFFICER_LEG_STEPS.indexOf(leg) : -1;
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
                                  <span className={styles.stageCell}>
                                    <span
                                      className={styles.stepper}
                                      role="img"
                                      aria-label={`Transport stage: ${leg}, ${stepStatusText}`}
                                      data-testid={`ward-officer-stepper-${movement.id}`}
                                    >
                                      {OFFICER_LEG_STEPS.map((stepName, index) => (
                                        <span
                                          key={stepName}
                                          className={styles.stageDot}
                                          data-s={index < legIndex ? "done" : index === legIndex ? "now" : "todo"}
                                        />
                                      ))}
                                    </span>
                                    <p className={styles.stageLine}>
                                      <strong>{leg}</strong>
                                      <SrOnly>, {stepStatusText}</SrOnly>
                                    </p>
                                    {since !== undefined ? (
                                      <span className={styles.stageFor}>{durMinutes(Math.max(0, now - since))}</span>
                                    ) : null}
                                  </span>
                                ) : (
                                  transportLeg(transport)
                                )}
                              </td>
                              <td className={formsVary ? undefined : styles.etaOff}>
                                {!packRequired(movement) ? (
                                  <span className={styles.muted}>Not needed</span>
                                ) : (
                                  <span
                                    className={styles.formsCell}
                                    title={`${forms} of ${PACK_SLOTS.length} forms recorded`}
                                  >
                                    <span className={styles.formDots} aria-hidden="true">
                                      {PACK_SLOTS.map((slot) => (
                                        <StatusGlyph
                                          key={slot.key}
                                          tone={packForm(movement, slot.key) ? "success" : "neutral"}
                                          size={9}
                                        />
                                      ))}
                                    </span>
                                    {/* Redesign: one text beside the dots, naming its noun; "of 4" is in the title. */}
                                    {forms === PACK_SLOTS.length ? (
                                      <span data-complete="true">All forms</span>
                                    ) : (
                                      <span className={styles.formsMissing}>
                                        {PACK_SLOTS.length - forms} {PACK_SLOTS.length - forms === 1 ? "form" : "forms"}{" "}
                                        missing
                                      </span>
                                    )}
                                  </span>
                                )}
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
                        <li key={movement.id} className={styles.plainItem}>
                          <StatusGlyph tone="success" size={9} />
                          <span>
                            <span className={styles.mono}>
                              {formatInstantWithDay(movement.transport!.arrivedAt!, now)}
                            </span>{" "}
                            <strong>{officerListPatientName(movement)}</strong>{" "}
                            <span className={styles.mono}>{umrnFor(movement)}</span> · {destinationLabelFor(movement)}{" "}
                            <span className={styles.muted}>({movement.transport!.provider})</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className={styles.filterEmpty}>
                      <EmptyState icon={Check} title="Nothing delivered yet today." />
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
                      <p className={styles.panelNote}>Recorded refusals remain visible for this session.</p>
                    </section>
                  ) : (
                    <div className={styles.filterEmpty}>
                      <EmptyState icon={Check} title="No action has been refused this session." />
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
                      <p className={styles.panelNote}>
                        Cancelled dispatches and ambulance stand-downs for this session.
                      </p>
                    </section>
                  ) : (
                    <div className={styles.filterEmpty}>
                      <EmptyState icon={Check} title="No transport has been cancelled this session." />
                    </div>
                  )}
                </TabPanel>
              </TabPanel>
            </Card>

            {/* ROLE BRANCH (officer): on a phone, Copy handover sits under the list as an end-of-shift step. */}
            {officerDesk && isPhone ? (
              <Button variant="sec" icon={Copy} onClick={copyHandover} title="Copy a plain text summary of open jobs">
                Copy handover
              </Button>
            ) : null}

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

          {panelOpen && selectedJob && selectedJob.transport ? (
            <>
              <div ref={sideRef} className={styles.side}>
                <div className={styles.scrim} aria-hidden="true" onClick={closeJob} />
                <Card
                  className={styles.detail}
                  role={isPhone ? "dialog" : undefined}
                  aria-modal={isPhone ? true : undefined}
                  aria-labelledby="ward-officer-detail-heading"
                  data-testid="ward-officer-detail"
                >
                  <span className={styles.grab} aria-hidden="true" />
                  <CardHead
                    id="ward-officer-detail-heading"
                    className={styles.detailHead}
                    title={officerPatientName(selectedJob)}
                    meta={
                      <>
                        {/* The UMRN is withheld on some desks; no stray " · " is left in its place. */}
                        {umrnFor(selectedJob) ? <span className={styles.mono}>{umrnFor(selectedJob)}</span> : null}
                        {isPhone ? (
                          <>
                            {umrnFor(selectedJob) ? "\u00a0· " : null}
                            {originShortFor(selectedJob)} to {destinationLabelFor(selectedJob)}
                            {selectedJob.transport.escortRequired ? "\u00a0· Escort" : ""}
                          </>
                        ) : (
                          <>
                            {umrnFor(selectedJob) ? " · " : null}
                            {/* Redesign: a bare "Not recorded" names no noun. */}
                            {transportLegalStatusLabel(selectedJob.transport) === "Not recorded"
                              ? "Legal status not recorded"
                              : transportLegalStatusLabel(selectedJob.transport)}
                            {selectedJob.transport.escortRequired ? " · Escort" : ""}
                          </>
                        )}
                      </>
                    }
                    aside={
                      <>
                        {/* Redesign: no stage chip here; the leg steps in the panel show the stage. */}
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          icon={X}
                          onClick={closeJob}
                          aria-label="Close job panel"
                          data-testid="ward-officer-detail-close"
                        />
                      </>
                    }
                  />
                  <CardBody className={styles.detailBody}>
                    {renderDetail(selectedJob, detailContext)}
                    {isPhone ? <div className={styles.phMoreActions}>{detailExtraActions(selectedJob)}</div> : null}
                  </CardBody>
                  {isPhone ? (
                    renderPhoneNextStep(selectedJob, detailContext) ? (
                      <CardFoot className={styles.detailFooter}>
                        {renderPhoneNextStep(selectedJob, detailContext)}
                      </CardFoot>
                    ) : null
                  ) : (
                    <CardFoot className={styles.inactiveRow}>{detailExtraActions(selectedJob)}</CardFoot>
                  )}
                </Card>
              </div>
            </>
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
