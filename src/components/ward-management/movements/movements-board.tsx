"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { isOpen, stageCopy } from "@/components/ward-management/ward-derivations";
import {
  BLOCKERS_MEANING_NOTHING_IS_BLOCKING,
  type Movement,
  type MovementStage,
} from "@/components/ward-management/ward-model";
import { useWardChecksPublisher } from "@/components/ward-management/shell/ward-checks";
import { urgencyTierLabel } from "@/components/ward-management/ward-priority";
import { edById } from "@/components/ward-management/ward-sites";

import { byLongestWait, isExpiringLegalAuthority, waitedMinutes } from "./movements-derivations";
import { JOB_STATES, JOB_STATE_LABEL, jobState, stageLongestWait } from "./movement-flow-figures";
import {
  Definitions,
  KpiStrip,
  FLOW_ROUTES,
  Panel,
  Pill,
  FlowHeader,
  Segmented,
  Verdict,
  patientInitials,
  plural,
  waited,
  type Attention,
} from "./movement-flow-parts";
import { useMovementFlow } from "./use-movement-flow";
import styles from "./movement-flow.module.css";

type Focus = "open" | "tier1" | "awaitingWard" | "readyNoTransport" | "resolved";
type Order = "wait" | "tier" | "stage";

const PAGE = 15;
const READY_STAGES: readonly MovementStage[] = ["pulled", "handover_ready"];

export function meaningfulBlocker(movement: Movement): string | null {
  const blocker = movement.blocker.trim();
  return blocker && !BLOCKERS_MEANING_NOTHING_IS_BLOCKING.some((inactive) => inactive === blocker) ? blocker : null;
}

export function tierTone(urgency: Movement["urgency"]) {
  return urgency === 1 ? "danger" : urgency === 2 ? "warn" : "quiet";
}

export function edShort(originEdId: string) {
  const ed = edById(originEdId);
  return ed ? `${ed.siteCode} ED` : "ED not found";
}

/**
 * Proposed movements board. Answers "who is waiting longest and what is holding them" first, then
 * the journey as one pipeline that filters the worklist, then transport and corridors beside it.
 */
export function MovementsBoard() {
  const { world, now, board, transport, asAt, scopeLabel, scoped } = useMovementFlow();
  const [focus, setFocus] = useState<Focus>("open");
  const [showAllPlanned, setShowAllPlanned] = useState(false);
  const [stage, setStage] = useState<MovementStage | null>(null);
  const [order, setOrder] = useState<Order>("wait");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const unitName = (id?: string) =>
    id ? (world.units.find((unit) => unit.id === id)?.name ?? "Ward not found") : undefined;
  const readyNoTransport = board.open.filter(
    (movement) => READY_STAGES.includes(movement.stage) && !movement.transport,
  );
  const noTransportAwaitingWard = board.noTransport.filter((movement) => board.awaitingWard.includes(movement)).length;
  // The shell's reconciliation line reads this: the six open stages partition the open movements,
  // so their lengths must add up to the Open figure. The same check the timeline view publishes.
  const checks = useMemo(
    () => [
      {
        label: "Every open movement appears exactly once across the six stages",
        ok: board.stages.reduce((sum, entry) => sum + entry.movements.length, 0) === board.open.length,
      },
    ],
    [board],
  );
  useWardChecksPublisher(checks);
  const maxStage = Math.max(1, ...board.stages.map((entry) => entry.movements.length));

  const rows = useMemo(() => {
    const base =
      focus === "resolved"
        ? board.closedToday
        : focus === "tier1"
          ? board.tierOne
          : focus === "awaitingWard"
            ? board.awaitingWard
            : focus === "readyNoTransport"
              ? readyNoTransport
              : board.open;
    const q = query.trim().toLowerCase();
    const filtered = base.filter(
      (movement) =>
        (stage === null || movement.stage === stage) &&
        (!q ||
          movement.id.toLowerCase().includes(q) ||
          patientInitials(movement, world).toLowerCase().includes(q) ||
          edShort(movement.originEdId).toLowerCase().includes(q) ||
          (unitName(movement.acceptedUnitId) ?? "").toLowerCase().includes(q)),
    );
    const byWait = byLongestWait(filtered, now);
    const legalFirst = (a: Movement, b: Movement) =>
      Number(isExpiringLegalAuthority(b, now)) - Number(isExpiringLegalAuthority(a, now));
    if (order === "tier") return [...byWait].sort((a, b) => legalFirst(a, b) || a.urgency - b.urgency);
    if (order === "stage") {
      const stages = board.stages.map((entry) => entry.id);
      return [...byWait].sort((a, b) => legalFirst(a, b) || stages.indexOf(a.stage) - stages.indexOf(b.stage));
    }
    return byWait;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unitName reads world.units, already a dependency
  }, [focus, stage, order, query, board, readyNoTransport, now, world]);

  const shown = showAll ? rows : rows.slice(0, PAGE);
  const longestTierOne = board.tierOne[0];

  const attention: Attention[] = [
    ...board.tierOne.slice(0, 3).map((movement) => ({
      label: `${patientInitials(movement, world)} · tier 1 · ${waited(waitedMinutes(movement, now))}`,
      tone: "danger" as const,
      href: FLOW_ROUTES.movement(movement.id),
    })),
    ...(readyNoTransport.length
      ? [
          {
            label: `${readyNoTransport.length} ready to move with no transport booked`,
            tone: "warn" as const,
            onClick: () => {
              setFocus("readyNoTransport");
              setStage(null);
            },
          },
        ]
      : []),
    ...(transport.byState.Requested
      ? [
          {
            label: `${transport.byState.Requested} transport requests not yet accepted`,
            tone: "warn" as const,
            href: FLOW_ROUTES.transport,
          },
        ]
      : []),
    ...(board.declined.length
      ? [{ label: `${board.declined.length} ED-to-ward routes declined today`, tone: "info" as const }]
      : []),
  ];

  const corridorRows = useMemo(() => {
    const pairs = new Map<string, { originEdId: string; unitId: string; count: number }>();
    for (const corridor of board.corridors) {
      const key = `${corridor.originEdId}|${corridor.acceptedUnitId}`;
      const row = pairs.get(key) ?? { originEdId: corridor.originEdId, unitId: corridor.acceptedUnitId, count: 0 };
      row.count += corridor.count;
      pairs.set(key, row);
    }
    return [...pairs.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [board.corridors]);

  const planned = byLongestWait(
    board.open.filter((movement) => movement.plannedMoveAt !== undefined),
    now,
  ).sort((a, b) => (a.plannedMoveAt ?? 0) - (b.plannedMoveAt ?? 0));

  const focusKpi = (id: Focus) => ({
    pressed: focus === id,
    onSelect: () => {
      setFocus(id);
      setStage(null);
      setShowAll(false);
    },
  });

  return (
    <main id="main-content" className={styles.page} data-testid="movements-board">
      <FlowHeader
        crumbs={[{ label: "Operations" }, { label: "Movements" }]}
        title="Movements"
        badges={<Pill tone="quiet">{scopeLabel}</Pill>}
        asAt={asAt}
        actions={
          <>
            <Link className={styles.textButton} href={FLOW_ROUTES.timeline}>
              Movement timeline
            </Link>
            <a className={styles.buttonPrimary} href="/mockups/ward-flow/referrals/new">
              New referral
            </a>
          </>
        }
      />

      <Verdict attention={attention}>
        <strong>{plural(board.open.length, "movement is", "movements are")} open.</strong>{" "}
        {board.tierOne.length > 0 && longestTierOne ? (
          <>
            {board.tierOne.length} {board.tierOne.length === 1 ? "is" : "are"} tier 1; the longest tier 1 wait is{" "}
            <strong>
              {patientInitials(longestTierOne, world)}, {waited(waitedMinutes(longestTierOne, now))}
            </strong>{" "}
            at {stageCopy[longestTierOne.stage].label.toLowerCase()}.{" "}
          </>
        ) : (
          "No tier 1 movement is open. "
        )}
        {board.awaitingWard.length} {board.awaitingWard.length === 1 ? "is" : "are"} still waiting for a ward to accept.
      </Verdict>

      <KpiStrip
        label="Movement figures"
        items={[
          {
            label: "Open",
            value: board.open.length,
            note: `Plus ${board.closedToday.length} resolved today`,
            ...focusKpi("open"),
          },
          {
            label: "Tier 1 open",
            value: board.tierOne.length,
            tone: board.tierOne.length ? "danger" : undefined,
            note: "Most urgent",
            ...focusKpi("tier1"),
          },
          {
            label: "Waiting for a ward",
            value: board.awaitingWard.length,
            note: "Placement requested or under review",
            ...focusKpi("awaitingWard"),
          },
          {
            label: "Ready, no transport",
            value: readyNoTransport.length,
            tone: readyNoTransport.length ? "warn" : undefined,
            note: "Bed pulled or handover ready",
            ...focusKpi("readyNoTransport"),
          },
          {
            label: "Transport jobs",
            value: transport.jobs.length,
            note: `${transport.byState.Requested} requested · ${transport.byState.Accepted} accepted · ${transport.byState["En route"] + transport.byState.Collected} moving`,
          },
          {
            label: "Resolved today",
            value: board.closedToday.length,
            note: `${board.arrivedToday.length} delivered by transport`,
            ...focusKpi("resolved"),
          },
        ]}
      />

      <Panel
        title="Where every open movement is"
        question="Choose a stage to filter the worklist. Bars compare stages with each other."
        meta={
          stage ? (
            <button className={styles.linkButton} type="button" onClick={() => setStage(null)}>
              Clear stage filter
            </button>
          ) : (
            `${board.open.length} open`
          )
        }
      >
        <ol className={styles.pipeline} aria-label="Journey stages">
          {board.stages.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={styles.pipeStage}
                aria-pressed={stage === entry.id}
                onClick={() => {
                  setStage(stage === entry.id ? null : entry.id);
                  setFocus("open");
                  setShowAll(false);
                }}
              >
                <span className={styles.pipeLabel}>{entry.label}</span>
                <span className={styles.pipeCount}>{entry.movements.length}</span>
                <span className={styles.pipeTrack} aria-hidden="true">
                  <span
                    className={styles.pipeFill}
                    style={{ width: `${(entry.movements.length / maxStage) * 100}%` }}
                  />
                </span>
                <span className={styles.pipeMeta}>
                  {entry.movements.length
                    ? `Longest open ${waited(stageLongestWait(entry.movements, now))}`
                    : "None here"}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </Panel>

      <div className={styles.grid2}>
        <Panel
          title={focus === "resolved" ? "Resolved today" : "Worklist"}
          question="Longest wait first. Select a person to open their movement."
          meta={`${shown.length} shown of ${rows.length}`}
          flush
          foot={
            <>
              <span>An expiring legal authority, where one is recorded, outranks the wait in every order.</span>
              {rows.length > PAGE ? (
                <button className={styles.linkButton} type="button" onClick={() => setShowAll(!showAll)}>
                  {showAll ? "Show fewer" : `Show all ${rows.length}`}
                </button>
              ) : null}
            </>
          }
        >
          <div className={styles.toolbar}>
            <div className={styles.toolbarGroup}>
              <label className={styles.srOnly} htmlFor="movement-proposal-search">
                Search movements
              </label>
              <input
                id="movement-proposal-search"
                className={styles.search}
                type="search"
                placeholder="Search initials, WF number, ED or ward"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Segmented<Order>
              label="Order"
              value={order}
              onChange={setOrder}
              options={[
                { id: "wait", label: "Longest wait" },
                { id: "tier", label: "Tier" },
                { id: "stage", label: "Stage" },
              ]}
            />
          </div>
          {shown.length === 0 ? (
            <div className={styles.panelBody}>
              <p className={styles.empty}>No movement matches this filter{query ? " and search" : ""}.</p>
            </div>
          ) : (
            <div className={styles.tableScroll} role="region" aria-label="Movement worklist table" tabIndex={0}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Person</th>
                    <th scope="col">Tier</th>
                    <th scope="col">Stage</th>
                    <th scope="col">From and to</th>
                    <th scope="col">Holding it up</th>
                    <th scope="col" className={styles.num}>
                      Waited
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((movement) => {
                    const to = unitName(movement.acceptedUnitId);
                    const state = jobState(movement);
                    return (
                      <tr key={movement.id}>
                        <td>
                          <span className={styles.rowName}>
                            <a href={FLOW_ROUTES.movement(movement.id)}>{patientInitials(movement, world)}</a>
                            <span className={styles.rowSub}>{movement.id}</span>
                          </span>
                        </td>
                        <td>
                          <Pill tone={tierTone(movement.urgency)}>{urgencyTierLabel(movement.urgency)}</Pill>
                        </td>
                        <td>{isOpen(movement) ? stageCopy[movement.stage].label : "Resolved"}</td>
                        <td>
                          <span className={styles.route}>
                            <span>{edShort(movement.originEdId)}</span>
                            <span className={styles.routeTo} title={to ?? undefined}>
                              →{" "}
                              {to ??
                                (movement.referredUnitIds.length
                                  ? `${movement.referredUnitIds.length} wards referred`
                                  : "No ward yet")}
                            </span>
                          </span>
                        </td>
                        <td>
                          <span className={styles.barrier}>
                            {isExpiringLegalAuthority(movement, now) ? (
                              <span className={styles.legalFlag}>
                                <span className={`${styles.dot} ${styles.dotDanger}`} aria-hidden="true" />
                                Legal authority running out ·{" "}
                              </span>
                            ) : null}
                            {meaningfulBlocker(movement) ?? (state ? JOB_STATE_LABEL[state].label : "Nothing recorded")}
                          </span>
                        </td>
                        <td className={styles.num}>{waited(waitedMinutes(movement, now))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className={styles.stack}>
          <Panel
            title="Transport right now"
            question="Open transport jobs by state."
            meta={`${transport.jobs.length} open`}
            foot={<a href={FLOW_ROUTES.transport}>Open Transport Hub</a>}
          >
            <ul className={styles.list}>
              {JOB_STATES.map((state) => (
                <li key={state} className={styles.listRow}>
                  <span>
                    {JOB_STATE_LABEL[state].label}
                    <span className={styles.checkSub}>{JOB_STATE_LABEL[state].meaning}</span>
                  </span>
                  <strong className={styles.num}>{transport.byState[state]}</strong>
                </li>
              ))}
              <li className={styles.listRow}>
                <span>
                  Arrived today
                  <span className={styles.checkSub}>Delivered to the ward; no longer open</span>
                </span>
                <strong className={styles.num}>{board.arrivedToday.length}</strong>
              </li>
            </ul>
            <p className={styles.note}>
              {board.noTransport.length} open movements have no transport job yet; {noTransportAwaitingWard} of them are
              still waiting for a ward.
            </p>
          </Panel>

          <Panel
            title="Busiest ED-to-ward routes"
            question="Open movements with an accepting ward."
            meta={`Top ${corridorRows.length} of ${board.corridorPairs}`}
          >
            {corridorRows.length === 0 ? (
              <p className={styles.empty}>No open movement has an accepting ward yet.</p>
            ) : (
              <ul className={styles.list}>
                {corridorRows.map((row) => (
                  <li key={`${row.originEdId}|${row.unitId}`} className={styles.listRow}>
                    <span className={styles.route}>
                      <span>{edShort(row.originEdId)}</span>
                      <span className={styles.routeTo}>→ {unitName(row.unitId)}</span>
                    </span>
                    <strong className={styles.num}>{row.count}</strong>
                  </li>
                ))}
              </ul>
            )}
            <p className={styles.note}>
              {plural(board.declined.length, "route")} had a decline today. Declines are listed on each movement.
            </p>
          </Panel>

          <Panel
            title="Planned moves"
            question="Moves with a planned time recorded, soonest first."
            meta={`${Math.min(planned.length, showAllPlanned ? planned.length : 6)} of ${planned.length}`}
            foot={
              planned.length > 6 ? (
                <button className={styles.linkButton} type="button" onClick={() => setShowAllPlanned(!showAllPlanned)}>
                  {showAllPlanned ? "Show fewer" : `Show all ${planned.length}`}
                </button>
              ) : undefined
            }
          >
            {planned.length === 0 ? (
              <p className={styles.empty}>No planned move time is recorded.</p>
            ) : (
              <ul className={styles.list}>
                {(showAllPlanned ? planned : planned.slice(0, 6)).map((movement) => (
                  <li key={movement.id} className={styles.listRow}>
                    <span className={styles.rowName}>
                      <a href={FLOW_ROUTES.movement(movement.id)}>{patientInitials(movement, world)}</a>
                      <span className={styles.rowSub}>
                        {edShort(movement.originEdId)} → {unitName(movement.acceptedUnitId) ?? "No ward yet"}
                      </span>
                    </span>
                    <span className={styles.num}>{formatInstantWithDay(movement.plannedMoveAt ?? now, now)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <Definitions
        items={[
          {
            term: "Open",
            meaning:
              "A movement not yet arrived and not closed. Resolved today counts movements closed on this synthetic day.",
          },
          {
            term: "Waited",
            meaning: "Time since the movement was opened, to now. It is not a target and no threshold is applied.",
          },
          { term: "Tier", meaning: "The urgency recorded on the movement: tier 1 most urgent, tier 3 least urgent." },
          {
            term: "Transport jobs",
            meaning:
              "Open transport jobs, requested or under way, counted by the same rule as the Transport Hub. Ready, no transport counts movements with no job at all.",
          },
          {
            term: "Scope",
            meaning: `Figures follow the service chosen in the top bar (now: ${scopeLabel}). ${scoped.length} movements in scope.`,
          },
        ]}
      />
    </main>
  );
}
