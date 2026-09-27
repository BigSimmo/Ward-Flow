import type { CSSProperties, ReactNode } from "react";
import styles from "./ward-prototype-footer.module.css";

export interface WardPrototypeFooterProps {
  testId?: string;
  note?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function WardPrototypeFooter({
  testId,
  note = "Demonstration records only — Not a medical device",
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
      <span className={styles.prototypeBadge} data-ward-type-floor="badge">
        Synthetic prototype
      </span>
      <span className={styles.footerNote} data-ward-type-floor="banner">
        {note}
      </span>
    </footer>
  );
}
