import { ChevronRight } from "lucide-react";

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
  return (
    <nav className={styles.pipeline} aria-label="Stages">
      <ol>
        {stages.map((stage, index) => {
          const oldest = stage.movements[0];
          const waits = stage.movements.map((movement) => Math.max(0, now - movement.openedAt));
          const wait = oldest ? Math.max(0, now - oldest.openedAt) : undefined;
          const tone =
            wait === undefined
              ? undefined
              : wait >= accessTarget
                ? "danger"
                : wait >= ED_SEVERE_PRESSURE_WAIT_MINUTES
                  ? "warning"
                  : undefined;
          // Movements redesign (1 Nov 2026): Waiting's tile, a count, the longest wait and a bar of
          // the stage's waits by length, so the eye finds where the long waits pile up.
          const bands: BandCounts = [0, 0, 0, 0];
          for (const waited of waits) bands[waitBand(waited)] += 1;
          const pastTarget = waits.filter((waited) => waited >= accessTarget).length;
          return (
            <li key={stage.id}>
              <button
                type="button"
                className={styles.stage}
                aria-pressed={highlight === `stage:${stage.id}`}
                onClick={() => onToggle(stage.id)}
                title={stage.blurb}
              >
                <span className={styles.stageTop}>
                  <span className={styles.stageCount}>{stage.movements.length}</span>
                  <span className={styles.stageName}>{STAGE_SHORT[stage.id]}</span>
                </span>
                <BandBar bands={bands} className={styles.stageBar} />
                <span className={styles.stageWait}>
                  {wait === undefined ? (
                    "none waiting"
                  ) : (
                    <>
                      {tone ? <StatusGlyph tone={tone} size={9} /> : null}
                      longest <b>{durMinutes(wait)}</b>
                    </>
                  )}
                </span>
                <span className={styles.stagePast} data-past={pastTarget > 0 ? "true" : undefined}>
                  {pastTarget > 0 ? `${pastTarget} past target` : "None past target"}
                </span>
              </button>
              {index < stages.length - 1 ? (
                <ChevronRight size={14} aria-hidden="true" className={styles.stageArrow} />
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className={styles.key}>
        <span className={styles.keyBands} aria-hidden="true">
          {WAIT_BANDS.map((band, index) => (
            <span key={band}>
              <i className={board[`band${index}`]} />
              {band}
            </span>
          ))}
        </span>
        <span>Each bar is that stage&apos;s waits by length. Choose a stage to highlight its rows.</span>
      </p>
    </nav>
  );
}
