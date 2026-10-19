"use client";

// The ED board's filter chips, in their own file so the phone list (ed-screen-phone.tsx) and the
// board (ed-screen-board.tsx) can both use them without importing each other.
import type { EdScreenContext } from "./ed-screen-context";
import styles from "./ed.module.css";

/**
 * The board's filter chips. One filter at a time; Everyone clears it. Inline above the board on wider
 * screens; on a phone they sit in the Filter sheet (C1, 19 Oct 2026), with the same behaviour.
 */
export function EdBoardChips({ ctx, className }: { ctx: EdScreenContext; className?: string }) {
  const {
    patients,
    boardFilter,
    setBoardFilter,
    notReviewedCount,
    underFormCount,
    noDestCount,
    dischargeCount,
    withdrawnCount,
  } = ctx;
  return (
    <div
      className={className ? `${styles.boardChips} ${className}` : styles.boardChips}
      role="group"
      aria-label="Filter the board"
    >
      <button
        type="button"
        className={styles.boardChip}
        aria-pressed={boardFilter === "all"}
        onClick={() => setBoardFilter("all")}
      >
        Everyone <span className={styles.c}>{patients.length}</span>
      </button>
      <button
        type="button"
        className={styles.boardChip}
        aria-pressed={boardFilter === "not_reviewed"}
        onClick={() => setBoardFilter("not_reviewed")}
      >
        Not reviewed{" "}
        <span className={styles.c} data-zero={notReviewedCount === 0 ? "true" : undefined}>
          {notReviewedCount}
        </span>
      </button>
      <button
        type="button"
        className={styles.boardChip}
        aria-pressed={boardFilter === "under_form"}
        onClick={() => setBoardFilter("under_form")}
      >
        Under a form{" "}
        <span className={styles.c} data-zero={underFormCount === 0 ? "true" : undefined}>
          {underFormCount}
        </span>
      </button>
      <button
        type="button"
        className={styles.boardChip}
        aria-pressed={boardFilter === "no_destination"}
        onClick={() => setBoardFilter("no_destination")}
      >
        No bed yet{" "}
        <span className={styles.c} data-zero={noDestCount === 0 ? "true" : undefined}>
          {noDestCount}
        </span>
      </button>
      <button
        type="button"
        className={styles.boardChip}
        aria-pressed={boardFilter === "discharge"}
        onClick={() => setBoardFilter("discharge")}
      >
        For discharge{" "}
        <span className={styles.c} data-zero={dischargeCount === 0 ? "true" : undefined}>
          {dischargeCount}
        </span>
      </button>
      <button
        type="button"
        className={styles.boardChip}
        aria-pressed={boardFilter === "withdrawn"}
        onClick={() => setBoardFilter("withdrawn")}
      >
        Withdrawn{" "}
        <span className={styles.c} data-zero={withdrawnCount === 0 ? "true" : undefined}>
          {withdrawnCount}
        </span>
      </button>
    </div>
  );
}
