"use client";

import Link from "next/link";

import styles from "./tv-board-switch.module.css";

/**
 * Which board a ward or ED TV shows (Josh, 4 Nov 2026): the bed flow view it always had, the
 * clinical board for staff, or (ward only) the handover board. The choice is in the link, so a
 * locked TV comes back to the same board after a reload.
 */
export type TvBoard = "flow" | "clinical" | "handover";

export function tvBoardOf(value: string | undefined, kind: "ward" | "ed" | "meeting"): TvBoard {
  if (kind === "meeting") return "flow";
  if (value === "clinical") return "clinical";
  if (value === "handover" && kind === "ward") return "handover";
  return "flow";
}

const BOARDS: Record<"ward" | "ed", { id: TvBoard; label: string }[]> = {
  ward: [
    { id: "clinical", label: "Clinical" },
    { id: "handover", label: "Handover" },
    { id: "flow", label: "Bed flow" },
  ],
  ed: [
    { id: "clinical", label: "Clinical" },
    { id: "flow", label: "Bed flow" },
  ],
};

export function BoardSwitch({
  current,
  kind,
  hrefOf,
}: {
  current: TvBoard;
  kind: "ward" | "ed";
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
