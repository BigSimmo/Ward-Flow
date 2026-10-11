"use client";

import { useId, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { CalendarRange, Download, Pause, Play, type LucideIcon } from "lucide-react";

import { Button, Card, CardHead, Hero, LiveChip, PhoneSheet, SrOnly, cx, useIsPhone } from "@/components/wf";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import type { StatisticsSection } from "./statistics-sections";

import { StatisticsNav, StatisticsSamplesSwitch, type StatisticsNavSection } from "./statistics-nav";
import { StatisticsRange } from "./statistics-hero-tools";
import { downloadCsv, statisticsExportLines, type StatisticsExport } from "./statistics-csv";
import { RangeChoices } from "./statistics-summary-phone";
import styles from "./statistics-hero.module.css";
import phoneStyles from "./statistics-phone.module.css";

/** The v10 phone eyebrow's section word ("Statistics · Compare"). */
const PHONE_SECTION_WORD: Partial<Record<StatisticsNavSection, string>> = {
  overview: "Overview",
  compare: "Compare",
};

/**
 * The phone hero's action row (v10 phone): the time range as one pill that opens its sheet, or the
 * page's own control (Change ward), then the round pause button.
 */
function PhoneHeroActions({
  titleAction,
  paused,
  onTogglePause,
}: {
  titleAction?: ReactNode;
  paused: boolean;
  onTogglePause: () => void;
}) {
  const [rangeOpen, setRangeOpen] = useState(false);
  return (
    <span className={phoneStyles.heroActions}>
      {titleAction ? (
        <span className={styles.phoneTitleAction}>{titleAction}</span>
      ) : (
        <button
          type="button"
          className={phoneStyles.rangeButton}
          aria-haspopup="dialog"
          onClick={() => setRangeOpen(true)}
          data-testid="ward-statistics-range"
        >
          <CalendarRange size={16} aria-hidden="true" />
          <SrOnly>Time range: </SrOnly>
          <b>Now</b>
          <span className={phoneStyles.rangeMore}>· Shift, 7 and 30 days Preview</span>
        </button>
      )}
      <Button
        variant="onHero"
        iconOnly
        icon={paused ? Play : Pause}
        aria-label="Pause live updates"
        aria-pressed={paused}
        className={phoneStyles.pauseButton}
        onClick={onTogglePause}
      />
      <PhoneSheet
        open={rangeOpen}
        onClose={() => setRangeOpen(false)}
        title="Time range"
        description="Figures are live now. History needs the metrics store."
      >
        <div className={phoneStyles.sheetBody}>
          <RangeChoices onNow={() => setRangeOpen(false)} />
        </div>
      </PhoneSheet>
    </span>
  );
}

/**
 * Live figures that can be held still. While paused, the screen keeps reading the state and clock
 * it had at the moment of pausing, so a reader can finish a table without it reordering under them.
 */
export function useStatisticsLive() {
  const state = useWardFlow();
  const now = useWardFlowClock();
  const [held, setHeld] = useState<{ state: typeof state; now: Instant } | null>(null);
  return {
    state: held ? held.state : state,
    now: held ? held.now : now,
    paused: held !== null,
    togglePause: () => setHeld((current) => (current ? null : { state, now })),
  };
}

/** What a statistics page shows in its hero on a phone, in place of the desktop title and figures. */
export type StatisticsPhoneHero = {
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
export function StatisticsHero({
  section,
  slug,
  eyebrow,
  title,
  titleAction,
  stats,
  paused,
  onTogglePause,
  navTestId,
  tools,
  chips,
  exportFigures,
  phone,
}: {
  section: StatisticsNavSection;
  /** The unit, service or team the page shows, so its own tab links back to it. */
  slug?: string;
  eyebrow: ReactNode;
  title: ReactNode;
  /** A control beside the title, such as "Change ward". */
  titleAction?: ReactNode;
  stats?: ReactNode;
  paused: boolean;
  onTogglePause: () => void;
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
}) {
  const wardCount = useWardFlow().units.length;
  const now = useWardFlowClock();
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
          statisticsExportLines(exportFigures, formatInstant(now)),
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
          aside={<LiveChip state={paused ? "paused" : "live"} onHero age={formatInstant(now)} />}
          bar={<PhoneHeroActions titleAction={titleAction} paused={paused} onTogglePause={onTogglePause} />}
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
          <StatisticsRange />
          <LiveChip state={paused ? "paused" : "live"} onHero onTogglePause={onTogglePause} />
          <span className={styles.divider} aria-hidden="true" />
          <StatisticsSamplesSwitch />
        </>
      }
    />
  );
}

/**
 * A statistics card: the v6 card, named by its own heading so it is a landmark, and marked as a
 * statistics panel for the shared presentation checks.
 */
export function StatCard({
  title,
  meta,
  icon,
  aside,
  action,
  className,
  children,
  ...rest
}: Omit<ComponentPropsWithoutRef<"section">, "title"> & {
  title: ReactNode;
  meta?: ReactNode;
  icon?: LucideIcon;
  aside?: ReactNode;
  action?: ReactNode;
}) {
  const id = useId();
  return (
    <Card aria-labelledby={id} data-ward-primitive="panel" className={cx(styles.card, className)} {...rest}>
      <div data-ward-primitive="panel-header">
        <CardHead id={id} title={title} meta={meta} icon={icon} aside={aside} action={action} />
      </div>
      {children}
    </Card>
  );
}

/**
 * The v6 frame for a statistics section page: one hero band (section name and clock in the
 * eyebrow), the page's cards, and the synthetic-data footer.
 */
export function StatisticsPage({
  section,
  navSection,
  slug,
  testId,
  title,
  titleAction,
  stats,
  now,
  paused,
  onTogglePause,
  eyebrowLabel,
  eyebrowDetail,
  tools,
  exportFigures,
  phone,
  children,
}: {
  section: StatisticsSection;
  navSection: StatisticsNavSection;
  slug?: string;
  testId: string;
  title: ReactNode;
  titleAction?: ReactNode;
  stats?: ReactNode;
  now: Instant;
  paused: boolean;
  onTogglePause: () => void;
  /** The eyebrow's lead word when the title already names the section. Defaults to the section label. */
  eyebrowLabel?: string;
  /** What the page is about (a ward's hospital and kind), in place of the clock. */
  eyebrowDetail?: ReactNode;
  tools?: ReactNode;
  /** "Export the figures" in the hero (see `StatisticsHero`). */
  exportFigures?: StatisticsExport;
  /** The phone hero's own title, subtitle and figures (see `StatisticsHero`). */
  phone?: StatisticsPhoneHero;
  children: ReactNode;
}) {
  const isPhone = useIsPhone();
  return (
    <div className={styles.page} data-testid={testId} data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <StatisticsHero
          section={navSection}
          slug={slug}
          eyebrow={
            isPhone ? (
              phone?.eyebrow ? (
                <>
                  <SrOnly>
                    <span data-testid="ward-statistics-section-eyebrow">{eyebrowLabel ?? section.label}</span> ·{" "}
                    {/* The page's identity (for a service, its hospitals) stays readable. */}
                    {eyebrowDetail ? <>{eyebrowDetail} · </> : null}
                  </SrOnly>
                  {phone.eyebrow}
                </>
              ) : eyebrowDetail ? (
                <>
                  <SrOnly>
                    <span data-testid="ward-statistics-section-eyebrow">{eyebrowLabel ?? section.label}</span> ·{" "}
                  </SrOnly>
                  {eyebrowDetail}
                </>
              ) : (eyebrowLabel ?? section.label).startsWith("Statistics ·") ? (
                <span data-testid="ward-statistics-section-eyebrow">{eyebrowLabel ?? section.label}</span>
              ) : (
                <>
                  Statistics ·{" "}
                  <span data-testid="ward-statistics-section-eyebrow">
                    {PHONE_SECTION_WORD[navSection] ?? eyebrowLabel ?? section.label}
                  </span>
                </>
              )
            ) : (
              <>
                <span data-testid="ward-statistics-section-eyebrow">{eyebrowLabel ?? section.label}</span>
                {eyebrowDetail ? <> · {eyebrowDetail}</> : ` · as at ${formatInstant(now)}`}
              </>
            )
          }
          title={title}
          titleAction={titleAction}
          stats={stats}
          paused={paused}
          onTogglePause={onTogglePause}
          tools={tools}
          exportFigures={exportFigures}
          phone={phone}
        />
        {children}
        <WardPrototypeFooter testId="ward-statistics-section-footer" note="Synthetic data" />
      </main>
    </div>
  );
}
