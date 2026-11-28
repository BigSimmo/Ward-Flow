"use client";

import { useId, type ComponentPropsWithRef, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "./cx";
import { Icon } from "./icon";
import { useFieldProps, withReason } from "./form-field";
import styles from "./form.module.css";

export type SelectProps = ComponentPropsWithRef<"select"> & {
  invalid?: boolean;
  boxClassName?: string;
  /**
   * Why the control cannot be changed now (K11, design audit 5 Nov 2026; DESIGN-SYSTEM §4 Actions):
   * `aria-disabled` with the tab stop kept, changes are refused, and the reason shows as text
   * beside it, linked by `aria-describedby`. Use it in place of `disabled` wherever a reason exists.
   */
  disabledReason?: string;
};

/** Native select in the v6 box, with a caret. */
/** Keys that move, open or pick in a native select. Arrows count with Alt too (Alt+Down opens it). */
const SELECT_CHANGE_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Enter",
  " ",
  "Spacebar",
]);

/**
 * Whether a key press would change a refused Select (PR #1474 review). Tab, Escape, F1 to F12 and
 * Ctrl, Cmd or Alt shortcuts pass through; arrows, Home, End, Page Up and Down, Space, Enter and
 * typed characters (which jump to a matching option) are refused.
 */
function keyChangesSelect(event: Pick<KeyboardEvent, "key" | "altKey" | "ctrlKey" | "metaKey">): boolean {
  if (event.key.startsWith("Arrow") && event.altKey) return true;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return SELECT_CHANGE_KEYS.has(event.key) || [...event.key].length === 1;
}

export function Select({
  id,
  invalid,
  className,
  boxClassName,
  children,
  disabledReason,
  "aria-describedby": describedBy,
  ...rest
}: SelectProps) {
  const reasonId = useId();
  const off = Boolean(disabledReason);
  const fieldProps = useFieldProps(id, cx(describedBy, off && reasonId) || undefined, invalid);
  // A native select has no read-only state, so an unavailable one refuses the press and the keys
  // that would change it, and keeps its tab stop. Taps never reach it (`.refusedSelect`), since iOS
  // Safari opens the picker despite a cancelled mousedown; the reason is plain text beside it.
  const refuse = off
    ? {
        "aria-disabled": true as const,
        onMouseDown: (event: { preventDefault: () => void }) => event.preventDefault(),
        onKeyDown: (event: KeyboardEvent<HTMLSelectElement>) => {
          if (keyChangesSelect(event)) event.preventDefault();
        },
        onChange: () => undefined,
      }
    : {};
  const box = (
    <div className={cx(styles.in, fieldProps["aria-invalid"] && styles.invalid, off && styles.locked, boxClassName)}>
      <select
        className={cx(styles.control, styles.select, off && styles.refusedSelect, className)}
        {...fieldProps}
        {...rest}
        {...refuse}
      >
        {children}
      </select>
      <Icon icon={ChevronDown} size={16} className={styles.selectCaret} />
    </div>
  );
  return withReason(box, reasonId, disabledReason);
}
