"use client";

import { useCallback, useEffect, useId, useRef, type ComponentPropsWithRef, type ReactNode } from "react";
import { Check, Minus } from "lucide-react";
import { cx } from "./cx";
import { withReason } from "./form-field";
import styles from "./form.module.css";

export type CheckboxProps = Omit<ComponentPropsWithRef<"input">, "type" | "children"> & {
  label: ReactNode;
  /** Mixed state (some rows selected). */
  indeterminate?: boolean;
  /**
   * Why the control cannot be changed now (K11, design audit 5 Nov 2026; DESIGN-SYSTEM §4 Actions):
   * `aria-disabled` with the tab stop kept, changes are refused, and the reason shows as text
   * beside it, linked by `aria-describedby`. Use it in place of `disabled` wherever a reason exists.
   */
  disabledReason?: string;
};

/**
 * The press guard and description an unavailable checkbox or radio takes (K11). As in Select, the
 * caller's `onChange` and `onClick` are replaced, so a refused press never reaches the caller (PR
 * #1474 review). React puts a controlled box back itself; an uncontrolled one has its press cancelled
 * instead (cancelling a controlled one's press as well leaves it showing the wrong state).
 */
function refusedChoice(reasonId: string, describedBy: string | undefined, off: boolean, controlled: boolean) {
  if (!off) return { "aria-describedby": describedBy };
  return {
    "aria-disabled": true as const,
    "aria-describedby": cx(describedBy, reasonId),
    onChange: () => undefined,
    onClick: (event: { preventDefault: () => void }) => {
      if (!controlled) event.preventDefault();
    },
  };
}

/** Real checkbox; the whole label row is the target. */
export function Checkbox({
  label,
  indeterminate = false,
  className,
  disabled,
  disabledReason,
  "aria-describedby": describedBy,
  ref: forwardedRef,
  ...rest
}: CheckboxProps) {
  const reasonId = useId();
  const off = Boolean(disabledReason);
  const ref = useRef<HTMLInputElement | null>(null);
  const setRef = useCallback(
    (node: HTMLInputElement | null) => {
      ref.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  const row = (
    <label className={cx(styles.choice, (disabled || off) && styles.choiceDisabled, className)}>
      <input
        ref={setRef}
        type="checkbox"
        className={styles.native}
        disabled={disabled && !off}
        {...rest}
        {...refusedChoice(reasonId, describedBy, off, rest.checked !== undefined)}
      />
      <span className={styles.box} aria-hidden="true">
        <Check size={12} strokeWidth={3} className={cx(styles.mark, styles.tick)} aria-hidden="true" />
        <Minus size={12} strokeWidth={3} className={cx(styles.mark, styles.dash)} aria-hidden="true" />
      </span>
      {label}
    </label>
  );
  return withReason(row, reasonId, disabledReason);
}

export type RadioProps = Omit<ComponentPropsWithRef<"input">, "type" | "children"> & {
  label: ReactNode;
  /**
   * Why the control cannot be changed now (K11, design audit 5 Nov 2026; DESIGN-SYSTEM §4 Actions):
   * `aria-disabled` with the tab stop kept, changes are refused, and the reason shows as text
   * beside it, linked by `aria-describedby`. Use it in place of `disabled` wherever a reason exists.
   */
  disabledReason?: string;
};

/** Real radio; group them by `name` inside a fieldset with a legend. */
export function Radio({
  label,
  className,
  disabled,
  disabledReason,
  "aria-describedby": describedBy,
  ...rest
}: RadioProps) {
  const reasonId = useId();
  const off = Boolean(disabledReason);
  const row = (
    <label className={cx(styles.choice, (disabled || off) && styles.choiceDisabled, className)}>
      <input
        type="radio"
        className={styles.native}
        disabled={disabled && !off}
        {...rest}
        {...refusedChoice(reasonId, describedBy, off, rest.checked !== undefined)}
      />
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </label>
  );
  return withReason(row, reasonId, disabledReason);
}
