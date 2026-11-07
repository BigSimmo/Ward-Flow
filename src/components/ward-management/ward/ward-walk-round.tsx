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
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button, buttonClass, Segmented, StatusGlyph, type WfTone } from "@/components/wf";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import { announceToWardShell } from "../shell/ward-live-region";
import type { BedItem } from "./ward-beds-matrix";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { observationSummary } from "@/components/ward-management/ward-observation";
import { ownHistoryState } from "./ward-screen-helpers";
import styles from "./ward-walk-round.module.css";

export type WalkRoundBed = {
  bedNumber: number;
  /** Two digit bed number shown in the strip and the card. */
  number: string;
  name: string;
  note: string;
  /**
   * C3 (phone simplification, 19 Oct 2026): one word for the bed's state ("Ready", "Discharge due",
   * "Pulled"), from the bed's own state, so a colour never carries the meaning alone. Shown on each
   * row of the round.
   */
  stateWord: string;
  /** What the bed's state is, without any time in it, so a ticking countdown is not a change. */
  changeKey: string;
  glyph: WfTone | null;
  days: string;
  accessibleName: string;
  /**
   * WH4 (Josh, 4 Nov 2026): someone is in the bed (in it, on leave or pulled). The round walks
   * only these by default and skips empty beds. Absent counts as occupied.
   */
  occupied?: boolean;
  /** The recorded observation level as one line, such as "General, hourly". */
  observation?: string | null;
  /** The one flag a round needs, such as "Held up, Awaiting clean", or null. */
  flag?: string | null;
  /** The planned discharge date, already worded for this moment. */
  dueOut?: string | null;
  /** An expected discharge the ward can confirm from the card, without opening the bed. */
  confirmReleaseId?: string;
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
  if (bed.dischargeBarrier) return "Held up";
  if (bed.status === "incoming") return "Pulled";
  if (flags.leaving) return "Discharge due";
  if (bed.status === "leave") return "Leave";
  return BED_STATE_LABELS.occupied;
}

/** The parts of a Ward home bed row the round reads (`bedRows` in ward-home-tab.tsx). */
type WalkRoundSourceRow = {
  bed: BedItem;
  free: boolean;
  number: string;
  name: string;
  note: string;
  stateWord: string;
  stripWord: string;
  glyph: WfTone | null;
  days: string;
  accessibleName: string;
};

/**
 * The round's beds from Ward home's bed rows. WH4 (Josh, 4 Nov 2026): each card also carries what a
 * round needs, the observation level, the one flag, the date due out, and an expected discharge the
 * ward can confirm there and then. Nothing new is derived: each is a field the bed board already draws.
 */
export function walkRoundBeds(rows: readonly WalkRoundSourceRow[], releases: readonly BedRelease[]): WalkRoundBed[] {
  return rows.map((row) => ({
    bedNumber: Number(row.bed.bedNumber),
    number: row.number,
    name: row.name,
    note: row.note,
    stateWord: row.stripWord,
    changeKey: [
      row.bed.status,
      row.bed.statusText,
      row.bed.admissionId,
      row.bed.blockReason,
      row.bed.dischargeBarrier,
      row.bed.dischargeConfirmed,
      row.bed.pastDate,
      row.bed.dischargeDateMoves,
      row.bed.awayAtEdHours != null,
      row.bed.isSpecialling,
      row.bed.observation?.level,
      row.bed.preparing,
    ].join("|"),
    glyph: row.glyph,
    days: row.days,
    accessibleName: row.accessibleName,
    occupied: !row.free && row.bed.status !== "ready" && row.bed.status !== "closed",
    observation: row.bed.observation ? observationSummary(row.bed.observation) : null,
    flag:
      row.note !== row.stateWord && row.note !== row.name && !row.bed.isSpecialling
        ? row.note
        : (row.bed.criteriaLedChip?.label ?? null),
    dueOut: row.free ? null : (row.bed.expectedDischargeLabel ?? null),
    // Only a discharge due by tomorrow is offered on the card; later ones stay in the bed's panel.
    confirmReleaseId:
      (row.bed.expectedDays ?? Infinity) > 1
        ? undefined
        : releases.find(
            (release) =>
              release.admissionId === row.bed.admissionId && release.state === "expected" && release.blocker === null,
          )?.id,
  }));
}

export type WalkRoundMark = { reviewed: boolean; changed: boolean };

export type WalkRoundState = {
  /** The ward this round belongs to; a different ward starts a fresh round. */
  scope: string;
  reviewed: ReadonlySet<number>;
  walking: number | null;
  /** Each bed's change key when the round started. */
  startKeys: ReadonlyMap<number, string>;
  /** WH4: the round skips empty beds unless All beds is chosen. */
  peopleOnly: boolean;
};

function freshRound(scope: string, beds: readonly WalkRoundBed[], peopleOnly = true): WalkRoundState {
  return {
    scope,
    reviewed: new Set(),
    walking: null,
    startKeys: new Map(beds.map((bed) => [bed.bedNumber, bed.changeKey])),
    peopleOnly,
  };
}

/** The round's own entry in the browser history, so Back closes the card before it leaves the ward. */
const WALK_ROUND_ENTRY = "wardWalkRound";

/** A horizontal swipe this long, and mostly sideways, moves to the next or previous bed. */
const SWIPE_MIN_PX = 56;

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
  /** WH4: confirms a bed's expected discharge from the card (the ward's `CONFIRM_BED_RELEASE`). */
  onConfirmRelease?: (releaseId: string) => void;
  /** Records the control that opened the panel, so focus returns to it when the panel closes. */
  registerTrigger?: (bedNumber: number, element: HTMLButtonElement | null) => void;
  /** The list of beds. It gets each bed's marks and a way to start walking from that bed. */
  renderList: (mark: (bedNumber: number) => WalkRoundMark, walkFrom: (bedNumber: number) => void) => React.ReactNode;
};

export function WardWalkRound({
  beds,
  round,
  setRound,
  onOpenBed,
  onConfirmRelease,
  registerTrigger,
  renderList,
}: Props) {
  const { reviewed, walking, startKeys, peopleOnly } = round;
  const sorted = [...beds].sort((left, right) => left.bedNumber - right.bedNumber);
  const peopleCount = sorted.filter((bed) => bed.occupied !== false).length;
  // WH4: People only skips the empty beds. A bed tapped in the list still opens, whatever it holds.
  const ordered = peopleOnly ? sorted.filter((bed) => bed.occupied !== false || bed.bedNumber === walking) : sorted;
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
      if (was !== undefined) headRef.current?.querySelector<HTMLButtonElement>("[data-walk-start]")?.focus();
    }
    // Only a change of bed speaks; `allReviewed` is read as it is at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNumber]);

  // Integration QA (3 Nov 2026): Escape closes the card like the close button, and the effect
  // above hands focus back to the round's button. A bed panel open on top keeps its own Escape.
  const walkingOpen = current !== undefined;
  useEffect(() => {
    if (!walkingOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const card = backRef.current;
      const panelOnTop = [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog[open]')].some(
        (dialog) => !dialog.contains(card) && dialog.getClientRects().length > 0,
      );
      if (panelOnTop) return;
      event.preventDefault();
      setRound((previous) => ({ ...previous, walking: null }));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [walkingOpen, setRound]);

  // WH4: the card is a screen of its own, so the phone's Back closes it and comes back to the
  // round, as the bed panel's own entry does (`WARD_BED_DRAWER_ENTRY`). Opening pushes one marked
  // entry; closing from the card steps back over it, so Back never reopens a closed card.
  useEffect(() => {
    if (!walkingOpen || typeof window === "undefined") return;
    const ownState = () => ownHistoryState(window.history.state);
    if (!ownState()[WALK_ROUND_ENTRY]) {
      window.history.pushState({ ...ownState(), [WALK_ROUND_ENTRY]: true }, "", window.location.href);
    }
    const onPopState = () => {
      if (!ownState()[WALK_ROUND_ENTRY]) setRound((previous) => ({ ...previous, walking: null }));
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      if (ownState()[WALK_ROUND_ENTRY]) window.history.back();
    };
  }, [walkingOpen, setRound]);

  const swipeFrom = useRef<{ x: number; y: number } | null>(null);
  const goTo = (offset: number) => {
    const target = ordered[index + offset];
    if (target) setWalking(target.bedNumber);
  };

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
      setRound({ ...freshRound(round.scope, beds, peopleOnly), walking: ordered[0]?.bedNumber ?? null });
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
    const last = index === ordered.length - 1;
    // WH4: the facts a round needs, always in the same three rows so nothing jumps between beds.
    const facts: [string, string | null | undefined, string][] = [
      ["Observation", current.observation, "Not recorded"],
      ["Flag", current.flag, "Nothing flagged"],
      ["Discharge due", current.dueOut, "No date recorded"],
    ];
    return (
      <section
        className={styles.card}
        aria-label={`Bed ${current.number}, ${index + 1} of ${ordered.length}`}
        data-testid="ward-walk-round"
        onTouchStart={(event) => {
          const touch = event.touches[0];
          swipeFrom.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
        }}
        onTouchEnd={(event) => {
          const from = swipeFrom.current;
          const touch = event.changedTouches[0];
          swipeFrom.current = null;
          if (!from || !touch) return;
          const dx = touch.clientX - from.x;
          const dy = touch.clientY - from.y;
          // Mostly sideways and long enough: a scroll or a tap never moves the round.
          if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          goTo(dx < 0 ? 1 : -1);
        }}
      >
        {/* Close, not a back arrow: the header's Back (shell/ward-back.ts) leaves the ward page on a
            drill-down, so an arrow here would put two arrows on screen that go different places.
            The card closes like a sheet does. */}
        <div className={styles.cardTop}>
          <span className={styles.cardTitle}>
            <b>Bed {current.number}</b>
            <span className={styles.position} data-testid="walk-round-position">
              {index + 1} of {ordered.length}
              {peopleOnly ? " people" : " beds"}
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
            <X strokeWidth={1.75} size={18} aria-hidden="true" />
          </button>
        </div>
        {progress}
        <div className={styles.sheet}>
          <h3 className={styles.cardName}>{current.name}</h3>
          <p className={styles.cardNote}>
            {current.glyph ? <StatusGlyph tone={current.glyph} size={9} /> : null}
            <span>{current.stateWord}</span>
            {current.days ? <span className={styles.cardDays}>{current.days} stay</span> : null}
          </p>
          <dl className={styles.facts}>
            {facts.map(([label, value, empty]) => (
              <div key={label} className={styles.fact}>
                <dt>{label}</dt>
                <dd data-empty={value ? undefined : "true"}>{value || empty}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.marks}>
            <span className={isChanged ? styles.changed : styles.same}>
              {isChanged ? "Changed this round" : "No change since the round started"}
            </span>
            {isReviewed ? <span className={styles.done}>Reviewed</span> : null}
          </p>
          {/* WH4: the one quick action stays on the card; anything else is in the bed's panel. */}
          <div className={styles.actions}>
            {current.confirmReleaseId && onConfirmRelease ? (
              <Button variant="sec" onClick={() => onConfirmRelease(current.confirmReleaseId!)}>
                Confirm discharge
              </Button>
            ) : null}
            <button
              type="button"
              className={buttonClass({ variant: "ghost", size: "md", iconOnly: false })}
              aria-haspopup="dialog"
              ref={(element) => registerTrigger?.(current.bedNumber, element)}
              onClick={() => {
                onOpenBed(current.bedNumber);
              }}
            >
              Update this bed
            </button>
          </div>
        </div>
        <div className={styles.cardFoot}>
          <Button variant="sec" icon={ChevronLeft} disabled={index === 0} onClick={() => goTo(-1)}>
            Previous
          </Button>
          <Button variant="pri" iconEnd={last ? undefined : ChevronRight} onClick={reviewAndNext}>
            {last ? "Reviewed, finish" : "Reviewed, next bed"}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className={styles.walk} data-testid="ward-walk-round">
      <div ref={headRef} className={styles.head}>
        <Segmented
          label="Beds in the round"
          items={[
            { id: "people" as const, label: "People only", count: peopleCount },
            { id: "all" as const, label: "All beds", count: sorted.length },
          ]}
          value={peopleOnly ? "people" : "all"}
          onChange={(id) => setRound((previous) => ({ ...previous, peopleOnly: id === "people" }))}
        />
        {progress}
        <Button variant="pri" data-walk-start="true" onClick={startOrCarryOn}>
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
  return mark.reviewed ? <Check strokeWidth={1.75} size={18} className={styles.tick} aria-hidden="true" /> : null;
}
