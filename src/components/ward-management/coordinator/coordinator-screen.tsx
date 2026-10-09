"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Hero, HeroStat, LiveChip, buttonClass } from "@/components/wf";
import { answerSilenceReminder } from "@/components/ward-management/delays/delays-derivations";
import { clockState } from "@/components/ward-management/ward-clock";
import { allDeclines, allOverrides, buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { deriveCommandActivity } from "@/components/ward-management/shell/ward-command-activity";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
import { wardNavCounts } from "@/components/ward-management/ward-nav-counts";
import { queueOrder } from "@/components/ward-management/ward-priority";
import { edPressure } from "@/components/ward-management/ward-pressure";
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
import { PriorityQueue } from "./priority-queue";
import { ReferralPlacementPanel, ShortlistPanel } from "./shortlist-panel";
import { SinceLastLookPanel, sinceLastLookCount, useSinceLastLook } from "./since-last-look-panel";

const HANDOVER_HREF = "/mockups/ward-flow/handover";
/** Activity lines shown under "Since you looked". */
const SINCE_TIMELINE_LINES = 8;
const DELAYS_HREF = "/mockups/ward-flow/delays";

/** Focus target when a selection goes away: the selected queue row, else the active queue choice. */
const QUEUE_FOCUS_SELECTOR = 'button[aria-pressed="true"], [role="radio"][aria-checked="true"]';

/**
 * Home: the coordinator's first screen (v6 Home mockup, 7 Oct 2026).
 *
 * One hero band (open movements and the day's counts, Live with pause, Start handover), the ED
 * pressure card, then the columns. At rest: the priority queue (with "Since you looked" under it)
 * and State bedflow across the two right columns. Selecting a patient or referral reads left to
 * right: queue, State bedflow (narrowed, fitting wards tinted), then the explainable shortlist on
 * the far right (a bottom sheet on a phone). The Exceptions count on the hero opens the four
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
    plannedAdmissions = [],
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
  function toggleRegisters(tab: RegisterTabId) {
    const showing = heroPanel === "registers" && (tab === "declines") === (registerTab === "declines");
    if (showing) {
      setHeroPanel(undefined);
      return;
    }
    setRegisterTab(tab);
    setHeroPanel("registers");
  }
  // Phone keeps the registers in the page flow under the queue, behind "Today's answers".
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(max-width: 48rem)");
    const update = () => setIsPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // A ward choice belongs to the movement it was made for, so changing movement clears it.
  function selectMovement(movementId: string | undefined) {
    setSelectedMovementId(movementId);
    setSelectedUnitId(undefined);
    setSelectedReferralId(undefined);
    setFocusMovementId(movementId);
  }

  function selectReferral(referralId: string) {
    setSelectedReferralId(referralId);
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
  const queue = queueOrder(scopedFilteredMovements, now);
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

  function closeShortlist() {
    selectMovement(undefined);
    queueFocusRef.current?.querySelector<HTMLElement>(QUEUE_FOCUS_SELECTOR)?.focus();
  }

  // The work list is network-wide and open movements only, never scoped to the ED filter.
  const actionInbox = useMemo(
    () =>
      buildActionInbox(openMovements, now, units, plannedAdmissions).map((item) => {
        if (!item.id.startsWith("bed-pull-") && item.title !== "Bed pull expired") return item;
        return {
          ...item,
          title: "Reserved time has passed, bed still held",
          detail: `${item.detail} · Release the bed or set a new reserved time`,
        };
      }),
    [openMovements, now, units, plannedAdmissions],
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
  }, [movements, units, referrals, rejections, bedReleases, leaveBeds, refreshRequests, now]);

  // Hero counts: every one is read from an existing derivation, never typed.
  const counts = useMemo(
    () => wardNavCounts({ movements, units, referrals, bedReleases, leaveBeds, now }),
    [movements, units, referrals, bedReleases, leaveBeds, now],
  );
  const tierOneOpen = openMovements.filter((movement) => movement.urgency === 1).length;
  const waitingInEd = useMemo(
    () => edPressure(now, movements).reduce((sum, row) => sum + row.waiting, 0),
    [now, movements],
  );
  const breachWithinHour = openMovements.filter(
    (movement) => movement.legalForm?.dueAt !== undefined && clockState(movement.legalForm.dueAt, now) === "critical",
  ).length;
  const bedsReady = counts.capacity?.value ?? 0;

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
      />
    );
  }

  return (
    <div className={styles.screen} data-testid="ward-coordinator" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <h1 className="sr-only">Ward Flow coordinator</h1>

        <div className={styles.body} data-testid="ward-coordinator-body">
          <Hero
            eyebrow="State bedflow"
            title={`${openMovements.length} open movements`}
            stats={
              <>
                <HeroStat value={tierOneOpen} label="Tier 1 open" tone={tierOneOpen > 0 ? "danger" : undefined} />
                <HeroStat value={bedsReady} label="Beds ready" />
                <HeroStat value={waitingInEd} label="Waiting in ED" />
                <HeroStat
                  value={breachWithinHour}
                  label={`Due within ${dueWindowLabel(configuration.dueSoonUrgentMinutes)}`}
                  tone={breachWithinHour > 0 ? "warning" : undefined}
                />
              </>
            }
            bar={
              isPhone ? undefined : (
                <div className={styles.heroToggles}>
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
                  <HeroStat
                    inline
                    value={newEvents}
                    label="New events"
                    tone={newEvents > 0 ? "info" : undefined}
                    expanded={heroPanel === "since"}
                    controls="ward-home-hero-panel"
                    onToggle={() => setHeroPanel((open) => (open === "since" ? undefined : "since"))}
                  />
                </div>
              )
            }
            aside={
              <>
                <LiveChip state={paused ? "paused" : "live"} onHero onTogglePause={togglePause} />
                <Link href={HANDOVER_HREF} className={buttonClass({ variant: "light" })}>
                  Start handover
                </Link>
              </>
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

          <div
            className={styles.grid}
            data-testid="ward-coordinator-region-grid"
            data-shortlist-open={hasPanelSubject}
            ref={queueFocusRef}
          >
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
              />
              {isPhone ? renderRegisters("column") : null}
              {isPhone ? (
                <SinceLastLookPanel
                  changes={lastLook.changes}
                  now={now}
                  activity={recentActivity}
                  onMarkSeen={lastLook.markSeen}
                />
              ) : null}
            </div>

            <div className={hasPanelSubject ? styles.flowCol : styles.flowWide}>
              <HomeBedflow
                movement={selectedMovement}
                units={units}
                movements={movements}
                bedReleases={bedReleases}
                leaveBeds={leaveBeds}
                admissions={admissions}
                now={now}
                selectedUnitId={selectedUnitId}
                onSelectUnit={(unitId) => setSelectedUnitId((current) => (current === unitId ? undefined : unitId))}
                onOffer={(unitId) => setSelectedUnitId(unitId)}
                parallelReferralCap={configuration.parallelReferralCap}
                dischargesHeldUp={counts.discharges?.value ?? 0}
                service={service}
              />
            </div>

            {hasPanelSubject ? (
              <div className={styles.side}>
                <div
                  className={`${styles.shortlistBackdrop} ${shortlistStyles.shortlistBackdrop ?? ""}`}
                  onClick={closeShortlist}
                  aria-hidden="true"
                  data-testid="ward-coordinator-shortlist-backdrop"
                />
                <div className={`${styles.shortlistColumn} ${shortlistStyles.shortlistColumn ?? ""}`}>
                  <aside
                    className={`${styles.shortlistRegion} ${shortlistStyles.shortlistRegion ?? ""}`}
                    aria-label={selectedReferral ? "Referral placement" : "Placement"}
                    // Journeys prove which movement the panel is for by this attribute.
                    data-subject-movement={selectedReferral ? undefined : selectedMovement?.id}
                  >
                    <div className={`${styles.sheetHandle} ${shortlistStyles.sheetHandle ?? ""}`} aria-hidden="true" />
                    <header className={styles.shortlistHeader}>
                      <h2>{selectedReferral ? "Referral placement" : "Placement"}</h2>
                      <button
                        type="button"
                        className={buttonClass({ variant: "ghost", size: "sm" })}
                        onClick={closeShortlist}
                        aria-label="Close shortlist and clear selection"
                      >
                        Close
                      </button>
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
                        movement={selectedMovement}
                        now={liveNow}
                        units={units}
                        bedReleases={bedReleases}
                        leaveBeds={leaveBeds}
                        admissions={admissions}
                        referrals={referrals}
                        selectedUnitId={selectedUnitId}
                        onSelectUnit={setSelectedUnitId}
                        dispatch={dispatch}
                        parallelReferralCap={configuration.parallelReferralCap}
                        pullHoldMinutes={configuration.pullHoldMinutes}
                      />
                    )}
                  </aside>
                </div>
              </div>
            ) : null}
          </div>
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
