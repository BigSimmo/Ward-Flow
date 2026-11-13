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
import { DisabledReason } from "./button";
import { cx } from "./cx";
import { Icon } from "./icon";
import { StatusGlyph } from "./status-glyph";
import styles from "./form.module.css";

type FieldContextValue = {
  id: string;
  describedBy?: string;
  invalid: boolean;
  /** A control inside reports its own default error (or null), shown when the caller gives none. */
  reportError?: (key: string, text: ReactNode | null) => void;
};
const FieldContext = createContext<FieldContextValue | null>(null);

/** The error line under a control: danger glyph and words, announced when it appears. */
function ErrorLine({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <span id={id} role="alert" className={cx(styles.help, styles.error, styles.errorText)}>
      <StatusGlyph tone="danger" size={9} />
      {children}
    </span>
  );
}

/**
 * Spec item 13 (C05, 13 Nov 2026): a kit control that knows its typed value is impossible (a date
 * that does not exist, a time past 23:59) gives default words, shown under the box. Inside a Field
 * the words go to the Field's error line, unless the caller passed its own `error`; outside one the
 * control draws the line itself and links it with the returned `errorId`.
 */
export function useControlError(text: ReactNode | null): { errorId?: string; line: ReactNode } {
  const field = useContext(FieldContext);
  const key = useId();
  const report = field?.reportError;
  const shown = text ?? null;
  useEffect(() => {
    if (!report) return;
    report(key, shown);
    return () => report(key, null);
  }, [report, key, shown]);
  if (report || shown === null) return { line: null };
  const errorId = `${key}-error`;
  return { errorId, line: <ErrorLine id={errorId}>{shown}</ErrorLine> };
}

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
  /**
   * `stack` (the default): label above, answer below. `row`: label beside the answer, with the
   * error and help lines under the box in the answer column (spec item 17, C32, 13 Nov 2026), so a
   * form of short answers stops writing its own grid. The label column is `--wf-field-label-w`.
   */
  layout?: "stack" | "row";
  /**
   * Keeps one line's room under the box while there is no error or help, so words appearing there
   * never move the controls below (spec items 10 and 17).
   */
  reserveLine?: boolean;
};

/**
 * Label above (or beside, `layout="row"`), then the box, then its error and help lines, always under
 * the box at the full width of the answer. The control inside (TextInput, Textarea, Select) picks up
 * its id, `aria-describedby` (hint, help and error) and `aria-invalid` from the field.
 */
export function Field({
  label,
  hint,
  help,
  error,
  id: idProp,
  children,
  className,
  layout = "stack",
  reserveLine = false,
}: FieldProps) {
  const generated = useId();
  const id = idProp ?? generated;
  const [controlErrors, setControlErrors] = useState<ReadonlyMap<string, ReactNode>>(() => new Map());
  const reportError = useCallback((key: string, text: ReactNode | null) => {
    setControlErrors((previous) => {
      if (text === null ? !previous.has(key) : previous.get(key) === text) return previous;
      const next = new Map(previous);
      if (text === null) next.delete(key);
      else next.set(key, text);
      return next;
    });
  }, []);
  // The caller's own words win; a control's default words show only when the caller gives none.
  const shownError = error || controlErrors.values().next().value || null;
  const hintId = hint ? `${id}-hint` : undefined;
  const helpId = help ? `${id}-help` : undefined;
  const errorId = shownError ? `${id}-error` : undefined;
  const describedBy = cx(hintId, errorId, helpId) || undefined;
  const answer = (
    <>
      {children}
      {shownError ? <ErrorLine id={errorId}>{shownError}</ErrorLine> : null}
      {help ? (
        <span id={helpId} className={styles.help}>
          {help}
        </span>
      ) : null}
      {reserveLine && !shownError && !help ? <span className={styles.reservedLine} aria-hidden="true" /> : null}
    </>
  );
  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error), reportError }}>
      <div className={cx(styles.field, layout === "row" && styles.fieldRow, className)} data-layout={layout}>
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
        {layout === "row" ? <div className={styles.answer}>{answer}</div> : answer}
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

/** The control, then its reason (K11) when it has one, linked by the reason's id. */
function withReason(control: ReactNode, reasonId: string, reason: string | undefined) {
  if (!reason) return control;
  return (
    <>
      {control}
      <DisabledReason id={reasonId}>{reason}</DisabledReason>
    </>
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
          title={!unavailable && value <= min ? "Already at the lowest allowed value" : undefined}
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
          title={!unavailable && value >= max ? "Already at the highest allowed value" : undefined}
          onClick={() => set(value + step)}
        >
          <Icon icon={Plus} size={16} />
        </button>
      </span>
      {note ? <span className={styles.stepperNote}>{note}</span> : null}
    </span>
  );
}

export type ErrorSummaryItem = {
  /** The id of the control to move to. */
  id: string;
  /** What to do, in plain words ("Choose a movement"). */
  text: string;
};

export type ErrorSummaryProps = {
  /** Every problem, in the order the fields appear. Nothing shows when the list is empty. */
  items: readonly ErrorSummaryItem[];
  /** The end of the heading: "before saving" gives "2 things to fix before saving". */
  action: string;
  /** Change it on each refused submit (a counter) to move focus to the heading. 0 never moves focus. */
  focusKey?: number;
  headingLevel?: 2 | 3 | 4;
  className?: string;
};

/**
 * One short list at the top of a form after a refused submit: a counted heading and a link to
 * each field that needs an answer. Focus moves to the heading (tabindex -1) so a screen reader
 * reads the count first; each link moves focus to its field. It adds nothing to the URL.
 */
export function ErrorSummary({ items, action, focusKey = 0, headingLevel = 3, className }: ErrorSummaryProps) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const headingId = useId();
  const shown = items.length > 0;
  useEffect(() => {
    if (!focusKey || !shown) return;
    const heading = headingRef.current;
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView?.({ block: "nearest" });
  }, [focusKey, shown]);
  if (!shown) return null;
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={cx(styles.summary, className)} role="group" aria-labelledby={headingId} data-error-summary="">
      <Heading ref={headingRef} id={headingId} tabIndex={-1} className={styles.summaryHead}>
        <StatusGlyph tone="danger" size={9} />
        {items.length} {items.length === 1 ? "thing" : "things"} to fix {action}
      </Heading>
      <ul className={styles.summaryList}>
        {items.map((item) => (
          <li key={`${item.id}:${item.text}`}>
            <a
              href={`#${item.id}`}
              className={styles.summaryLink}
              onClick={(event) => {
                event.preventDefault();
                const field = document.getElementById(item.id);
                if (!field) return;
                field.focus({ preventScroll: true });
                field.scrollIntoView?.({ block: "center" });
              }}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
