"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { useUndoableStep } from "@/components/ward-management/use-undoable-step";

import { Copy } from "lucide-react";
import {
  Button,
  CheckingFoot,
  Hero,
  HeroStat,
  LiveChip,
  OccupancyRing,
  Segmented,
  Sheet,
  buttonClass,
  useOptionalToast,
} from "@/components/wf";
import { usePatientOf, useUmrnText } from "@/components/ward-management/ward-patient-name";
import { genderReviewNeeded } from "@/components/ward-management/ward-model";
import { answerSilenceReminder } from "@/components/ward-management/delays/delays-derivations";
import { clockState, formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { currentShift, currentShiftStartInstant } from "@/components/ward-management/ward-board-time-features";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";
import { wardOccupancy } from "@/components/ward-management/ward-occupancy";
import { waitingInEds } from "@/components/ward-management/ward-shared-figures";
import { activeActNowItems, activeTaskItems } from "@/components/ward-management/ward-act-now-items";
import {
  allDeclines,
  allOverrides,
  isOpen,
  referralBlockedReason,
  shortlistCandidates,
} from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { deriveCommandActivity } from "@/components/ward-management/shell/ward-command-activity";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { queueOrder } from "@/components/ward-management/ward-priority";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import {
  movementBelongsToService,
  noRecordedServiceMovementCount,
  referralBelongsToService,
  urgentMovementsOutsideService,
} from "@/components/ward-management/ward-service-scope";
import { allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";

import styles from "./home.module.css";
import shortlistStyles from "./shortlist-panel.module.css";
import { ExceptionDrawer, type RegisterTabId } from "./exception-drawer";
import { HomeBedflow } from "./home-bedflow";
import { HomeEdPressure, dueWindowLabel } from "./home-ed-pressure";
import { PriorityQueue, queueWaitThresholds, type QueueHighlight } from "./priority-queue";
import { ReferralPlacementPanel, ShortlistPanel } from "./shortlist-panel";
import {
  SinceLastLookPanel,
  SinceLastLookSheetBody,
  sinceLastLookCount,
  sinceHandoverText,
  sinceSheetDescription,
  useSinceLastLook,
} from "./since-last-look-panel";
import { fitKind } from "./home-fit";
import { useHomeLayout } from "./home-layout";
import { HomeWardSheet } from "./home-phone-sheets";

const HANDOVER_HREF = "/mockups/ward-flow/handover";
/** Activity lines shown under "Since you looked". */
const SINCE_TIMELINE_LINES = 8;
const DELAYS_HREF = "/mockups/ward-flow/delays";

/** Phone renders the first 20 queue rows; the rest are one tap away (v10 Home phone mockup). */
const PHONE_QUEUE_ROWS = 20;

/** A bed count older than this is named in the hero's Checking foot (v10 Home chapter). */
const BED_COUNT_FRESH_MINUTES = 60;

/** Focus target when a selection goes away: the selected queue row, else the active queue choice. */
const QUEUE_FOCUS_SELECTOR = 'button[aria-pressed="true"], [role="radio"][aria-checked="true"]';

/**
 * Home: the coordinator's first screen (direction A, owner 10 Oct 2026).
 *
 * One hero band that answers "how many wait for how many beds", with five counts under it:
 * Overdue and Tier 1 highlight those rows in the queue, the due count is flat, and Exceptions and
 * Declines open the registers. New events sits at the right of that row. Then a compact ED strip, then
 * three equal columns that read left to right: queue, State bedflow, Placement. At rest on a
 * desktop Placement shows the top of the queue, labelled so, without selecting it; picking a
 * patient or referral replaces it (a bottom sheet on a phone). The Exceptions count opens the four
 * registers as a strip under it (owner, 8 Oct 2026); on a phone they stay under the queue behind
 * "Today's answers". Nothing on this screen changes state except through the shortlist's own
 * reducer actions.
 *
 * Kept from the third edition: the selection survives a role switch while the movement is open
 * (`focusMovementId`, Task 12), a closed movement stops being explained and hands focus back to
 * the queue (WF-22), the registers are never ED-filtered, and the service scope narrows only the
 * queue and the ED card, never the bedflow or the shortlist.
 */
export function CoordinatorScreen() {
  usePrintableDisclosures();
  const {
    movements,
    units,
    bedReleases,
    leaveBeds,
    admissions,
    rejections,
    referrals,
    refreshRequests,
    dispatch,
    focusMovementId,
    setFocusMovementId,
    configuration,
    scenario,
    plannedAdmissions,
    patients,
    supportNotifications,
    inboxSnoozes,
  } = useWardFlow();
  const liveNow = useWardFlowClock();
  const service = useServiceScope();

  // Live chip pause (rule 9): freezes the clock the lists on this page read. Actions in the
  // shortlist still use the live clock.
  const [paused, setPaused] = useState(false);
  const [frozenNow, setFrozenNow] = useState(liveNow);
  const now = paused ? frozenNow : liveNow;
  function togglePause() {
    setFrozenNow(liveNow);
    setPaused((current) => !current);
  }

  const [selectedMovementId, setSelectedMovementId] = useState<string | undefined>(() => {
    const restored = focusMovementId ? movements.find((movement) => movement.id === focusMovementId) : undefined;
    return restored && isOpen(restored) ? restored.id : undefined;
  });
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);
  const [selectedEdId, setSelectedEdId] = useState<string | undefined>(undefined);
  // The shortlist's other possible subject. Switching the queue between Patients and Referrals
  // never touches either selection.
  const [selectedReferralId, setSelectedReferralId] = useState<string | undefined>(undefined);
  const queueFocusRef = useRef<HTMLDivElement>(null);
  const [exceptionsOpen, setExceptionsOpen] = useState(false);
  // Desktop: one strip under the hero, opened from its Exceptions, Declines or New events count.
  // It starts closed. Exceptions and Declines open the registers on their own tab.
  const [heroPanel, setHeroPanel] = useState<"registers" | "since" | undefined>(undefined);
  const [registerTab, setRegisterTab] = useState<RegisterTabId>("exceptions");
  // Overdue and Tier 1 on the hero highlight their rows in the queue; the rest dim, nothing hides.
  const [highlight, setHighlight] = useState<QueueHighlight | undefined>(undefined);
  function toggleHighlight(next: QueueHighlight) {
    setHighlight((current) => (current === next ? undefined : next));
  }
  function toggleRegisters(tab: RegisterTabId) {
    const showing = heroPanel === "registers" && (tab === "declines") === (registerTab === "declines");
    if (showing) {
      setHeroPanel(undefined);
      return;
    }
    setRegisterTab(tab);
    setHeroPanel("registers");
  }
  // v10 Home layouts: desktop three columns, tablet landscape two (queue and a switching panel),
  // tablet portrait one behind a segmented control with Placement as a side sheet, phone direction A.
  const layout = useHomeLayout();
  const isPhone = layout === "phone";
  const isTabletPortrait = layout === "tablet-portrait";
  const isTabletLandscape = layout === "tablet-landscape";
  // Tablet landscape: the right panel shows Placement or State bedflow.
  const [rightPanel, setRightPanel] = useState<"placement" | "bedflow">("placement");
  // Tablet portrait: the one column shows the queue or State bedflow.
  const [portraitView, setPortraitView] = useState<"queue" | "bedflow">("queue");
  // Phone sheets (direction A): Since you looked, the registers, or one ward. The patient sheet is
  // Placement itself, opened by picking a queue row.
  const [phoneSheet, setPhoneSheet] = useState<
    { kind: "since" } | { kind: "exceptions" } | { kind: "ward"; unitId: string } | undefined
  >(undefined);

  // A ward choice belongs to the movement it was made for, so changing movement clears it.
  function selectMovement(movementId: string | undefined) {
    setSelectedMovementId(movementId);
    setSelectedUnitId(undefined);
    setSelectedReferralId(undefined);
    setFocusMovementId(movementId);
    if (movementId) setRightPanel("placement");
  }

  function selectReferral(referralId: string) {
    setSelectedReferralId(referralId);
    setRightPanel("placement");
  }

  // WF-22: gated on `isOpen`, so a movement that closes while selected stops being explained.
  const selectedMovement = selectedMovementId
    ? movements.find((movement) => movement.id === selectedMovementId && isOpen(movement))
    : undefined;

  useEffect(() => {
    if (selectedMovementId === undefined || selectedMovement !== undefined) return;
    setFocusMovementId(undefined);
    queueFocusRef.current?.querySelector<HTMLElement>(QUEUE_FOCUS_SELECTOR)?.focus();
  }, [selectedMovementId, selectedMovement, setFocusMovementId]);

  const selectedEd = selectedEdId ? allEmergencyDepartments().find((ed) => ed.id === selectedEdId) : undefined;
  const activeEdId = selectedEd?.id;
  const filteredMovements = activeEdId ? movements.filter((movement) => movement.originEdId === activeEdId) : movements;

  // Item 44 (build plan B1): `null` is All services and filters nothing.
  const isInServiceScope = useMemo(() => {
    if (service === null) return null;
    const chosenService = service;
    return (movement: Movement) => movementBelongsToService(movement, chosenService, units);
  }, [service, units]);
  const isReferralInServiceScope = useMemo(() => {
    if (service === null) return null;
    const chosenService = service;
    return (referral: Referral) => referralBelongsToService(referral, chosenService, units);
  }, [service, units]);

  const scopedFilteredMovements = isInServiceScope ? filteredMovements.filter(isInServiceScope) : filteredMovements;
  // D-32 on Home (decision 4, 12 Oct 2026): movements with an active act-now task are pinned on top
  // of the queue, then longest wait first. The act-now rows are the shared ones (`activeActNowItems`).
  const actNowMovementIds = useMemo(
    () =>
      new Set(
        activeActNowItems(
          {
            movements,
            units,
            configuration,
            inboxSnoozes,
            admissions,
            patients,
            referrals,
            supportNotifications,
            plannedAdmissions,
            leaveBeds,
          },
          now,
        ).map((item) => item.movementId),
      ),
    [
      movements,
      units,
      configuration,
      inboxSnoozes,
      admissions,
      patients,
      referrals,
      supportNotifications,
      plannedAdmissions,
      leaveBeds,
      now,
    ],
  );
  const queue = queueOrder(scopedFilteredMovements, now, actNowMovementIds);
  const openMovements = useMemo(() => movements.filter(isOpen), [movements]);

  const noRecordedServiceCount = useMemo(() => noRecordedServiceMovementCount(movements, units), [movements, units]);
  const urgentOutsideServiceCount = useMemo(() => {
    if (service === null) return 0;
    return urgentMovementsOutsideService(openMovements, service, units, now, configuration).length;
  }, [service, openMovements, units, now, configuration]);
  const queueServiceScope = service
    ? {
        service,
        shown: isInServiceScope ? movements.filter(isInServiceScope).length : movements.length,
        total: movements.length,
        noRecordedServiceCount,
        urgentOutside: { count: urgentOutsideServiceCount },
      }
    : undefined;

  const referralQueueAll = referralQueueOrder(referrals);
  const referralQueue = isReferralInServiceScope ? referralQueueAll.filter(isReferralInServiceScope) : referralQueueAll;
  // Resolved from the live queue each render, so a referral that leaves the queue drops the selection.
  const selectedReferral = selectedReferralId
    ? referralQueue.find((referral) => referral.id === selectedReferralId)
    : undefined;
  const hasPanelSubject = Boolean(selectedReferral || selectedMovement);
  // Desktop at rest: Placement shows the top of the queue without selecting it, so no queue row
  // reads as pressed when nobody pressed it. A phone, and a tablet in portrait, keep their sheet
  // for a real pick only.
  const previewMovement = !hasPanelSubject && !isPhone && !isTabletPortrait ? queue[0] : undefined;
  const panelMovement = selectedMovement ?? previewMovement;

  // A ward choice belongs to the movement it was made for, preview included: when the movement in
  // Placement changes (a new top of queue, an ED or service filter), the ward choice goes.
  const panelMovementId = panelMovement?.id;
  const [unitOwnerId, setUnitOwnerId] = useState(panelMovementId);
  if (unitOwnerId !== panelMovementId) {
    setUnitOwnerId(panelMovementId);
    setSelectedUnitId(undefined);
  }
  // Picking a ward for the previewed patient selects that patient, so the choice cannot drift onto
  // whoever reaches the top of the queue next.
  function pickUnit(unitId: string | undefined) {
    if (previewMovement) selectMovement(previewMovement.id);
    setSelectedUnitId(unitId);
  }

  function closeShortlist() {
    selectMovement(undefined);
    queueFocusRef.current?.querySelector<HTMLElement>(QUEUE_FOCUS_SELECTOR)?.focus();
  }

  // Placement as a sheet (phone, tablet portrait): Esc closes it, like the scrim.
  const sheetPlacementOpen = hasPanelSubject && (isPhone || isTabletPortrait);
  useEffect(() => {
    if (!sheetPlacementOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      setSelectedMovementId(undefined);
      setSelectedReferralId(undefined);
      setFocusMovementId(undefined);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetPlacementOpen, setFocusMovementId]);

  /*
   * Offer on a bedflow row (v10 Home): refers this patient to that ward at once (`REFER_TO_UNITS`)
   * and offers Undo on the toast (`UNDO_REFER_TO_UNITS`), so leaving the page never loses the
   * offer. The row reads Offered from the recorded referral. A ward the engine would refuse a plain
   * referral for (a stage that cannot be referred, a gender placement still to record) is chosen
   * in Placement instead, which says why.
   */
  // Null only where the screen renders without the layout (a test or preview): Offer then sends
  // at once, with no Undo window.
  const toast = useOptionalToast();
  const patientOf = usePatientOf();
  const umrnText = useUmrnText();
  const { run: runStep } = useUndoableStep({
    dispatch,
    rejections,
    now: liveNow,
    routeRole: "coordinator",
    toast,
    sayRefusal: umrnText,
  });

  function offer(movement: Movement, unitId: string) {
    const unit = units.find((candidate) => candidate.id === unitId);
    if (!unit) return;
    const candidate = shortlistCandidates(movement, [unit], liveNow)[0];
    const plain =
      candidate !== undefined &&
      fitKind(candidate) === "bed" &&
      referralBlockedReason(movement) === undefined &&
      !(
        genderReviewNeeded(movement.gender, movement.sex) &&
        !(movement.genderPlacements ?? []).some((record) => record.unitIds.includes(unitId))
      ) &&
      !movement.referredUnitIds.includes(unitId);
    if (!plain) {
      if (previewMovement?.id === movement.id) selectMovement(movement.id);
      setSelectedUnitId(unitId);
      setRightPanel("placement");
      return;
    }
    if (previewMovement?.id === movement.id) selectMovement(movement.id);
    setSelectedUnitId(unitId);
    const who = patientOf(movement);
    runStep(
      { type: "REFER_TO_UNITS", role: "coordinator", now: liveNow, movementId: movement.id, unitIds: [unitId] },
      {
        success: `Offered ${unit.name} to ${who.umrn}`,
        undo: (at) => ({ type: "UNDO_REFER_TO_UNITS", role: "coordinator", now: at, movementId: movement.id }),
        undone: `Offer withdrawn. ${unit.name} is no longer asked.`,
      },
    );
  }

  /*
   * Refer from the phone patient sheet (v10 Home phone "Refer to <ward>"): the same
   * `REFER_TO_UNITS` the panel would dispatch, run through the Undo step so the toast says Offered
   * with Undo, as the bedflow Offer does. The sheet closes so the toast is not under its footer.
   */
  function referFromSheet(movement: Movement, unitIds: string[], unitNames: string[]) {
    const who = patientOf(movement);
    const names = unitNames.join(", ");
    runStep(
      { type: "REFER_TO_UNITS", role: "coordinator", now: liveNow, movementId: movement.id, unitIds },
      {
        success: `Offered ${names} to ${who.umrn}`,
        undo: (at) => ({ type: "UNDO_REFER_TO_UNITS", role: "coordinator", now: at, movementId: movement.id }),
        undone: `Offer withdrawn. ${names} ${unitNames.length === 1 ? "is" : "are"} no longer asked.`,
      },
    );
    closeShortlist();
  }

  // The work list is network-wide and open movements only, never scoped to the ED filter.
  // L1 (site review, 12 Oct 2026): the same active task list as the header's Tasks badge
  // (`activeTaskItems`), so snoozed rows leave the count and decision targets join it.
  const actionInbox = useMemo(
    () =>
      activeTaskItems(
        {
          movements,
          units,
          configuration,
          inboxSnoozes,
          admissions,
          patients,
          referrals,
          supportNotifications,
          plannedAdmissions,
          leaveBeds,
        },
        now,
      ).map((item) => {
        if (!item.id.startsWith("bed-pull-") && item.title !== "Bed pull expired") return item;
        return {
          ...item,
          title: "Reserved time has passed, bed still held",
          detail: `${item.detail} · Release the bed or set a new reserved time`,
        };
      }),
    [
      movements,
      units,
      configuration,
      inboxSnoozes,
      admissions,
      patients,
      referrals,
      supportNotifications,
      plannedAdmissions,
      leaveBeds,
      now,
    ],
  );
  const silenceReminders = useMemo(() => {
    const notes = new Map<string, string>();
    for (const movement of openMovements) {
      const copy = answerSilenceReminder(movement, referrals, now);
      if (copy !== undefined) notes.set(movement.id, copy);
    }
    return notes;
  }, [openMovements, referrals, now]);

  // OD-3: the coordinator's unrestricted reads. Not scoped to open or to the ED filter: an override
  // or a decline that was made does not stop having been made.
  const overrideRegister = useMemo(() => allOverrides(movements), [movements]);
  const declineRegister = useMemo(() => allDeclines(movements), [movements]);

  const lastLookWorld = useMemo(
    () => ({ scenario, referrals, movements, units, bedReleases }),
    [scenario, referrals, movements, units, bedReleases],
  );
  const lastLook = useSinceLastLook(lastLookWorld, now);
  const newEvents = sinceLastLookCount(lastLook.changes);

  // The same timestamped projection the bar's Activity drawer reads; Home shows its newest lines.
  const recentActivity = useMemo(() => {
    const activity = deriveCommandActivity({
      movements,
      patients,
      units,
      referrals,
      rejections,
      bedReleases,
      leaveBeds,
      refreshRequests,
      now,
    });
    return activity.content.changes.slice(0, SINCE_TIMELINE_LINES).map((change) => ({
      ...change,
      tone: activity.tones[change.id] ?? "info",
    }));
  }, [movements, patients, units, referrals, rejections, bedReleases, leaveBeds, refreshRequests, now]);

  // Hero counts: every one is read from an existing derivation, never typed.
  const counts = useMemo(
    () => wardNavCounts({ movements, units, referrals, bedReleases, leaveBeds, now }),
    [movements, units, referrals, bedReleases, leaveBeds, now],
  );
  // The one "waiting" figure (`ward-shared-figures.ts`): the service picker and Network read it too.
  const waitingInEd = useMemo(() => waitingInEds(movements, now).total, [now, movements]);
  const breachWithinHour = openMovements.filter(
    (movement) => movement.legalForm?.dueAt !== undefined && clockState(movement.legalForm.dueAt, now) === "critical",
  ).length;
  const bedsReady = counts.capacity?.value ?? 0;
  // The two highlight chips count the queue they highlight (after the ED and service filters).
  const overdueInQueue = queue.filter(
    (movement) => now - movement.openedAt >= queueWaitThresholds(movement.urgency).overdue,
  ).length;
  const tierOneInQueue = queue.filter((movement) => movement.urgency === 1).length;
  const dueWindow = dueWindowLabel(configuration.dueSoonUrgentMinutes);

  // v10 hero: the one ring on the page is statewide occupancy, from the one shared count
  // (`ward-occupancy.ts`) every page and the rail read, against the sidebar's alert line.
  const statewideOccupancy = useMemo(
    () => wardOccupancy(units, admissions, bedReleases).percent,
    [units, admissions, bedReleases],
  );
  // Checking foot: what this page watched, as counts. Never "All clear".
  const staleBedCounts = units.filter((unit) => now - unit.allocatable.confirmedAt > BED_COUNT_FRESH_MINUTES).length;
  const wardsNotReporting = units.filter(
    (unit) => now - unit.allocatable.confirmedAt > unit.allocatable.staleAfterMinutes,
  ).length;
  // "N new since 07:12": the last look, or the start of this shift when there is none yet.
  const sinceClock = formatInstantWithDay(lastLook.changes?.since ?? currentShiftStartInstant(now), now);
  const sinceLabel = `new since ${sinceClock}`;
  const shiftWord = currentShift(now)
    .name.replace(/ Shift$/u, " shift")
    .toLowerCase();
  const heroTitle = (
    <>
      <span className={styles.heroNum}>{waitingInEd}</span> waiting in ED,{" "}
      <span className={styles.heroNum}>{bedsReady}</span> {bedsReady === 1 ? "bed" : "beds"} ready
    </>
  );
  // The four registers: a strip under the hero on desktop (opened from its Exceptions count), and
  // the collapsible "Today's answers" card under the queue on a phone. Only one is ever mounted.
  function renderRegisters(placement: "band" | "column") {
    return (
      <ExceptionDrawer
        items={actionInbox}
        silenceReminders={silenceReminders}
        rejections={rejections}
        overrides={overrideRegister}
        declines={declineRegister}
        units={units}
        now={now}
        open={exceptionsOpen}
        placement={placement}
        tab={placement === "band" ? registerTab : undefined}
        onTabChange={placement === "band" ? setRegisterTab : undefined}
        onToggle={() => setExceptionsOpen((open) => !open)}
        // On a phone the open registers stand between a coordinator and Confirm, so choosing a
        // row closes them in the same tap.
        onSelectMovement={(movementId) => {
          selectMovement(movementId);
          setExceptionsOpen(false);
        }}
        onSelectDischarge={() => {
          setExceptionsOpen(false);
        }}
      />
    );
  }

  const bedflowNode = (
    <HomeBedflow
      movement={panelMovement}
      units={units}
      movements={movements}
      bedReleases={bedReleases}
      leaveBeds={leaveBeds}
      admissions={admissions}
      now={now}
      selectedUnitId={selectedUnitId}
      onSelectUnit={(unitId) => pickUnit(selectedUnitId === unitId ? undefined : unitId)}
      onOffer={(unitId) => {
        if (panelMovement) offer(panelMovement, unitId);
      }}
      parallelReferralCap={configuration.parallelReferralCap}
      dischargesHeldUp={counts.discharges?.value ?? 0}
      service={service}
    />
  );

  // Placement: the third column on desktop, the switched right panel on tablet landscape, a side
  // sheet over a scrim on tablet portrait and the patient sheet on a phone (CSS by `data-layout`).
  const placementNode =
    hasPanelSubject || previewMovement ? (
      <div className={styles.side} data-preview={previewMovement ? "true" : undefined}>
        {hasPanelSubject ? (
          <div
            className={`${styles.shortlistBackdrop} ${shortlistStyles.shortlistBackdrop ?? ""}`}
            onClick={closeShortlist}
            aria-hidden="true"
            data-testid="ward-coordinator-shortlist-backdrop"
          />
        ) : null}
        <div className={`${styles.shortlistColumn} ${shortlistStyles.shortlistColumn ?? ""}`}>
          <aside
            className={`${styles.shortlistRegion} ${shortlistStyles.shortlistRegion ?? ""}`}
            aria-label={selectedReferral ? "Referral placement" : "Placement"}
            // Journeys prove which movement the panel is for by this attribute.
            data-subject-movement={selectedReferral ? undefined : panelMovement?.id}
            // Reaching into the top-of-queue preview selects that patient first, so every action
            // acts on a chosen patient and a queue reorder cannot swap them mid-form.
            onPointerDownCapture={previewMovement ? () => selectMovement(previewMovement.id) : undefined}
            onFocusCapture={previewMovement ? () => selectMovement(previewMovement.id) : undefined}
          >
            <div className={`${styles.sheetHandle} ${shortlistStyles.sheetHandle ?? ""}`} aria-hidden="true" />
            <header className={styles.shortlistHeader}>
              <h2 className={isTabletLandscape ? "sr-only" : undefined}>
                {selectedReferral ? "Referral placement" : "Placement"}
              </h2>
              {previewMovement ? (
                <span className={styles.shortlistPreviewLabel} data-testid="ward-placement-top-of-queue">
                  Top of queue
                </span>
              ) : (
                <button
                  type="button"
                  className={buttonClass({ variant: "ghost", size: "sm" })}
                  onClick={closeShortlist}
                  aria-label="Close shortlist and clear selection"
                >
                  {isPhone || isTabletPortrait ? "Close" : "Back to top of queue"}
                </button>
              )}
            </header>
            {service ? (
              <p className={styles.cardNote} data-testid="ward-shortlist-not-scoped">
                Beds are never narrowed by service. Every ward in the network is considered.
              </p>
            ) : null}
            {selectedReferral ? (
              <ReferralPlacementPanel referral={selectedReferral} now={liveNow} />
            ) : (
              <ShortlistPanel
                movement={panelMovement}
                now={liveNow}
                units={units}
                bedReleases={bedReleases}
                leaveBeds={leaveBeds}
                admissions={admissions}
                referrals={referrals}
                selectedUnitId={selectedUnitId}
                onSelectUnit={pickUnit}
                dispatch={dispatch}
                parallelReferralCap={configuration.parallelReferralCap}
                pullHoldMinutes={configuration.pullHoldMinutes}
                onRefer={
                  isPhone && panelMovement
                    ? (unitIds, unitNames) => referFromSheet(panelMovement, unitIds, unitNames)
                    : undefined
                }
              />
            )}
          </aside>
        </div>
      </div>
    ) : isTabletLandscape ? (
      <p className={styles.emptyLine}>No one waiting. Placement opens when a patient is chosen.</p>
    ) : null;

  return (
    <div className={styles.screen} data-testid="ward-coordinator" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <h1 className="sr-only">Ward Flow coordinator</h1>

        <div className={styles.body} data-testid="ward-coordinator-body">
          <Hero
            className={styles.homeHero}
            // Phone direction A (Josh, 10 Oct 2026): queue first. The same answer as the desktop
            // title, three figures you can tap, then New since and Pause.
            eyebrow={isPhone ? `Statewide · ${shiftWord}` : `Statewide · mental health beds · ${shiftWord}`}
            title={heroTitle}
            titleMeta={
              isPhone
                ? `Prototype data, invented records${
                    statewideOccupancy !== null ? ` · ${statewideOccupancy.toFixed(1)}% occupied` : ""
                  }`
                : undefined
            }
            stats={
              isPhone ? (
                <>
                  <HeroStat
                    value={overdueInQueue}
                    label="Overdue waits"
                    tone={overdueInQueue > 0 ? "danger" : undefined}
                    pressed={highlight === "overdue"}
                    onToggle={() => toggleHighlight("overdue")}
                  />
                  <HeroStat
                    value={tierOneInQueue}
                    label="Tier 1"
                    tone="neutral"
                    pressed={highlight === "tier1"}
                    onToggle={() => toggleHighlight("tier1")}
                  />
                  <HeroStat
                    value={actionInbox.length}
                    label="Exceptions"
                    tone={actionInbox.length > 0 ? "danger" : undefined}
                    command
                    expanded={phoneSheet?.kind === "exceptions"}
                    onToggle={() => {
                      setExceptionsOpen(true);
                      setPhoneSheet({ kind: "exceptions" });
                    }}
                  />
                </>
              ) : undefined
            }
            // The one ring on the page leads the hero on desktop and tablet (shared Hero lead slot).
            lead={
              isPhone ? undefined : (
                <OccupancyRing percent={statewideOccupancy} alertAt={BED_ALERT_THRESHOLD_PERCENT} scope="Statewide" />
              )
            }
            bar={
              isPhone ? (
                // v10 phone hero: the full-width "N since you looked at HH:MM" pill and a round
                // pause. The Live chip itself sits on the eyebrow line (`aside` below). The pill
                // shows only when something changed (device audit, 11 Oct 2026: "0 since you
                // looked" cost 45px of hero for nothing).
                <div className={styles.phoneHeroActs}>
                  {newEvents > 0 ? (
                    <Button
                      variant="onHero"
                      className={styles.phoneSince}
                      aria-haspopup="dialog"
                      aria-expanded={phoneSheet?.kind === "since"}
                      onClick={() => setPhoneSheet({ kind: "since" })}
                    >
                      <b className={styles.phoneSinceMono}>{newEvents}</b>{" "}
                      {lastLook.changes?.basis === "shift" ? "new since" : "since you looked at"}{" "}
                      <span className={styles.phoneSinceMono}>{sinceClock}</span>
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className={styles.heroToggles}>
                  <HeroStat
                    inline
                    value={overdueInQueue}
                    label="Overdue waits"
                    tone={overdueInQueue > 0 ? "danger" : undefined}
                    pressed={highlight === "overdue"}
                    onToggle={() => toggleHighlight("overdue")}
                  />
                  <HeroStat
                    inline
                    value={tierOneInQueue}
                    label="Tier 1"
                    pressed={highlight === "tier1"}
                    onToggle={() => toggleHighlight("tier1")}
                  />
                  <HeroStat
                    inline
                    value={breachWithinHour}
                    // Names its noun (device audit, 11 Oct 2026): it counts recorded legal forms due
                    // within the saved window, not the queue's "due in" wait targets.
                    label={`Forms due within ${dueWindow}`}
                    tone={breachWithinHour > 0 ? "warning" : undefined}
                    className={styles.heroDueChip}
                  />
                  <HeroStat
                    inline
                    value={actionInbox.length}
                    label="Exceptions"
                    tone={actionInbox.length > 0 ? "warning" : undefined}
                    expanded={heroPanel === "registers" && registerTab !== "declines"}
                    controls="ward-home-hero-panel"
                    onToggle={() => toggleRegisters("exceptions")}
                  />
                  <HeroStat
                    inline
                    value={declineRegister.length}
                    label="Declines"
                    tone={declineRegister.length > 0 ? "closed" : undefined}
                    expanded={heroPanel === "registers" && registerTab === "declines"}
                    controls="ward-home-hero-panel"
                    onToggle={() => toggleRegisters("declines")}
                  />
                </div>
              )
            }
            barAside={
              isPhone ? undefined : (
                <HeroStat
                  inline
                  value={newEvents}
                  label={sinceLabel}
                  tone={newEvents > 0 ? "info" : undefined}
                  expanded={heroPanel === "since"}
                  controls="ward-home-hero-panel"
                  onToggle={() => setHeroPanel((open) => (open === "since" ? undefined : "since"))}
                />
              )
            }
            aside={
              isPhone ? (
                // Device audit (11 Oct 2026): the pause is folded into the Live pill.
                <LiveChip
                  state={paused ? "paused" : "live"}
                  onHero
                  age={formatInstant(now)}
                  onTogglePause={togglePause}
                />
              ) : (
                <>
                  <LiveChip state={paused ? "paused" : "live"} onHero onTogglePause={togglePause} />
                  <Link href={HANDOVER_HREF} className={buttonClass({ variant: "light" })}>
                    Start handover
                  </Link>
                </>
              )
            }
            foot={
              isPhone ? undefined : (
                <CheckingFoot
                  items={[
                    {
                      id: "overdue",
                      label: "Overdue",
                      value: overdueInQueue,
                      tone: overdueInQueue > 0 ? "danger" : "neutral",
                    },
                    {
                      id: "stale-counts",
                      label: `Bed counts older than ${BED_COUNT_FRESH_MINUTES / 60}h`,
                      value: staleBedCounts,
                      tone: staleBedCounts > 0 ? "warning" : "neutral",
                    },
                    {
                      id: "not-reporting",
                      label: "Wards not reporting",
                      value: wardsNotReporting,
                      tone: wardsNotReporting > 0 ? "warning" : "neutral",
                    },
                  ]}
                  notChecked={["private hospitals, no feed"]}
                />
              )
            }
          />

          {heroPanel && !isPhone ? (
            <div id="ward-home-hero-panel" className={styles.registersBand}>
              {heroPanel === "registers" ? (
                renderRegisters("band")
              ) : (
                <SinceLastLookPanel
                  changes={lastLook.changes}
                  now={now}
                  activity={recentActivity}
                  onMarkSeen={lastLook.markSeen}
                  placement="band"
                />
              )}
            </div>
          ) : null}

          <HomeEdPressure
            now={now}
            movements={movements}
            selectedEdId={selectedEdId}
            onSelectEd={setSelectedEdId}
            service={service}
          />

          {isTabletPortrait ? (
            // Tablet portrait: one column behind a switch, so nothing is squeezed side by side.
            <Segmented
              className={styles.portraitSwitch}
              label="Home view"
              size="md"
              value={portraitView}
              onChange={setPortraitView}
              items={[
                // The count is patients plus referrals, so the label says both (device audit, 11 Oct
                // 2026: "Priority queue 77" sat beside the card's "70 of 70").
                { id: "queue", label: "Queue and referrals", count: queue.length + referralQueue.length },
                { id: "bedflow", label: "State bedflow", count: units.length },
              ]}
            />
          ) : null}

          <div
            className={styles.grid}
            data-testid="ward-coordinator-region-grid"
            data-layout={layout}
            data-shortlist-open={hasPanelSubject}
            data-placement-preview={previewMovement ? "true" : undefined}
            ref={queueFocusRef}
          >
            {isTabletPortrait && portraitView === "bedflow" ? null : (
              <div className={styles.side}>
                <PriorityQueue
                  movements={queue}
                  referralQueue={referralQueue}
                  now={now}
                  selectedId={selectedMovementId}
                  onSelect={selectMovement}
                  selectedReferralId={selectedReferralId}
                  onSelectReferral={selectReferral}
                  filterEdId={activeEdId}
                  onClearFilter={() => setSelectedEdId(undefined)}
                  totalMovements={openMovements.length}
                  serviceScope={queueServiceScope}
                  pullHoldMinutes={configuration.pullHoldMinutes}
                  delaysHref={DELAYS_HREF}
                  highlight={highlight}
                  onClearHighlight={() => setHighlight(undefined)}
                  rowCap={isPhone ? PHONE_QUEUE_ROWS : undefined}
                  phone={isPhone}
                  pinnedIds={actNowMovementIds}
                />
                {/* Phone (v10 Home): the queue ends the page; the beds-ready list is on Capacity
                    and Places, not repeated here. */}
              </div>
            )}

            {isTabletLandscape ? (
              // Tablet landscape: the right panel switches between Placement and State bedflow.
              <div className={styles.rightPanel}>
                <Segmented
                  className={styles.rightSwitch}
                  label="Right panel"
                  value={rightPanel}
                  onChange={setRightPanel}
                  items={[
                    { id: "placement", label: "Placement" },
                    { id: "bedflow", label: "State bedflow", count: units.length },
                  ]}
                />
                {rightPanel === "bedflow" ? bedflowNode : placementNode}
              </div>
            ) : (
              <>
                {isTabletPortrait && portraitView === "queue" ? null : (
                  <div className={styles.flowCol}>{bedflowNode}</div>
                )}
                {placementNode}
              </>
            )}
          </div>

          {isPhone && phoneSheet?.kind === "since" ? (
            <Sheet
              open
              onClose={() => setPhoneSheet(undefined)}
              title="Since you looked"
              description={sinceSheetDescription(lastLook.changes, now)}
              mobilePlacement="bottom"
              testId="ward-home-since-sheet"
              footer={
                // v10: Copy as handover text is the sheet's primary; Mark as seen stays beside it.
                <div className={styles.sinceSheetFootRow}>
                  {lastLook.changes ? (
                    <Button variant="sec" className={styles.sinceSheetFoot} onClick={lastLook.markSeen}>
                      Mark as seen
                    </Button>
                  ) : null}
                  <Button
                    variant="pri"
                    icon={Copy}
                    className={styles.sinceSheetFoot}
                    onClick={() => {
                      void navigator.clipboard
                        ?.writeText(sinceHandoverText(lastLook.changes, now))
                        .catch(() => undefined);
                    }}
                  >
                    Copy as handover text
                  </Button>
                </div>
              }
            >
              <SinceLastLookSheetBody changes={lastLook.changes} />
            </Sheet>
          ) : null}
          {isPhone && phoneSheet?.kind === "exceptions" ? (
            <Sheet
              open
              onClose={() => setPhoneSheet(undefined)}
              title="Exceptions"
              description="Choose one to open its patient"
              mobilePlacement="bottom"
              testId="ward-home-exceptions-sheet"
            >
              <ExceptionDrawer
                items={actionInbox}
                silenceReminders={silenceReminders}
                rejections={rejections}
                overrides={overrideRegister}
                declines={declineRegister}
                units={units}
                now={now}
                open
                placement="column"
                onToggle={() => setPhoneSheet(undefined)}
                onSelectMovement={(movementId) => {
                  setPhoneSheet(undefined);
                  selectMovement(movementId);
                }}
                onSelectDischarge={() => setPhoneSheet(undefined)}
              />
            </Sheet>
          ) : null}
          {isPhone && phoneSheet?.kind === "ward" ? (
            <HomeWardSheet
              unitId={phoneSheet.unitId}
              units={units}
              admissions={admissions}
              bedReleases={bedReleases}
              leaveBeds={leaveBeds}
              queue={queue}
              now={now}
              onClose={() => setPhoneSheet(undefined)}
              onOffer={(movement, unit) => {
                setPhoneSheet(undefined);
                offer(movement, unit.id);
              }}
              onOpenPatient={(movementId) => {
                setPhoneSheet(undefined);
                selectMovement(movementId);
              }}
            />
          ) : null}
        </div>
        <WardPrototypeFooter
          testId="ward-coordinator-governance"
          note={
            <>
              Demo coordinator view · Not a medical device
              <span
                className={styles.refusalMarker}
                data-alert={rejections.length > 0 ? "true" : undefined}
                data-testid="ward-coordinator-refusal-marker"
                title={`${rejections.length} refused action${rejections.length === 1 ? "" : "s"}`}
              >
                {rejections.length === 1 ? "1 refused" : `${rejections.length} refused`}
              </span>
            </>
          }
        />
      </main>
    </div>
  );
}
