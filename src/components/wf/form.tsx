"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Check, ChevronDown, Lock, Minus, Plus, X, type LucideIcon } from "lucide-react";
import { cx } from "./cx";
import { Icon } from "./icon";
import { StatusGlyph } from "./status-glyph";
import styles from "./form.module.css";

type FieldContextValue = { id: string; describedBy?: string; invalid: boolean };
const FieldContext = createContext<FieldContextValue | null>(null);

export type FieldProps = {
  label: ReactNode;
  /** Format hint at the right of the label row ("DD/MM/YYYY"). Shown before any error. */
  hint?: ReactNode;
  /** Help under the control. */
  help?: ReactNode;
  /** Error under the control: glyph and text, and `aria-invalid` on the control. */
  error?: ReactNode;
  /** Control id. Generated when omitted. */
  id?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Label above, help below. The control inside (TextInput, Textarea, Select) picks up its id,
 * `aria-describedby` (hint, help and error) and `aria-invalid` from the field.
 */
export function Field({ label, hint, help, error, id: idProp, children, className }: FieldProps) {
  const generated = useId();
  const id = idProp ?? generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = cx(hintId, errorId, helpId) || undefined;
  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cx(styles.field, className)}>
        <div className={styles.labelRow}>
          <label htmlFor={id} className={styles.label}>
            {label}
          </label>
          {hint ? (
            <span id={hintId} className={styles.hint}>
              {hint}
            </span>
          ) : null}
        </div>
        {children}
        {error ? (
          <span id={errorId} className={cx(styles.help, styles.error)}>
            <StatusGlyph tone="danger" size={9} />
            {error}
          </span>
        ) : null}
        {help ? (
          <span id={helpId} className={styles.help}>
            {help}
          </span>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

function useFieldProps(id?: string, describedBy?: string, invalid?: boolean) {
  const field = useContext(FieldContext);
  return {
    id: id ?? field?.id,
    "aria-describedby": cx(field?.describedBy, describedBy) || undefined,
    "aria-invalid": invalid || field?.invalid || undefined,
  };
}

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
  "aria-describedby": describedBy,
  ...rest
}: TextInputProps) {
  const fieldProps = useFieldProps(id, describedBy, invalid);
  const hasValue = rest.value != null && String(rest.value).length > 0;
  return (
    <div className={cx(styles.in, fieldProps["aria-invalid"] && styles.invalid, locked && styles.locked, boxClassName)}>
      {icon ? <Icon icon={icon} size={16} className={styles.adorn} /> : null}
      <input className={cx(styles.control, className)} readOnly={locked || readOnly} {...fieldProps} {...rest} />
      {trailing ? <span className={styles.adorn}>{trailing}</span> : null}
      {locked ? (
        <span className={styles.adorn}>
          <Icon icon={Lock} size={14} />
          Locked
        </span>
      ) : null}
      {onClear && hasValue && !locked ? (
        <button type="button" className={styles.clear} aria-label="Clear" onClick={onClear}>
          <Icon icon={X} size={14} />
        </button>
      ) : null}
    </div>
  );
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

export type SelectProps = ComponentPropsWithRef<"select"> & { invalid?: boolean; boxClassName?: string };

/** Native select in the v6 box, with a caret. */
export function Select({
  id,
  invalid,
  className,
  boxClassName,
  children,
  "aria-describedby": describedBy,
  ...rest
}: SelectProps) {
  const fieldProps = useFieldProps(id, describedBy, invalid);
  return (
    <div className={cx(styles.in, fieldProps["aria-invalid"] && styles.invalid, boxClassName)}>
      <select className={cx(styles.control, styles.select, className)} {...fieldProps} {...rest}>
        {children}
      </select>
      <Icon icon={ChevronDown} size={16} className={styles.selectCaret} />
    </div>
  );
}

export type CheckboxProps = Omit<ComponentPropsWithRef<"input">, "type" | "children"> & {
  label: ReactNode;
  /** Mixed state (some rows selected). */
  indeterminate?: boolean;
};

/** Real checkbox; the whole label row is the target. */
export function Checkbox({
  label,
  indeterminate = false,
  className,
  disabled,
  ref: forwardedRef,
  ...rest
}: CheckboxProps) {
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
  return (
    <label className={cx(styles.choice, disabled && styles.choiceDisabled, className)}>
      <input ref={setRef} type="checkbox" className={styles.native} disabled={disabled} {...rest} />
      <span className={styles.box} aria-hidden="true">
        <Check size={12} strokeWidth={3} className={cx(styles.mark, styles.tick)} aria-hidden="true" />
        <Minus size={12} strokeWidth={3} className={cx(styles.mark, styles.dash)} aria-hidden="true" />
      </span>
      {label}
    </label>
  );
}

export type RadioProps = Omit<ComponentPropsWithRef<"input">, "type" | "children"> & { label: ReactNode };

/** Real radio; group them by `name` inside a fieldset with a legend. */
export function Radio({ label, className, disabled, ...rest }: RadioProps) {
  return (
    <label className={cx(styles.choice, disabled && styles.choiceDisabled, className)}>
      <input type="radio" className={styles.native} disabled={disabled} {...rest} />
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </label>
  );
}

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
  className,
}: SwitchProps) {
  const labelId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      {...(unavailable ? { "aria-disabled": true } : { disabled })}
      className={cx(
        styles.switchRow,
        !block && styles.inline,
        onHero && styles.onHero,
        unavailable && styles.unavailable,
        className,
      )}
      onClick={() => onCheckedChange(!checked)}
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
}

export type StepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Plural noun for names: "escorts" gives "Decrease escorts" and "Increase escorts". */
  noun: string;
  /** Spoken value ("2 escorts"). Defaults to "<value> <noun>". */
  valueText?: string;
  /** Short note after the control ("Clinical pair"). */
  note?: ReactNode;
  /** Shown in place of the raw number ("24h", "09:30"). */
  display?: ReactNode;
  /** `data-testid` on the value. */
  valueTestId?: string;
  /** Shown for review but not connected: every part is `aria-disabled` and still focusable;
   *  presses still call `onChange` so the screen can say why. */
  unavailable?: boolean;
  className?: string;
};

/** Stepper: 36px buttons, mono value with `role="spinbutton"`; arrows, Home and End work on it. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  noun,
  valueText,
  note,
  display,
  valueTestId,
  unavailable = false,
  className,
}: StepperProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const set = (n: number) => {
    const next = clamp(n);
    if (next !== value || unavailable) onChange(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    const map: Record<string, number | undefined> = {
      ArrowUp: value + step,
      ArrowRight: value + step,
      ArrowDown: value - step,
      ArrowLeft: value - step,
      Home: min,
      End: max === Number.MAX_SAFE_INTEGER ? undefined : max,
    };
    const next = map[event.key];
    if (next === undefined) return;
    event.preventDefault();
    set(next);
  };
  const capitalised = noun.charAt(0).toUpperCase() + noun.slice(1);
  return (
    <span className={cx(styles.stepperRow, unavailable && styles.unavailable, className)}>
      <span className={styles.stp}>
        <button
          type="button"
          className={styles.stpButton}
          aria-label={`Decrease ${noun}`}
          aria-disabled={unavailable || value <= min || undefined}
          onClick={() => set(value - step)}
        >
          <Icon icon={Minus} size={16} />
        </button>
        <span
          role="spinbutton"
          tabIndex={0}
          aria-label={capitalised}
          aria-valuemin={min}
          aria-valuemax={max === Number.MAX_SAFE_INTEGER ? undefined : max}
          aria-valuenow={value}
          aria-valuetext={valueText ?? `${value} ${noun}`}
          aria-disabled={unavailable || undefined}
          className={styles.stpValue}
          data-testid={valueTestId}
          onKeyDown={onKeyDown}
        >
          {display ?? value}
        </span>
        <button
          type="button"
          className={styles.stpButton}
          aria-label={`Increase ${noun}`}
          aria-disabled={unavailable || value >= max || undefined}
          onClick={() => set(value + step)}
        >
          <Icon icon={Plus} size={16} />
        </button>
      </span>
      {note ? <span className={styles.stepperNote}>{note}</span> : null}
    </span>
  );
}
