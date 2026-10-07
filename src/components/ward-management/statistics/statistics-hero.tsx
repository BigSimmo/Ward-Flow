"use client";

import { useId, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardHead, Hero, LiveChip, cx } from "@/components/wf";
import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import type { Instant } from "@/components/ward-management/ward-clock";

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
