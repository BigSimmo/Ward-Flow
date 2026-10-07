"use client";

import { useId, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardHead, Hero, LiveChip, cx } from "@/components/wf";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import type { StatisticsSection } from "./statistics-sections";

import { StatisticsNav, StatisticsSamplesSwitch, type StatisticsNavSection } from "./statistics-nav";
import styles from "./statistics-hero.module.css";

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
}) {
  const wardCount = useWardFlow().units.length;
  return (
    <Hero
      level={1}
      className={styles.statsHero}
      eyebrow={eyebrow}
      title={title}
      titleMeta={titleAction ? <span className={styles.titleAction}>{titleAction}</span> : undefined}
      stats={stats}
      statsAlign="end"
      bar={
        <div className={styles.navSlot} data-testid={navTestId}>
          <StatisticsNav currentSection={section} activeSlug={slug} withSamples={false} wardCount={wardCount} />
        </div>
      }
      barAside={
        <>
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
  children: ReactNode;
}) {
  return (
    <div className={styles.page} data-testid={testId} data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <StatisticsHero
          section={navSection}
          slug={slug}
          eyebrow={
            <>
              <span data-testid="ward-statistics-section-eyebrow">{eyebrowLabel ?? section.label}</span>
              {eyebrowDetail ? <> · {eyebrowDetail}</> : ` · as at ${formatInstant(now)}`}
            </>
          }
          title={title}
          titleAction={titleAction}
          stats={stats}
          paused={paused}
          onTogglePause={onTogglePause}
        />
        {children}
        <WardPrototypeFooter testId="ward-statistics-section-footer" note="Synthetic data" />
      </main>
    </div>
  );
}
