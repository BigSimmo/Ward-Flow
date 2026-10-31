import { URGENCY_LEVELS } from "./ward-model-vocabulary";
import { TIER_QUALIFIER } from "./ward-priority";
import styles from "./tier-key.module.css";

/**
 * One line that spells out the tier codes a list shows: "T1 most urgent · T2 urgent · T3 least
 * urgent". Simplification A6 (Josh, 19 Oct 2026): staff keep the codes they know, and a locum or
 * new starter can read them without training. The words are the tier wording the referral screens
 * already use (`urgencyTierLabel`).
 */
export function TierKey({ className, compact = false }: { className?: string; compact?: boolean }) {
  // Compact (Home's Waiting, Home and Activity design, 31 Oct 2026): one short line, the ends only,
  // "T1 most urgent → T3 least urgent".
  const tiers = compact ? [URGENCY_LEVELS[0], URGENCY_LEVELS.at(-1)!] : URGENCY_LEVELS;
  return (
    <p className={className ? `${styles.key} ${className}` : styles.key} data-testid="ward-tier-key">
      {tiers.map((tier, index) => (
        <span key={tier} className={styles.item}>
          {index > 0 ? (
            <span aria-hidden="true" className={compact ? styles.arrow : styles.sep}>
              {compact ? "→" : "·"}
            </span>
          ) : null}
          <b className={styles.code}>T{tier}</b> {TIER_QUALIFIER[tier]}
        </span>
      ))}
    </p>
  );
}
