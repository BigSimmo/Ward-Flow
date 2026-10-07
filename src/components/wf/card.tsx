import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "./cx";
import { IconTile } from "./primitives";
import styles from "./card.module.css";

export type CardProps = ComponentPropsWithoutRef<"section"> & {
  /** `compact` is the one-row list card: tile, title over meta, values, one action. */
  variant?: "default" | "compact";
  as?: "section" | "article" | "div" | "li";
};

/** v6 card: surface, hairline, radius 14, e1. No coloured edges or stripes. */
export function Card({ variant = "default", as = "section", className, ...rest }: CardProps) {
  const Tag = as as ElementType;
  return <Tag className={cx(styles.card, variant === "compact" && styles.compact, className)} {...rest} />;
}

export type CardHeadProps = {
  title: ReactNode;
  /** Short meta beside the title ("10 departments"). No sentence that restates the data. */
  meta?: ReactNode;
  /** Neutral line-icon tile on the left. */
  icon?: LucideIcon;
  /** One badge or one live value. */
  aside?: ReactNode;
  /** One action slot (a ghost button, a segmented control or an overflow menu). */
  action?: ReactNode;
  /** Heading level. Defaults to 2 (the page title is h1 in the header bar). */
  level?: 2 | 3 | 4;
  /** Uppercase eyebrow style for board section heads ("EVERY BED"). */
  eyebrow?: boolean;
  id?: string;
  className?: string;
};

export function CardHead({
  title,
  meta,
  icon,
  aside,
  action,
  level = 2,
  eyebrow = false,
  id,
  className,
}: CardHeadProps) {
  const Heading = `h${level}` as ElementType;
  return (
    <div className={cx(styles.head, className)}>
      {icon ? <IconTile icon={icon} /> : null}
      <div className={styles.titleWrap}>
        <Heading id={id} className={cx(styles.title, eyebrow && styles.eyebrowTitle)}>
          {title}
        </Heading>
        {meta ? <span className={styles.meta}>{meta}</span> : null}
      </div>
      {aside || action ? (
        <div className={styles.aside}>
          {aside}
          {action}
        </div>
      ) : null}
    </div>
  );
}

export function CardBody({
  flush = false,
  className,
  ...rest
}: ComponentPropsWithoutRef<"div"> & { /** No padding, for tables and lists. */ flush?: boolean }) {
  return <div className={cx(styles.body, flush && styles.flush, className)} {...rest} />;
}

/** Card foot: optional meta on the left, actions on the right (one primary at most). */
export function CardFoot({
  meta,
  children,
  className,
}: {
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx(styles.foot, className)}>
      {meta ? <span className={styles.footMeta}>{meta}</span> : null}
      {children ? <div className={styles.footActions}>{children}</div> : null}
    </div>
  );
}
