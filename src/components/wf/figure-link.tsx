import Link from "next/link";

import { Badge } from "./badge";
import { cx } from "./cx";
import { PAGE_OWNERS, type PageOwnerKey } from "./page-owners";
import styles from "./figure.module.css";

export type FigureLinkProps = {
  /** The live figure, exactly as its owning page computes it. Never a reworded copy. */
  value: number | string;
  /** The words after the figure, as the owning page says them: "waiting", "held-up releases". */
  label: string;
  /** The page that owns this figure (`PAGE_OWNERS`). */
  owner: PageOwnerKey;
  /** What the figure covers when that differs from the page around it: "Network-wide", "FSH ED". */
  scope?: string;
  /** On the hero band: the link keeps the band's ink. */
  onHero?: boolean;
  /**
   * False when this desk cannot open the owning page (`useCanOpenHref`). The figure then shows
   * unlinked, so no offered link leads to a refusal. The kit stays free of access rules; the
   * caller decides.
   */
  canOpen?: boolean;
  className?: string;
  "data-testid"?: string;
};

/** The accessible name: the figure, its scope, then where the link goes. "12 waiting, open Waiting". */
export function figureLinkName({
  value,
  label,
  owner,
  scope,
}: Pick<FigureLinkProps, "value" | "label" | "owner" | "scope">) {
  return [`${value} ${label}`, scope, `open ${PAGE_OWNERS[owner].name}`].filter(Boolean).join(", ");
}

/**
 * Kit rule a (Josh, 3 Nov 2026): a figure shown on a page that does not own it. It renders the same
 * live number as a quiet text link to the owning page, in running-sentence figures (Geist,
 * tabular), with an optional scope tag beside it. Use it at most twice per figure per screen.
 */
export function FigureLink({
  value,
  label,
  owner,
  scope,
  onHero = false,
  canOpen = true,
  className,
  "data-testid": testId,
}: FigureLinkProps) {
  const page = PAGE_OWNERS[owner];
  const text = (
    <>
      <span className={styles.wfNum}>{value}</span> {label}
    </>
  );
  const tag = scope ? (
    <Badge size="sm" variant={onHero ? "onHero" : "default"} className={styles.scope}>
      {scope}
    </Badge>
  ) : null;
  if (!canOpen) {
    return (
      <span className={cx(styles.plain, className)} data-testid={testId}>
        {text}
        {tag}
      </span>
    );
  }
  return (
    <>
      <Link
        href={page.route}
        className={cx(styles.link, onHero && styles.onHero, className)}
        aria-label={figureLinkName({ value, label, owner, scope })}
        data-owner={owner}
        data-testid={testId}
      >
        {text}
      </Link>
      {tag ? <span aria-hidden="true">{tag}</span> : null}
    </>
  );
}
