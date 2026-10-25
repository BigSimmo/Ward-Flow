"use client";

import type { ReferralChart } from "./referral-submission";
import styles from "./ward-referral-drawer.module.css";

function documentLabel(kind: ReferralChart["kind"]) {
  return kind === "medication"
    ? "Medication chart"
    : kind === "observation"
      ? "Observation chart"
      : "Additional document";
}

export function ReferralDocumentLinks({ charts }: { charts: ReferralChart[] }) {
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
    </ul>
  );
}
