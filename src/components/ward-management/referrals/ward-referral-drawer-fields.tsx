"use client";

import type { RefObject } from "react";
import { ChevronDown, User } from "lucide-react";
import styles from "./ward-referral-drawer.module.css";
import { StatusGlyph } from "@/components/wf";

/* The referral slide-out's small form parts, moved unchanged from `ward-referral-drawer.tsx`. */

/** The id of a field's error line, which its control names in `aria-describedby`. */
function fieldErrorId(htmlFor: string): string {
  return `${htmlFor}-error`;
}

/**
 * DA-12 (design audit, Josh, 19 Oct 2026): spread on the control a `Field` labels, with the same
 * error, so the control is marked invalid and reads out its error line.
 */
export function invalidProps(htmlFor: string, error: string | null | undefined) {
  return error ? { "aria-invalid": true as const, "aria-describedby": fieldErrorId(htmlFor) } : {};
}

/**
 * DA-12: after a refused step, once the marks are drawn, focus the first marked control on view.
 * A step whose problem has no field of its own (documents, the catchment confirm) keeps the alert
 * line only.
 */
export function focusFirstInvalid(root: RefObject<HTMLElement | null>) {
  requestAnimationFrame(() => {
    const marked = root.current?.querySelectorAll<HTMLElement>('[aria-invalid="true"]') ?? [];
    [...marked].find((control) => !control.closest("[hidden]"))?.focus();
  });
}

export function Field({
  label,
  htmlFor,
  required = false,
  hint,
  error,
  children,
  wide = false,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`${styles.formField} ${wide ? styles.fieldWide : ""}`} data-invalid={error ? true : undefined}>
      <div className={styles.fieldLabelRow}>
        <label htmlFor={htmlFor} className={required ? styles.required : undefined}>
          {label}
        </label>
        {hint ? <span className={styles.fieldHint}>{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p className={styles.fieldError} id={fieldErrorId(htmlFor)}>
          <StatusGlyph tone="danger" size={9} />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SelectBox({ children }: { children: React.ReactNode }) {
  return (
    <span className={styles.selectBox}>
      {children}
      <ChevronDown aria-hidden="true" />
    </span>
  );
}

/** One answer from a short list, as a segmented row. Nothing is chosen until the referrer picks. */
export function Choice<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  labels,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T | undefined;
  onChange: (value: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <fieldset className={styles.radioField}>
      <legend>{legend}</legend>
      <div className={styles.segmented}>
        {options.map((option) => (
          <label key={option} data-selected={value === option}>
            <input
              type="radio"
              name={name}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            {labels?.[option] ?? option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CardHead({
  icon: Icon,
  title,
  titleId,
  children,
}: {
  icon: typeof User;
  title: string;
  titleId?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={styles.cardHead}>
      <span className={styles.cardIcon} aria-hidden="true">
        <Icon aria-hidden="true" />
      </span>
      <h3 className={styles.cardTitle} id={titleId}>
        {title}
      </h3>
      {children ? <div className={styles.cardHeadAside}>{children}</div> : null}
    </div>
  );
}
