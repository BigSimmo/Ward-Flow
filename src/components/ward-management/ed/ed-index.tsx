"use client";

import { minutesInEd, minutesSinceReferral } from "@/components/ward-management/ward-shared-figures";
import { useMemo, useState, type ReactNode } from "react";

import dynamic from "next/dynamic";
import { preloadWhenIdle } from "@/components/ward-management/preload-when-idle";
import { withLoadRetry } from "@/components/ward-management/load-retry";
import { EarlyMenu } from "@/components/ward-management/menu-early";
import { ArrowDownUp, Check, Phone, Search, Users } from "lucide-react";

import {
  Button,
  Card,
  EmptyState,
  FilterChip,
  GroupHead,
  FolderTabs,
  Hero,
  HeroAct,
  HeroFigures,
  HeroQuickChips,
  HeroTop,
  PhoneListRow,
  ScrollRow,
  PillTabs,
  Segmented,
  SrOnly,
  StatusGlyph,
  folderTabClasses,
  useIsPhone,
} from "@/components/wf";
import {
  ED_HELD_STAGES,
  ED_HOME_SERVICE_BAND_ORDER,
  ED_LEAVING_STAGES,
  ED_STAGE_LABELS,
  edHomeSummaries,
  edWaitingSeries,
  isUnderAForm,
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
import { ServiceNameTag } from "@/components/ward-management/service-name-tag";
import { edHasNoBedYet } from "@/components/ward-management/ed/ed-no-bed";
import { edHref, patientHref } from "@/components/ward-management/shell/ward-facade";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { requestToolsTool } from "@/components/ward-management/tools/ward-tools-open";

import {
  CLOCK_TONE,
  rowClock,
  rowHighlighted,
  waitLine,
  type EdPerson,
  type EdRow,
  type Highlight,
} from "./ed-index-parts";
import { PeoplePips } from "./ed-index-pips";
import { EdPreview, EdPreviewFoot } from "./ed-index-preview-load";
import styles from "./ed-index.module.css";
import pageTop from "@/components/ward-management/page-top-title.module.css";

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
type OrderBy = "longest" | "most";
type ViewMode = "cards" | "table" | "lanes";
const ORDERS: readonly OrderBy[] = ["longest", "most"];
const VIEWS: readonly ViewMode[] = ["cards", "table", "lanes"];
// Device audit 11 Oct 2026: By service left the phone; its figures are the service chips.
type PhoneView = "list" | "lanes" | "snapshot";

const STAGE_LABEL = ED_STAGE_LABELS;
const HELD = ED_HELD_STAGES;
const LEAVING = ED_LEAVING_STAGES;

/** Page tops (Josh, 9 Nov 2026): the figures read longest-first, as the page does. */
const FIGURE_ORDER: readonly Highlight[] = ["severe", "past", "no-bed"];

/** The chip that opened a tool gets focus back when it closes. */
const focused = () => (document.activeElement instanceof HTMLElement ? document.activeElement : undefined);

function serviceShortName(service: HealthService): string {
  return service.replace(/ Metro$/u, "");
}

/**
 * October 2026 design review (Josh, 31 Oct 2026): the title counts every department ("62 waiting
 * across 10 EDs · 8 with someone waiting"), hospital names wrap on the cards instead of ending in
 * "…", and departments with nobody waiting share one line with an Open button each, rather than a
 * full empty card.
 */
export function EdIndex({
  pageSwitch,
  heroTabs,
}: {
  /** Find (mock-up, 26 Nov 2026): the Find tabs, drawn first in this page's tab row; the page is unchanged. */
  pageSwitch?: ReactNode;
  /** Find (mock-up): the Find tabs, drawn at the top of the hero. */
  heroTabs?: ReactNode;
} = {}) {
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
  const isPhone = useIsPhone();

  // D-91: the keyword box over these ~15 EDs went in the search and forms review (Josh, 30 Oct
  // 2026). The header search finds an ED by name or site.

  const rows: EdRow[] = useMemo(() => {
    // Archived D-14: names come through the shared resolver, the same one the ED board uses.
    const resolve = createPatientResolver({ patients, referrals, movements });
    return edHomeSummaries(movements, now, accessTarget).map((summary) => {
      const people = summary.open
        .map((movement): EdPerson => {
          const wait = minutesInEd(movement, now);
          const sinceReferral = minutesSinceReferral(movement, now);
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
            sinceReferral,
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
        forms: people.filter((person) => isUnderAForm(person.movement)).length,
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

  // Diagnosed issues E1 (Josh, 3 Nov 2026): a filter or a hero chip now hides the EDs it leaves
  // out, in place of v10 rule 5's dimming, so a tap visibly changes the list. Within a shown card a
  // hero chip still lights its own people and dims the rest.
  const isShown = (row: EdRow) => matchesFilters(row) && rowHighlighted(row, highlight);
  // Every ED that is drawn is shown solid; the views keep their dim prop for any later use.
  const isDim = (row: EdRow): boolean => !isShown(row);
  const serviceRank = (row: EdRow) => ED_HOME_SERVICE_BAND_ORDER.indexOf(row.summary.service);
  const ordered = [...rows].sort((a, b) => {
    if (order === "most") return b.summary.waiting - a.summary.waiting || serviceRank(a) - serviceRank(b);
    return b.summary.longestWaitMinutes - a.summary.longestWaitMinutes || serviceRank(a) - serviceRank(b);
  });
  const shown = ordered.filter(isShown);

  const isFiltered = service !== "all" || status !== "all" || highlight !== null;
  const resetFilters = () => {
    setService("all");
    setStatus("all");
    setHighlight(null);
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
      label: `Over ${waitLine(accessTarget)}`,
      tone: "danger",
      word: `over ${waitLine(accessTarget)}`,
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
    const index = shown.findIndex((row) => row.summary.ed.id === previewId);
    const next = shown[(index + delta + shown.length) % shown.length];
    if (next) setPreviewId(next.summary.ed.id);
  };

  const orderControl = (
    <Segmented
      label="Sort"
      items={[
        { id: "longest" as OrderBy, label: "Longest wait" },
        { id: "most" as OrderBy, label: "Most waiting" },
      ]}
      value={order}
      onChange={setOrder}
    />
  );
  // Review (390): on a phone Sort is a compact menu at the chip row's right end, not a second row.
  const ORDER_LABEL: Record<OrderBy, string> = { longest: "Longest wait", most: "Most waiting" };
  const phoneOrderMenu = (
    <EarlyMenu
      label="Sort"
      align="end"
      items={ORDERS.map((id) => ({
        id,
        label: ORDER_LABEL[id],
        checkable: "radio" as const,
        checked: order === id,
        onSelect: () => setOrder(id),
      }))}
      trigger={(props) => (
        <Button
          {...props}
          variant="sec"
          iconOnly
          icon={ArrowDownUp}
          aria-label={`Sort: ${ORDER_LABEL[order]}`}
          className={styles.phoneFilterButton}
          data-testid="ed-index-phone-sort"
        />
      )}
    />
  );
  const STATUS_WORDS: Record<StatusFilter, string> = {
    all: "",
    "past-target": "Over target",
    waiting: "Has waiting",
    clear: "Clear",
  };
  const filterWords = [
    service === "all" ? null : service,
    status === "all" ? null : STATUS_WORDS[status],
    activeChip ? activeChip.label : null,
  ].filter((word): word is string => word !== null);
  const matchCount = (
    <span className={styles.showing} data-testid="ed-index-match-count" aria-live="polite">
      <span>
        Showing <b className={styles.num}>{shown.length}</b> of {rows.length} EDs
        {filterWords.length > 0 ? <> · {filterWords.join(" · ")}</> : null}
        <SrOnly>, sample data</SrOnly>
      </span>
    </span>
  );
  const servicePicker = <WaitingSnapshot shown={shown} onPreview={setPreviewId} accessTarget={accessTarget} />;

  const chipRow = (
    <HeroQuickChips
      label="Common jobs"
      items={[
        {
          id: "find",
          label: "Find a bed",
          icon: <Search size={16} strokeWidth={1.75} aria-hidden="true" />,
          onClick: () => requestToolsTool("bed-finder", focused()),
          testId: "ed-index-find-bed",
        },
        {
          id: "contacts",
          label: "Call and contacts",
          icon: <Phone size={16} strokeWidth={1.75} aria-hidden="true" />,
          onClick: () => requestToolsTool("contacts", focused()),
          testId: "ed-index-contacts",
        },
        // Audit three #53: on a computer the "Under a form" and "Accepted" filters sit on the list
        // head with Sort, so the hero holds only actions; a phone keeps them here.
        ...chips
          .filter((chip) => isPhone && (chip.id === "form" || chip.id === "held"))
          .reverse()
          .map((chip) => ({
            id: chip.id,
            label: chip.label,
            icon:
              chip.id === "form" ? (
                <Users size={16} strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <Check size={16} strokeWidth={1.75} aria-hidden="true" />
              ),
            count: chip.value,
            countTone: "quiet" as const,
            pressed: highlight === chip.id,
            onClick: () => setHighlight((value) => (value === chip.id ? null : chip.id)),
            testId: `ed-index-chip-${chip.id}`,
          })),
      ]}
    />
  );

  return (
    <div className={styles.screen} data-testid="ward-ed-index" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          className={`${pageTop.hero} ${folderTabClasses.hero}`}
          eyebrow={heroTabs}
          phoneEyebrow={heroTabs ? "show" : undefined}
          title={
            <>
              <SrOnly>All EDs, </SrOnly>
              Every ED <span className={styles.titleSoft}>longest first</span>
            </>
          }
          aside={<PageLiveChip paused={paused} onTogglePause={togglePause} />}
        >
          <HeroTop
            figures={
              <HeroFigures
                label="Highlight people waiting"
                items={[
                  {
                    id: "waiting",
                    value: waiting,
                    label: `waiting in ${rows.length} EDs`,
                    testId: "ed-index-figure-waiting",
                  },
                  // Each figure highlights its people, as the chips it replaces did; pressed again, it clears.
                  ...chips
                    .filter((chip) => chip.id === "severe" || chip.id === "past" || (!isPhone && chip.id === "no-bed"))
                    .sort((a, b) => FIGURE_ORDER.indexOf(a.id) - FIGURE_ORDER.indexOf(b.id))
                    .map((chip) => ({
                      id: chip.id,
                      value: chip.value,
                      label: chip.label.toLowerCase(),
                      pressed: highlight === chip.id,
                      onClick: () => setHighlight((value) => (value === chip.id ? null : chip.id)),
                      testId: `ed-index-figure-${chip.id}`,
                    })),
                ]}
              />
            }
            act={
              waiting > 0 && longestRow ? (
                <HeroAct
                  tone={
                    longest >= accessTarget ? "danger" : longest >= ED_SEVERE_PRESSURE_WAIT_MINUTES ? "warning" : "calm"
                  }
                  title={`${longestRow.short} · ${splitDuration(longest)}${isPhone ? "" : ` · ${longestRow.summary.waiting} waiting`}`}
                  action={{ label: "Open", href: edHref(longestRow.summary.ed.id), testId: "ed-index-act-enter" }}
                  testId="ed-index-act"
                />
              ) : (
                <HeroAct tone="calm" title="Nobody waiting in any ED" testId="ed-index-act" />
              )
            }
            chips={chipRow}
          >
            {activeChip ? (
              <span className={styles.heroNote} aria-live="polite" data-testid="ed-index-highlight-note">
                <span>
                  <b className={styles.heroNum}>{highlightedEds}</b> of {withWaiting.length} EDs
                  <SrOnly> (synthetic records)</SrOnly> have someone {activeChip.word}, the rest are hidden
                </span>
                <Button variant="onHero" size="sm" onClick={() => setHighlight(null)}>
                  Clear
                </Button>
              </span>
            ) : null}
          </HeroTop>
        </Hero>

        {/* Page tops (Josh, 9 Nov 2026): the views are the page tabs. Wider screens put the health
            service choice beside them as quiet filters; a phone keeps its own service row below. */}
        <FolderTabs
          label="All EDs views"
          value={isPhone ? phoneView : view}
          className={styles.pageTabs}
          testId="ed-index-tabs"
        >
          {isPhone ? (
            <Segmented
              className={folderTabClasses.switch}
              label="Show"
              items={[
                { id: "list" as PhoneView, label: "Cards" },
                { id: "lanes" as PhoneView, label: "Lanes" },
                // E2 (3 Nov 2026): the waiting snapshot, by ED or by service, one tap away.
                { id: "snapshot" as PhoneView, label: "Snapshot" },
              ]}
              value={phoneView}
              onChange={setPhoneView}
              size="md"
            />
          ) : (
            <>
              {/* Audit three #15: the view modes are a switch on the list head; these tabs filter. */}
              <div className={folderTabClasses.filters}>
                <PillTabs
                  className={styles.serviceTabs}
                  label="Health service"
                  items={serviceItems}
                  value={service}
                  onChange={(id) => setService(id as ServiceFilter)}
                />
              </div>
            </>
          )}
          {/* Find (mock-up): the pinned and recent places, once used, take their own line under the row. */}
          {pageSwitch}
        </FolderTabs>

        <section className={styles.filters} aria-label="Emergency department filters">
          {isPhone ? (
            // Audit two #56: the old Order sheet is gone; Sort is a compact menu at the chip row's end.
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
              {phoneOrderMenu}
            </div>
          ) : (
            // One slim row: Sort, then what is shown at the right end.
            <div className={styles.filterRow}>
              <span className={styles.filterLabel}>Sort</span>
              {orderControl}
              {/* Audit three #53: the hero's two filters, beside the list they narrow. */}
              {chips
                .filter((chip) => chip.id === "form" || chip.id === "held")
                .reverse()
                .map((chip) => (
                  <FilterChip
                    key={chip.id}
                    pressed={highlight === chip.id}
                    onPressedChange={() => setHighlight((value) => (value === chip.id ? null : chip.id))}
                    count={chip.value}
                  >
                    {chip.label}
                  </FilterChip>
                ))}
              {/* Audit two #21: the count says something only once a filter is on. */}
              {isFiltered ? (
                <span className={styles.shownCount}>
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    Clear filters
                  </Button>
                  {matchCount}
                </span>
              ) : null}
              {/* Audit three #15 (Josh, 28 Nov 2026): Cards, Table and Lanes are a kit switch at the
                  row's right end, as Movements' Graph or Table; the service tabs stay tabs. */}
              <Segmented
                className={styles.viewSwitch}
                label="View"
                items={[
                  { id: "cards" as ViewMode, label: "Cards" },
                  { id: "table" as ViewMode, label: "Table" },
                  { id: "lanes" as ViewMode, label: "Lanes" },
                ]}
                value={view}
                onChange={setView}
              />
            </div>
          )}
        </section>

        {shown.length === 0 ? (
          <Card className={styles.emptyCard}>
            <EmptyState
              icon={Search}
              title="No match"
              meta={`No ED matches these filters. Clear them to see all ${rows.length}.`}
              action={
                <Button variant="sec" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              }
            />
          </Card>
        ) : null}

        {isPhone && isFiltered ? (
          // E1: the phone says what the filters keep too, with one tap to clear them.
          <p className={styles.phoneShowing}>
            {matchCount}
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Clear
            </Button>
          </p>
        ) : null}

        {isPhone ? (
          phoneView === "snapshot" ? (
            servicePicker
          ) : phoneView === "lanes" ? (
            <EdLanes
              rows={shown}
              services={services}
              accessTarget={accessTarget}
              isDim={isDim}
              highlight={highlight}
              phone
            />
          ) : (
            <PhoneEdList rows={shown} isDim={isDim} highlight={highlight} onPreview={setPreviewId} />
          )
        ) : view === "table" ? (
          <EdTable rows={shown} isDim={isDim} highlight={highlight} onPreview={setPreviewId} />
        ) : view === "lanes" ? (
          <EdLanes rows={shown} services={services} accessTarget={accessTarget} isDim={isDim} highlight={highlight} />
        ) : (
          <EdCardsView
            shown={shown}
            isDim={isDim}
            highlight={highlight}
            onPreview={setPreviewId}
            accessTarget={accessTarget}
          />
        )}

        {/* Audit four #98: the ED preview is a record of a department, so it opens in the kit PanelDrawer
            like the ward panel beside it: kit head with the pager, one padded scroll, the kit foot band. */}
        <PanelDrawer
          open={previewRow !== null}
          onClose={() => setPreviewId(null)}
          title={previewRow ? previewRow.short : "ED preview"}
          subtitle={previewRow ? `${previewRow.summary.siteName} · ${previewRow.summary.service}` : undefined}
          // Audit four #31: the kit pager, "2 of 7", at every width, in place of the hand-built steps.
          pager={
            shown.length < 2
              ? undefined
              : {
                  index: shown.findIndex((row) => row.summary.ed.id === previewId),
                  total: shown.length,
                  noun: "ED",
                  onStep: stepPreview,
                }
          }
          foot={previewRow ? <EdPreviewFoot row={previewRow} /> : undefined}
          bodyClassName={styles.previewBody}
          testId="ed-index-preview"
        >
          {previewRow ? <EdPreview row={previewRow} highlight={highlight} accessTarget={accessTarget} /> : null}
        </PanelDrawer>

        <WardPrototypeFooter testId="ed-index-governance" note="Invented figures under real WA hospital names." />
      </main>
    </div>
  );
}

// Phone script budget (28 Nov 2026): the desktop views and the phone's Lanes and Snapshot load on
// their own (see ed-index-views.tsx). The server still draws the desktop view.
const loadViews = () => import("./ed-index-views");
const EdCardsView = dynamic(withLoadRetry(() => loadViews().then((m) => m.EdCardsView)));
const EdTable = dynamic(withLoadRetry(() => loadViews().then((m) => m.EdTable)));
const EdLanes = dynamic(withLoadRetry(() => loadViews().then((m) => m.EdLanes)));
const WaitingSnapshot = dynamic(withLoadRetry(() => loadViews().then((m) => m.WaitingSnapshot)));
preloadWhenIdle(loadViews);

// Phone script budget (PR #1742): the ED preview's kit drawer opens only on a press, so its code stays
// off the first load and is fetched when the browser is idle. A closed drawer draws nothing, as before.
const loadPanelDrawer = () => import("@/components/wf/drawer");
const PanelDrawer = dynamic(
  withLoadRetry(
    () => loadPanelDrawer().then((m) => m.PanelDrawer),
    undefined,
    ({ open }) => !open,
  ),
  { ssr: false },
);
preloadWhenIdle(loadPanelDrawer);

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
              {item.short}
              <ServiceNameTag service={item.summary.service} />
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
                <span className="sr-only">Longest wait </span>
                {splitDuration(item.summary.longestWaitMinutes)}
              </span>
            ) : (
              "Clear"
            )
          }
          // CB-3: no aria-label, so the row is named by the words it shows (a row cut by the screen's
          // edge still matches its name), with what a tap does for a screen reader.
          time={
            <>
              {item.summary.waiting > 0 ? `${item.summary.waiting} waiting` : null}
              <span className="sr-only">. Opens a preview.</span>
            </>
          }
          onSelect={() => onPreview(item.summary.ed.id)}
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
          <GroupHead title="Nobody waiting" tone="success" count={clearRows.length} />
          {clearRows.map(row)}
        </>
      ) : null}
    </Card>
  );
}
