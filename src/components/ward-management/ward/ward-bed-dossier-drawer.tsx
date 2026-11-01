"use client";

import type { WardCommandDispatch } from "../ward-shared-client";

import React, { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import styles from "./ward-bed-dossier-drawer.module.css";
import type { Unit } from "@/components/ward-management/ward-model";
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
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";
import { BlockerEditor, useBlockerSave } from "./ward-bed-blocker-editor";
import { BedClosureControls, type BedClosureActions } from "./ward-bed-closure-controls";
import {
  openJourneyFromStay,
  SentJourneyChanges,
  useStayJourneyIsMine,
} from "@/components/ward-management/movements/sent-journey-changes";
import { WardDischargeCriteriaCard, type DischargeCriteriaUpdate } from "./ward-discharge-criteria-card";
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
  StatusGlyph,
  buttonClass,
  cx,
  durMinutes,
  useIsPhone,
  type WfTone,
} from "@/components/wf";
import {
  observationLevelName,
  observationRatio,
  type Observation,
} from "@/components/ward-management/ward-observation";
import { WardObservationControl, observationWithReview } from "./ward-observation-control";
import { WardLeavePaperAuthority, useLeaveNeedsPaperAuthority } from "./ward-leave-paper-authority";
import {
  BedActions,
  FactTile,
  NotLeftNotice,
  Row,
  mainActionId,
  shortLegal,
  type BedAction,
} from "./ward-bed-dossier-bits";
import { PhoneBedSheet } from "./ward-bed-dossier-phone";
import { WardDrawerDischargeDate } from "./ward-drawer-discharge-date";
import { observationEditingToken } from "@/components/ward-management/ward-flow-observation-events";

interface WardBedDossierDrawerProps {
  selectedBed: number;
  bedItem: BedItem | undefined;
  unit: Unit;
  onClose: () => void;
  drawerLeavingDestination: LeavingDestination;
  setDrawerLeavingDestination: (dest: LeavingDestination) => void;
  onRecordLeft: (admissionId: string, who: string, destination: LeavingDestination) => void;
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
  bedDrawerRef: React.RefObject<HTMLElement | null>;
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
}

type DrawerTab = "over" | "plan" | "time";
type TabButtons = Map<number, HTMLButtonElement | null>;
const DRAWER_TABS: { id: DrawerTab; label: string }[] = [
  { id: "over", label: "Overview" },
  { id: "plan", label: "Plan to leave" },
  { id: "time", label: "Timeline" },
];
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
  bedDrawerRef,
  onKeyDown,
  onRaiseReferral,
  fullReferralHref,
  roleLockNote,
  onSetBarrier,
  criteriaEligibility,
  onSetCriteria,
}: WardBedDossierDrawerProps) {
  const { admissions, bedReleases, resolvePatientIdentity, movements } = useWardFlowSelect(
    "admissions",
    "bedReleases",
    "resolvePatientIdentity",
    "movements",
  );
  const now = useWardFlowClock();
  const [tab, setTab] = useState<DrawerTab>("over");
  const [quickBlockerOpen, setQuickBlockerOpen] = useState(false);
  const [selectedBlocker, setSelectedBlocker] = useState<BedReleaseBlocker | "">(recordedBlocker(bedItem?.blockReason));
  const [shownBed, setShownBed] = useState(selectedBed);
  // Audit 1, Josh 20 Oct (CS-07): leaving and going to an ED each ask once before they are recorded.
  const [confirmStep, setConfirmStep] = useState<"leave" | "ed" | null>(null);
  const tabRefs = useRef<TabButtons>(new Map());
  const isPhone = useIsPhone();
  const blockerSelectRef = useRef<HTMLSelectElement | null>(null);
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

  useWardModalFocus(true, bedDrawerRef, onClose);
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
  const isAwayAtEd = bedItem?.awayAtEdHours !== null && bedItem?.awayAtEdHours !== undefined;
  const admission = bedItem?.admissionId ? admissions.find((a) => a.id === bedItem.admissionId) : undefined;
  // Both layouts send the same token, so a colleague's level change made while the form is open is refused.
  const observationChanges = admission?.observationChanges?.length ?? 0;
  const observationToken =
    admission && observationEditingToken("admission", admission.id, admission.observation, observationChanges);
  const leavePaper =
    useLeaveNeedsPaperAuthority(admission, drawerLeavingDestination) && admission ? (
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
  const subline = isReady
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
  const eddMoved = eddMovedBadge(bedItem?.dischargeDateMoves);
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
    admission?.state === "occupied" ? (
      <WardDrawerDischargeDate
        key={admission.id}
        admissionId={admission.id}
        unitId={unit.id}
        recordedAt={admission.expectedDischargeAt ?? null}
      />
    ) : null;

  const dateMoves =
    typeof bedItem?.dischargeDateMoves === "number"
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
  // blocker is one choice, not two dropdowns. Its dropdown comes back when the blocker form closes.
  const barrierSelect =
    admission && bedItem?.admissionId && onSetBarrier && stayDays !== null && !quickBlockerOpen ? (
      <select
        className={styles.select}
        aria-label="Discharge barrier"
        data-testid="ward-drawer-barrier-select"
        value={admission.dischargeBarrier ?? "None"}
        onChange={(e) => onSetBarrier(admission.id, isDischargeBarrier(e.target.value) ? e.target.value : null)}
      >
        <option value="None">None recorded</option>
        {DISCHARGE_BARRIERS.map((barrier) => (
          <option key={barrier} value={barrier}>
            {barrier}
          </option>
        ))}
      </select>
    ) : null;
  const barrierValue =
    barrierSelect ?? (admission && bedItem?.admissionId ? (admission.dischargeBarrier ?? "None recorded") : null);
  // Finding 61 (Josh, 27 Oct 2026): blocker (today) and barrier (long-stay reason) under one label.
  const holdUpRow = (
    <Row label="What is holding them up">
      <div data-testid="ward-drawer-hold-up-today">Today: {bedItem?.blockReason ?? "None recorded"}</div>
      {(barrierValue ?? bedItem?.dischargeBarrier) ? (
        <div data-testid="ward-drawer-hold-up-long-stay">
          Long-stay reason: {barrierValue ?? bedItem?.dischargeBarrier}
        </div>
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
      Due out within {prepHours} hours. Record any discharge barrier now.
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
    timeline.sort((left, right) => right.at - left.at);
  }

  const openBlockerEditor = () => {
    const opening = !quickBlockerOpen;
    setBlockerOpen(opening);
    if (opening) {
      setTab("plan");
      setTimeout(() => blockerSelectRef.current?.focus(), 0);
    }
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

  // The ward board's departure check (`board/ward-board.tsx`): name · UMRN · bed, and here the destination.
  const leavingLabel = LEAVING_DESTINATIONS.find((destination) => destination.id === drawerLeavingDestination)?.label;
  const confirmDialog = (
    <Dialog
      open={confirmStep !== null && isOccupied && bedItem?.admissionId !== undefined}
      onClose={() => setConfirmStep(null)}
      size="sm"
      title={confirmStep === "ed" ? "Confirm emergency department transfer" : "Confirm patient departure"}
      description={
        confirmStep === "ed"
          ? `Record that ${occupantAlias} has gone to an emergency department? The bed stays held while they are away.`
          : `Record that ${occupantAlias} has left the ward? Going to ${leavingLabel ?? "Not recorded"}.`
      }
      secondary={[{ label: "Cancel", onAction: () => setConfirmStep(null) }]}
      primary={{
        label: confirmStep === "ed" ? "Record ED transfer" : "Record departure",
        onAction: () => {
          const step = confirmStep;
          setConfirmStep(null);
          if (step === "ed") onMarkAtEd?.(selectedBed);
          else if (bedItem?.admissionId) {
            setDepartedHere(personKey ?? null);
            onRecordLeft(bedItem.admissionId, occupantAlias, drawerLeavingDestination);
          }
        },
      }}
      data-testid="ward-drawer-confirm"
    >
      <p className={styles.meta} data-testid="ward-drawer-confirm-identity">
        Check: {resolved ? patientIdentityLine(resolved) : `${occupantAlias} · ${bedItem?.umrn ?? "UMRN not recorded"}`}{" "}
        · {bedLabel}
      </p>
    </Dialog>
  );

  if (personGone) {
    const bedWords = `bed ${String(selectedBed).padStart(2, "0")}`;
    return (
      <>
        <div className={`${styles.drawerScrim} ${styles.show}`} onClick={onClose} aria-hidden="true" />
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- catches Escape bubbling up from the Close button */}
        <aside
          ref={bedDrawerRef}
          className={`${styles.drawer} ${styles.show}`}
          data-testid="bed-telemetry-drawer"
          aria-labelledby="drawer-bed-title"
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          onKeyDown={(event) => {
            onKeyDown(event);
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          <div className={styles.grab} aria-hidden="true" />
          <header className={styles.drawerHead}>
            <div className={styles.drawerHeading}>
              <h2 id="drawer-bed-title" className={styles.drawerTitle}>
                {bedLabel}
              </h2>
            </div>
          </header>
          <div className={styles.drawerBody}>
            <p role="status" className={cx(styles.card, styles.goneNotice)} data-testid="ward-drawer-person-gone">
              {openedFor.admissionId === undefined
                ? `Someone has been placed in ${bedWords}.`
                : `${openedFor.alias ?? "The person you opened"} is no longer in ${bedWords}.`}{" "}
              Close and reopen the bed to see who is there now.
            </p>
          </div>
          <footer className={styles.drawerFoot}>
            <Button ref={goneCloseRef} variant="pri" size="lg" className={styles.pill} onClick={onClose}>
              Close
            </Button>
          </footer>
        </aside>
      </>
    );
  }

  // Redesign (review notes): the steps once laid out as six buttons, in one list. `BedActions` draws
  // the filled step for this stay, one plain step and the rest under More; each does what it did.
  const hasStay = Boolean(bedItem?.admissionId);
  const bedActions: BedAction[] = [
    ...(isOccupied && hasStay
      ? [
          {
            id: "leave" as const,
            label: "Record that they have left",
            disabledReason: leavePaper ? "Record the paper authority first." : undefined,
            describedBy: criteriaDepartureNote
              ? "drawer-leaving-summary drawer-leaving-criteria"
              : "drawer-leaving-summary",
            onAction: () => setConfirmStep("leave"),
          },
        ]
      : []),
    ...(hasStay && saveBlocker
      ? [
          {
            id: "blocker" as const,
            label: bedItem?.blockReason ? "Update blocker" : "Record blocker",
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
    ...(isOccupied && fullReferralHref
      ? [
          {
            id: "full-referral" as const,
            label: "Open full referral form…",
            href: fullReferralHref,
            testId: "ward-dossier-full-referral-link",
          },
        ]
      : []),
  ];
  const mainId = mainActionId(bedItem, isOccupied);

  if (isPhone) {
    return (
      <>
        <PhoneBedSheet
          bedLabel={bedLabel}
          bedItem={bedItem}
          isReady={isReady}
          occupantAlias={occupantAlias}
          isOccupied={isOccupied}
          isAwayAtEd={isAwayAtEd}
          tone={tone}
          stayDays={stayDays}
          observation={observation}
          expectedPlan={
            <>
              {expectedValue}
              {dateEditor}
            </>
          }
          timeline={timeline}
          now={now}
          personHref={personHref}
          selectedBed={selectedBed}
          quickBlockerOpen={quickBlockerOpen}
          setQuickBlockerOpen={setBlockerOpen}
          selectedBlocker={selectedBlocker}
          setSelectedBlocker={setSelectedBlocker}
          blockerSelectRef={blockerSelectRef}
          drawerLeavingDestination={drawerLeavingDestination}
          setDrawerLeavingDestination={setDrawerLeavingDestination}
          onClose={onClose}
          onRecordLeft={() => setConfirmStep("leave")}
          leavePaper={leavePaper}
          blockerSave={blockerSave}
          onSetObservation={onSetObservation}
          observationToken={observationToken}
          onMarkAtEd={onMarkAtEd ? () => setConfirmStep("ed") : undefined}
          onMarkBack={onMarkBack}
          onMove={onMove}
          onOpenBoard={onOpenBoard}
          onMarkReady={isPreparing ? onMarkReady : undefined}
          onRaiseReferral={onRaiseReferral}
          fullReferralHref={fullReferralHref}
          roleLockNote={<BedClosureControls {...bedClosure}>{roleLockNote}</BedClosureControls>}
          bedDrawerRef={bedDrawerRef}
          onKeyDown={onKeyDown}
          planRows={holdUpRow}
          planNote={prepNote}
          planCriteria={criteriaCard}
          sentJourney={sentJourneyControls}
          leavingCriteriaNote={criteriaDepartureNote}
          readyNote={readyNote}
          actions={bedActions}
          mainId={mainId}
          notLeftPlan={expectedPlan}
          goingOut={goingOut}
          observationShort={observationShort}
        />
        {confirmDialog}
      </>
    );
  }

  return (
    <>
      <div className={`${styles.drawerScrim} ${styles.show}`} onClick={onClose} aria-hidden="true" />
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- catches Escape or arrow keys bubbling up from the focused control inside */}
      <aside
        ref={bedDrawerRef}
        className={`${styles.drawer} ${styles.show}`}
        data-testid="bed-telemetry-drawer"
        aria-labelledby="drawer-bed-title"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Escape" && event.target instanceof HTMLElement && event.target.tagName === "SELECT") {
            return;
          }
          onKeyDown(event);
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <div className={styles.grab} aria-hidden="true" />
        <header className={styles.drawerHead}>
          <span className={cx(styles.drawerBedBadge, isReady && styles.drawerBedBadgeReady)}>
            {tone ? <StatusGlyph tone={tone} /> : null}
            {bedLabel}
          </span>
          <div className={styles.drawerHeading}>
            <h2 id="drawer-bed-title" className={styles.drawerTitle}>
              {isReady ? readyWord : occupantAlias}
            </h2>
            <p className={styles.drawerKicker}>{subline}</p>
            {/* WT-15: these links do not close the drawer first; closing steps history back and cancelled the navigation. */}
            {personHref ? (
              <Link className={styles.headPatient} href={personHref}>
                Patient page
                <Icon icon={ChevronRight} size={14} />
              </Link>
            ) : null}
          </div>
          {onPrevBed ? (
            <Button
              variant="ghost"
              iconOnly
              icon={ChevronLeft}
              aria-label="Previous bed"
              className={styles.pill}
              onClick={onPrevBed}
            />
          ) : null}
          {onNextBed ? (
            <Button
              variant="ghost"
              iconOnly
              icon={ChevronRight}
              aria-label="Next bed"
              className={styles.pill}
              onClick={onNextBed}
            />
          ) : null}
          {/* H-0097: the drawer opens on Close, not on "Previous bed". */}
          <Button
            variant="ghost"
            iconOnly
            icon={X}
            aria-label="Close bed drawer"
            className={styles.pill}
            onClick={onClose}
            data-sheet-autofocus="true"
          />
        </header>

        {isReady ? (
          <>
            <div className={styles.facts}>
              <FactTile
                label="State"
                value={isPreparing ? BED_STATE_LABELS.beingMadeReady : "Ready"}
                tone={isPreparing ? "neutral" : "success"}
              />
              <FactTile label="Pulled for" value="No one" />
              {bedItem.designation ? <FactTile label="Bed" value={bedItem.designation} /> : null}
            </div>
            <div className={styles.drawerBody}>
              <Section title="Placement review">
                <dl className={styles.kv}>
                  <Row label="Candidate">None recorded.</Row>
                </dl>
                {readyNote}
              </Section>
            </div>
          </>
        ) : (
          <>
            <div className={styles.facts}>
              <FactTile label="Stay" value={stayDays === null ? "Not recorded" : `Day ${stayDayNumber(stayDays)}`} />
              <FactTile label="Legal" value={shortLegal(bedItem?.legalStatusLabel)} />
              <FactTile label="Going out" value={goingOut} tone={bedItem?.pastDate ? "danger" : null} />
              <FactTile label="Observation" value={observationShort} />
            </div>
            <NotLeftNotice bedItem={bedItem} expectedPlan={expectedPlan} isOccupied={isOccupied} />
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
            </div>
            <div className={styles.drawerBody}>
              {panel(
                "over",
                <>
                  <Section title="This person">
                    <dl className={styles.kv}>
                      {bedItem?.preferredName && bedItem.preferredName !== occupantAlias ? (
                        <Row label="Known as">{bedItem.preferredName}</Row>
                      ) : null}
                      {bedItem?.umrn ? (
                        <Row label="Record">
                          <span className={styles.mono}>{bedItem.umrn}</span>
                        </Row>
                      ) : null}
                      {/* Redesign: only when it differs from the sex the head already shows. */}
                      {bedItem?.gender && bedItem.gender !== bedItem.sex ? (
                        <Row label="Bed placement">{bedItem.gender}</Row>
                      ) : null}
                      {bedItem?.suburb || bedItem?.homeRegion ? (
                        <Row label={bedItem.suburb ? "Suburb" : "Region"}>
                          {[bedItem.suburb, bedItem.homeRegion].filter(Boolean).join(", ")}
                        </Row>
                      ) : null}
                      {bedItem?.generalPractitioner ? <Row label="GP">{bedItem.generalPractitioner}</Row> : null}
                      {bedItem?.catchmentCommunityTeam ? (
                        <Row label="Community team">{bedItem.catchmentCommunityTeam}</Row>
                      ) : null}
                    </dl>
                  </Section>
                  <Section title="Why they are here">
                    <dl className={styles.kv}>
                      <Row label="Tentative diagnosis">{bedItem?.tentativeDiagnosis ?? "None recorded"}</Row>
                      <Row label="Admitted">
                        {/* Redesign: the stay length is the Stay tile; this row gives when. */}
                        {admittedAt != null ? formatInstantWithDay(admittedAt, now) : "Not recorded"}
                      </Row>
                      {/* Redesign: only when the Legal tile shortens it ("Form 6A", "CTO"). */}
                      {bedItem?.legalStatusLabel &&
                      shortLegal(bedItem.legalStatusLabel) !== bedItem.legalStatusLabel ? (
                        <Row label="Legal status">{bedItem.legalStatusLabel}</Row>
                      ) : null}
                    </dl>
                  </Section>
                  <Section title="This shift">
                    <dl className={styles.kv}>
                      <Row label="Where">
                        {/* WT-31: an incoming patient is not on the ward yet, so one location state. */}
                        {isAwayAtEd
                          ? `Away at an ED ${bedItem.awayAtEdHours}h, bed held`
                          : bedItem?.status === "incoming"
                            ? typeof bedItem?.deliveredAt === "number"
                              ? "Arrived at ward, confirm arrival"
                              : "Arriving"
                            : "On the ward"}
                      </Row>
                      <Row label="Observation level">{observation}</Row>
                      <Row label="High acuity">{bedItem?.highAcuity ? "Requested" : "Not requested"}</Row>
                    </dl>
                    {bedItem?.observation && bedItem.admissionId ? (
                      <WardObservationControl
                        key={bedItem.admissionId}
                        observation={bedItem.observation}
                        now={now}
                        showCurrent={false}
                        editingToken={observationToken}
                        onSave={
                          onSetObservation
                            ? (next, expected) => onSetObservation(bedItem.admissionId!, next, expected)
                            : undefined
                        }
                      />
                    ) : null}
                  </Section>
                </>,
              )}
              {panel(
                "plan",
                <>
                  <Section title="Plan to leave">
                    <dl className={styles.kv}>
                      <Row label="Expected">
                        {expectedValue}
                        {dateEditor}
                      </Row>
                      <Row label="Confirmed">{confirmation}</Row>
                      {dateMoves ? <Row label="Date moves">{dateMoves}</Row> : null}
                      {holdUpRow}
                    </dl>
                    {prepNote}
                    <BlockerEditor
                      save={blockerSave}
                      blockReason={bedItem?.blockReason}
                      open={quickBlockerOpen}
                      selected={selectedBlocker}
                      setSelected={setSelectedBlocker}
                      selectRef={blockerSelectRef}
                    />
                  </Section>
                  {criteriaCard}
                  {sentJourneyControls ? (
                    <Section title="Journey this ward sent">
                      <div className={styles.cardInner}>{sentJourneyControls}</div>
                    </Section>
                  ) : null}
                  {isOccupied && bedItem?.admissionId ? (
                    <Section title="Going to">
                      <div className={styles.cardInner}>
                        <select
                          id="drawer-leaving-dest"
                          aria-label="Where are they going?"
                          className={styles.select}
                          value={drawerLeavingDestination}
                          onChange={(e) => {
                            setDrawerLeavingDestination(e.target.value as LeavingDestination);
                          }}
                        >
                          {LEAVING_DESTINATIONS.map((destination) => (
                            <option key={destination.id} value={destination.id}>
                              {destination.label}
                            </option>
                          ))}
                        </select>
                        {bedItem.catchmentCommunityTeam ? (
                          <p className={styles.meta}>
                            <Icon icon={MapPin} size={14} />
                            <span className={styles.ell}>
                              Community team{bedItem.suburb ? ` for ${bedItem.suburb}` : ""}:{" "}
                              {bedItem.catchmentCommunityTeam}
                            </span>
                          </p>
                        ) : null}
                      </div>
                    </Section>
                  ) : null}
                </>,
              )}
              {panel(
                "time",
                <Section title="Timeline">
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
                </Section>,
              )}
            </div>
          </>
        )}

        <footer className={styles.drawerFoot}>
          {isReady ? (
            <>
              {isPreparing && onMarkReady ? (
                <Button variant="pri" size="lg" className={styles.pill} onClick={onMarkReady}>
                  Ready
                </Button>
              ) : null}
              <Link
                className={buttonClass({
                  variant: isPreparing && onMarkReady ? "sec" : "pri",
                  size: "lg",
                  className: styles.pill,
                })}
                href="/ward-flow/referrals"
              >
                Review current referrals
              </Link>
              {onOpenBoard && !isPreparing ? (
                <Button variant="sec" size="lg" className={styles.pill} onClick={onOpenBoard}>
                  Place someone here
                </Button>
              ) : null}
            </>
          ) : (
            <>
              {isOccupied && bedItem?.admissionId ? (
                <>
                  {/* The destination is chosen on Plan to leave, so the footer always says which one
                      "Record that they have left" will record. */}
                  <p className={styles.footDestination} id="drawer-leaving-summary">
                    Going to{" "}
                    <strong>
                      {LEAVING_DESTINATIONS.find((destination) => destination.id === drawerLeavingDestination)?.label}
                    </strong>
                    {tab !== "plan" ? (
                      <button
                        type="button"
                        className={styles.footChange}
                        onClick={() => {
                          setTab("plan");
                        }}
                      >
                        Change
                      </button>
                    ) : null}
                  </p>
                  {criteriaDepartureNote ? (
                    <p
                      className={styles.footCriteria}
                      id="drawer-leaving-criteria"
                      data-testid="ward-drawer-leaving-criteria"
                    >
                      {criteriaDepartureNote}
                    </p>
                  ) : null}
                  {leavePaper}
                </>
              ) : null}
              <BedActions actions={bedActions} mainId={mainId} />
              {roleLockNote}
            </>
          )}
          <BedClosureControls {...bedClosure} size="lg" />
        </footer>
      </aside>
      {confirmDialog}
    </>
  );
}
