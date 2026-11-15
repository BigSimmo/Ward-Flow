import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cx } from "./cx";
import styles from "./row-link.module.css";

/**
 * R-STYLE-6. The name's press area stretches over its whole row (at least 48 px) on phones and
 * touch screens. Row buttons (Chase, Escalate) sit above it with `rowLinkActionClass`.
 * The focus ring stays on the name.
 */
export const rowLinkActionClass = styles.action;

export function RowLinkRow({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx(styles.row, className)} {...rest} />;
}

type LinkProps = { href: string } & AnchorHTMLAttributes<HTMLAnchorElement>;
type ButtonProps = { href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>;

/** The name: a link when `href` is given, otherwise a button. */
export function RowLink(props: LinkProps | ButtonProps) {
  if (props.href !== undefined) {
    const { className, children, ...rest } = props;
    return (
      <a className={cx(styles.link, className)} {...rest}>
        {children}
      </a>
    );
  }
  const { className, type = "button", children, ...rest } = props;
  return (
    <button type={type} className={cx(styles.link, className)} {...rest}>
      {children}
    </button>
  );
}
