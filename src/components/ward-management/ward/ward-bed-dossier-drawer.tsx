"use client";

import type { WardCommandDispatch } from "../ward-shared-client";

import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { leftWardAllowedFor, transportPendingFor } from "@/components/ward-management/ward-left-ward";
import Link from "next/link";
import { History as HistoryIcon, MapPin, UserRound } from "lucide-react";
import styles from "./ward-bed-dossier-drawer.module.css";
import type { Unit } from "@/components/ward-management/ward-model";
import type { EventLogEntry } from "@/components/ward-management/ward-event-log";
import { bedGlyphTone, eddMovedBadge, type BedItem } from "./ward-bed-tone";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import {
  DISCHARGE_BARRIERS,
  isDischargeBarrier,
  LEAVING_DESTINATIONS,
  stayDayNumber,
  type DischargeBarrier,
  type LeavingDestination,
} from "@/components/ward-management/ward-admissions";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { deriveAfternoonDischarges } from "@/components/ward-management/ward-derivations";
import { stalePreparingReleases } from "@/components/ward-management/ward-bed-availability";
import { BED_RELEASE_BLOCKERS, type BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { BlockerEditor, useBlockerSave } from "./ward-bed-blocker-editor";
import { WardBedBoardTool, type WardBedBoardTools } from "./ward-bed-board-tools";
import { BedClosureControls, closedBedWords, type BedClosureActions } from "./ward-bed-closure-controls";
import { wardClosureReasonLabel } from "../ward-bed-closure-reason";
import {
  openJourneyFromStay,
  SentJourneyChanges,
  useStayJourneyIsMine,
} from "@/components/ward-management/movements/sent-journey-changes";
import { WardDischargeCriteriaCard, type DischargeCriteriaUpdate } from "./ward-discharge-criteria-card";
import { WardDischargeChecklistCard } from "./ward-discharge-checklist-card";
import {
  dischargeChecklist,
  outstandingDischargeChecks,
  type DischargeCheckItem,
  type DischargeCheckState,
} from "@/components/ward-management/ward-discharge-checklist";
import {
  criteriaLedDepartureNote,
  dischargeCriteriaStatus,
  type CriteriaEligibility,
} from "@/components/ward-management/ward-discharge-criteria";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { dayOf, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
import { patientIdentityLine } from "@/components/ward-management/ward-patient-resolver";
import {
  Badge,
  Button,
  Dialog,
  Icon,
  PanelDrawer,
  Segmented,
  StatusGlyph,
  StatusPill,
  Umrn,
  buttonClass,
  cx,
  durMinutes,
  useIsPhone,
  type WfTone,
} from "@/components/wf";
import { MissingValue } from "@/components/wf/missing-value";
import {
  observationLevelName,
  observationRatio,
  type Observation,
} from "@/components/ward-management/ward-observation";
import { WardObservationControl, observationWithReview } from "./ward-observation-control";
import { WardLeavePaperAuthority, useLeaveNeedsPaperAuthority } from "./ward-leave-paper-authority";
import {
  BedActions,
  ChoiceChips,
  Row,
  StaySteps,
  focusChoice,
  mainActionId,
  shortLegal,
  hasNoLeavingDate,
  stayStatus,
  type BedAction,
} from "./ward-bed-dossier-bits";
import { PhoneBedChip, PhoneBedSheet } from "./ward-bed-dossier-phone";
import { WardDrawerDischargeDate } from "./ward-drawer-discharge-date";
import { observationEditingToken } from "@/components/ward-management/ward-flow-observation-events";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { WardUnder18Notice } from "./ward-under-18-notice";

const roleLabel = (role: keyof typeof WARD_FLOW_ROLE_LABELS) => WARD_FLOW_ROLE_LABELS[role];

/** The one desk whose accepted bed step on this ward landed at `at`, or undefined when none or several did. */
export function reopenedByRole(
  log: readonly EventLogEntry[],
  unitId: string,
  at: number,
): keyof typeof WARD_FLOW_ROLE_LABELS | undefined {
  const roles = new Set(
    log
      .filter(
        (entry) => entry.accepted && entry.type === "SET_BED_CLOSED" && entry.unitId === unitId && entry.now === at,
      )
      .map((entry) => entry.role),
  );
  const [only] = roles;
  return roles.size === 1 && only !== undefined ? only : undefined;
}

interface WardBedDossierDrawerProps {
  selectedBed: number;
  bedItem: BedItem | undefined;
  unit: Unit;
  onClose: () => void;
  drawerLeavingDestination: LeavingDestination | "";
  setDrawerLeavingDestination: (dest: LeavingDestination) => void;
  onRecordLeft: (
    admissionId: string,
    who: string,
    destination: LeavingDestination | "",
    /** One bed record (batch 3, A): left the ward, still waiting for transport (the board's item 18). */
    awaitingTransport?: boolean,
  ) => void;
  /** Records or clears the stay's discharge blocker. Absent where this desk may not: the blocker
   *  controls are then not offered, rather than a Save that does nothing. */
  onUpdateBlocker?: (admissionId: string, blocker: string | null) => ReturnType<WardCommandDispatch>;
  /** Records a new observation level for the stay (fix plan item 10). Absent where this desk may not. */
  onSetObservation?: (
    admissionId: string,
    observation: Observation,
    expected?: string,
  ) => ReturnType<WardCommandDispatch>;
  onMarkAtEd?: (bedNumber: number) => void;
  onMarkBack?: (bedNumber: number) => void;
  /** Steps to the bed before this one. The arrow shows only when the parent passes it. */
  onPrevBed?: () => void;
  /** Steps to the bed after this one. The arrow shows only when the parent passes it. */
  onNextBed?: () => void;
  /** Audit four #31: where this bed sits in the ward's list, for the head pager's "3 of 12". */
  bedPosition?: { index: number; total: number };
  bedDrawerRef: React.RefObject<HTMLElement | null>;
  /** Was the phone sheet's own key handler; audit four #98 left the phone on the kit drawer, so it is unread. */
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  /** Bed board (v10 pass 3): picks this stay up on the board, to place in another bed. */
  onMove?: () => void;
  /** Bed board (v10 pass 3): opens the board, where a waiting referral can be placed here. */
  onOpenBoard?: () => void;
  /** A4-24: one tap marks a vacated bed being made ready as Ready, so it is offered again. */
  onMarkReady?: () => void;
  bedClosure?: BedClosureActions; // H-0978 / WS-15: close or reopen this exact bed (`SET_BED_CLOSED`).
  /** Item #6: raises a pre-filled ward referral from the selected patient's bed dossier. */
  onRaiseReferral?: () => void;
  /** Item #6: deep-link to the full referral drawer pre-filled with this patient and sending site. */
  fullReferralHref?: string;
  /** Item #5a: role-locked notice with 1-click Switch to Ward desk action when not on Ward desk. */
  roleLockNote?: React.ReactNode;
  /** Top 25 item 5: records the stay's discharge barrier (`SET_DISCHARGE_BARRIER`). Absent when the role cannot. */
  onSetBarrier?: (admissionId: string, barrier: DischargeBarrier | null) => void;
  /** Top 25 item 9 (D-60): set when the criteria led discharge flag is on. */
  criteriaEligibility?: CriteriaEligibility;
  /** Records the stay's discharge criteria (`SET_DISCHARGE_CRITERIA`). Absent when the role cannot. */
  onSetCriteria?: (admissionId: string, update: DischargeCriteriaUpdate) => ReturnType<WardCommandDispatch>;
  /** Feature 37: ticks one discharge checklist item (`RECORD_DISCHARGE_CHECK`). Absent when the role cannot. */
  onRecordDischargeCheck?: (admissionId: string, item: DischargeCheckItem, state: DischargeCheckState) => void;
  /** Simplification 26 Nov 2026 (area 3, item 3): the Bed board's clinically ready and ward diagnosis tools. */
  boardTools?: WardBedBoardTools;
}

// WH1 (Josh, 3 Nov 2026): two tabs, Now and Leaving. The stay's recorded events moved from a third
// tab to History, a quiet button beside them.
type DrawerTab = "now" | "leave";
type TabButtons = Map<number, HTMLButtonElement | null>;
const DRAWER_TABS: { id: DrawerTab; label: string }[] = [
  { id: "now", label: "Now" },
  { id: "leave", label: "Leaving" },
];
const LEAVING_CHOICES = LEAVING_DESTINATIONS.map(({ id, label }) => ({ id, label }));
/** WH1 appraisal: the first places in the list cover most departures; the rest fold behind one button. */
const COMMON_DESTINATIONS = 3;
const BARRIER_CHOICES = [
  { id: "None" as const, label: "None recorded" },
  ...DISCHARGE_BARRIERS.map((barrier) => ({ id: barrier, label: barrier })),
];
/** The hero's step track for a stay: each step is a fact the ward recorded, never a time worked out. */
const STAY_STEPS = ["On the ward", "Date set", "Confirmed", "Left"] as const;
const TAB_PREFIX = "bed-drawer";

/** The recorded blocker, or blank so the list opens on "Choose what is holding them up". */
function recordedBlocker(value: string | undefined): BedReleaseBlocker | "" {
  return value && (BED_RELEASE_BLOCKERS as readonly string[]).includes(value) ? (value as BedReleaseBlocker) : "";
}

/** The same shape the Every bed tile shows, so the badge and the tile always agree. */
function bedTone(bedItem: BedItem | undefined, isReady: boolean): WfTone | null {
  if (isReady && !bedItem?.preparing) return "success";
  return bedItem ? bedGlyphTone(bedItem) : null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.card}>
      <h3 className={styles.cardTitle}>{title}</h3>
      {children}
    </section>
  );
}

export function WardBedDossierDrawer({
  selectedBed,
  bedItem,
  unit,
  onClose,
  drawerLeavingDestination,
  setDrawerLeavingDestination,
  onRecordLeft,
  onUpdateBlocker,
  onSetObservation,
  onMarkAtEd,
  onMove,
  onOpenBoard,
  onMarkReady,
  bedClosure,
  onMarkBack,
  onPrevBed,
  onNextBed,
  bedPosition,
  bedDrawerRef,
  onRaiseReferral,
  roleLockNote,
  onSetBarrier,
  criteriaEligibility,
  onSetCriteria,
  onRecordDischargeCheck,
  boardTools,
}: WardBedDossierDrawerProps) {
  const {
    admissions,
    bedReleases,
    resolvePatientIdentity,
    movements,
    eventLog = [],
  } = useWardFlowSelect("admissions", "bedReleases", "resolvePatientIdentity", "movements", "eventLog");
  const now = useWardFlowClock();
  // One bed record (batch 3, A): the Bed board's "Has their transport come?", asked under Going to
  // while this stay's transport is still pending and they are going somewhere on site to wait.
  const [transportAnswer, setTransportAnswer] = useState<{ id: string; waiting: boolean } | null>(null);
  // Demo-Actions-AC1-3: a desk that can never record a departure (the site bed manager) is not
  // offered "Record that they have left" (DESIGN-SYSTEM.md, Actions; F-54).
  const roleGate = useRoleGate();
  const leavingNever = roleGate("RECORD_LEAVING").never === true;
  const dateNever = roleGate("UPDATE_EXPECTED_DISCHARGE").never === true;
  const [tab, setTab] = useState<DrawerTab>("now");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [barrierOpen, setBarrierOpen] = useState(false);
  const [allDestinations, setAllDestinations] = useState(false);
  // Audit three #32: "Record that they have left" with no destination asks where in its own confirm.
  const [pickInConfirm, setPickInConfirm] = useState(false);
  const historyRef = useRef<HTMLElement | null>(null);
  const [quickBlockerOpen, setQuickBlockerOpen] = useState(false);
  const [selectedBlocker, setSelectedBlocker] = useState<BedReleaseBlocker | "">(recordedBlocker(bedItem?.blockReason));
  const [shownBed, setShownBed] = useState(selectedBed);
  // Audit 1, Josh 20 Oct (CS-07): leaving and going to an ED each ask once before they are recorded.
  const [confirmStep, setConfirmStep] = useState<"leave" | "ed" | null>(null);
  const tabRefs = useRef<TabButtons>(new Map());
  const isPhone = useIsPhone();
  const blockerSelectRef = useRef<HTMLDivElement | null>(null);
  const blockerSave = useBlockerSave(
    bedItem?.stayAdmissionId ?? bedItem?.admissionId,
    bedItem?.admissionId,
    onUpdateBlocker,
    setQuickBlockerOpen,
  );
  const saveBlocker = blockerSave.submit;
  const setBlockerOpen = blockerSave.setOpen;
  // Audit 24-1 B-04: the drawer follows the person it was opened for, not the bed number. A pulled
  // stay keeps the same admission when it arrives, so the stay's id is the key.
  const personKey = bedItem?.stayAdmissionId ?? bedItem?.admissionId;
  const [openedFor, setOpenedFor] = useState({ admissionId: personKey, alias: bedItem?.patientAlias });
  // The departure this drawer recorded itself, which closes it on success and is not a surprise.
  const [departedHere, setDepartedHere] = useState<string | null>(null);
  const goneCloseRef = useRef<HTMLButtonElement | null>(null);

  // Stepping to another bed keeps the open tab but drops anything half-done on the last bed.
  if (shownBed !== selectedBed) {
    setShownBed(selectedBed);
    setQuickBlockerOpen(false);
    setBarrierOpen(false);
    setConfirmStep(null);
    setSelectedBlocker(recordedBlocker(bedItem?.blockReason));
    setOpenedFor({ admissionId: personKey, alias: bedItem?.patientAlias });
  }

  // Another tab or a refresh moved the person out of this bed while the drawer was open. Their
  // actions must not carry over to whoever is there now, so any open confirm closes.
  const personGone =
    shownBed === selectedBed &&
    personKey !== openedFor.admissionId &&
    (openedFor.admissionId === undefined || departedHere !== openedFor.admissionId);
  if (personGone && (confirmStep !== null || quickBlockerOpen)) {
    setConfirmStep(null);
    setQuickBlockerOpen(false);
  }

  // Drawer review (6 Nov 2026), audit four #98: at every width the record is the kit PanelDrawer,
  // whose Sheet owns the focus trap, Escape, the outside click and the return of focus.
  useEffect(() => {
    if (personGone) goneCloseRef.current?.focus();
  }, [personGone]);

  const bedLabel = `Bed ${String(selectedBed).padStart(2, "0")}`;
  const isReady = bedItem?.status === "ready";
  // A4-24: vacated and still being made ready. Not offered until someone taps Ready.
  const isPreparing = isReady && bedItem?.preparing === true;
  const readyWord = isPreparing ? BED_STATE_LABELS.beingMadeReady : "Ready bed";
  const occupantAlias = bedItem?.patientAlias ?? "No occupant recorded";
  const isOccupied = Boolean(bedItem?.patientAlias);
  // C03: a closed bed with nobody in it shows the closure and its reason, in the empty-bed layout.
  const closedEmpty =
    bedItem?.status === "closed" && !isOccupied ? closedBedWords(unit, selectedBed, bedItem.closedReview) : null;
  const isAwayAtEd = bedItem?.awayAtEdHours !== null && bedItem?.awayAtEdHours !== undefined;
  const admission = bedItem?.admissionId ? admissions.find((a) => a.id === bedItem.admissionId) : undefined;
  // Both layouts send the same token, so a colleague's level change made while the form is open is refused.
  const observationChanges = admission?.observationChanges?.length ?? 0;
  const observationToken =
    admission && observationEditingToken("admission", admission.id, admission.observation, observationChanges);
  const leavePaper =
    useLeaveNeedsPaperAuthority(admission, drawerLeavingDestination || null) && admission ? (
      <WardLeavePaperAuthority
        key={admission.id}
        admissionId={admission.id}
        who={occupantAlias}
        unitId={unit.id}
        againstAdvice={drawerLeavingDestination === "left-against-advice"}
      />
    ) : null;
  // D-80: the open journey this ward sent for the person in this bed, with its own urgency and legal status controls.
  const sentJourney = admission ? openJourneyFromStay(movements, admission) : undefined;
  const sentJourneyControls = useStayJourneyIsMine(sentJourney) ? (
    <SentJourneyChanges key={sentJourney!.id} movement={sentJourney!} patientWho={occupantAlias} />
  ) : null;
  const tone = bedTone(bedItem, isReady);

  const stayDays = typeof bedItem?.stayDays === "number" ? bedItem.stayDays : null;
  const ageSex = [typeof bedItem?.age === "number" ? String(bedItem.age) : null, bedItem?.sex ?? null];
  const subline =
    isReady || closedEmpty
      ? "Empty bed."
      : [
          ...ageSex,
          bedItem?.stayBand ??
            (bedItem?.status === "incoming"
              ? typeof bedItem?.deliveredAt === "number"
                ? "Arrived at ward, confirm arrival"
                : "Arriving"
              : null),
        ]
          .filter(Boolean)
          .join(" · ") || "On this ward";

  // Redesign: the expected date is a day, not a moment, so it reads "2 days ago" rather than "10:42, 2 days ago".
  const expectedDay = (() => {
    const at = admission?.expectedDischargeAt;
    if (at == null || !Number.isFinite(at)) return bedItem?.expectedDischargeLabel ?? null;
    const days = dayOf(at) - dayOf(now);
    if (days === 0) return "Today";
    if (days === -1) return "Yesterday";
    if (days === 1) return "Tomorrow";
    return days < 0 ? `${-days} days ago` : `In ${days} days`;
  })();
  const expectedPlan = bedItem?.pastDate
    ? expectedDay
      ? `Past the ward's own date (${expectedDay})`
      : "Past the ward's own date"
    : (expectedDay ?? "No date set");

  const goingOut = (() => {
    if (bedItem?.pastDate) return "Past date";
    const at = admission?.expectedDischargeAt;
    if (at == null || !Number.isFinite(at)) return "No date";
    const days = dayOf(at) - dayOf(now);
    if (days <= 0) return "Today";
    if (days === 1) return "Tomorrow";
    return `In ${days} days`;
  })();

  const confirmation =
    bedItem?.dischargeConfirmed === true
      ? bedItem.dischargeConfirmedBy
        ? `Confirmed by ${bedItem.dischargeConfirmedBy}`
        : "Confirmed"
      : "Not yet confirmed";

  // Top 25 item 21: beside the discharge date when the ward has moved it several times.
  const eddMoved = eddMovedBadge(bedItem?.dischargeDateMoves, bedItem?.eddDriftDays);
  const expectedValue = eddMoved ? (
    <>
      {expectedPlan}{" "}
      <Badge tone="warning" size="sm">
        {eddMoved}
      </Badge>
    </>
  ) : (
    expectedPlan
  );
  // WT-16: the ward sets or changes the date here, not only the coordinator.
  const dateEditor =
    admission?.state === "occupied" && !dateNever ? (
      <WardDrawerDischargeDate
        key={admission.id}
        admissionId={admission.id}
        unitId={unit.id}
        recordedAt={admission.expectedDischargeAt ?? null}
      />
    ) : null;

  // Polish (9 Nov 2026): once the Expected line carries the "Date moved N times" badge, the count
  // is said there once, not again as its own row.
  const dateMoves =
    eddMoved === null && typeof bedItem?.dischargeDateMoves === "number"
      ? bedItem.dischargeDateMoves === 0
        ? "Not moved"
        : `Moved ${bedItem.dischargeDateMoves} time${bedItem.dischargeDateMoves === 1 ? "" : "s"}`
      : null;

  const observation = bedItem?.observation
    ? observationWithReview(bedItem.observation, now)
    : bedItem?.highAcuity
      ? "High acuity"
      : "Not recorded";
  // The fact tile is narrow: the ratio for a constant level, the name otherwise. The row below has it in full.
  const observationShort = bedItem?.observation
    ? (observationRatio(bedItem.observation.level) ?? observationLevelName(bedItem.observation.level))
    : observation;

  // Top 25 item 5: due out within the discharge prep window, the barrier is asked for here.
  const prepHours = Math.round(CLINICAL_VALUES.dischargePrepWindow.value / 60);
  const dueForPrep = admission?.state === "occupied" && deriveAfternoonDischarges([admission], now).length > 0;
  // H-0981 / WS-17: while the blocker form is open the barrier shows as plain text, so recording a
  // blocker is one choice, not two lists. Its chips come back when the blocker form closes.
  // WH1 (Josh, 3 Nov 2026): kit chips in place of the browser drop-down.
  // WH1 appraisal: eight reasons are folded behind one quiet button until asked for.
  const barrierEditor =
    admission && bedItem?.admissionId && onSetBarrier && stayDays !== null && !quickBlockerOpen ? (
      <div className={styles.choiceField} data-testid="ward-drawer-barrier-select">
        {barrierOpen ? (
          <>
            <span className={styles.choiceLabel}>Long-stay reason</span>
            <ChoiceChips
              label="Long-stay reason"
              items={BARRIER_CHOICES}
              value={admission.dischargeBarrier ?? "None"}
              onChange={(value) => {
                onSetBarrier(admission.id, isDischargeBarrier(value) ? value : null);
                setBarrierOpen(false);
              }}
            />
          </>
        ) : (
          <Button variant="ghost" size="sm" className={styles.quiet} onClick={() => setBarrierOpen(true)}>
            {admission.dischargeBarrier ? "Change long-stay reason" : "Record a long-stay reason"}
          </Button>
        )}
      </div>
    ) : null;
  const barrierValue =
    admission && bedItem?.admissionId ? (admission.dischargeBarrier ?? "None recorded") : bedItem?.dischargeBarrier;
  // Finding 61 (Josh, 27 Oct 2026): blocker (today) and barrier (long-stay reason) under one label.
  // The chips below say the long-stay reason when they show, so the row does not say it twice.
  const holdUpRow = (
    <Row label="What is holding them up">
      <div data-testid="ward-drawer-hold-up-today">Today: {bedItem?.blockReason ?? "None recorded"}</div>
      {barrierValue && !barrierOpen ? (
        <div data-testid="ward-drawer-hold-up-long-stay">Long-stay reason: {barrierValue}</div>
      ) : null}
    </Row>
  );
  // Top 25 item 4: still being made ready past the set time. A question for the ward, never an
  // automatic opening: Ready below is the only way the bed is offered again.
  const staleFor =
    isPreparing && typeof bedItem?.preparingReleaseId === "string"
      ? stalePreparingReleases(unit.id, bedReleases, now).find(
          (entry) => entry.release.id === bedItem.preparingReleaseId,
        )?.minutes
      : undefined;
  const readyNote =
    staleFor !== undefined ? (
      <p className={styles.meta} data-testid="ward-drawer-cleaning-reminder">
        Being made ready for {durMinutes(staleFor)}. Tap Ready if it is ready.
      </p>
    ) : null;
  const prepNote = dueForPrep ? (
    <p className={styles.meta} data-testid="ward-drawer-discharge-prep">
      Discharge due within {prepHours} hours. Record any hold-up now.
    </p>
  ) : null;
  // Top 25 item 9 (D-60): criteria led discharge, on the Plan to leave tab and the phone sheet.
  const criteriaCard =
    criteriaEligibility !== undefined && admission?.state === "occupied" ? (
      <WardDischargeCriteriaCard
        key={admission.id}
        record={admission.dischargeCriteria}
        eligibility={criteriaEligibility}
        now={now}
        onChange={onSetCriteria ? (update) => onSetCriteria(admission.id, update) : undefined}
      />
    ) : null;
  // Feature 37 (9 Nov 2026): the discharge checklist, beside the criteria card. Advisory only: the
  // confirm step lists anything outstanding and records the discharge anyway.
  const checklistRows =
    admission?.state === "occupied"
      ? dischargeChecklist({
          dischargeChecks: admission.dischargeChecks,
          followUp: admission.followUp,
          followUpReply: admission.followUpReply,
          dependencies: bedReleases.find(
            (release) => release.admissionId === admission.id && release.state !== "discharged",
          )?.dependencies,
        })
      : null;
  const checklistCard =
    checklistRows && admission ? (
      <WardDischargeChecklistCard
        rows={checklistRows}
        onRecord={
          onRecordDischargeCheck ? (item, state) => onRecordDischargeCheck(admission.id, item, state) : undefined
        }
      />
    ) : null;
  const outstandingChecks = checklistRows ? outstandingDischargeChecks(checklistRows) : [];
  // D-64: the criteria state beside "Record that they have left". It warns and never blocks.
  const criteriaRecord = criteriaCard && admission ? admission.dischargeCriteria : null;
  const criteriaDepartureNote =
    criteriaRecord && criteriaEligibility !== undefined
      ? criteriaLedDepartureNote(dischargeCriteriaStatus(criteriaRecord, criteriaEligibility, now))
      : null;
  const admittedAt = admission?.arrivedAt ?? admission?.pulledAt ?? null;

  // Only what the stay itself recorded, newest first. Nothing here is inferred.
  const timeline: { at: number; tone: WfTone; label: string }[] = [];
  if (admission) {
    if (admission.pulledAt != null) timeline.push({ at: admission.pulledAt, tone: "info", label: "Bed given" });
    if (admission.arrivedAt != null)
      timeline.push({ at: admission.arrivedAt, tone: "info", label: `Arrived on ${unit.name}` });
    if (admission.dischargeDateSetAt != null)
      timeline.push({
        at: admission.dischargeDateSetAt,
        tone: "neutral",
        label: `Leaving date set${admission.dischargeDateSetBy ? ` by ${admission.dischargeDateSetBy}` : ""}`,
      });
    if (admission.awayAtEmergencyDepartmentSince != null)
      timeline.push({
        at: admission.awayAtEmergencyDepartmentSince,
        tone: "warning",
        label: "Went to an ED, bed held",
      });
    if (admission.dischargeConfirmedAt != null)
      timeline.push({
        at: admission.dischargeConfirmedAt,
        tone: "success",
        label: `Discharge confirmed${admission.dischargeConfirmedBy ? ` by ${admission.dischargeConfirmedBy}` : ""}`,
      });
    for (const change of admission.observationChanges ?? [])
      timeline.push({
        at: change.at,
        tone: "neutral",
        label: `Observation changed to ${observationWithReview(change.to, now)}`,
      });
    if (criteriaRecord && criteriaRecord.items.length > 0) {
      timeline.push({ at: criteriaRecord.setAt, tone: "neutral", label: "Discharge criteria set or reviewed" });
      const metTimes = criteriaRecord.items.map((item) => item.metAt);
      if (metTimes.every((at): at is number => at !== null))
        timeline.push({ at: Math.max(...metTimes), tone: "success", label: "All discharge criteria met" });
    }
    // every hold-up recorded and cleared, with who and when.
    for (const record of admission.stayBlockRecords ?? [])
      timeline.push({
        at: record.at,
        tone: "warning",
        label: `Hold-up: ${record.blocker}, by ${roleLabel(record.by)}`,
      });
    for (const cleared of admission.stayBlockClearances ?? [])
      timeline.push({
        at: cleared.at,
        tone: "success",
        label: `Hold-up cleared: ${cleared.blocker}, by ${roleLabel(cleared.by)}`,
      });
  }
  // Live audit item 13 (11 Nov 2026): this bed's own closures (`Unit.closedBeds`), closed and reopened,
  // with who and why. They belong to the bed, so they show with or without anyone in it.
  for (const mark of unit.closedBeds ?? []) {
    if (mark.bedNumber !== selectedBed) continue;
    timeline.push({
      at: mark.at,
      tone: "warning",
      label: `Bed closed${mark.reason ? `: ${wardClosureReasonLabel(mark.reason)}` : ""}, by ${mark.by}`,
    });
    if (mark.reopenedAt !== undefined) {
      // 16 Nov walk: name who reopened it, from the step's own log entry. The mark keeps no reopener,
      // so a reopen this session's log does not hold (or two desks in one minute) stays unnamed.
      const reopener = reopenedByRole(eventLog, unit.id, mark.reopenedAt);
      timeline.push({
        at: mark.reopenedAt,
        tone: "success",
        label: reopener ? `Bed reopened, by ${roleLabel(reopener)}` : "Bed reopened",
      });
    }
  }
  timeline.sort((left, right) => right.at - left.at);

  const openBlockerEditor = () => {
    const opening = !quickBlockerOpen;
    setBlockerOpen(opening);
    if (opening) {
      setTab("leave");
      setTimeout(() => focusChoice(blockerSelectRef.current), 0);
    }
  };
  const showDateControl = () => {
    setTab("leave");
    setTimeout(() => {
      // The kit drawer is portalled on tablet and desktop, so the phone ref is empty there.
      const scope = bedDrawerRef.current ?? document.querySelector('[data-testid="bed-telemetry-drawer"]');
      const open = scope?.querySelector<HTMLButtonElement>('[data-testid="ward-drawer-discharge-date-open"]');
      open?.scrollIntoView?.({ block: "center" });
      open?.focus();
    }, 0);
  };
  const toggleHistory = () => {
    const opening = !historyOpen;
    setHistoryOpen(opening);
    if (opening) setTimeout(() => historyRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }), 0);
  };

  const onTabKeyDown = (event: React.KeyboardEvent) => {
    const current = DRAWER_TABS.findIndex((item) => item.id === tab);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (current + 1) % DRAWER_TABS.length;
    else if (event.key === "ArrowLeft") next = (current - 1 + DRAWER_TABS.length) % DRAWER_TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = DRAWER_TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    tabRefs.current.get(next)?.focus();
    const nextTab = DRAWER_TABS.at(next);
    if (nextTab) setTab(nextTab.id);
  };

  const panel = (id: DrawerTab, children: ReactNode) => (
    <div
      role="tabpanel"
      id={`${TAB_PREFIX}-panel-${id}`}
      aria-labelledby={`${TAB_PREFIX}-tab-${id}`}
      hidden={tab !== id}
      className={styles.panel}
    >
      {children}
    </div>
  );

  // The person behind this stay, through the provider's ward-facing identity resolver (FD-23): it
  // reads no referral record, destination or history here. Missing or conflicting links stay
  // unknown, and an unknown person gets no link.
  const resolved = admission ? resolvePatientIdentity(admission) : undefined;
  const person = resolved?.patient;
  const personHref = person ? patientHref(person.id) : null;
  // Feature item 4: under 18 on an adult ward, read from the date of birth and this ward's cohort.
  // Keyed by the stay, so a typed time never carries over to the next bed (Codex, #1609).
  const under18Notice =
    !isReady && admission ? (
      <WardUnder18Notice key={admission.id} patient={person} unit={unit} admission={admission} />
    ) : null;

  // The ward board's departure check (`board/ward-board.tsx`): name · UMRN · bed, and here the destination.
  const leavingLabel = LEAVING_DESTINATIONS.find((destination) => destination.id === drawerLeavingDestination)?.label;
  const asksTransport =
    admission !== undefined &&
    transportPendingFor(admission, bedReleases) &&
    (drawerLeavingDestination === "" || leftWardAllowedFor(drawerLeavingDestination));
  const awaitingTransport =
    asksTransport && transportAnswer && transportAnswer.id === admission?.id ? transportAnswer.waiting : undefined;
  const transportQuestion = asksTransport ? (
    <div className={styles.transportRow} data-testid="ward-drawer-transport-wait">
      <span className={styles.meta}>Has their transport come?</span>
      <Segmented<"" | "waiting" | "collected">
        label="Has their transport come?"
        items={[
          { id: "waiting", label: "Still waiting" },
          { id: "collected", label: "Gone with transport" },
        ]}
        value={awaitingTransport === undefined ? "" : awaitingTransport ? "waiting" : "collected"}
        onChange={(choice) => admission && setTransportAnswer({ id: admission.id, waiting: choice === "waiting" })}
      />
    </div>
  ) : null;
  // Audit four item 17: "Going to" is said only once a destination is chosen, never "Not recorded".
  const goingTo = leavingLabel ? ` Going to ${leavingLabel}.` : "";
  const confirmDialog = (
    <Dialog
      open={confirmStep !== null && isOccupied && bedItem?.admissionId !== undefined}
      onClose={() => setConfirmStep(null)}
      size="sm"
      title={confirmStep === "ed" ? "Confirm emergency department transfer" : "Record discharge"}
      description={
        confirmStep === "ed"
          ? `Record that ${occupantAlias} has gone to an emergency department? The bed stays held while they are away.`
          : awaitingTransport
            ? `Record that ${occupantAlias} has left the ward and is waiting for transport? The bed is ready now.${goingTo}`
            : `Record that ${occupantAlias} has left the ward?${goingTo}`
      }
      secondary={[{ label: "Cancel", onAction: () => setConfirmStep(null) }]}
      primary={{
        label: confirmStep === "ed" ? "Record ED transfer" : "Record discharge",
        // Audit three #32 (D-192 item 5): until where they are going is answered here, the button
        // keeps its reason; nothing is recorded before it is pressed.
        disabledReason:
          confirmStep !== "leave"
            ? undefined
            : !drawerLeavingDestination
              ? "Choose where they are going"
              : asksTransport && awaitingTransport === undefined
                ? "Say whether their transport has come"
                : leavePaper
                  ? "Record the paper authority first, under Leaving."
                  : undefined,
        onAction: () => {
          const step = confirmStep;
          setConfirmStep(null);
          if (step === "ed") onMarkAtEd?.(selectedBed);
          else if (bedItem?.admissionId) {
            setDepartedHere(personKey ?? null);
            onRecordLeft(bedItem.admissionId, occupantAlias, drawerLeavingDestination, awaitingTransport === true);
          }
        },
      }}
      data-testid="ward-drawer-confirm"
    >
      {confirmStep === "leave" && pickInConfirm ? (
        <div data-testid="ward-drawer-confirm-destination">
          <p className={styles.meta}>Where are they going? Nothing is recorded until you press Record discharge.</p>
          <ChoiceChips
            label="Where are they going?"
            items={LEAVING_CHOICES}
            value={drawerLeavingDestination}
            onChange={setDrawerLeavingDestination}
            testId="drawer-confirm-leaving-dest"
          />
          {transportQuestion}
        </div>
      ) : null}
      {confirmStep === "leave" && outstandingChecks.length > 0 ? (
        <p className={styles.meta} role="note" data-testid="ward-drawer-confirm-checklist">
          Still outstanding: {outstandingChecks.join(", ")}. You can still record the discharge.
        </p>
      ) : null}
      <p className={styles.meta} data-testid="ward-drawer-confirm-identity">
        Check: {resolved ? patientIdentityLine(resolved) : `${occupantAlias} · ${bedItem?.umrn ?? "UMRN not recorded"}`}{" "}
        · {bedLabel}
      </p>
    </Dialog>
  );

  if (personGone) {
    const bedWords = `bed ${String(selectedBed).padStart(2, "0")}`;
    return (
      <PanelDrawer
        open
        onClose={onClose}
        title={bedLabel}
        titleId="drawer-bed-title"
        closeLabel="Close bed drawer"
        testId="bed-telemetry-drawer"
        className={styles.kitDrawer}
        bodyClassName={styles.kitBody}
        foot={
          <Button ref={goneCloseRef} variant="pri" className={styles.kitFootMain} onClick={onClose}>
            Close
          </Button>
        }
      >
        <p role="status" className={styles.goneNotice} data-testid="ward-drawer-person-gone">
          {openedFor.admissionId === undefined
            ? `Someone has been placed in ${bedWords}.`
            : `${openedFor.alias ?? "The person you opened"} is no longer in ${bedWords}.`}{" "}
          Close and reopen the bed to see who is there now.
        </p>
      </PanelDrawer>
    );
  }

  // Redesign (review notes): the steps once laid out as six buttons, in one list. `BedActions` draws
  // the filled step for this stay, one plain step and the rest under More; each does what it did.
  const hasStay = Boolean(bedItem?.admissionId);
  const bedActions: BedAction[] = [
    ...(isOccupied && hasStay && !leavingNever
      ? [
          {
            id: "leave" as const,
            label: "Record discharge",
            // A9-14: nothing is recorded as where they went until a person chooses it.
            // Audit three #32: with no destination (or transport answer) the button asks for it in
            // its confirm instead of sending the person to Leaving. The paper authority still waits.
            disabledReason:
              drawerLeavingDestination && leavePaper ? "Record the paper authority first, under Leaving." : undefined,
            // Audit four #98: on a phone the step also names the "Going to" line at the end of the body.
            describedBy:
              [
                isPhone ? "drawer-leaving-summary-phone" : null,
                criteriaDepartureNote ? "drawer-leaving-criteria" : null,
              ]
                .filter(Boolean)
                .join(" ") || undefined,
            onAction: () => {
              setPickInConfirm(!drawerLeavingDestination || (asksTransport && awaitingTransport === undefined));
              setConfirmStep("leave");
            },
          },
        ]
      : []),
    // WH1 appraisal: no leaving date yet, so the filled step opens Leaving on the date control.
    ...(dateEditor && bedItem && hasNoLeavingDate(bedItem)
      ? [{ id: "plan" as const, label: "Set leaving date", onAction: showDateControl }]
      : []),
    ...(hasStay && saveBlocker
      ? [
          {
            id: "blocker" as const,
            label: bedItem?.blockReason ? "Update hold-up" : "Record hold-up",
            expanded: quickBlockerOpen,
            onAction: openBlockerEditor,
          },
        ]
      : []),
    ...(hasStay
      ? [
          {
            id: "ed" as const,
            label: isAwayAtEd ? "Mark them back" : "Mark at an ED",
            out: isAwayAtEd,
            onAction: () => {
              if (isAwayAtEd) onMarkBack?.(selectedBed);
              else if (onMarkAtEd) setConfirmStep("ed");
            },
          },
        ]
      : []),
    ...(onMove && bedItem?.stayAdmissionId
      ? [{ id: "move" as const, label: "Move to another bed", onAction: onMove }]
      : []),
    ...(isOccupied && onRaiseReferral
      ? [
          {
            id: "referral" as const,
            label: "Raise ward referral",
            onAction: onRaiseReferral,
            testId: "ward-dossier-raise-referral-btn",
          },
        ]
      : []),
    // Audit four item 36: one entry for a ward referral. Raise ward referral already opens the full
    // form with this person filled in, so the second "Open full referral form" entry went.
  ];
  const mainId = mainActionId(bedItem, isOccupied);

  // Audit two B5: the facts and the two board tools are built once, so the phone sheet and the
  // desktop drawer show the same rows in the same order.
  // Audit two #30: the level is the hero's Observation fact; its change control sits under it, and
  // "This shift" shows only for what differs from a settled shift.
  const observationControl =
    bedItem?.observation && bedItem.admissionId ? (
      <WardObservationControl
        key={bedItem.admissionId}
        observation={bedItem.observation}
        now={now}
        showCurrent={false}
        editingToken={observationToken}
        draftKey={`observation:${bedItem.admissionId}`}
        onSave={
          onSetObservation ? (next, expected) => onSetObservation(bedItem.admissionId!, next, expected) : undefined
        }
      />
    ) : null;
  const shiftRows =
    isAwayAtEd || bedItem?.status === "incoming" || bedItem?.highAcuity ? (
      <>
        {/* WH1 appraisal: only what differs from a settled shift. On the ward and no high acuity
            request are the usual case, so they are not said. */}
        {isAwayAtEd || bedItem?.status === "incoming" ? (
          <Row label="Where">
            {/* WT-31: an incoming patient is not on the ward yet, so one location state. */}
            {isAwayAtEd
              ? `Away at an ED ${bedItem?.awayAtEdHours}h, bed held`
              : typeof bedItem?.deliveredAt === "number"
                ? "Arrived at ward, confirm arrival"
                : "Arriving"}
          </Row>
        ) : null}
        {bedItem?.highAcuity ? <Row label="High acuity">Requested</Row> : null}
      </>
    ) : null;
  const whyRows = (
    <>
      {/* WH1: the legal status and its form in full, exactly as recorded, when the hero shortens it.
          When it was admitted is under the hero's stay day. */}
      {bedItem?.legalStatusLabel && shortLegal(bedItem.legalStatusLabel) !== bedItem.legalStatusLabel ? (
        <Row label="Legal status">{bedItem.legalStatusLabel}</Row>
      ) : null}
      <Row label="Tentative diagnosis">{bedItem?.tentativeDiagnosis ?? <MissingValue reason="not_recorded" />}</Row>
    </>
  );
  const diagnosisTool =
    boardTools && isOccupied && bedItem?.admissionId ? (
      <WardBedBoardTool which="diagnosis" unit={unit} admissionId={bedItem.admissionId} tools={boardTools} />
    ) : null;
  const readyTool =
    boardTools && isOccupied && bedItem?.admissionId ? (
      <WardBedBoardTool which="ready" unit={unit} admissionId={bedItem.admissionId} tools={boardTools} />
    ) : null;
  const personRows = (
    <>
      {bedItem?.preferredName && bedItem.preferredName !== occupantAlias ? (
        <Row label="Known as">{bedItem.preferredName}</Row>
      ) : null}
      {bedItem?.umrn ? (
        <Row label="Record">
          <Umrn value={bedItem.umrn} className={styles.mono} />
        </Row>
      ) : null}
      {/* Redesign: only when it differs from the sex the head already shows. */}
      {bedItem?.gender && bedItem.gender !== bedItem.sex ? <Row label="Bed placement">{bedItem.gender}</Row> : null}
      {bedItem?.suburb || bedItem?.homeRegion ? (
        <Row label={bedItem.suburb ? "Suburb" : "Region"}>
          {[bedItem.suburb, bedItem.homeRegion].filter(Boolean).join(", ")}
        </Row>
      ) : null}
      {bedItem?.generalPractitioner ? <Row label="GP">{bedItem.generalPractitioner}</Row> : null}
      {bedItem?.catchmentCommunityTeam ? <Row label="Community team">{bedItem.catchmentCommunityTeam}</Row> : null}
    </>
  );
  const hasPersonRows = Boolean(
    (bedItem?.preferredName && bedItem.preferredName !== occupantAlias) ||
    bedItem?.umrn ||
    (bedItem?.gender && bedItem.gender !== bedItem.sex) ||
    bedItem?.suburb ||
    bedItem?.homeRegion ||
    bedItem?.generalPractitioner ||
    bedItem?.catchmentCommunityTeam,
  );

  const foot = (
    <>
      {isReady ? (
        // Audit two #7: one filled step on the right (Ready while the bed is made ready, else Place
        // someone here); Review current referrals is a quiet link on the left.
        <div className={styles.bandActions}>
          <div className={styles.bandSplit}>
            <Link className={buttonClass({ variant: "ghost", className: styles.bandLink })} href="/bedchart/referrals">
              Review current referrals
            </Link>
            {isPreparing && onMarkReady ? (
              <Button variant="pri" className={styles.pill} onClick={onMarkReady}>
                Ready
              </Button>
            ) : onOpenBoard && !isPreparing ? (
              <Button variant="pri" className={styles.pill} onClick={onOpenBoard}>
                Place someone here
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {isOccupied && bedItem?.admissionId ? (
            <>
              {criteriaDepartureNote ? (
                <p
                  className={styles.footCriteria}
                  id="drawer-leaving-criteria"
                  data-testid="ward-drawer-leaving-criteria"
                >
                  {criteriaDepartureNote}
                </p>
              ) : null}
            </>
          ) : null}
          {/* Audit four #31: Patient page leaves the body for the foot's second line, a quiet link.
              WT-15: it does not close the drawer first; closing steps history back and cancelled the navigation. */}
          <BedActions
            band
            actions={bedActions}
            mainId={mainId}
            link={
              personHref ? (
                // Gate r10 (2 FIX 8): the kit secondary button with the person glyph, as the referral
                // drawer foot draws the same destination, one size with its neighbours.
                <Link className={buttonClass({ variant: "sec", size: "md", className: styles.pill })} href={personHref}>
                  <UserRound size={14} aria-hidden="true" />
                  Patient page
                </Link>
              ) : undefined
            }
          />
          {roleLockNote}
        </>
      )}
      <BedClosureControls {...bedClosure} />
    </>
  );

  // Drawer review (6 Nov 2026): the record opens in the kit PanelDrawer, as Transport, Discharges
  // and the bed board do. Head: the person (or the bed's state), one quiet line, and the bed as the
  // status tag. Foot: the light kit band, one filled step then equal quiet ones.
  // Audit four #31: the bed pager is the kit pager in the head ("3 of 12"), not a row in the body.
  const pager =
    onPrevBed && onNextBed && bedPosition && bedPosition.total > 1
      ? {
          index: bedPosition.index,
          total: bedPosition.total,
          noun: "bed",
          onStep: (delta: -1 | 1) => (delta < 0 ? onPrevBed() : onNextBed()),
        }
      : undefined;

  // Audit four #98: the phone opens the same kit PanelDrawer as tablet and desktop, with the same
  // head and foot; the kit Sheet owns focus, Escape and the return of focus at every width. The
  // bed pill and the phone's status chip lead the head's second line.
  if (isPhone) {
    return (
      <>
        <PanelDrawer
          open
          onClose={onClose}
          title={isReady ? readyWord : closedEmpty ? "Closed bed" : occupantAlias}
          titleId="drawer-bed-title"
          subtitle={subline}
          tag={
            <>
              <StatusPill tone={tone ?? undefined}>{bedLabel}</StatusPill>
              {isReady ? null : <PhoneBedChip tone={tone} />}
            </>
          }
          tagBelow
          closeLabel="Close bed drawer"
          pager={pager}
          testId="bed-telemetry-drawer"
          className={styles.kitDrawer}
          bodyClassName={styles.phoneBody}
          foot={foot}
        >
          <PhoneBedSheet
            bedItem={bedItem}
            isReady={isReady}
            closedEmpty={closedEmpty}
            isOccupied={isOccupied}
            stayDay={stayDays === null ? null : stayDayNumber(admission, now)}
            expectedPlan={
              <>
                {expectedValue}
                {dateEditor}
              </>
            }
            timeline={timeline}
            now={now}
            quickBlockerOpen={quickBlockerOpen}
            selectedBlocker={selectedBlocker}
            setSelectedBlocker={setSelectedBlocker}
            blockerSelectRef={blockerSelectRef}
            drawerLeavingDestination={drawerLeavingDestination}
            setDrawerLeavingDestination={setDrawerLeavingDestination}
            leavePaper={
              transportQuestion || leavePaper ? (
                <>
                  {transportQuestion}
                  {leavePaper}
                </>
              ) : null
            }
            blockerSave={blockerSave}
            onSetObservation={onSetObservation}
            observationToken={observationToken}
            planRows={holdUpRow}
            planNote={
              prepNote || barrierEditor ? (
                <>
                  {prepNote}
                  {barrierEditor}
                </>
              ) : null
            }
            planCriteria={
              criteriaCard || checklistCard ? (
                <>
                  {criteriaCard}
                  {checklistCard}
                </>
              ) : null
            }
            sentJourney={sentJourneyControls}
            readyNote={readyNote}
            safetyNote={under18Notice}
            notLeftPlan={expectedPlan}
            goingOut={goingOut}
            observationShort={observationShort}
            observationControl={observationControl}
            shiftRows={shiftRows}
            whyRows={whyRows}
            diagnosisTool={diagnosisTool}
            personRows={hasPersonRows ? personRows : null}
            confirmation={confirmation}
            dateMoves={dateMoves}
            readyTool={readyTool}
          />
        </PanelDrawer>
        {confirmDialog}
      </>
    );
  }

  // WH1 (Josh, 3 Nov 2026): a hero head in the Capacity drawer's style. One large figure (the stay
  // day), a soft pill for where the stay is, the three facts a nurse checks first, the reason they
  // have not left, and the plan to leave as recorded steps.
  const status = isOccupied ? stayStatus(bedItem, expectedPlan) : null;
  const stayDay = stayDays === null ? null : stayDayNumber(admission, now);
  const stayFigure = stayDay === null ? "Not recorded" : `Day ${stayDay}`;
  const stepNow =
    admission?.state === "occupied"
      ? bedItem?.dischargeConfirmed === true
        ? 2
        : admission.expectedDischargeAt != null
          ? 1
          : 0
      : null;
  const hero = (
    <section className={styles.hero} aria-label="This stay" data-testid="bed-record-hero">
      <div className={styles.heroTop}>
        <span className={styles.heroWhen}>
          <span className={styles.heroFigure} title={stayFigure}>
            {stayFigure}
          </span>
          <span className={styles.heroSub}>
            {admittedAt != null ? `Admitted ${formatInstantWithDay(admittedAt, now)}` : "Stay day"}
          </span>
        </span>
        {status ? (
          <span className={styles.heroPill} data-tone={status.tone}>
            {status.word}
          </span>
        ) : null}
      </div>
      {status ? (
        <p className={styles.heroWhy} data-testid="bed-record-not-left">
          <StatusGlyph tone={status.tone} />
          <span>{status.text}</span>
        </p>
      ) : null}
      <dl className={styles.heroFacts}>
        <div>
          <dt>Legal</dt>
          <dd title={bedItem?.legalStatusLabel}>{shortLegal(bedItem?.legalStatusLabel)}</dd>
        </div>
        <div>
          <dt>Going out</dt>
          <dd>
            {/* Red is act now only (DESIGN-SYSTEM): a past date is amber, as on the bed tile. */}
            {bedItem?.pastDate ? <StatusGlyph tone="warning" /> : null}
            {goingOut}
          </dd>
        </div>
        <div>
          <dt>Observation</dt>
          <dd title={observation !== observationShort ? observation : undefined}>{observationShort}</dd>
        </div>
      </dl>
      {observationControl}
    </section>
  );
  const historyToggle = (
    <button
      type="button"
      className={styles.historyButton}
      aria-expanded={historyOpen}
      aria-controls={`${TAB_PREFIX}-history`}
      data-testid="bed-drawer-history-toggle"
      onClick={toggleHistory}
    >
      <Icon icon={HistoryIcon} size={14} />
      History
      <span className={styles.historyCount}>{timeline.length}</span>
    </button>
  );
  const history = (
    <section
      ref={historyRef}
      id={`${TAB_PREFIX}-history`}
      className={styles.card}
      aria-labelledby={`${TAB_PREFIX}-history-title`}
      hidden={!historyOpen}
    >
      <h3 className={styles.cardTitle} id={`${TAB_PREFIX}-history-title`}>
        History
      </h3>
      {timeline.length > 0 ? (
        <ul className={styles.timeline}>
          {timeline.map((event) => (
            <li key={`${event.label}-${event.at}`}>
              <StatusGlyph tone={event.tone} />
              <span className={styles.timelineAt}>{formatInstantWithDay(event.at, now)}</span>
              <span className={styles.ell}>{event.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Nothing recorded for this stay yet.</p>
      )}
    </section>
  );

  return (
    <>
      <PanelDrawer
        open
        onClose={onClose}
        title={isReady ? readyWord : closedEmpty ? "Closed bed" : occupantAlias}
        titleId="drawer-bed-title"
        subtitle={subline}
        tag={<StatusPill tone={tone ?? undefined}>{bedLabel}</StatusPill>}
        closeLabel="Close bed drawer"
        pager={pager}
        testId="bed-telemetry-drawer"
        className={styles.kitDrawer}
        bodyClassName={styles.kitBody}
        foot={foot}
      >
        {isReady || closedEmpty ? (
          <>
            <section className={styles.hero} aria-label="This bed" data-testid="bed-record-hero">
              <div className={styles.heroTop}>
                <span className={styles.heroWhen}>
                  <span className={styles.heroFigure}>
                    {closedEmpty ? "Closed" : isPreparing ? BED_STATE_LABELS.beingMadeReady : "Ready"}
                  </span>
                  <span className={styles.heroSub}>
                    {closedEmpty?.state ?? (bedItem?.designation ? `${bedItem.designation} bed` : "Empty bed")}
                  </span>
                </span>
                <span className={styles.heroPill} data-tone={closedEmpty || isPreparing ? "neutral" : "success"}>
                  {closedEmpty ? "Not offered" : isPreparing ? "Not offered yet" : "Offered"}
                </span>
              </div>
              {/* Audit two B4: a ready bed says who it is pulled for only when someone is, from the
                  same field the phone reads; no fixed "Nobody" or "None recorded" cells. */}
              {closedEmpty || bedItem?.heldFor ? (
                <dl className={styles.heroFacts}>
                  {closedEmpty ? (
                    <div data-testid="ward-drawer-closed-reason">
                      <dt>Reason</dt>
                      <dd>{closedEmpty.reason}</dd>
                    </div>
                  ) : (
                    <div>
                      <dt>Pulled for</dt>
                      <dd>{bedItem?.heldFor}</dd>
                    </div>
                  )}
                </dl>
              ) : null}
              {readyNote}
            </section>
            {/* Live audit item 13: an empty bed's History holds its closures, so it shows when there are any. */}
            {timeline.length > 0 ? (
              <>
                {historyToggle}
                {history}
              </>
            ) : null}
          </>
        ) : (
          <>
            {hero}
            {under18Notice}
            <div className={styles.tabsWrap}>
              {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tab stop: arrow keys bubble up from the focused tab, option or item */}
              <div role="tablist" aria-label="Bed details" className={styles.tabs} onKeyDown={onTabKeyDown}>
                {DRAWER_TABS.map((item, index) => {
                  const selected = item.id === tab;
                  return (
                    <button
                      key={item.id}
                      ref={(node) => {
                        tabRefs.current.set(index, node);
                      }}
                      type="button"
                      role="tab"
                      id={`${TAB_PREFIX}-tab-${item.id}`}
                      aria-controls={`${TAB_PREFIX}-panel-${item.id}`}
                      aria-selected={selected}
                      tabIndex={selected ? 0 : -1}
                      className={cx(styles.tab, selected && styles.tabOn)}
                      onClick={() => {
                        setTab(item.id);
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              {historyToggle}
            </div>
            {panel(
              "now",
              <>
                {shiftRows ? (
                  <Section title="This shift">
                    <dl className={styles.kv}>{shiftRows}</dl>
                  </Section>
                ) : null}
                <Section title="Why they are here">
                  <dl className={styles.kv}>{whyRows}</dl>
                  {diagnosisTool}
                </Section>
                {hasPersonRows ? (
                  <Section title="This person">
                    <dl className={styles.kv}>{personRows}</dl>
                  </Section>
                ) : null}
              </>,
            )}
            {panel(
              "leave",
              <>
                <Section title="Plan to leave">
                  {stepNow !== null ? (
                    <div className={styles.cardInner}>
                      <StaySteps steps={STAY_STEPS} current={stepNow} />
                    </div>
                  ) : null}
                  <dl className={styles.kv}>
                    <Row label="Expected">
                      {expectedValue}
                      {dateEditor}
                    </Row>
                    <Row label="Confirmed">{confirmation}</Row>
                    {dateMoves ? <Row label="Date moves">{dateMoves}</Row> : null}
                    {holdUpRow}
                  </dl>
                  {prepNote ? <div className={styles.cardInner}>{prepNote}</div> : null}
                  {barrierEditor ? <div className={styles.cardInner}>{barrierEditor}</div> : null}
                  {readyTool}
                  <BlockerEditor
                    save={blockerSave}
                    blockReason={bedItem?.blockReason}
                    open={quickBlockerOpen}
                    selected={selectedBlocker}
                    setSelected={setSelectedBlocker}
                    selectRef={blockerSelectRef}
                  />
                </Section>
                {isOccupied && bedItem?.admissionId ? (
                  <Section title="Going to">
                    <div className={styles.cardInner}>
                      {/* WH1 (Josh, 3 Nov 2026): kit chips in place of the browser drop-down. */}
                      <ChoiceChips
                        label="Where are they going?"
                        items={
                          allDestinations
                            ? LEAVING_CHOICES
                            : LEAVING_CHOICES.filter(
                                (choice, index) =>
                                  index < COMMON_DESTINATIONS || choice.id === drawerLeavingDestination,
                              )
                        }
                        value={drawerLeavingDestination}
                        onChange={setDrawerLeavingDestination}
                        testId="drawer-leaving-dest"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className={styles.quiet}
                        aria-expanded={allDestinations}
                        onClick={() => setAllDestinations((all) => !all)}
                      >
                        {allDestinations ? "Show fewer" : `Show all ${LEAVING_CHOICES.length}`}
                      </Button>
                      {bedItem.catchmentCommunityTeam ? (
                        <p className={styles.meta}>
                          <Icon icon={MapPin} size={14} />
                          <span className={styles.ell}>
                            Community team{bedItem.suburb ? ` for ${bedItem.suburb}` : ""}:{" "}
                            {bedItem.catchmentCommunityTeam}
                          </span>
                        </p>
                      ) : null}
                      {transportQuestion}
                      {leavePaper}
                    </div>
                  </Section>
                ) : null}
                {criteriaCard}
                {checklistCard}
                {sentJourneyControls ? (
                  <Section title="Movement this ward sent">
                    <div className={styles.cardInner}>{sentJourneyControls}</div>
                  </Section>
                ) : null}
              </>,
            )}
            {history}
          </>
        )}
      </PanelDrawer>
      {confirmDialog}
    </>
  );
}
