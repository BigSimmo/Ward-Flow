import type { CSSProperties, ReactNode } from "react";
import styles from "./ward-prototype-footer.module.css";

export interface WardPrototypeFooterProps {
  testId?: string;
  note?: ReactNode;
  extra?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function WardPrototypeFooter({
  testId,
  note = "Western Australia Mental Health Bed Flow Prototype · All patient records, clinical journeys, bed states, and timestamps are synthetic demonstration figures · Not a medical device",
  extra,
  style,
  className,
}: WardPrototypeFooterProps) {
  return (
    <footer
      className={`${styles.footer}${className ? ` ${className}` : ""}`}
      data-testid={testId ?? "ward-prototype-footer"}
      aria-label="Prototype disclosure"
      style={style}
    >
      <div className={styles.leftGroup}>
        <span
          className={styles.prototypeBadge}
          data-ward-type-floor="badge"
          title="Synthetic clinical demonstration prototype · Not connected to live EHR"
        >
          <span className={styles.pulseDot} aria-hidden="true" />
          Synthetic prototype
        </span>
        <span className={styles.footerNote} data-ward-type-floor="banner">
          {note}
        </span>
      </div>
      <div className={styles.rightGroup}>
        {extra}
        <span className={styles.authorityPill} title="WA Health clinical demonstration standard">
          <svg
            className={styles.authorityIcon}
            viewBox="0 0 16 16"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M8 1.5l5.5 2.5v4c0 3.5-2.5 6-5.5 7-3-1-5.5-3.5-5.5-7V4L8 1.5z" />
            <path d="M5.5 8l2 2 3.5-3.5" />
          </svg>
          <span>WA Health Clinical Flow · Synthetic data only</span>
        </span>
      </div>
    </footer>
  );
}
