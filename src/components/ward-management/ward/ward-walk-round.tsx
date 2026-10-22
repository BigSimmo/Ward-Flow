"use client";

/**
 * Item 23, option D (Josh, 15 Oct 2026), redrawn as Option B (Josh, 20 Oct 2026): Ward home is the
 * run-through and Bed board is the map. The round is a plain list of beds in bed order with a tick
 * once reviewed. Carry on, or a tap on a bed, opens that bed's card on its own screen, with Close to
 * go back to the list and Previous and Reviewed, next bed at the foot.
 *
 * Phone only. Reviewed marks and the changed this round marks
 * live in this screen's memory only: nothing is saved, and a reload starts a fresh round. The round
 * is held by the ward page (`useWalkRound`), so turning the phone and back keeps it. Edits go
 * through the bed's existing panel, so every change uses the same events and checks as before.
 */

import React, { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Check, X } from "lucide-react";
import { Button, buttonClass, StatusGlyph, type WfTone } from "@/components/wf";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import { announceToWardShell } from "../shell/ward-live-region";
import type { BedItem } from "./ward-beds-matrix";
import styles from "./ward-walk-round.module.css";

export type WalkRoundBed = {
  bedNumber: number;
  /** Two digit bed number shown in the strip and the card. */
  number: string;
  name: string;
  note: string;
  /**
   * C3 (phone simplification, 19 Oct 2026): one word for the bed's state ("Ready", "Due out",
   * "Pulled"), from the bed's own state, so a colour never carries the meaning alone. Shown on each
   * row of the round.
   */
  stateWord: string;
  /** What the bed's state is, without any time in it, so a ticking countdown is not a change. */
  changeKey: string;
  glyph: WfTone | null;
  days: string;
  accessibleName: string;
};

/**
 * C3 (phone simplification, 19 Oct 2026): the one word for a bed's state in the round. It reads
 * the same state as the bed tile's note, in the order of `bedGlyphTone`, so the word names what the
 * row's status colour shows. No new state: each word is an existing bed state or tile note.
 */
export function bedStripWord(
  bed: Pick<BedItem, "status" | "statusText" | "blockReason" | "pastDate" | "dischargeBarrier">,
  flags: { free: boolean; preparing: boolean; awayAtEd: boolean; leaving: boolean },
): string {
  if (flags.free) return "Ready";
  if (flags.preparing) return "Preparing";
  if (bed.status === "closed") return BED_STATE_LABELS.closed;
  if (bed.status === "leave" && bed.statusText === "Absent without leave") return "Absent";
  if (bed.blockReason) return "Held up";
  if (flags.awayAtEd) return "At ED";
  if (bed.pastDate) return "Past date";
  if (bed.dischargeBarrier) return "Barrier";
  if (bed.status === "incoming") return "Pulled";
  if (flags.leaving) return "Due out";
  if (bed.status === "leave") return "Leave";
  return BED_STATE_LABELS.occupied;
}

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
  /** The list of beds. It gets each bed's marks and a way to start walking from that bed. */
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
  // The card's close button takes focus when a bed opens, and the Carry on button gets it back when
  // the card closes, so a keyboard never lands on nothing.
  const backRef = useRef<HTMLButtonElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!allReviewed) finishSaidRef.current = false;
    const was = lastNumberRef.current;
    lastNumberRef.current = currentNumber;
    if (currentNumber === was) return;
    if (currentNumber !== undefined) {
      announceToWardShell(`Now on bed ${currentNumber}.`);
      if (was === undefined) {
        // The card takes the page, so it opens at the top whatever the list was scrolled to.
        backRef.current?.closest("section")?.scrollIntoView?.({ block: "start" });
        backRef.current?.focus({ preventScroll: true });
      }
    } else {
      if (allReviewed && !finishSaidRef.current) {
        finishSaidRef.current = true;
        announceToWardShell("Round finished. Every bed reviewed.");
      } else {
        announceToWardShell("Back to the round.");
      }
      if (was !== undefined) headRef.current?.querySelector("button")?.focus();
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
  const progress = (
    <div className={styles.progressLine}>
      <span className={styles.track} aria-hidden="true">
        <i style={{ width: `${ordered.length ? Math.round((reviewedCount / ordered.length) * 100) : 0}%` }} />
      </span>
      <span data-testid="walk-round-progress">
        {reviewedCount} of {ordered.length} reviewed
      </span>
    </div>
  );

  if (current) {
    const isChanged = changed(current);
    const isReviewed = reviewed.has(current.bedNumber);
    return (
      <section
        className={styles.card}
        aria-label={`Bed ${current.number}, ${index + 1} of ${ordered.length}`}
        data-testid="ward-walk-round"
      >
        {/* Close, not a back arrow: the header's Back (shell/ward-back.ts) leaves the ward page on a
            drill-down, so an arrow here would put two arrows on screen that go different places.
            The card closes like a sheet does. */}
        <div className={styles.cardTop}>
          <span className={styles.cardTitle}>
            <b>Bed {current.number}</b>
            <span className={styles.position}>
              {index + 1} of {ordered.length}
            </span>
          </span>
          <button
            ref={backRef}
            type="button"
            className={styles.back}
            aria-label="Close, back to the round"
            onClick={() => {
              setWalking(null);
            }}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        {progress}
        <h3 className={styles.cardName}>{current.name}</h3>
        <p className={styles.cardNote}>
          {current.glyph ? <StatusGlyph tone={current.glyph} size={9} /> : null}
          <span>{current.note}</span>
          {current.days ? <span className={styles.cardDays}>{current.days} stay</span> : null}
        </p>
        <p className={styles.marks}>
          <span className={isChanged ? styles.changed : styles.same}>
            {isChanged ? "Changed this round" : "No change since the round started"}
          </span>
          {isReviewed ? <span className={styles.done}>Reviewed</span> : null}
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
            variant="sec"
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
    );
  }

  return (
    <div className={styles.walk} data-testid="ward-walk-round">
      <div ref={headRef} className={styles.head}>
        {progress}
        <Button variant="pri" onClick={startOrCarryOn}>
          {reviewedCount === 0
            ? "Start the round"
            : allReviewed
              ? "Start again from bed " + (ordered[0]?.number ?? "")
              : "Carry on from bed " + (firstUnreviewed?.number ?? "")}
        </Button>
      </div>
      {renderList(mark, setWalking)}
    </div>
  );
}

/** The small mark a round row shows when its bed changed this round. */
export function WalkRoundRowMarks({ mark }: { mark: WalkRoundMark }) {
  if (!mark.changed) return null;
  return (
    <span className={styles.rowMarks}>
      <span className={styles.changed}>Changed</span>
    </span>
  );
}

/** A reviewed bed's tick at the end of its round row. The row's own name says "reviewed". */
export function WalkRoundTick({ mark }: { mark: WalkRoundMark }) {
  return mark.reviewed ? <Check size={18} className={styles.tick} aria-hidden="true" /> : null;
}
