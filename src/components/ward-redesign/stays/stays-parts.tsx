"use client";

import type { ReactNode } from "react";

import { designationSummary } from "@/components/ward-management/ward-bed-designation";
import type { HealthService, Site, Unit } from "@/components/ward-management/ward-model";
import type { BedStateCounts } from "@/components/ward-management/ward-bed-states";
import boardStyles from "@/components/ward-management/board/board.module.css";
import { Hero, HeroStat } from "@/components/wf";

import styles from "./stays-redesign.module.css";

/**
 * Stays and discharges, redesigned: the same full-width hero as Ward home, in place of the
 * rounded dark card. Everything the old header said is still here, in the hero's slots: the
 * ward's name (as the h2 the board's heading rules keep, with its test id), the site and service,
 * the locked and open split, Ready now and the four band figures, the being-made-ready and
 * constraint sentences, and the As at stamp in the heading area (DB-10).
 */
export function StaysHero({
  available,
  constraint,
  incoming,
  outgoing,
  pendingPreparation,
  pulledIn,
  service,
  site,
  stamp,
  states,
  unit,
  nav,
  tools,
}: {
  available: number;
  constraint: string | null;
  incoming: number;
  outgoing: number;
  pendingPreparation: number;
  pulledIn: number;
  service: HealthService | null;
  site: Site;
  stamp: { time: string | null; dayNote: string };
  states: BedStateCounts;
  unit: Unit;
  /** Ward home and Stays and discharges, this one selected. */
  nav: ReactNode;
  /** Show shift brief and Change ward, wired as today. */
  tools: ReactNode;
}) {
  const sentences = [
    pendingPreparation > 0
      ? `${pendingPreparation} of them ${pendingPreparation === 1 ? "is" : "are"} still being made ready. It stays counted but is not offered until the ward taps Ready.`
      : null,
    service !== null
      ? service === site.service
        ? `The Service selector is set to ${service}, which is this ward's own service.`
        : `The Service selector is set to ${service}. This ward is in ${site.service}. The board always shows this one ward.`
      : null,
    constraint,
  ].filter((line): line is string => line !== null);
  return (
    <Hero
      testId="ward-board-header"
      eyebrow={
        <span data-testid="ward-board-site-name">
          Ward · {site.name} · {site.service}
        </span>
      }
      title={
        <span id="ward-board-unit-name" className={boardStyles.unitName} data-testid="ward-board-unit-name">
          {unit.name}
        </span>
      }
      titleMeta={
        <span data-testid="ward-board-designation">
          {unit.beds} bed{unit.beds === 1 ? "" : "s"} · {designationSummary(unit)}
        </span>
      }
      aside={
        <span className={styles.asAt} data-testid="ward-board-as-at">
          {stamp.time === null ? "As at — the moment shown is not recorded." : `As at ${stamp.time}`}
        </span>
      }
      bar={
        <div className={styles.stats} data-testid="ward-board-band-stats">
          <HeroStat value={available} label="Ready now" />
          <HeroStat value={states.occupied} label="Occupied" />
          {/* Third, because a phone hero shows three: a pulled bed not arrived is the one to chase. */}
          <HeroStat value={pulledIn} label="Pulled, not arrived" tone={pulledIn > 0 ? "danger" : undefined} />
          <HeroStat value={outgoing} label="Going out today and tomorrow" />
          <HeroStat value={incoming} label="Coming in" />
        </div>
      }
      foot={
        <span className={styles.heroFoot}>
          {nav}
          {sentences.length > 0 ? <span className={styles.heroNote}>{sentences.join(" ")}</span> : null}
          {stamp.time !== null ? <span className={styles.heroNote}>{stamp.dayNote}</span> : null}
        </span>
      }
      footAside={tools}
      footKind="actions"
    />
  );
}

type Figure = { key: string; label: string; value: number; led?: boolean; note?: string };

/** The figures the hero already shows, so the line below does not say them twice. */
const IN_HERO = new Set(["availableNow", "pulled"]);

/**
 * The ten day figures as one line, not ten boxes, under the heading "Also on this ward". Ready now
 * and Pulled are in the hero already; every other figure stays, and the one Going out is built
 * from still says so, in words.
 */
export function AlsoOnWard({ figures }: { figures: Figure[] }) {
  return (
    <section className={styles.also} aria-labelledby="ward-board-triage-heading" data-testid="ward-board-triage">
      <h2 id="ward-board-triage-heading" className={styles.alsoTitle}>
        Also on this ward
      </h2>
      <ul className={styles.alsoList}>
        {figures
          .filter((figure) => !IN_HERO.has(figure.key))
          .map((figure) => (
            <li
              key={figure.key}
              data-testid={`ward-board-figure-${figure.key}`}
              data-figure-led={figure.led ? "true" : "false"}
            >
              <b>{figure.value}</b> {figure.label.charAt(0).toLowerCase() + figure.label.slice(1)}
              {figure.note ? <span className={styles.alsoNote}> {figure.note}</span> : null}
              {figure.led ? <span className={styles.alsoNote}> · shown in Going out</span> : null}
            </li>
          ))}
      </ul>
    </section>
  );
}
