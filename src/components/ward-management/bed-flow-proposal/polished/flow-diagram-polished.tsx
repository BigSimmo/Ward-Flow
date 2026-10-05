"use client";

import { Network } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import { bedsPendingPreparation, capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { designationSummary } from "@/components/ward-management/ward-bed-designation";
import { BED_STATE_LABELS, bedStates } from "@/components/ward-management/ward-bed-states";
import {
  candidateReason,
  eligibleCandidatesAmong,
  restrictionNotice,
  wardServiceOrder,
} from "@/components/ward-management/ward-derivations";
import {
  type BedRelease,
  type HealthService,
  type LeaveBed,
  type Movement,
  type Unit,
} from "@/components/ward-management/ward-model";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { edPressure } from "@/components/ward-management/ward-pressure";
import { siteByCode } from "@/components/ward-management/ward-sites";

import styles from "./coordinator-polished.module.css";
import flowStyles from "./flow-diagram-polished.module.css";

type FlowDiagramProps = {
  movement: Movement | undefined;
  /** Every open movement, for the ED pressure figures along the left. Passed rather than defaulted:
   *  this diagram used to call `edPressure(now)` and take the seed fixture through that function's
   *  old default, so its ED nodes never moved while the queue beside them did. */
  movements: Movement[];
  now: Instant;
  units: Unit[];
  bedReleases: BedRelease[];
  leaveBeds: LeaveBed[];
  /** Live admissions, so each node can count its Pulled beds (`bedStates`). */
  admissions: readonly Admission[];
  selectedUnitId: string | undefined;
  onSelectUnit: (unitId: string) => void;
  /** Task 7 of the audit-wiring plan, 2026-09-16: the coordinator-configured parallel referral
   *  cap — the shortlist's own size limit, previously the constant PARALLEL_REFERRAL_CAP. */
  parallelReferralCap: number;
  /**
   * Item 44, build plan task B1 (`docs/ward-flow/plans/2026-09-17-build-plan-screens.md` §2
   * "Command: the flow diagram stays whole-network with a foot sentence."). This diagram itself
   * never narrows to it — every unit and every ED node keeps rendering regardless of the choice,
   * unlike the queue beside it — this prop only decides whether the §3 foot sentence names the
   * chosen service. `undefined`/`null` (every direct caller other than `coordinator-screen.tsx`,
   * e.g. `tests/ward-flow-diagram-scroll-notice.dom.test.tsx`) renders no foot sentence at all,
   * unchanged from before this task.
   */
  service?: HealthService | null;
};

type Point = { x: number; y: number };
type ShortlistCandidate = ReturnType<typeof eligibleCandidatesAmong>[number];
type Connector =
  | { id: string; path: string; kind: "demand" }
  | { id: string; path: string; kind: "route"; eligible: boolean }
  | { id: string; path: string; kind: "destination"; recorded: "accepted" | "referred" };

/** Elbow: leave the source edge, run along a mid trunk, then enter the target edge. Same shape
 * as the Phase 1 network diagram's connector, kept identical rather than reinvented so the two
 * read as one visual language. */
function elbowPath(from: Point, to: Point) {
  const trunk = from.x + (to.x - from.x) / 2;
  return `M ${from.x} ${from.y} H ${trunk} V ${to.y} H ${to.x}`;
}

function capabilityLabel(unit: Unit) {
  return `${designationSummary(unit)} · ${unit.cohort} · ${unit.beds} beds`;
}

/**
 * Every unit this movement is actually recorded against: the acceptance, plus every live parallel
 * referral. Not `destinationUnit()` -- that collapses both facts into one and only ever reads
 * `referredUnitIds[0]`, which is how WF-013's second referral went missing (Task 6 review
 * Important 2). Ids are returned rather than units so an id the fixture cannot resolve is still
 * counted as recorded rather than silently disappearing.
 */
function recordedDestinationIds(movement: Movement | undefined): Set<string> {
  if (!movement) return new Set();
  const ids = new Set(movement.referredUnitIds);
  if (movement.acceptedUnitId) ids.add(movement.acceptedUnitId);
  return ids;
}

/**
 * The hub's one-line status. Must be true for every movement, not just the ones with a clean
 * eligible shortlist -- Task 6 review Critical 1 found "Routing WF-009 to 3 shortlisted units"
 * displayed for a movement whose three candidates were all ineligible (two already declined it,
 * the third fails the security gate), which reads as three viable routes where zero exist.
 *
 * Two further corrections from the whole-branch review:
 *
 * Critical 1 -- the word "nearest" is gone. `eligibleCandidatesAmong` ranks cohort-matching units
 * eligible-first and breaks ties on array order; the model holds no distance data at all, so a
 * proximity claim here was simply false.
 *
 * Important 3 -- a movement that ALREADY has a recorded destination is not looking for three of
 * them. WF-004 sits at stage `pulled` with a bed pulled at BTY Adult Secure, and this line read
 * "WF-004 -- 3 eligible destinations". The recorded fact now leads; the candidate count follows
 * as secondary context, because a coordinator may still be considering alternatives.
 *
 * Whole-branch review Critical 1: `units` is the caller's live provider `units`, never
 * `ward-sites.ts`'s `unitById`/`allUnits` — a name lookup here still must reflect a unit that
 * exists in the live world the same as any capacity figure would.
 */
// Exported for `tests/ward-flow-diagram-status-truthfulness.test.ts`, which drives it over the whole
// fixture. The alternative was rendering the diagram fifty times in jsdom to read one string, which
// would test the renderer rather than the sentence.
export function hubStatusText(
  movement: Movement | undefined,
  shortlist: ShortlistCandidate[],
  units: Unit[],
  now: Instant,
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number — optional, so every
  // existing caller (including the status-truthfulness test) keeps compiling unchanged.
  who?: string,
) {
  if (!movement) return "Choose a person in the Placement workspace to see where they could go";
  const whoLabel = who ?? "This patient";

  // "Other" means other than the units already recorded against this movement -- a candidate that
  // IS the accepted or referred unit must not be counted a second time as an alternative to itself.
  const recordedIds = recordedDestinationIds(movement);
  const otherCount = shortlist.filter((candidate) => !recordedIds.has(candidate.unit.id)).length;
  const candidateTail = otherCount === 0 ? "" : `; ${otherCount} other candidate${otherCount === 1 ? "" : "s"} shown`;

  if (movement.acceptedUnitId) {
    const accepted = units.find((unit) => unit.id === movement.acceptedUnitId);
    return accepted
      ? `${whoLabel} — accepted destination: ${accepted.name}${candidateTail}`
      : `${whoLabel} — an accepted destination is recorded but could not be resolved`;
  }
  if (movement.referredUnitIds.length > 0) {
    const names = movement.referredUnitIds
      .map((id) => units.find((unit) => unit.id === id)?.name)
      .filter((name): name is string => Boolean(name));
    return names.length === movement.referredUnitIds.length && names.length > 0
      ? `${whoLabel} — outstanding referral${names.length === 1 ? "" : "s"}: ${names.join(", ")}${candidateTail}`
      : `${whoLabel} — ${movement.referredUnitIds.length} outstanding referral${movement.referredUnitIds.length === 1 ? "" : "s"}, not all resolvable`;
  }

  if (shortlist.length === 0) return `${whoLabel} — no destinations found for this cohort`;
  const eligibleCount = shortlist.filter((candidate) => candidate.verdict.eligible).length;
  if (eligibleCount === shortlist.length) {
    // ⚠️ **THIS SAID "3 eligible destinations" WHERE THIRTEEN WERE ELIGIBLE, and the number was
    // never network-wide.** `shortlist` is `eligibleCandidatesAmong(..., PARALLEL_REFERRAL_CAP)`,
    // which ends `.slice(0, limit)` with `limit` 3 — the three wards a coordinator may refer to in
    // parallel, not the eligible destinations that exist. `eligibleCount` is therefore a count
    // WITHIN a capped shortlist, and this branch was the only one of the three that dropped the
    // denominator and let it read as an absolute.
    //
    // ⚠️ THE OTHER TWO BRANCHES WERE ALWAYS RIGHT — "N eligible of M candidates" and "M candidates,
    // all excluded" both name the population. This one lost it precisely because the two numbers
    // were EQUAL, so the denominator looked redundant. **A count is not safe to drop just because
    // it happens to equal the numerator; it is the only thing naming what was counted.**
    //
    // The label is changed rather than the number, because the diagram beside it renders exactly
    // these candidates as nodes. Making the number network-wide would contradict what is on screen.
    // ⚠️ THE NETWORK FIGURE IS HERE BECAUSE WITHOUT IT NO GUARD CAN TELL THE TRUE LINE FROM THE
    // FALSE ONE. My first repair only rescoped the words — "all 3 candidates shown are eligible" —
    // and a property test asserting "the population size must appear in the line" PASSED against
    // the original "3 eligible destinations", because in this branch `eligibleCount` and
    // `shortlist.length` are the SAME NUMBER. The test fell into the identical trap as the code:
    // the denominator looked redundant because it equalled the numerator.
    //
    // Stating how many are eligible across the cohort makes the sentence carry a figure that only
    // a truthful version can have, so `tests/ward-flow-diagram-status-truthfulness.test.ts` has
    // something to check. It also answers the defect itself: this line understated the coordinator's
    // real options, saying three where thirteen wards could take the patient.
    const cohortEligible = units.filter(
      (unit) => unit.cohort === movement.cohort && eligibility(movement, unit, now).eligible,
    ).length;
    return cohortEligible > shortlist.length
      ? `${whoLabel} — all ${shortlist.length} shown are eligible, of ${cohortEligible} eligible across the network`
      : `${whoLabel} — all ${shortlist.length} eligible destination${shortlist.length === 1 ? "" : "s"} shown`;
  }
  if (eligibleCount === 0) {
    return `${whoLabel} — no eligible destination; ${shortlist.length} candidates, all excluded`;
  }
  return `${whoLabel} — ${eligibleCount} eligible of ${shortlist.length} candidates`;
}

/**
 * The reshape the spec asks for: demand enters left from the eight emergency departments,
 * passes through a statewide-flow hub in the centre, and lands right on the 23 inpatient units,
 * grouped by health service. Departments are always shown (ordered worst-first by `edPressure`)
 * and always connected to the hub -- that part of the network exists regardless of what a
 * coordinator has selected. Routes from the hub to specific units only appear once a movement is
 * selected, and only to that movement's own three cohort-matching candidates plus whatever unit it
 * is already recorded against; with nothing selected, this renders the network with nothing routed
 * rather than a guessed selection (ruling: display less rather than something plausible).
 *
 * `eligibleCandidatesAmong` sorts eligible-first but never filters -- it can and does return units
 * that fail a gate (already declined the movement, wrong security tier, stale capacity, ...).
 * Every shortlisted node therefore carries its own verdict (`data-eligible`, plus
 * `candidateReason` rendered as real text) and an ineligible route is drawn visually distinct
 * from an eligible one, so neither the arrow nor the node can read as an endorsement the data
 * does not support.
 *
 * Connector paths are computed from real DOM geometry (ruling 4), never from hard-coded
 * percentages -- a percentage-based layout looks right at exactly one viewport width and is wrong
 * at every other. `measure` reads `getBoundingClientRect` on the canvas, the hub and every node,
 * and reruns on a `ResizeObserver` plus a window resize listener, so the diagram survives a
 * resize rather than only ever being screenshotted once.
 */
export function FlowDiagram({
  movement,
  movements,
  now,
  units,
  bedReleases,
  leaveBeds,
  admissions,
  selectedUnitId,
  onSelectUnit,
  parallelReferralCap,
  service = null,
}: FlowDiagramProps) {
  // Owner, 26 Sept 2026: the patient's name, not the WF journey number, for the hub's status line.
  const resolvePatientIdentity = usePatientOf();
  const hubWho = movement ? resolvePatientIdentity(movement).displayName : undefined;
  // Live movements, not the seed. This read `edPressure(now)` and took the fixture through the
  // old default, so the diagram's ED nodes never moved while the queue beside them did.
  const pressure = useMemo(() => edPressure(now, movements), [now, movements]);
  const shortlist = useMemo(
    () => (movement ? eligibleCandidatesAmong(movement, units, now, parallelReferralCap) : []),
    [movement, units, now, parallelReferralCap],
  );
  const shortlistByUnitId = useMemo(
    () => new Map(shortlist.map((candidate) => [candidate.unit.id, candidate])),
    [shortlist],
  );
  const originEdId = movement?.originEdId;

  // Grouped by health service in `wardServiceOrder`, one lookup per unit (23 units -- cheap).
  // `siteByCode` returning `undefined` for a broken site code excludes that unit from every
  // group rather than guessing one -- conservative failure, not a crash. `unplacedUnits` below
  // catches exactly that case so the unit still renders (as an explicit anomaly) rather than
  // silently vanishing from the board (review Minor 6).
  //
  // Whole-branch review Critical 1: grouped from the caller's live `units`, never `allUnits()` —
  // every unit NODE on this board (its bed grid, via `bedStates` in `UnitNode` below) must
  // move the instant a ward confirms new capacity, not only at first paint.
  const serviceGroups = useMemo(
    () =>
      wardServiceOrder
        .map((service) => ({
          service,
          units: units.filter((unit) => siteByCode(unit.siteCode)?.service === service),
        }))
        .filter((group) => group.units.length > 0),
    [units],
  );
  const unplacedUnits = useMemo(() => {
    const grouped = new Set(serviceGroups.flatMap((group) => group.units.map((unit) => unit.id)));
    return units.filter((unit) => !grouped.has(unit.id));
  }, [serviceGroups, units]);

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const hubRef = useRef<HTMLDivElement | null>(null);
  const diagramScrollRef = useRef<HTMLDivElement | null>(null);
  const edRefs = useRef(new Map<string, HTMLElement | null>());
  const unitRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const [connectors, setConnectors] = useState<Connector[]>([]);
  // Genuinely measured, never declared -- see the CSS comment beside `.diagramScroll[data-
  // overflowing]` for why. `.diagramNodes`'s column tracks are `minmax` and reflow with most
  // viewports, so whether this diagram currently needs a sideways scroll is a fact only the
  // laid-out page can answer; a CSS-only always-on hint would be false on every render where the
  // diagram fits.
  const [diagramOverflowing, setDiagramOverflowing] = useState(false);

  const registerEdNode = useCallback((id: string, node: HTMLElement | null) => {
    edRefs.current.set(id, node);
  }, []);
  const registerUnitNode = useCallback((id: string, node: HTMLButtonElement | null) => {
    unitRefs.current.set(id, node);
  }, []);

  const measure = useCallback(() => {
    const canvas = canvasRef.current;
    const hub = hubRef.current;
    if (!canvas || !hub) return;
    const base = canvas.getBoundingClientRect();
    const hubBox = hub.getBoundingClientRect();
    const hubLeft: Point = { x: hubBox.left - base.left, y: hubBox.top - base.top + hubBox.height / 2 };
    const hubRight: Point = { x: hubBox.right - base.left, y: hubLeft.y };
    const next: Connector[] = [];

    for (const row of pressure) {
      const node = edRefs.current.get(row.ed.id);
      if (!node) continue;
      const box = node.getBoundingClientRect();
      const from: Point = { x: box.right - base.left, y: box.top - base.top + box.height / 2 };
      next.push({ id: `demand-${row.ed.id}`, path: elbowPath(from, hubLeft), kind: "demand" });
    }

    for (const candidate of shortlist) {
      const node = unitRefs.current.get(candidate.unit.id);
      if (!node) continue;
      const box = node.getBoundingClientRect();
      const to: Point = { x: box.left - base.left, y: box.top - base.top + box.height / 2 };
      next.push({
        id: `route-${candidate.unit.id}`,
        path: elbowPath(hubRight, to),
        kind: "route",
        eligible: candidate.verdict.eligible,
      });
    }

    // Whole-branch review Important 3: routes were drawn ONLY to the three candidates, so for 18
    // of the 41 open movements the unit the patient is actually going to had no connector at all
    // while three arrows pointed at wards they are not going to. The recorded destination is a
    // fact, not a suggestion, so it gets its own connector in its own visual language.
    //
    // Drawn IN ADDITION to any route connector for the same unit, not instead of it: seven open
    // movements have a recorded destination that is also a candidate, and suppressing the route
    // there would make the route count silently disagree with the routed node count. The two
    // enter the node at different heights (destination high, route mid) so they read as two
    // distinct lines rather than one drawn twice.
    for (const unitId of recordedDestinationIds(movement)) {
      const node = unitRefs.current.get(unitId);
      if (!node) continue;
      const box = node.getBoundingClientRect();
      const to: Point = { x: box.left - base.left, y: box.top - base.top + box.height / 4 };
      next.push({
        id: `destination-${unitId}`,
        path: elbowPath(hubRight, to),
        kind: "destination",
        recorded: movement?.acceptedUnitId === unitId ? "accepted" : "referred",
      });
    }

    setConnectors(next);

    // Reuses this same measure pass (ruling 4's ResizeObserver + window-resize listener) rather
    // than a third listener -- see review Minor 7's comment on the effects below for why a
    // duplicated guard is the exact defect that pattern already fixed once. `.diagramScroll` is
    // the scroll boundary (see that class's own CSS comment); `.diagramCanvas` is ordinary
    // in-flow content inside it, so this reads the boundary's own scrollWidth/clientWidth rather
    // than the canvas ref already captured above.
    const scroller = diagramScrollRef.current;
    setDiagramOverflowing(scroller !== null && scroller.scrollWidth > scroller.clientWidth + 1);
  }, [pressure, shortlist, movement]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  // The window resize listener is the fallback path -- it must attach unconditionally.
  // `ResizeObserver` is the finer-grained signal (canvas-only size changes that a window resize
  // wouldn't cause, e.g. a sidebar toggling), so it is added separately when available rather
  // than gating the window listener behind the same `if` (review Minor 7 -- the previous single
  // guard skipped the resize listener too whenever `ResizeObserver` was undefined, leaving no
  // resize handling at all in that environment).
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [measure]);

  return (
    // The diagram can carry substantially more content (23 units) than the region grid's own
    // squeeze-to-fit sizing gives it room for at moderate viewport heights -- the outer grid's
    // `auto` row is compressed to fit `.body`'s available space, which at 1280x900 left this
    // region 208px tall for ~1080px of content (Controller finding 8). `.diagramScroll` owns its
    // own bounded, independently-scrolling box (`min-height` floor + `overflow-y: auto`) so the
    // diagram is always a usable panel rather than a letterbox, without needing the canvas itself
    // to scroll -- see the note on `.diagramScroll` in the CSS for why that distinction matters
    // for the connector overlay.
    <>
      <div
        className={`${styles.diagramScroll} ${flowStyles.scroll}`}
        ref={diagramScrollRef}
        data-testid="ward-diagram-scroll"
        data-overflowing={diagramOverflowing ? "true" : undefined}
        role="region"
        aria-label="Statewide flow diagram"
        aria-describedby={diagramOverflowing ? "ward-diagram-scroll-instructions" : undefined}
        tabIndex={0}
      >
        <div className={`${styles.diagramCanvas} ${flowStyles.canvas}`} ref={canvasRef}>
          {/* `aria-hidden` + `pointer-events: none`: this layer is a rendering of the relationships
            the node buttons below already carry in their own attributes, never itself a target. */}
          <svg className={`${styles.diagramConnectors} ${flowStyles.connectors}`} aria-hidden="true">
            <defs>
              <marker
                id="ward-flow-diagram-arrow-demand"
                markerWidth="7"
                markerHeight="7"
                refX="6"
                refY="3.5"
                orient="auto"
              >
                <path d="M 0 0 L 7 3.5 L 0 7 z" className={styles.diagramArrowDemand} />
              </marker>
              <marker
                id="ward-flow-diagram-arrow-route-eligible"
                markerWidth="7"
                markerHeight="7"
                refX="6"
                refY="3.5"
                orient="auto"
              >
                <path d="M 0 0 L 7 3.5 L 0 7 z" className={styles.diagramArrowRouteEligible} />
              </marker>
              <marker
                id="ward-flow-diagram-arrow-route-ineligible"
                markerWidth="7"
                markerHeight="7"
                refX="6"
                refY="3.5"
                orient="auto"
              >
                <path d="M 0 0 L 7 3.5 L 0 7 z" className={styles.diagramArrowRouteIneligible} />
              </marker>
              <marker
                id="ward-flow-diagram-arrow-destination"
                markerWidth="7"
                markerHeight="7"
                refX="6"
                refY="3.5"
                orient="auto"
              >
                <path d="M 0 0 L 7 3.5 L 0 7 z" className={styles.diagramArrowDestination} />
              </marker>
            </defs>
            {connectors.map((connector) => {
              const connectorClass =
                connector.kind === "route"
                  ? connector.eligible
                    ? styles.diagramConnectorRouteEligible
                    : styles.diagramConnectorRouteIneligible
                  : connector.kind === "destination"
                    ? styles.diagramConnectorDestination
                    : styles.diagramConnectorDemand;
              const marker =
                connector.kind === "route"
                  ? connector.eligible
                    ? "url(#ward-flow-diagram-arrow-route-eligible)"
                    : "url(#ward-flow-diagram-arrow-route-ineligible)"
                  : connector.kind === "destination"
                    ? "url(#ward-flow-diagram-arrow-destination)"
                    : "url(#ward-flow-diagram-arrow-demand)";
              return (
                <path
                  key={connector.id}
                  d={connector.path}
                  className={`${connectorClass} ${flowStyles.connector}`}
                  data-connector-kind={connector.kind}
                  data-eligible={connector.kind === "route" ? String(connector.eligible) : undefined}
                  data-recorded={connector.kind === "destination" ? connector.recorded : undefined}
                  markerEnd={marker}
                />
              );
            })}
          </svg>

          {/* The node container is `pointer-events: none`; only the interactive unit buttons below
            re-enable `pointer-events: auto`. Without this the full-canvas overlay swallows clicks
            on everything beneath it -- the exact defect Phase 1's network diagram cost an hour
            on. */}
          <div className={`${styles.diagramNodes} ${flowStyles.nodes}`}>
            <div className={`${styles.diagramDepartmentsColumn} ${flowStyles.departments}`}>
              <h3 className={`${styles.diagramColumnHeading} ${flowStyles.columnHeading}`}>Emergency departments</h3>
              <ul className={`${styles.diagramDepartmentsList} ${flowStyles.departmentList}`}>
                {pressure.map((row) => {
                  const isOrigin = originEdId === row.ed.id;
                  return (
                    <li key={row.ed.id}>
                      <div
                        ref={(node) => registerEdNode(row.ed.id, node)}
                        className={`${styles.diagramEdCard} ${flowStyles.edNode}`}
                        data-testid={`ward-diagram-ed-${row.ed.id}`}
                        title={row.ed.name}
                        data-origin={isOrigin ? "true" : undefined}
                      >
                        <span className={`${styles.diagramEdCode} ${flowStyles.edCode}`}>{row.ed.siteCode}</span>
                        <span className={`${styles.diagramEdName} ${flowStyles.edName}`}>{row.ed.name}</span>
                        <span className={`${styles.diagramEdStats} ${flowStyles.edStats}`}>
                          {row.waiting === 0 ? "No patients waiting" : `${row.waiting} waiting`}
                        </span>
                        {isOrigin ? <span className={styles.diagramOriginBadge}>Origin</span> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className={`${styles.diagramHub} ${flowStyles.hub}`} ref={hubRef}>
              <Network aria-hidden="true" />
              <strong>Statewide flow hub</strong>
              <span>{hubStatusText(movement, shortlist, units, now, hubWho)}</span>
            </div>

            <div className={`${styles.diagramUnitsColumn} ${flowStyles.units}`}>
              <h3 className={`${styles.diagramColumnHeading} ${flowStyles.columnHeading}`}>Inpatient units</h3>
              {serviceGroups.map((group) => (
                <section key={group.service} className={`${styles.diagramServiceGroup} ${flowStyles.serviceGroup}`}>
                  <h4 className={`${styles.diagramServiceHeading} ${flowStyles.serviceHeading}`}>
                    <span>{group.service}</span>
                    <small>{group.units.length} wards</small>
                  </h4>
                  <div className={`${styles.diagramUnitGrid} ${flowStyles.unitGrid}`}>
                    {group.units.map((unit) => (
                      <UnitNode
                        key={unit.id}
                        unit={unit}
                        bedReleases={bedReleases}
                        leaveBeds={leaveBeds}
                        admissions={admissions}
                        now={now}
                        movement={movement}
                        candidate={shortlistByUnitId.get(unit.id)}
                        selected={selectedUnitId === unit.id}
                        onSelectUnit={onSelectUnit}
                        registerUnitNode={registerUnitNode}
                      />
                    ))}
                  </div>
                </section>
              ))}
              {unplacedUnits.length > 0 ? (
                <section className={styles.diagramServiceGroup} aria-label="Units with an unresolved health service">
                  <h4 className={styles.diagramServiceHeading}>Unresolved health service</h4>
                  <div className={styles.diagramUnitGrid}>
                    {unplacedUnits.map((unit) => (
                      <div
                        key={unit.id}
                        className={styles.diagramUnplacedUnit}
                        data-testid={`ward-diagram-unplaced-unit-${unit.id}`}
                      >
                        <span className={styles.diagramUnitName}>{unit.name}</span>
                        <span className={styles.diagramUnitCapability}>{capabilityLabel(unit)}</span>
                        <span className={styles.diagramEdStats}>
                          Could not resolve this unit&apos;s health service &mdash; not placed in a group above.
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {/*
        A sibling of `.diagramScroll`, not a child of it: the note must stay visible at the
        panel's own edge rather than being scrolled away with the content it is describing.
        Renders only while `diagramOverflowing` is genuinely true this render — see the state
        declaration and `measure()` above for why this is measured, not declared.
      */}
      {diagramOverflowing ? (
        <p className="sr-only" id="ward-diagram-scroll-instructions" data-testid="ward-diagram-scroll-note">
          This diagram is wider than the panel — scroll sideways to see the rest.
        </p>
      ) : null}
      <div className={flowStyles.legend} aria-label="Flow diagram key">
        <span className={flowStyles.legendTitle}>Capacity</span>
        <LegendItem state="available" label="Ready" />
        <LegendItem state="pulled" label={BED_STATE_LABELS.pulled} />
        <LegendItem state="closed" label={BED_STATE_LABELS.closed} />
        <LegendItem state="occupied" label="Occupied" />
        <details className={`${flowStyles.advancedKey} source-print`} data-flow-key>
          <summary>More key</summary>
          <div className={flowStyles.advancedKeyItems}>
            <LegendItem state="confirmed" label="Confirmed today" />
            <LegendItem state="expected" label="Expected today" />
            <span>
              <i data-line="eligible" />
              Eligible route
            </span>
            <span>
              <i data-line="ineligible" />
              Route needing review
            </span>
            <span>
              <i data-line="recorded" />
              Recorded destination
            </span>
          </div>
        </details>
        <span className={flowStyles.schematic}>Schematic, not geographic</span>
      </div>
      {/* §3 "Command", flow foot: this diagram itself never narrows to a chosen service — every
       *  unit and ED node above stays whole-network — so the sentence only ever needs to say that
       *  the QUEUE beside it does, never anything about this diagram's own population. */}
      {service ? (
        <p className={styles.placeholder} data-testid="ward-diagram-service-foot">
          {`Showing the whole network. The queue is scoped to ${service}.`}
        </p>
      ) : null}
    </>
  );
}

function LegendItem({ state, label }: { state: string; label: string }) {
  return (
    <span className={flowStyles.legendItem}>
      <i data-state={state} />
      {label}
    </span>
  );
}

function UnitNode({
  unit,
  bedReleases,
  leaveBeds,
  admissions,
  now,
  movement,
  candidate,
  selected,
  onSelectUnit,
  registerUnitNode,
}: {
  unit: Unit;
  bedReleases: BedRelease[];
  leaveBeds: LeaveBed[];
  admissions: readonly Admission[];
  now: Instant;
  movement: Movement | undefined;
  candidate: ShortlistCandidate | undefined;
  selected: boolean;
  onSelectUnit: (unitId: string) => void;
  registerUnitNode: (id: string, node: HTMLButtonElement | null) => void;
}) {
  const states = bedStates(unit, admissions, bedReleases, leaveBeds);
  const breakdown = capacityBreakdown(unit, bedReleases, leaveBeds, now);
  // 🔴 THE READY FIGURE IS CORRECT AND MUST NOT CHANGE. Nothing is subtracted from it for a
  // preparation note: asked whether a bed being cleaned should drop the ward's number or merely
  // refuse the pull, the owner chose the refusal, because the ward has not changed what it can
  // staff and its figures must not lurch as cleaning starts and stops. What was missing here was
  // the sentence beside it — the reducer refuses PULL_PATIENT with "every free bed at X is still
  // being made ready", so a coordinator reading a bare "Ready 2" can commit a patient and be
  // refused at the moment of action. Do not reach for the subtraction.
  const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
  const routed = candidate !== undefined;
  // `destinationUnit(movement)` (`acceptedUnitId ?? referredUnitIds[0]`) conflates two different
  // facts into one badge and only ever looks at the first referral (review Important 2) -- WF-017
  // showed "Current recorded destination" on BTY when BTY is only an outstanding referral (no
  // acceptance), and WF-013's second parallel referral was invisible because only index 0 was
  // checked. Checked directly here instead: an accepted destination and an outstanding referral
  // are different facts a coordinator acts on differently, and every unit in `referredUnitIds` --
  // not only the first -- gets its own badge on its own node.
  const isAccepted = movement?.acceptedUnitId === unit.id;
  const isReferred = !isAccepted && (movement?.referredUnitIds.includes(unit.id) ?? false);
  // Whole-branch review Important 5, Task 5 fix: shown for any unit this movement could be sent
  // to -- a candidate, or a unit it is already recorded against -- never for the other 19 units
  // on the board, where the comparison is meaningless because this movement is not going there.
  // `restrictionNotice` replaces the superseded `isMoreRestrictiveThanRequired`/
  // `MORE_RESTRICTIVE_NOTE` pair (still kept in ward-derivations.ts, unreferenced, pending
  // review) so the diagram reads the same two-level warning the shortlist already renders,
  // including the sharper voluntary-on-locked case the old pair could never see -- it only ever
  // compared `movement.security` to `unit.security` and had no way to read `legalStatus` at all.
  const notice =
    movement !== undefined && (routed || isAccepted || isReferred) ? restrictionNotice(movement, unit) : undefined;

  return (
    <button
      type="button"
      ref={(node) => registerUnitNode(unit.id, node)}
      className={`${selected ? styles.diagramUnitSelected : styles.diagramUnit} ${flowStyles.unitNode}`}
      data-testid={`ward-diagram-unit-${unit.id}`}
      data-routed={routed ? "true" : undefined}
      data-eligible={candidate ? String(candidate.verdict.eligible) : undefined}
      data-accepted={isAccepted ? "true" : undefined}
      data-referred={isReferred ? "true" : undefined}
      data-more-restrictive={notice ? "true" : undefined}
      aria-pressed={selected}
      onClick={() => onSelectUnit(unit.id)}
    >
      {/* No `aria-label` here: it would override the accessible name computed from this content
          and hide every figure below from a screen reader -- the exact defect Task 4 found on the
          pressure strip. Every figure, including the routed/eligibility state, is plain visible
          text instead (review Important 5 -- routed state was previously conveyed only by an
          outline colour plus an `aria-hidden` connector, invisible to a screen reader). */}
      <span className={`${styles.diagramUnitName} ${flowStyles.unitName}`}>{unit.name}</span>
      <span className={`${styles.diagramUnitCapability} ${flowStyles.unitCapability}`}>{capabilityLabel(unit)}</span>
      <span className={`${styles.diagramBedRow} ${flowStyles.bedRow}`}>
        {/* The owner's four bed states (R-B-05), which add up to the ward's beds. */}
        <CapacityMark state="available" label={BED_STATE_LABELS.ready} count={states.ready} />
        <CapacityMark state="pulled" label={BED_STATE_LABELS.pulled} count={states.pulled} />
        <CapacityMark state="closed" label={BED_STATE_LABELS.closed} count={states.closed} />
        <CapacityMark state="occupied" label={BED_STATE_LABELS.occupied} count={states.occupied} />
        {/* Review Finding 4: `capacity.potential` counted every bed release for the unit
            regardless of state or timing -- including a release already `discharged` and one
            expected beyond tonight, both of which spec D5/D6 exclude from every count. Confirmed
            and Expected are read from the same `capacityBreakdown()` the capacity board and the
            ward screen already use, so this board can never show a figure they contradict.
            Dashed styling marks both as the separate, forward-looking figures they are (ruling
            3); `capacity.potential` itself is untouched -- see its own doc comment. */}
        <CapacityMark state="confirmed" label="Confirmed" count={breakdown.confirmedToday} />
        <CapacityMark state="expected" label="Expected" count={breakdown.expectedToday} />
      </span>
      {/*
        BELOW the chip row, never a seventh chip. `ward-screen.tsx` found in a browser that a
        preparation count sitting immediately beside the Ready figure reads as one number — "Ready 2"
        followed by "1" is read as 21 — and these chips are tighter than that pill was. Renders only
        when there is one: an absence is silence, never a "0 being made ready".
      */}
      {pendingPreparation > 0 ? (
        <span className={styles.diagramBeingMadeReady} data-testid={`ward-flow-pending-${unit.id}`}>
          {pendingPreparation} of the ready {pendingPreparation === 1 ? "bed is" : "beds are"} still being made ready
        </span>
      ) : null}
      {!unit.authorised ? <span className={styles.diagramUnauthorisedBadge}>Voluntary-only</span> : null}
      {candidate ? (
        <span className={candidate.verdict.eligible ? styles.diagramEligibleBadge : styles.diagramIneligibleBadge}>
          {candidateReason(candidate.verdict)}
        </span>
      ) : null}
      {isAccepted ? <span className={styles.diagramAcceptedBadge}>Accepted destination</span> : null}
      {isReferred ? <span className={styles.diagramReferredBadge}>Outstanding referral</span> : null}
      {notice ? (
        <span
          className={
            notice.level === "voluntary_on_locked"
              ? styles.diagramRestrictiveBadgeProminent
              : styles.diagramRestrictiveBadge
          }
          data-level={notice.level}
        >
          {notice.text}
        </span>
      ) : null}
    </button>
  );
}

function CapacityMark({ state, label, count }: { state: string; label: string; count: number | string }) {
  return (
    <span className={`${styles.diagramBedChip} ${flowStyles.capacityMark}`} data-state={state}>
      <i aria-hidden="true" />
      <span>
        {label} {count}
      </span>
    </span>
  );
}
