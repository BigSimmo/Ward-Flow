import { InfoTip } from "@/components/wf";
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
  return (
    <p className={className ? `${styles.key} ${className}` : styles.key} data-testid="ward-tier-key">
      <TierKeyItems compact={compact} />
    </p>
  );
}

function TierKeyItems({ compact = false, stacked = false }: { compact?: boolean; stacked?: boolean }) {
  // Compact (Home's Waiting, Home and Activity design, 31 Oct 2026): one short line, the ends only,
  // "T1 most urgent → T3 least urgent".
  const tiers = compact ? [URGENCY_LEVELS[0], URGENCY_LEVELS.at(-1)!] : URGENCY_LEVELS;
  return tiers.map((tier, index) => (
    <span key={tier} className={stacked ? styles.line : styles.item}>
      {index > 0 && !stacked ? (
        <span aria-hidden="true" className={compact ? styles.arrow : styles.sep}>
          {compact ? "→" : "·"}
        </span>
      ) : null}
      <b className={styles.code}>T{tier}</b> {TIER_QUALIFIER[tier]}
    </span>
  ));
}

/**
 * Audit two #77 (K14, K15): the one tier key, behind one ⓘ at a list's head (D-224), in place of a
 * visible key line, a hand-made "?" disclosure or a caption. One tier per line inside the tip; the
 * codes stay spelled out (A6). At most one per list head.
 */
export function TierKeyTip({
  className,
  placement = "bottom",
}: {
  className?: string;
  placement?: "top" | "bottom" | "right";
}) {
  return (
    <InfoTip about="urgency tiers" placement={placement} className={className}>
      <span className={styles.stack} data-testid="ward-tier-key">
        <TierKeyItems stacked />
      </span>
    </InfoTip>
  );
}
