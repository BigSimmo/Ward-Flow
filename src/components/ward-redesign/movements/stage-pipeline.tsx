import { ChevronRight } from "lucide-react";

import { StatusGlyph, durMinutes } from "@/components/wf";
import type { JourneyStage } from "@/components/ward-management/movements/movements-derivations";
import { STAGE_SHORT } from "@/components/ward-management/movements/movements-screen-helpers";
import type { Instant } from "@/components/ward-management/ward-clock";

import styles from "./movements-redesign.module.css";

/** A wait past this reads amber on its stage, past a day red. */
const WAIT_WARN_MINUTES = 8 * 60;
const WAIT_LONG_MINUTES = 24 * 60;

/**
 * The six stages a movement passes through, left to right, each with how many are there and the
 * oldest wait. One strip replaces the hero's stage chips and the stage headings repeating them.
 * Choosing a stage highlights its rows in the worklist; nothing is hidden.
 */
export function StagePipeline({
  stages,
  now,
  highlight,
  onToggle,
}: {
  stages: readonly JourneyStage[];
  now: Instant;
  highlight: string | null;
  onToggle: (stageId: JourneyStage["id"]) => void;
}) {
  return (
    <nav className={styles.pipeline} aria-label="Stages">
      <ol>
        {stages.map((stage, index) => {
          const oldest = stage.movements[0];
          const wait = oldest ? Math.max(0, now - oldest.openedAt) : undefined;
          const tone =
            wait === undefined
              ? undefined
              : wait >= WAIT_LONG_MINUTES
                ? "danger"
                : wait >= WAIT_WARN_MINUTES
                  ? "warning"
                  : undefined;
          return (
            <li key={stage.id}>
              <button
                type="button"
                className={styles.stage}
                aria-pressed={highlight === `stage:${stage.id}`}
                onClick={() => onToggle(stage.id)}
                title={stage.blurb}
              >
                <span className={styles.stageName}>{STAGE_SHORT[stage.id]}</span>
                <span className={styles.stageCount}>{stage.movements.length}</span>
                <span className={styles.stageWait}>
                  {wait === undefined ? (
                    "none waiting"
                  ) : (
                    <>
                      {tone ? <StatusGlyph tone={tone} size={9} /> : null}
                      oldest {durMinutes(wait)}
                    </>
                  )}
                </span>
              </button>
              {index < stages.length - 1 ? (
                <ChevronRight size={14} aria-hidden="true" className={styles.stageArrow} />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
