"use client";

import { Undo2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./button";
import { SrOnly } from "./primitives";
import { undoUntilClock } from "./toast-timing";
import { useMinuteNow } from "./use-minute-now";

export type RowUndoProps = {
  /** The step in one word, as the row says it: "pull" reads "Undo pull · until 14:47". */
  verb: string;
  /** When the Undo window ends. The button shows only before this. */
  until: Date | number;
  onUndo: () => void;
  /**
   * The clock the window is judged by, such as the board clock. Without it the kit minute clock
   * (`useMinuteNow`) is used, and the button also goes at `until` itself rather than a minute later.
   */
  now?: number;
  /**
   * Who the row is about, heard after the words ("Undo pull · until 14:47 for Marrowvale, Gianna"),
   * so a list of rows each with its own Undo names every one apart. Not shown.
   */
  who?: string;
  className?: string;
};

/**
 * Shared design parts item 4 (Josh, 13 Nov 2026): after the toast has gone, the row or card the step
 * changed keeps a quiet Undo for the whole window, "Undo pull · until 14:47". It renders only while
 * now is before `until`. The undo itself (which step, whether this desk may) is the caller's.
 */
export function RowUndo({ verb, until, onUndo, now, who, className }: RowUndoProps) {
  const minuteNow = useMinuteNow();
  const untilMs = typeof until === "number" ? until : until.getTime();
  // The minute clock can run up to a minute late; a timer at `until` hides the button on time.
  const [endedAt, setEndedAt] = useState<number | null>(null);
  useEffect(() => {
    if (now !== undefined) return;
    const wait = untilMs - Date.now();
    const timer = window.setTimeout(() => setEndedAt(untilMs), Math.max(0, wait));
    return () => window.clearTimeout(timer);
  }, [now, untilMs]);
  const current = now ?? minuteNow;
  if (current >= untilMs || (now === undefined && endedAt === untilMs)) return null;
  return (
    <Button variant="ghost" size="sm" icon={Undo2} className={className} data-wf-row-undo="" onClick={onUndo}>
      {`Undo ${verb} · until ${undoUntilClock(until)}`}
      {/* The space sits outside the hidden span, so the heard name keeps it. */}
      {who ? (
        <>
          {" "}
          <SrOnly>{`for ${who}`}</SrOnly>
        </>
      ) : null}
    </Button>
  );
}
