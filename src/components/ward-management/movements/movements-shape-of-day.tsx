"use client";

// The Movements screen's Shape of the day panel and its transport and movement rows. Split out of
// movements-screen.tsx to keep that file under the line cap.
import { dayOf, minuteOfDay, type Instant, splitDuration } from "@/components/ward-management/ward-clock";
import { ChartColumn, CircleCheck, Grid3x3 } from "lucide-react";
import { StatusGlyph } from "@/components/wf";
import { WAIT_BANDS, waitBand } from "@/components/ward-management/delays/delays-board-model";
import sh from "./movements-shape-of-day.module.css";
import { startTransition, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { type JourneyStage, type TransportLegRow } from "./movements-derivations";
import styles from "./movements.module.css";

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
  const pick = (list: Movement[]) =>
    (isInServiceScope !== null ? list.find(isInServiceScope) : undefined) ?? list[0];

  // Where they wait: each stage's open movements counted into the four wait bands.
  const grid = openStages.filter((stage) => stage.id !== "arrived").map((stage) => {
    const cells: Movement[][] = [[], [], [], []];
    for (const movement of stage.movements) cells[waitBand(Math.max(now - movement.openedAt, 0))].push(movement);
    return { stage, cells };
  });
  const cellMax = Math.max(1, ...grid.flatMap((row) => row.cells.map((cell) => cell.length)));
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
  const wardOf = (movement: Movement) =>
    units.find((unit) => unit.id === movement.acceptedUnitId)?.name ?? "No ward";

  const tabs = [
    { id: "stage" as const, label: "Where they wait", Icon: Grid3x3, value: openMovements.length },
    { id: "waiting" as const, label: "Flow today", Icon: ChartColumn, value: undefined },
    { id: "resolved" as const, label: "Outcomes", Icon: CircleCheck, value: closedToday.length },
  ];

  return (
    <div className={sh.shape}>
      <div className={sh.tabs} role="tablist" aria-label="Shape of the day">
        {tabs.map(({ id, label, Icon, value }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={sh.tab}
            onClick={() => startTransition(() => setShapeTab(id))}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
            {value === undefined ? null : <span className={sh.tabCount}>{value}</span>}
          </button>
        ))}
      </div>

      {tab === "stage" ? (
        <div className={sh.panel} role="tabpanel" aria-label="Where they wait">
          <table className={sh.heat}>
            <caption className="sr-only">Open movements by stage and how long they have waited</caption>
            <thead>
              <tr>
                <th scope="col">Stage</th>
                {WAIT_BANDS.map((band) => (
                  <th key={band} scope="col">
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
                        style={{ "--heat": (cell.length / cellMax).toFixed(2) } as CSSProperties}
                        disabled={cell.length === 0}
                        title={`${stage.label}, ${WAIT_BANDS[band].toLowerCase()}: ${cell.length}`}
                        onClick={() => {
                          const first = pick(cell);
                          if (first) jumpToMovement(first.id, true);
                        }}
                      >
                        {cell.length === 0 ? <span aria-label="none">·</span> : cell.length}
                      </button>
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
            </span>
            Fewer to more. Choose a square to find those patients in the worklist.
          </p>
        </div>
      ) : null}

      {tab === "waiting" ? (
        <div className={sh.panel} role="tabpanel" aria-label="Flow today">
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
          <div className={sh.chart} role="img" aria-label={`By hour since midnight: ${raised.length} raised and ${closedToday.length} resolved today.`}>
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
                <span className={sh.hourLabel}>{row.hour % 3 === 0 || row.hour === hourNow ? String(row.hour).padStart(2, "0") : ""}</span>
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
        <div className={sh.panel} role="tabpanel" aria-label="Outcomes today">
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
