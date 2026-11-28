"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye } from "lucide-react";

import {
  BarList,
  Button,
  Card,
  PhoneSheet,
  RowSpark,
  RowTrend,
  SrOnly,
  StatusGlyph,
  buttonClass,
  cx,
} from "@/components/wf";
import type { HealthService } from "@/components/ward-management/ward-model";
import { ED_SEVERE_PRESSURE_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { edHref } from "@/components/ward-management/shell/ward-facade";

import {
  CLOCK_TONE,
  personDim,
  rowClock,
  trendSpanHours,
  waitLine,
  type EdRow,
  type Highlight,
} from "./ed-index-parts";
import { PeoplePips } from "./ed-index-pips";
import { EdLaneFacts, EdLanePicked } from "./ed-index-preview-load";
import styles from "./ed-index.module.css";

/*
 * Phone script budget (28 Nov 2026): the ED index's desktop views (cards with the Waiting by ED rail,
 * the table and the wait lanes) and the phone's Lanes and Snapshot views. A phone opens on its list,
 * so none of these draw on its first load; `ed-index.tsx` loads this file through `next/dynamic`,
 * which still draws the desktop's view on the server.
 */

/** Lane scale: logarithmic from zero to seven days, so an hour and a week both stay readable. */
const LANE_TICKS: readonly [number, string][] = [
  [60, "1h"],
  [240, "4h"],
  [480, "8h"],
  [1440, "24h"],
  [4320, "3d"],
  [10080, "7d"],
];
const LANE_MAX_MINUTES = LANE_TICKS[LANE_TICKS.length - 1][0];
function lanePosition(minutes: number): number {
  return Math.min(1, Math.log1p(minutes / 30) / Math.log1p(LANE_MAX_MINUTES / 30)) * 100;
}

/**
 * Phone lanes: people whose marks would overlap share one counted mark, drawn at the longest wait.
 * The phone lane is about 190px and a mark 22px, so marks within 12% of the lane chain together.
 */
function laneClusters<T extends { wait: number }>(people: readonly T[]): T[][] {
  const clusters: T[][] = [];
  for (const person of [...people].sort((a, b) => a.wait - b.wait)) {
    const last = clusters[clusters.length - 1];
    if (last && lanePosition(person.wait) - lanePosition(last[last.length - 1]!.wait) < 12) last.push(person);
    else clusters.push([person]);
  }
  return clusters;
}

/** Desktop cards view: every ED with someone waiting as a card, the clear EDs on one line, and the rail. */
export function EdCardsView({
  shown,
  isDim,
  highlight,
  onPreview,
  accessTarget,
}: {
  shown: EdRow[];
  isDim: (row: EdRow) => boolean;
  highlight: Highlight | null;
  onPreview: (edId: string) => void;
  accessTarget: number;
}) {
  const servicePicker = <WaitingSnapshot shown={shown} onPreview={onPreview} accessTarget={accessTarget} />;
  return (
    <div className={styles.cardsWithRail}>
      <section className={styles.cardGrid} aria-label="Emergency department cards">
        {shown
          .filter((row) => row.summary.waiting > 0)
          .map((row, index) => (
            <EdCard
              key={row.summary.ed.id}
              rank={index + 1}
              row={row}
              dim={isDim(row)}
              highlight={highlight}
              onPreview={() => onPreview(row.summary.ed.id)}
            />
          ))}
        {shown.some((row) => row.summary.waiting === 0) ? (
          <div className={styles.clearLine} aria-label="Departments with nobody waiting" role="group">
            <span className={styles.clearLabel}>Nobody waiting</span>
            {shown
              .filter((row) => row.summary.waiting === 0)
              .map((row) => (
                <span
                  key={row.summary.ed.id}
                  className={styles.clearEd}
                  data-service={row.summary.service}
                  data-dim={isDim(row) ? "true" : undefined}
                  data-testid={`ed-index-clear-${row.summary.ed.id}`}
                >
                  <b title={row.summary.ed.name}>{row.short}</b>
                  <EnterLink row={row} />
                </span>
              ))}
          </div>
        ) : null}
      </section>
      <div className={styles.serviceRail} data-wf-rail>
        {servicePicker}
      </div>
    </div>
  );
}

function Legend({ accessTarget }: { accessTarget: number }) {
  return (
    <p className={styles.legend}>
      <span>
        <StatusGlyph tone="danger" size={9} /> Over {waitLine(accessTarget)}
      </span>
      <span>
        <StatusGlyph tone="warning" size={9} /> Over {waitLine(ED_SEVERE_PRESSURE_WAIT_MINUTES)}
      </span>
      <span>
        <StatusGlyph tone="neutral" size={9} /> Under {waitLine(ED_SEVERE_PRESSURE_WAIT_MINUTES)}
      </span>
    </p>
  );
}

function Longest({ row }: { row: EdRow }) {
  const clock = rowClock(row);
  if (row.summary.waiting === 0) return <span className={styles.footLabel}>Clear</span>;
  return (
    <span className={styles.longest}>
      {clock !== "in" ? <StatusGlyph tone={CLOCK_TONE[clock]} size={9} /> : null}
      <b className={styles.num}>{splitDuration(row.summary.longestWaitMinutes)}</b>
    </span>
  );
}

function EnterLink({ row }: { row: EdRow }) {
  return (
    <Link
      className={buttonClass({ variant: "sec", size: "sm" })}
      href={edHref(row.summary.ed.id)}
      data-testid={`ed-index-link-${row.summary.ed.id}`}
      aria-label={`Open ${row.short}`}
    >
      Open
    </Link>
  );
}

function PreviewButton({ row, onPreview }: { row: EdRow; onPreview: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      iconOnly
      icon={Eye}
      aria-label={`Preview ${row.short}`}
      aria-haspopup="dialog"
      title="Preview who is waiting"
      onClick={onPreview}
      data-testid={`ed-index-preview-${row.summary.ed.id}`}
    />
  );
}

function EdCard({
  rank,
  row,
  dim,
  highlight,
  onPreview,
}: {
  rank: number;
  row: EdRow;
  dim: boolean;
  highlight: Highlight | null;
  onPreview: () => void;
}) {
  const { summary } = row;
  return (
    <article
      className={styles.edCard}
      data-service={summary.service}
      data-past-target={row.pastTarget > 0}
      data-dim={dim ? "true" : undefined}
      data-testid={`ed-index-card-${summary.ed.id}`}
    >
      {/* Device audit 11 Oct 2026: one control per card. The card itself opens the preview, and
          Open stays as the one button. */}
      <button
        type="button"
        className={styles.cardOpen}
        aria-label={`Preview ${row.short}`}
        aria-haspopup="dialog"
        title="Preview who is waiting"
        onClick={onPreview}
        data-testid={`ed-index-preview-${row.summary.ed.id}`}
      />
      <div className={styles.cardHead}>
        <h2 className={styles.edTitle} title={summary.ed.name}>
          <span className={styles.rank} aria-hidden="true">
            {rank}
          </span>
          {row.short}
        </h2>
        <span className={styles.service}>{summary.service}</span>
      </div>
      <div className={styles.siteRow}>
        <p className={styles.meta} title={summary.siteName}>
          {summary.siteName}
        </p>
        <CardTrend values={row.trend} name={row.short} />
      </div>
      <PeoplePips row={row} highlight={highlight} />
      {/* The figures wrap between figures, never mid-phrase, so none ends in "…". */}
      <p className={styles.figures}>
        <span className={styles.fig}>
          <b className={styles.num}>{summary.waiting}</b> waiting
        </span>{" "}
        <span aria-hidden="true">·</span>{" "}
        <span className={styles.fig}>
          <b className={styles.num}>{row.noBed}</b> no bed
        </span>{" "}
        <span aria-hidden="true">·</span>{" "}
        <span className={styles.fig}>
          <b className={styles.num}>{row.held}</b> accepted
        </span>{" "}
        <span aria-hidden="true">·</span>{" "}
        <span className={styles.fig}>
          <b className={styles.num}>{row.forms}</b> under a form
        </span>
      </p>
      <div className={styles.cardFoot}>
        <Longest row={row} />
        {summary.waiting > 0 ? <span className={styles.footLabel}>longest</span> : null}
        <span className={styles.footActions}>
          <EnterLink row={row} />
        </span>
      </div>
    </article>
  );
}

/** Audit two #56: the card's trend reads "7 more than 12h ago" in place of "+7 in 12h". */
function CardTrend({ values, name }: { values: readonly number[]; name: string }) {
  const change = values.length < 2 ? 0 : values[values.length - 1] - values[0];
  const words =
    change === 0 ? "same as 12h ago" : change > 0 ? `${change} more than 12h ago` : `${-change} fewer than 12h ago`;
  return (
    <span className={styles.cardTrend}>
      <RowSpark values={values} name={name} testId="ed-row-spark" />
      <span className={styles.cardTrendWords} aria-hidden="true">
        {words}
      </span>
    </span>
  );
}

const TABLE_COLUMNS = "minmax(170px, 1.4fr) minmax(200px, 2fr) 96px 72px 60px 72px 60px 96px 112px";

export function EdTable({
  rows,
  isDim,
  highlight,
  onPreview,
}: {
  rows: EdRow[];
  isDim: (row: EdRow) => boolean;
  highlight: Highlight | null;
  onPreview: (edId: string) => void;
}) {
  return (
    <Card className={styles.tableCard} as="section" aria-label="Emergency department table">
      <div role="table" aria-label="Emergency departments" className={styles.table}>
        <div role="rowgroup">
          <div role="row" className={cx(styles.tr, styles.th)} style={{ gridTemplateColumns: TABLE_COLUMNS }}>
            <span role="columnheader">Department</span>
            <span role="columnheader">Waiting, longest first</span>
            <span role="columnheader">{`Last ${trendSpanHours}h`}</span>
            <span role="columnheader" className={styles.end}>
              No bed
            </span>
            <span role="columnheader" className={styles.end}>
              Accepted
            </span>
            <span role="columnheader" className={styles.end}>
              Leaving
            </span>
            <span role="columnheader" className={styles.end}>
              Form
            </span>
            <span role="columnheader" className={styles.end}>
              Longest
            </span>
            <span role="columnheader">
              <SrOnly>Open</SrOnly>
            </span>
          </div>
        </div>
        <div role="rowgroup">
          {rows.map((row) => (
            <div
              role="row"
              key={row.summary.ed.id}
              className={styles.tr}
              style={{ gridTemplateColumns: TABLE_COLUMNS }}
              data-dim={isDim(row) ? "true" : undefined}
            >
              <span role="cell" className={styles.edCell}>
                <span className={styles.edTitle}>{row.short}</span>
                <span className={styles.meta}>{row.summary.service}</span>
              </span>
              <span role="cell">
                <PeoplePips row={row} highlight={highlight} />
              </span>
              <span role="cell">
                <RowTrend values={row.trend} name={row.short} testId="ed-row-spark" />
              </span>
              {[row.noBed, row.held, row.leaving, row.forms].map((value, index) => (
                <span role="cell" key={index} className={cx(styles.end, styles.num, value === 0 && styles.zero)}>
                  {value}
                </span>
              ))}
              <span role="cell" className={styles.end}>
                <Longest row={row} />
              </span>
              <span role="cell" className={cx(styles.end, styles.rowActions)}>
                <PreviewButton row={row} onPreview={() => onPreview(row.summary.ed.id)} />
                <EnterLink row={row} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/**
 * Wait lanes: every ED is a lane and every person waiting is a mark at their wait time, on a log
 * scale with the access target dashed. Pressing a mark shows that person under the lanes.
 */
export function EdLanes({
  rows,
  services,
  accessTarget,
  isDim,
  highlight,
  phone = false,
}: {
  rows: EdRow[];
  services: readonly HealthService[];
  accessTarget: number;
  isDim: (row: EdRow) => boolean;
  highlight: Highlight | null;
  phone?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const router = useRouter();
  const picked = rows
    .flatMap((row) => row.people.map((person) => ({ row, person })))
    .find(({ person }) => person.movement.id === selected);
  const groups = services
    .map((name) => ({ name, rows: rows.filter((row) => row.summary.service === name) }))
    .filter((group) => group.rows.length > 0);

  return (
    <Card className={styles.lanesCard} as="section" aria-label="Wait lanes">
      <div className={styles.axis} aria-hidden="true">
        <span>ED, waiting</span>
        <span className={styles.track}>
          {LANE_TICKS.map(([minutes, label]) => (
            <span
              key={label}
              className={styles.tick}
              style={{ left: `${lanePosition(minutes)}%` }}
              data-minor={minutes === 240 ? "true" : undefined}
            >
              {label}
            </span>
          ))}
        </span>
        <span className={styles.end}>Longest</span>
      </div>
      {groups.map((group) => (
        <section key={group.name} aria-label={group.name} className={styles.laneGroup}>
          <h2 className={styles.eyebrow}>{group.name}</h2>
          {group.rows.map((row) => (
            <div key={row.summary.ed.id} className={styles.lane} data-dim={isDim(row) ? "true" : undefined}>
              <Link href={edHref(row.summary.ed.id)} className={styles.laneLabel}>
                <b>{row.short}</b>
                <span className={styles.laneCount}>{row.summary.waiting}</span>
              </Link>
              <span className={cx(styles.track, styles.laneTrack)}>
                {LANE_TICKS.map(([minutes]) => (
                  <span key={minutes} className={styles.gridline} style={{ left: `${lanePosition(minutes)}%` }} />
                ))}
                <span className={styles.target} style={{ left: `${lanePosition(accessTarget)}%` }} />
                {phone
                  ? // Device audit 11 Oct 2026: on a phone, marks closer than a mark's width become one
                    // counted mark (it opens the longest wait in it), and the lane is inset so the
                    // last mark is never cut by the Longest column.
                    laneClusters(row.people).map((cluster) => {
                      const longest = cluster[cluster.length - 1]!;
                      const isOn = cluster.some((person) => person.movement.id === selected);
                      return (
                        <button
                          key={longest.movement.id}
                          type="button"
                          className={cx(styles.mark, cluster.length > 1 && styles.markCluster)}
                          style={{ left: `calc(11px + (100% - 22px) * ${lanePosition(longest.wait) / 100})` }}
                          data-dim={cluster.every((person) => personDim(person, highlight)) ? "true" : undefined}
                          aria-pressed={isOn}
                          aria-label={
                            cluster.length > 1
                              ? `${cluster.length} people, longest ${longest.name}, ${splitDuration(longest.wait)}`
                              : `${longest.name}, ${splitDuration(longest.wait)}, ${longest.stage}`
                          }
                          onClick={() =>
                            setSelected((value) => (value === longest.movement.id ? null : longest.movement.id))
                          }
                        >
                          {cluster.length > 1 ? (
                            <span className={styles.markCount}>{cluster.length}</span>
                          ) : (
                            <StatusGlyph tone={CLOCK_TONE[longest.clock]} size={9} />
                          )}
                        </button>
                      );
                    })
                  : null}
                {phone
                  ? null
                  : row.people.map((person) => (
                      <button
                        key={person.movement.id}
                        type="button"
                        className={styles.mark}
                        style={{ left: `${lanePosition(person.wait)}%` }}
                        data-dim={personDim(person, highlight) ? "true" : undefined}
                        aria-pressed={selected === person.movement.id}
                        aria-label={`${person.name}, ${splitDuration(person.wait)}, ${person.stage}`}
                        onClick={() =>
                          setSelected((value) => (value === person.movement.id ? null : person.movement.id))
                        }
                      >
                        <StatusGlyph tone={CLOCK_TONE[person.clock]} size={9} />
                      </button>
                    ))}
              </span>
              <span className={styles.end}>
                <Longest row={row} />
              </span>
            </div>
          ))}
        </section>
      ))}
      {picked && phone ? (
        <PhoneSheet
          open
          onClose={() => setSelected(null)}
          title={picked.person.name}
          description={
            <>
              <span className={styles.previewUmrn}>{picked.person.umrn}</span> · {picked.row.short}
            </>
          }
          primary={{
            label: `Open ${picked.row.short}`,
            onAction: () => router.push(edHref(picked.row.summary.ed.id)),
          }}
          secondary={{ label: "Patient page", onAction: () => router.push(picked.person.href) }}
          data-testid="ed-index-lane-sheet"
        >
          <EdLaneFacts person={picked.person} />
        </PhoneSheet>
      ) : picked ? (
        <div className={styles.picked} aria-live="polite">
          <EdLanePicked person={picked.person} row={picked.row} />
        </div>
      ) : null}
      <div className={styles.lanesFoot}>
        <Legend accessTarget={accessTarget} />
        <span className={styles.meta}>Dashed line is the {waitLine(accessTarget)} access target</span>
      </div>
    </Card>
  );
}

/**
 * Waiting snapshot (E2, Josh 3 Nov 2026; audit two #120): the rail ranks every department with
 * someone waiting, and a bar opens that ED's preview. The By ED or By service switch is gone: the
 * health service tabs and chips already filter by service.
 */
export function WaitingSnapshot({
  shown,
  onPreview,
  accessTarget,
}: {
  /** The EDs the filters keep: the bars rank only these, so they agree with the cards beside them. */
  shown: EdRow[];
  onPreview: (edId: string) => void;
  accessTarget: number;
}) {
  const edBars = shown
    .filter((row) => row.summary.waiting > 0)
    .sort(
      (a, b) => b.summary.waiting - a.summary.waiting || b.summary.longestWaitMinutes - a.summary.longestWaitMinutes,
    );
  const pool = edBars.map((row) => row.summary.waiting);
  const mean = pool.length ? pool.reduce((sum, n) => sum + n, 0) / pool.length : 0;
  return (
    <Card className={styles.serviceCard} as="section" aria-labelledby="ed-index-by-service">
      <div className={styles.snapHead}>
        <h2 id="ed-index-by-service" className={styles.eyebrow}>
          Waiting by ED
        </h2>
      </div>
      <BarList
        label="Preview an ED"
        rows={edBars.map((row) => ({
          id: row.summary.ed.id,
          label: row.short,
          value: row.summary.waiting,
          display: row.summary.waiting,
          testId: `ed-index-ed-bar-${row.summary.ed.id}`,
        }))}
        mean={mean}
        track
        labelWidth="112px"
        onPick={(id) => onPreview(id)}
      />
      <p className={styles.serviceNote}>Dashed line is the mean of the EDs shown.</p>
      <Legend accessTarget={accessTarget} />
    </Card>
  );
}
