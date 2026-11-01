"use client";

import { deskPlaceLabel } from "@/components/ward-management/shell/ward-bar-desk-place";
import { fieldsMatchEveryWord } from "@/components/ward-management/search/search-text";
import { currentLegalDueAt } from "@/components/ward-management/legal-forms/legal-forms-derivations";
import Link from "next/link";

import { dayOf, formatInstantWithDay, splitDuration } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { SEVERE_CAUSES, delayGroups, type DelayCause } from "@/components/ward-management/delays/delays-derivations";
import {
  useDueSoonThresholds,
  useWardFlowClock,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import { WardGroupHeading, WardRecordList } from "@/components/ward-management/ward-record-row";
import { startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { edById } from "@/components/ward-management/ward-sites";
import { useAddressTab } from "@/components/ward-management/ward-url-state";
import type { Movement } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import {
  byLongestWait,
  corridorCounts,
  deriveMovementHorizonLanes,
  journeyStages,
  refusedCorridorCounts,
  transportCounts,
  transportLegs,
  type MovementLegState,
} from "./movements-derivations";
import { useWardChecksPublisher } from "@/components/ward-management/shell/ward-checks";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { WardServiceScopeBar } from "@/components/ward-management/shell/ward-service-scope-bar";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import {
  movementBelongsToService,
  noRecordedServiceMovementCount,
  urgentMovementsOutsideService,
} from "@/components/ward-management/ward-service-scope";
import { ArrowRight, ArrowRightLeft, ChartColumn, Hourglass, Scale, Search, ShieldCheck, Truck, X } from "lucide-react";
import {
  Card,
  CardHead,
  Hero,
  LiveChip,
  PhoneFilterFold,
  RadioGroup,
  StatusGlyph,
  TextInput,
  buttonClass,
  cx,
  durMinutes,
  phoneRows,
  useIsPhone,
} from "@/components/wf";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { MovementDrawer } from "./movement-drawer";
import { MovementHorizonGantt } from "./movement-horizon-gantt-lazy";
import { rankCorridorPairs } from "./movement-corridor-pairs";
import { isCoordinatorStep, movementNextStep } from "./movement-next-step";
import { useSenderPresentation } from "../ward-sender-presentation";
import { movementPresentation } from "../ward-partial-view-presenters";
import flow from "./movement-flow.module.css";
import board from "@/components/ward-management/delays/delays-board.module.css";
import strip from "@/components/ward-management/delays/waiting-polish.module.css";
import styles from "./movements.module.css";
import wardPin from "../ward-pinned-switch.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { MovementsPhoneNav } from "./movements-phone-nav";
import { rememberReturnRow, rowWithAttribute, useReturnedView, useReturnToPlace } from "../use-return-to-place";
import { ShapeOfTheDay } from "./movements-shape-of-day";
import { HighlightStat, PhoneGroupHeading, StageRow } from "./movements-stage-row";
import { CommunityNoJourneys, StagePipeline } from "./movements-lazy-parts";
import {
  CAUSES,
  GROUP_CAP,
  LEG_STATE_LABEL,
  LEG_STATE_TONE,
  LIST_CAP,
  STAGE_SHORT,
  bedReadyNote,
  causeOf,
  heroHighlights,
  inServiceSuffix,
  moreNote,
  movementSearchText,
  transportRouteLabels,
} from "./movements-screen-helpers";
export { causeOf, inServiceSuffix } from "./movements-screen-helpers";

const MOVEMENT_BOARD_TABS = ["every", "resolved"] as const;
const MOVEMENTS_ROUTE = "/ward-flow/movements";
/** What Back brings back (`use-return-to-place.ts`). The tab lives in the address, and the search is typed text, so neither is kept here. */
type MovementsPlace = {
  order: "stands" | "cause" | "transport" | "wait";
  shapeTab: "stage" | "transport" | "waiting" | "resolved";
  sideView: "transport" | "shape";
  phoneOpenGroups: ReadonlySet<string>;
  showAll: boolean;
  highlight: string | null;
};
const worklistRow = (id: string) => rowWithAttribute("data-record-key", id, "li");

/**
 * MERGE 03 — the patient movement board (`MovementsView`, a stage strip) and the coordinator's live
 * transport tracker (`LiveTracker`) fold into one screen. **They are the same patients at two points
 * of one journey**, and together this screen answers: where is each patient in their move, and what
 * is carrying them?
 *
 * ⚠️ **THE SCREEN COMPUTES NOTHING BEYOND PRESENTATION.** Every group, every leg and every count
 * comes from `journeyStages`, `transportLegs` or `transportCounts` (`movements-derivations.ts`) —
 * this file only reads real fields off the `Movement` each of those hands back (cohort, sex, legal
 * status, owner, origin department) to fill in a row, the same discipline `delays-screen.tsx`
 * follows for its own rows.
 *
 * ⚠️ **`LiveTracker` WAS THE ONLY SURFACE IN THE APP THAT EVER RENDERED THE TRANSPORT FACTS BELOW**
 * (provider, origin department, destination unit, time since the last stamp, the honest count of
 * open movements with no transport leg booked, and the "Review patient" link). All of them are
 * carried onto the transport panel here rather than silently dropped — the design lock names the
 * Delays merge's own 30-of-42 audit as exactly the failure mode this guards against.
 */
export function MovementsScreen() {
  const returned = useReturnedView<MovementsPlace>(MOVEMENTS_ROUTE);
  const thresholds = useDueSoonThresholds();
  const { movements, units, referrals, patients, dispatch, configuration, setFocusMovementId } = useWardFlowSelect(
    "movements",
    "units",
    "referrals",
    "patients",
    "dispatch",
    "configuration",
    "setFocusMovementId",
  );
  const now = useWardFlowClock();
  // Task 6 of the audit-wiring plan, 2026-09-16: StageRow's wait-meter bar and its "of N hours"
  // caption are read against the coordinator-configured ED access target, not a bare 24h literal.
  const accessTarget = configuration.edAccessTargetMinutes;
  // Build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md` §2 "Movements", task D2: the
  // chosen health service, read from the shared store S2 built. `null` means All services.
  const service = useServiceScope();
  // Community clinician desk (D-76): the team's own journeys only (the desk's scope already narrows
  // them). The officers' Transport board and the coordinator's queue are not this desk's.
  const access = useEffectiveWardAccess();
  const community = access.role === "community";
  const teamName = access.scope.kind === "team" ? access.scope.teamName : undefined;

  /**
   * **M2, shape ③ (Ward Lead, 2026-09-11). The open/closed split is a MARKING and a SORT, never a
   * population this region is defined by.**
   *
   * 🔴 **The drawing splits this region into five open-only tabs and pushes closed movements into
   * two summed figures below a divider.** Its stated reason: *"A closed movement carries no cause,
   * no stage, no wait and no transport leg."* ⚠️ **Measured against this seed, all four clauses are
   * false — 7 of 7 carry a blocker, a stage and an openedAt, and 6 of 7 carry a transport leg.**
   * Building it as drawn would have reversed the owner's 2026-09-05 ruling (below) on a premise
   * that does not hold, with every gate green.
   */
  const [detailId, setDetailId] = useState<string | null>(null);

  const openDetail = useCallback((id: string) => {
    setDetailId(id);
    rememberReturnRow(MOVEMENTS_ROUTE, id);
    if (typeof window !== "undefined") {
      const priorState =
        typeof window.history.state === "object" && window.history.state !== null ? window.history.state : {};
      window.history.pushState({ ...priorState, wardMovementDetail: id }, "");
    }
  }, []);

  const closeDetail = useCallback(() => {
    if (typeof window !== "undefined" && window.history.state?.wardMovementDetail) {
      window.history.back();
    }
    setDetailId(null);
  }, []);

  useEffect(() => {
    function handlePopState() {
      setDetailId(null);
    }
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Usability review, 24 Oct 2026: the tab lives in the address, so Back from a record returns to it.
  const [boardTab, setBoardTab] = useAddressTab("tab", MOVEMENT_BOARD_TABS, "every");
  // A ref, not state: it only records which tab a key press asked to focus, so the layout effect
  // below can move focus once the new selection has committed. Nothing renders from it.
  const keyboardTabFocus = useRef<"every" | "resolved" | null>(null);
  useLayoutEffect(() => {
    if (keyboardTabFocus.current !== boardTab) return;
    document.getElementById(`movements-tab-${boardTab}`)?.focus();
    keyboardTabFocus.current = null;
  }, [boardTab]);
  const [order, setOrder] = useState<MovementsPlace["order"]>(returned?.order ?? "stands");
  const [shapeTab, setShapeTab] = useState<MovementsPlace["shapeTab"]>(returned?.shapeTab ?? "stage");
  const [sideView, setSideView] = useState<"transport" | "shape">(returned?.sideView ?? "transport");
  // Phone (v10): the timeline, corridors and transport panels open as sheets from nav cards.
  const isPhone = useIsPhone();
  const [phoneSheet, setPhoneSheet] = useState<"arrivals" | "corridors" | "transport" | null>(null);
  // v10 phone: Arrivals ahead reads as a list; the timeline opens under it on request.
  const [phoneArrivalsTimeline, setPhoneArrivalsTimeline] = useState(false);
  // v10 phone: each worklist group opens on its own "Show N more" row.
  const [phoneOpenGroups, setPhoneOpenGroups] = useState<ReadonlySet<string>>(
    () => returned?.phoneOpenGroups ?? new Set(),
  );
  // v6 worklist: a search over name, UMRN or ED, and a short list per group until Show all.
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(returned?.showAll ?? false);
  // Hero highlight: one of `heroHighlights` by id, or `stage:<stage>` from the stage track.
  const [highlight, setHighlight] = useState<string | null>(returned?.highlight ?? null);
  const place: MovementsPlace = { order, shapeTab, sideView, phoneOpenGroups, showAll, highlight };
  useReturnToPlace(MOVEMENTS_ROUTE, place, worklistRow);
  function toggleHighlight(key: string) {
    setHighlight((current) => (current === key ? null : key));
    setSearch("");
    setBoardTab("every");
  }

  const [reveal, setReveal] = useState<{ id: string; request: number } | null>(null);
  const consumedReveal = useRef(0);
  const consumeReveal = useCallback((request: number) => {
    if (request <= consumedReveal.current) return false;
    consumedReveal.current = request;
    return true;
  }, []);

  function revealMovement(id: string, byStage = false) {
    setBoardTab("every");
    // A jump must land on a rendered row: clear a search that would hide it. A row past its
    // group's short list is kept on screen by `pinnedRowIds` below.
    setSearch("");
    if (byStage) setOrder("stands");
    // A request number makes a second click on the same record scroll and focus again.
    setReveal((previous) => ({ id, request: (previous?.request ?? 0) + 1 }));
  }

  const sender = useSenderPresentation();
  const stages = useMemo(() => journeyStages(movements, now, thresholds), [movements, now, thresholds]);
  const closedMovements = useMemo(() => movements.filter((movement) => !isOpen(movement)), [movements]);
  const closedToday = useMemo(
    () =>
      closedMovements.filter((movement) => movement.closure !== undefined && dayOf(movement.closure.at) === dayOf(now)),
    [closedMovements, now],
  );
  /*
   * ⚠️ Ordered by `byLongestWait`, not left in fixture order. The footer states ONE order over all
   * three groups, longest wait first (D-71), and a group rendered in whatever order the array
   * happened to arrive in would make that sentence false under this option.
   */
  // Active corridors are open movements with an accepting ward. Same-day declines are derived
  // separately because a decline has no journey stage of its own. The records do not support an
  // honest "unused corridor" count, so the drawing's illustrative third category is omitted.
  const corridors = useMemo(
    () =>
      [...corridorCounts(movements)].sort(
        (a, b) => b.count - a.count || (a.originEdId < b.originEdId ? -1 : a.originEdId > b.originEdId ? 1 : 0),
      ),
    [movements],
  );
  const refusedCorridors = useMemo(() => refusedCorridorCounts(movements, now), [movements, now]);

  const withLeg = useMemo(
    () =>
      byLongestWait(
        movements.filter((movement) => movement.transport?.acceptedAt !== undefined),
        now,
        thresholds,
      ),
    [movements, now, thresholds],
  );
  const withoutLeg = useMemo(
    () =>
      byLongestWait(
        movements.filter((movement) => movement.transport === undefined),
        now,
        thresholds,
      ),
    [movements, now, thresholds],
  );
  const requestedLeg = useMemo(
    () =>
      byLongestWait(
        movements.filter((movement) => movement.transport !== undefined && movement.transport.acceptedAt === undefined),
        now,
        thresholds,
      ),
    [movements, now, thresholds],
  );

  // `transportLegs` takes whichever list the caller passes (the derivation's own comment says so
  // explicitly) — `LiveTracker`, the screen this replaces, scoped itself to OPEN movements only, so
  // this screen keeps that same scope rather than silently widening it to every movement ever
  // booked a vehicle.
  /**
   * 🔴 **THE FIRST SCREEN IN THE APPLICATION TO PUBLISH A RECONCILIATION CHECK — O-9, 2026-09-12.**
   *
   * **Until this line, `layout.tsx` passed `checks={[]}` on every ward route and nothing under
   * `src/` built a check at all**, so every screen said *"No reconciliation is available for this
   * page yet."* — truthfully, and forever. ⚠️ **A mechanism with no producer is the shape this
   * repository already has two P1 examples of: built, correct, tested and unreachable.** **So O-9
   * ships with a real publisher on a real route rather than waiting for its intended consumer.**
   *
   * ✅ **The check is one this screen ALREADY has to be right about**, not one invented to have
   * something to publish: the seven stage groups partition every movement, so their lengths must
   * sum to the total the panel heading states. **If they ever do not, this board is showing a
   * patient twice or not at all** — and the rail and the bar now say so on every ward route.
   *
   * ⚠️ **`useMemo` IS LOAD-BEARING, NOT TIDINESS.** The publisher compares by identity; a fresh
   * array literal every render would republish on every render, and the shell would resubscribe in
   * a loop.
   *
   * 🔴 **THE SUM IS COMPUTED INSIDE THE MEMO, AND THE FIRST VERSION COMPUTED IT OUTSIDE.** The
   * React Compiler's `preserve-manual-memoization` rule rejected that outright — *"This dependency
   * may be modified later"* — so `npm run lint` was RED on the exact line whose comment called it
   * load-bearing. ⚠️ **Neither `vitest` nor `tsc` sees a lint rule**, and the commit that shipped it
   * reported a green typecheck and a hand-picked test list, so nothing contradicted it.
   *
   * 🔴 **AND THE CHECK ITSELF IS WEAKER THAN ITS OWN SENTENCE — measured, not assumed.**
   * `journeyStages` maps over `MOVEMENT_STAGES` and buckets by `movement.stage`, which is typed
   * `MovementStage`, so the partition holds BY CONSTRUCTION and `ok` cannot currently be false.
   * **It is a real check of a real property, and today the type system already guarantees it** —
   * so it proves the publication path works and does not yet exercise the failing branch. **Said
   * here rather than left for a reader to discover, because the sentence beside it reads as though
   * a coordinator might one day see it fire.**
   */
  const checks = useMemo(
    () => [
      {
        label: "Every movement appears exactly once across the seven stages",
        ok: stages.reduce((sum, stage) => sum + stage.movements.length, 0) === movements.length,
      },
    ],
    [stages, movements],
  );
  useWardChecksPublisher(checks);

  const openMovements = useMemo(() => movements.filter(isOpen), [movements]);
  const openStages = useMemo(() => journeyStages(openMovements, now, thresholds), [openMovements, now, thresholds]);
  const waitingMovements = useMemo(
    () => byLongestWait(openMovements, now, thresholds),
    [openMovements, now, thresholds],
  );
  const unacceptedTransport = useMemo(
    () =>
      byLongestWait(
        openMovements.filter(
          (movement) => movement.transport !== undefined && movement.transport.acceptedAt === undefined,
        ),
        now,
        thresholds,
      ),
    [openMovements, now, thresholds],
  );
  const noTransportRecord = useMemo(
    () =>
      byLongestWait(
        openMovements.filter((movement) => movement.transport === undefined),
        now,
        thresholds,
      ),
    [openMovements, now, thresholds],
  );
  const legs = useMemo(() => transportLegs(openMovements, now, thresholds), [openMovements, now, thresholds]);
  const counts = useMemo(() => transportCounts(legs), [legs]);
  // Audit round 2, A4-18: only a pulled bed or later needs transport, so a referred-stage movement
  // is not "without" a leg.
  const legMovementIds = useMemo(() => new Set(legs.map((leg) => leg.movement.id)), [legs]);
  const withoutTransport = useMemo(
    () =>
      openMovements.filter(
        (m) =>
          (m.stage === "pulled" || m.stage === "handover_ready" || m.stage === "moving") && !legMovementIds.has(m.id),
      ).length,
    [openMovements, legMovementIds],
  );
  const activeCorridorCount = useMemo(
    () => new Set(corridors.map((corridor) => JSON.stringify([corridor.originEdId, corridor.acceptedUnitId]))).size,
    [corridors],
  );
  const horizonLanes = useMemo(
    () =>
      deriveMovementHorizonLanes(movements, units, now, {
        includeProjections: false,
        people: { patients, referrals, movements },
      }),
    [movements, units, now, patients, referrals],
  );

  // R2 item 2: the one source of truth for "which movements are legal_breached, legal_expiring or
  // no_eligible_bed today" — Delays' own `delayGroups`, built once here and read by `causeOf` below
  // rather than this screen re-deriving its own (and disagreeing) opinion of the same three causes.
  // `openMovements` (above) is a plain `const`, recomputed fresh every render from `movements` —
  // the React Compiler's `preserve-manual-memoization` rule will not accept it as a dependency
  // here (same shape already documented on the `checks` memo above: "This dependency may be
  // modified later"), so each memo below recomputes the open-movements filter itself from the
  // stable `movements`/`isOpen` it is actually derived from.
  const severeCauseById = useMemo(() => {
    const map = new Map<string, DelayCause>();
    for (const group of delayGroups(movements.filter(isOpen), units, now, thresholds)) {
      if (!SEVERE_CAUSES.includes(group.cause)) continue;
      for (const movement of group.movements) map.set(movement.id, group.cause);
    }
    return map;
  }, [movements, units, now, thresholds]);

  const causeGroups = useMemo(() => {
    return CAUSES.map((c) => {
      const items = byLongestWait(
        movements
          .filter(isOpen)
          .filter((m) => causeOf(m, now, severeCauseById, movementPresentation(m, sender.movementFor(m))) === c.key),
        now,
        thresholds,
      );
      return {
        key: c.key,
        title: c.title,
        note: c.key === "awaiting_bed_ready" ? bedReadyNote(items) : c.note,
        sev: c.sev,
        mark: c.mark,
        movements: items,
      };
    }).filter((g) => g.movements.length > 0);
  }, [movements, now, severeCauseById, thresholds, sender]);

  /**
   * SERVICE SCOPING — build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md` §2
   * "Movements": *"the list is scoped. Figures and the 48-hour chart are not, and a sentence says
   * so."* Every `worklist*` value below is read ONLY by the Movement worklist panel further down
   * this file. Nothing else in this component reads them — the Day panel's headline metrics, the
   * traffic panel's `horizonLanes`/`corridors`/`refusedCorridors`, the Transport-right-now bar and
   * the Shape-of-the-day panel all keep reading the original `movements`/`openMovements`/
   * `closedToday`/`legs`/`counts` exactly as this screen already did before this task — so "the
   * headline figures and the horizon chart lanes are identical with and without a service" holds
   * by construction: this task never touches the variables those panels render from, and never
   * touches `movement-horizon-gantt.tsx` at all.
   *
   * Falling back to the ORIGINAL array (`stages`, `closedToday`, `causeGroups`, `withLeg`, ...)
   * rather than recomputing an equivalent one when no service is chosen is what makes "with All
   * services, it is unchanged" true by construction too — the unscoped branch below is the exact
   * same reference this screen already rendered before this task existed.
   */
  const isInServiceScope = useMemo(() => {
    if (service === null) return null;
    const chosenService = service;
    return (movement: Movement) => movementBelongsToService(movement, chosenService, units);
  }, [service, units]);

  // Phone: the first tab is "Open", so its rows and count are the open movements only; closed ones
  // are on "Resolved today". Tablet and desktop list both and say so ("Open and resolved", device
  // audit 11 Oct 2026: "Every movement 77" read as a clash with the hero's 70 open).
  const worklistMovements = useMemo(() => {
    const scoped = isInServiceScope ? movements.filter(isInServiceScope) : movements;
    return isPhone ? scoped.filter(isOpen) : scoped;
  }, [movements, isInServiceScope, isPhone]);
  const worklistStages = useMemo(
    () => (isInServiceScope || isPhone ? journeyStages(worklistMovements, now, thresholds) : stages),
    [isInServiceScope, isPhone, worklistMovements, stages, now, thresholds],
  );
  const worklistClosedToday = useMemo(
    // Movements redesign (1 Nov 2026): the most recently closed first, so the list reads as a log.
    () =>
      (isInServiceScope ? closedToday.filter(isInServiceScope) : closedToday)
        .slice()
        .sort((a, b) => (b.closure?.at ?? 0) - (a.closure?.at ?? 0)),
    [closedToday, isInServiceScope],
  );
  const worklistCauseGroups = useMemo(() => {
    if (!isInServiceScope) return causeGroups;
    return causeGroups
      .map((group) => ({ ...group, movements: group.movements.filter(isInServiceScope) }))
      .filter((group) => group.movements.length > 0);
  }, [causeGroups, isInServiceScope]);
  const worklistWithLeg = useMemo(
    () => (isInServiceScope ? withLeg.filter(isInServiceScope) : withLeg),
    [withLeg, isInServiceScope],
  );
  const worklistRequestedLeg = useMemo(
    () => (isInServiceScope ? requestedLeg.filter(isInServiceScope) : requestedLeg),
    [requestedLeg, isInServiceScope],
  );
  const worklistWithoutLeg = useMemo(
    () => (isInServiceScope ? withoutLeg.filter(isInServiceScope) : withoutLeg),
    [withoutLeg, isInServiceScope],
  );
  const worklistTransportGroups = useMemo(
    () => [
      { id: "with", title: "Transport booked", rows: worklistWithLeg },
      { id: "requested", title: "Transport not accepted", rows: worklistRequestedLeg },
      { id: "without", title: "No transport yet", rows: worklistWithoutLeg },
    ],
    [worklistWithLeg, worklistRequestedLeg, worklistWithoutLeg],
  );

  // §2 "Never hidden", S2: how many of the whole population resolve to no service at all (always
  // shown regardless of the choice — `ward-service-scope.ts`'s own doc comment) and, only while a
  // service is chosen, how many URGENT movements sit outside it. Both feed `WardServiceScopeBar`.
  // Finding 1 (2026-09-17 review): the no-recorded-service count reads `noRecordedServiceMovementCount`
  // — open, network-wide — the SAME shared definition Delays and Command now use, so the figure
  // can never disagree across screens. `movements` here is already the whole unscoped population.
  const noRecordedServiceCount = useMemo(() => noRecordedServiceMovementCount(movements, units), [movements, units]);
  const urgentOutsideServiceCount = useMemo(() => {
    if (service === null) return 0;
    const chosenService = service;
    return urgentMovementsOutsideService(movements.filter(isOpen), chosenService, units, now, configuration).length;
  }, [service, movements, units, now, configuration]);

  // Movements overhaul (9 Oct 2026): search and the hero highlights MARK rows, they never hide one
  // ("filters highlight, never hide"). A marked row stays on screen past its group's short list.
  const searchTerm = search.trim().toLowerCase();
  const matchesSearch =
    searchTerm === ""
      ? null
      : // Every word, folded, in any order: "OQuinn" finds O'Quinn and "UM 100001" the UMRN.
        (movement: Movement) => fieldsMatchEveryWord(searchTerm, [movementSearchText(movement, patients, referrals)]);
  const highlightOptions = heroHighlights(now, accessTarget);
  const highlightTest: ((movement: Movement) => boolean) | null =
    highlight === null
      ? null
      : highlight.startsWith("stage:")
        ? (movement) => isOpen(movement) && movement.stage === highlight.slice("stage:".length)
        : (highlightOptions.find((option) => option.id === highlight)?.test ?? null);
  const isMarked = (movement: Movement) =>
    matchesSearch !== null ? matchesSearch(movement) : highlightTest !== null && highlightTest(movement);
  const shownStages = worklistStages;
  const shownCauseGroups = worklistCauseGroups;
  const shownTransportGroups = worklistTransportGroups;
  const shownByWait = useMemo(
    () => byLongestWait(worklistMovements, now, thresholds),
    [worklistMovements, now, thresholds],
  );
  const shownClosedToday = worklistClosedToday;
  const searchedTotal = matchesSearch ? worklistMovements.filter(matchesSearch).length : null;
  const markedTotal =
    matchesSearch !== null || highlightTest !== null
      ? (boardTab === "resolved" ? worklistClosedToday : worklistMovements).filter(isMarked).length
      : null;
  const highlightLabel =
    highlight === null
      ? null
      : highlight.startsWith("stage:")
        ? (STAGE_SHORT[highlight.slice("stage:".length) as Movement["stage"]] ?? null)
        : (highlightOptions.find((option) => option.id === highlight)?.label ?? null);

  // Each group shows its first rows until Show all. A row the reader jumped to, opened or marked
  // stays on screen even past that point, so a jump or a highlight always lands on a visible row.
  const pinnedRowIds = new Set<string>([reveal?.id, detailId].filter((id): id is string => typeof id === "string"));
  const capping = !showAll;
  const capRows = (rows: Movement[], cap: number) =>
    capping
      ? rows.filter((movement, index) => index < cap || pinnedRowIds.has(movement.id) || isMarked(movement))
      : rows;
  /* Device audit, 11 Oct 2026: on phone a group opens as its header and count; one tap shows its rows. */
  const groupRows = (id: string, rows: Movement[]) =>
    isPhone
      ? phoneOpenGroups.has(id)
        ? rows
        : rows.filter((movement) => pinnedRowIds.has(movement.id) || isMarked(movement))
      : capRows(rows, GROUP_CAP);
  const togglePhoneGroup = (id: string) =>
    setPhoneOpenGroups((open) => {
      const next = new Set(open);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const hiddenIn = (groups: Movement[][], cap: number) =>
    groups.reduce((sum, rows) => sum + rows.length - capRows(rows, cap).length, 0);
  const hiddenRowCount =
    boardTab === "resolved"
      ? hiddenIn([shownClosedToday], LIST_CAP)
      : order === "stands"
        ? hiddenIn(
            shownStages.map((stage) => stage.movements),
            GROUP_CAP,
          )
        : order === "transport"
          ? hiddenIn(
              shownTransportGroups.map((group) => group.rows),
              GROUP_CAP,
            )
          : order === "cause"
            ? hiddenIn(
                shownCauseGroups.map((group) => group.movements),
                GROUP_CAP,
              )
            : hiddenIn([shownByWait], LIST_CAP);
  const worklistListTotal = boardTab === "resolved" ? worklistClosedToday.length : worklistMovements.length;
  const worklistFootText = matchesSearch
    ? `${markedTotal ?? 0} of ${worklistListTotal} match, highlighted`
    : boardTab === "resolved"
      ? "Resolved today, most recent first"
      : order === "stands"
        ? "Grouped by stage, tier then wait"
        : order === "transport"
          ? "Grouped by transport, longest wait first"
          : order === "cause"
            ? "Grouped by cause, longest wait first"
            : "Longest wait first";
  const renderRow = (movement: Movement) => (
    <StageRow
      key={movement.id}
      movement={movement}
      now={now}
      units={units}
      referrals={referrals}
      patients={patients}
      accessTargetMinutes={accessTarget}
      reveal={reveal}
      consumeReveal={consumeReveal}
      onOpenDetail={openDetail}
      onFocusMovement={setFocusMovementId}
      marked={isMarked(movement)}
      selected={detailId === movement.id}
    />
  );

  /**
   * D-d (Ward Lead's decisions, 2026-09-17, amending build plan §2 after an Opus adversarial
   * review, R1): a jump link that targets a movement OUTSIDE the scoped worklist must never
   * silently do nothing. `revealMovement` below only scrolls to a row inside `worklistStages`, and
   * a movement the chosen service excludes has no row there — so a click on "Find WF-xxx in
   * worklist" or a stage-summary link for such a movement would read as broken, the exact shape of
   * defect this repository's own `dead-code-deletion`/wiring rules exist to catch for a BUTTON;
   * this is the same failure one layer up, where the button works but its target is scoped away.
   *
   * This opens that movement's own drawer instead — the one surface on this screen that already
   * shows a movement regardless of scope — and announces exactly why the worklist itself did not
   * move, per the exact §D-d sentence. `movements` here is the whole, unscoped population (from
   * `useWardFlow()`), so the lookup always finds a real movement whether or not it is in scope.
   */
  function jumpToMovement(movementId: string, byStage = false) {
    if (service !== null && isInServiceScope !== null) {
      const target = movements.find((candidate) => candidate.id === movementId);
      if (target !== undefined && !isInServiceScope(target)) {
        openDetail(movementId);
        announceToWardShell(`This patient is outside ${service}. Show all services to see it in the list.`);
        return;
      }
    }
    revealMovement(movementId, byStage);
  }

  const arrivedMovements = closedToday.filter((m) => m.closure?.outcome === "arrived");
  const didNotProceedMovements = closedToday.filter((m) => m.closure?.outcome === "did_not_proceed");

  // Hero tools (Josh, 9 Oct 2026: every page header carries page-specific tools). Each reads only
  // the open records: the longest wait, the next recorded legal expiry (a typed `dueAt`, never a
  // computed limit, D5), and the coordinator's own queue of next steps.
  // The earliest opened open movement.
  const longestWaiting = [...openMovements].sort((a, b) => a.openedAt - b.openedAt || a.id.localeCompare(b.id))[0];
  const nextExpiry = openMovements
    .filter((movement) => (currentLegalDueAt(movement) ?? -Infinity) >= now)
    .sort((a, b) => currentLegalDueAt(a)! - currentLegalDueAt(b)!)[0];
  const myQueue = byLongestWait(
    openMovements.filter(
      (movement) =>
        movementPresentation(movement, sender.movementFor(movement)).kind === "record" &&
        isCoordinatorStep(movementNextStep(movement)),
    ),
    now,
    thresholds,
  ); // Wait order only (Audit 1, Josh 20 Oct 2026, D-71): flags and tier never move a row.
  // Phone nav cards: who is inbound to a ward, and the ranked ED to ward corridors.
  const phoneInbound = openMovements.filter((movement) => movement.acceptedUnitId);
  const phoneInboundWards = new Set(phoneInbound.map((movement) => movement.acceptedUnitId)).size;
  const phoneCorridors = rankCorridorPairs(corridors);
  // The live transport legs: the side card's feed on the larger screen, a sheet on phone.
  // Movements redesign (1 Nov 2026): the legs grouped by where they stand, on the road first, so
  // each row needs no status chip of its own. The route is short ("SCGH ED → BTY Adult Secure");
  // the provider is in the row's title and the record.
  const LEG_GROUP_ORDER: readonly MovementLegState[] = ["Collected", "En route", "Accepted", "Arrived", "Cancelled"];
  const LEG_GROUP_WORD: Record<MovementLegState, string> = {
    Collected: "on the road",
    "En route": "on the road",
    Accepted: "booked, not collected",
    Arrived: "delivered",
    Cancelled: "will not run",
  };
  const LEG_STEP: Record<MovementLegState, number> = {
    Accepted: 1,
    "En route": 2,
    Collected: 2,
    Arrived: 3,
    Cancelled: 0,
  };
  // The Arrange choice: a row in the toolbar on a wider screen, inside the Filter sheet on a phone.
  const arrangeGroup = (
    <RadioGroup className={styles.orderBar} aria-label="Order">
      <span className={styles.orderLegend} aria-hidden="true">
        Arrange
      </span>
      {(
        [
          { id: "stands", label: "Stage", description: "By where it stands" },
          { id: "transport", label: "Transport", description: "By transport leg, and what has none" },
          { id: "wait", label: "Longest wait", description: "By how long it has waited" },
        ] as const
      ).map((option) => (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={order === option.id}
          title={option.description}
          className={styles.orderBtn}
          onClick={() => startTransition(() => setOrder(option.id))}
        >
          <span>{option.label}</span>
        </button>
      ))}
    </RadioGroup>
  );
  const transportFeed = (onPicked?: () => void) => (
    <div
      className={cx(styles.transportRunsFeed, flow.trFeed)}
      role="region"
      aria-label="Active transport legs"
      tabIndex={0}
    >
      {LEG_GROUP_ORDER.map((state) => {
        const group = legs.filter((leg) => leg.state === state);
        if (group.length === 0) return null;
        return (
          <section key={state} className={flow.trGroup} aria-label={`${LEG_STATE_LABEL[state]}, ${group.length}`}>
            <h4 className={flow.trGroupHead}>
              <StatusGlyph tone={LEG_STATE_TONE[state]} size={9} />
              {LEG_STATE_LABEL[state]}
              <span className={flow.trGroupCount}>{group.length}</span>
              <span className={flow.trGroupWord}>{LEG_GROUP_WORD[state]}</span>
            </h4>
            {group.map((leg) => {
              const patientInfo = resolveSubjectPatient(leg.movement, { patients, referrals });
              const { originLabel, destinationLabel } = transportRouteLabels(leg.movement, units);
              const originEd = edById(leg.movement.originEdId);
              const shortOrigin = originEd ? `${originEd.siteCode} ED` : originLabel;
              const stateLabel = LEG_STATE_LABEL[leg.state] ?? leg.state;
              const step = LEG_STEP[leg.state];
              return (
                <button
                  key={leg.movement.id}
                  type="button"
                  className={flow.trRow}
                  data-transport-key={leg.movement.id}
                  data-selected={detailId === leg.movement.id ? "true" : undefined}
                  onClick={() => {
                    onPicked?.();
                    openDetail(leg.movement.id);
                    revealMovement(leg.movement.id);
                  }}
                  aria-label={`Inspect ${patientInfo.formalName}, ${stateLabel} via ${leg.provider}`}
                  title={`${originLabel} to ${destinationLabel}, ${leg.provider}`}
                >
                  <span className={flow.trName}>
                    <span className={flow.trNameText}>{patientInfo.formalName}</span>
                    {leg.movement.transport?.escortRequired ? (
                      <ShieldCheck size={14} className={flow.lock} aria-label="Escort required" />
                    ) : null}
                  </span>
                  <span className={flow.trWhen}>
                    <span className="sr-only">{stateLabel} </span>
                    {durMinutes(leg.minutesSinceBooked)}
                    <span className="sr-only"> ago</span>
                  </span>
                  <span className={flow.trRoute}>
                    {shortOrigin}
                    <span className={flow.routeTo}>
                      <ArrowRight size={11} className={flow.routeArrow} aria-hidden="true" />
                      <span className="sr-only"> to </span>
                      <span>{destinationLabel}</span>
                    </span>
                  </span>
                  {/* A three-step track, Accepted, Collected and Arrived, filled to where the leg is.
                      The group heading and the row's label already say it in words. */}
                  <span
                    className={flow.trTrack}
                    aria-hidden="true"
                    data-cancelled={leg.state === "Cancelled" ? "true" : undefined}
                  >
                    {[1, 2, 3].map((n) => (
                      <i key={n} data-on={step >= n ? "true" : undefined} />
                    ))}
                  </span>
                </button>
              );
            })}
          </section>
        );
      })}
    </div>
  );
  // Phone: the stage highlight chips under the band, one row that slides sideways with Home's soft
  // fade (chips at 0 muted at the end). A tablet or laptop has the stage pipeline instead.
  const phoneStageTrack = (
    <div className={cx(flow.phStages, phoneRows.chipRow)} role="group" aria-label="Highlight a stage">
      {openStages
        .filter((stage) => stage.id !== "arrived")
        .map((stage) => (
          <button
            key={stage.id}
            type="button"
            className={cx(flow.phStage, phoneRows.chip, stage.movements.length === 0 && phoneRows.zero)}
            aria-pressed={highlight === `stage:${stage.id}`}
            onClick={() => toggleHighlight(`stage:${stage.id}`)}
            title={stage.label}
          >
            {STAGE_SHORT[stage.id]}
            <span className={flow.phStageCount}>{stage.movements.length}</span>
          </button>
        ))}
    </div>
  );
  function openFromHero(id: string) {
    const target = movements.find((candidate) => candidate.id === id);
    if (target !== undefined && isInServiceScope !== null && !isInServiceScope(target)) {
      jumpToMovement(id);
      return;
    }
    revealMovement(id);
    openDetail(id);
  }

  // Community clinician desk: with no journey at all, one honest panel instead of empty boards.
  if (community && teamName && movements.length === 0) return <CommunityNoJourneys teamName={teamName} />;

  return (
    <div
      className={styles.screen}
      data-testid="ward-movements-page"
      data-ward-design="third-edition"
      data-ward-rebuilt-screen="movements"
    >
      <main id="main-content" className={styles.main}>
        {/* v6 Movements (7 Oct 2026): the hero band carries the page's figures; the h1 stays for
            assistive technology and the tests that pin it. */}
        <h1 className="sr-only">Movements</h1>

        {/*
          D-f (Ward Lead's decisions, 2026-09-17, amending build plan §2 after an Opus adversarial
          review, R1): the scope bar moves to the TOP of the page, and the "not these figures"
          sentence moves to sit ABOVE the whole-network panels it is disclaiming (The day, Today's
          traffic, ...) — never on the narrowed worklist panel further down, where a reader who has
          already scrolled past the figures would read the caveat too late to matter. Kept as a
          standalone note rather than folded into "The day" panel's own `blurb`, so that panel's
          rendered content stays byte-identical whether or not a service is chosen — the property
          `tests/ward-movements-service-scope.dom.test.tsx` proves for every whole-network panel.
        */}
        {service ? (
          <>
            <WardServiceScopeBar
              service={service}
              shown={worklistMovements.length}
              total={movements.length}
              noun="movements"
              noRecordedServiceCount={noRecordedServiceCount}
              urgentOutside={{ count: urgentOutsideServiceCount }}
            />
            <p className={styles.worklistSubhead} data-testid="ward-movements-not-these-figures">
              {`The Service selector scopes the list below to ${service}, not these figures.`}
            </p>
          </>
        ) : null}

        <section className={styles.daySection} aria-label="The day" data-ward-primitive="panel">
          <Hero
            className={styles.dayHero}
            eyebrow={
              community && teamName
                ? `Movements · ${teamName} team`
                : isPhone
                  ? `Movements · ${deskPlaceLabel(access, units) ?? service ?? "Statewide"}`
                  : "Movements"
            }
            title={
              // The title doubles as the "Open" day figure. Its DOM reads label first ("Open
              // movements 70"), so the figure's own label anchors it like every stat beside it;
              // CSS puts the number first on screen, as the mockup draws it.
              <span className={styles.dayOpenTitle} data-ward-panel-count data-testid="movements-day-metric">
                <span className={styles.dayOpenLabel}>Open movements</span>
                <strong className={styles.dayOpenValue}>{openMovements.length}</strong>
              </span>
            }
            titleMeta={
              // Q196 (Josh, 1 Nov 2026): the phone shows the same counts as desktop. Home's phone hero
              // no longer carries the invented-records line (F-08), so Movements drops it too.
              <span className={flow.heroTitleMeta}>
                {closedToday.length} resolved today · {activeCorridorCount} active corridors
              </span>
            }
            aside={<LiveChip state="live" onHero />}
            // Movements redesign (1 Nov 2026): Waiting's header figures, each a big number over its
            // label, beside the title. A figure highlights its rows in the worklist; nothing is hidden.
            stats={
              isPhone ? undefined : (
                <div className={board.stats} role="group" aria-label="Highlight movements">
                  {highlightOptions.map((option) => {
                    const value = openMovements.filter(option.test).length;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={board.stat}
                        aria-pressed={highlight === option.id}
                        onClick={() => toggleHighlight(option.id)}
                        data-testid="movements-day-metric"
                      >
                        <span className={board.statV}>{value}</span>
                        <span className={board.statL}>
                          {option.tone && value > 0 ? <StatusGlyph tone={option.tone} size={9} /> : null}
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                  <div className={cx(board.stat, board.statStatic)}>
                    {/* Booked or moving only: arrived and cancelled legs are not on the road or booked. */}
                    <span className={board.statV}>{counts.Accepted + counts["En route"] + counts.Collected}</span>
                    <span className={board.statL}>On the road or booked</span>
                  </div>
                </div>
              )
            }
            bar={
              isPhone ? (
                <div className={flow.highlights} role="group" aria-label="Highlight movements">
                  {highlightOptions.map((option) => (
                    <HighlightStat
                      key={option.id}
                      label={option.label}
                      tone={option.tone}
                      value={openMovements.filter(option.test).length}
                      pressed={highlight === option.id}
                      onToggle={() => toggleHighlight(option.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className={strip.heroBar} role="group" aria-label="At a glance">
                  {longestWaiting ? (
                    <button
                      type="button"
                      className={strip.strip}
                      onClick={() => openFromHero(longestWaiting.id)}
                      title={`Open ${resolveSubjectPatient(longestWaiting, { patients, referrals }).formalName}`}
                    >
                      <Hourglass size={14} aria-hidden="true" className={strip.stripIcon} data-tone="danger" />
                      <span className={strip.stripLabel}>Longest wait</span>
                      <span className={strip.stripValue}>
                        <b className={strip.heroNum}>{splitDuration(Math.max(now - longestWaiting.openedAt, 0))}</b>{" "}
                        <span className={strip.heroName}>
                          {resolveSubjectPatient(longestWaiting, { patients, referrals }).formalName}
                        </span>
                      </span>
                    </button>
                  ) : null}
                  {nextExpiry ? (
                    <button
                      type="button"
                      className={strip.strip}
                      onClick={() => openFromHero(nextExpiry.id)}
                      title="The soonest legal expiry still ahead, as typed on the form. Not legally checked."
                    >
                      <Scale size={14} aria-hidden="true" className={strip.stripIcon} data-tone="warning" />
                      <span className={strip.stripLabel}>Next expiry</span>
                      <span className={strip.stripValue}>
                        <b className={strip.heroNum}>{formatInstantWithDay(currentLegalDueAt(nextExpiry)!, now)}</b>{" "}
                        <span className={strip.heroName}>
                          {resolveSubjectPatient(nextExpiry, { patients, referrals }).formalName}
                        </span>
                      </span>
                      <span className={strip.stripLabel}>as typed</span>
                    </button>
                  ) : null}
                  <span className={strip.strip}>
                    <ArrowRightLeft size={14} aria-hidden="true" className={strip.stripIcon} />
                    <span className={strip.stripLabel}>Resolved today</span>
                    <span className={strip.stripValue}>
                      <b className={strip.heroNum}>{arrivedMovements.length}</b> arrived ·{" "}
                      <b className={strip.heroNum}>{didNotProceedMovements.length}</b> did not proceed
                    </span>
                  </span>
                </div>
              )
            }
            barAside={
              <div className={cx(flow.heroTools, isPhone && phoneRows.heroPills)}>
                {isPhone || community ? null : (
                  <>
                    {/* Phone: Transport opens from the "Transport now" card below the hero. */}
                    <Link
                      href="/ward-flow/transport/officer"
                      className={buttonClass({ variant: "onHero", size: "sm" })}
                    >
                      <Truck size={14} aria-hidden="true" />
                      Transport
                    </Link>
                  </>
                )}
                {myQueue[0] && !community ? (
                  <button
                    type="button"
                    // One primary per screen (device audit): the shell's "Record a decision" is the
                    // primary beside this on tablet and desktop; phone has no shell primary.
                    // Phone: Home's 40px hero pill (Josh, 31 Oct 2026).
                    className={buttonClass({
                      variant: isPhone ? "light" : "onHero",
                      size: "sm",
                      className: isPhone ? phoneRows.heroPill : undefined,
                    })}
                    onClick={() => openFromHero(myQueue[0].id)}
                    title={`Top of your queue: ${resolveSubjectPatient(myQueue[0], { patients, referrals }).formalName}. ${myQueue.length} open movements wait on a coordinator step.`}
                  >
                    Next in my queue
                    <span className={flow.queueCount}>
                      {myQueue.length}
                      <span className={flow.queueNoun}> in queue</span>
                    </span>
                  </button>
                ) : null}
              </div>
            }
          />

          {/* Redesign (31 Oct 2026): one stage pipeline under the hero on a tablet or laptop, each
              stage with its count and longest wait. Phone (v10): the stage chips sit on the canvas
              under the band, number first. */}
          {isPhone ? (
            phoneStageTrack
          ) : (
            <StagePipeline
              stages={openStages.filter((stage) => stage.id !== "arrived")}
              now={now}
              accessTarget={accessTarget}
              highlight={highlight}
              onToggle={(stageId) => toggleHighlight(`stage:${stageId}`)}
            />
          )}
        </section>

        {isPhone ? null : (
          <section
            className={cx(styles.trafficPanel, styles.trafficFullNames)}
            aria-label="Today’s traffic"
            data-ward-primitive="panel"
          >
            <span className="sr-only">{`${activeCorridorCount} active corridors`}</span>
            <MovementHorizonGantt
              lanes={horizonLanes}
              corridors={corridors}
              refusedCorridors={refusedCorridors}
              units={units}
              now={now}
              selectedMovementId={detailId}
              onSelectMovement={(id) => {
                openDetail(id);
                revealMovement(id);
              }}
            />
          </section>
        )}

        <div className={cx(styles.columns, flow.layout)}>
          <div className={styles.primary}>
            {/* D-f: the scope bar and its "not these figures" sentence moved to the top of the
                page (see the comment beside the header above) — never here, on the panel they were
                disclaiming. */}
            <Card
              aria-label="Movement worklist"
              data-ward-primitive="panel"
              className={cx(styles.wlCard, styles.wlWrapRows)}
            >
              <CardHead
                className={wardPin.pinnedSwitch}
                icon={ArrowRightLeft}
                title="Movement worklist"
                action={
                  <div className={styles.boardTabs} role="tablist" aria-label="Movements">
                    {(
                      [
                        { id: "every", label: isPhone ? "Open" : "Open and resolved", count: worklistMovements.length },
                        { id: "resolved", label: "Resolved today", count: worklistClosedToday.length },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        id={`movements-tab-${tab.id}`}
                        aria-controls={`movements-pane-${tab.id}`}
                        aria-selected={boardTab === tab.id}
                        tabIndex={boardTab === tab.id ? 0 : -1}
                        className={styles.boardTab}
                        onClick={() => {
                          keyboardTabFocus.current = null;
                          startTransition(() => setBoardTab(tab.id));
                        }}
                        onKeyDown={(event) => {
                          let next: "every" | "resolved";
                          if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                            next = tab.id === "every" ? "resolved" : "every";
                          } else if (event.key === "Home") next = "every";
                          else if (event.key === "End") next = "resolved";
                          else return;
                          event.preventDefault();
                          // Selection is unchanged (Home on the first tab, End on the last): the tab is
                          // already focused and no commit follows, so there is nothing to wait for.
                          keyboardTabFocus.current = next === boardTab ? null : next;
                          startTransition(() => setBoardTab(next));
                        }}
                      >
                        {/* Absence and zero (rule 2): "none", never a bare "0" — the same wording every
                            other count on these screens uses, and a ruling rather than a default. */}
                        <span>{tab.label}</span>{" "}
                        <span className={styles.boardTabCount}>{tab.count === 0 ? "none" : tab.count}</span>
                      </button>
                    ))}
                  </div>
                }
              />
              <div className={flow.toolbar}>
                {boardTab === "every" && !isPhone ? arrangeGroup : null}
                {/* Phone audit (1 Nov 2026): Arrange folds into one Filter button, as on ED, so the first
                    movement sits higher. Arranging only reorders; no row is hidden. */}
                {boardTab === "every" && isPhone ? (
                  <PhoneFilterFold
                    count={order === "stands" ? 0 : 1}
                    title="Arrange the list"
                    description="Every movement stays on the list."
                    data-testid="ward-movements-arrange-fold"
                  >
                    {arrangeGroup}
                  </PhoneFilterFold>
                ) : null}
                <span className={flow.toolbarSpacer} />
                {highlightLabel !== null && matchesSearch === null ? (
                  <button
                    type="button"
                    className={flow.highlightNote}
                    aria-pressed="true"
                    onClick={() => setHighlight(null)}
                    title="Clear the highlight. Highlights never hide a row."
                  >
                    {highlightLabel} · {markedTotal ?? 0} highlighted
                    <span className="sr-only">, clear</span>
                    <X size={14} aria-hidden="true" />
                  </button>
                ) : null}
                <TextInput
                  type="search"
                  icon={Search}
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setHighlight(null);
                  }}
                  onClear={() => setSearch("")}
                  placeholder="Name, UMRN or ED"
                  aria-label="Find movements by name, UMRN or ED"
                  boxClassName={flow.search}
                />
              </div>

              {/* Column heads for the rows below. The rows are list items, so these are a visual
                  guide only; each row names its own cells for assistive technology. */}
              <div className={cx(flow.grid, flow.columns)} aria-hidden="true">
                <span>Tier</span>
                <span>Patient</span>
                <span>Route</span>
                <span>{boardTab === "resolved" ? "Outcome" : "Barrier"}</span>
                <span>Legal</span>
                <span className={flow.columnEnd}>{boardTab === "resolved" ? "Took" : "Waited"}</span>
                <span className={flow.columnEnd}>{boardTab === "resolved" ? "Closed" : "Next step"}</span>
                <span />
              </div>

              {boardTab === "every" ? (
                <div role="tabpanel" id="movements-pane-every" aria-labelledby="movements-tab-every">
                  <div className={styles.movementListBody} tabIndex={0} role="region" aria-label="Movement records">
                    {searchedTotal === 0 ? (
                      <p className={styles.absent}>No movement matches “{search.trim()}”. Every row is still shown.</p>
                    ) : null}
                    {order === "cause"
                      ? shownCauseGroups.map((group) => (
                          <div key={group.key} className={styles.stageBlock}>
                            <div className={styles.causeGroupHeading} data-sev={group.sev}>
                              <h3 className={styles.causeGroupTitle}>{group.title}</h3>
                              {group.mark ? <span className={styles.causeGroupMark}>{group.mark}</span> : null}
                              {group.note ? <p className={styles.causeGroupNote}>{group.note}</p> : null}
                              <span className={styles.causeGroupCount}>{group.movements.length}</span>
                            </div>
                            <WardRecordList>{capRows(group.movements, GROUP_CAP).map(renderRow)}</WardRecordList>
                          </div>
                        ))
                      : null}
                    {order === "stands"
                      ? shownStages.map((stage) => {
                          if (stage.movements.length === 0) {
                            if (matchesSearch !== null || isPhone) return null;
                            return (
                              <div key={stage.id} className={styles.stageBlock}>
                                <div className={styles.emptyStage}>
                                  <h3 className={styles.emptyStageTitle}>{stage.label}</h3>
                                  <p className={styles.absent}>No movements at this stage{inServiceSuffix(service)}.</p>
                                </div>
                              </div>
                            );
                          }
                          const rows = groupRows(stage.id, stage.movements);
                          return (
                            <div key={stage.id} className={styles.stageBlock}>
                              {isPhone ? (
                                <PhoneGroupHeading
                                  id={stage.id}
                                  title={stage.label}
                                  people={stage.movements.length}
                                  open={phoneOpenGroups.has(stage.id)}
                                  onToggle={() => togglePhoneGroup(stage.id)}
                                />
                              ) : (
                                <WardGroupHeading
                                  title={stage.label}
                                  people={stage.movements.length}
                                  note={moreNote(stage.movements.length - rows.length)}
                                />
                              )}
                              {rows.length > 0 ? <WardRecordList>{rows.map(renderRow)}</WardRecordList> : null}
                            </div>
                          );
                        })
                      : null}

                    {order === "transport"
                      ? shownTransportGroups.map((group) => {
                          if (group.rows.length === 0) {
                            if (matchesSearch !== null || isPhone) return null;
                            return (
                              <div key={group.id} className={styles.stageBlock}>
                                <div className={styles.emptyStage}>
                                  <h3 className={styles.emptyStageTitle}>{group.title}</h3>
                                  <p className={styles.absent}>
                                    No movement is in this group right now{inServiceSuffix(service)}.
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          const rows = groupRows(group.id, group.rows);
                          return (
                            <div key={group.id} className={styles.stageBlock}>
                              {isPhone ? (
                                <PhoneGroupHeading
                                  id={group.id}
                                  title={group.title}
                                  people={group.rows.length}
                                  open={phoneOpenGroups.has(group.id)}
                                  onToggle={() => togglePhoneGroup(group.id)}
                                />
                              ) : (
                                <WardGroupHeading
                                  title={group.title}
                                  people={group.rows.length}
                                  note={moreNote(group.rows.length - rows.length)}
                                />
                              )}
                              {rows.length > 0 ? <WardRecordList>{rows.map(renderRow)}</WardRecordList> : null}
                            </div>
                          );
                        })
                      : null}

                    {order === "wait" && shownByWait.length > 0 ? (
                      <div className={styles.stageBlock}>
                        {/* `byLongestWait` measures a closed movement to its CLOSURE, not to now — the
                          row beside it renders a frozen clock, and an order computed from a running
                          one would contradict the number the reader can see. */}
                        <WardGroupHeading
                          title="Longest wait first"
                          people={shownByWait.length}
                          note={moreNote(shownByWait.length - capRows(shownByWait, LIST_CAP).length)}
                        />
                        <WardRecordList>{capRows(shownByWait, LIST_CAP).map(renderRow)}</WardRecordList>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div role="tabpanel" id="movements-pane-resolved" aria-labelledby="movements-tab-resolved">
                  <div
                    className={styles.movementListBody}
                    tabIndex={0}
                    role="region"
                    aria-label="Resolved movement records"
                  >
                    {worklistClosedToday.length === 0 ? (
                      <p className={styles.absent}>No movement has resolved today{inServiceSuffix(service)}.</p>
                    ) : (
                      <>
                        {matchesSearch !== null && !shownClosedToday.some(matchesSearch) ? (
                          <p className={styles.absent}>
                            No resolved movement matches “{search.trim()}”. Every row is still shown.
                          </p>
                        ) : null}
                        <WardRecordList>{capRows(shownClosedToday, LIST_CAP).map(renderRow)}</WardRecordList>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className={styles.wlFoot}>
                <span className={styles.wlFootText}>{worklistFootText}</span>
                {matchesSearch === null && (hiddenRowCount > 0 || showAll) ? (
                  <button
                    type="button"
                    className={buttonClass({ variant: "ghost", size: "sm" })}
                    aria-expanded={showAll}
                    aria-controls={boardTab === "every" ? "movements-pane-every" : "movements-pane-resolved"}
                    onClick={() => setShowAll((value) => !value)}
                  >
                    {showAll ? "Show fewer" : `Show all ${worklistListTotal}`}
                  </button>
                ) : null}
              </div>
            </Card>
          </div>

          <aside className={styles.secondary} aria-label="Movement details">
            {/* Movements redesign (1 Nov 2026, Q102): no separate Tier 1 card. The hero's Tier 1
                count highlights those rows in the worklist, so the side column has one job. */}
            {/* Transport and Shape of the day share one panel. The corner toggle swaps the view;
                the region name follows whichever view is showing. The transport count stays off
                the header: the bar caption already says how many legs are booked or moving. */}
            {/* The region keeps its longer name, "Transport right now", which tests and earlier
                readers know it by; the visible title is the mockup's shorter "Transport now". */}
            <Card
              aria-label={sideView === "transport" ? "Transport right now" : "Shape of the day"}
              data-ward-primitive="panel"
              className={styles.sideCard}
            >
              <CardHead
                title={sideView === "transport" ? "Transport now" : "Shape of the day"}
                meta={
                  sideView === "shape"
                    ? shapeTab === "resolved"
                      ? `${closedToday.length} resolved today`
                      : `${openMovements.length} open`
                    : undefined
                }
                action={
                  <div className={styles.sideViewToggle} role="group" aria-label="Movement side view">
                    <button
                      type="button"
                      aria-pressed={sideView === "transport"}
                      onClick={() => startTransition(() => setSideView("transport"))}
                      aria-label="Transport now"
                      title="Transport now"
                    >
                      <Truck size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-pressed={sideView === "shape"}
                      onClick={() => startTransition(() => setSideView("shape"))}
                      aria-label="Shape of the day"
                      title="Shape of the day"
                    >
                      <ChartColumn size={14} aria-hidden="true" />
                    </button>
                  </div>
                }
              />
              {sideView === "transport" ? (
                <>
                  {/* Movements redesign (1 Nov 2026): four plain tiles in place of the stretched bar,
                      each a count over its words, so the card reads at a glance. */}
                  <dl className={flow.trStats}>
                    {[
                      {
                        id: "road",
                        label: "On the road",
                        value: counts.Collected + counts["En route"],
                        tone: "info" as const,
                      },
                      {
                        id: "booked",
                        label: "Booked, not collected",
                        value: counts.Accepted,
                        tone: "neutral" as const,
                      },
                      { id: "arrived", label: "Arrived", value: counts.Arrived, tone: "success" as const },
                      { id: "none", label: "No transport leg", value: withoutTransport, tone: undefined },
                    ].map((tile) => (
                      <div
                        key={tile.id}
                        className={flow.trStat}
                        data-testid="movements-day-metric"
                        data-zero={tile.value === 0 ? "true" : undefined}
                      >
                        <dt>
                          {tile.tone ? <StatusGlyph tone={tile.tone} size={9} /> : null}
                          {tile.label}
                        </dt>
                        <dd>{tile.value}</dd>
                      </div>
                    ))}
                  </dl>
                  {legs.length === 0 ? (
                    <p className={styles.absent}>No transport leg is booked or moving right now.</p>
                  ) : (
                    <div className={styles.transportWidget}>{transportFeed()}</div>
                  )}
                </>
              ) : (
                <ShapeOfTheDay
                  arrivedMovements={arrivedMovements}
                  closedToday={closedToday}
                  didNotProceedMovements={didNotProceedMovements}
                  isInServiceScope={isInServiceScope}
                  jumpToMovement={jumpToMovement}
                  legs={legs}
                  noTransportRecord={noTransportRecord}
                  now={now}
                  openDetail={openDetail}
                  openMovements={openMovements}
                  openStages={openStages}
                  patients={patients}
                  referrals={referrals}
                  setShapeTab={setShapeTab}
                  shapeTab={shapeTab}
                  unacceptedTransport={unacceptedTransport}
                  units={units}
                  waitingMovements={waitingMovements}
                />
              )}
            </Card>
          </aside>
        </div>

        {/* Phone audit (1 Nov 2026): the three link cards sit after the list, so the first movement
            is near the top. */}
        {isPhone ? (
          <MovementsPhoneNav
            activeCorridorCount={activeCorridorCount}
            corridors={corridors}
            detailId={detailId}
            horizonLanes={horizonLanes}
            legs={legs}
            now={now}
            openDetail={openDetail}
            phoneArrivalsTimeline={phoneArrivalsTimeline}
            phoneCorridors={phoneCorridors}
            phoneInbound={phoneInbound}
            phoneInboundWards={phoneInboundWards}
            phoneSheet={phoneSheet}
            refusedCorridors={refusedCorridors}
            revealMovement={revealMovement}
            setPhoneArrivalsTimeline={setPhoneArrivalsTimeline}
            setPhoneSheet={setPhoneSheet}
            transportFeed={transportFeed}
            units={units}
            withoutTransport={withoutTransport}
          />
        ) : null}

        <WardPrototypeFooter
          testId="ward-movements-governance"
          note="Patient journeys, transport legs and departments are invented · Not approved for clinical use"
        />
        <MovementDrawer
          // P2 item 4 (2026-09-17 review): remounts on every patient change, so a reason chosen
          // for one patient's urgent-flag picker cannot survive into another's — see
          // MovementDrawer's own `urgentFlagReason` local state.
          key={detailId ?? "none"}
          movement={movements.find((candidate) => candidate.id === detailId)}
          now={now}
          units={units}
          referrals={referrals}
          patients={patients}
          edAccessTargetMinutes={configuration.edAccessTargetMinutes}
          dispatch={dispatch}
          onClose={closeDetail}
          onFocusMovement={setFocusMovementId}
        />
      </main>
    </div>
  );
}
