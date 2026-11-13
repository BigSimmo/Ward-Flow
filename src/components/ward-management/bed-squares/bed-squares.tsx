import { Fragment, type CSSProperties } from "react";

import { Badge, SrOnly, StatusGlyph, cx } from "@/components/wf";

import styles from "./bed-squares.module.css";

/**
 * BedSquares: one ward's beds as a line of squares (shared pattern v1, wave 4, ruling 7, D-191).
 *
 * Used by the Capacity bed map, the Executive "Beds by ward" table, the Ward "Every bed" head and
 * the All wards cards, so the pages stay one part. It replaces Capacity's 4 Nov coloured discharge
 * cells (C4): held up is said in words on the note line, never as a colour. Lives in page files
 * until it moves into the kit after the demo.
 *
 * Props (all plain data; the caller derives the counts from its own selectors):
 * - `counts`  squares by state, drawn left to right in this order:
 *     `ready`  ready and offered (leaves out named and being-made-ready beds), green fill, the head figure
 *     `prep`   being made ready, not offered yet, hollow green
 *     `free`   in use, discharge due today and not held up ("may move"), hatch
 *     `use`    in use: occupied, on leave, pulled, held up
 *     `closed` closed
 *   The ward's beds are the sum. Use `bedSquareCounts()` to build them from ward figures.
 * - `tag`     neutral cohort and lock tag from the record ("Adult · Locked"). Never a service colour.
 * - `notes`   the note line, already in order (build it with `bedSquaresNotes()`); none = no line.
 * - `size`    `"map"` 8 px squares (Capacity, All wards, default) or `"board"` 12 px (Ward "Every
 *             bed" head). Phones draw 10 px squares that fill the row whatever the size.
 * - `figure`  `"md"` 15 px head figure (default) or `"lg"` 20 px where the card is the page's focal strip.
 * - `head`    false draws the strip (and notes) without the head line, e.g. in a table row whose
 *             cells already say the figures.
 * - `tagAfter` true sets the tag straight after "ready of N beds" (the Ward page's mock-up) instead of
 *             at the line's right end (Capacity and All wards cards, the default).
 * - `className`, `testId` for the caller's layout and tests.
 *
 * The strip is decorative (`aria-hidden`); the head and note line say it in words, so a screen
 * reader hears "1 ready of 20 beds, Adult · Locked. 2 discharges today, 1 held up, 1 closed."
 */
export type BedSquareState = "ready" | "prep" | "free" | "use" | "closed";

export type BedSquareCounts = Readonly<Record<BedSquareState, number>>;

export type BedSquaresNote = {
  text: string;
  /** Warning ink and an 8 px warning dot (a stale count, a closed bed past review). */
  tone?: "warning";
};

export type BedSquaresProps = {
  counts: BedSquareCounts;
  tag?: string;
  notes?: readonly BedSquaresNote[];
  size?: "map" | "board";
  figure?: "md" | "lg";
  /**
   * The head figure when it is not the solid squares: the current ready rule (owner ruling 5 Sep 2026)
   * still counts a bed being made ready, so the figure stays the selector's and that bed is drawn
   * hollow from inside it. Drop once PR C's F-26 takes those beds out of ready.
   */
  readyFigure?: number;
  head?: boolean;
  /** The tag straight after the words, not at the line's end (Ward "Every bed"). */
  tagAfter?: boolean;
  className?: string;
  testId?: string;
};

/** Left-to-right order of the squares. */
const BED_SQUARE_ORDER: readonly BedSquareState[] = ["ready", "prep", "free", "use", "closed"];

/** The key's words for each square, in order. */
export const BED_SQUARE_LABELS: Readonly<Record<BedSquareState, string>> = {
  ready: "Ready",
  prep: "Being made ready",
  free: "Discharge today",
  use: "In use",
  closed: "Closed",
};

const clamp = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/**
 * Squares from ward figures. `beds` is the ward's bed total; what is not ready, being made ready,
 * freeing today or closed is in use. Discharges today can never colour more squares than are in use.
 */
export function bedSquareCounts({
  beds,
  ready,
  prep = 0,
  dischargesToday = 0,
  closed = 0,
}: {
  beds: number;
  ready: number;
  prep?: number;
  dischargesToday?: number;
  closed?: number;
}): BedSquareCounts {
  const total = clamp(beds);
  const readyN = Math.min(clamp(ready), total);
  const prepN = Math.min(clamp(prep), total - readyN);
  const closedN = Math.min(clamp(closed), total - readyN - prepN);
  const inUse = total - readyN - prepN - closedN;
  const free = Math.min(clamp(dischargesToday), inUse);
  return { ready: readyN, prep: prepN, free, use: inUse - free, closed: closedN };
}

/**
 * The note line in the shared order: stale count first, then discharges today, held up, pulled,
 * being made ready, closed, on leave, staff requested, then any `extra` items. Zeros are left out.
 */
export function bedSquaresNotes({
  staleFor,
  dischargesToday = 0,
  heldUp = 0,
  pulled = 0,
  prep = 0,
  closed = 0,
  onLeave = 0,
  staffRequested = false,
  extra = [],
}: {
  /** Age of an unconfirmed count, e.g. "5h"; drawn as "Count 5h old" in warning ink. */
  staleFor?: string;
  dischargesToday?: number;
  heldUp?: number;
  pulled?: number;
  prep?: number;
  closed?: number;
  onLeave?: number;
  staffRequested?: boolean;
  extra?: readonly BedSquaresNote[];
}): BedSquaresNote[] {
  const notes: BedSquaresNote[] = [];
  if (staleFor) notes.push({ text: `Count ${staleFor} old`, tone: "warning" });
  if (dischargesToday > 0)
    notes.push({ text: `${dischargesToday} ${dischargesToday === 1 ? "discharge" : "discharges"} today` });
  if (heldUp > 0) notes.push({ text: `${heldUp} held up` });
  if (pulled > 0) notes.push({ text: `${pulled} pulled` });
  if (prep > 0) notes.push({ text: `${prep} being made ready` });
  if (closed > 0) notes.push({ text: `${closed} closed` });
  if (onLeave > 0) notes.push({ text: `${onLeave} on leave` });
  if (staffRequested) notes.push({ text: "Staff requested" });
  return [...notes, ...extra];
}

/**
 * The neutral cohort and lock tag from the record: "Adult · Locked", "Older adult · Open",
 * "Adult · Mixed" (some locked beds). Never a service colour (F-78).
 */
export function bedSquaresTag(unit: { cohort: string; beds: number; lockedBeds: number }): string {
  const lock = unit.lockedBeds >= unit.beds ? "Locked" : unit.lockedBeds <= 0 ? "Open" : "Mixed";
  return `${unit.cohort} · ${lock}`;
}

/** Keeps a note's words together so a wrapped line never starts with a dot. */
const nbsp = (text: string) => text.replace(/ /g, " ");

/** One square of a state: the key's swatch and the Ward tiles' bed-number mark. Decorative. */
export function BedSquare({ state, className }: { state: BedSquareState; className?: string }) {
  return <i className={cx(styles.swatch, className)} data-s={state} aria-hidden="true" />;
}

/** The squares alone (decorative). */
export function BedSquaresStrip({ counts, className }: { counts: BedSquareCounts; className?: string }) {
  const states = BED_SQUARE_ORDER.flatMap((state) => Array.from({ length: clamp(counts[state]) }, () => state));
  return (
    <span
      className={cx(styles.strip, className)}
      aria-hidden="true"
      data-testid="bed-squares-strip"
      style={{ "--sq-n": Math.max(states.length, 1) } as CSSProperties}
    >
      {states.map((state, index) => (
        <i key={index} data-s={state} />
      ))}
    </span>
  );
}

/** The key: one swatch and word per square state, in strip order. */
export function BedSquaresKey({ className, label = "Bed squares key" }: { className?: string; label?: string }) {
  return (
    <div className={cx(styles.key, className)} role="group" aria-label={label}>
      {BED_SQUARE_ORDER.map((state) => (
        <span key={state} className={styles.keyItem}>
          <BedSquare state={state} />
          {BED_SQUARE_LABELS[state]}
        </span>
      ))}
    </div>
  );
}

export function BedSquares({
  counts,
  tag,
  notes = [],
  size = "map",
  figure = "md",
  readyFigure,
  head = true,
  tagAfter = false,
  className,
  testId,
}: BedSquaresProps) {
  const beds = BED_SQUARE_ORDER.reduce((sum, state) => sum + clamp(counts[state]), 0);
  const ready = clamp(readyFigure ?? counts.ready);
  return (
    <div
      className={cx(styles.bedSquares, size === "board" && styles.board, figure === "lg" && styles.lg, className)}
      data-testid={testId}
    >
      {head ? (
        <p className={styles.head}>
          {/* Zero is written as 0 (Josh, 3 Nov 2026), in quiet ink. */}
          <b
            className={styles.n}
            data-zero={ready === 0 ? "true" : "false"}
            data-testid={testId ? `${testId}-ready` : undefined}
          >
            {ready}
          </b>
          <span className={styles.of}>
            ready of {beds} {beds === 1 ? "bed" : "beds"}
          </span>
          {tag ? (
            <>
              <SrOnly>, </SrOnly>
              <Badge size="sm" className={cx(styles.tag, tagAfter && styles.tagAfter)}>
                {tag}
              </Badge>
            </>
          ) : null}
          <SrOnly>.</SrOnly>
        </p>
      ) : null}
      <BedSquaresStrip counts={counts} />
      {notes.length > 0 ? (
        <p className={styles.note} data-testid={testId ? `${testId}-note` : undefined}>
          {notes.map((note, index) => (
            <Fragment key={`${index}-${note.text}`}>
              {index > 0 ? " · " : null}
              {note.tone === "warning" ? (
                <span className={styles.warn}>
                  <StatusGlyph tone="warning" size={8} /> {nbsp(note.text)}
                </span>
              ) : (
                <span>{nbsp(note.text)}</span>
              )}
            </Fragment>
          ))}
        </p>
      ) : null}
    </div>
  );
}
