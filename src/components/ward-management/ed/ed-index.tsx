"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, type ComponentProps } from "react";

import { preloadWhenIdle } from "@/components/ward-management/preload-when-idle";
import { Eye, GanttChart, LayoutGrid, List, Search, SlidersHorizontal } from "lucide-react";

import {
  Button,
  Card,
  CheckingFoot,
  Drawer,
  EmptyState,
  GroupHead,
  Hero,
  HeroStat,
  Icon,
  LiveChip,
  PhoneListRow,
  PhoneSheet,
  ScrollRow,
  Segmented,
  SrOnly,
  StatusGlyph,
  buttonClass,
  cx,
  useIsPhone,
  useIsTabletPortrait,
  BarList,
  RowTrend,
} from "@/components/wf";
import {
  ED_HELD_STAGES,
  ED_HOME_SERVICE_BAND_ORDER,
  ED_LEAVING_STAGES,
  ED_STAGE_LABELS,
  edHomeSummaries,
  edWaitingSeries,
} from "@/components/ward-management/ed/ed-home-derivations";
import { splitDuration } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useDeviceChoice } from "@/components/ward-management/shell/use-device-choice";
import type { HealthService, MovementStage } from "@/components/ward-management/ward-model";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model-vocabulary";
import { useAddressTab } from "@/components/ward-management/ward-url-state";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import { ED_SEVERE_PRESSURE_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";

import { PageLiveChip, usePageLive } from "@/components/ward-management/ward-page-live";
import { edShortName } from "@/components/ward-management/ward-sites";
import { edHasNoBedYet } from "@/components/ward-management/ed/ed-no-bed";
import { edHref, patientHref } from "@/components/ward-management/shell/ward-facade";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import {
  CLOCK_TONE,
  personDim,
  rowHighlighted,
  trendSpanHours,
  waitLine,
  type EdPerson,
  type EdRow,
  type Highlight,
  type WaitClock,
} from "./ed-index-parts";
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
const SERVICE_FILTERS: readonly ServiceFilter[] = ["all", ...HEALTH_SERVICES];
const STATUS_FILTERS: readonly StatusFilter[] = ["all", "past-target", "waiting", "clear"];
type OrderBy = "longest" | "most" | "service";
type ViewMode = "cards" | "table" | "lanes";
const ORDERS: readonly OrderBy[] = ["longest", "most", "service"];
const VIEWS: readonly ViewMode[] = ["cards", "table", "lanes"];
// Device audit 11 Oct 2026: By service left the phone; its figures are the service chips.
type PhoneView = "list" | "lanes";

const STAGE_LABEL = ED_STAGE_LABELS;
const HELD = ED_HELD_STAGES;
const LEAVING = ED_LEAVING_STAGES;

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

function serviceShortName(service: HealthService): string {
  return service.replace(/ Metro$/u, "");
}

function rowClock(row: EdRow): WaitClock {
  return row.pastTarget > 0 ? "past" : row.severe > 0 ? "severe" : "in";
}

/**
 * October 2026 design review (Josh, 31 Oct 2026): the title counts every department ("62 waiting
 * across 10 EDs · 8 with someone waiting"), hospital names wrap on the cards instead of ending in
 * "…", and departments with nobody waiting share one line with an Enter button each, rather than a
 * full empty card.
 */
export function EdIndex() {
  const { movements, patients, referrals, units, configuration } = useWardFlowSelect(
    "movements",
    "patients",
    "referrals",
    "units",
    "configuration",
  );
  const { now, paused, togglePause } = usePageLive();
  const accessTarget = configuration.edAccessTargetMinutes;

  // DA-15: the filters live in the address, so a reload or a shared link keeps them.
  const [service, setService] = useAddressTab<ServiceFilter>("service", SERVICE_FILTERS, "all");
  const [status, setStatus] = useAddressTab<StatusFilter>("status", STATUS_FILTERS, "all");
  // Smart features idea 9: the order and layout last chosen on this device, never a filter.
  const [order, setOrder] = useDeviceChoice("ward_flow_choice_ed_index_order", ORDERS, "longest");
  const [view, setView] = useDeviceChoice("ward_flow_choice_ed_index_view", VIEWS, "cards");
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [phoneView, setPhoneView] = useState<PhoneView>("list");
  const [phoneFiltersOpen, setPhoneFiltersOpen] = useState(false);
  const isPhone = useIsPhone();
  const isTabletPortrait = useIsTabletPortrait();

  // D-91: the keyword box over these ~15 EDs went in the search and forms review (Josh, 30 Oct
  // 2026). The header search finds an ED by name or site.

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
          const resolved = resolve(movement);
          const person = resolved.patient;
          return {
            movement,
            name: person ? `${person.familyName}, ${person.givenName}` : movement.id,
            umrn: resolved.umrn,
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
        // S-19: the one "No bed yet" rule the ED board uses.
        noBed: people.filter((person) => edHasNoBedYet(person.movement)).length,
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

  const byService = (row: EdRow) => service === "all" || row.summary.service === service;
  const byStatus = (row: EdRow) =>
    status === "all" ||
    (status === "past-target" && row.pastTarget > 0) ||
    (status === "waiting" && row.summary.waiting > 0) ||
    (status === "clear" && row.summary.waiting === 0);
  const matchesFilters = (row: EdRow) => byService(row) && byStatus(row);

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

  const isFiltered = service !== "all" || status !== "all";
  const resetFilters = () => {
    setService("all");
    setStatus("all");
  };

  // Each service count applies the other active filters, so it matches the EDs that option keeps solid.
  const otherFilters = (row: EdRow) => byStatus(row);
  const services = ED_HOME_SERVICE_BAND_ORDER.filter((name) => rows.some((row) => row.summary.service === name));
  const serviceItems = [
    { id: "all" as ServiceFilter, label: "All EDs", count: rows.filter(otherFilters).length },
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
    { id: "held", value: total((row) => row.held), label: "Accepted", word: "accepted by a ward" },
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
  const pickService = (id: HealthService) => setService(service === id ? "all" : id);

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
      <b className={styles.num}>{matching.length}</b> of {rows.length} EDs match<SrOnly>, sample data</SrOnly>
    </span>
  );
  const servicePicker = (
    <ServicePicker services={services} rows={rows} value={service} onPick={pickService} accessTarget={accessTarget} />
  );

  return (
    <div className={styles.screen} data-testid="ward-ed-index" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <Hero
          // F-09 (phone review, Oct 2026): the phone eyebrow names how many EDs there are, so the "All
          // EDs" count agrees with it; the title counts the EDs with someone waiting.
          eyebrow={
            isPhone
              ? `Emergency · Statewide · ${rows.length} EDs`
              : `Emergency · Statewide · ${rows.length} departments`
          }
          level={1}
          title={
            <>
              <SrOnly>All EDs,</SrOnly> {waiting} waiting across {rows.length} EDs
            </>
          }
          titleMeta={
            // v10 phone: one quiet line under the title in place of the checking foot.
            isPhone
              ? waiting > 0 && longestRow
                ? `Longest ${splitDuration(longest)} at ${longestRow.short} · target ${waitLine(accessTarget)} · ${paused ? "paused" : "updating"}`
                : `No one waiting · target ${waitLine(accessTarget)} · ${paused ? "paused" : "updating"}`
              : `${withWaiting.length} with someone waiting`
          }
          aside={
            isPhone ? (
              <LiveChip state={paused ? "paused" : "live"} age={null} onHero onTogglePause={togglePause} />
            ) : (
              <PageLiveChip paused={paused} onTogglePause={togglePause} />
            )
          }
          stats={
            // v10 phone: the first three highlight figures sit on hairlines, value over label.
            isPhone
              ? chips
                  .slice(0, 3)
                  .map((chip) => (
                    <HeroStat
                      key={chip.id}
                      value={chip.value}
                      label={chip.label}
                      tone={chip.tone && chip.value > 0 ? chip.tone : undefined}
                      pressed={highlight === chip.id}
                      onToggle={() => setHighlight((value) => (value === chip.id ? null : chip.id))}
                    />
                  ))
              : undefined
          }
          bar={
            isPhone ? undefined : (
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
            )
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
            isPhone ? undefined : (
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
            )
          }
          // At tablet portrait the line wrapped onto its own row; the footer note says it too.
          footAside={isPhone || isTabletPortrait ? undefined : <span>Lists update once a minute</span>}
        />

        <section className={styles.filters} aria-label="Emergency department filters">
          <div className={styles.filterRow}>
            {isPhone ? null : (
              <Segmented label="Health service" items={serviceItems} value={service} onChange={setService} size="md" />
            )}
            {isPhone ? (
              // D-91: with the keyword box gone, the status and order button sits at the end of the
              // health service chips, so the view switch below still runs the full width.
              <div className={styles.phoneFilterRow}>
                <ScrollRow className={styles.phoneServices}>
                  <Segmented
                    label="Health service"
                    items={serviceItems}
                    value={service}
                    onChange={setService}
                    size="md"
                  />
                </ScrollRow>
                <Button
                  variant="sec"
                  iconOnly
                  icon={SlidersHorizontal}
                  aria-label={`Status and order${status !== "all" ? ", status filtered" : ""}`}
                  aria-haspopup="dialog"
                  onClick={() => setPhoneFiltersOpen(true)}
                  className={styles.phoneFilterButton}
                  data-testid="ed-index-phone-filters"
                />
              </div>
            ) : null}
            {isPhone ? null : (
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
              {isFiltered ? (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Reset filters
                </Button>
              ) : null}
              {matchCount}
            </span>
          </div>
        </section>

        {/* v10 phone: EDs, Wait lanes and By service stay pinned under the bar while the list
            scrolls, so the switch sits outside the filters block. */}
        {isPhone ? (
          <div className={styles.phoneViewRow}>
            <Segmented
              label="Show"
              items={[
                { id: "list" as PhoneView, label: "EDs" },
                { id: "lanes" as PhoneView, label: "Wait lanes" },
              ]}
              value={phoneView}
              onChange={setPhoneView}
              size="md"
            />
          </div>
        ) : null}

        {matching.length === 0 ? (
          <Card className={styles.emptyCard}>
            <EmptyState
              icon={Search}
              title="No match"
              meta={`No ED matches. All ${rows.length} stay below, dimmed.`}
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
          ) : (
            <PhoneEdList rows={ordered} isDim={isDim} highlight={highlight} onPreview={setPreviewId} />
          )
        ) : view === "table" ? (
          <EdTable rows={ordered} isDim={isDim} highlight={highlight} onPreview={setPreviewId} />
        ) : view === "lanes" ? (
          <EdLanes rows={ordered} services={services} accessTarget={accessTarget} isDim={isDim} highlight={highlight} />
        ) : (
          // Device audit 11 Oct 2026: Waiting by service is a rail beside the cards rather than an
          // eleventh card, and a full-width strip under them at tablet portrait.
          <div className={styles.cardsWithRail}>
            <section className={styles.cardGrid} aria-label="Emergency department cards">
              {ordered
                .filter((row) => row.summary.waiting > 0)
                .map((row) => (
                  <EdCard
                    key={row.summary.ed.id}
                    row={row}
                    dim={isDim(row)}
                    highlight={highlight}
                    onPreview={() => setPreviewId(row.summary.ed.id)}
                  />
                ))}
              {ordered.some((row) => row.summary.waiting === 0) ? (
                <div className={styles.clearLine} aria-label="Departments with no one waiting" role="group">
                  <span className={styles.clearLabel}>No one waiting</span>
                  {ordered
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
        )}

        <Drawer
          open={previewRow !== null}
          onClose={() => setPreviewId(null)}
          title={previewRow ? previewRow.short : "ED preview"}
          description={previewRow ? `${previewRow.summary.siteName} · ${previewRow.summary.service}` : undefined}
          headerActions={isPhone || ordered.length < 2 ? undefined : <EdPreviewSteps onStep={stepPreview} />}
          footer={previewRow ? <EdPreviewFoot row={previewRow} /> : null}
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
      {/* Device audit 11 Oct 2026: one control per card. The card itself opens the preview, and
          Enter stays as the one button. */}
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
          {row.short}
        </h2>
        <span className={styles.service}>{summary.service}</span>
      </div>
      <div className={styles.siteRow}>
        <p className={styles.meta} title={summary.siteName}>
          {summary.siteName}
        </p>
        <RowTrend values={row.trend} name={row.short} testId="ed-row-spark" />
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
          secondary={{ label: "Open patient", onAction: () => router.push(picked.person.href) }}
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
 * Waiting by service (v10): the bars are the service filter. Pressing a bar keeps that service's
 * EDs solid and dims the rest (the same as the service tabs); pressing it again clears it.
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
  const mean = bars.length ? bars.reduce((sum, bar) => sum + bar.waiting, 0) / bars.length : 0;
  return (
    <Card className={styles.serviceCard} as="section" aria-labelledby="ed-index-by-service">
      <h2 id="ed-index-by-service" className={styles.eyebrow}>
        Waiting by service
      </h2>
      <BarList
        label="Highlight a health service"
        rows={bars.map((bar) => ({
          id: bar.name,
          label: bar.name,
          value: bar.waiting,
          display: bar.waiting,
          testId: `ed-index-service-bar-${bar.name}`,
        }))}
        mean={mean}
        track
        labelWidth="88px"
        picked={value === "all" ? null : value}
        onPick={(id) => {
          const service = services.find((name) => name === id);
          if (service) onPick(service);
        }}
      />
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
          name={
            <span className={styles.phoneName}>
              <span className={styles.svcDot} data-service={item.summary.service} aria-hidden="true" />
              {item.short}
            </span>
          }
          meta={
            item.summary.waiting > 0 ? (
              <span className={styles.phoneMeta}>
                <PeoplePips row={item} highlight={highlight} />
                <span>
                  {item.noBed} no bed · {item.held} accepted · {item.forms} under a form
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
      <GroupHead title="Waiting, longest first" />
      {waitingRows.map(row)}
      {clearRows.length > 0 ? (
        <>
          <GroupHead title="No one waiting" tone="success" count={clearRows.length} />
          {clearRows.map(row)}
        </>
      ) : null}
    </Card>
  );
}

/*
 * Phone script budget (22 October 2026): the preview body, the phone lane facts and the desktop
 * picked strip draw only once an ED or a person is chosen, so their code loads after the first
 * paint and is fetched when the browser is idle. Not `next/dynamic`, which holds a freshly loaded
 * panel back for a frame or more; a loaded body draws straight away.
 */
type PreviewModule = typeof import("./ed-preview");
let loadedPreview: PreviewModule | undefined;
// One fetch shared by every part of the preview. A failed fetch is forgotten so Try again fetches anew,
// and a load from any part draws all of them.
let pendingPreview: Promise<PreviewModule> | undefined;
const previewListeners = new Set<() => void>();
const loadPreview = () =>
  (pendingPreview ??= import("./ed-preview").then(
    (m) => {
      loadedPreview = m;
      previewListeners.forEach((listener) => listener());
      return m;
    },
    (error: unknown) => {
      pendingPreview = undefined;
      throw error;
    },
  ));
preloadWhenIdle(loadPreview);
const subscribePreview = (listener: () => void) => {
  previewListeners.add(listener);
  return () => void previewListeners.delete(listener);
};

function usePreviewModule() {
  const loaded = useSyncExternalStore(
    subscribePreview,
    () => loadedPreview,
    () => undefined,
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    // Every part is drawn from `loaded` first, so a stale failure after a later load is never shown.
    if (!loaded && !failed) loadPreview().catch(() => setFailed(true));
  }, [loaded, failed]);
  return { loaded, failed, retry: () => setFailed(false) };
}

// A failed fetch (patchy Wi-Fi, or a new deploy) must not leave the preview blank without a word.
function PreviewLoadFailed({ retry }: { retry: () => void }) {
  return (
    <p role="status" data-testid="ward-ed-preview-load-failed">
      The ED details did not load.{" "}
      <Button variant="sec" onClick={retry}>
        Try again
      </Button>
    </p>
  );
}

function EdPreview(props: ComponentProps<PreviewModule["EdPreview"]>) {
  const { loaded, failed, retry } = usePreviewModule();
  const Body = loaded?.EdPreview;
  if (Body) return <Body {...props} />;
  return failed ? <PreviewLoadFailed retry={retry} /> : null;
}

function EdPreviewSteps(props: ComponentProps<PreviewModule["EdPreviewSteps"]>) {
  const Steps = usePreviewModule().loaded?.EdPreviewSteps;
  return Steps ? <Steps {...props} /> : null;
}

function EdPreviewFoot(props: ComponentProps<PreviewModule["EdPreviewFoot"]>) {
  // On a failed load the preview body above says so and offers Try again.
  const Foot = usePreviewModule().loaded?.EdPreviewFoot;
  return Foot ? <Foot {...props} /> : null;
}

function EdLanePicked(props: ComponentProps<PreviewModule["EdLanePicked"]>) {
  const { loaded, failed, retry } = usePreviewModule();
  const Picked = loaded?.EdLanePicked;
  if (Picked) return <Picked {...props} />;
  return failed ? <PreviewLoadFailed retry={retry} /> : null;
}

function EdLaneFacts(props: ComponentProps<PreviewModule["EdLaneFacts"]>) {
  const { loaded, failed, retry } = usePreviewModule();
  const Facts = loaded?.EdLaneFacts;
  if (Facts) return <Facts {...props} />;
  return failed ? <PreviewLoadFailed retry={retry} /> : null;
}
