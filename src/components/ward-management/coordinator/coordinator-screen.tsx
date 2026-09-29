"use client";

import { Columns2, Maximize2, Minimize2, PanelRightClose } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { answerSilenceReminder } from "@/components/ward-management/delays/delays-derivations";
import { allDeclines, allOverrides, buildActionInbox, isOpen } from "@/components/ward-management/ward-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import type { Movement, Referral } from "@/components/ward-management/ward-model";
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

import styles from "./coordinator.module.css";
import shortlistStyles from "./shortlist-panel.module.css";
import { ExceptionDrawer } from "./exception-drawer";
import { FlowDiagram } from "./flow-diagram";
import { PressureStrip } from "./pressure-strip";
import { PriorityQueue } from "./priority-queue";
import { ReferralPlacementPanel, ShortlistPanel } from "./shortlist-panel";

/**
 * Task 3 shell: five landmark regions, all present and stubbed with real synthetic volume
 * (`edPressure` returns 8 departments, `queueOrder` returns 41 open movements) so the layout is
 * judged against real volume rather than three placeholder rows. Task 4 built out the pressure
 * strip and the queue's department filter; Task 5 built the real `PriorityQueue`; Task 6 built
 * the real `FlowDiagram`; Task 7 built the real `ShortlistPanel`; Task 8 built the real
 * `ExceptionDrawer` and the phone form.
 */

// Must match the `@media (max-width: 48rem)` breakpoint in coordinator.module.css that hides
// `.diagramRegion` and `.pressureStrip`. CSS already hides the diagram visually on first paint
// (server-rendered markup cannot know the viewport), but Task 8 review Minor 5 found the
// underlying `FlowDiagram` still MOUNTED underneath that `display: none` — its `useLayoutEffect`,
// `ResizeObserver` and window-resize `measure()` all kept running against a zero-size box. This
// query drives whether `FlowDiagram` mounts at all, so a phone stops paying for work nobody can
// see rather than merely hiding the result of it.
const PHONE_DIAGRAM_MEDIA_QUERY = "(max-width: 48rem)";

export function CoordinatorScreen() {
  usePrintableDisclosures();
  // Task 5: the screen's props stop being derived from the frozen `wardMovements` fixture and
  // `NOW_ANCHOR` constant and start coming from the shared provider (`WardFlowProvider`, already
  // wrapping every `/mockups/ward-flow` route via `src/app/mockups/ward-flow/layout.tsx`).
  //
  // Whole-branch review Critical 1: `units` IS now destructured and threaded into `FlowDiagram`
  // and `ShortlistPanel` below. It was deliberately left out here on the original claim that
  // "nothing this screen renders yet reads live unit state" — false: both child components read
  // unit capacity, and both were doing it from the frozen `ward-sites.ts` fixture instead.
  const {
    movements,
    units,
    bedReleases,
    leaveBeds,
    rejections,
    referrals,
    dispatch,
    focusMovementId,
    setFocusMovementId,
    configuration,
  } = useWardFlow();
  const now = useWardFlowClock();
  // Item 44, build plan task B1: the chosen health service, read from the shared store S2 built.
  // `null` means All services.
  const service = useServiceScope();
  // Task 12: seeded from the shared `focusMovementId` (not always `undefined`) so a coordinator
  // who switched away to answer a referral as another role and switches back finds the same
  // patient still selected — this screen remounts on every route change (it is a route
  // segment under the persistent `WardFlowProvider` layout, not the layout itself), so a plain
  // `useState(undefined)` would otherwise forget the selection on every round trip. See
  // `ward-flow-provider.tsx`'s doc comment on `focusMovementId` for why this lives in the shared
  // context rather than only here.
  //
  // Restored only while that movement is still OPEN. Found while reviewing the journey's own
  // final screenshot: an arrived movement is never reachable through the queue (`queueOrder`
  // filters to `isOpen` before this screen ever renders a row for it to click), so restoring the
  // selection unconditionally re-selected WF-315 after its own arrival and left the shortlist
  // showing "Currently at ARM" / "waiting in the emergency department" for a patient who had, in
  // fact, already left the department — stale copy for a record this screen has no other way to
  // select. Gating on `isOpen` keeps the restore doing its actual job (surviving a role switch
  // mid-journey) without inventing a selection path a live click could never produce.
  const [selectedMovementId, setSelectedMovementId] = useState<string | undefined>(() => {
    const restored = focusMovementId ? movements.find((movement) => movement.id === focusMovementId) : undefined;
    return restored && isOpen(restored) ? restored.id : undefined;
  });
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);
  const [selectedEdId, setSelectedEdId] = useState<string | undefined>(undefined);
  /**
   * Task C2: the shortlist's OTHER possible subject, independent of `selectedMovementId` above —
   * the drawing's own words, quoted in this task's brief: "Selecting the tab decides which list
   * is on screen. It never touches `state.movementId` or `state.referralId` — those decide which
   * one is the shortlist panel's SUBJECT, a separate question." Switching the priority queue's own
   * Patients/Referrals tab (local state inside `PriorityQueue`) never touches this.
   */
  const [selectedReferralId, setSelectedReferralId] = useState<string | undefined>(undefined);
  const queueFocusRef = useRef<HTMLDivElement>(null);
  const [exceptionsOpen, setExceptionsOpen] = useState(false);
  const [diagramExpansion, setDiagramExpansion] = useState<"normal" | "cover-shortlist" | "full-page">("normal");

  useEffect(() => {
    if (diagramExpansion !== "full-page") return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setDiagramExpansion("normal");
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [diagramExpansion]);
  // SSR and the first client paint must agree (matchMedia is unavailable on the server), so this
  // starts false — the same "assume desktop, correct after mount" convention
  // `usesPhoneSearchLayout` uses in master-search-header.tsx. `useLayoutEffect` (not `useEffect`)
  // keeps the window where `FlowDiagram` is needlessly mounted on a real phone as short as
  // possible — synchronously before the browser paints, rather than after.
  const [isPhoneDiagramLayout, setIsPhoneDiagramLayout] = useState(false);

  useLayoutEffect(() => {
    const phoneMedia = window.matchMedia(PHONE_DIAGRAM_MEDIA_QUERY);
    const sync = () => setIsPhoneDiagramLayout(phoneMedia.matches);
    sync();
    phoneMedia.addEventListener("change", sync);
    return () => phoneMedia.removeEventListener("change", sync);
  }, []);

  // Task 8 review Important 3 named the real constraint: on a phone, the full explainable
  // shortlist (candidates, all eight eligibility gates, every decline, the score breakdown) is
  // real, long content that does not fit above the fold on a 390px screen, so Confirm has to stay
  // reachable in one tap rather than a scroll a coordinator has to go looking for. This used to be
  // solved with a double-`requestAnimationFrame` `scrollIntoView` effect here, because the control
  // could land off-screen below the fold and the fix had to MEASURE where the scroll container had
  // settled after a resize (`.main`'s grid rows and `.screen`'s `100dvh` height had not always
  // finished resolving to the new viewport at the moment a single rAF ran — measured landing 256px
  // short on some runs, which is why a second rAF was nested on top of it).
  //
  // Task 7 replaces that with `.shortlistActionRow` pinned to the literal viewport bottom by CSS
  // on phone widths (`coordinator.module.css`, `@media (max-width: 48rem)`). A CSS-pinned bar
  // cannot land off-screen, so it never measures `.main`'s grid or `.screen`'s height — the exact
  // thing the deleted effect's comment named as the race it was working around. That race
  // dissolves rather than needing a replacement fix here.

  // Whole-branch review Critical 2, second half. Confirm now requires an explicit unit selection,
  // but `selectedUnitId` is screen-level state that outlived the movement it was chosen for: pick
  // a ward for patient A, then select patient B from the queue, and B inherited A's selection with
  // Confirm already available against it. That is the same defect the panel-level fix closes, just
  // sourced from a selection made for a different patient rather than from `shortlist[0]`. A unit
  // choice belongs to the movement it was made against, so changing movement clears it.
  function selectMovement(movementId: string | undefined) {
    setSelectedMovementId(movementId);
    setSelectedUnitId(undefined);
    // Task C2: selecting a movement hands the shortlist back to it — the drawing's own real
    // behaviour (`selectMovement` there clears `state.referralId` the same way). Without this, a
    // coordinator who opened a referral, then clicked a patient row from the Exceptions drawer or
    // the Patients tab, would see the movement they just clicked underneath a panel still titled
    // "Referral placement" and still explaining somebody else's referral.
    setSelectedReferralId(undefined);
    // Task 12: mirrored into the shared context so `WardRoleSwitcher` — rendered on every
    // ward-management route, not just this one — can infer a Ward/ED destination for whichever
    // patient was last selected here, even after a role switch has unmounted this screen.
    setFocusMovementId(movementId);
  }

  /**
   * Task C2: the other half of `selectMovement` above. Deliberately does NOT clear
   * `selectedMovementId` or touch `selectedUnitId` — the drawing's own `selectReferral` never
   * does either, because a referral and a movement are independent subjects and picking one
   * does not erase the other; it only decides which one the shortlist panel currently explains.
   */
  function selectReferral(referralId: string) {
    setSelectedReferralId(referralId);
  }

  // The provider's own `movements` array — never `movementById`, which reads the frozen fixture
  // and would never see a referral this screen just dispatched. An id the live array cannot
  // resolve still renders as `undefined` (Task 6 conservative-failure rule), so no fallback is
  // threaded through here.
  //
  // 🔴 WF-22: GATED ON `isOpen`, THE SAME AS THE FIRST-RENDER RESTORE ABOVE. Before this, a
  // movement that closed WHILE selected (a referrer withdrawal, a decline — anything the reducer
  // can reach mid-session) stayed resolvable here forever, because this `find` never re-checked
  // whether the movement was still open after the click that selected it. `FlowDiagram` and
  // `ShortlistPanel` below both read this value, so a closed movement kept being explained as
  // though a coordinator could still act on it. Restricting the restore-on-mount case but not
  // this one would have fixed the defect for exactly one render and let it right back in on the
  // next dispatch.
  const selectedMovement = selectedMovementId
    ? movements.find((movement) => movement.id === selectedMovementId && isOpen(movement))
    : undefined;

  // 🔴 WF-22, second half. `selectedMovementId` itself is left alone — clearing it here would
  // race the render above for no benefit, since `selectedMovement` already stops resolving it.
  // What this closes is the SHARED state: `focusMovementId` is read by `WardRoleSwitcher` on
  // every ward-management route (see the Task 12 comment on `selectMovement`) to infer a
  // destination for whichever patient was last selected here, and a closed movement is not a
  // destination anybody can still act on. Left set, a role switch after the close could infer a
  // destination for a movement this screen itself has already stopped showing. Focus follows the
  // same recipe `closeShortlist` already uses below, because the same failure applies: the
  // queue row for a movement that just closed unmounts (`queueOrder` filters to `isOpen`), and an
  // unmounted focused element leaves the browser to drop focus onto the page rather than the
  // queue that is still in front of the coordinator.
  useEffect(() => {
    if (selectedMovementId === undefined || selectedMovement !== undefined) return;
    setFocusMovementId(undefined);
    queueFocusRef.current?.querySelector<HTMLButtonElement>('button[aria-selected="true"]')?.focus();
  }, [selectedMovementId, selectedMovement, setFocusMovementId]);

  const selectedEd = selectedEdId ? allEmergencyDepartments().find((ed) => ed.id === selectedEdId) : undefined;
  // A `selectedEdId` this lookup cannot name must not leave the queue silently filtered with no
  // notice and no Clear control (Task 4 review Minor 8) — fall back to "nothing selected" rather
  // than substituting a record or keeping a filter active that can't be described on screen.
  const activeEdId = selectedEd?.id;
  // A one-line filter, not a derivation: it keys on a field the model already carries
  // (`Movement.originEdId`), so it belongs here rather than in a ward-*.ts module.
  const filteredMovements = activeEdId ? movements.filter((movement) => movement.originEdId === activeEdId) : movements;

  /**
   * Item 44, build plan task B1 (§2 "Command: the patients queue and pressure strip are scoped
   * ... The referrals tab follows referral membership ... S2 applies"). `service === null` (All
   * services) is a no-op filter — the same "with All services, it is unchanged" property the
   * D1/D2 lanes established — so the queue and referral tab render exactly as they did before
   * this task existed whenever no service is chosen. Independent of the ED filter above: a
   * coordinator can narrow by department and by service at once, and both narrow the SAME
   * Patients-tab population together (AND, not OR).
   */
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

  // §2 "Never hidden", S2: how many of the whole population resolve to no service at all (always
  // shown regardless of the choice) and, only while a service is chosen, how many URGENT
  // movements sit outside it — both feed the queue's own `WardServiceScopeBar`, read against the
  // screen's own whole `movements` (never the ED-filtered or service-scoped populations above),
  // the same "of {total}" the D1/D2 lanes report against. Finding 1 (2026-09-17 review): reads
  // `noRecordedServiceMovementCount` — open, network-wide — the SAME shared definition Delays and
  // Movements now use, so the figure can never disagree across screens.
  const noRecordedServiceCount = useMemo(() => noRecordedServiceMovementCount(movements, units), [movements, units]);
  const urgentOutsideServiceCount = useMemo(() => {
    if (service === null) return 0;
    const chosenService = service;
    return urgentMovementsOutsideService(movements.filter(isOpen), chosenService, units, now, configuration).length;
  }, [service, movements, units, now, configuration]);
  const queueServiceScope = service
    ? {
        service,
        shown: isInServiceScope ? movements.filter(isInServiceScope).length : movements.length,
        total: movements.length,
        noRecordedServiceCount,
        urgentOutside: { count: urgentOutsideServiceCount },
      }
    : undefined;

  // Task C2: the Referrals tab's own population. `referralQueueOrder` (`ward-referrals.ts`) is
  // `referralState(referral) === "queued"`, sorted urgency then `raisedAt` — the SAME established
  // derivation `wardNavCounts` already reads for its "awaiting a decision" sidebar figure, never
  // a second filter written down here. Not scoped to the ED filter (`activeEdId`): the drawing's
  // own filter bar disappears entirely on this tab, and Q-2 forbids filtering a referral by
  // location at all, ED-origin included. Item 44, task B1: scoped to the chosen service by
  // referral membership (never `homeRegion` — Q-2 forbids that join) once one is chosen.
  const referralQueueAll = referralQueueOrder(referrals);
  const referralQueue = isReferralInServiceScope ? referralQueueAll.filter(isReferralInServiceScope) : referralQueueAll;
  // Resolved out of `referralQueue` itself on every render, never captured once at click time —
  // the same discipline `ward-management-network.tsx`'s own `selectedReferral` holds to. A
  // referral that leaves the queue (accepted or declined elsewhere) therefore drops the selection
  // on its own, and the shortlist below falls back to explaining the selected movement instead of
  // going on describing a decision somebody has already taken.
  const selectedReferral = selectedReferralId
    ? referralQueue.find((referral) => referral.id === selectedReferralId)
    : undefined;
  const hasPanelSubject = Boolean(selectedReferral || selectedMovement);

  function closeShortlist() {
    selectMovement(undefined);
    // Closing is a view-only operation. Return keyboard focus to the queue rather than
    // leaving it on a control that has just unmounted with the shortlist.
    queueFocusRef.current?.querySelector<HTMLButtonElement>('button[aria-selected="true"]')?.focus();
  }

  // The exception inbox is the coordinator's global work list, not a view scoped to whatever ED
  // filter the queue happens to have selected — a breached legal deadline at a filtered-out
  // department must not silently drop off the work list just because the queue is filtered.
  // `movements` and `now` are both live now (Task 5), not constants, so this must recompute
  // whenever either changes rather than caching a single mount-time snapshot forever.
  //
  // Whole-branch review Minor 6: the inbox is scoped to OPEN movements. `buildActionInbox` has no
  // `isOpen` guard of its own and `movements` carries all 48 records including the 7 closed
  // ones, so passing the raw array put an arrived or did-not-proceed patient's breached deadline
  // on a live work list. Latent on today's fixture — no closed movement currently qualifies for
  // any of the three categories — but it is precisely the shape of Phase 1's "48 open movements"
  // defect, which was also a closed record counted as live.
  const actionInbox = useMemo(() => {
    const openMovements = movements.filter(isOpen);
    return buildActionInbox(openMovements, now, units).map((item) => {
      if (!item.id.startsWith("bed-pull-") && item.title !== "Bed pull expired") return item;
      return {
        ...item,
        title: "Reserved time has passed, bed still held",
        detail: `${item.detail} · Release the bed or set a new reserved time`,
      };
    });
  }, [movements, now, units]);
  const silenceReminders = useMemo(() => {
    const notes = new Map<string, string>();
    for (const movement of movements.filter(isOpen)) {
      const copy = answerSilenceReminder(movement, referrals, now);
      if (copy !== undefined) notes.set(movement.id, copy);
    }
    return notes;
  }, [movements, referrals, now]);

  // OD-3, the read side. `allOverrides` is the UNRESTRICTED read and this is the only screen
  // entitled to it — "the coordinator may see everything". The ward screen's own register calls
  // `overridesAgainstUnit` instead, and never this, which is what makes the ward scope a
  // restriction rather than a name for the only read there is.
  //
  // NOT scoped to `isOpen` and NOT scoped to the ED filter, unlike the queue and the inbox above.
  // Both would be wrong here for the same reason: an override that was made does not stop having
  // been made when the patient arrives or when the coordinator narrows the queue to one
  // department. An accountability record that empties as the day goes on is not one.
  const overrideRegister = useMemo(() => allOverrides(movements), [movements]);

  // Task 5: the same unrestricted-read reasoning as `overrideRegister` above, for the new
  // declines register — see `allDeclines`'s own comment in `ward-derivations.ts` for why there
  // is no ward-scoped counterpart to build here.
  const declineRegister = useMemo(() => allDeclines(movements), [movements]);

  return (
    <div className={styles.screen} data-testid="ward-coordinator" data-ward-design="third-edition">
      <main id="main-content" className={styles.main}>
        <h1 className="sr-only">Ward Flow coordinator</h1>

        <div className={styles.body} data-testid="ward-coordinator-body">
          <PressureStrip
            now={now}
            movements={movements}
            selectedEdId={selectedEdId}
            onSelectEd={setSelectedEdId}
            service={service}
          />

          <div
            className={styles.regionGrid}
            data-testid="ward-coordinator-region-grid"
            data-shortlist-open={hasPanelSubject}
            data-diagram-expansion={diagramExpansion}
            ref={queueFocusRef}
          >
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
              serviceScope={queueServiceScope}
              pullHoldMinutes={configuration.pullHoldMinutes}
            />

            {/*
              Task A (structured-wobbling-globe): the Command mockup draws the four registers as
              a panel directly beneath the Statewide flow diagram, in the same middle column —
              `section.panel.tabsPanel` under `.midCol > .diagPanel` — rather than the bar
              `ExceptionDrawer` used to render as `.main`'s own pinned third row (owner ruling:
              seen both, wants the mockup's). `.midCol` gives the two a shared column exactly the
              way the mockup's own CSS comment describes it: "the diagram, and directly beneath
              it the three registers as tabs" (four, here — `ExceptionDrawer` also carries
              Refused actions, which the mockup's example markup does not).
            */}
            <div className={styles.midCol}>
              <section
                className={styles.diagramRegion}
                aria-label="Statewide flow"
                data-fullscreen={diagramExpansion === "full-page" ? "true" : undefined}
              >
                <header className={styles.regionHeader}>
                  <h2>Statewide flow</h2>
                  {!hasPanelSubject ? (
                    <span className={styles.regionCount}>Select a patient or referral to open shortlist</span>
                  ) : null}
                  {selectedUnitId ? (
                    <button
                      type="button"
                      className={styles.clearSelectionButton}
                      onClick={() => setSelectedUnitId(undefined)}
                    >
                      Clear unit selection
                    </button>
                  ) : null}
                  <div className={styles.diagramHeaderControls}>
                    {hasPanelSubject ? (
                      <button
                        type="button"
                        className={styles.diagramEnlargeButton}
                        onClick={() =>
                          setDiagramExpansion((current) =>
                            current === "cover-shortlist" ? "normal" : "cover-shortlist",
                          )
                        }
                        aria-pressed={diagramExpansion === "cover-shortlist"}
                        title={
                          diagramExpansion === "cover-shortlist"
                            ? "Show the shortlist beside the diagram again"
                            : "Widen the diagram over the shortlist"
                        }
                      >
                        {diagramExpansion === "cover-shortlist" ? (
                          <>
                            <Columns2 aria-hidden="true" />
                            <span>Show shortlist</span>
                          </>
                        ) : (
                          <>
                            <PanelRightClose aria-hidden="true" />
                            <span>Widen diagram</span>
                          </>
                        )}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles.diagramEnlargeButton}
                      onClick={() =>
                        setDiagramExpansion((current) => (current === "full-page" ? "normal" : "full-page"))
                      }
                      aria-pressed={diagramExpansion === "full-page"}
                      title={diagramExpansion === "full-page" ? "Exit full page view (Esc)" : "Full page diagram view"}
                    >
                      {diagramExpansion === "full-page" ? (
                        <>
                          <Minimize2 aria-hidden="true" />
                          <span>Exit full page</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 aria-hidden="true" />
                          <span>Full page</span>
                        </>
                      )}
                    </button>
                  </div>
                </header>
                {/* Task 8 review Minor 5: `.diagramRegion` is already hidden by CSS below 48rem;
                    this stops `FlowDiagram` from mounting there too, rather than only painting
                    over its (still-running) ResizeObserver and layout-effect work. */}
                {isPhoneDiagramLayout ? null : (
                  <FlowDiagram
                    movement={selectedMovement}
                    movements={movements}
                    now={now}
                    units={units}
                    bedReleases={bedReleases}
                    leaveBeds={leaveBeds}
                    selectedUnitId={selectedUnitId}
                    onSelectUnit={(unitId) => setSelectedUnitId((current) => (current === unitId ? undefined : unitId))}
                    parallelReferralCap={configuration.parallelReferralCap}
                    service={service}
                  />
                )}
              </section>

              <ExceptionDrawer
                items={actionInbox}
                silenceReminders={silenceReminders}
                rejections={rejections}
                overrides={overrideRegister}
                declines={declineRegister}
                units={units}
                now={now}
                open={exceptionsOpen}
                onToggle={() => setExceptionsOpen((open) => !open)}
                // Task 8 review Important 3, still true on a phone after Task A's move: the open
                // registers panel is what stands between a coordinator and Confirm — selecting an
                // exception has done the panel's job (a movement is now chosen), so it closes
                // itself in the same tap rather than leaving a coordinator to scroll past it to
                // reach the shortlist underneath. From 48rem up this has no visible effect — the
                // panel is unconditionally shown there — which is harmless, not a bug: see
                // `ExceptionDrawer`'s own file comment on why `open` still exists at every width.
                onSelectMovement={(movementId) => {
                  selectMovement(movementId);
                  setExceptionsOpen(false);
                }}
              />
            </div>

            {hasPanelSubject ? (
              <>
                <div
                  className={`${styles.shortlistBackdrop} ${shortlistStyles.shortlistBackdrop ?? ""}`}
                  onClick={closeShortlist}
                  aria-hidden="true"
                  data-testid="ward-coordinator-shortlist-backdrop"
                />
                <div className={`${styles.shortlistColumn} ${shortlistStyles.shortlistColumn ?? ""}`}>
                  {/*
                  Task C2: the panel retitles from "Explainable shortlist" to "Referral placement"
                  when a referral, rather than a movement, is the shortlist's subject — the second
                  half of this task, closing the gap `tests/ward-command-third-edition.dom.test.tsx`
                  used to document. `selectedReferral` (above) already falls back to `undefined` the
                  moment the referral it names leaves the queue, so this can never keep claiming a
                  subject that no longer resolves.
                */}
                  <aside
                    className={`${styles.shortlistRegion} ${shortlistStyles.shortlistRegion ?? ""}`}
                    aria-label={selectedReferral ? "Referral placement" : "Explainable shortlist"}
                    // Names sweep, 26 Sept 2026: the WF number left the visible text, so journeys
                    // prove WHICH movement the panel is for by this attribute, never by wording.
                    data-subject-movement={selectedReferral ? undefined : selectedMovement?.id}
                  >
                    <div className={`${styles.sheetHandle} ${shortlistStyles.sheetHandle ?? ""}`} aria-hidden="true" />
                    <header className={styles.regionHeader}>
                      <h2>{selectedReferral ? "Referral placement" : "Explainable shortlist"}</h2>
                      <button
                        type="button"
                        className={styles.closeShortlistButton}
                        onClick={closeShortlist}
                        aria-label="Close shortlist and clear selection"
                      >
                        Close
                      </button>
                    </header>
                    {/* §2 "Never hidden", S1, and §3 "Command", shortlist: the bed shortlist and its
                     *  eligibility candidates are never narrowed by the chosen service (Q-2's own
                     *  "no bed is hidden or excluded by where someone lives" carried to this, the
                     *  screen's other never-scoped surface). Sits here, in `coordinator-screen.tsx`,
                     *  rather than inside `shortlist-panel.tsx` — that file belongs to the legal
                     *  plan's own task, per this task's brief. */}
                    {service ? (
                      <p className={styles.placeholder} data-testid="ward-shortlist-not-scoped">
                        Beds are never narrowed by service. Every ward in the network is considered.
                      </p>
                    ) : null}
                    {selectedReferral ? (
                      <ReferralPlacementPanel referral={selectedReferral} now={now} />
                    ) : (
                      <ShortlistPanel
                        movement={selectedMovement}
                        now={now}
                        units={units}
                        bedReleases={bedReleases}
                        leaveBeds={leaveBeds}
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
              </>
            ) : null}
          </div>
        </div>
        <WardPrototypeFooter
          testId="ward-coordinator-governance"
          note={
            <>
              Live coordinator view · Not a medical device
              <span
                className={
                  rejections.length > 0 ? styles.exceptionsToggleRefusalCount : styles.exceptionsToggleRecordCount
                }
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
