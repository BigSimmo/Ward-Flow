import { URGENCY_LEVELS } from "./ward-model-vocabulary";
import { TIER_QUALIFIER } from "./ward-priority";
import styles from "./tier-key.module.css";

/**
 * One line that spells out the tier codes a list shows: "T1 most urgent · T2 urgent · T3 least
 * urgent". Simplification A6 (Josh, 19 Oct 2026): staff keep the codes they know, and a locum or
 * new starter can read them without training. The words are the tier wording the referral screens
 * already use (`urgencyTierLabel`).
 */
export function TierKey({ className }: { className?: string }) {
  return (
    <p className={className ? `${styles.key} ${className}` : styles.key} data-testid="ward-tier-key">
      {URGENCY_LEVELS.map((tier, index) => (
        <span key={tier} className={styles.item}>
          {index > 0 ? (
            <span aria-hidden="true" className={styles.sep}>
              ·
            </span>
          ) : null}
          <b className={styles.code}>T{tier}</b> {TIER_QUALIFIER[tier]}
        </span>
      ))}
    </p>
  );
}
