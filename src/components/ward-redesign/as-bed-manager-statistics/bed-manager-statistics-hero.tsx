"use client";

// Forked from src/components/ward-management/statistics/statistics-hero.tsx (StatisticsHero only; StatCard
// and useStatisticsLive are still imported from there). It draws the bed manager's section nav.

import type { ReactNode } from "react";
import { Download } from "lucide-react";

import { Button, Hero, LiveChip, cx, useIsPhone } from "@/components/wf";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { calendarDateOf, formatInstant, type Instant } from "@/components/ward-management/ward-clock";

import {
  StatisticsSamplesSwitch,
  type StatisticsNavSection,
} from "@/components/ward-management/statistics/statistics-nav";
import { BedManagerStatisticsNav as StatisticsNav } from "./bed-manager-statistics-nav";
import {
  downloadCsv,
  statisticsExportLines,
  type StatisticsExport,
} from "@/components/ward-management/statistics/statistics-csv";
import styles from "@/components/ward-management/statistics/statistics-hero.module.css";
import phoneStyles from "@/components/ward-management/statistics/statistics-phone.module.css";
import {
  useExecutiveStatistics,
  useExecutiveStatisticsControl,
} from "@/components/ward-management/statistics/executive-statistics-context";
import { ExecutiveStatisticsUnavailable } from "@/components/ward-management/statistics/statistics-small-numbers";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";

/**
 * The phone hero's action row (v10 phone): the page's own control (Change ward), if any. The time
 * range pill is gone on phone (audit stats-5, 13 Oct 2026): only Now was live, and the Live pill on
 * the eyebrow line already says the figures are current. It returns when history exists.
 */
function PhoneHeroActions({ titleAction }: { titleAction?: ReactNode }) {
  if (!titleAction) return null;
  return (
    <span className={phoneStyles.heroActions}>
      <span className={styles.phoneTitleAction}>{titleAction}</span>
    </span>
  );
}

/** What a statistics page shows in its hero on a phone, in place of the desktop title and figures. */
type StatisticsPhoneHero = {
  /** A short eyebrow in place of the page's detail line ("ARM · East Metro"). */
  eyebrow?: ReactNode;
  title?: ReactNode;
  sub?: ReactNode;
  lead?: ReactNode;
  stats?: ReactNode;
};

/**
 * The one hero band on every statistics page: eyebrow, title and counts on the first row, the
 * section track with the Live chip and the Samples switch on the second.
 */
export function BedManagerStatisticsHero(props: Omit<Parameters<typeof StatisticsHeroView>[0], "frame">) {
  const control = useExecutiveStatisticsControl();
  const data = useExecutiveStatistics();
  const access = useEffectiveWardAccess();
  if (control.executive || access.role === "executive") {
    if (!data) return <ExecutiveStatisticsUnavailable />;
    return (
      <StatisticsHeroView
        {...props}
        now={data.network.asAt.now}
        paused={control.paused}
        onTogglePause={control.togglePause ?? undefined}
        frame={{
          wardCount: data.wards.length,
          dayZero: new Date(data.network.asAt.dayZero),
          liveNow: data.network.asAt.now,
        }}
      />
    );
  }
  return <OperationalStatisticsHero {...props} />;
}

function OperationalStatisticsHero(props: Omit<Parameters<typeof StatisticsHeroView>[0], "frame">) {
  const { units, dayZero } = useWardFlowSelect("units", "dayZero");
  const liveNow = useWardFlowClock();
  return <StatisticsHeroView {...props} frame={{ wardCount: units.length, dayZero, liveNow }} />;
}

function StatisticsHeroView({
  section,
  slug,
  eyebrow,
  title,
  titleAction,
  stats,
  now: nowProp,
  paused,
  onTogglePause,
  navTestId,
  tools,
  chips,
  exportFigures,
  phone,
  frame,
}: {
  section: StatisticsNavSection;
  /** The unit, service or team the page shows, so its own tab links back to it. */
  slug?: string;
  eyebrow: ReactNode;
  title: ReactNode;
  /** A control beside the title, such as "Change ward". */
  titleAction?: ReactNode;
  stats?: ReactNode;
  now?: Instant;
  paused: boolean;
  onTogglePause?: () => void;
  navTestId?: string;
  /** Page tools on the band (print, the matching index), before the time range. */
  tools?: ReactNode;
  /** v10 count chips (five at most) on their own line under the title, in place of `stats`. */
  chips?: ReactNode;
  /**
   * "Export the figures" in the hero's action slot (v10: the header's one primary is New referral,
   * so Export lives here). Open to every role; it downloads the hero's figures as a CSV.
   */
  exportFigures?: StatisticsExport;
  /** Phone only (v10 phone): a sentence title, its subtitle, a leading ring and up to three figures. */
  phone?: StatisticsPhoneHero;
  frame: { wardCount: number; dayZero: Date; liveNow: Instant };
}) {
  const { wardCount, dayZero, liveNow } = frame;
  const now = nowProp ?? liveNow;
  const isPhone = useIsPhone();
  // With chips (Summary) Export sits in the title row's action slot; with hero figures it leads
  // the band's tool row, so it never adds a row of its own under the figures.
  const exportButton = exportFigures ? (
    <Button
      variant="light"
      size="sm"
      icon={Download}
      data-testid="ward-statistics-export"
      onClick={() =>
        downloadCsv(
          `ward-flow-synthetic-${exportFigures.stem}-figures.csv`,
          statisticsExportLines(
            exportFigures,
            `${calendarDateOf(now, dayZero).toLocaleDateString("en-AU", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              timeZone: "Australia/Perth",
            })} ${formatInstant(now)} AWST`,
          ),
        )
      }
    >
      Export the figures
    </Button>
  ) : null;
  if (isPhone) {
    // v10 phone: eyebrow with the Live chip and its time, the title, up to three figures on
    // hairlines, the range pill (or the page's own control) with pause, then the sections as chips.
    return (
      <>
        <Hero
          level={1}
          className={cx(styles.phoneStatsHero, phone?.lead ? styles.phoneLeadBeside : undefined)}
          eyebrow={eyebrow}
          title={phone?.title ?? title}
          titleMeta={phone?.sub}
          lead={phone?.lead}
          stats={phone?.stats ?? chips ?? stats}
          aside={
            <LiveChip
              state={paused ? "paused" : "live"}
              onHero
              age={formatInstant(now)}
              onTogglePause={onTogglePause}
            />
          }
          bar={titleAction ? <PhoneHeroActions titleAction={titleAction} /> : undefined}
        />
        <div className={styles.phoneNav} data-testid={navTestId}>
          <StatisticsNav
            currentSection={section}
            activeSlug={slug}
            withSamples={false}
            wardCount={wardCount}
            variant="chips"
          />
        </div>
      </>
    );
  }
  return (
    <Hero
      level={1}
      className={cx(styles.statsHero, chips ? styles.chipHero : undefined)}
      eyebrow={eyebrow}
      title={title}
      titleMeta={titleAction ? <span className={styles.titleAction}>{titleAction}</span> : undefined}
      stats={chips ?? stats}
      statsAlign="end"
      aside={chips ? exportButton : undefined}
      bar={
        <div className={styles.navSlot} data-testid={navTestId}>
          <StatisticsNav currentSection={section} activeSlug={slug} withSamples={false} wardCount={wardCount} />
        </div>
      }
      barAside={
        <>
          {chips ? null : exportButton}
          {tools ? <span className={styles.heroTools}>{tools}</span> : null}
          <LiveChip state={paused ? "paused" : "live"} onHero onTogglePause={onTogglePause} />
          <span className={styles.divider} aria-hidden="true" />
          <StatisticsSamplesSwitch />
        </>
      }
    />
  );
}
