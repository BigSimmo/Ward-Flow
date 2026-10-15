"use client";

/**
 * Item 23, option D (Josh, 15 Oct 2026): the phone walk round. A bed strip in bed order sits above
 * the grouped list, worst first. Tapping a bed in the strip or the list walks the ward one bed at a
 * time in bed order, with Reviewed, next bed as the main button and Back to list to return.
 *
 * Phone only and behind the top25-walk-round flag. Reviewed marks and the changed this round marks
 * live in this screen's memory only: nothing is saved, and a reload starts a fresh round. Edits go
 * through the bed's existing panel, so every change uses the same events and checks as before.
 */

import React, { useState } from "react";
import { Button, StatusGlyph, type WfTone } from "@/components/wf";
import styles from "./ward-walk-round.module.css";

export type WalkRoundBed = {
  bedNumber: number;
  /** Two digit bed number shown in the strip and the card. */
  number: string;
  name: string;
  note: string;
  glyph: WfTone | null;
  days: string;
  accessibleName: string;
};

export type WalkRoundMark = { reviewed: boolean; changed: boolean };

type Props = {
  beds: WalkRoundBed[];
  /** Opens the bed's existing panel, where its status is updated. */
  onOpenBed: (bedNumber: number) => void;
  /** The grouped list. It gets each bed's marks and a way to start walking from that bed. */
  renderList: (mark: (bedNumber: number) => WalkRoundMark, walkFrom: (bedNumber: number) => void) => React.ReactNode;
};

export function WardWalkRound({ beds, onOpenBed, renderList }: Props) {
  const ordered = [...beds].sort((left, right) => left.bedNumber - right.bedNumber);
  // The round starts when the screen opens: a bed whose note moves after that is changed this round.
  const [startNotes] = useState(() => new Map(beds.map((bed) => [bed.bedNumber, bed.note])));
  const [reviewed, setReviewed] = useState<ReadonlySet<number>>(() => new Set());
  const [walking, setWalking] = useState<number | null>(null);

  const changed = (bed: WalkRoundBed) => {
    const start = startNotes.get(bed.bedNumber);
    return start !== undefined && start !== bed.note;
  };
  const mark = (bedNumber: number): WalkRoundMark => {
    const bed = ordered.find((item) => item.bedNumber === bedNumber);
    return { reviewed: reviewed.has(bedNumber), changed: bed ? changed(bed) : false };
  };
  const reviewedCount = ordered.filter((bed) => reviewed.has(bed.bedNumber)).length;
  const index = walking === null ? -1 : ordered.findIndex((bed) => bed.bedNumber === walking);
  const current = index >= 0 ? ordered[index] : undefined;
  const firstUnreviewed = ordered.find((bed) => !reviewed.has(bed.bedNumber)) ?? ordered[0];

  const reviewAndNext = () => {
    if (!current) return;
    setReviewed((previous) => new Set(previous).add(current.bedNumber));
    const next = ordered[index + 1];
    setWalking(next ? next.bedNumber : null);
  };

  return (
    <div className={styles.walk} data-testid="ward-walk-round">
      <div className={styles.head}>
        <div className={styles.progressLine}>
          <span className={styles.track} aria-hidden="true">
            <i style={{ width: `${ordered.length ? Math.round((reviewedCount / ordered.length) * 100) : 0}%` }} />
          </span>
          <span role="status">
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
          <Button
            variant="pri"
            size="sm"
            onClick={() => {
              if (firstUnreviewed) setWalking(firstUnreviewed.bedNumber);
            }}
          >
            {reviewedCount === 0
              ? "Start walk round"
              : reviewedCount === ordered.length
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
          <Button
            variant="sec"
            onClick={() => {
              onOpenBed(current.bedNumber);
            }}
          >
            Update this bed
          </Button>
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
