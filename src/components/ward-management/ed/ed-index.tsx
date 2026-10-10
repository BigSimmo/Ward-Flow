"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  GanttChart,
  LayoutGrid,
  List,
  LogIn,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import {
  Button,
  Card,
  CheckingFoot,
  Drawer,
  EmptyState,
  FactGrid,
  GroupHead,
  Hero,
  HeroStat,
  Icon,
  Kbd,
  PhoneListRow,
  PhoneSheet,
  ScrollRow,
  Segmented,
  SrOnly,
  StatusGlyph,
  TextInput,
  buttonClass,
  cx,
  useIsPhone,
} from "@/components/wf";
import {
  ED_HOME_SERVICE_BAND_ORDER,
  edHomeSummaries,
  edWaitingSeries,
  type EdSummary,
} from "@/components/ward-management/ed/ed-home-derivations";
import { RowSpark, RowTrend } from "@/components/ward-management/ed/ed-row-spark";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { HealthService, Movement, MovementStage } from "@/components/ward-management/ward-model";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import { ED_SEVERE_PRESSURE_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import { PageLiveChip, usePageLive } from "@/components/ward-management/ward-page-live";
import { edShortName } from "@/components/ward-management/ward-sites";
import { edHref, patientHref, raiseReferralHref } from "@/components/ward-management/shell/ward-facade";
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
type PhoneView = "list" | "lanes" | "service";
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
  /** Waiting at each 2 hour point over the last 12 hours, the last point now (`edWaitingSeries`). */
  trend: number[];
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

/**
 * Hero highlight chips (v10, five at most). Pressing one keeps the people it names solid in every
 * view and dims the rest by colour. It never hides an ED.
 */
type Highlight = "past" | "severe" | "no-bed" | "held" | "form";
const HIGHLIGHT_MATCH: Record<Highlight, (person: EdPerson) => boolean> = {
  past: (person) => person.clock === "past",
  severe: (person) => person.clock !== "in",
  "no-bed": (person) => NO_BED.includes(person.movement.stage),
  held: (person) => HELD.includes(person.movement.stage),
  form: (person) => Boolean(person.movement.legalForm),
};
function personDim(person: EdPerson, highlight: Highlight | null): boolean {
  return highlight !== null && !HIGHLIGHT_MATCH[highlight](person);
}
function rowHighlighted(row: EdRow, highlight: Highlight | null): boolean {
  return highlight === null || row.people.some(HIGHLIGHT_MATCH[highlight]);
}

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
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [phoneView, setPhoneView] = useState<PhoneView>("list");
  const [phoneFiltersOpen, setPhoneFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const isPhone = useIsPhone();

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
      const trend = edWaitingSeries(movements, summary.ed.id, now);
      // The last point is now: it reads the same open count as the card, by construction.
      trend[trend.length - 1] = summary.waiting;
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
        trend,
      };
    });
  }, [movements, patients, referrals, units, now, accessTarget]);

  // Statewide hero counts.
  const total = (pick: (row: EdRow) => number) => rows.reduce((sum, row) => sum + pick(row), 0);
  const waiting = total((row) => row.summary.waiting);
  const withWaiting = rows.filter((row) => row.summary.waiting > 0);
  const longestRow = [...rows].sort((a, b) => b.summary.longestWaitMinutes - a.summary.longestWaitMinutes)[0];
  const longest = longestRow?.summary.longestWaitMinutes ?? 0;

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
  const matchesFilters = (row: EdRow) => byService(row) && byStatus(row) && matchesQuery(row);

  // v10 rule 5: filters and hero chips highlight and dim. Every ED stays in place in every view.
  const matching = rows.filter(matchesFilters);
  const isDim = (row: EdRow) => !matchesFilters(row) || !rowHighlighted(row, highlight);
  const serviceRank = (row: EdRow) => ED_HOME_SERVICE_BAND_ORDER.indexOf(row.summary.service);
  const ordered = [...rows].sort((a, b) => {
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

  // Each service count applies the other active filters, so it matches the EDs that option keeps solid.
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

  const chips: { id: Highlight; value: number; label: string; tone?: "danger" | "warning"; word: string }[] = [
    {
      id: "past",
      value: total((row) => row.pastTarget),
      label: `Past ${waitLine(accessTarget)}`,
      tone: "danger",
      word: `past ${waitLine(accessTarget)}`,
    },
    {
      id: "severe",
      value: total((row) => row.severe),
      label: `Over ${waitLine(ED_SEVERE_PRESSURE_WAIT_MINUTES)}`,
      tone: "warning",
      word: `over ${waitLine(ED_SEVERE_PRESSURE_WAIT_MINUTES)}`,
    },
    { id: "no-bed", value: total((row) => row.noBed), label: "No bed yet", word: "with no bed yet" },
    { id: "held", value: total((row) => row.held), label: "Bed held", word: "with a bed held" },
    { id: "form", value: total((row) => row.forms), label: "Under a form", word: "under a form" },
  ];
  const activeChip = chips.find((chip) => chip.id === highlight);
  const highlightedEds = highlight ? withWaiting.filter((row) => rowHighlighted(row, highlight)).length : 0;

  // ED preview (v10): one side sheet on desktop and tablet, a bottom sheet on phone, with Enter pinned.
  const previewRow = previewId ? (rows.find((row) => row.summary.ed.id === previewId) ?? null) : null;
  const stepPreview = (delta: number) => {
    const index = ordered.findIndex((row) => row.summary.ed.id === previewId);
    const next = ordered[(index + delta + ordered.length) % ordered.length];
    if (next) setPreviewId(next.summary.ed.id);
  };
  const pickService = (id: HealthService) => setService((value) => (value === id ? "all" : id));

  const statusControl = (
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
  );
  const orderControl = (
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
  );
  const matchCount = (
    <span data-testid="ed-index-match-count" aria-live="polite">
      <b className={styles.num}>{matching.length}</b> of {rows.length} <SrOnly>synthetic records</SrOnly> match
    </span>
  );
  const servicePicker = (
    <ServicePicker services={services} rows={rows} value={service} onPick={pickService} accessTarget={accessTarget} />
  );

  return (
    <div className={styles.screen} data-testid="ward-ed-index" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <Hero
          eyebrow={`Emergency · Statewide · ${rows.length} departments`}
          level={1}
          title={
            <>
              <SrOnly>All emergency departments, </SrOnly>
              {waiting} waiting in {withWaiting.length} EDs
            </>
          }
          aside={<PageLiveChip paused={paused} onTogglePause={togglePause} />}
          bar={
            <div className={styles.heroChips} role="group" aria-label="Highlight people waiting">
              {chips.map((chip) => (
                <HeroStat
                  key={chip.id}
                  inline
                  value={chip.value}
                  label={chip.label}
                  tone={chip.tone && chip.value > 0 ? chip.tone : undefined}
                  pressed={highlight === chip.id}
                  onToggle={() => setHighlight((value) => (value === chip.id ? null : chip.id))}
                />
              ))}
            </div>
          }
          barAside={
            activeChip ? (
              <span className={styles.heroNote} aria-live="polite" data-testid="ed-index-highlight-note">
                <span>
                  <b className={styles.heroNum}>{highlightedEds}</b> of {withWaiting.length} EDs
                  <SrOnly> (synthetic records)</SrOnly> have someone {activeChip.word}, all EDs stay
                </span>
                <Button variant="onHero" size="sm" onClick={() => setHighlight(null)}>
                  Clear
                </Button>
              </span>
            ) : null
          }
          foot={
            <CheckingFoot
              items={[
                {
                  id: "longest",
                  label: waiting > 0 && longestRow ? `Longest, ${longestRow.short}` : "Longest",
                  value: waiting > 0 ? splitDuration(longest) : 0,
                },
                { id: "target", label: "Access target", value: waitLine(accessTarget) },
                { id: "severe", label: "Severe line", value: waitLine(ED_SEVERE_PRESSURE_WAIT_MINUTES) },
              ]}
              notChecked={["referrals, open movements only"]}
            />
          }
          footAside={<span>Lists update once a minute</span>}
        />

        <section className={styles.filters} aria-label="Emergency department filters">
          <div className={styles.filterRow}>
            {isPhone ? null : (
              <Segmented label="Health service" items={serviceItems} value={service} onChange={setService} size="md" />
            )}
            <TextInput
              ref={searchRef}
              type="search"
              id="edSearchInput"
              icon={Search}
              placeholder="ED, hospital or service"
              aria-label="Highlight emergency departments by keyword"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onClear={() => setQuery("")}
              trailing={query || isPhone ? undefined : <Kbd>/</Kbd>}
              autoComplete="off"
              spellCheck={false}
              boxClassName={styles.search}
            />
            {isPhone ? (
              <ScrollRow className={styles.phoneServices}>
                <Segmented
                  label="Health service"
                  items={serviceItems}
                  value={service}
                  onChange={setService}
                  size="md"
                />
              </ScrollRow>
            ) : null}
            {isPhone ? (
              <div className={styles.phoneViewRow}>
                <Segmented
                  label="Show"
                  items={[
                    { id: "list" as PhoneView, label: "EDs" },
                    { id: "lanes" as PhoneView, label: "Wait lanes" },
                    { id: "service" as PhoneView, label: "By service" },
                  ]}
                  value={phoneView}
                  onChange={setPhoneView}
                  size="md"
                />
                <Button
                  variant="sec"
                  iconOnly
                  icon={SlidersHorizontal}
                  aria-label={`Status and order${status !== "all" ? ", status filtered" : ""}`}
                  aria-haspopup="dialog"
                  onClick={() => setPhoneFiltersOpen(true)}
                  data-testid="ed-index-phone-filters"
                />
              </div>
            ) : (
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
            )}
          </div>
          <div className={styles.filterRow}>
            {isPhone ? null : (
              <>
                <span className={styles.filterLabel}>Status</span>
                {statusControl}
                <span className={styles.filterLabel}>Order</span>
                {orderControl}
              </>
            )}
            <span className={styles.shownCount}>
              <span className={styles.filterHint}>Filters and chips highlight, all EDs stay</span>
              {isFiltered ? (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Reset filters
                </Button>
              ) : null}
              {matchCount}
            </span>
          </div>
        </section>

        {matching.length === 0 ? (
          <Card className={styles.emptyCard}>
            <EmptyState
              icon={Search}
              title="No match"
              meta={`No ED matches these filters. All ${rows.length} stay below, dimmed.`}
              action={
                <Button variant="sec" size="sm" onClick={resetFilters}>
                  Reset filters
                </Button>
              }
            />
          </Card>
        ) : null}

        {isPhone ? (
          phoneView === "lanes" ? (
            <EdLanes
              rows={ordered}
              services={services}
              accessTarget={accessTarget}
              isDim={isDim}
              highlight={highlight}
              phone
            />
          ) : phoneView === "service" ? (
            servicePicker
          ) : (
            <PhoneEdList rows={ordered} isDim={isDim} highlight={highlight} onPreview={setPreviewId} />
          )
        ) : view === "table" ? (
          <EdTable rows={ordered} isDim={isDim} highlight={highlight} onPreview={setPreviewId} />
        ) : view === "lanes" ? (
          <EdLanes rows={ordered} services={services} accessTarget={accessTarget} isDim={isDim} highlight={highlight} />
        ) : (
          <section className={styles.cardGrid} aria-label="Emergency department cards">
            {ordered.map((row) => (
              <EdCard
                key={row.summary.ed.id}
                row={row}
                dim={isDim(row)}
                highlight={highlight}
                onPreview={() => setPreviewId(row.summary.ed.id)}
              />
            ))}
            {servicePicker}
          </section>
        )}

        <Drawer
          open={previewRow !== null}
          onClose={() => setPreviewId(null)}
          title={previewRow ? previewRow.short : "ED preview"}
          description={previewRow ? `${previewRow.summary.siteName} · ${previewRow.summary.service}` : undefined}
          headerActions={
            isPhone || ordered.length < 2 ? undefined : (
              <span className={styles.previewSteps}>
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={ChevronLeft}
                  aria-label="Previous ED"
                  onClick={() => stepPreview(-1)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  icon={ChevronRight}
                  aria-label="Next ED"
                  onClick={() => stepPreview(1)}
                />
              </span>
            )
          }
          footer={
            previewRow ? (
              <div className={styles.previewFoot}>
                <Link
                  className={buttonClass({ variant: "sec" })}
                  href={raiseReferralHref({ source: "ed_medical", originEdId: previewRow.summary.ed.id })}
                >
                  Raise referral
                </Link>
                <Link
                  className={buttonClass({ variant: "pri" })}
                  href={edHref(previewRow.summary.ed.id)}
                  data-testid="ed-index-preview-enter"
                >
                  <Icon icon={LogIn} size={16} />
                  Enter {previewRow.short}
                </Link>
              </div>
            ) : null
          }
          testId="ed-index-preview"
        >
          {previewRow ? <EdPreview row={previewRow} highlight={highlight} accessTarget={accessTarget} /> : null}
        </Drawer>

        {isPhone ? (
          <PhoneSheet
            open={phoneFiltersOpen}
            onClose={() => setPhoneFiltersOpen(false)}
            title="Status and order"
            description={matchCount}
            primary={{ label: "Done", onAction: () => setPhoneFiltersOpen(false) }}
            secondary={isFiltered ? { label: "Reset filters", onAction: resetFilters } : undefined}
            data-testid="ed-index-phone-filter-sheet"
          >
            <div className={styles.sheetControls}>
              <span className={styles.filterLabel}>Status</span>
              <ScrollRow>{statusControl}</ScrollRow>
              <span className={styles.filterLabel}>Order</span>
              <ScrollRow>{orderControl}</ScrollRow>
            </div>
          </PhoneSheet>
        ) : null}

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
function PeoplePips({ row, highlight }: { row: EdRow; highlight: Highlight | null }) {
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
          data-dim={personDim(person, highlight) ? "true" : undefined}
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
  row,
  dim,
  highlight,
  onPreview,
}: {
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
      <div className={styles.cardHead}>
        <h3 className={styles.edTitle} title={summary.ed.name}>
          {row.short}
        </h3>
        <span className={styles.service}>{summary.service}</span>
      </div>
      <div className={styles.siteRow}>
        <p className={styles.meta} title={summary.siteName}>
          {summary.siteName}
        </p>
        <RowTrend values={row.trend} name={row.short} />
      </div>
      <PeoplePips row={row} highlight={highlight} />
      <p className={styles.figures}>
        <b className={styles.num}>{summary.waiting}</b> waiting <span aria-hidden="true">·</span>{" "}
        <b className={styles.num}>{row.noBed}</b> no bed <span aria-hidden="true">·</span>{" "}
        <b className={styles.num}>{row.held}</b> held <span aria-hidden="true">·</span>{" "}
        <b className={styles.num}>{row.forms}</b> form
      </p>
      <div className={styles.cardFoot}>
        <Longest row={row} />
        {summary.waiting > 0 ? <span className={styles.footLabel}>longest</span> : null}
        <span className={styles.footActions}>
          <PreviewButton row={row} onPreview={onPreview} />
          <EnterLink row={row} />
        </span>
      </div>
    </article>
  );
}

const TABLE_COLUMNS = "minmax(170px, 1.4fr) minmax(200px, 2fr) 96px 72px 60px 72px 60px 96px 112px";

function EdTable({
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
            <span role="columnheader">Last 12h</span>
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
                <RowTrend values={row.trend} name={row.short} />
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
function EdLanes({
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
                {row.people.map((person) => (
                  <button
                    key={person.movement.id}
                    type="button"
                    className={styles.mark}
                    style={{ left: `${lanePosition(person.wait)}%` }}
                    data-dim={personDim(person, highlight) ? "true" : undefined}
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
      {picked && phone ? (
        <PhoneSheet
          open
          onClose={() => setSelected(null)}
          title={picked.person.name}
          description={`${picked.row.short} · ${picked.person.stage}`}
          primary={{
            label: `Enter ${picked.row.short}`,
            onAction: () => router.push(edHref(picked.row.summary.ed.id)),
          }}
          secondary={{ label: "Open patient", onAction: () => router.push(picked.person.href) }}
          data-testid="ed-index-lane-sheet"
        >
          <FactGrid
            facts={[
              {
                id: "wait",
                label: "Waiting",
                value: <b className={styles.num}>{splitDuration(picked.person.wait)}</b>,
              },
              { id: "tier", label: "Tier", value: `T${picked.person.movement.urgency}` },
              {
                id: "form",
                label: "Form",
                value: picked.person.movement.legalForm ? picked.person.movement.legalForm.code : "None recorded",
              },
              { id: "dest", label: "Bed", value: picked.person.destination ?? "No bed yet" },
            ]}
          />
        </PhoneSheet>
      ) : picked ? (
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

/**
 * Waiting by service (v10): the bars are the service filter. Pressing a bar keeps that service's
 * EDs solid and dims the rest (the same as the service tabs); pressing it again clears it. Page-local
 * until the shared `BarList` takes an `onPick`.
 */
function ServicePicker({
  services,
  rows,
  value,
  onPick,
  accessTarget,
}: {
  services: readonly HealthService[];
  rows: EdRow[];
  value: ServiceFilter;
  onPick: (service: HealthService) => void;
  accessTarget: number;
}) {
  const bars = services.map((name) => ({
    name,
    waiting: rows.filter((row) => row.summary.service === name).reduce((sum, row) => sum + row.summary.waiting, 0),
  }));
  const max = Math.max(1, ...bars.map((bar) => bar.waiting));
  const mean = bars.length ? bars.reduce((sum, bar) => sum + bar.waiting, 0) / bars.length : 0;
  return (
    <Card className={styles.serviceCard} as="section" aria-labelledby="ed-index-by-service">
      <h3 id="ed-index-by-service" className={styles.eyebrow}>
        Waiting by service
      </h3>
      <div className={styles.serviceBars} role="group" aria-label="Highlight a health service">
        <span className={styles.serviceMean} style={{ "--ed-mean": mean / max } as CSSProperties} aria-hidden="true" />
        {bars.map((bar) => (
          <button
            key={bar.name}
            type="button"
            className={styles.serviceBar}
            aria-pressed={value === bar.name}
            data-dim={value !== "all" && value !== bar.name ? "true" : undefined}
            onClick={() => onPick(bar.name)}
            data-testid={`ed-index-service-bar-${bar.name}`}
          >
            <span className={styles.serviceName}>{bar.name}</span>
            <span className={styles.serviceTrack} aria-hidden="true">
              {bar.waiting > 0 ? (
                <span className={styles.serviceFill} style={{ width: `${(bar.waiting / max) * 100}%` }} />
              ) : null}
            </span>
            <span className={styles.num}>{bar.waiting}</span>
          </button>
        ))}
      </div>
      <p className={styles.serviceNote}>
        Dashed line is the mean, <b className={styles.num}>{Number(mean.toFixed(1))}</b>. Press a service to highlight
        it.
      </p>
      <Legend accessTarget={accessTarget} />
    </Card>
  );
}

/** Phone: EDs as a priority list, longest wait first, with clear EDs grouped last. A row opens the preview. */
function PhoneEdList({
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
  const waitingRows = rows.filter((row) => row.summary.waiting > 0);
  const clearRows = rows.filter((row) => row.summary.waiting === 0);
  const row = (item: EdRow) => {
    const clock = rowClock(item);
    return (
      <div key={item.summary.ed.id} data-dim={isDim(item) ? "true" : undefined}>
        <PhoneListRow
          name={item.short}
          meta={
            item.summary.waiting > 0 ? (
              <span className={styles.phoneMeta}>
                <PeoplePips row={item} highlight={highlight} />
                <span>
                  {item.noBed} no bed · {item.held} held · {item.forms} form
                </span>
              </span>
            ) : (
              item.summary.service
            )
          }
          value={
            item.summary.waiting > 0 ? (
              <span className={styles.longest}>
                {clock !== "in" ? <StatusGlyph tone={CLOCK_TONE[clock]} size={9} /> : null}
                {splitDuration(item.summary.longestWaitMinutes)}
              </span>
            ) : (
              "Clear"
            )
          }
          time={item.summary.waiting > 0 ? `${item.summary.waiting} waiting` : undefined}
          onSelect={() => onPreview(item.summary.ed.id)}
          aria-label={`${item.short}, ${item.summary.waiting > 0 ? `${item.summary.waiting} waiting, longest ${splitDuration(item.summary.longestWaitMinutes)}` : "clear"}. Opens a preview.`}
          data-testid={`ed-index-phone-row-${item.summary.ed.id}`}
        />
      </div>
    );
  };
  return (
    <Card className={styles.phoneList} as="section" aria-label="Emergency departments">
      <GroupHead title="Waiting, longest first" count={waitingRows.length} />
      {waitingRows.map(row)}
      {clearRows.length > 0 ? (
        <>
          <GroupHead title="Clear" count={clearRows.length} />
          {clearRows.map(row)}
        </>
      ) : null}
    </Card>
  );
}

/** The ED preview's body: facts, the 12 hour trend and who is waiting, longest first. */
function EdPreview({
  row,
  highlight,
  accessTarget,
}: {
  row: EdRow;
  highlight: Highlight | null;
  accessTarget: number;
}) {
  return (
    <div className={styles.preview} data-testid="ed-index-preview-body">
      <FactGrid
        facts={[
          { id: "waiting", label: "Waiting", value: <b className={styles.num}>{row.summary.waiting}</b> },
          {
            id: "past",
            label: `Past ${waitLine(accessTarget)}`,
            value: <b className={styles.num}>{row.pastTarget}</b>,
          },
          { id: "no-bed", label: "No bed yet", value: <b className={styles.num}>{row.noBed}</b> },
          { id: "form", label: "Under a form", value: <b className={styles.num}>{row.forms}</b> },
        ]}
      />
      <section className={styles.previewSection} aria-labelledby="ed-preview-trend">
        <h3 id="ed-preview-trend" className={styles.eyebrow}>
          Last 12 hours
        </h3>
        <div className={styles.previewTrend}>
          <RowSpark values={row.trend} name={row.short} big />
          <span className={styles.meta}>{row.trend.join(" · ")} now · every 2h</span>
        </div>
      </section>
      <section className={styles.previewSection} aria-labelledby="ed-preview-people">
        <h3 id="ed-preview-people" className={styles.eyebrow}>
          Waiting, longest first
        </h3>
        {row.people.length === 0 ? (
          <p className={styles.previewEmpty}>
            <StatusGlyph tone="success" size={9} /> No one waiting at {row.short}
          </p>
        ) : (
          <ul className={styles.previewList}>
            {row.people.map((person) => (
              <li
                key={person.movement.id}
                className={styles.previewPerson}
                data-act-now={person.clock === "past" ? "true" : undefined}
                data-dim={personDim(person, highlight) ? "true" : undefined}
              >
                <StatusGlyph tone={CLOCK_TONE[person.clock]} size={9} />
                <span className={styles.previewText}>
                  <Link href={person.href} className={styles.previewName}>
                    {person.name}
                  </Link>
                  <span className={styles.meta}>
                    {person.stage}
                    {person.movement.legalForm ? ` · Form ${person.movement.legalForm.code}` : ""}
                    {person.destination ? ` · ${person.destination}` : ""}
                  </span>
                </span>
                <b className={styles.num}>{splitDuration(person.wait)}</b>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
