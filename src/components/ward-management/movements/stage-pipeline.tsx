import { SrOnly, StatusGlyph, durMinutes } from "@/components/wf";
import { ED_SEVERE_PRESSURE_WAIT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import type { JourneyStage } from "./movements-derivations";
import { STAGE_SHORT } from "./movements-screen-helpers";
import type { Instant } from "@/components/ward-management/ward-clock";

import { BandBar } from "@/components/ward-management/delays/delays-board-parts";
import { WAIT_BANDS, waitBand, type BandCounts } from "@/components/ward-management/delays/delays-board-model";
import board from "@/components/ward-management/delays/delays-board.module.css";
import styles from "./stage-pipeline.module.css";

/**
 * The six stages a movement passes through, left to right, each with how many are there and the
 * longest wait (time since the journey opened, as the hero's "Longest wait" measures it). One strip
 * replaces the hero's stage chips; the worklist keeps its stage headings (overview and detail).
 * Choosing a stage highlights its rows in the worklist; nothing is hidden. Tablet and laptop only:
 * the phone keeps its sliding stage chips under the band (Movements redesign, 31 Oct 2026).
 *
 * The wait colours use the same lines as the hero's pills: amber from the severe-pressure default
 * ("Over 8h"), red past the configured ED access target ("Past 24h").
 *
 * Josh's Note 7 (approved mock-up, 8 Nov 2026; polished 9 Nov): a header sums the day in one line
 * (open, and which stage holds the longest wait; the hero already counts those past target) beside
 * the wait key; the stages are numbered columns split by hairlines, each with its share of open
 * movements, and only a stage with waits past target gets a red chip.
 *
 * Compact pass (Josh, 18 Nov 2026, D-265): each stage is one line (number, name, count, share), the
 * wait bar, then the longest wait with any past-target chip beside it. On a tablet the six stages
 * stay in one row that scrolls sideways instead of wrapping to two rows.
 *
 * Simplification mock-up (26 Nov 2026): the rail is the worklist's filter. Pressing a stage shows
 * only that stage's movements, longest wait first; pressing it again shows every stage. The chosen
 * stage takes the accent tint and ring, and is a pressed toggle for assistive technology.
 */
export function StagePipeline({
  stages,
  now,
  accessTarget,
  selected,
  onToggle,
}: {
  stages: readonly JourneyStage[];
  now: Instant;
  /** The configured ED access target, in minutes. */
  accessTarget: number;
  /** The stage the worklist is filtered to, or null for every stage. */
  selected: JourneyStage["id"] | null;
  onToggle: (stageId: JourneyStage["id"]) => void;
}) {
  const longest = (stage: (typeof stages)[number]) =>
    stage.movements[0] ? Math.max(0, now - stage.movements[0].openedAt) : -1;
  const worst = stages.reduce<(typeof stages)[number] | undefined>(
    (best, stage) => (best === undefined || longest(stage) > longest(best) ? stage : best),
    undefined,
  );
  const worstStageId = worst !== undefined && longest(worst) >= accessTarget ? worst.id : undefined;
  const totalOpen = stages.reduce((sum, stage) => sum + stage.movements.length, 0);
  const pastOf = (stage: JourneyStage) =>
    stage.movements.filter((movement) => now - movement.openedAt >= accessTarget).length;
  const targetLabel = accessTarget % 60 === 0 ? `${accessTarget / 60}h` : durMinutes(accessTarget);
  return (
    <nav className={styles.pipeline} aria-label="Stages">
      <div className={styles.head}>
        {/* D-265 (18 Nov 2026): the heading sits on the card edge with no icon tile, in line with the
            tabs above and the traffic bar below, and names the longest wait itself. */}
        <h2 className={styles.title}>
          Stages
          {/* The hero's "Open movements" figure says the total; this line keeps only the longest wait. */}
          {worst !== undefined && worstStageId !== undefined ? (
            <span
              className={styles.summary}
            >{`Longest wait in ${STAGE_SHORT[worst.id]}, ${durMinutes(longest(worst))}`}</span>
          ) : null}
        </h2>
        {/* Each stage's tooltip still gives its count in each wait band (Note 7, 9 Nov 2026). */}
        <span className={styles.aside}>
          {selected === null ? null : <span className={styles.hint}>Choose it again to show every stage</span>}
          <span className={styles.keyBands} aria-label="Wait bands">
            <span className={styles.keyLabel}>Wait</span>
            {WAIT_BANDS.map((band, index) => (
              <span key={band}>
                <i className={board[`band${index}`]} aria-hidden="true" />
                {band}
              </span>
            ))}
          </span>
        </span>
      </div>
      <ol className={styles.flow}>
        {/* Stress test (3 Nov 2026): at most one act-now mark a stage, so the stage holding the
            longest wait is named in the header, not given a second red chip. */}
        {stages.map((stage, index) => {
          const oldest = stage.movements[0];
          const waits = stage.movements.map((movement) => Math.max(0, now - movement.openedAt));
          const wait = oldest ? Math.max(0, now - oldest.openedAt) : undefined;
          const warn = wait !== undefined && wait < accessTarget && wait >= ED_SEVERE_PRESSURE_WAIT_MINUTES;
          // Movements redesign (1 Nov 2026): a bar of the stage's waits by length, so the eye finds
          // where the long waits pile up.
          const bands: BandCounts = [0, 0, 0, 0];
          for (const waited of waits) bands[waitBand(waited)] += 1;
          const pastTarget = pastOf(stage);
          const share = totalOpen === 0 ? 0 : Math.round((stage.movements.length / totalOpen) * 100);
          return (
            <li key={stage.id} className={styles.item}>
              <button
                type="button"
                className={styles.stage}
                aria-pressed={selected === stage.id}
                data-highlighted={selected === stage.id ? "true" : undefined}
                onClick={() => onToggle(stage.id)}
                title={`${stage.blurb} ${WAIT_BANDS.map((band, bandIndex) => `${band}: ${bands[bandIndex]}`).join(", ")}.`}
              >
                <span className={styles.stageName}>
                  <span className={styles.step} aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className={styles.nameText}>{STAGE_SHORT[stage.id]}</span>
                  <span className={styles.stageCount}>{stage.movements.length}</span>
                  <span className={styles.share}>
                    {share}%<SrOnly> of open</SrOnly>
                  </span>
                </span>
                <BandBar bands={bands} className={styles.stageBar} />
                <span className={styles.foot}>
                  <span className={styles.stageWait}>
                    {wait === undefined ? (
                      "None waiting"
                    ) : (
                      <>
                        {warn ? <StatusGlyph tone="warning" size={9} /> : null}
                        <SrOnly>longest </SrOnly>
                        <b>{durMinutes(wait)}</b>
                      </>
                    )}
                  </span>
                  {/* D-265: only a stage with waits past target says so; "On target" is gone. */}
                  {pastTarget > 0 ? (
                    <span className={styles.stagePast}>{`${pastTarget} over ${targetLabel}`}</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
