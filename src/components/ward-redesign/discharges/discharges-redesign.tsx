"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useWardRecordActors } from "@/components/ward-management/shell/ward-access";
import { ChevronDown, ChevronRight, Copy, Filter, OctagonAlert, Printer, TrendingUp, Truck, X } from "lucide-react";
import { releaseBand, type ReleaseBand } from "@/components/ward-management/ward-bed-availability";
import { dayOf, formatSheetMoment } from "@/components/ward-management/ward-clock";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { LEAVING_DESTINATIONS, type LeavingDestination } from "@/components/ward-management/ward-admissions";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { Button, Card, Hero, LiveChip, PhoneSheet, Select, SrOnly, StatusGlyph, buttonClass } from "@/components/wf";
import { criteriaLedTileChip, dischargeCriteriaStatus } from "@/components/ward-management/ward-discharge-criteria";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { CriteriaLedTag } from "@/components/ward-management/ward/ward-criteria-led-tag";
import type { DischargeDay } from "@/components/ward-management/discharges/discharge-flow-charts";
import { DischargeBarrierBars, DischargeDayChart } from "./discharge-flow-charts";
import styles from "@/components/ward-management/discharges/discharges.module.css";
import redesign from "./discharges-redesign.module.css";
import {
  GROUP_CAP,
  GROUP_NOTES,
  GROUP_TITLES,
  HELD_UP,
  PHONE_GROUP_TITLES,
  heldUpByReason,
  pastWords,
  releaseActionLabel,
  releaseActionPart,
  type ReleasePanelPart,
} from "./discharges-parts";
import { ShowMoreRow } from "@/components/ward-redesign/parts/show-more-row";
import pageStyles from "@/components/ward-management/discharges/discharges-third-edition.module.css";
import wardPin from "@/components/ward-management/ward-pinned-switch.module.css";
import {
  PHONE_GROUP_TONES,
  BAND_LABELS,
  unitLabel,
  healthServiceLabel,
  WORK_STATUS_LABELS,
  WORK_ORDER,
  kpiCardLabel,
  recordStage,
  recordStatus,
  recordName,
  recordedMoment,
  recordedDate,
  matchesHighlight,
  perthDay,
  stageTone,
} from "@/components/ward-management/discharges/discharge-board-model";
import { badge } from "@/components/ward-management/discharges/discharge-board-parts";
import { DischargePopulationSwitch, DischargeFilterCard } from "./discharge-board-filters";
import {
  DischargeRecordDetail,
  DischargeRestingDetail,
} from "@/components/ward-management/discharges/discharge-detail-panes";
import { DischargeReleaseDetail } from "./discharge-release-detail";
import { useDischargeWorkspaceState } from "@/components/ward-management/discharges/use-discharge-workspace-state";
// Closing-the-loop package B (24 Oct 2026): the weekend and holiday list, now a notice above the list.
import { DischargeWeekendNotice } from "./discharge-weekend-notice";

/**
 * Task 6, spec D9: the discharge and egress board. A coordinator's whole reason to open this
 * board is "which bed do I chase, and which one is simply on its way" — so releases are grouped
 * by how much work is left on them, worst first: a **blocked** release needs somebody to act on
 * it right now, a **confirmed** one is just waiting for the clock, a **expected** one is a
 * belief rather than a fact yet, and **discharged today** is done. Within a group, releases are
 * ordered by `releaseBand` — the same "now / by midday / by 1600 / tonight" ladder the capacity
 * board uses (`ward-bed-availability.ts`), so the two boards never disagree about how soon
 * "soon" is.
 *
 * This board is LIVE, unlike `HandoverPage` — it reads `useWardFlow()` on every render and never
 * freezes a snapshot. There is nothing here a coordinator needs to have held still while they
 * read it; the opposite is true, a discharge board that lagged reality would be actively
 * misleading about which bed is actually free to chase next.
 */

/** Days the chart covers after today; the column before them gathers every date already passed. */
const CHART_DAYS_AHEAD = 14;

/** Moved to `./discharge-board-model` and `./discharge-board-parts`; re-exported so imports keep working. */

/** `initialAdmissionId`: a Tasks link (`?admissionId=`) opens that stay's detail once on arrival. */
/** Preview only: a fork of `DischargeBoard`: person first, one action a row, barriers beside the list. */
export function DischargesRedesign({ initialAdmissionId }: { initialAdmissionId?: string } = {}) {
  const { worldGeneration } = useWardFlowSelect("worldGeneration");
  const actors = useWardRecordActors();
  // Clear receipts synchronously when generation, role or place changes.
  return (
    <DischargeWorkspace key={`${worldGeneration}:${JSON.stringify(actors)}`} initialAdmissionId={initialAdmissionId} />
  );
}

function DischargeWorkspace({ initialAdmissionId }: { initialAdmissionId?: string }) {
  const base = useDischargeWorkspaceState({ initialAdmissionId });
  /* Redesign (Josh, 30 Oct): on Now the barrier panel and the day chart count bed releases, the list's
     own rows, and a click on either highlights within Now; it never switches to History. History keeps
     today's admission-record counts and behaviour. */
  const nowView = base.population === "releases";
  const { releaseGroups: groups } = base;
  const toWorkCount = groups.blocked.length + groups.confirmed.length + groups.expected.length;
  const openReleases = base.scopedReleases.filter((release) => release.state !== "discharged");
  const highlightWithinView: typeof base.highlightOn = (next) => {
    if (!nowView) {
      base.highlightOn(next);
      return;
    }
    base.setHighlight(next);
    // A status filter could hide the highlighted rows, so it goes back to all statuses.
    base.setStatus("all");
    const list = base.listRef.current;
    if (list) {
      list.scrollTo?.({ top: 0 });
      if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 40rem)").matches) {
        list.scrollIntoView?.({ block: "start", behavior: wardScrollBehavior() });
      }
    }
  };
  const copyCounts = nowView
    ? () => {
        const text =
          `Discharges, bed releases, as of ${formatSheetMoment(base.now, base.dayZero)}. ` +
          `${toWorkCount} to work now of ${openReleases.length} open: ${groups.blocked.length} held up, ` +
          `${groups.confirmed.length} confirmed, ${groups.expected.length} expected · ` +
          `${groups["discharged-today"].length} discharged in last 24h. ` +
          `${base.datePassed.length} past the ward's date, ${base.bedDaysPast} bed days.`;
        copyTextToClipboard(text).then(
          () => base.setCopyNote("Summary copied."),
          () => base.setCopyNote("Copying is not available in this browser."),
        );
      }
    : base.copySummary;
  const s: typeof base = {
    ...base,
    highlightOn: highlightWithinView,
    copySummary: copyCounts,
    barrierCounts: nowView ? heldUpByReason(groups.blocked) : base.barrierCounts,
  };
  // Josh, 30 Oct: a row's button opens the release panel on the part it names.
  const openCounter = useRef(0);
  const [openOn, setOpenOn] = useState<{ releaseId: string; part: ReleasePanelPart; n: number } | null>(null);
  const openReleaseOn = (releaseId: string, opener: HTMLElement, part: ReleasePanelPart) => {
    base.selectRelease(releaseId, opener);
    openCounter.current += 1;
    setOpenOn({ releaseId, part, n: openCounter.current });
    // Confirm date's control ("New expected out") sits in the release's arrangements, beside its barriers.
    base.setDrawerTab(part === "date" ? "barriers" : part);
  };
  // D-64: rows show where criteria led discharge stands, behind its flag (off in production).
  const criteriaLedOn = useWardFeatureFlag("top25-criteria-led-discharge");
  const {
    units,
    dayZero,
    dispatch,
    recordWardDeparture,
    now,
    population,
    status,
    setStatus,
    service,
    ward,
    identity,
    selected,
    releaseId,
    openError,
    isPhone,
    phoneChart,
    setPhoneChart,
    phoneFiltersOpen,
    setPhoneFiltersOpen,
    phoneGroupsOpen,
    setPhoneGroupsOpen,
    phoneGroupsFolded,
    setPhoneGroupsFolded,
    highlight,
    setHighlight,
    copyNote,
    detailRef,
    listRef,
    setDeparture,
    offerDeparture,
    guarded,
    records,
    releaseGroups,
    scopedRecords,
    counts,
    recordLit,
    releaseLit,
    dimmed,
    statusHighlight,
    litFirst,
    visibleRecords,
    visibleReleaseGroups,
    activeRecord,
    detailRelease,
    linkedReleaseRecord,
    selectedUnitId,
    canRecordDeparture,
    departureDestination,
    phoneClearBlocker,
    shown,
    total,
    closeDrawer,
    openRecord,
    filtersActive,
    openCount,
    openScopedRecords,
    barrierCounts,
    highlightOn,
    highlightedCount,
    bedDaysPast,
    copySummary,
  } = s;
  const today = dayOf(now);
  const chartDays: DischargeDay[] = [
    {
      key: "past",
      label: "Passed",
      name: "Date already passed",
      expected: 0,
      blocked: 0,
      weekend: false,
    },
    ...Array.from({ length: CHART_DAYS_AHEAD }, (_, index): DischargeDay => {
      const noon = (today + index) * MINUTES_PER_DAY + 12 * 60;
      const weekday = perthDay(noon, dayZero, { weekday: "short" });
      return {
        key: index,
        label: index === 0 ? "Today" : `${weekday} ${perthDay(noon, dayZero, { day: "numeric" })}`,
        name: perthDay(noon, dayZero, { weekday: "long", day: "numeric", month: "long" }),
        expected: 0,
        blocked: 0,
        weekend: weekday === "Sat" || weekday === "Sun",
      };
    }),
  ];
  const dayOfChart = (at: number | null) =>
    chartDays.find((candidate) => matchesHighlight({ kind: "day", day: candidate.key }, at, null, now));
  if (nowView) {
    // Now: every open bed release in scope by its expected day (the "of 207 open"), as Capacity's
    // forecast counts recorded discharges; the red part is the held-up ones, as the list says.
    for (const release of openReleases) {
      const day = dayOfChart(release.expectedAt);
      if (!day) continue;
      if (release.blocker !== null) day.blocked += 1;
      else day.expected += 1;
    }
  } else {
    for (const record of openScopedRecords) {
      const day = dayOfChart(record.expectedDischargeAt);
      if (!day) continue;
      if (recordStatus(record) === "blocked") day.blocked += 1;
      else day.expected += 1;
    }
  }
  // A day two or more ahead also holds releases the list leaves out (due in 2+ days, not held up).
  const notListedOnDay =
    nowView && highlight?.kind === "day"
      ? openReleases.filter(
          (release) =>
            matchesHighlight(highlight, release.expectedAt, null, now) &&
            !releaseGroups.blocked.includes(release) &&
            !releaseGroups.confirmed.includes(release) &&
            !releaseGroups.expected.includes(release),
        ).length
      : 0;
  // Now and History: in the hero on desktop and tablet, under it on a phone (v10).
  const populationSwitch = <DischargePopulationSwitch s={s} />;
  const filterCard = <DischargeFilterCard s={s} />;

  return (
    <div className={`${styles.screen} ${pageStyles.screen}`} data-testid="ward-discharge-board" data-ward-design="v6">
      <main id="main-content" className={pageStyles.main}>
        <h1 className={pageStyles.localTitle}>Discharges</h1>
        <p className={pageStyles.printScope}>
          {population === "records" ? "Admission records" : "Bed releases"} · Identifiers may be included
          {" · "}
          {service === "all" ? "All services" : service}
          {" · "}
          {ward === "all"
            ? "All wards"
            : unitLabel(
                units.find((unit) => unit.id === ward),
                ward,
              )}
          {" · "}
          {status === "all" ? "All statuses" : WORK_STATUS_LABELS[status]}
          {population === "records"
            ? ` · ${identity === "all" ? "All records" : identity === "linked" ? "Linked patient" : "Missing or unavailable"}`
            : ""}
          {" · "}As of {formatSheetMoment(now, dayZero, { includeYearAndZone: true })}
        </p>
        <Hero
          className={pageStyles.phoneHero}
          eyebrow={
            population === "releases"
              ? isPhone
                ? `Bed release · ${service === "all" ? "statewide" : service}`
                : "Bed release · all services"
              : "History · admission records"
          }
          // A4-22 (audit round 2): History counts admission records, not today's bed releases, so
          // its title says so rather than reading as the same figure jumping.
          title={
            population === "records"
              ? `${openCount} admission ${openCount === 1 ? "record" : "records"} open`
              : // Redesign (point 20): the headline counts the rows listed below it; the wider total
                // and what it adds sit beside it, so no two figures on the page disagree unexplained.
                `${openCount} to work now`
          }
          titleMeta={
            <span className={`${pageStyles.bedDaysPast} ${redesign.meta}`} data-testid="ward-discharge-bed-days-past">
              {/* Josh, 30 Oct: "59 to work now · of 207 open". Open is every release not yet discharged;
                  the 148 due in 2+ days are said once, in the list's footer. */}
              {population === "releases" ? `${isPhone ? "" : "· "}of ${openReleases.length} open · ` : null}
              <strong>{bedDaysPast}</strong> bed {bedDaysPast === 1 ? "day" : "days"} past the ward&rsquo;s date
            </span>
          }
          aside={
            <div className={pageStyles.heroTools}>
              <LiveChip state="live" onHero />
              {isPhone ? null : (
                <Button size="sm" variant="onHero" icon={Copy} onClick={copySummary} data-testid="ward-discharge-copy">
                  Copy counts
                </Button>
              )}
              <Button
                size="sm"
                variant="onHero"
                icon={Printer}
                className={pageStyles.desktopOnly}
                onClick={() => window.print()}
                data-testid="ward-discharge-print"
                aria-label="Print list (may include identifiers)"
              >
                Print list
              </Button>
              <span className={pageStyles.copyNote} role="status" aria-live="polite">
                {copyNote}
              </span>
            </div>
          }
          bar={
            <>
              <div
                className={pageStyles.kpiStrip}
                data-testid="ward-discharge-kpi-strip"
                role="region"
                aria-label="Discharge pipeline highlights"
              >
                {WORK_ORDER.map((key) => (
                  <button
                    key={key}
                    type="button"
                    data-testid={`ward-discharge-kpi-${key}`}
                    className={pageStyles.kpi}
                    aria-pressed={statusHighlight === key}
                    // P082: the name starts with what the button shows (count, then label).
                    aria-label={`${counts[key]} ${kpiCardLabel(key, population)}`}
                    onClick={() => {
                      setHighlight(statusHighlight === key ? null : { kind: "status", status: key });
                      setStatus("all");
                    }}
                  >
                    <strong className={pageStyles.kpiValue}>{counts[key]}</strong>
                    <span className={pageStyles.kpiLabel}>
                      {key === "departed" ? null : <StatusGlyph tone={stageTone(key)} size={9} />}
                      <span>
                        {/* Josh, 30 Oct: one word for a release with a blocker, "Held up", at every width. */}
                        {key === "blocked" ? HELD_UP : kpiCardLabel(key, population)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {/* Device audit, 11 Oct 2026: no desk tools in the phone hero, so Copy summary
                  is off phone (it stays in the tablet and desktop hero). */}
            </>
          }
          barAside={isPhone ? undefined : populationSwitch}
        />
        {isPhone ? (
          <div className={`${pageStyles.phToolbar} ${wardPin.pinnedSwitch}`}>
            {populationSwitch}
            <button
              type="button"
              className={pageStyles.phFilterButton}
              aria-label={filtersActive ? "Filters, some applied" : "Filters"}
              aria-expanded={phoneFiltersOpen}
              data-active={filtersActive || undefined}
              onClick={() => setPhoneFiltersOpen(true)}
              data-testid="ward-discharge-phone-filters"
            >
              <Filter size={18} aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {isPhone ? (
          <PhoneSheet
            open={phoneFiltersOpen}
            onClose={() => setPhoneFiltersOpen(false)}
            title="Filters"
            description="Filters narrow the list. Highlights never hide anyone."
          >
            {filterCard}
          </PhoneSheet>
        ) : (
          filterCard
        )}
        {guarded.status === "allowed" && isPhone ? (
          /* v10 phone: the two charts are one tap away as cards; each opens a sheet that scrolls
             sideways with 48px tap columns. A tap highlights rows and closes the sheet. */
          <div className={pageStyles.phChartCards} data-testid="ward-discharge-phone-chart-cards">
            <button
              type="button"
              className={pageStyles.phChartCard}
              aria-label={`Expected discharges per day, passed and the next ${chartDays.filter((day) => day.key !== "past").length} days`}
              onClick={() => setPhoneChart("days")}
            >
              <TrendingUp size={16} aria-hidden="true" className={pageStyles.phChartIcon} />
              <span className={pageStyles.phChartText}>
                <span className={pageStyles.phChartTitle}>Per day</span>
                <span className={pageStyles.phChartMeta}>
                  <b>
                    {(() => {
                      const day = chartDays.find((candidate) => candidate.key === 0);
                      return day ? day.expected + day.blocked : 0;
                    })()}
                  </b>{" "}
                  today · <b>{chartDays[0] ? chartDays[0].expected + chartDays[0].blocked : 0}</b> past
                </span>
              </span>
              <ChevronRight size={16} aria-hidden="true" className={pageStyles.phChartIcon} />
            </button>
            <button
              type="button"
              className={pageStyles.phChartCard}
              aria-label={`Held up by barrier, ${barrierCounts.filter((barrier) => barrier.count > 0).length} barriers`}
              onClick={() => setPhoneChart("barriers")}
            >
              <OctagonAlert size={16} aria-hidden="true" className={pageStyles.phChartIcon} />
              <span className={pageStyles.phChartText}>
                <span className={pageStyles.phChartTitle}>By barrier</span>
                <span className={pageStyles.phChartMeta}>
                  {barrierCounts[0] && barrierCounts[0].count > 0 ? `Most: ${barrierCounts[0].label}` : "None held up"}
                </span>
              </span>
              <ChevronRight size={16} aria-hidden="true" className={pageStyles.phChartIcon} />
            </button>
            <PhoneSheet
              open={phoneChart !== null}
              onClose={() => setPhoneChart(null)}
              title={phoneChart === "barriers" ? "Held up by barrier" : "Expected discharges per day"}
              description="Tap to highlight people in the list. Nobody is hidden."
              height="tall"
              className={pageStyles.phChartSheet}
              data-testid="ward-discharge-phone-chart-sheet"
            >
              {phoneChart === "barriers" ? (
                <DischargeBarrierBars
                  barriers={barrierCounts}
                  counts={nowView ? "releases" : "people"}
                  selected={highlight?.kind === "barrier" ? highlight.id : null}
                  onSelect={(id) => {
                    highlightOn({ kind: "barrier", id });
                    setPhoneChart(null);
                  }}
                  onClear={() => setHighlight(null)}
                />
              ) : (
                <DischargeDayChart
                  days={chartDays}
                  selected={highlight?.kind === "day" ? highlight.day : null}
                  onSelect={(day) => {
                    highlightOn({ kind: "day", day });
                    setPhoneChart(null);
                  }}
                  onClear={() => setHighlight(null)}
                />
              )}
            </PhoneSheet>
          </div>
        ) : null}
        {/* Josh, 30 Oct: the weekend and holiday cut-offs are a compact notice above the list, not a
            panel under about 60 rows. */}
        {guarded.status === "allowed" && population === "releases" ? (
          <DischargeWeekendNotice
            releases={s.bedReleases.filter((release) => units.some((unit) => unit.id === release.unitId))}
            units={units}
            nameFor={(release) => {
              const record = records.find((candidate) => candidate.admissionId === release.admissionId);
              return record ? recordName(record) : null;
            }}
            now={now}
            dayZero={dayZero}
            onOpen={(id, opener) => openReleaseOn(id, opener, "barriers")}
            foldable={isPhone}
          />
        ) : null}
        <div
          className={`${pageStyles.workspace} ${redesign.workspace}`}
          data-detail-open={Boolean(selected || releaseId) || undefined}
        >
          <Card className={`${pageStyles.register} ${redesign.list}`} aria-labelledby="discharge-register-heading">
            <header className={pageStyles.panelHeader}>
              <h2 id="discharge-register-heading" className={pageStyles.localTitle}>
                {population === "releases" ? "Bed release worklist" : "Admission discharge records"}
              </h2>
              {/* Redesign (Josh, 30 Oct): the List / Barriers switch is gone. Its Barriers view was a third
                  copy of the barrier counts; the one panel beside the list keeps that job. */}
              {/* Josh, 30 Oct: the order line is cut; the order itself (held up first, then by stage,
                  soonest time band first in each) stays. */}
              <span className={redesign.headerSpacer} aria-hidden="true" />
              {highlight !== null ? (
                <span className={pageStyles.highlightNote} data-testid="ward-discharge-highlight-note">
                  <StatusGlyph tone="info" size={9} />
                  {highlightedCount} of {nowView ? toWorkCount : shown} highlighted, all rows stay
                  {notListedOnDay > 0 ? ` · ${notListedOnDay} more that day not listed` : null}
                  <Button size="sm" variant="ghost" onClick={() => setHighlight(null)}>
                    Clear
                  </Button>
                </span>
              ) : null}
              <span
                className="sr-only"
                role="status"
                aria-live="polite"
                aria-atomic="true"
                data-testid="discharge-pipeline-announcement"
              >
                {population === "releases" ? "Bed releases" : "Admission records"}: {counts.blocked} held up,{" "}
                {counts.confirmed} confirmed, {counts.expected} expected, {counts.departed} departed.
              </span>
              <span aria-live="polite" className={pageStyles.shownCountBadge}>
                {/* Device audit, 11 Oct 2026: the hero says 53 open and the list holds 57, so the
                    list names both parts rather than a bare "57 shown". */}
                {population === "records" && guarded.status === "denied"
                  ? "Unavailable"
                  : population === "releases" && status === "all" && shown === total
                    ? `${toWorkCount} to work${counts.departed > 0 ? ` · ${counts.departed} discharged` : ""}`
                    : `${shown} shown`}
              </span>
            </header>
            <div
              ref={listRef}
              className={pageStyles.listBody}
              role="region"
              aria-label="Discharge worklist"
              tabIndex={0}
            >
              {population === "records" && guarded.status === "denied" ? (
                <p className={pageStyles.emptyState}>Discharge records are unavailable for this role.</p>
              ) : shown === 0 ? (
                <p className={pageStyles.emptyState}>
                  No {population === "releases" ? "releases" : "records"} match these filters.
                </p>
              ) : (
                <table className={pageStyles.workTable}>
                  <caption className={pageStyles.localTitle}>
                    {population === "releases"
                      ? "Bed releases, held up first. Rows may include identifiers. Completed releases cover the last 24 hours."
                      : "Admission records, held up first. Expected dates do not imply confirmation."}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Patient / ward</th>
                      <th scope="col">{population === "releases" ? "Timing" : "Expected / departed"}</th>
                      <th scope="col">Stage / blocker</th>
                      <th scope="col" className={redesign.actionHead}>
                        <span className="sr-only">Next</span>
                      </th>
                    </tr>
                  </thead>
                  {population === "records" ? (
                    <tbody>
                      {visibleRecords.map((record) => {
                        const unit = units.find((candidate) => candidate.id === record.unitId);
                        const isSelected = selected?.admissionId === record.admissionId;
                        const criteriaChip =
                          criteriaLedOn && recordStage(record) !== "departed"
                            ? criteriaLedTileChip(
                                dischargeCriteriaStatus(record.dischargeCriteria, record.criteriaEligibility, now),
                              )
                            : null;
                        return (
                          <tr
                            key={record.id}
                            /* Return to your place: Back focuses the row that was opened. */
                            data-record-key={record.id}
                            data-selected={isSelected}
                            data-highlighted={recordLit(record) || undefined}
                            data-dim={dimmed(recordLit(record))}
                            data-act={recordStatus(record) === "blocked" || undefined}
                            onClick={(e) => openRecord(record, e.currentTarget)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                openRecord(record, e.currentTarget);
                              }
                            }}
                            className={pageStyles.interactiveRow}
                            tabIndex={0}
                          >
                            <td data-label="Patient / ward">
                              <button
                                type="button"
                                className={pageStyles.recordButton}
                                aria-pressed={isSelected}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRecord(record, e.currentTarget);
                                }}
                              >
                                {recordName(record)}
                              </button>
                              <span className={pageStyles.secondaryMono}>
                                {record.identity.kind === "linked" ? record.identity.patient.umrn : record.admissionId}
                              </span>
                              <span className={pageStyles.secondary}>
                                {unitLabel(unit, record.unitId)} · {healthServiceLabel(unit)}
                              </span>
                            </td>
                            <td
                              data-label={recordStage(record) === "departed" ? "Departed" : "Expected"}
                              className={pageStyles.timingCell}
                            >
                              <strong className={pageStyles.due}>
                                {recordedMoment(
                                  recordStage(record) === "departed" ? record.leftAt : record.expectedDischargeAt,
                                  dayZero,
                                )}
                              </strong>
                            </td>
                            <td data-label="Stage / blocker">
                              <div className={pageStyles.stageCluster}>
                                {badge(recordStage(record))}
                                {recordStatus(record) === "blocked" && (
                                  <span className={pageStyles.blocker}>{record.blockReason}</span>
                                )}
                                {criteriaChip ? (
                                  <span data-testid="ward-discharge-criteria-led">
                                    <CriteriaLedTag chip={criteriaChip} />
                                    <SrOnly>{criteriaChip.phrase}</SrOnly>
                                  </span>
                                ) : null}
                                {record.leavingDestination && (
                                  <span className={pageStyles.secondary}>
                                    {LEAVING_DESTINATIONS.find((item) => item.id === record.leavingDestination)
                                      ?.label ?? "Not recorded"}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  ) : (
                    visibleReleaseGroups.map((key) => (
                      <tbody
                        key={key}
                        data-testid={`ward-discharge-group-${key}`}
                        data-has-items={releaseGroups[key].length > 0}
                      >
                        <tr className={pageStyles.groupRow}>
                          <th colSpan={4} scope="rowgroup">
                            {isPhone ? (
                              <button
                                type="button"
                                className={pageStyles.phGroupToggle}
                                aria-expanded={!phoneGroupsFolded[key]}
                                data-testid={`ward-discharge-group-toggle-${key}`}
                                onClick={() => setPhoneGroupsFolded((folded) => ({ ...folded, [key]: !folded[key] }))}
                              >
                                <StatusGlyph tone={PHONE_GROUP_TONES[key]} size={10} />
                                <h3>
                                  {PHONE_GROUP_TITLES[key]}{" "}
                                  <span className={pageStyles.phGroupCount}>{releaseGroups[key].length}</span>
                                </h3>
                                {phoneGroupsFolded[key] ? (
                                  <ChevronRight size={16} aria-hidden="true" className={pageStyles.phGroupChevron} />
                                ) : (
                                  <ChevronDown size={16} aria-hidden="true" className={pageStyles.phGroupChevron} />
                                )}
                              </button>
                            ) : (
                              <div className={pageStyles.groupHead}>
                                <span className={pageStyles.groupGlyph}>
                                  <StatusGlyph tone="danger" size={9} />
                                </span>
                                <h3>
                                  {GROUP_TITLES[key]}{" "}
                                  <span className={pageStyles.groupCount}>{releaseGroups[key].length}</span>
                                </h3>
                                {/* Josh, 30 Oct: the held-up and discharged groups lose their sentence. */}
                                {GROUP_NOTES[key] ? (
                                  <span className={pageStyles.groupSub}>{GROUP_NOTES[key]}</span>
                                ) : null}
                              </div>
                            )}
                          </th>
                        </tr>
                        {isPhone && phoneGroupsFolded[key] ? null : releaseGroups[key].length === 0 ? (
                          <tr>
                            <td colSpan={4} className={pageStyles.emptyGroup}>
                              None
                            </td>
                          </tr>
                        ) : (
                          // Josh, 30 Oct: every width shows a group's first rows, then Show more, as the phone did.
                          (!phoneGroupsOpen[key]
                            ? litFirst(releaseGroups[key], releaseLit).slice(0, GROUP_CAP)
                            : litFirst(releaseGroups[key], releaseLit)
                          ).map((release, index) => {
                            const unit = units.find((candidate) => candidate.id === release.unitId);
                            const linked = records.find((candidate) => candidate.admissionId === release.admissionId);
                            const overdue = release.state !== "discharged" && release.expectedAt < now;
                            return (
                              <tr
                                key={release.id}
                                data-release-id={release.id}
                                data-selected={releaseId === release.id}
                                data-highlighted={releaseLit(release) || undefined}
                                data-dim={dimmed(releaseLit(release))}
                                // One thin red edge, on the first act-now row only (device audit,
                                // 11 Oct 2026: five stacked red outlines read as an error state).
                                data-act={(key === "blocked" && index === 0) || undefined}
                                onClick={(e) => openReleaseOn(release.id, e.currentTarget, "milestones")}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    openReleaseOn(release.id, e.currentTarget, "milestones");
                                  }
                                }}
                                className={pageStyles.interactiveRow}
                                tabIndex={0}
                              >
                                <td data-label="Ward / service">
                                  <button
                                    type="button"
                                    className={pageStyles.recordButton}
                                    aria-pressed={releaseId === release.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openReleaseOn(release.id, e.currentTarget, "milestones");
                                    }}
                                  >
                                    {/* Redesign: the person first, then the ward and service. */}
                                    {linked ? recordName(linked) : "Name not recorded"}
                                  </button>
                                  <span className={pageStyles.secondary}>
                                    {unitLabel(unit, release.unitId)} · {healthServiceLabel(unit)}
                                  </span>
                                </td>
                                <td data-label="Timing" className={`${pageStyles.timingCell} ${redesign.timing}`}>
                                  {/* Device audit, 11 Oct 2026: a release past its date says how far
                                      past, with the date alone; "Now" and the clock time read as
                                      due this minute on rows one to four days late. */}
                                  {overdue ? (
                                    <>
                                      <strong className={pageStyles.band}>
                                        <StatusGlyph tone="danger" size={9} />
                                        {pastWords(now - release.expectedAt)}
                                      </strong>{" "}
                                      <span className={pageStyles.due}>
                                        {recordedDate(release.expectedAt, dayZero)}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <strong className={pageStyles.band}>
                                        {BAND_LABELS[releaseBand(release, now) as ReleaseBand]}
                                      </strong>{" "}
                                      <span className={pageStyles.due}>
                                        {/* Josh, 30 Oct: a Later row shows its date alone; its clock time
                                            only mirrored the board clock. */}
                                        {release.state !== "discharged" && releaseBand(release, now) === "beyond-today"
                                          ? recordedDate(release.expectedAt, dayZero)
                                          : recordedMoment(
                                              release.state === "discharged" ? release.confirmedAt : release.expectedAt,
                                              dayZero,
                                            )}
                                      </span>
                                    </>
                                  )}
                                </td>
                                <td data-label="Stage / blocker">
                                  <div className={pageStyles.stageCluster}>
                                    {/* A stuck release keeps its own stage word, so a blocked confirmation
                                        still reads apart from a blocked prediction, but never with the
                                        green tick beside its blocker (UX audit, 21 Oct 2026). */}
                                    {release.state !== "discharged" && release.blocker !== null ? (
                                      <span className={pageStyles.badge} data-status="blocked">
                                        <StatusGlyph tone="danger" size={9} />
                                        <span className="sr-only">Held up: </span>
                                        <span>{WORK_STATUS_LABELS[release.state]}</span>
                                      </span>
                                    ) : (
                                      badge(release.state === "discharged" ? "departed" : release.state)
                                    )}
                                    {release.blocker && <span className={pageStyles.blocker}>{release.blocker}</span>}
                                    {release.waitingOn && (
                                      <span className={pageStyles.secondary}>
                                        <Truck size={12} className={pageStyles.inlineIcon} aria-hidden="true" />{" "}
                                        {release.waitingOn}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className={redesign.actionCell}>
                                  {release.state === "discharged" ? null : (
                                    <Button
                                      size="sm"
                                      variant="sec"
                                      className={redesign.rowAction}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openReleaseOn(release.id, e.currentTarget, releaseActionPart(release));
                                      }}
                                    >
                                      {releaseActionLabel(release)}
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                        {!(isPhone && phoneGroupsFolded[key]) && releaseGroups[key].length > GROUP_CAP ? (
                          <tr className={redesign.moreRow} data-testid={`ward-discharge-group-more-${key}`}>
                            <td colSpan={4}>
                              <ShowMoreRow
                                expanded={Boolean(phoneGroupsOpen[key])}
                                onClick={() => setPhoneGroupsOpen((open) => ({ ...open, [key]: !open[key] }))}
                              >
                                {phoneGroupsOpen[key]
                                  ? "Show fewer"
                                  : `Show ${releaseGroups[key].length - GROUP_CAP} more ${(key === "discharged-today" ? "discharged" : GROUP_TITLES[key]).toLowerCase()}`}
                              </ShowMoreRow>
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    ))
                  )}
                </table>
              )}
            </div>
            <footer
              className={pageStyles.registerFooter}
              data-testid="ward-discharge-excluded"
              hidden={population === "records" && guarded.status === "denied"}
            >
              {population === "releases" ? (
                <>
                  <span>{releaseGroups.excludedBeyondToday} due in 2+ days, not listed</span>
                  <span data-testid="ward-discharge-completed-before-today">
                    {releaseGroups.completedBeforeToday} discharged 24h+ ago
                  </span>
                  <span className={pageStyles.footNote}>No expected bed counts as ready</span>
                </>
              ) : (
                <>
                  <span>
                    {scopedRecords.filter((record) => record.identity.kind === "linked").length} patient linked
                  </span>
                  <span>
                    {scopedRecords.filter((record) => record.identity.kind !== "linked").length} link missing /
                    unavailable
                  </span>
                  <span>
                    {scopedRecords.filter((record) => record.expectedDischargeAt === null).length} expected date not
                    recorded
                  </span>
                </>
              )}
            </footer>
          </Card>
          {/* Redesign (Josh, 30 Oct): the one barrier panel, and under it the day chart, beside the list on a
              wide screen, so "Choose a day" sits beside the rows it highlights. On a tablet both keep their
              place under the list. The Barriers view is gone. */}
          {guarded.status === "allowed" && !isPhone && !(selected || releaseId) ? (
            <div className={redesign.barrierSide}>
              <DischargeBarrierBars
                barriers={barrierCounts}
                counts={nowView ? "releases" : "people"}
                selected={highlight?.kind === "barrier" ? highlight.id : null}
                onSelect={(id) => highlightOn({ kind: "barrier", id })}
                onClear={() => setHighlight(null)}
              />
              <DischargeDayChart
                days={chartDays}
                layout="rows"
                selected={highlight?.kind === "day" ? highlight.day : null}
                onSelect={(day) => highlightOn({ kind: "day", day })}
                onClear={() => setHighlight(null)}
              />
            </div>
          ) : null}
          {Boolean(selected || releaseId) && (
            <div
              className={pageStyles.scrim}
              onClick={closeDrawer}
              aria-hidden="true"
              data-testid="ward-discharge-scrim"
            />
          )}
          <div className={pageStyles.rightRail}>
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- catches Escape or arrow keys bubbling up from the focused control inside */}
            <aside
              ref={detailRef}
              className={`${pageStyles.detail}${selected || releaseId ? ` ${pageStyles.open}` : ""}`}
              tabIndex={-1}
              aria-labelledby="discharge-detail-heading"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeDrawer();
                  return;
                }
                if (event.key === "Tab") {
                  if (typeof window !== "undefined" && window.matchMedia("(min-width: 40rem)").matches) {
                    return;
                  }
                  const focusable = Array.from(
                    detailRef.current?.querySelectorAll<HTMLElement>(
                      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                    ) ?? [],
                  ).filter((el) => !el.hasAttribute("disabled"));
                  if (focusable.length === 0) return;
                  const first = focusable[0];
                  const last = focusable[focusable.length - 1];
                  if (!first || !last) return;
                  if (event.shiftKey && document.activeElement === first) {
                    last.focus();
                    event.preventDefault();
                  } else if (!event.shiftKey && document.activeElement === last) {
                    first.focus();
                    event.preventDefault();
                  }
                }
              }}
            >
              <header className={pageStyles.detailHeader}>
                <h2
                  id="discharge-detail-heading"
                  className={activeRecord || detailRelease ? pageStyles.localTitle : pageStyles.detailTitle}
                >
                  {activeRecord || detailRelease ? "Selected discharge" : "Record detail"}
                </h2>
                {(selected || releaseId) && (
                  <Button
                    iconOnly
                    icon={X}
                    variant="ghost"
                    size="sm"
                    aria-label="Close"
                    className={pageStyles.closeBtn}
                    onClick={closeDrawer}
                  />
                )}
              </header>
              <div className={pageStyles.detailBody} role="region" aria-label="Selected discharge details" tabIndex={0}>
                {activeRecord ? (
                  <DischargeRecordDetail key={activeRecord.id} s={s} activeRecord={activeRecord} />
                ) : detailRelease ? (
                  <DischargeReleaseDetail
                    key={`${detailRelease.id}:${openOn?.n ?? 0}`}
                    s={s}
                    detailRelease={detailRelease}
                    openOn={openOn?.releaseId === detailRelease.id ? openOn.part : null}
                  />
                ) : selected || openError ? (
                  <p className={pageStyles.emptyState}>This record could not be opened. Select it again to retry.</p>
                ) : (
                  <DischargeRestingDetail s={s} />
                )}
              </div>
              {selectedUnitId && (
                <footer className={pageStyles.detailFooter}>
                  {canRecordDeparture ? (
                    <label className={pageStyles.departDest}>
                      <span>Going to</span>
                      <Select
                        aria-label="Where are they going?"
                        data-testid="ward-discharge-departure-destination"
                        value={departureDestination}
                        onChange={(event) =>
                          setDeparture({
                            releaseId: detailRelease?.id ?? null,
                            destination: event.target.value as LeavingDestination,
                          })
                        }
                      >
                        {LEAVING_DESTINATIONS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ) : null}
                  <Link
                    href={`/ward-flow/ward/${selectedUnitId}`}
                    className={buttonClass({ size: "sm", variant: "sec" })}
                  >
                    Open ward
                  </Link>
                  {canRecordDeparture && detailRelease ? (
                    <Button
                      variant={phoneClearBlocker ? "sec" : "pri"}
                      size="sm"
                      className={phoneClearBlocker ? undefined : pageStyles.departPri}
                      data-testid="ward-discharge-record-departure"
                      onClick={() => {
                        const who = linkedReleaseRecord ? recordName(linkedReleaseRecord) : "The person";
                        const admissionId = detailRelease.admissionId;
                        const completion = recordWardDeparture(
                          admissionId,
                          detailRelease.unitId,
                          departureDestination,
                          s.releaseActor.role === "coordinator" ? "coordinator" : "ward",
                        );
                        // The completion carries this command's accepted Undo record, including shared saves.
                        offerDeparture(
                          {
                            success: `Recorded: ${who} has left the ward.`,
                            undo: (at) => ({
                              type: "UNDO_DEPARTURE",
                              role: s.releaseActor.role,
                              now: at,
                              admissionId,
                              ...(s.releaseActor.role === "ward" ? { actingUnitId: s.releaseActor.actingUnitId } : {}),
                            }),
                            undone: `Undone. ${who} is back in their bed.`,
                          },
                          { completion },
                        );
                      }}
                    >
                      Record departure
                    </Button>
                  ) : null}
                  {phoneClearBlocker && detailRelease ? (
                    <Button
                      variant="pri"
                      className={pageStyles.phFootPri}
                      data-testid="ward-discharge-clear-blocker"
                      onClick={() =>
                        dispatch({
                          type: "CLEAR_BED_RELEASE_BLOCK",
                          role: s.releaseActor.role,
                          now,
                          releaseId: detailRelease.id,
                          actingUnitId: detailRelease.unitId,
                        })
                      }
                    >
                      Clear blocker
                    </Button>
                  ) : null}
                </footer>
              )}
            </aside>
          </div>
        </div>
        {guarded.status === "allowed" && !isPhone ? (
          /* Tablet: the day chart and the barrier panel under the list. A wide screen has both beside the
             list instead, so CSS hides this pair there (one barrier panel on screen at any width). */
          <div className={`${pageStyles.flowCharts} ${redesign.chartsBottom}`}>
            <DischargeDayChart
              days={chartDays}
              selected={highlight?.kind === "day" ? highlight.day : null}
              onSelect={(day) => highlightOn({ kind: "day", day })}
              onClear={() => setHighlight(null)}
            />
            <DischargeBarrierBars
              barriers={barrierCounts}
              counts={nowView ? "releases" : "people"}
              selected={highlight?.kind === "barrier" ? highlight.id : null}
              onSelect={(id) => highlightOn({ kind: "barrier", id })}
              onClear={() => setHighlight(null)}
            />
          </div>
        ) : null}
        <WardPrototypeFooter
          testId="ward-discharge-governance"
          note="This board shows only what a ward has recorded — a release expected, confirmed or discharged, and whether it is currently blocked — and it never adds an expected or unreleased bed into the Ready figure · Not approved for clinical use"
        />
      </main>
    </div>
  );
}
