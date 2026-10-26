"use client";

import type { FollowableChartKind, ReferralChart } from "./referral-submission";
import styles from "./ward-referral-drawer.module.css";

export function documentLabel(kind: ReferralChart["kind"]) {
  return kind === "medication"
    ? "Medication chart"
    : kind === "observation"
      ? "Observation chart"
      : "Additional document";
}

/** "2 attached" or "1 attached, 1 to follow" (A27). */
export function chartsCountText(attached: number, toFollow: number): string {
  return toFollow ? `${attached} attached, ${toFollow} to follow` : `${attached} attached`;
}

export function ReferralDocumentLinks({
  charts,
  toFollow = [],
}: {
  charts: ReferralChart[];
  /** A27: required charts the referrer marked to follow. */
  toFollow?: readonly FollowableChartKind[];
}) {
  return (
    <ul className={styles.documentLinks}>
      {charts.map((chart) => (
        <li key={chart.kind}>
          {chart.base64 === undefined ? (
            // A shared-board referral carries the file's name only (audit F-01).
            <span>
              {documentLabel(chart.kind)} · {chart.name} (file not shared)
            </span>
          ) : (
            <a download={chart.name} href={`data:${chart.mimeType};base64,${chart.base64}`}>
              {documentLabel(chart.kind)} · {chart.name}
            </a>
          )}
        </li>
      ))}
      {toFollow.map((kind) => (
        <li key={`${kind}-to-follow`}>
          <span>{documentLabel(kind)} · to follow, not attached yet</span>
        </li>
      ))}
    </ul>
  );
}
