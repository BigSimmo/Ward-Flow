"use client";

import { createContext, useCallback, useContext, useEffect, useId, useState, type ReactNode } from "react";
import { DisabledReason } from "./button";
import { cx } from "./cx";
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
  /**
   * Audit two #81 (K31): one quiet "Optional" after the label. Required fields carry no mark, so
   * this is the only marker a form uses.
   */
  optional?: boolean;
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
  optional = false,
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
            {optional ? <span className={styles.optional}> Optional</span> : null}
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

export function useFieldProps(id?: string, describedBy?: string, invalid?: boolean) {
  const field = useContext(FieldContext);
  return {
    id: id ?? field?.id,
    "aria-describedby": cx(field?.describedBy, describedBy) || undefined,
    "aria-invalid": invalid || field?.invalid || undefined,
  };
}

/** The control, then its reason (K11) when it has one, linked by the reason's id. */
export function withReason(control: ReactNode, reasonId: string, reason: string | undefined) {
  if (!reason) return control;
  return (
    <>
      {control}
      <DisabledReason id={reasonId}>{reason}</DisabledReason>
    </>
  );
}
