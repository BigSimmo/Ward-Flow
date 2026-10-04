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
        <span className={styles.prototypeBadge} data-ward-type-floor="badge">
          <span className={styles.pulseDot} aria-hidden="true" />
          Synthetic prototype
        </span>
        <span className={styles.footerNote} data-ward-type-floor="banner">
          {note}
        </span>
      </div>
      <div className={styles.rightGroup}>
        {extra}
        <span className={styles.authorityPill}>WA Health Clinical Flow · Synthetic data only</span>
      </div>
    </footer>
  );
}
