"use client";

/**
 * Item 23, option D (Josh, 15 Oct 2026): the phone walk round. A bed strip in bed order sits above
 * the grouped list, worst first. Tapping a bed in the strip or the list walks the ward one bed at a
 * time in bed order, with Reviewed, next bed as the main button and Back to list to return.
 *
 * Phone only. Reviewed marks and the changed this round marks
 * live in this screen's memory only: nothing is saved, and a reload starts a fresh round. The round
 * is held by the ward page (`useWalkRound`), so turning the phone and back keeps it. Edits go
 * through the bed's existing panel, so every change uses the same events and checks as before.
 */

import React, { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Button, buttonClass, StatusGlyph, type WfTone } from "@/components/wf";
import { announceToWardShell } from "../shell/ward-live-region";
import styles from "./ward-walk-round.module.css";

export type WalkRoundBed = {
  bedNumber: number;
  /** Two digit bed number shown in the strip and the card. */
  number: string;
  name: string;
  note: string;
  /** What the bed's state is, without any time in it, so a ticking countdown is not a change. */
  changeKey: string;
  glyph: WfTone | null;
  days: string;
  accessibleName: string;
};

export type WalkRoundMark = { reviewed: boolean; changed: boolean };

export type WalkRoundState = {
  /** The ward this round belongs to; a different ward starts a fresh round. */
  scope: string;
  reviewed: ReadonlySet<number>;
  walking: number | null;
  /** Each bed's change key when the round started. */
  startKeys: ReadonlyMap<number, string>;
};

function freshRound(scope: string, beds: readonly WalkRoundBed[]): WalkRoundState {
  return {
    scope,
    reviewed: new Set(),
    walking: null,
    startKeys: new Map(beds.map((bed) => [bed.bedNumber, bed.changeKey])),
  };
}

/** The round's state, held above the phone and desktop branch so a layout change keeps it. */
export function useWalkRound(
  scope: string,
  beds: readonly WalkRoundBed[],
): [WalkRoundState, Dispatch<SetStateAction<WalkRoundState>>] {
  const [round, setRound] = useState(() => freshRound(scope, beds));
  if (round.scope !== scope) {
    const next = freshRound(scope, beds);
    setRound(next);
    return [next, setRound];
  }
  return [round, setRound];
}

type Props = {
  beds: WalkRoundBed[];
  round: WalkRoundState;
  setRound: Dispatch<SetStateAction<WalkRoundState>>;
  /** Opens the bed's existing panel, where its status is updated. */
  onOpenBed: (bedNumber: number) => void;
  /** Records the control that opened the panel, so focus returns to it when the panel closes. */
  registerTrigger?: (bedNumber: number, element: HTMLButtonElement | null) => void;
  /** The grouped list. It gets each bed's marks and a way to start walking from that bed. */
  renderList: (mark: (bedNumber: number) => WalkRoundMark, walkFrom: (bedNumber: number) => void) => React.ReactNode;
};

export function WardWalkRound({ beds, round, setRound, onOpenBed, registerTrigger, renderList }: Props) {
  const ordered = [...beds].sort((left, right) => left.bedNumber - right.bedNumber);
  const { reviewed, walking, startKeys } = round;
  const setWalking = (bedNumber: number | null) => {
    setRound((previous) => ({ ...previous, walking: bedNumber }));
  };

  const changed = (bed: WalkRoundBed) => {
    const start = startKeys.get(bed.bedNumber);
    return start !== undefined && start !== bed.changeKey;
  };
  const mark = (bedNumber: number): WalkRoundMark => {
    const bed = ordered.find((item) => item.bedNumber === bedNumber);
    return { reviewed: reviewed.has(bedNumber), changed: bed ? changed(bed) : false };
  };
  const reviewedCount = ordered.filter((bed) => reviewed.has(bed.bedNumber)).length;
  const allReviewed = ordered.length > 0 && reviewedCount === ordered.length;
  const index = walking === null ? -1 : ordered.findIndex((bed) => bed.bedNumber === walking);
  const current = index >= 0 ? ordered[index] : undefined;
  const firstUnreviewed = ordered.find((bed) => !reviewed.has(bed.bedNumber)) ?? ordered[0];

  // Screen readers hear the bed the round is on (also when the card comes back mid round) and,
  // when the round leaves the beds, whether it finished or went back to the list. Nothing is said
  // for a round that has not started.
  const currentNumber = current?.number;
  const lastNumberRef = useRef<string | undefined>(undefined);
  // "Finished" is said once per round; a bed reopened afterwards just goes back to the list.
  const finishSaidRef = useRef(false);
  useEffect(() => {
    if (!allReviewed) finishSaidRef.current = false;
    const was = lastNumberRef.current;
    lastNumberRef.current = currentNumber;
    if (currentNumber === was) return;
    if (currentNumber !== undefined) {
      announceToWardShell(`Now on bed ${currentNumber}.`);
    } else if (allReviewed && !finishSaidRef.current) {
      finishSaidRef.current = true;
      announceToWardShell("Walk round finished. Every bed reviewed.");
    } else {
      announceToWardShell("Back to the bed list.");
    }
    // Only a change of bed speaks; `allReviewed` is read as it is at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNumber]);

  const reviewAndNext = () => {
    if (!current) return;
    const next = ordered[index + 1];
    setRound((previous) => ({
      ...previous,
      reviewed: new Set(previous.reviewed).add(current.bedNumber),
      walking: next ? next.bedNumber : null,
    }));
  };
  const startOrCarryOn = () => {
    // A finished round starts again from nothing: no reviewed marks and a new change baseline.
    if (allReviewed) {
      setRound({ ...freshRound(round.scope, beds), walking: ordered[0]?.bedNumber ?? null });
      return;
    }
    if (firstUnreviewed) setWalking(firstUnreviewed.bedNumber);
  };

  return (
    <div className={styles.walk} data-testid="ward-walk-round">
      <div className={styles.head}>
        <div className={styles.progressLine}>
          <span className={styles.track} aria-hidden="true">
            <i style={{ width: `${ordered.length ? Math.round((reviewedCount / ordered.length) * 100) : 0}%` }} />
          </span>
          <span data-testid="walk-round-progress">
            {reviewedCount} of {ordered.length} reviewed
          </span>
        </div>
        <div className={styles.strip} role="group" aria-label="Beds in bed order">
          {ordered.map((bed) => {
            const isReviewed = reviewed.has(bed.bedNumber);
            return (
              <button
                key={bed.bedNumber}
                type="button"
                className={styles.stripBed}
                data-reviewed={isReviewed ? "true" : undefined}
                data-tone={bed.glyph ?? undefined}
                aria-current={bed.bedNumber === walking ? "true" : undefined}
                aria-label={`Walk from bed ${bed.number}${isReviewed ? ", reviewed" : ""}`}
                onClick={() => {
                  setWalking(bed.bedNumber);
                }}
              >
                {bed.number}
              </button>
            );
          })}
        </div>
        {current ? null : (
          <Button variant="pri" size="sm" onClick={startOrCarryOn}>
            {reviewedCount === 0
              ? "Start walk round"
              : allReviewed
                ? "Walk again from bed " + (ordered[0]?.number ?? "")
                : "Carry on from bed " + (firstUnreviewed?.number ?? "")}
          </Button>
        )}
      </div>

      {current ? (
        <section className={styles.card} aria-label={`Bed ${current.number}, ${index + 1} of ${ordered.length}`}>
          <div className={styles.cardTop}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setWalking(null);
              }}
            >
              Back to list
            </Button>
            <span className={styles.position}>
              {index + 1} of {ordered.length}
            </span>
          </div>
          <h3 className={styles.cardName}>
            <span className={styles.cardNo}>Bed {current.number}</span>
            <span>{current.name}</span>
          </h3>
          <p className={styles.cardNote}>
            {current.glyph ? <StatusGlyph tone={current.glyph} size={9} /> : null}
            <span>{current.note}</span>
            {current.days ? <span className={styles.cardDays}>{current.days} stay</span> : null}
          </p>
          <p className={styles.marks}>
            {changed(current) ? <span className={styles.changed}>Changed this round</span> : null}
            {reviewed.has(current.bedNumber) ? <span className={styles.done}>Reviewed</span> : null}
          </p>
          <button
            type="button"
            className={buttonClass({ variant: "sec", size: "md", iconOnly: false })}
            aria-haspopup="dialog"
            ref={(element) => registerTrigger?.(current.bedNumber, element)}
            onClick={() => {
              onOpenBed(current.bedNumber);
            }}
          >
            Update this bed
          </button>
          <div className={styles.cardFoot}>
            <Button
              variant="ghost"
              disabled={index === 0}
              onClick={() => {
                const previous = ordered[index - 1];
                if (previous) setWalking(previous.bedNumber);
              }}
            >
              Previous
            </Button>
            <Button variant="pri" onClick={reviewAndNext}>
              {index === ordered.length - 1 ? "Reviewed, finish" : "Reviewed, next bed"}
            </Button>
          </div>
        </section>
      ) : (
        renderList(mark, setWalking)
      )}
    </div>
  );
}

/** The small marks a grouped list row shows while the walk round is on. */
export function WalkRoundRowMarks({ mark }: { mark: WalkRoundMark }) {
  if (!mark.reviewed && !mark.changed) return null;
  return (
    <span className={styles.rowMarks}>
      {mark.changed ? <span className={styles.changed}>Changed</span> : null}
      {mark.reviewed ? <span className={styles.done}>Reviewed</span> : null}
    </span>
  );
}
