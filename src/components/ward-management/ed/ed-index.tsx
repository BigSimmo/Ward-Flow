"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { GanttChart, LayoutGrid, List, Search } from "lucide-react";

import {
  BarList,
  Button,
  Card,
  EmptyState,
  Hero,
  HeroStat,
  Icon,
  Kbd,
  Segmented,
  SrOnly,
  StatusGlyph,
  TextInput,
  buttonClass,
  cx,
} from "@/components/wf";
import {
  ED_HOME_SERVICE_BAND_ORDER,
  edHomeSummaries,
  type EdSummary,
} from "@/components/ward-management/ed/ed-home-derivations";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { HealthService, Movement, MovementStage } from "@/components/ward-management/ward-model";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import { ED_SEVERE_PRESSURE_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { PageLiveChip, usePageLive } from "@/components/ward-management/ward-page-live";
import { edShortName } from "@/components/ward-management/ward-sites";
import { edHref, patientHref } from "@/components/ward-management/shell/ward-facade";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import styles from "./ed-index.module.css";

/**
 * All emergency departments (8 Oct 2026, the "A Cards" mockup plus its wait lanes). One hero band
 * with the statewide counts, one filter card, then every ED as a card, a table row or a wait lane.
 * The population is the same as the single-ED page and Home's pressure card: open movements from
 * each department (`edHomeSummaries`), never referrals. A wait is past target at the configured ED
 * access target and over the severe line at `ED_SEVERE_PRESSURE_WAIT_MINUTES`, the two lines Home's
 * ED pressure card already draws.
 */

type ServiceFilter = "all" | HealthService;
type StatusFilter = "all" | "past-target" | "waiting" | "clear";
type OrderBy = "longest" | "most" | "service";
type ViewMode = "cards" | "table" | "lanes";
type WaitClock = "past" | "severe" | "in";

type EdPerson = {
  movement: Movement;
  name: string;
  href: string;
  wait: number;
  clock: WaitClock;
  stage: string;
  destination?: string;
};

type EdRow = {
  summary: EdSummary;
  short: string;
  people: EdPerson[];
  pastTarget: number;
  /** Everyone at or over the 8h line, past-target people included. */
  severe: number;
  noBed: number;
  held: number;
  leaving: number;
  forms: number;
};

const STAGE_LABEL: Record<MovementStage, string> = {
  placement_requested: "No bed yet",
  destination_review: "Finding a ward",
  accepted_awaiting_bed: "Bed accepted",
  pulled: "Bed pulled",
  handover_ready: "Handover ready",
  moving: "In transit",
  arrived: "Arrived",
};
const NO_BED: readonly MovementStage[] = ["placement_requested", "destination_review"];
const HELD: readonly MovementStage[] = ["accepted_awaiting_bed", "pulled"];
const LEAVING: readonly MovementStage[] = ["handover_ready", "moving"];

const CLOCK_TONE = { past: "danger", severe: "warning", in: "neutral" } as const;
const PIPS_SHOWN = 12;

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

/** "24h", "8h": the two wait lines as a person says them, never "1d" or "8h 00m". */
function waitLine(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : splitDuration(minutes);
}

function serviceShortName(service: HealthService): string {
  return service.replace(/ Metro$/u, "");
}

function rowClock(row: EdRow): WaitClock {
  return row.pastTarget > 0 ? "past" : row.severe > 0 ? "severe" : "in";
}

export function EdIndex() {
  const { movements, patients, referrals, units, configuration } = useWardFlow();
  const { now, paused, togglePause } = usePageLive();
  const accessTarget = configuration.edAccessTargetMinutes;

  const [service, setService] = useState<ServiceFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [order, setOrder] = useState<OrderBy>("longest");
  const [view, setView] = useState<ViewMode>("cards");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const rows: EdRow[] = useMemo(() => {
    // D-14: names come through the shared resolver, the same one the ED board uses.
    const resolve = createPatientResolver({ patients, referrals, movements });
    return edHomeSummaries(movements, now, accessTarget).map((summary) => {
      const people = summary.open
        .map((movement): EdPerson => {
          const wait = Math.max(0, now - movement.openedAt);
          const destination = movement.acceptedUnitId
            ? units.find((unit) => unit.id === movement.acceptedUnitId)?.name
            : undefined;
          const person = resolve(movement).patient;
          return {
            movement,
            name: person ? `${person.familyName}, ${person.givenName}` : movement.id,
            href: patientHref(person?.id ?? movement.id),
            wait,
            clock: wait >= accessTarget ? "past" : wait >= ED_SEVERE_PRESSURE_WAIT_MINUTES ? "severe" : "in",
            stage: STAGE_LABEL[movement.stage],
            destination,
          };
        })
        .sort((a, b) => b.wait - a.wait);
      const inStages = (stages: readonly MovementStage[]) =>
        people.filter((person) => stages.includes(person.movement.stage)).length;
      return {
        summary,
        short: edShortName(summary.ed),
        people,
        pastTarget: summary.pastAccessTarget,
        severe: people.filter((person) => person.clock !== "in").length,
        noBed: inStages(NO_BED),
        held: inStages(HELD),
        leaving: inStages(LEAVING),
        forms: people.filter((person) => person.movement.legalForm).length,
      };
    });
  }, [movements, patients, referrals, units, now, accessTarget]);

  // Statewide hero counts.
  const total = (pick: (row: EdRow) => number) => rows.reduce((sum, row) => sum + pick(row), 0);
  const waiting = total((row) => row.summary.waiting);
  const longest = Math.max(0, ...rows.map((row) => row.summary.longestWaitMinutes));

  const matchesQuery = (row: EdRow) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [row.short, row.summary.ed.name, row.summary.siteName, row.summary.service].some((text) =>
      text.toLowerCase().includes(q),
    );
  };
  const byService = (row: EdRow) => service === "all" || row.summary.service === service;
  const byStatus = (row: EdRow) =>
    status === "all" ||
    (status === "past-target" && row.pastTarget > 0) ||
    (status === "waiting" && row.summary.waiting > 0) ||
    (status === "clear" && row.summary.waiting === 0);

  const filtered = rows.filter((row) => byService(row) && byStatus(row) && matchesQuery(row));
  const serviceRank = (row: EdRow) => ED_HOME_SERVICE_BAND_ORDER.indexOf(row.summary.service);
  const ordered = [...filtered].sort((a, b) => {
    if (order === "most") return b.summary.waiting - a.summary.waiting || serviceRank(a) - serviceRank(b);
    if (order === "service")
      return serviceRank(a) - serviceRank(b) || b.summary.longestWaitMinutes - a.summary.longestWaitMinutes;
    return b.summary.longestWaitMinutes - a.summary.longestWaitMinutes || serviceRank(a) - serviceRank(b);
  });

  const isFiltered = service !== "all" || status !== "all" || query !== "";
  const resetFilters = () => {
    setService("all");
    setStatus("all");
    setQuery("");
  };

  // Each service count applies the other active filters, so it matches the rows that option shows.
  const otherFilters = (row: EdRow) => byStatus(row) && matchesQuery(row);
  const services = ED_HOME_SERVICE_BAND_ORDER.filter((name) => rows.some((row) => row.summary.service === name));
  const serviceItems = [
    { id: "all" as ServiceFilter, label: "All", count: rows.filter(otherFilters).length },
    ...services.map((name) => ({
      id: name as ServiceFilter,
      label: serviceShortName(name),
      count: rows.filter((row) => row.summary.service === name && otherFilters(row)).length,
    })),
  ];

  const serviceBars = services.map((name) => {
    const value = rows.filter((row) => row.summary.service === name).reduce((sum, row) => sum + row.summary.waiting, 0);
    return { id: name, label: name, value, display: String(value), fill: "data-1" as const };
  });

  return (
    <div className={styles.screen} data-testid="ward-ed-index" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <Hero
          eyebrow="Emergency · Statewide"
          level={1}
          title={
            <>
              <SrOnly>All emergency departments, </SrOnly>
              {rows.length} EDs, {waiting} waiting
            </>
          }
          stats={
            <>
              <HeroStat
                value={total((row) => row.pastTarget)}
                label={`Past ${waitLine(accessTarget)}`}
                tone={total((row) => row.pastTarget) > 0 ? "danger" : undefined}
              />
              <HeroStat
                value={total((row) => row.severe)}
                label={`Over ${waitLine(ED_SEVERE_PRESSURE_WAIT_MINUTES)}`}
                tone={total((row) => row.severe) > 0 ? "warning" : undefined}
              />
              <HeroStat value={total((row) => row.noBed)} label="No bed yet" />
              <HeroStat value={total((row) => row.held)} label="Bed held" />
              <HeroStat value={total((row) => row.forms)} label="Under a form" />
              <HeroStat value={waiting > 0 ? splitDuration(longest) : "None"} label="Longest" />
            </>
          }
          aside={<PageLiveChip paused={paused} onTogglePause={togglePause} />}
        />

        <section className={styles.filters} aria-label="Emergency department filters">
          <div className={styles.filterRow}>
            <Segmented label="Health service" items={serviceItems} value={service} onChange={setService} size="md" />
            <TextInput
              ref={searchRef}
              type="search"
              id="edSearchInput"
              icon={Search}
              placeholder="ED, hospital or service"
              aria-label="Filter emergency departments by keyword"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onClear={() => setQuery("")}
              trailing={query ? undefined : <Kbd>/</Kbd>}
              autoComplete="off"
              spellCheck={false}
              boxClassName={styles.search}
            />
            <Segmented
              label="View"
              items={[
                { id: "cards" as ViewMode, label: <ViewLabel icon={LayoutGrid} text="Cards" /> },
                { id: "table" as ViewMode, label: <ViewLabel icon={List} text="Table" /> },
                { id: "lanes" as ViewMode, label: <ViewLabel icon={GanttChart} text="Lanes" /> },
              ]}
              value={view}
              onChange={setView}
              size="md"
            />
          </div>
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>Status</span>
            <Segmented
              label="Status"
              items={[
                { id: "all" as StatusFilter, label: "All" },
                { id: "past-target" as StatusFilter, label: "Past target" },
                { id: "waiting" as StatusFilter, label: "Has waiting" },
                { id: "clear" as StatusFilter, label: "Clear" },
              ]}
              value={status}
              onChange={setStatus}
            />
            <span className={styles.filterLabel}>Order</span>
            <Segmented
              label="Order"
              items={[
                { id: "longest" as OrderBy, label: "Longest wait" },
                { id: "most" as OrderBy, label: "Most waiting" },
                { id: "service" as OrderBy, label: "Service" },
              ]}
              value={order}
              onChange={setOrder}
            />
            <span className={styles.shownCount}>
              {isFiltered ? (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Reset filters
                </Button>
              ) : null}
              <span>
                {filtered.length} of {rows.length}
              </span>
            </span>
          </div>
        </section>

        {ordered.length === 0 ? (
          <Card className={styles.emptyCard}>
            <EmptyState
              icon={Search}
              title="No EDs match"
              meta={`${rows.length} emergency departments in the network`}
              action={
                <Button variant="sec" size="sm" onClick={resetFilters}>
                  Reset filters
                </Button>
              }
            />
          </Card>
        ) : view === "table" ? (
          <EdTable rows={ordered} />
        ) : view === "lanes" ? (
          <EdLanes rows={ordered} services={services} accessTarget={accessTarget} />
        ) : (
          <section className={styles.cardGrid} aria-label="Emergency department cards">
            {ordered.map((row) => (
              <EdCard key={row.summary.ed.id} row={row} />
            ))}
            <Card className={styles.serviceCard} as="section" aria-labelledby="ed-index-by-service">
              <h3 id="ed-index-by-service" className={styles.eyebrow}>
                Waiting by service
              </h3>
              <BarList
                label="Waiting by service"
                rows={serviceBars}
                max={Math.max(1, ...serviceBars.map((bar) => bar.value))}
                track
                labelWidth="88px"
              />
              <Legend accessTarget={accessTarget} />
            </Card>
          </section>
        )}

        <WardPrototypeFooter
          testId="ed-index-governance"
          note="Synthetic prototype. Invented figures under real WA hospital names. Lists update once a minute."
        />
      </main>
    </div>
  );
}

function ViewLabel({ icon, text }: { icon: typeof List; text: string }) {
  return (
    <span className={styles.viewLabel}>
      <Icon icon={icon} size={14} />
      {text}
    </span>
  );
}

function Legend({ accessTarget }: { accessTarget: number }) {
  return (
    <p className={styles.legend}>
      <span>
        <StatusGlyph tone="danger" size={9} /> Past {waitLine(accessTarget)}
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

/** One pip per person waiting, longest first, shaped by how long they have waited. */
function PeoplePips({ row }: { row: EdRow }) {
  if (row.people.length === 0) return <p className={styles.noneWaiting}>No one waiting</p>;
  const shown = row.people.slice(0, PIPS_SHOWN);
  return (
    <div
      className={styles.pips}
      role="img"
      aria-label={`${row.summary.waiting} waiting: ${row.pastTarget} past target, ${row.severe} over ${waitLine(ED_SEVERE_PRESSURE_WAIT_MINUTES)}`}
    >
      {shown.map((person) => (
        <span
          key={person.movement.id}
          className={styles.pip}
          title={`${person.name} · ${splitDuration(person.wait)} · ${person.stage}`}
        >
          <StatusGlyph tone={CLOCK_TONE[person.clock]} size={8} />
        </span>
      ))}
      {row.people.length > PIPS_SHOWN ? <span className={styles.more}>+{row.people.length - PIPS_SHOWN}</span> : null}
    </div>
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
      aria-label={`Enter ${row.short}`}
    >
      Enter
    </Link>
  );
}

function EdCard({ row }: { row: EdRow }) {
  const { summary } = row;
  return (
    <article className={styles.edCard} data-service={summary.service} data-past-target={row.pastTarget > 0}>
      <div className={styles.cardHead}>
        <h3 className={styles.edTitle} title={summary.ed.name}>
          {row.short}
        </h3>
        <span className={styles.service}>{summary.service}</span>
      </div>
      <p className={styles.meta} title={summary.siteName}>
        {summary.siteName}
      </p>
      <PeoplePips row={row} />
      <p className={styles.figures}>
        <b className={styles.num}>{summary.waiting}</b> waiting <span aria-hidden="true">·</span>{" "}
        <b className={styles.num}>{row.noBed}</b> no bed <span aria-hidden="true">·</span>{" "}
        <b className={styles.num}>{row.held}</b> held <span aria-hidden="true">·</span>{" "}
        <b className={styles.num}>{row.forms}</b> form
      </p>
      <div className={styles.cardFoot}>
        <Longest row={row} />
        {summary.waiting > 0 ? <span className={styles.footLabel}>longest</span> : null}
        <EnterLink row={row} />
      </div>
    </article>
  );
}

const TABLE_COLUMNS = "minmax(170px, 1.4fr) minmax(200px, 2fr) 72px 60px 72px 60px 96px 76px";

function EdTable({ rows }: { rows: EdRow[] }) {
  return (
    <Card className={styles.tableCard} as="section" aria-label="Emergency department table">
      <div role="table" aria-label="Emergency departments" className={styles.table}>
        <div role="rowgroup">
          <div role="row" className={cx(styles.tr, styles.th)} style={{ gridTemplateColumns: TABLE_COLUMNS }}>
            <span role="columnheader">Department</span>
            <span role="columnheader">Waiting, longest first</span>
            <span role="columnheader" className={styles.end}>
              No bed
            </span>
            <span role="columnheader" className={styles.end}>
              Held
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
            >
              <span role="cell" className={styles.edCell}>
                <span className={styles.edTitle}>{row.short}</span>
                <span className={styles.meta}>{row.summary.service}</span>
              </span>
              <span role="cell">
                <PeoplePips row={row} />
              </span>
              {[row.noBed, row.held, row.leaving, row.forms].map((value, index) => (
                <span role="cell" key={index} className={cx(styles.end, styles.num, value === 0 && styles.zero)}>
                  {value}
                </span>
              ))}
              <span role="cell" className={styles.end}>
                <Longest row={row} />
              </span>
              <span role="cell" className={styles.end}>
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
function EdLanes({
  rows,
  services,
  accessTarget,
}: {
  rows: EdRow[];
  services: readonly HealthService[];
  accessTarget: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);
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
            <span key={label} className={styles.tick} style={{ left: `${lanePosition(minutes)}%` }}>
              {label}
            </span>
          ))}
        </span>
        <span className={styles.end}>Longest</span>
      </div>
      {groups.map((group) => (
        <section key={group.name} aria-label={group.name} className={styles.laneGroup}>
          <h3 className={styles.eyebrow}>{group.name}</h3>
          {group.rows.map((row) => (
            <div key={row.summary.ed.id} className={styles.lane}>
              <Link href={edHref(row.summary.ed.id)} className={styles.laneLabel}>
                <b>{row.short}</b>
                <span className={styles.laneCount}>{row.summary.waiting}</span>
              </Link>
              <span className={cx(styles.track, styles.laneTrack)}>
                {LANE_TICKS.map(([minutes]) => (
                  <span key={minutes} className={styles.gridline} style={{ left: `${lanePosition(minutes)}%` }} />
                ))}
                <span className={styles.target} style={{ left: `${lanePosition(accessTarget)}%` }} />
                {row.people.map((person) => (
                  <button
                    key={person.movement.id}
                    type="button"
                    className={styles.mark}
                    style={{ left: `${lanePosition(person.wait)}%` }}
                    aria-pressed={selected === person.movement.id}
                    aria-label={`${person.name}, ${splitDuration(person.wait)}, ${person.stage}`}
                    onClick={() => setSelected((value) => (value === person.movement.id ? null : person.movement.id))}
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
      {picked ? (
        <div className={styles.picked} aria-live="polite">
          <span className={styles.tier} title={`Tier ${picked.person.movement.urgency}`}>
            {picked.person.movement.urgency}
          </span>
          <b className={styles.pickedName}>{picked.person.name}</b>
          <span className={styles.meta}>
            {picked.row.short} · {picked.person.stage}
            {picked.person.movement.legalForm ? ` · Form ${picked.person.movement.legalForm.code}` : ""}
            {picked.person.destination ? ` · ${picked.person.destination}` : ""}
          </span>
          <span className={styles.longest}>
            {picked.person.clock !== "in" ? <StatusGlyph tone={CLOCK_TONE[picked.person.clock]} size={9} /> : null}
            <b className={styles.num}>{splitDuration(picked.person.wait)}</b>
          </span>
          <span className={styles.pickedActions}>
            <Link className={buttonClass({ variant: "sec", size: "sm" })} href={picked.person.href}>
              Open patient
            </Link>
            <Link className={buttonClass({ variant: "pri", size: "sm" })} href={edHref(picked.row.summary.ed.id)}>
              Open {picked.row.short}
            </Link>
          </span>
        </div>
      ) : null}
      <div className={styles.lanesFoot}>
        <Legend accessTarget={accessTarget} />
        <span className={styles.meta}>Dashed line is the {waitLine(accessTarget)} access target</span>
      </div>
    </Card>
  );
}
