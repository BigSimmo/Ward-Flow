"use client";

import { uploadedFileTypeOf } from "../ward-uploaded-file";
import type { FollowableChartKind, ReferralChart } from "./referral-submission";
import styles from "./ward-referral-drawer.module.css";
import { chartsCountText, documentLabel } from "./referral-document-labels";

export { chartsCountText, documentLabel };

/**
 * H-0049: a chart is shown by its kind and file type only. Referrals saved before 26 Oct 2026 may
 * still carry the file's own name, which is never shown or used as the download name.
 */
export function referralChartLabel(chart: ReferralChart) {
  return `${documentLabel(chart.kind)} · ${uploadedFileTypeOf(undefined, chart.mimeType)}`;
}

function downloadName(chart: ReferralChart) {
  const extension = chart.mimeType === "application/pdf" ? "pdf" : chart.mimeType === "image/png" ? "png" : "jpg";
  return `${documentLabel(chart.kind)}.${extension}`;
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
            // A shared-board referral carries the file's type and size only (audit F-01, H-0049).
            <span>{referralChartLabel(chart)} (file not shared)</span>
          ) : (
            <a download={downloadName(chart)} href={`data:${chart.mimeType};base64,${chart.base64}`}>
              {referralChartLabel(chart)}
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
