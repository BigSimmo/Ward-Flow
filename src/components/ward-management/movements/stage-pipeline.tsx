import { useId } from "react";

import { StatusGlyph, durMinutes } from "@/components/wf";
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
 * Josh's Note 7 (approved mock-up, 8 Nov 2026): a header sums the day in one line (open, past
 * target, which stage holds the longest wait) beside the wait key; each stage is a numbered card
 * with its share of open movements, and only a stage with waits past target gets a red chip.
 */
export function StagePipeline({
  stages,
  now,
  accessTarget,
  highlight,
  onToggle,
}: {
  stages: readonly JourneyStage[];
  now: Instant;
  /** The configured ED access target, in minutes. */
  accessTarget: number;
  highlight: string | null;
  onToggle: (stageId: JourneyStage["id"]) => void;
}) {
  const longest = (stage: (typeof stages)[number]) =>
    stage.movements[0] ? Math.max(0, now - stage.movements[0].openedAt) : -1;
  const worst = stages.reduce<(typeof stages)[number] | undefined>(
    (best, stage) => (best === undefined || longest(stage) > longest(best) ? stage : best),
    undefined,
  );
  const worstStageId = worst !== undefined && longest(worst) >= accessTarget ? worst.id : undefined;
  // The persistent highlight is spoken too, not only drawn (it is no longer a pressed toggle).
  const highlightedNoteId = useId();
  const totalOpen = stages.reduce((sum, stage) => sum + stage.movements.length, 0);
  const pastOf = (stage: JourneyStage) =>
    stage.movements.filter((movement) => now - movement.openedAt >= accessTarget).length;
  const totalPast = stages.reduce((sum, stage) => sum + pastOf(stage), 0);
  const targetLabel = accessTarget % 60 === 0 ? `${accessTarget / 60}h` : durMinutes(accessTarget);
  return (
    <nav className={styles.pipeline} aria-label="Stages">
      {stages.some((stage) => highlight === `stage:${stage.id}`) ? (
        <span id={highlightedNoteId} className="sr-only">
          Highlighted in worklist
        </span>
      ) : null}
      <div className={styles.head}>
        <h2 className={styles.title}>
          Journey stages
          <span className={styles.summary}>
            {totalOpen} open · {totalPast === 0 ? "none" : totalPast} past the {targetLabel} target
            {worst !== undefined && worstStageId !== undefined
              ? ` · ${STAGE_SHORT[worst.id]} holds the longest wait`
              : ""}
          </span>
        </h2>
        <span className={styles.keyBands} aria-label="Wait bands">
          {WAIT_BANDS.map((band, index) => (
            <span key={band}>
              <i className={board[`band${index}`]} aria-hidden="true" />
              {band}
            </span>
          ))}
        </span>
      </div>
      <ol className={styles.flow}>
        {/* Stress test (3 Nov 2026): at most one act-now mark a row, so only the stage whose
            longest wait is the worst past target carries "Longest wait". */}
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
                aria-haspopup="dialog"
                data-highlighted={highlight === `stage:${stage.id}` ? "true" : undefined}
                aria-describedby={highlight === `stage:${stage.id}` ? highlightedNoteId : undefined}
                onClick={() => onToggle(stage.id)}
                title={`${stage.blurb} ${WAIT_BANDS.map((band, bandIndex) => `${band}: ${bands[bandIndex]}`).join(", ")}.`}
              >
                <span className={styles.stageName}>
                  <span className={styles.step} aria-hidden="true">
                    {index + 1}
                  </span>
                  {STAGE_SHORT[stage.id]}
                </span>
                <span className={styles.stageTop}>
                  <span className={styles.stageCount}>{stage.movements.length}</span>
                  <span className={styles.share}>{share}% of open</span>
                </span>
                <BandBar bands={bands} className={styles.stageBar} />
                <span className={styles.foot}>
                  <span className={styles.stageWait}>
                    {wait === undefined ? (
                      "none waiting"
                    ) : (
                      <>
                        {warn ? <StatusGlyph tone="warning" size={9} /> : null}
                        longest <b>{durMinutes(wait)}</b>
                      </>
                    )}
                  </span>
                  <span className={styles.chips}>
                    <span className={styles.stagePast} data-past={pastTarget > 0 ? "true" : undefined}>
                      {pastTarget > 0 ? `${pastTarget} past ${targetLabel}` : "On target"}
                    </span>
                    {stage.id === worstStageId ? <span className={styles.worst}>Longest wait</span> : null}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className={styles.key}>Choose a stage to see its patients. Hover a stage for the count in each wait band.</p>
    </nav>
  );
}
