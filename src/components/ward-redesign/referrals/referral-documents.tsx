"use client";
// Referrals redesign, round 5 (Josh, 31 October 2026): the referral's documents as chips you can
// open. A file the session holds downloads; the demonstration charts hold no file, so they open a
// clearly marked synthetic preview instead of the dead "(file not shared)" text.

import { useState } from "react";
import { Download, FileText, Paperclip } from "lucide-react";

import { documentLabel } from "@/components/ward-management/referrals/referral-document-links";
import type { FollowableChartKind, ReferralChart } from "@/components/ward-management/referrals/referral-submission";
import { Button, Sheet } from "@/components/wf";

import s from "./referral-tabs.module.css";

function fileType(chart: ReferralChart): string {
  return chart.mimeType === "application/pdf" ? "PDF" : chart.mimeType === "image/png" ? "PNG" : "JPEG";
}

function downloadName(chart: ReferralChart) {
  const extension = chart.mimeType === "application/pdf" ? "pdf" : chart.mimeType === "image/png" ? "png" : "jpg";
  return `${documentLabel(chart.kind)}.${extension}`;
}

export function ReferralDocuments({
  charts,
  toFollow = [],
  personName,
}: {
  charts: readonly ReferralChart[];
  toFollow?: readonly FollowableChartKind[];
  personName: string;
}) {
  const [preview, setPreview] = useState<ReferralChart>();
  if (charts.length === 0 && toFollow.length === 0) {
    return <p className={s.muted}>No documents attached.</p>;
  }
  return (
    <>
      <ul className={s.docs} aria-label="Referral documents">
        {charts.map((chart) => (
          <li key={chart.kind + chart.name}>
            {chart.base64 !== undefined ? (
              <a
                className={s.doc}
                download={downloadName(chart)}
                href={`data:${chart.mimeType};base64,${chart.base64}`}
              >
                <FileText size={14} aria-hidden="true" />
                <span>{documentLabel(chart.kind)}</span>
                <span className={s.docType}>{fileType(chart)}</span>
                <Download size={13} aria-hidden="true" />
              </a>
            ) : (
              <button type="button" className={s.doc} onClick={() => setPreview(chart)}>
                <FileText size={14} aria-hidden="true" />
                <span>{documentLabel(chart.kind)}</span>
                <span className={s.docType}>{fileType(chart)}</span>
              </button>
            )}
          </li>
        ))}
        {toFollow.map((kind) => (
          <li key={`${kind}-to-follow`}>
            <span className={s.docPending}>
              <Paperclip size={13} aria-hidden="true" />
              {documentLabel(kind)} · to follow
            </span>
          </li>
        ))}
      </ul>
      <Sheet
        open={preview !== undefined}
        onClose={() => setPreview(undefined)}
        title={preview ? documentLabel(preview.kind) : "Document"}
        description={`${personName} · attached to the referral`}
        footer={
          <div className={s.sheetFoot}>
            <Button variant="ghost" size="sm" onClick={() => setPreview(undefined)}>
              Close
            </Button>
          </div>
        }
      >
        {preview ? (
          <div className={s.paper} data-testid="ward-referral-document-preview">
            <p className={s.paperMark}>Synthetic demonstration document</p>
            <h3 className={s.paperTitle}>{documentLabel(preview.kind)}</h3>
            <p className={s.paperMeta}>
              {fileType(preview)} · {Math.max(1, Math.round(preview.sizeBytes / 1024))} KB
            </p>
            <div className={s.paperLines} aria-hidden="true">
              {Array.from({ length: 9 }, (_, index) => (
                <i key={index} style={{ width: `${92 - ((index * 17) % 40)}%` }} />
              ))}
            </div>
            <p className={s.muted}>This prototype holds the document&apos;s type and size only, never a real file.</p>
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
