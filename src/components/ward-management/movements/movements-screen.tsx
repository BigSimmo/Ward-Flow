"use client";

import Link from "next/link";

import type { Instant } from "@/components/ward-management/ward-clock";
import { dayOf, splitDuration } from "@/components/ward-management/ward-clock";
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
import { WardBar, type WardBarSegment } from "@/components/ward-management/ward-bar";
import type { WardChipLevel } from "@/components/ward-management/ward-chip";
import { WardChip } from "@/components/ward-management/ward-chip";
import { WardPanel } from "@/components/ward-management/ward-panel";
import { WardGroupHeading, WardRecordList, WardRecordRow } from "@/components/ward-management/ward-record-row";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { edById } from "@/components/ward-management/ward-sites";
import { departmentLabel, wardLabel } from "@/components/ward-management/ward-absence-labels";
import type { HealthService, Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
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
import { MovementDrawer } from "./movement-drawer";
import { MovementHorizonGantt } from "./movement-horizon-gantt";
import styles from "./movements.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { LegalLimitsNotChecked } from "@/components/ward-management/legal-limits-not-checked";

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
      window.history.pushState({ wardMovementDetail: id }, "");
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
  const [reveal, setReveal] = useState<{ id: string; request: number } | null>(null);
  const consumedReveal = useRef(0);
  const consumeReveal = useCallback((request: number) => {
    if (request <= consumedReveal.current) return false;
    consumedReveal.current = request;
    return true;
  }, []);

  function revealMovement(id: string, byStage = false) {
    setBoardTab("every");
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
  const [transportFilter, setTransportFilter] = useState<MovementLegState | "all">("all");
  const filteredLegs = useMemo(
    () => (transportFilter === "all" ? legs : legs.filter((leg) => leg.state === transportFilter)),
    [legs, transportFilter],
  );
  const withoutBookedTransport = openMovements.length - legs.length;
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
    () => deriveMovementHorizonLanes(movements, units, now, {
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
      { id: "with", title: "A transport leg is booked", rows: worklistWithLeg },
      { id: "requested", title: "Unaccepted transport records", rows: worklistRequestedLeg },
      { id: "without", title: "No transport record", rows: worklistWithoutLeg },
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
        announceToWardShell(
          `This patient is outside ${service}. Show all services to see it in the list.`,
        );
        return;
      }
    }
    revealMovement(movementId, byStage);
  }

  const arrivedMovements = closedToday.filter((m) => m.closure?.outcome === "arrived");
  const didNotProceedMovements = closedToday.filter((m) => m.closure?.outcome === "did_not_proceed");

  return (
    <div
      className={styles.screen}
      data-testid="ward-movements-page"
      data-ward-design="third-edition"
      data-ward-rebuilt-screen="movements"
    >
      <main id="main-content" className={styles.main}>
        <header className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>
            <span className={styles.liveDot} aria-hidden="true" />
            Movements
          </h1>
          <LegalLimitsNotChecked />
        </header>

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

        <div className={styles.dayPanel}>
          <WardPanel title="The day" count={`${openMovements.length} open movements`}>
            <div className={styles.dayMetrics}>
              <DayMetric label="Open" value={openMovements.length} />
              <DayMetric label="Resolved today" value={closedToday.length} />
              <DayMetric label="Tier 1 open" value={tierOneOpen.length} tone="danger" />
              <DayMetric label="Transport legs" value={legs.length} />
              <DayMetric label="No transport leg" value={withoutBookedTransport} tone="warning" />
              <DayMetric label="Active corridors" value={activeCorridorCount} />
            </div>
            <div className={styles.attentionBand}>
              <div className={styles.attentionHeading}>
                <h3 className={styles.attentionTitle}>Worth your attention</h3>
                {attentionCore.length > 0 ? (
                  <span>
                    {attentionCore.length} of {tierOneOpen.length} tier 1 open
                  </span>
                ) : null}
              </div>
              {attentionMovements.length === 0 ? (
                <p className={styles.attentionEmpty}>No open tier 1 movement needs calling out.</p>
              ) : (
                // D-b (Ward Lead's decisions, 2026-09-17): "Worth your attention" is already
                // whole-network — `attentionMovements` is built off `openMovements`, never the
                // scoped `worklistMovements` — so it never needed narrowing. What it lacked was the
                // marker: a movement outside the chosen service is named here without saying so.
                <div className={styles.attentionList}>
                  {attentionMovements.map((movement) => {
                    const outsideService = service !== null && isInServiceScope !== null && !isInServiceScope(movement);
                    const who = resolveSubjectPatient(movement, { patients, referrals }).displayName;
                    return (
                      <button
                        key={movement.id}
                        type="button"
                        className={styles.attentionPill}
                        data-record-key={movement.id}
                        onClick={() => jumpToMovement(movement.id)}
                        aria-label={`Find ${who} in worklist: ${meaningfulBlocker(movement) ?? stageCopy[movement.stage].label}${outsideService ? ` — outside ${service}` : ""}`}
                      >
                        <strong>{who}</strong>
                        <span>{meaningfulBlocker(movement) ?? stageCopy[movement.stage].label}</span>
                        <span>{splitDuration(Math.max(now - movement.openedAt, 0))} waiting</span>
                        {outsideService ? (
                          <span data-testid={`movements-attention-outside-${movement.id}`}>{`Outside ${service}`}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </WardPanel>
        </div>

        <div className={styles.trafficPanel}>
          <WardPanel title="Today’s traffic" count={`${activeCorridorCount} active corridors`}>
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
          </WardPanel>
        </div>

        <div className={styles.columns}>
          <div className={styles.primary}>
            {/* D-f: the scope bar and its "not these figures" sentence moved to the top of the
                page (see the comment beside the header above) — never here, on the panel they were
                disclaiming. */}
            <WardPanel title="Movement worklist" count={`${worklistMovements.length} moves`}>
              <div className={styles.worklistToolbar}>
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

                {boardTab === "every" ? (
                  <div className={styles.orderBar} role="radiogroup" aria-label="Order">
                    <span className={styles.orderLegend} aria-hidden="true">
                      Arrange
                    </span>
                    {(
                      [
                        { id: "stands", label: "Stage", description: "By where it stands", count: 7 },
                        {
                          id: "transport",
                          label: "Transport",
                          description: "By transport leg, and what has none",
                          count: worklistTransportGroups.filter((g) => g.rows.length > 0).length,
                        },
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
                        {"count" in option ? <span className={styles.orderBtnBadge}>{option.count}</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {boardTab === "every" ? (
                <div role="tabpanel" id="movements-pane-every" aria-labelledby="movements-tab-every">
                  <div className={styles.movementListBody} tabIndex={0} role="region" aria-label="Movement records">
                    {order === "cause"
                      ? worklistCauseGroups.map((group) => (
                          <div key={group.key} className={styles.stageBlock}>
                            <div className={styles.causeGroupHeading} data-sev={group.sev}>
                              <h3 className={styles.causeGroupTitle}>{group.title}</h3>
                              {group.mark ? <span className={styles.causeGroupMark}>{group.mark}</span> : null}
                              {group.note ? <p className={styles.causeGroupNote}>{group.note}</p> : null}
                              <span className={styles.causeGroupCount}>{group.movements.length}</span>
                            </div>
                            <WardRecordList>
                              {group.movements.map((movement) => (
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
                                />
                              ))}
                            </WardRecordList>
                          </div>
                        ))
                      : null}
                    {order === "stands"
                      ? worklistStages.map((stage) => (
                          <div key={stage.id} className={styles.stageBlock}>
                            {stage.movements.length > 0 ? (
                              <>
                                <WardGroupHeading title={stage.label} people={stage.movements.length} />
                                <WardRecordList>
                                  {stage.movements.map((movement) => (
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
                                    />
                                  ))}
                                </WardRecordList>
                              </>
                            ) : (
                              <div className={styles.emptyStage}>
                                <h3 className={styles.emptyStageTitle}>{stage.label}</h3>
                                <p className={styles.absent}>No movements at this stage{inServiceSuffix(service)}.</p>
                              </div>
                            )}
                          </div>
                        ))
                      : null}

                    {order === "transport"
                      ? worklistTransportGroups.map((group) => (
                          <div key={group.id} className={styles.stageBlock}>
                            {group.rows.length > 0 ? (
                              <>
                                <WardGroupHeading title={group.title} people={group.rows.length} />
                                <WardRecordList>
                                  {group.rows.map((movement) => (
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
                                    />
                                  ))}
                                </WardRecordList>
                              </>
                            ) : (
                              <div className={styles.emptyStage}>
                                <h3 className={styles.emptyStageTitle}>{group.title}</h3>
                                <p className={styles.absent}>
                                  No movement is in this group right now{inServiceSuffix(service)}.
                                </p>
                              </div>
                            )}
                          </div>
                        ))
                      : null}

                    {order === "wait" ? (
                      <div className={styles.stageBlock}>
                        {/* `byLongestWait` measures a closed movement to its CLOSURE, not to now — the
                          row beside it renders a frozen clock, and an order computed from a running
                          one would contradict the number the reader can see. */}
                        <WardGroupHeading title="Longest wait first" people={worklistMovements.length} />
                        <WardRecordList>
                          {byLongestWait(worklistMovements, now).map((movement) => (
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
                            />
                          ))}
                        </WardRecordList>
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
                      <WardRecordList>
                        {worklistClosedToday.map((movement) => (
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
                          />
                        ))}
                      </WardRecordList>
                    )}
                  </div>
                </div>
              )}
            </WardPanel>
          </div>

          <aside className={styles.secondary} aria-label="Movement details">
            {/* The count read `${legs.length} legs` until 2026-09-06 and became redundant that day:
                `WardBar` now RENDERS its caption rather than hiding it in the aria-label, and the caption
                beneath this header already reads "8 transport legs booked or moving". The caption is the
                one that stays — it is the only line saying what the RAIL is. Same removal as the Delays
                panel, for the same reason, and made at the call site rather than suppressed in the
                primitive: "render the caption only when it adds something" is not evaluable. */}
            <WardPanel title="Transport right now">
              {legs.length === 0 ? (
                <p className={styles.absent}>No transport leg is booked or moving right now.</p>
              ) : (
                <div className={styles.transportWidget}>
                  <div className={styles.transportBarWrap}>
                    <WardBar
                      segments={
                        [
                          { label: LEG_STATE_LABEL.Accepted, value: counts.Accepted, tone: "accent" },
                          { label: LEG_STATE_LABEL["En route"], value: counts["En route"], tone: "warning" },
                          { label: LEG_STATE_LABEL.Collected, value: counts.Collected, tone: "warning" },
                          { label: LEG_STATE_LABEL.Arrived, value: counts.Arrived, tone: "good" },
                          { label: LEG_STATE_LABEL.Cancelled, value: counts.Cancelled, tone: "danger" },
                        ] satisfies WardBarSegment[]
                      }
                      caption={`${legs.length} transport ${legs.length === 1 ? "leg" : "legs"} booked or moving`}
                    />
                  </div>

                  <div className={styles.transportFilterBar} role="group" aria-label="Filter transport legs by status">
                    <button
                      type="button"
                      className={styles.transportFilterBtn}
                      data-active={transportFilter === "all" ? "true" : undefined}
                      onClick={() => setTransportFilter("all")}
                    >
                      <span>All</span>
                      <span className={styles.transportFilterCount}>{legs.length}</span>
                    </button>
                    {(
                      [
                        { id: "Accepted", label: "Booked", count: counts.Accepted, tone: "accent" },
                        { id: "En route", label: "En route", count: counts["En route"], tone: "warning" },
                        { id: "Collected", label: "Collected", count: counts.Collected, tone: "warning" },
                        { id: "Arrived", label: "Arrived", count: counts.Arrived, tone: "good" },
                        { id: "Cancelled", label: "Cancelled", count: counts.Cancelled, tone: "danger" },
                      ] as const
                    ).map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        className={styles.transportFilterBtn}
                        data-tone={st.tone}
                        data-active={transportFilter === st.id ? "true" : undefined}
                        disabled={st.count === 0}
                        onClick={() => setTransportFilter(st.id)}
                      >
                        <span>{st.label}</span>
                        <span className={styles.transportFilterCount}>{st.count === 0 ? "none" : st.count}</span>
                      </button>
                    ))}
                  </div>

                  <div className={styles.transportRunsFeed} role="feed" aria-label="Active transport legs">
                    {filteredLegs.length === 0 ? (
                      <p className={styles.transportRunsEmpty}>No transport legs in this status.</p>
                    ) : (
                      filteredLegs.map((leg) => {
                        const patientInfo = resolveSubjectPatient(leg.movement, { patients, referrals });
                        const { originLabel, destinationLabel } = transportRouteLabels(leg.movement, units);
                        const legTone =
                          leg.state === "Arrived"
                            ? "good"
                            : leg.state === "Cancelled"
                              ? "danger"
                              : leg.state === "Accepted"
                                ? "accent"
                                : "warning";
                        const stateLabel = leg.state === "Accepted" ? "Booked" : LEG_STATE_LABEL[leg.state] ?? leg.state;

                        return (
                          <button
                            key={leg.movement.id}
                            type="button"
                            className={styles.transportRunCard}
                            onClick={() => {
                              openDetail(leg.movement.id);
                              revealMovement(leg.movement.id);
                            }}
                            aria-label={`Inspect ${patientInfo.formalName}, ${stateLabel} via ${leg.provider}`}
                          >
                            <div className={styles.transportRunHeader}>
                              <div className={styles.transportRunIdentity}>
                                <span className={styles.transportRunName}>{patientInfo.formalName}</span>
                              </div>
                              <span className={styles[`transportRunPill_${legTone}`]}>{stateLabel}</span>
                            </div>
                            <div className={styles.transportRunCorridor}>
                              <span className={styles.transportRunNode}>{originLabel}</span>
                              <span className={styles.transportRunArrow} aria-hidden="true">→</span>
                              <span className={styles.transportRunNode}>{destinationLabel}</span>
                            </div>
                            <div className={styles.transportRunFooter}>
                              <span className={styles.transportRunProvider}>{leg.provider}</span>
                              <span className={styles.transportRunTime}>
                                Booked {splitDuration(leg.minutesSinceBooked)} ago
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </WardPanel>

            <WardPanel
              title="Shape of the day"
              count={shapeTab === "resolved" ? `${closedToday.length} resolved today` : `${openMovements.length} open`}
            >
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
                                  Math.max(...stage.movements.map((movement) => Math.max(now - movement.openedAt, 0))),
                                )}
                              </small>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className={styles.stageFollowUp}>
                      <h3>Next to review</h3>
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
                        <span>No transport record</span>
                        <span className={noTransportRecord.length === 0 ? styles.glanceCountZero : styles.glanceCount}>
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
                        <WardGroupHeading title="Unaccepted transport records" people={unacceptedTransport.length} />
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
                        <WardGroupHeading title="No transport record" people={noTransportRecord.length} />
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
                  <ShapeMovementList movements={waitingMovements} now={now} referrals={referrals} patients={patients} onOpenDetail={openDetail} />
                ) : null}
                {shapeTab === "resolved" ? (
                  <ShapeMovementList movements={closedToday} now={now} referrals={referrals} patients={patients} onOpenDetail={openDetail} resolved />
                ) : null}
              </div>
            </WardPanel>
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
          dispatch={dispatch}
          onClose={closeDetail}
        />
      </main>
    </div>
  );
}

function DayMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning" | "danger";
}) {
  return (
    // `data-testid` added for D-b/D-f test coverage: it lets a test isolate this panel's own
    // whole-network FIGURES from the "Worth your attention" band beside them, which now legitimately
    // carries an "Outside {S}" marker when a service is chosen (D-b) — the figures themselves never
    // change, only that sub-list gains a marker, and a test comparing the whole panel's raw text
    // needs a way to tell the two apart.
    <div className={styles.dayMetric} data-tone={tone} data-testid="movements-day-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/**
 * One patient's row inside a stage group. The urgency tier IS the row's state word — the same
 * `urgencyTierLabel` spelling every other screen uses, never a bare "P1"/"P2"/"P3" badge — so a
 * tier-1 row is toned danger with the word right beside the colour, and every other row still
 * carries a word even though nothing about it is urgent.
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
}: {
  movement: Movement;
  now: Instant;
  units: Unit[];
  referrals?: Referral[];
  patients?: readonly Patient[];
  /** The coordinator-configured ED access target, in minutes — Task 6 of the audit-wiring plan
   *  (2026-09-16). Required, not defaulted: the wait-meter bar below must never fall back to the
   *  bare 24-hour literal it used to read. */
  accessTargetMinutes: number;
  reveal: { id: string; request: number } | null;
  consumeReveal: (request: number) => boolean;
  onOpenDetail: (id: string) => void;
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
  const level: WardChipLevel = movement.urgency === 1 ? "urgent" : "routine";

  /*
   * 🔴 **A CLOSED MOVEMENT WAS RENDERING AS A PERSON STILL WAITING FOR A BED, WITH A RUNNING
   * CLOCK, AND COUNTED IN THE STAGE TOTAL.**
   *
   * Found 2026-09-05 by Ward Builder Two, on the merged screen, by checking one number against
   * the record. `WF-008` sat under "Accepted, awaiting bed" reading "2h 30m in journey" and
   * climbing. Its record says `closure.outcome: "did_not_proceed"` twenty minutes before now,
   * reason *"Patient self-discharged from ED before transport was arranged"* — and **nothing
   * anywhere on the page said so.** Grepped the rendered DOM: no "closed", no "did not proceed",
   * no "self-discharged".
   *
   * ⚠️ **EVERY INDIVIDUAL DECISION WAS CORRECT, WHICH IS WHY IT PASSED EVERY GATE.**
   * `journeyStages` groups by `stage` with no `isOpen` filter, faithfully matching what the
   * pre-merge screen did; `transportLegs` runs on `movements.filter(isOpen)`, faithfully matching
   * what ITS pre-merge screen did. Both were preserved deliberately, with the reasoning written
   * down at the time — introducing a filter the folded screen never had would have been a
   * behaviour change rather than a fold.
   *
   * **THE DEFECT IS CREATED BY ADJACENCY.** Before the merge those two counts lived on two pages
   * nobody saw together, so neither was a claim about the other. The merge made them one page.
   * **Neither half changed and the combination started lying** — which is also why the page shows
   * "50 moves" at the top and "8 of 43 open moves" at the bottom with nothing accounting for the
   * difference.
   *
   * ⚠️ **THE OWNER RULED: MARK IT, DO NOT FILTER IT** (2026-09-05, shown the row, the record and
   * three options). Filtering would delete the useful fact — that a move was abandoned is exactly
   * what a board like this is for — and would silently shrink the count with nothing explaining
   * why.
   *
   * **NO CLINICAL WORDING IS INVENTED HERE.** `routine` and `cancelled` are existing
   * `WardChipLevel`s; "Arrived" and "Did not proceed" are the two recorded `closure.outcome`
   * values in words; the sentence shown is the recorded `closure.reason` verbatim. The app's own
   * phrase for the latter state, in `ed-screen.tsx` and `officer-screen.tsx`, is "has already
   * closed (reason)".
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

  // Legal tag derivation matching third edition
  const dueAt = movement.legalForm?.dueAt;
  const isBreached = dueAt !== undefined && dueAt < now;
  const isExpiring = dueAt !== undefined && dueAt >= now && dueAt - now < 60;
  let legalTagTone: "danger" | "warn" | undefined = undefined;
  let legalText = "";
  if (movement.legalForm) {
    // Keep register titles (owner-approved) but never frame typed dueAt as a live order clock.
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

  // Transport tag derivation
  const leg = movement.transport;
  const legState = transportLeg(leg);
  const need = transportNeedState(movement);
  let transportText = "";
  let transportTone: "warn" | "danger" | "good" | undefined = undefined;
  if (leg && legState) {
    if (legState === "Cancelled") transportTone = "warn";
    else if (legState === "Arrived") transportTone = "good";
    const stateLabel =
      legState === "Requested" ? "Requested" : (LEG_STATE_LABEL[legState as MovementLegState] ?? legState);
    transportText = `${stateLabel}, ${leg.provider}`;
  } else if (need === "not_needed") {
    transportText = "No transport needed, same site";
  } else if (need === "needed") {
    transportTone = "warn";
    transportText = "Transport needed, none booked";
  } else {
    transportText = "Transport not tracked here yet";
  }

  return (
    <li
      ref={rowRef}
      tabIndex={-1}
      className={styles.movementRecord}
      data-ward-primitive="record-row"
      data-record-key={movement.id}
      data-revealed={revealRequest !== null ? "true" : undefined}
      data-tone={closure ? "neutral" : movement.urgency === 1 ? "danger" : "neutral"}
      aria-label={`Movement for ${patientInfo.formalName}`}
    >
      <div className={styles.recordHeading}>
        <strong className={styles.recordId} data-ward-primitive="record-id">
          {patientInfo.formalName}
        </strong>
        <span className={styles.recordPerson}>
          UMRN: <strong>{patientInfo.umrn}</strong> · {movement.cohort} · {movement.sex}
        </span>
        {closureState ? <WardChip level={closureState.level}>{closureState.text}</WardChip> : null}
        <WardChip level={level}>{urgencyTierLabel(movement.urgency)}</WardChip>
        <div className={styles.recordClockWrap}>
          <span className={styles.recordClock}>
            <strong>{splitDuration(Math.max(clockEnd - movement.openedAt, 0))}</strong>
            <small>{closure ? "in journey before it ended" : "waited"}</small>
          </span>
          <span
            className={styles.rowWaitMeter}
            aria-hidden="true"
            title={`${splitDuration(Math.max(clockEnd - movement.openedAt, 0))} of ${splitDuration(accessTargetMinutes)}`}
          >
            <i
              style={{
                width: `${Math.min(100, Math.max(0, ((clockEnd - movement.openedAt) / accessTargetMinutes) * 100)).toFixed(0)}%`,
              }}
            />
          </span>
        </div>
      </div>
      <p className={styles.recordRoute}>
        <strong title={originLabel} aria-label={originLabel}>
          {originEd ? `${originEd.siteCode} ED` : originLabel}
        </strong>
        {movement.acceptedUnitId ? (
          <>
            <span className={styles.routeArrow} aria-hidden="true">
              ➔
            </span>
            <strong>{destinationLabel}</strong>
            {/* Walkthrough code-read, 25 Sept 2026: "bed allocated" printed beside "Accepted, awaiting bed",
                before any bed was pulled. Say "accepted" until the bed is pulled. */}
            <span className={styles.recordRouteStatus}>
              {movement.stage === "accepted_awaiting_bed" ? " · accepted" : " · bed allocated"}
            </span>
            <Link
              href={`/mockups/ward-flow/board/${movement.acceptedUnitId}`}
              className={styles.jumpToWardBtn}
              onClick={(e) => e.stopPropagation()}
              title={`Open ${destinationLabel} Bed Board`}
            >
              Open on Ward Board →
            </Link>
          </>
        ) : (
          <>
            <span title="No accepted destination recorded">· Destination pending</span>
            {movement.declines.length > 0 ? (
              <span className={styles.recordRouteStatus}>
                {" · "}
                {movement.declines.length} decline{movement.declines.length === 1 ? "" : "s"} recorded
              </span>
            ) : null}
            {movement.escalation ? <span className={styles.recordRouteStatus}> · state desk escalated</span> : null}
          </>
        )}
      </p>
      <div className={styles.recordTags}>
        <span className={styles.recordTag}>{stageCopy[movement.stage].label}</span>
        <span className={styles.recordTag} data-tone={legalTagTone}>
          {legalText}
        </span>
        <span className={styles.recordTag} data-tone={transportTone}>
          {transportText}
        </span>
        <span className={styles.recordTag}>
          {movement.security === "Secure" ? "Needs locked bed" : "Open bed suits"}
        </span>
        {movement.flaggedUrgent ? (
          <span className={styles.recordTag} data-tone="warn">
            Flagged urgent
          </span>
        ) : null}
        {movement.specialling ? <span className={styles.recordTag}>One-to-one nursing</span> : null}
        {movement.highAcuity ? <span className={styles.recordTag}>High acuity</span> : null}
        {!movement.owner.trim() ? (
          <span className={styles.recordTag} data-tone="warn">
            No owner
          </span>
        ) : null}
      </div>
      {movement.escalation ? (
        <div className={styles.recordEscalation}>
          <strong>Escalated {splitDuration(Math.max(now - movement.escalation.at, 0))} ago</strong>
          {" to "}
          {movement.escalation.contact}
          {" · tried "}
          {movement.escalation.triedUnitIds
            .map((id) => {
              const u = units.find((candidate) => candidate.id === id);
              return u ? u.name : id;
            })
            .join(", ") || "No units recorded"}
        </div>
      ) : null}
      {closure || blocker ? (
        <p className={styles.recordReason}>
          <span className={styles.recordReasonLabel}>
            {closure ? "Closure note" : "Delay barrier"}:
          </span>{" "}
          {closure ? closure.reason : blocker}
        </p>
      ) : null}
      <div className={styles.recordFooter}>
        <p className={styles.recordOwner}>
          {healthService}
          <span> · Owner: {movement.owner.trim() || "Not recorded"}</span>
        </p>
        <div className={styles.recordActions}>
          <button type="button" className={styles.detailBtn} onClick={() => onOpenDetail(movement.id)}>
            What is recorded
          </button>
          <Link className={styles.action} href={`/mockups/ward-flow/movements/${movement.id}`}>
            Review patient
          </Link>
        </div>
      </div>
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
      states={[{ level: "routine", text: "No transport record" }]}
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
