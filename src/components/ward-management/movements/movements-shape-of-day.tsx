"use client";

// The Movements screen's Shape of the day panel and its transport and movement rows. Split out of
// movements-screen.tsx to keep that file under the line cap.
import { dayOf, minuteOfDay, type Instant, splitDuration } from "@/components/ward-management/ward-clock";
import { ChartColumn, ChevronRight, CircleCheck, Grid3x3 } from "lucide-react";
import { StatusGlyph } from "@/components/wf";
import { WAIT_BANDS, waitBand } from "@/components/ward-management/delays/delays-board-model";
import sh from "./movements-shape-of-day.module.css";
import {
  startTransition,
  useId,
  useRef,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from "react";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { type JourneyStage, type TransportLegRow } from "./movements-derivations";
import styles from "./movements.module.css";
import type { MovementPeopleList } from "./movement-people-sheet";

/**
 * Shape of the day, redesigned (1 Nov 2026). Three graph tabs in Waiting's style: where the open
 * movements wait (stage by wait band, a flat heat map), the flow across today by hour (opened and
 * resolved), and today's outcomes. Every number is a count over the synthetic records on screen.
 */
type ShapeTab = "stage" | "transport" | "waiting" | "resolved";

export function ShapeOfTheDay({
  arrivedMovements,
  closedToday,
  didNotProceedMovements,
  isInServiceScope,
  jumpToMovement,
  now,
  onShowPeople,
  openDetail,
  openMovements,
  openStages,
  patients,
  referrals,
  setShapeTab,
  shapeTab,
  units,
}: {
  arrivedMovements: Movement[];
  closedToday: Movement[];
  didNotProceedMovements: Movement[];
  isInServiceScope: ((movement: Movement) => boolean) | null;
  jumpToMovement: (movementId: string, byStage?: boolean) => void;
  legs: TransportLegRow[];
  noTransportRecord: Movement[];
  now: Instant;
  /** M3 (3 Nov 2026): a square opens its patients in the list pop-up. */
  onShowPeople?: (list: MovementPeopleList) => void;
  openDetail: (id: string) => void;
  openMovements: Movement[];
  openStages: JourneyStage[];
  patients: Patient[];
  referrals: Referral[];
  setShapeTab: Dispatch<SetStateAction<ShapeTab>>;
  shapeTab: ShapeTab;
  unacceptedTransport: Movement[];
  units: Unit[];
  waitingMovements: Movement[];
}) {
  const tab = shapeTab === "transport" ? "stage" : shapeTab;
  // WAI-ARIA tabs pattern: each tab controls its panel, one tab stop, arrows/Home/End move it.
  // Panels keep their own aria-label: aria-labelledby would override it with the tab text and count.
  const idPrefix = useId();
  const tabId = (id: string) => `${idPrefix}-tab-${id}`;
  const panelId = (id: string) => `${idPrefix}-panel-${id}`;
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const pick = (list: Movement[]) => (isInServiceScope !== null ? list.find(isInServiceScope) : undefined) ?? list[0];

  // Where they wait: each stage's open movements counted into the four wait bands.
  const grid = openStages
    .filter((stage) => stage.id !== "arrived")
    .map((stage) => {
      const cells: Movement[][] = [[], [], [], []];
      for (const movement of stage.movements) cells[waitBand(Math.max(now - movement.openedAt, 0))].push(movement);
      return { stage, cells };
    });
  const cellMax = Math.max(1, ...grid.flatMap((row) => row.cells.map((cell) => cell.length)));
  // M3: the long waits as actions, longest band first, each opening its patients.
  const needsLook = [3, 2].flatMap((band) =>
    grid.filter((row) => row.cells[band].length > 0).map((row) => ({ stage: row.stage, band, list: row.cells[band] })),
  );
  const showCell = (stageLabel: string, band: number, list: Movement[]) =>
    onShowPeople?.({
      title: `${stageLabel}, ${WAIT_BANDS[band].toLowerCase()}`,
      caption: `Open movements at this stage that have waited ${WAIT_BANDS[band].toLowerCase()}.`,
      tone: band === 3 ? "danger" : band === 2 ? "warning" : undefined,
      movements: list,
    });
  const bandTotals = [0, 1, 2, 3].map((band) => grid.reduce((total, row) => total + row.cells[band].length, 0));

  // Flow today: opened and resolved in each hour since midnight.
  const today = dayOf(now);
  const hourNow = Math.floor(minuteOfDay(now) / 60);
  const raised = [...openMovements, ...closedToday].filter((movement) => dayOf(movement.openedAt) === today);
  const hours = Array.from({ length: hourNow + 1 }, (_, hour) => ({
    hour,
    opened: raised.filter((movement) => Math.floor(minuteOfDay(movement.openedAt) / 60) === hour).length,
    resolved: closedToday.filter((movement) => Math.floor(minuteOfDay(movement.closure!.at) / 60) === hour).length,
  }));
  const hourMax = Math.max(1, ...hours.flatMap((row) => [row.opened, row.resolved]));
  const net = raised.length - closedToday.length;

  // Outcomes: arrived against did not proceed, and how long the arrivals took.
  const took = arrivedMovements
    .map((movement) => Math.max((movement.closure?.at ?? now) - movement.openedAt, 0))
    .sort((a, b) => a - b);
  const medianTook = took.length ? took[Math.floor((took.length - 1) / 2)] : undefined;
  const name = (movement: Movement) => resolveSubjectPatient(movement, { patients, referrals }).formalName;
  const wardOf = (movement: Movement) => units.find((unit) => unit.id === movement.acceptedUnitId)?.name ?? "No ward";

  const tabs = [
    { id: "stage" as const, label: "Where they wait", Icon: Grid3x3, value: openMovements.length },
    { id: "waiting" as const, label: "Flow today", Icon: ChartColumn, value: undefined },
    { id: "resolved" as const, label: "Outcomes", Icon: CircleCheck, value: closedToday.length },
  ];

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = tabs.findIndex((entry) => entry.id === tab);
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? tabs.length - 1
              : undefined;
    if (next === undefined) return;
    event.preventDefault();
    const nextId = tabs[next].id;
    startTransition(() => setShapeTab(nextId));
    tabRefs.current.get(nextId)?.focus();
  };

  return (
    <div className={sh.shape}>
      <div className={sh.tabs} role="tablist" aria-label="Shape of the day">
        {tabs.map(({ id, label, Icon, value }) => (
          <button
            key={id}
            ref={(node) => {
              if (node) tabRefs.current.set(id, node);
              else tabRefs.current.delete(id);
            }}
            id={tabId(id)}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-controls={panelId(id)}
            tabIndex={tab === id ? 0 : -1}
            className={sh.tab}
            onClick={() => startTransition(() => setShapeTab(id))}
            onKeyDown={onTabKeyDown}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
            {value === undefined ? null : <span className={sh.tabCount}>{value}</span>}
          </button>
        ))}
      </div>

      {tab === "stage" ? (
        <div className={sh.panel} role="tabpanel" id={panelId("stage")} aria-label="Where they wait">
          {/* Act first: the long waits as a sentence and one chip each, above the grid. */}
          {needsLook.length > 0 && onShowPeople ? (
            <section className={sh.act} aria-label="Longest waits to act on">
              <p className={sh.actHead}>
                {bandTotals[3] > 0 ? (
                  <>
                    <b data-tone="danger">{bandTotals[3]}</b> waited {WAIT_BANDS[3].toLowerCase()}
                  </>
                ) : null}
                {bandTotals[3] > 0 && bandTotals[2] > 0 ? ", " : null}
                {bandTotals[2] > 0 ? (
                  <>
                    <b data-tone="warning">{bandTotals[2]}</b> {bandTotals[3] > 0 ? "more" : "have waited"}{" "}
                    {WAIT_BANDS[2]}
                  </>
                ) : null}
                <span className={sh.actSub}>Start with these. Each opens its patients.</span>
              </p>
              <div className={sh.actList}>
                {needsLook.map(({ stage, band, list }) => (
                  <button
                    key={`${stage.id}-${band}`}
                    type="button"
                    className={sh.actChip}
                    data-band={band}
                    onClick={() => showCell(stage.label, band, list)}
                  >
                    <b>{list.length}</b>
                    <span>
                      {stage.label}
                      <small>{WAIT_BANDS[band].toLowerCase()}</small>
                    </span>
                    <ChevronRight size={14} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          <table className={sh.heat}>
            <caption className="sr-only">Open movements by stage and how long they have waited</caption>
            <thead>
              <tr>
                <th scope="col">Stage</th>
                {WAIT_BANDS.map((band, index) => (
                  <th key={band} scope="col" data-band={index}>
                    {band}
                  </th>
                ))}
                <th scope="col" className={sh.total}>
                  Open
                </th>
              </tr>
            </thead>
            <tbody>
              {grid.map(({ stage, cells }) => (
                <tr key={stage.id}>
                  <th scope="row">
                    <button
                      type="button"
                      className={sh.rowLink}
                      disabled={stage.movements.length === 0}
                      // The stage name finds its first patient in the worklist; the squares open lists.
                      title="Find in the worklist"
                      onClick={() => {
                        const first = pick(stage.movements);
                        if (first) jumpToMovement(first.id, true);
                      }}
                    >
                      {stage.label}
                    </button>
                  </th>
                  {cells.map((cell, band) => (
                    <td key={band}>
                      <button
                        type="button"
                        className={sh.cell}
                        data-band={band}
                        data-empty={cell.length === 0 ? "true" : undefined}
                        data-strong={band < 2 && cell.length / cellMax >= 0.75 ? "true" : undefined}
                        style={{ "--heat": (cell.length / cellMax).toFixed(2) } as CSSProperties}
                        disabled={cell.length === 0}
                        title={`${stage.label}, ${WAIT_BANDS[band].toLowerCase()}: ${cell.length}`}
                        onClick={() => {
                          if (onShowPeople) {
                            showCell(stage.label, band, cell);
                            return;
                          }
                          const first = pick(cell);
                          if (first) jumpToMovement(first.id, true);
                        }}
                      >
                        {cell.length === 0 ? <span className="sr-only">none</span> : cell.length}
                      </button>
                      {/* Desktop: hovering a square shows who is in it, so nobody has to click away. */}
                      {cell.length > 0 ? (
                        <span className={sh.peek} aria-hidden="true">
                          <span className={sh.peekHead}>
                            {stage.label} · {WAIT_BANDS[band].toLowerCase()}
                          </span>
                          {[...cell]
                            .sort((a, b) => a.openedAt - b.openedAt)
                            .slice(0, 5)
                            .map((movement) => (
                              <span key={movement.id} className={sh.peekRow}>
                                <span>{name(movement)}</span>
                                <b>{splitDuration(Math.max(now - movement.openedAt, 0))}</b>
                              </span>
                            ))}
                          <span className={sh.peekFoot}>
                            {cell.length > 5 ? `${cell.length - 5} more. ` : ""}Choose the square to open them.
                          </span>
                        </span>
                      ) : null}
                    </td>
                  ))}
                  <td className={sh.total}>{stage.movements.length}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">All stages</th>
                {bandTotals.map((total, band) => (
                  <td key={band}>{total}</td>
                ))}
                <td className={sh.total}>{openMovements.length}</td>
              </tr>
            </tfoot>
          </table>
          <p className={sh.key}>
            <span className={sh.ramp} aria-hidden="true">
              <i style={{ "--heat": 0.15 } as CSSProperties} />
              <i style={{ "--heat": 0.45 } as CSSProperties} />
              <i style={{ "--heat": 0.75 } as CSSProperties} />
              <i style={{ "--heat": 1 } as CSSProperties} />
              <i data-band="2" />
              <i data-band="3" />
            </span>
            Fewer to more in the first two columns. Amber is {WAIT_BANDS[2]}, red {WAIT_BANDS[3].toLowerCase()}. Choose
            a square to see who is in it.
          </p>
        </div>
      ) : null}

      {tab === "waiting" ? (
        <div className={sh.panel} role="tabpanel" id={panelId("waiting")} aria-label="Flow today">
          <dl className={sh.figures}>
            <div>
              <dt>Raised today</dt>
              <dd>{raised.length}</dd>
            </div>
            <div>
              <dt>Resolved today</dt>
              <dd>{closedToday.length}</dd>
            </div>
            <div>
              <dt>Net change</dt>
              <dd>{net > 0 ? `+${net}` : net}</dd>
            </div>
            <div>
              <dt>Still open</dt>
              <dd>{openMovements.length}</dd>
            </div>
          </dl>
          <div
            className={sh.chart}
            role="img"
            aria-label={`By hour since midnight: ${raised.length} raised and ${closedToday.length} resolved today.`}
          >
            {hours.map((row) => (
              <div
                key={row.hour}
                className={sh.hour}
                title={`${String(row.hour).padStart(2, "0")}:00 to ${String(row.hour + 1).padStart(2, "0")}:00: ${row.opened} raised, ${row.resolved} resolved`}
                data-now={row.hour === hourNow ? "true" : undefined}
              >
                <span className={sh.bars}>
                  <i data-series="opened" style={{ height: `${(row.opened / hourMax) * 100}%` }} />
                  <i data-series="resolved" style={{ height: `${(row.resolved / hourMax) * 100}%` }} />
                </span>
                <span className={sh.hourLabel}>
                  {row.hour % 3 === 0 || row.hour === hourNow ? String(row.hour).padStart(2, "0") : ""}
                </span>
              </div>
            ))}
          </div>
          <ul className={sh.legend}>
            <li>
              <i data-series="opened" aria-hidden="true" />
              Raised
            </li>
            <li>
              <i data-series="resolved" aria-hidden="true" />
              Resolved
            </li>
          </ul>
        </div>
      ) : null}

      {tab === "resolved" ? (
        <div className={sh.panel} role="tabpanel" id={panelId("resolved")} aria-label="Outcomes today">
          <dl className={sh.figures}>
            <div>
              <dt>
                <StatusGlyph tone="success" size={9} />
                Arrived
              </dt>
              <dd>{arrivedMovements.length}</dd>
            </div>
            <div>
              <dt>
                <StatusGlyph tone="closed" size={9} />
                Did not proceed
              </dt>
              <dd>{didNotProceedMovements.length}</dd>
            </div>
            <div>
              <dt>Typical time to arrive</dt>
              <dd>{medianTook === undefined ? "None yet" : splitDuration(medianTook)}</dd>
            </div>
          </dl>
          {closedToday.length === 0 ? (
            <p className={styles.absent}>Nothing has been resolved today.</p>
          ) : (
            <div className={sh.outcomeCols}>
              {[
                { id: "arrived", title: "Arrived", list: arrivedMovements },
                { id: "dnp", title: "Did not proceed", list: didNotProceedMovements },
              ].map((col) =>
                col.list.length === 0 ? null : (
                  <section key={col.id} className={sh.outcomeCol} aria-label={col.title}>
                    <h4>
                      {col.title} <span>{col.list.length}</span>
                    </h4>
                    <ul>
                      {col.list.map((movement) => (
                        <li key={movement.id}>
                          <button type="button" className={sh.outcomeRow} onClick={() => openDetail(movement.id)}>
                            <strong>{name(movement)}</strong>
                            <span className={sh.outcomeTime}>
                              {splitDuration(Math.max((movement.closure?.at ?? now) - movement.openedAt, 0))}
                            </span>
                            <small>{col.id === "arrived" ? wardOf(movement) : movement.closure?.reason}</small>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ),
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
