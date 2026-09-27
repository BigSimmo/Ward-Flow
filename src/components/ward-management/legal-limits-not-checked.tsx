import { LEGAL_LIMITS_NOT_CHECKED_NOTICE } from "@/components/ward-management/ward-legal-clock";
import styles from "./legal-limits-not-checked.module.css";

/**
 * Owner decision 2026-09-25: any screen that shows a Mental Health Act deadline, or a count built on
 * one, says the statutory limits behind it are typed in and not legally checked. `full` is the
 * sentence for a page header; `tag` is the short form for a strip or panel beside a legal count.
 */
export function LegalLimitsNotChecked({ variant = "full" }: { variant?: "full" | "tag" }) {
  if (variant === "tag") {
    return (
      <span className={styles.tag} data-testid="legal-limits-not-checked" title={LEGAL_LIMITS_NOT_CHECKED_NOTICE}>
        (limits not legally checked)
      </span>
    );
  }
  return (
    <p className={styles.notice} role="note" data-testid="legal-limits-not-checked">
      {LEGAL_LIMITS_NOT_CHECKED_NOTICE}
    </p>
  );
}
