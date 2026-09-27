"use client";

import { cn } from "@/lib/cn";
import styles from "./metro-pulse-circle.module.css";

export type MetroPulseStatus =
  | "live"
  | "connected"
  | "syncing"
  | "stale"
  | "error"
  | "static"
  | "frozen";

export interface MetroPulseCircleProps {
  /**
   * Semantic status tone:
   * - live / connected: green/emerald (pulsing)
   * - syncing / stale: amber (pulsing)
   * - error: red (pulsing)
   * - static / frozen: slate (resting/no pulse)
   */
  status?: MetroPulseStatus;
  /**
   * Explicitly suppress halo pulse animation while preserving semantic core hue.
   */
  pulse?: boolean;
  className?: string;
  "data-testid"?: string;
}

function resolveStatusClass(status: MetroPulseStatus): string {
  switch (status) {
    case "live":
    case "connected":
      return styles.live;
    case "syncing":
    case "stale":
      return styles.syncing;
    case "error":
      return styles.error;
    case "static":
    case "frozen":
    default:
      return styles.static;
  }
}

/**
 * A subtle, sophisticated 7px (0.4375rem) metro-style live pulse circle.
 *
 * Emits a calm 2.4s halo pulse animation using CSS pseudo-elements (avoiding
 * extra DOM elements or accidental `span.absolute` querySelector catches in test suites).
 *
 * Always carries `aria-hidden="true"` to prevent screen reader noise, since the
 * semantic state is communicated by adjacent text labels.
 *
 * Automatically respects `prefers-reduced-motion: reduce` and in-app motion preference.
 */
export function MetroPulseCircle({
  status = "live",
  pulse = true,
  className,
  "data-testid": testId,
}: MetroPulseCircleProps) {
  const statusClass = resolveStatusClass(status);
  const isPulsing = pulse && status !== "static" && status !== "frozen";

  return (
    <span
      aria-hidden="true"
      data-testid={testId}
      data-metro-status={status}
      className={cn(
        styles.circle,
        statusClass,
        !isPulsing && styles.noPulse,
        className,
      )}
    />
  );
}
