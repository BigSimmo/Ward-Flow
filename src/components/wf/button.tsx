"use client";

import { useId, type ComponentPropsWithRef, type MouseEvent, type ReactNode } from "react";
import { ChevronDown, Lock, type LucideIcon } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cx } from "./cx";
import { Icon } from "./icon";
import { Menu, type MenuItem } from "./menu";
import { Count, Kbd, SrOnly, Spinner } from "./primitives";
import styles from "./button.module.css";

export type ButtonVariant = "pri" | "sec" | "tint" | "ghost" | "danger" | "onHero" | "light";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonOwnProps = {
  /** `pri` once per area. `light` is the hero band's primary; `onHero` its secondary. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Leading Lucide icon. */
  icon?: LucideIcon;
  /** Trailing Lucide icon, usually a caret when the button opens a menu. */
  iconEnd?: LucideIcon;
  /** Shows a spinner and sets `aria-busy`. Clicks are ignored while loading. */
  loading?: boolean;
  /**
   * Why the action is unavailable. Renders `aria-disabled` (keeps the tab stop), the dashed
   * disabled style, and the reason as visible text beside the button (or a tooltip).
   */
  disabledReason?: string;
  /** Where the reason shows. Inline text by default; `tooltip` where space is tight. */
  reasonDisplay?: "inline" | "tooltip";
  /** Count inside the button (`Filter 3`), behind a hairline. */
  count?: number;
  /** Keyboard hint inside the button (`N`). */
  kbd?: string;
  children?: ReactNode;
};

type NativeButtonProps = Omit<ComponentPropsWithRef<"button">, "children">;

/** Icon-only buttons must carry a name. */
export type ButtonProps = ButtonOwnProps &
  NativeButtonProps &
  ({ iconOnly?: false } | { iconOnly: true; icon: LucideIcon; "aria-label": string });

/** Class names for a v6 button look, for links and other elements styled as buttons. */
export function buttonClass({
  variant = "sec",
  size = "md",
  iconOnly = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  className?: string;
} = {}): string {
  return cx(
    styles.b,
    styles[variant],
    size === "md" ? undefined : styles[size],
    iconOnly && styles.iconOnly,
    className,
  );
}

/**
 * v6 button. Real `<button>`, `type="button"` by default, 2px focus outline with 2px offset
 * (white on the hero). Heights come from tokens, so `pointer:coarse` lifts them to 44px.
 */
export function Button(props: ButtonProps) {
  const {
    variant = "sec",
    size = "md",
    icon,
    iconEnd,
    loading = false,
    disabledReason,
    reasonDisplay = "inline",
    count,
    kbd,
    iconOnly,
    className,
    children,
    onClick,
    type = "button",
    "aria-describedby": describedBy,
    ...rest
  } = props;
  const reasonId = useId();
  const off = Boolean(disabledReason);
  const iconSize = size === "lg" ? 16 : size === "sm" ? 14 : 16;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (off || loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  const button = (
    <button
      type={type}
      className={buttonClass({ variant, size, iconOnly: Boolean(iconOnly), className })}
      aria-disabled={off || undefined}
      aria-busy={loading || undefined}
      aria-describedby={cx(describedBy, off && reasonId) || undefined}
      onClick={handleClick}
      {...rest}
    >
      {loading ? <Spinner /> : icon ? <Icon icon={icon} size={iconSize} /> : null}
      {iconOnly ? null : <span className={styles.label}>{children}</span>}
      {count != null ? <Count n={count} className={styles.count} /> : null}
      {kbd ? <Kbd className={styles.kbd}>{kbd}</Kbd> : null}
      {iconEnd ? <Icon icon={iconEnd} size={14} className={styles.endIcon} /> : null}
    </button>
  );

  if (!off) return button;

  if (reasonDisplay === "tooltip") {
    return (
      <>
        <Tooltip content={disabledReason!} presentationOnly>
          {button}
        </Tooltip>
        <SrOnly id={reasonId}>{disabledReason}</SrOnly>
      </>
    );
  }

  return (
    <span className={styles.withReason}>
      <span className={styles.reason} id={reasonId}>
        <Icon icon={Lock} size={14} />
        {disabledReason}
      </span>
      {button}
    </span>
  );
}

/**
 * The visible reason `Button` shows beside a disabled action, for a native `<button>` that cannot
 * become a `Button` without changing its look. Point the button's `aria-describedby` at `id`.
 */
export function DisabledReason({ id, children }: { id: string; children: ReactNode }) {
  return (
    <span className={styles.reason} id={id}>
      <Icon icon={Lock} size={14} />
      {children}
    </span>
  );
}

export type SplitButtonProps = {
  /** Main action label. */
  children: ReactNode;
  onClick: () => void;
  /** Items for the caret menu. */
  menuItems: MenuItem[];
  /** Accessible name of the caret, such as "More referral options". */
  menuLabel: string;
  variant?: Extract<ButtonVariant, "pri" | "sec" | "light">;
  size?: ButtonSize;
  icon?: LucideIcon;
  kbd?: string;
  className?: string;
};

/**
 * Primary action plus a caret that opens a menu, as on the header New referral. Two real
 * buttons: the main action, and the caret (`aria-haspopup="menu"`).
 */
export function SplitButton({
  children,
  onClick,
  menuItems,
  menuLabel,
  variant = "pri",
  size = "md",
  icon,
  kbd,
  className,
}: SplitButtonProps) {
  return (
    <span className={cx(styles.split, className)}>
      <Button variant={variant} size={size} icon={icon} kbd={kbd} className={styles.splitMain} onClick={onClick}>
        {children}
      </Button>
      <Menu
        label={menuLabel}
        items={menuItems}
        align="end"
        trigger={(triggerProps) => (
          <button
            {...triggerProps}
            type="button"
            aria-label={menuLabel}
            className={buttonClass({ variant, size, iconOnly: true, className: styles.splitCaret })}
          >
            <Icon icon={ChevronDown} size={14} />
          </button>
        )}
      />
    </span>
  );
}
