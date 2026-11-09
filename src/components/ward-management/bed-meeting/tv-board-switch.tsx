"use client";

import Link from "next/link";

import styles from "./tv-board-switch.module.css";

/**
 * Which board a ward or ED TV shows (Josh, 4 Nov 2026): the bed flow view it always had, the
 * clinical board for staff, or (ward only) the handover board. The choice is in the link, so a
 * locked TV comes back to the same board after a reload.
 */
export type TvBoard = "flow" | "clinical" | "handover" | "obs" | "legal" | "today" | "beds";

/**
 * One board per job (Josh, 4 Nov 2026: "add different types/versions based on the function
 * required"). Bed flow stays the default and keeps every existing link as it was.
 */
const BOARDS: Record<"ward" | "ed" | "meeting", { id: TvBoard; label: string }[]> = {
  ward: [
    { id: "clinical", label: "Clinical" },
    { id: "handover", label: "Handover" },
    { id: "obs", label: "Obs and leave" },
    { id: "legal", label: "Legal" },
    { id: "today", label: "Today" },
    { id: "flow", label: "Bed flow" },
  ],
  ed: [
    { id: "clinical", label: "Clinical" },
    { id: "beds", label: "Bed search" },
    { id: "flow", label: "Bed flow" },
  ],
  // Note 13 (Josh, 8 Nov 2026): a bed meeting has one board, shown in the same place as a ward's or
  // an ED's, so the TV's navigation looks the same on every screen.
  meeting: [{ id: "flow", label: "Bed meeting" }],
};

export function tvBoardOf(value: string | undefined, kind: "ward" | "ed" | "meeting"): TvBoard {
  if (kind === "meeting") return "flow";
  return BOARDS[kind].find((board) => board.id === value)?.id ?? "flow";
}

/** The board's name for the TV's eyebrow, such as "Ward obs and leave". */
export function tvBoardTitle(board: TvBoard, kind: "ward" | "ed"): string | undefined {
  if (board === "flow") return undefined;
  const label = BOARDS[kind].find((candidate) => candidate.id === board)?.label;
  return label === undefined ? undefined : `${kind === "ward" ? "Ward" : "ED"} ${label.toLowerCase()}`;
}

export function BoardSwitch({
  current,
  kind,
  hrefOf,
}: {
  current: TvBoard;
  kind: "ward" | "ed" | "meeting";
  hrefOf: (board: TvBoard) => string;
}) {
  return (
    <nav className={styles.switch} aria-label="Board" data-testid="tv-board-switch">
      {BOARDS[kind].map((board) => (
        <Link
          key={board.id}
          replace
          href={hrefOf(board.id)}
          aria-current={board.id === current ? "page" : undefined}
          className={styles.item}
        >
          {board.label}
        </Link>
      ))}
    </nav>
  );
}

/** The "this screen is live" cue (Notion Bed TV issue 1): a calm pulse beside the As at time. */
export function LivePulse() {
  return (
    <span className={styles.live} data-testid="tv-live">
      <i aria-hidden="true" />
      Live ·{" "}
    </span>
  );
}
