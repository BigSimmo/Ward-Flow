"use client";

import Link from "next/link";

import type { Instant } from "@/components/ward-management/ward-clock";
import { dayOf, formatInstantWithDay, splitDuration } from "@/components/ward-management/ward-clock";
import {
  isOpen,
  movementHealthService,
  stageCopy,
  transportLeg,
  transportNeedState,
} from "@/components/ward-management/ward-derivations";
import { legalFormNameLabelFirst } from "@/components/ward-management/ward-legal-forms";
import { SEVERE_CAUSES, delayGroups, type DelayCause } from "@/components/ward-management/delays/delays-derivations";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { WardChipLevel } from "@/components/ward-management/ward-chip";
import { WardGroupHeading, WardRecordList, WardRecordRow } from "@/components/ward-management/ward-record-row";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { edById } from "@/components/ward-management/ward-sites";
import { departmentLabel, wardLabel } from "@/components/ward-management/ward-absence-labels";
import type { HealthService, Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { ED_SEVERE_PRESSURE_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { BLOCKERS_MEANING_NOTHING_IS_BLOCKING } from "@/components/ward-management/ward-model";
import {
  byLongestWait,
  corridorCounts,
  deriveMovementHorizonLanes,
  journeyStages,
  refusedCorridorCounts,
  transportCounts,
  transportLegs,
  type MovementLegState,
  type TransportLegRow,
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
import { ArrowRightLeft, ChartColumn, ChevronRight, Lock, Printer, Search, ShieldCheck, Truck, X } from "lucide-react";
import {
  Card,
  CardHead,
  Hero,
  Legend,
  LiveChip,
  StackBar,
  StatusGlyph,
  TextInput,
  Timer,
  buttonClass,
  cx,
  durMinutes,
  type WfFill,
  type WfTone,
} from "@/components/wf";
import { MovementDrawer } from "./movement-drawer";
import { MovementHorizonGantt } from "./movement-horizon-gantt";
import { isCoordinatorStep, movementNextStep } from "./movement-next-step";
import flow from "./movement-flow.module.css";
import styles from "./movements.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

const MS_PER_MINUTE = 60_000;

function meaningfulBlocker(movement: Movement): string | null {
  const blocker = movement.blocker.trim();
  return blocker && !BLOCKERS_MEANING_NOTHING_IS_BLOCKING.some((inactive) => inactive === blocker)
    ? movement.blocker
    : null;
}

export interface CauseDefinition {
  key: string;
  rank: number;
  title: string;
  note?: string;
  sev?: "breach" | "approach" | "nobed";
  mark?: string;
}

export const CAUSES: CauseDefinition[] = [
  {
    key: "legal_breached",
    rank: 1,
    title: "Legal due time passed",
    note: "a deadline that has already passed, and nothing on this page outranks it",
    sev: "breach",
    mark: "Severe",
  },
  {
    key: "legal_expiring",
    rank: 2,
    title: "Form expiry approaching",
    note: "under an hour and not yet passed",
    sev: "approach",
    mark: "Severe",
  },
  {
    key: "no_eligible_bed",
    rank: 3,
    title: "No eligible bed",
    note: "every ward asked has declined, and nothing is holding the question",
    sev: "nobed",
    mark: "Severe",
  },
  {
    key: "awaiting_ward_answer",
    rank: 4,
    title: "Waiting on a ward to answer",
    note: "referrals currently held by receiving wards",
  },
  {
    key: "bed_pull_expired",
    rank: 5,
    title: "Reserved time has passed, bed still held",
    note: "Release the bed or set a new reserved time",
  },
  {
    key: "awaiting_bed_ready",
    rank: 6,
    title: "Waiting for the bed to be ready",
  },
  {
    key: "awaiting_transport",
    rank: 7,
    title: "Waiting for transport",
  },
  {
    key: "patient_or_family",
    rank: 8,
    title: "Patient or family",
  },
  {
    key: "awaiting_coordinator",
    rank: 9,
    title: "Waiting on the coordinator",
    note: "that is you",
  },
  {
    key: "in_transit",
    rank: 0,
    title: "Already travelling",
    note: "on the road to the receiving ward, open until it arrives and waiting for nothing",
  },
];

/**
 * R2 item 2 (Ward Lead's decisions, 2026-09-17): the legal and no-bed causes ("legal_breached",
 * "legal_expiring", "no_eligible_bed") are read from the SAME `delayGroups` classifier Delays
 * itself uses (`delays-derivations.ts`), via `severeCauseById` — a per-movement lookup the caller
 * builds once from `delayGroups(openMovements, units, now)` and passes down, rather than this
 * screen re-deriving its own opinion of the same three causes.
 *
 * ⚠️ **THIS SCREEN'S OWN VERSION DISAGREED WITH DELAYS ON BOTH ENDS.** `legal_breached`/
 * `legal_expiring` were read straight off `dueAt` here (a raw `< now` / `< 60 minutes` comparison)
 * while Delays reads `clockState`'s own thresholds — the two clocks could name a different set of
 * movements breached or expiring for the identical fixture. `no_eligible_bed` was gated on
 * `hasDeclines` — true only once at least one ward had actually declined — so a movement no ward
 * had ever been ASKED about (`declines: []`, exactly what every generated movement carries; see
 * `ward-movements.ts`'s own `routineMovements`) could never read `no_eligible_bed` here no matter
 * how ineligible every real ward in the network was, while Delays' own `shortlistCandidates`-based
 * check would call it correctly. WF-308 is exactly this shape. The declines-based check ALSO ran
 * the other way: a movement declined by every ward it happened to ask, while a DIFFERENT eligible
 * ward elsewhere had never been asked, read `no_eligible_bed` here regardless — a false positive
 * Delays' network-wide shortlist search does not make.
 */
export function causeOf(movement: Movement, now: Instant, severeCauseById: ReadonlyMap<string, DelayCause>): string {
  const leg = movement.transport;
  const legState = transportLeg(leg);
  const inTransit = movement.stage === "moving" || legState === "En route" || legState === "Collected";
  if (inTransit) return "in_transit";

  const severeCause = severeCauseById.get(movement.id);
  if (severeCause !== undefined) return severeCause;

  const noAccepted = !movement.acceptedUnitId;
  const hasReferred = movement.referredUnitIds && movement.referredUnitIds.length > 0;

  if (noAccepted && hasReferred) return "awaiting_ward_answer";

  if (movement.stage === "pulled" && movement.pullExpiresAt !== undefined && movement.pullExpiresAt < now) {
    return "bed_pull_expired";
  }

  const isBedPulled = movement.stage === "pulled" || movement.stage === "handover_ready" || movement.stage === "moving";
  if (movement.acceptedUnitId && !isBedPulled) return "awaiting_bed_ready";

  const need = transportNeedState(movement);
  if (movement.acceptedUnitId && need === "needed" && !leg) return "awaiting_transport";
  if (movement.acceptedUnitId && isBedPulled) return "awaiting_transport";

  const blockerText = movement.blocker.toLowerCase();
  if (blockerText.includes("family") || blockerText.includes("patient")) return "patient_or_family";

  return "awaiting_coordinator";
}

/**
 * R2 item 5 (P3): the exact suffix an empty-worklist sentence appends once a service is chosen —
 * "No movements at this stage.", "No movement is in this group right now." and "No movement has
 * resolved today." each name a SCOPED population (`worklistStages`, `worklistTransportGroups`,
 * `worklistClosedToday`), so an empty one while a service is chosen could otherwise be misread as
 * "nothing anywhere", not "nothing in {S}". One function so the three sentences share identical
 * wording rather than three separately hand-typed ternaries drifting apart — and so this exact
 * suffix can be pinned by a unit test without needing a real seed to reach every empty case.
 */
export function inServiceSuffix(service: HealthService | null): string {
  return service !== null ? ` in ${service}` : "";
}

function bedReadyNote(items: Movement[]): string {
  const pulled = items.filter(
    (m) => m.stage === "pulled" || m.stage === "handover_ready" || m.stage === "moving",
  ).length;
  const waiting = items.length - pulled;
  if (!items.length) return "";
  if (pulled && waiting) return `${pulled} with a bed pulled, ${waiting} accepted with no bed named yet`;
  return pulled ? "each has a bed pulled" : "accepted, and no bed has been named yet";
}

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
  const { movements, units, referrals, patients, dispatch, configuration } = useWardFlow();
  const now = useWardFlowClock();
  // Task 6 of the audit-wiring plan, 2026-09-16: StageRow's wait-meter bar and its "of N hours"
  // caption are read against the coordinator-configured ED access target, not a bare 24h literal.
  const accessTarget = configuration.edAccessTargetMinutes;
  // Build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md` §2 "Movements", task D2: the
  // chosen health service, read from the shared store S2 built. `null` means All services.
  const service = useServiceScope();

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

  const [boardTab, setBoardTab] = useState<"every" | "resolved">("every");
  const [order, setOrder] = useState<"stands" | "cause" | "transport" | "wait">("stands");
  const [shapeTab, setShapeTab] = useState<"stage" | "transport" | "waiting" | "resolved">("stage");
  const [sideView, setSideView] = useState<"transport" | "shape">("transport");
  // v6 worklist: a search over name, UMRN or ED, and a short list per group until Show all.
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  // Hero highlight: one of `heroHighlights` by id, or `stage:<stage>` from the stage track.
  const [highlight, setHighlight] = useState<string | null>(null);
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

  const stages = journeyStages(movements, now);
  const closedMovements = movements.filter((movement) => !isOpen(movement));
  const closedToday = closedMovements.filter(
    (movement) => movement.closure !== undefined && dayOf(movement.closure.at) === dayOf(now),
  );
  /*
   * ⚠️ Ordered by `byLongestWait`, not left in fixture order. The footer states ONE precedence
   * sentence over all three orders — an expiring legal authority outranks the rest — and a group
   * rendered in whatever order the array happened to arrive in would make that sentence false
   * under this option while it stayed true under the other two.
   */
  // Active corridors are open movements with an accepting ward. Same-day declines are derived
  // separately because a decline has no journey stage of its own. The records do not support an
  // honest "unused corridor" count, so the drawing's illustrative third category is omitted.
  const corridors = [...corridorCounts(movements)].sort(
    (a, b) => b.count - a.count || (a.originEdId < b.originEdId ? -1 : a.originEdId > b.originEdId ? 1 : 0),
  );
  const refusedCorridors = refusedCorridorCounts(movements, now);

  const withLeg = byLongestWait(
    movements.filter((movement) => movement.transport?.acceptedAt !== undefined),
    now,
  );
  const withoutLeg = byLongestWait(
    movements.filter((movement) => movement.transport === undefined),
    now,
  );
  const requestedLeg = byLongestWait(
    movements.filter((movement) => movement.transport !== undefined && movement.transport.acceptedAt === undefined),
    now,
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

  const openMovements = movements.filter(isOpen);
  const openStages = journeyStages(openMovements, now);
  const waitingMovements = byLongestWait(openMovements, now);
  const unacceptedTransport = byLongestWait(
    openMovements.filter((movement) => movement.transport !== undefined && movement.transport.acceptedAt === undefined),
    now,
  );
  const noTransportRecord = byLongestWait(
    openMovements.filter((movement) => movement.transport === undefined),
    now,
  );
  const legs = transportLegs(openMovements, now);
  const counts = transportCounts(legs);
  const activeCorridorCount = new Set(
    corridors.map((corridor) => JSON.stringify([corridor.originEdId, corridor.acceptedUnitId])),
  ).size;
  const tierOneOpen = openMovements.filter((movement) => movement.urgency === 1);
  const attentionCore = byLongestWait(tierOneOpen, now).slice(0, 3);
  /**
   * R2 item 3 (P2): flagged-urgent (or otherwise urgent per the widened service-safety definition)
   * patients OUTSIDE the chosen service were counted by the scope bar's own
   * `urgentOutsideServiceCount` but never named here — this panel only ever read `tierOneOpen`.
   * WF-018 (tier 3, flagged) is exactly this shape: outside the chosen service, flagged urgent, but
   * not tier 1, so it never appeared even though the scope bar's own count included it. Appended
   * rather than merged into `attentionCore`'s own top-3-by-wait cut, so the tier-1 figure below
   * keeps meaning exactly what it says.
   */
  const attentionOutsideExtra =
    service === null
      ? []
      : urgentMovementsOutsideService(openMovements, service, units, now, configuration).filter(
          (movement) => !attentionCore.some((core) => core.id === movement.id),
        );
  const attentionMovements = [...attentionCore, ...attentionOutsideExtra];

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
    for (const group of delayGroups(movements.filter(isOpen), units, now)) {
      if (!SEVERE_CAUSES.includes(group.cause)) continue;
      for (const movement of group.movements) map.set(movement.id, group.cause);
    }
    return map;
  }, [movements, units, now]);

  const causeGroups = useMemo(() => {
    return CAUSES.map((c) => {
      const items = byLongestWait(
        movements.filter(isOpen).filter((m) => causeOf(m, now, severeCauseById) === c.key),
        now,
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
  }, [movements, now, severeCauseById]);

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

  const worklistMovements = useMemo(
    () => (isInServiceScope ? movements.filter(isInServiceScope) : movements),
    [movements, isInServiceScope],
  );
  const worklistStages = useMemo(
    () => (isInServiceScope ? journeyStages(worklistMovements, now) : stages),
    [isInServiceScope, worklistMovements, stages, now],
  );
  const worklistClosedToday = useMemo(
    () => (isInServiceScope ? closedToday.filter(isInServiceScope) : closedToday),
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
      : (movement: Movement) => movementSearchText(movement, patients, referrals).includes(searchTerm);
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
  const shownByWait = byLongestWait(worklistMovements, now);
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
      ? "Resolved today"
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
  const movingCount = openMovements.filter((movement) => movement.stage === "moving").length;
  const longestWaiting = byLongestWait(openMovements, now)[0];
  const nextExpiry = openMovements
    .filter((movement) => movement.legalForm?.dueAt !== undefined && movement.legalForm.dueAt >= now)
    .sort((a, b) => a.legalForm!.dueAt! - b.legalForm!.dueAt!)[0];
  const myQueue = byLongestWait(
    openMovements.filter((movement) => isCoordinatorStep(movementNextStep(movement))),
    now,
  ).sort((a, b) => Number(Boolean(b.flaggedUrgent)) - Number(Boolean(a.flaggedUrgent)) || a.urgency - b.urgency);
  const surname = (movement: Movement) =>
    resolveSubjectPatient(movement, { patients, referrals }).formalName.split(",")[0];
  function openFromHero(id: string) {
    const target = movements.find((candidate) => candidate.id === id);
    if (target !== undefined && isInServiceScope !== null && !isInServiceScope(target)) {
      jumpToMovement(id);
      return;
    }
    revealMovement(id);
    openDetail(id);
  }

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
            eyebrow="Movements"
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
              <span className={flow.heroTitleMeta}>
                {movingCount} moving · {closedToday.length} resolved today · {activeCorridorCount} active corridors
              </span>
            }
            aside={
              <div className={flow.heroAside}>
                {longestWaiting ? (
                  <button
                    type="button"
                    className={buttonClass({ variant: "onHero", size: "sm", className: flow.jump })}
                    onClick={() => openFromHero(longestWaiting.id)}
                    title={`Open ${resolveSubjectPatient(longestWaiting, { patients, referrals }).formalName}`}
                  >
                    <span className={flow.jumpLabel}>Longest wait</span>
                    <span className={flow.jumpName}>{surname(longestWaiting)}</span>
                    <span className={flow.jumpValue}>{splitDuration(Math.max(now - longestWaiting.openedAt, 0))}</span>
                  </button>
                ) : null}
                {nextExpiry ? (
                  <button
                    type="button"
                    className={buttonClass({ variant: "onHero", size: "sm", className: flow.jump })}
                    onClick={() => openFromHero(nextExpiry.id)}
                    title="The soonest recorded legal expiry still ahead"
                  >
                    <span className={flow.jumpLabel}>Next expiry</span>
                    <span className={flow.jumpName}>{surname(nextExpiry)}</span>
                    <span className={flow.jumpValue}>{formatInstantWithDay(nextExpiry.legalForm!.dueAt!, now)}</span>
                  </button>
                ) : null}
                <LiveChip state="live" onHero />
              </div>
            }
            bar={
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
            }
            barAside={
              <div className={flow.heroTools}>
                <button
                  type="button"
                  className={buttonClass({ variant: "onHero", size: "sm", className: flow.previewTool })}
                  aria-disabled="true"
                  title="Preview. Not wired in this prototype."
                  onClick={() => announceToWardShell("Run sheet is a preview. Not wired in this prototype.")}
                >
                  <Printer size={14} aria-hidden="true" />
                  Run sheet
                </button>
                <Link
                  href="/mockups/ward-flow/transport/officer"
                  className={buttonClass({ variant: "onHero", size: "sm" })}
                >
                  <Truck size={14} aria-hidden="true" />
                  Transport
                </Link>
                {myQueue[0] ? (
                  <button
                    type="button"
                    className={buttonClass({ variant: "light", size: "sm" })}
                    onClick={() => openFromHero(myQueue[0].id)}
                    title={`Top of your queue: ${resolveSubjectPatient(myQueue[0], { patients, referrals }).formalName}`}
                  >
                    Next in my queue
                    <span className={flow.queueCount}>{myQueue.length}</span>
                  </button>
                ) : null}
              </div>
            }
            foot={
              <div className={flow.heroAside}>
                <span className={flow.heroBarLabel}>Stage</span>
                <div className={flow.stageTrack} role="group" aria-label="Highlight a stage">
                  {openStages
                    .filter((stage) => stage.id !== "arrived")
                    .map((stage) => (
                      <button
                        key={stage.id}
                        type="button"
                        className={flow.stageButton}
                        aria-pressed={highlight === `stage:${stage.id}`}
                        onClick={() => toggleHighlight(`stage:${stage.id}`)}
                        title={stage.label}
                      >
                        {STAGE_SHORT[stage.id]}
                        <span className={flow.stageCount}>{stage.movements.length}</span>
                      </button>
                    ))}
                </div>
              </div>
            }
          />

          <div className={styles.needsYou} role="group" aria-label="Needs you" data-testid="movements-needs-you">
            <div className={styles.needsYouHead}>
              <h2 className={styles.needsYouTitle}>Needs you</h2>
              {attentionCore.length > 0 ? (
                <span className={styles.needsYouMeta}>
                  {attentionCore.length} of {tierOneOpen.length} Tier 1
                </span>
              ) : null}
            </div>
            {attentionMovements.length === 0 ? (
              <p className={styles.attentionEmpty}>No open Tier 1 movement needs calling out.</p>
            ) : (
              // D-b (Ward Lead's decisions, 2026-09-17): built off `openMovements`, never the scoped
              // worklist, and a movement outside the chosen service says so.
              <ul className={flow.needsList}>
                {attentionMovements.map((movement) => {
                  const outsideService = service !== null && isInServiceScope !== null && !isInServiceScope(movement);
                  const who = resolveSubjectPatient(movement, { patients, referrals }).displayName;
                  const reason = meaningfulBlocker(movement) ?? stageCopy[movement.stage].label;
                  return (
                    <li key={movement.id} className={flow.needsCell}>
                      <button
                        type="button"
                        className={flow.needsItem}
                        data-record-key={movement.id}
                        onClick={() => jumpToMovement(movement.id)}
                        aria-label={`Find ${who} in worklist: ${reason}${outsideService ? ` — outside ${service}` : ""}`}
                      >
                        <TierPill tier={movement.urgency} />
                        <span className={flow.needsMain}>
                          <span className={flow.needsTop}>
                            <strong className={flow.needsName}>{who}</strong>
                            <span className={flow.needsWait}>
                              <Timer
                                at={movement.openedAt * MS_PER_MINUTE}
                                now={now * MS_PER_MINUTE}
                                direction="waiting"
                                thresholds={{
                                  dueSoon: ED_SEVERE_PRESSURE_WAIT_MINUTES * MS_PER_MINUTE,
                                  overdue: accessTarget * MS_PER_MINUTE,
                                }}
                                hideFlagWord
                                hideDirection
                              />
                              <span className="sr-only"> waiting</span>
                            </span>
                          </span>
                          <span className={flow.needsReason} title={reason}>
                            {reason}
                            {outsideService ? (
                              <span
                                data-testid={`movements-attention-outside-${movement.id}`}
                              >{` · Outside ${service}`}</span>
                            ) : null}
                          </span>
                        </span>
                        <ChevronRight size={16} className={flow.needsChevron} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className={styles.trafficPanel} aria-label="Today’s traffic" data-ward-primitive="panel">
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

        <div className={cx(styles.columns, flow.layout)}>
          <div className={styles.primary}>
            {/* D-f: the scope bar and its "not these figures" sentence moved to the top of the
                page (see the comment beside the header above) — never here, on the panel they were
                disclaiming. */}
            <Card aria-label="Movement worklist" data-ward-primitive="panel" className={styles.wlCard}>
              <CardHead
                icon={ArrowRightLeft}
                title="Movement worklist"
                action={
                  <div className={styles.boardTabs} role="tablist" aria-label="Movements">
                    {(
                      [
                        { id: "every", label: "Every movement", count: worklistMovements.length },
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
                        onClick={() => setBoardTab(tab.id)}
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
                {boardTab === "every" ? (
                  <div className={styles.orderBar} role="radiogroup" aria-label="Order">
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
                        aria-label={option.description}
                        className={styles.orderBtn}
                        onClick={() => setOrder(option.id)}
                      >
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
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
                  aria-label="Search movements by name, UMRN or ED"
                  boxClassName={flow.search}
                />
              </div>

              {/* Column heads for the rows below. The rows are list items, so these are a visual
                  guide only; each row names its own cells for assistive technology. */}
              <div className={cx(flow.grid, flow.columns)} aria-hidden="true">
                <span>Tier</span>
                <span>Patient</span>
                <span>Route</span>
                <span>Barrier and legal</span>
                <span className={flow.columnEnd}>Waited</span>
                <span className={flow.columnEnd}>Next step</span>
                <span />
              </div>

              {boardTab === "every" ? (
                <div role="tabpanel" id="movements-pane-every" aria-labelledby="movements-tab-every">
                  <div className={styles.movementListBody} tabIndex={0} role="region" aria-label="Movement records">
                    {searchedTotal === 0 ? (
                      <p className={styles.absent}>No movement matches “{search.trim()}”.</p>
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
                            if (matchesSearch !== null) return null;
                            return (
                              <div key={stage.id} className={styles.stageBlock}>
                                <div className={styles.emptyStage}>
                                  <h3 className={styles.emptyStageTitle}>{stage.label}</h3>
                                  <p className={styles.absent}>No movements at this stage{inServiceSuffix(service)}.</p>
                                </div>
                              </div>
                            );
                          }
                          const rows = capRows(stage.movements, GROUP_CAP);
                          return (
                            <div key={stage.id} className={styles.stageBlock}>
                              <WardGroupHeading
                                title={stage.label}
                                people={stage.movements.length}
                                note={moreNote(stage.movements.length - rows.length)}
                              />
                              <WardRecordList>{rows.map(renderRow)}</WardRecordList>
                            </div>
                          );
                        })
                      : null}

                    {order === "transport"
                      ? shownTransportGroups.map((group) => {
                          if (group.rows.length === 0) {
                            if (matchesSearch !== null) return null;
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
                          const rows = capRows(group.rows, GROUP_CAP);
                          return (
                            <div key={group.id} className={styles.stageBlock}>
                              <WardGroupHeading
                                title={group.title}
                                people={group.rows.length}
                                note={moreNote(group.rows.length - rows.length)}
                              />
                              <WardRecordList>{rows.map(renderRow)}</WardRecordList>
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
                    ) : shownClosedToday.length === 0 ? (
                      <p className={styles.absent}>No resolved movement matches “{search.trim()}”.</p>
                    ) : (
                      <WardRecordList>{capRows(shownClosedToday, LIST_CAP).map(renderRow)}</WardRecordList>
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
                      onClick={() => setSideView("transport")}
                      aria-label="Transport now"
                      title="Transport now"
                    >
                      <Truck size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-pressed={sideView === "shape"}
                      onClick={() => setSideView("shape")}
                      aria-label="Shape of the day"
                      title="Shape of the day"
                    >
                      <ChartColumn size={14} aria-hidden="true" />
                    </button>
                  </div>
                }
              />
              {sideView === "transport" ? (
                <div className={flow.sideFigures}>
                  {/* Legs and the open movements without one, side by side, so the excluded
                      count is stated rather than implied. Each figure reads label then value. */}
                  <div className={flow.sideFigure} data-testid="movements-day-metric">
                    <span>Transport legs</span>
                    <strong>{legs.length}</strong>
                  </div>
                  <div className={flow.sideFigure} data-testid="movements-day-metric">
                    <span>No transport leg</span>
                    <strong>{openMovements.length - legs.length}</strong>
                  </div>
                </div>
              ) : null}
              {sideView === "transport" ? (
                legs.length === 0 ? (
                  <p className={styles.absent}>No transport leg is booked or moving right now.</p>
                ) : (
                  <div className={styles.transportWidget}>
                    <div className={styles.transportBarWrap}>
                      <StackBar
                        label={`${legs.length} transport ${legs.length === 1 ? "leg" : "legs"} booked or moving`}
                        segments={TRANSPORT_STATES.map((st) => ({
                          id: st.id,
                          label: LEG_STATE_LABEL[st.id],
                          value: counts[st.id],
                          fill: st.fill,
                          hatch: st.hatch,
                        }))}
                      />
                      <Legend
                        className={styles.transportLegend}
                        items={TRANSPORT_STATES.filter((st) => counts[st.id] > 0 || st.id === "Arrived").map((st) => ({
                          id: st.id,
                          label: LEG_STATE_LABEL[st.id],
                          fill: st.fill,
                          hatch: st.hatch,
                          value: counts[st.id] === 0 ? "none" : counts[st.id],
                        }))}
                      />
                    </div>

                    <div className={styles.transportRunsFeed} role="feed" aria-label="Active transport legs">
                      {legs.map((leg) => {
                        const patientInfo = resolveSubjectPatient(leg.movement, { patients, referrals });
                        const { originLabel, destinationLabel } = transportRouteLabels(leg.movement, units);
                        const originEd = edById(leg.movement.originEdId);
                        const shortOrigin = originEd ? `${originEd.siteCode} ED` : originLabel;
                        const stateLabel = LEG_STATE_LABEL[leg.state] ?? leg.state;
                        return (
                          <button
                            key={leg.movement.id}
                            type="button"
                            className={flow.trRow}
                            data-selected={detailId === leg.movement.id ? "true" : undefined}
                            onClick={() => {
                              openDetail(leg.movement.id);
                              revealMovement(leg.movement.id);
                            }}
                            aria-label={`Inspect ${patientInfo.formalName}, ${stateLabel} via ${leg.provider}`}
                          >
                            <span className={flow.trName}>
                              <span className={flow.trNameText}>{patientInfo.formalName}</span>
                              {leg.movement.transport?.escortRequired ? (
                                <ShieldCheck size={14} className={flow.lock} aria-label="Escort required" />
                              ) : null}
                            </span>
                            <span className={flow.trState}>
                              <StatusGlyph tone={LEG_STATE_TONE[leg.state]} size={9} />
                              {stateLabel}
                            </span>
                            <span className={flow.trWhen}>
                              <span className="sr-only">Booked </span>
                              {durMinutes(leg.minutesSinceBooked)}
                              <span className="sr-only"> ago</span>
                            </span>
                            <span
                              className={flow.trRoute}
                              title={`${originLabel} to ${destinationLabel}, ${leg.provider}`}
                            >
                              {shortOrigin} to {destinationLabel} · {leg.provider}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              ) : (
                <>
                  <div className={styles.shapeTabs} role="group" aria-label="Movement summary">
                    {(
                      [
                        { id: "stage", label: "Stage", count: openMovements.length },
                        { id: "transport", label: "Transport", count: legs.length },
                        { id: "waiting", label: "Waiting", count: waitingMovements.length },
                        { id: "resolved", label: "Resolved", count: closedToday.length },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        aria-pressed={shapeTab === tab.id}
                        className={styles.shapeTab}
                        onClick={() => setShapeTab(tab.id)}
                      >
                        <span>{tab.label}</span>
                        <strong>{tab.count === 0 ? "none" : tab.count}</strong>
                      </button>
                    ))}
                  </div>
                  <div
                    className={styles.shapeBody}
                    tabIndex={0}
                    role="region"
                    aria-label="Movement summary contents"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {shapeTab === "stage" ? (
                      <>
                        <ul className={styles.stageSummary}>
                          {openStages.map((stage) => (
                            <li key={stage.id}>
                              <button
                                type="button"
                                className={styles.stageSummaryLink}
                                disabled={stage.movements.length === 0}
                                onClick={() => {
                                  // R2 item 7 (P3): `stage.movements` is `openStages` — deliberately
                                  // whole-network (this tab's own byte-identical-with-and-without-a-
                                  // service test depends on it staying that way) — so its first entry
                                  // can sit outside the chosen service even when another member of the
                                  // same stage does not. `jumpToMovement`'s own D-d handling already
                                  // degrades gracefully for an out-of-scope target (opens the drawer and
                                  // announces why, rather than doing nothing), but picking the first
                                  // IN-SCOPE member when one exists means a working scroll-to-row jump is
                                  // never skipped in favour of that fallback for no reason.
                                  const first =
                                    isInServiceScope !== null
                                      ? (stage.movements.find(isInServiceScope) ?? stage.movements[0])
                                      : stage.movements[0];
                                  if (first) jumpToMovement(first.id, true);
                                }}
                                aria-label={`${stage.label}: ${stage.movements.length} synthetic open movement records${stage.movements.length ? ", show in worklist" : ""}`}
                              >
                                <span>{stage.label}</span>
                                <span className={styles.stageMeter} aria-hidden="true">
                                  <i
                                    style={{
                                      width: `${openMovements.length ? (stage.movements.length / openMovements.length) * 100 : 0}%`,
                                    }}
                                  />
                                </span>
                                <strong
                                  className={stage.movements.length === 0 ? styles.glanceCountZero : styles.glanceCount}
                                >
                                  <span className="sr-only">Synthetic movement records: </span>
                                  {stage.movements.length === 0 ? "none" : stage.movements.length}
                                </strong>
                                {stage.movements.length > 0 ? (
                                  <small>
                                    Longest journey{" "}
                                    {splitDuration(
                                      Math.max(
                                        ...stage.movements.map((movement) => Math.max(now - movement.openedAt, 0)),
                                      ),
                                    )}
                                  </small>
                                ) : null}
                              </button>
                            </li>
                          ))}
                        </ul>
                        <div className={styles.stageFollowUp}>
                          <h3>Next</h3>
                          <button type="button" onClick={() => setShapeTab("transport")}>
                            Transport not accepted{" "}
                            <strong>
                              <span className="sr-only">Synthetic records: </span>
                              {unacceptedTransport.length === 0 ? "none" : unacceptedTransport.length}
                            </strong>
                          </button>
                        </div>
                        <p className={styles.sDiv}>Left the pathway</p>
                        <div className={styles.sRowStatic}>
                          <span className={styles.sName}>Journeys arrived</span>
                          <span className={styles.sMeter} aria-hidden="true">
                            <i
                              style={{
                                width: `${
                                  closedToday.length
                                    ? (arrivedMovements.length /
                                        Math.max(arrivedMovements.length, didNotProceedMovements.length || 1)) *
                                      100
                                    : 0
                                }%`,
                              }}
                            />
                          </span>
                          <span className={styles.sVal}>
                            {arrivedMovements.length === 0 ? "none" : arrivedMovements.length}
                          </span>
                        </div>
                        <div className={styles.sRowStatic}>
                          <span className={styles.sName}>Did not proceed</span>
                          <span className={styles.sMeter} aria-hidden="true">
                            <i
                              style={{
                                width: `${
                                  closedToday.length
                                    ? (didNotProceedMovements.length /
                                        Math.max(arrivedMovements.length, didNotProceedMovements.length || 1)) *
                                      100
                                    : 0
                                }%`,
                              }}
                            />
                          </span>
                          <span className={styles.sVal}>
                            {didNotProceedMovements.length === 0 ? "none" : didNotProceedMovements.length}
                          </span>
                        </div>
                        <p className={styles.paneScope}>
                          No open movement stands at <b>arrived status</b>: arriving is what takes a movement out of the
                          pathway, so it is counted below the divider instead. {openMovements.length} open plus{" "}
                          {closedToday.length} that have left the pathway is {openMovements.length + closedToday.length}{" "}
                          movements raised in the network today.
                        </p>
                      </>
                    ) : null}
                    {shapeTab === "transport" ? (
                      <>
                        <ul className={styles.glance}>
                          <li className={styles.glanceItem}>
                            <span>Transport legs</span>
                            <span className={styles.glanceCount}>
                              <span className="sr-only">Synthetic records: </span>
                              {legs.length}
                            </span>
                          </li>
                          <li className={styles.glanceItem}>
                            <span>Requested or cancelled before acceptance</span>
                            <span
                              className={unacceptedTransport.length === 0 ? styles.glanceCountZero : styles.glanceCount}
                            >
                              <span className="sr-only">Synthetic records: </span>
                              {unacceptedTransport.length === 0 ? "none" : unacceptedTransport.length}
                            </span>
                          </li>
                          <li className={styles.glanceItem}>
                            <span>No transport yet</span>
                            <span
                              className={noTransportRecord.length === 0 ? styles.glanceCountZero : styles.glanceCount}
                            >
                              <span className="sr-only">Synthetic movement records: </span>
                              {noTransportRecord.length === 0 ? "none" : noTransportRecord.length}
                            </span>
                          </li>
                        </ul>
                        {legs.length === 0 ? (
                          <p className={styles.absent}>No transport leg is booked or moving right now.</p>
                        ) : (
                          <>
                            <WardGroupHeading title="Accepted by a provider" people={legs.length} />
                            <WardRecordList>
                              {legs.map((leg) => (
                                <TransportRow
                                  key={leg.movement.id}
                                  leg={leg}
                                  units={units}
                                  name={resolveSubjectPatient(leg.movement, { patients, referrals }).formalName}
                                />
                              ))}
                            </WardRecordList>
                          </>
                        )}
                        {unacceptedTransport.length > 0 ? (
                          <>
                            <WardGroupHeading title="Transport not accepted" people={unacceptedTransport.length} />
                            <WardRecordList>
                              {unacceptedTransport.map((movement) => (
                                <UnacceptedTransportRow
                                  key={movement.id}
                                  movement={movement}
                                  units={units}
                                  name={resolveSubjectPatient(movement, { patients, referrals }).formalName}
                                />
                              ))}
                            </WardRecordList>
                          </>
                        ) : null}
                        {noTransportRecord.length > 0 ? (
                          <>
                            <WardGroupHeading title="No transport yet" people={noTransportRecord.length} />
                            <WardRecordList>
                              {noTransportRecord.map((movement) => (
                                <NoTransportRecordRow
                                  key={movement.id}
                                  movement={movement}
                                  units={units}
                                  name={resolveSubjectPatient(movement, { patients, referrals }).formalName}
                                />
                              ))}
                            </WardRecordList>
                          </>
                        ) : null}
                      </>
                    ) : null}
                    {shapeTab === "waiting" ? (
                      <ShapeMovementList
                        movements={waitingMovements}
                        now={now}
                        referrals={referrals}
                        patients={patients}
                        onOpenDetail={openDetail}
                      />
                    ) : null}
                    {shapeTab === "resolved" ? (
                      <ShapeMovementList
                        movements={closedToday}
                        now={now}
                        referrals={referrals}
                        patients={patients}
                        onOpenDetail={openDetail}
                        resolved
                      />
                    ) : null}
                  </div>
                </>
              )}
            </Card>
          </aside>
        </div>

        <WardPrototypeFooter
          testId="ward-movements-governance"
          note="Patient journeys, transport legs and departments are invented · Not a medical device"
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
        />
      </main>
    </div>
  );
}

/** Short stage words for the hero stage track and the highlight note. */
const STAGE_SHORT: Record<Movement["stage"], string> = {
  placement_requested: "Referred",
  destination_review: "Review",
  accepted_awaiting_bed: "Accepted",
  pulled: "Pulled",
  handover_ready: "Handover",
  moving: "Moving",
  arrived: "Arrived",
};

type HeroHighlight = { id: string; label: string; tone?: WfTone; test: (movement: Movement) => boolean };

/**
 * The hero's highlight pills. Each one counts OPEN movements only, from fields the record holds:
 * tier, time waited against the configured ED access target and the named 8 hour severe-pressure
 * default, a typed legal expiry, and an escort on the transport leg. Pressing one highlights its
 * rows in the worklist; it never hides a row.
 */
function heroHighlights(now: Instant, accessTarget: number): HeroHighlight[] {
  const waited = (movement: Movement) => Math.max(now - movement.openedAt, 0);
  const hours = (minutes: number) => `${Math.round(minutes / 60)}h`;
  return [
    { id: "tier1", label: "Tier 1", test: (m) => isOpen(m) && m.urgency === 1 },
    {
      id: "past",
      label: `Past ${hours(accessTarget)}`,
      tone: "danger",
      test: (m) => isOpen(m) && waited(m) >= accessTarget,
    },
    {
      id: "over",
      label: `Over ${hours(ED_SEVERE_PRESSURE_WAIT_MINUTES)}`,
      tone: "warning",
      test: (m) => isOpen(m) && waited(m) >= ED_SEVERE_PRESSURE_WAIT_MINUTES && waited(m) < accessTarget,
    },
    { id: "form", label: "Form expiry", test: (m) => isOpen(m) && m.legalForm?.dueAt !== undefined },
    { id: "escort", label: "Escort", test: (m) => isOpen(m) && m.transport?.escortRequired === true },
  ];
}

function HighlightStat({
  label,
  value,
  tone,
  pressed,
  onToggle,
}: {
  label: string;
  value: number;
  tone?: WfTone;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    // `data-testid` for D-b/D-f coverage: these whole-network figures must read the same with and
    // without a chosen service. The DOM reads label then value ("Tier 1 18"); CSS draws the number first.
    <button
      type="button"
      className={flow.highlight}
      aria-pressed={pressed}
      onClick={onToggle}
      data-testid="movements-day-metric"
    >
      <span className={flow.highlightFigure}>
        <span className={flow.highlightLabel}>
          {tone && value > 0 ? <StatusGlyph tone={tone} size={9} /> : null}
          {label}
        </span>
        <strong className={flow.highlightValue}>{value}</strong>
      </span>
    </button>
  );
}

/** Urgency tier as a T1 to T3 pill: neutral, never red, with the word "Tier" for screen readers. */
function TierPill({ tier }: { tier: number }) {
  return (
    <span className={flow.tier} data-tier={tier}>
      <span className="sr-only">Tier </span>
      <span aria-hidden="true">T</span>
      {tier}
    </span>
  );
}

/**
 * One patient's worklist row (Movements overhaul, option A): tier, patient, route, barrier and
 * legal, time waited and the one next step, on a single line. The whole record lives in the
 * pop-up the name opens; the chevron opens the Patient page. The tier word is kept for screen
 * readers, so every row still carries the same `urgencyTierLabel` every other screen uses.
 */
function StageRow({
  movement,
  now,
  units,
  referrals = [],
  patients = [],
  accessTargetMinutes,
  reveal,
  consumeReveal,
  onOpenDetail,
  marked,
  selected,
}: {
  movement: Movement;
  now: Instant;
  units: Unit[];
  referrals?: Referral[];
  patients?: readonly Patient[];
  /** The coordinator-configured ED access target, in minutes — Task 6 of the audit-wiring plan
   *  (2026-09-16). Required, not defaulted: the wait meter must never fall back to a bare 24h. */
  accessTargetMinutes: number;
  reveal: { id: string; request: number } | null;
  consumeReveal: (request: number) => boolean;
  onOpenDetail: (id: string) => void;
  /** Matched by the search or the hero highlight. Marked rows are tinted, never filtered. */
  marked: boolean;
  selected: boolean;
}) {
  const rowRef = useRef<HTMLLIElement>(null);
  const revealRequest = reveal?.id === movement.id ? reveal.request : null;
  useEffect(() => {
    // The screen owns consumption so a later grouping remount cannot replay an old jump.
    if (revealRequest === null || !rowRef.current || !consumeReveal(revealRequest)) return;
    rowRef.current?.focus({ preventScroll: true });
    rowRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  }, [revealRequest, consumeReveal]);
  const originEd = edById(movement.originEdId);
  const originLabel = departmentLabel(movement.originEdId, originEd?.name);
  const { destinationLabel } = transportRouteLabels(movement, units);
  const blocker = meaningfulBlocker(movement);
  const healthService = movementHealthService(movement) ?? "Origin service not identified";

  /*
   * A closed movement is MARKED, never filtered (owner ruling 2026-09-05): the recorded outcome as
   * a chip, the recorded reason as its barrier, and a clock frozen at closure.
   */
  const closure = movement.closure;
  const closureState: { level: WardChipLevel; text: string } | null =
    closure === undefined
      ? null
      : closure.outcome === "arrived"
        ? { level: "routine", text: "Arrived" }
        : { level: "cancelled", text: "Did not proceed" };

  const clockEnd = closure ? closure.at : now;
  const patientInfo = resolveSubjectPatient(movement, { patients, referrals });

  // Legal line: register title plus the recorded expiry only. Never a computed limit (D5).
  const dueAt = movement.legalForm?.dueAt;
  const isBreached = dueAt !== undefined && dueAt < now;
  const isExpiring = dueAt !== undefined && dueAt >= now && dueAt - now < 60;
  let legalTagTone: "danger" | "warn" | undefined = undefined;
  let legalText = "";
  if (movement.legalForm) {
    const formTitle = legalFormNameLabelFirst(movement.legalForm);
    if (dueAt === undefined) {
      legalText = `${formTitle} - no recorded expiry on this record`;
    } else if (isBreached) {
      legalTagTone = "danger";
      legalText = `${formTitle} - recorded expiry passed ${splitDuration(now - dueAt)} ago`;
    } else {
      if (isExpiring) legalTagTone = "warn";
      legalText = `${formTitle} - recorded expiry in ${splitDuration(dueAt - now)}`;
    }
  } else if (movement.legalStatus === "Voluntary") {
    legalText = "Voluntary";
  } else {
    legalTagTone = "warn";
    legalText = "No legal form recorded";
  }

  // Route second line: the transport leg when there is one, otherwise where the bed stands.
  const leg = movement.transport;
  const legState = transportLeg(leg);
  const need = transportNeedState(movement);
  let routeSub = "";
  if (leg && legState) {
    const stateLabel =
      legState === "Requested" ? "Requested" : (LEG_STATE_LABEL[legState as MovementLegState] ?? legState);
    routeSub = `${stateLabel}, ${leg.provider}${leg.escortRequired ? " · escort" : ""}`;
  } else if (movement.acceptedUnitId) {
    routeSub =
      movement.stage === "accepted_awaiting_bed"
        ? "Accepted, bed not pulled"
        : need === "not_needed"
          ? "Bed allocated · no transport needed"
          : need === "needed"
            ? "Bed allocated · no transport booked"
            : "Bed allocated";
  } else if (movement.declines.length > 0) {
    routeSub = `${movement.declines.length} decline${movement.declines.length === 1 ? "" : "s"} recorded${
      movement.escalation ? " · state desk escalated" : ""
    }`;
  } else {
    routeSub =
      movement.referredUnitIds.length > 0
        ? `${movement.referredUnitIds.length} ward${movement.referredUnitIds.length === 1 ? "" : "s"} asked`
        : "No ward asked yet";
  }

  const waitedMinutes = Math.max(clockEnd - movement.openedAt, 0);
  // "Due soon" from the named ED severe-pressure default, "Overdue" past the configured ED access
  // target. No tier-specific window is invented here.
  const waitThresholds = { dueSoon: ED_SEVERE_PRESSURE_WAIT_MINUTES, overdue: accessTargetMinutes };
  const waitTone: "danger" | "warning" | undefined = closure
    ? undefined
    : waitedMinutes >= waitThresholds.overdue
      ? "danger"
      : waitedMinutes >= waitThresholds.dueSoon
        ? "warning"
        : undefined;
  const waitWord = closure
    ? "in journey before it ended"
    : waitTone === "danger"
      ? "Overdue"
      : waitTone === "warning"
        ? "Due soon"
        : "waited";
  const barrierText = closure ? closure.reason : (blocker ?? stageCopy[movement.stage].label);
  const barrierTone: WfTone = closure
    ? "closed"
    : legalTagTone === "danger" || (movement.urgency === 1 && blocker)
      ? "danger"
      : blocker || legalTagTone
        ? "warning"
        : "neutral";
  const detailTitle = [
    healthService,
    `Owner: ${movement.owner.trim() || "Not recorded"}`,
    movement.specialling ? "One-to-one nursing" : null,
    movement.highAcuity ? "High acuity" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const step = movementNextStep(movement);

  return (
    <li
      ref={rowRef}
      tabIndex={-1}
      className={cx(flow.grid, flow.row)}
      data-ward-primitive="record-row"
      data-record-key={movement.id}
      data-revealed={revealRequest !== null ? "true" : undefined}
      data-highlight={marked ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      data-closed={closure ? "true" : undefined}
      data-tone={closure ? "neutral" : movement.urgency === 1 ? "danger" : "neutral"}
      aria-label={`Movement for ${patientInfo.formalName}`}
      onClick={(event) => {
        // The row is a large target for the pointer; the name button is the keyboard route.
        if ((event.target as HTMLElement).closest("a, button, input, select")) return;
        onOpenDetail(movement.id);
      }}
    >
      <span>
        <TierPill tier={movement.urgency} />
        <span className="sr-only">{urgencyTierLabel(movement.urgency)}</span>
      </span>
      <span className={flow.cell} title={detailTitle}>
        <span className={flow.line}>
          {movement.flaggedUrgent ? (
            <span title="Flagged urgent">
              <StatusGlyph tone="danger" size={9} />
              <span className="sr-only">Flagged urgent </span>
            </span>
          ) : null}
          <button
            type="button"
            className={flow.name}
            data-ward-primitive="record-id"
            onClick={() => onOpenDetail(movement.id)}
            aria-label={`What is recorded for ${patientInfo.formalName}`}
          >
            {patientInfo.formalName}
          </button>
          {movement.security === "Secure" ? (
            <Lock size={13} className={flow.lock} aria-label="Needs a locked bed" />
          ) : null}
        </span>
        <span className={flow.sub}>
          <span className="sr-only">UMRN </span>
          <span className={flow.mono}>{patientInfo.umrn}</span> · {movement.cohort} · {movement.sex}
          {!movement.owner.trim() ? " · No owner" : ""}
        </span>
      </span>
      <span className={flow.cell}>
        <span className={flow.main}>
          <span title={originLabel} aria-label={originLabel}>
            {originEd ? `${originEd.siteCode} ED` : originLabel}
          </span>{" "}
          {movement.acceptedUnitId ? (
            <>
              to{" "}
              <Link
                href={`/mockups/ward-flow/board/${movement.acceptedUnitId}`}
                className={flow.wardLink}
                title={`Open ${destinationLabel} Bed Board`}
              >
                {destinationLabel}
              </Link>
            </>
          ) : (
            <span className={flow.noDestination}>· no destination yet</span>
          )}
        </span>
        <span className={flow.sub} title={routeSub}>
          {routeSub}
        </span>
      </span>
      <span className={flow.cell}>
        <span className={flow.line}>
          <StatusGlyph tone={barrierTone} size={9} />
          {closureState ? (
            <span className={flow.chip} data-ward-primitive="chip">
              {closureState.text}
            </span>
          ) : null}
          <span className={flow.main} title={barrierText}>
            <span className="sr-only">{closure ? "Closure note: " : blocker ? "Delay barrier: " : "Stage: "}</span>
            {closureState ? " · " : ""}
            {barrierText}
          </span>
        </span>
        <span className={flow.sub} data-tone={legalTagTone} title={legalText}>
          {legalText}
        </span>
      </span>
      <span className={flow.wait}>
        <Timer
          at={movement.openedAt * MS_PER_MINUTE}
          now={clockEnd * MS_PER_MINUTE}
          direction="waiting"
          thresholds={
            closure
              ? undefined
              : { dueSoon: waitThresholds.dueSoon * MS_PER_MINUTE, overdue: waitThresholds.overdue * MS_PER_MINUTE }
          }
          hideFlagWord
          hideDirection
        />
        {/* Task 6 (2026-09-16): the meter reads the configured ED access target, never 24h. */}
        <span
          className={flow.meter}
          data-tone={waitTone}
          aria-hidden="true"
          title={`${splitDuration(waitedMinutes)} of ${splitDuration(accessTargetMinutes)}`}
        >
          <i style={{ width: `${Math.min(100, (waitedMinutes / accessTargetMinutes) * 100).toFixed(0)}%` }} />
        </span>
        <span className={flow.waitWord} data-tone={waitTone}>
          {waitWord}
        </span>
      </span>
      <span className={flow.next}>
        {step === null ? (
          <span className={flow.nextOwner}>{closure ? `Closed ${formatInstantWithDay(closure.at, now)}` : ""}</span>
        ) : step.kind !== "wait" ? (
          <Link
            className={buttonClass({ variant: "sec", size: "sm" })}
            href={`/mockups/ward-flow/movements/${movement.id}`}
            title={`${step.label} on the Patient page`}
          >
            {step.label}
          </Link>
        ) : (
          <>
            <span className={flow.nextLabel}>{step.label}</span>
            <span className={flow.nextOwner}>{step.owner}</span>
          </>
        )}
      </span>
      <Link
        className={buttonClass({ variant: "ghost", size: "sm", iconOnly: true, className: flow.review })}
        href={`/mockups/ward-flow/movements/${movement.id}`}
        aria-label={`Review patient ${patientInfo.formalName}`}
        title="Open the Patient page"
      >
        <ChevronRight size={16} aria-hidden="true" />
      </Link>
    </li>
  );
}

/**
 * What a coordinator READS for each transport state, decided in exactly one place.
 *
 * `leg.state` is `MovementLegState` (`movements-derivations.ts`), which is `transportLeg`'s own
 * union minus the one value this screen cannot produce — never re-derived here — so a row and the
 * `transportCounts` tally beside it can never disagree about which state a given leg is in. The
 * segment strip above reads its labels from this same map for the same reason.
 *
 * ⚠️ **`Accepted` STILL READS "Booked", DELIBERATELY.** The five-state collapse (Ward Lead,
 * 2026-09-05) was a ruling about the TYPE, not about the words on the board. This screen has always
 * called an accepted job "Booked" — the row's clock says "since booked" and `bookedAt` is the job's
 * `acceptedAt` — and the module's own comment defines "booked" as "a provider has accepted". Ward
 * vocabulary here is owner territory (pull-not-hold, discharged-not-released), so the collapse
 * changes no coordinator-facing word except by ADDING one: `Collected` was previously folded into
 * "En route" and had no word of its own.
 *
 * ⚠️ **THAT ADDITION MOVES A NUMBER A COORDINATOR MAY KNOW BY SIGHT.** In today's fixture the old
 * "En route" tile read 6; it now reads 0 with a "Collected" tile at 6, because those six patients
 * are in a vehicle that has already picked them up. The finer distinction is the point of the
 * collapse — it is what `transportLeg` knew all along and this screen was discarding.
 */
/** Rows shown per group in the worklist before Show all, and in a single ungrouped list. */
const GROUP_CAP = 4;
const LIST_CAP = 12;

function moreNote(hidden: number): string | undefined {
  return hidden > 0 ? `${hidden} more` : undefined;
}

/** What the worklist search box matches: the person's names and UMRN, and the ED they left. */
function movementSearchText(movement: Movement, patients: readonly Patient[], referrals: Referral[]): string {
  const person = resolveSubjectPatient(movement, { patients, referrals });
  const ed = edById(movement.originEdId);
  return [
    person.formalName,
    person.displayName,
    person.umrn,
    ed ? `${ed.siteCode} ED` : "",
    departmentLabel(movement.originEdId, ed?.name),
  ]
    .join(" ")
    .toLowerCase();
}

/** Transport states in bar order, with the data fill each takes in the bar and legend. */
const TRANSPORT_STATES: { id: MovementLegState; fill: WfFill; hatch?: boolean }[] = [
  { id: "Accepted", fill: "data-3" },
  { id: "En route", fill: "data-2" },
  { id: "Collected", fill: "data-1" },
  { id: "Arrived", fill: "ready" },
  { id: "Cancelled", fill: "closed" },
];

/** A leg's state as a glyph: hollow while booked, filled while moving, a tick once delivered. */
const LEG_STATE_TONE: Record<MovementLegState, WfTone> = {
  Accepted: "neutral",
  "En route": "info",
  Collected: "info",
  Arrived: "success",
  Cancelled: "closed",
};

const LEG_STATE_LABEL: Record<MovementLegState, string> = {
  Accepted: "Booked",
  "En route": "En route",
  Collected: "Collected",
  Arrived: "Arrived",
  Cancelled: "Cancelled",
};

const LEG_STATE_LEVEL: Record<MovementLegState, WardChipLevel> = {
  Accepted: "accepted",
  "En route": "enroute",
  Collected: "enroute",
  Arrived: "routine",
  Cancelled: "cancelled",
};

function TransportRow({ leg, units, name }: { leg: TransportLegRow; units: Unit[]; name: string }) {
  const movement = leg.movement;
  const { originLabel, destinationLabel } = transportRouteLabels(movement, units);

  return (
    <WardRecordRow
      id={name}
      recordKey={movement.id}
      tone={leg.state === "Cancelled" ? "danger" : leg.state === "Arrived" ? "good" : "neutral"}
      states={[{ level: LEG_STATE_LEVEL[leg.state], text: LEG_STATE_LABEL[leg.state] }]}
      clock={{ value: splitDuration(Math.max(leg.minutesSinceBooked, 0)), sub: "since booked" }}
      attributes={[`Provider: ${leg.provider}`, `From ${originLabel}`, `To ${destinationLabel}`]}
      actions={
        <Link className={styles.action} href={`/mockups/ward-flow/movements/${movement.id}`}>
          Review patient
        </Link>
      }
    />
  );
}

function UnacceptedTransportRow({ movement, units, name }: { movement: Movement; units: Unit[]; name: string }) {
  const transport = movement.transport;
  const cancelled = transport?.cancelledAt !== undefined;
  const { originLabel, destinationLabel } = transportRouteLabels(movement, units);
  return (
    <WardRecordRow
      id={name}
      recordKey={movement.id}
      tone={cancelled ? "danger" : "neutral"}
      states={[
        {
          level: cancelled ? "cancelled" : "accepted",
          text: cancelled ? "Cancelled before acceptance" : "Requested",
        },
      ]}
      clock={{ value: "Not accepted", sub: "No accepted time recorded" }}
      attributes={[
        `Provider: ${transport?.provider ?? "Not recorded"}`,
        `From ${originLabel}`,
        `To ${destinationLabel}`,
      ]}
      actions={
        <Link className={styles.action} href={`/mockups/ward-flow/movements/${movement.id}`}>
          Review patient
        </Link>
      }
    />
  );
}

function NoTransportRecordRow({ movement, units, name }: { movement: Movement; units: Unit[]; name: string }) {
  const { originLabel, destinationLabel } = transportRouteLabels(movement, units);
  return (
    <WardRecordRow
      id={name}
      recordKey={movement.id}
      tone="neutral"
      states={[{ level: "routine", text: "No transport yet" }]}
      clock={{ value: "No job", sub: "No transport time recorded" }}
      attributes={[`Provider: Not recorded`, `From ${originLabel}`, `To ${destinationLabel}`]}
      actions={
        <Link className={styles.action} href={`/mockups/ward-flow/movements/${movement.id}`}>
          Review patient
        </Link>
      }
    />
  );
}

function transportRouteLabels(movement: Movement, units: Unit[]) {
  const originEd = edById(movement.originEdId);
  const destinationUnit = movement.acceptedUnitId
    ? units.find((unit) => unit.id === movement.acceptedUnitId)
    : undefined;
  return {
    originLabel: departmentLabel(movement.originEdId, originEd?.name),
    destinationLabel: movement.acceptedUnitId
      ? wardLabel(movement.acceptedUnitId, destinationUnit?.name)
      : "No accepted destination recorded",
  };
}

function ShapeMovementList({
  movements,
  now,
  referrals = [],
  patients = [],
  onOpenDetail,
  resolved = false,
}: {
  movements: Movement[];
  now: Instant;
  referrals?: Referral[];
  patients?: readonly Patient[];
  onOpenDetail: (id: string) => void;
  resolved?: boolean;
}) {
  if (movements.length === 0) {
    return <p className={styles.absent}>No movement is in this group.</p>;
  }
  return (
    <ul className={styles.shapeList}>
      {movements.map((movement) => {
        const end = movement.closure?.at ?? now;
        const patientInfo = resolveSubjectPatient(movement, { patients, referrals });
        return (
          <li key={movement.id}>
            <button type="button" className={styles.shapeMovement} onClick={() => onOpenDetail(movement.id)}>
              <span>
                <strong>{patientInfo.displayName}</strong> ({patientInfo.umrn})
                <small>{resolved ? movement.closure?.reason : `Owner: ${movement.owner || "not recorded"}`}</small>
              </span>
              <span className={styles.shapeWait}>
                {splitDuration(Math.max(end - movement.openedAt, 0))}
                <small>{resolved ? "journey" : "waiting"}</small>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
