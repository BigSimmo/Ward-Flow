"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { cx } from "./cx";
import { Icon } from "./icon";
import styles from "./form.module.css";

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
  /**
   * Lets the value be typed as well as stepped (live walk 16 Nov 2026): the value becomes a text box
   * that reads what is typed with this, on Enter or on leaving it. Null, or a value outside the
   * bounds, puts the shown value back; Escape does too. The bounds are the stepper's own.
   */
  parse?: (text: string) => number | null;
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
  parse,
  className,
}: StepperProps) {
  // The typed words while the box is being edited; null shows the value's own words.
  const [typed, setTyped] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const set = (n: number) => {
    const next = clamp(n);
    if (next !== value || unavailable) onChange(next);
  };
  const commitTyped = () => {
    if (typed === null) return;
    setTyped(null);
    const next = parse?.(typed) ?? null;
    if (next === null || next < min || next > max) return;
    set(next);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (parse && event.key === "Enter") {
      event.preventDefault();
      commitTyped();
      return;
    }
    if (parse && event.key === "Escape" && typed !== null) {
      event.preventDefault();
      setTyped(null);
      return;
    }
    // While typing, Home and End move the caret.
    if (parse && typed !== null && (event.key === "Home" || event.key === "End")) return;
    // In a text box Left and Right move the caret; Up and Down still step.
    if (parse && (event.key === "ArrowLeft" || event.key === "ArrowRight")) return;
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
    setTyped(null);
    set(next);
  };
  const capitalised = noun.charAt(0).toUpperCase() + noun.slice(1);
  const shownWords = typeof display === "string" ? display : String(value);
  const valueProps = {
    "aria-label": capitalised,
    "aria-valuemin": min,
    "aria-valuemax": max === Number.MAX_SAFE_INTEGER ? undefined : max,
    "aria-valuenow": value,
    "aria-valuetext": valueText ?? `${value} ${noun}`,
    "aria-disabled": unavailable || undefined,
    "data-testid": valueTestId,
    onKeyDown,
  } as const;
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
        {parse ? (
          <input
            {...valueProps}
            role="spinbutton"
            type="text"
            className={cx(styles.stpValue, styles.stpInput)}
            value={typed ?? shownWords}
            size={Math.max(3, (typed ?? shownWords).length)}
            readOnly={unavailable}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
            onBlur={commitTyped}
          />
        ) : (
          <span {...valueProps} role="spinbutton" tabIndex={0} className={styles.stpValue}>
            {display ?? value}
          </span>
        )}
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
