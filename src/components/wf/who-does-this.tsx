import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./who-does-this.module.css";

/**
 * Shared design parts item 6 (Josh, 13 Nov 2026; F-109): a button this desk can never use is not
 * shown. Where the desk still sees the work, one quiet foot line names who does it: "Bed coordinator
 * records clearance." A "not yet" button keeps its `disabledReason` lock line instead.
 */
export function WhoDoesThis({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx(styles.who, className)} data-wf-who-does-this="">
      {children}
    </p>
  );
}
