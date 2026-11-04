"use client";

import { Badge } from "./badge";
import { cx } from "./cx";
import styles from "./figure.module.css";

/** The words a scope tag uses for a figure that counts the whole network. */
export const NETWORK_WIDE = "Network-wide";

/**
 * Kit rule b (Josh, 3 Nov 2026): every figure follows the chosen service, or says "Network-wide"
 * beside it. This is the tag. Whether to show it is the page's call, from `useFigureScope` in
 * `ward-management/shell/ward-figure-scope.ts` (`scope.showNote`), so the kit reads no app store.
 */
export function ScopeNote({
  show,
  onHero = false,
  className,
}: {
  /** True when a service is chosen and the figure beside this tag ignores it. */
  show: boolean;
  /** On the hero band, the tag takes the band's badge look. */
  onHero?: boolean;
  className?: string;
}) {
  if (!show) return null;
  return (
    <Badge size="sm" variant={onHero ? "onHero" : "default"} className={cx(styles.scope, className)}>
      {NETWORK_WIDE}
    </Badge>
  );
}
