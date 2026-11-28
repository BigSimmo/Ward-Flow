"use client";

import { useId, useState, type ComponentPropsWithRef, type ReactNode } from "react";
import { Lock, X, type LucideIcon } from "lucide-react";
import { cx } from "./cx";
import { Icon } from "./icon";
import { useFieldProps, withReason } from "./form-field";
import styles from "./form.module.css";

export type TextInputProps = Omit<ComponentPropsWithRef<"input">, "size"> & {
  /** Leading Lucide icon (search, clock). */
  icon?: LucideIcon;
  /** Trailing content: a Kbd, a unit, "today". */
  trailing?: ReactNode;
  /** Shows a clear button while there is a value. */
  onClear?: () => void;
  /** Locked: dashed, read only, with "Locked" and a lock icon. */
  locked?: boolean;
  /** Error look without a Field. */
  invalid?: boolean;
  /**
   * Why the control cannot be changed now (K11, design audit 5 Nov 2026; DESIGN-SYSTEM §4 Actions):
   * `aria-disabled` with the tab stop kept, changes are refused, and the reason shows as text
   * beside it, linked by `aria-describedby`. Use it in place of `disabled` wherever a reason exists.
   */
  disabledReason?: string;
  boxClassName?: string;
};

/** Text input in the v6 box. Use inside `Field` for the label, help and error. */
export function TextInput({
  icon,
  trailing,
  onClear,
  locked = false,
  invalid,
  id,
  className,
  boxClassName,
  readOnly,
  onChange,
  disabledReason,
  "aria-describedby": describedBy,
  ...rest
}: TextInputProps) {
  const reasonId = useId();
  const off = Boolean(disabledReason);
  const fieldProps = useFieldProps(id, cx(describedBy, off && reasonId) || undefined, invalid);
  const hasValue = rest.value != null && String(rest.value).length > 0;
  // WF-30 (live test, 4 Nov 2026): a capped input says so as it nears the cap, and says plainly when
  // the cap is reached, instead of silently dropping what is typed or pasted. An uncontrolled input
  // counts from its default value and what is typed, as `Textarea` does.
  const max = typeof rest.maxLength === "number" && rest.maxLength > 0 ? rest.maxLength : null;
  const [uncontrolledLength, setUncontrolledLength] = useState(() => String(rest.defaultValue ?? "").length);
  const typed = rest.value != null ? String(rest.value).length : uncontrolledLength;
  const showsCount = max !== null && max >= 20;
  const nearCap = showsCount && typed >= Math.floor(max * 0.8);
  const box = (
    <div
      className={cx(
        styles.in,
        fieldProps["aria-invalid"] && styles.invalid,
        (locked || off) && styles.locked,
        boxClassName,
      )}
    >
      {icon ? <Icon icon={icon} size={16} className={styles.adorn} /> : null}
      <input
        className={cx(styles.control, className)}
        readOnly={locked || off || readOnly}
        aria-disabled={off || undefined}
        spellCheck={false}
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        onChange={(event) => {
          setUncontrolledLength(event.target.value.length);
          onChange?.(event);
        }}
        {...fieldProps}
        {...rest}
      />
      {trailing ? <span className={styles.adorn}>{trailing}</span> : null}
      {nearCap ? (
        <span className={cx(styles.adorn, styles.counter)} data-testid="wf-input-limit" aria-hidden="true">
          {typed}/{max}
        </span>
      ) : null}
      {/* Mounted empty once the count shows, before the cap, so a screen reader hears the message
          when the cap is reached. */}
      {nearCap ? (
        <span className={styles.limitNote} role="status">
          {typed >= max ? `Limit of ${max} characters reached` : ""}
        </span>
      ) : null}
      {locked ? (
        <span className={styles.adorn}>
          <Icon icon={Lock} size={14} />
          Locked
        </span>
      ) : null}
      {onClear && hasValue && !locked && !off ? (
        <button type="button" className={styles.clear} aria-label="Clear" onClick={onClear}>
          <Icon icon={X} size={14} />
        </button>
      ) : null}
    </div>
  );
  return withReason(box, reasonId, disabledReason);
}

export type TextareaProps = ComponentPropsWithRef<"textarea"> & { invalid?: boolean; boxClassName?: string };

/** Textarea with a mono counter when `maxLength` is set. */
export function Textarea({
  id,
  invalid,
  maxLength,
  className,
  boxClassName,
  onChange,
  "aria-describedby": describedBy,
  ...rest
}: TextareaProps) {
  const fieldProps = useFieldProps(id, describedBy, invalid);
  const [length, setLength] = useState(() => String(rest.value ?? rest.defaultValue ?? "").length);
  const shownLength = rest.value != null ? String(rest.value).length : length;
  return (
    <div className={cx(styles.in, styles.area, fieldProps["aria-invalid"] && styles.invalid, boxClassName)}>
      <textarea
        className={cx(styles.control, styles.areaControl, className)}
        maxLength={maxLength}
        spellCheck={false}
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        onChange={(event) => {
          setLength(event.target.value.length);
          onChange?.(event);
        }}
        {...fieldProps}
        {...rest}
      />
      {maxLength ? (
        <span className={styles.counter} aria-hidden="true">
          {shownLength}/{maxLength}
        </span>
      ) : null}
    </div>
  );
}
