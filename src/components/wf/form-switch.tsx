"use client";

import { useId, type ReactNode } from "react";
import { cx } from "./cx";
import { withReason } from "./form-field";
import styles from "./form.module.css";

export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  /** Visible state words. */
  onText?: string;
  offText?: string;
  /** Row fills its container (settings lists). */
  block?: boolean;
  onHero?: boolean;
  disabled?: boolean;
  /** Shown for review but not connected: `aria-disabled`, still focusable, clicks still call
   *  `onCheckedChange` so the screen can say why. */
  unavailable?: boolean;
  /**
   * Why the control cannot be changed now (K11, design audit 5 Nov 2026; DESIGN-SYSTEM §4 Actions):
   * `aria-disabled` with the tab stop kept, changes are refused, and the reason shows as text
   * beside it, linked by `aria-describedby`. Use it in place of `disabled` wherever a reason exists.
   */
  disabledReason?: string;
  className?: string;
};

/** `role="switch"` with `aria-checked` and a visible On or Off word. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  onText = "On",
  offText = "Off",
  block = false,
  onHero = false,
  disabled,
  unavailable = false,
  disabledReason,
  className,
}: SwitchProps) {
  const labelId = useId();
  const reasonId = useId();
  const off = Boolean(disabledReason);
  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={off ? reasonId : undefined}
      {...(unavailable || off ? { "aria-disabled": true } : { disabled })}
      className={cx(
        styles.switchRow,
        !block && styles.inline,
        onHero && styles.onHero,
        (unavailable || off) && styles.unavailable,
        className,
      )}
      onClick={() => {
        if (!off) onCheckedChange(!checked);
      }}
    >
      <span id={labelId} className={styles.switchLabel}>
        {label}
      </span>
      <span className={styles.track} aria-hidden="true" />
      <span className={styles.switchState} aria-hidden="true">
        {checked ? onText : offText}
      </span>
    </button>
  );
  return withReason(toggle, reasonId, disabledReason);
}
