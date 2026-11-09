import styles from "./referral-alternatives.module.css";
import {
  ALTERNATIVES_LOCAL_NOTE,
  alternativesLines,
  alternativesSummary,
  type AlternativeConsidered,
} from "./referral-alternatives";

/**
 * Feature 26, read only: what the sender marked before asking for a bed, in the fixed order.
 * Shown to the receiving ward and the coordinator. Renders nothing when nothing was marked.
 */
export function ReferralAlternativesFacts({ list }: { list: readonly AlternativeConsidered[] | undefined }) {
  if (!list?.length) return null;
  return (
    <div className={styles.facts} data-testid="referral-alternatives-facts">
      <p className={styles.lede}>
        <strong className={styles.factsTitle}>Alternatives considered</strong> · {alternativesSummary(list)}
      </p>
      <ul className={styles.summary}>
        {alternativesLines(list).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className={styles.note}>{ALTERNATIVES_LOCAL_NOTE}</p>
    </div>
  );
}
