"use client";

import { useId, type ComponentPropsWithRef, type MouseEvent, type ReactNode } from "react";
import { Lock, type LucideIcon } from "lucide-react";
import { Tooltip } from "./tooltip";
import { cx } from "./cx";
import { Icon } from "./icon";
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
  /**
   * Called when the button is pressed while `disabledReason` holds (the action itself still does
   * not run), so a form can show its error summary. Not called while loading.
   */
  onUnavailablePress?: () => void;
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
 * (white on the hero). Heights follow density/pointer tokens. `data-placement-action` keeps
 * medium placement decisions at least 48px across phone, tablet and desktop.
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
    onUnavailablePress,
    count,
    kbd,
    iconOnly,
    className,
    children,
    onClick,
    type = "button",
    disabled,
    "aria-disabled": ariaDisabled,
    "aria-describedby": describedBy,
    ...rest
  } = props;
  const reasonId = useId();
  const off = Boolean(disabledReason);
  const isAriaDisabled = off || ariaDisabled === true || ariaDisabled === "true";
  const restProps = isAriaDisabled ? rest : disabled !== undefined ? { ...rest, disabled } : rest;
  const iconSize = size === "lg" ? 16 : size === "sm" ? 14 : 16;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (off || loading) {
      event.preventDefault();
      if (off && !loading) onUnavailablePress?.();
      return;
    }
    if (isAriaDisabled) {
      // Caller-owned aria-disabled: block the native action but let the caller's guard announce why.
      event.preventDefault();
    }
    onClick?.(event);
  };

  const button = (
    <button
      {...restProps}
      type={type}
      className={buttonClass({ variant, size, iconOnly: Boolean(iconOnly), className })}
      aria-disabled={isAriaDisabled || undefined}
      aria-busy={loading || undefined}
      aria-describedby={cx(describedBy, off && reasonId) || undefined}
      onClick={handleClick}
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
