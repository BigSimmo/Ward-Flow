import type { Instant } from "@/components/ward-management/ward-clock";
import { crewsWaiting } from "@/components/ward-management/ward-crew-handover";
import type { Movement } from "@/components/ward-management/ward-model";
import { durMinutes } from "@/components/wf";
import styles from "./ed/ed-crew-times.module.css";

/**
 * "Crews waiting: 3, longest 1h 40m" for the ED board and Home's ED strip. Nothing when no crew is
 * recorded as waiting. A crew counts from its typed arrival until its typed release.
 */
export function EdCrewsWaitingLine({
  movements,
  now,
  wide = false,
  className,
}: {
  movements: readonly Movement[];
  now: Instant;
  /** A line of its own across a wrapping header row. */
  wide?: boolean;
  /** The caller's own text style, for a line on another surface (Home's hero strip). */
  className?: string;
}) {
  const waiting = crewsWaiting(movements, now);
  if (!waiting) return null;
  return (
    <p
      className={className ?? (wide ? `${styles.waitingLine} ${styles.wide}` : styles.waitingLine)}
      data-testid="ward-ed-crews-waiting"
    >
      Crews waiting: <span className={styles.mono}>{waiting.count}</span>, longest{" "}
      <span className={styles.mono}>{durMinutes(waiting.longestMinutes)}</span>
    </p>
  );
}
