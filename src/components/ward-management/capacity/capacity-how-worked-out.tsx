import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import styles from "./capacity-parts.module.css";

/**
 * The method behind a figure, folded to one line. Replaces paragraphs of caveats under a panel:
 * the one sentence a reader must see stays outside, everything else opens from here.
 */
export function HowWorkedOut({ label = "How this is worked out", children }: { label?: string; children: ReactNode }) {
  return (
    <details className={styles.how}>
      <summary>
        <ChevronRight size={14} aria-hidden="true" />
        {label}
      </summary>
      <div className={styles.howBody}>{children}</div>
    </details>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return <span className={styles.kicker}>{children}</span>;
}

export type LegendEntry = { label: string; swatchClassName?: string };

/** A chart or map key. Each swatch class is the caller's, so the key always matches the drawing. */
export function Legend({ items, label }: { items: readonly LegendEntry[]; label: string }) {
  return (
    <ul className={styles.legend} aria-label={label}>
      {items.map((item) => (
        <li key={item.label} className={styles.legendItem}>
          <span
            className={`${styles.swatch}${item.swatchClassName ? ` ${item.swatchClassName}` : ""}`}
            aria-hidden="true"
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
