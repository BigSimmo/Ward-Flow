"use client";

import { ChevronDown, User } from "lucide-react";
import { Children, cloneElement, isValidElement, type AriaAttributes, type ReactNode } from "react";
import styles from "./ward-referral-drawer.module.css";
import { StatusGlyph } from "@/components/wf";

/* The referral slide-out's small form parts, moved unchanged from `ward-referral-drawer.tsx`. */

type FieldChildProps = AriaAttributes & { id?: string; children?: ReactNode; required?: boolean };

/** Reach the native control through SelectBox and decorative wrappers. */
function describeControl(
  children: ReactNode,
  id: string,
  required: boolean,
  describedBy: string,
  invalid: boolean,
): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement<FieldChildProps>(child)) return child;
    if (
      typeof child.type === "string" &&
      ["input", "select", "textarea"].includes(child.type) &&
      (!child.props.id || child.props.id === id)
    ) {
      return cloneElement(child, {
        id,
        required: required || child.props.required || undefined,
        "aria-required": required || child.props["aria-required"] || undefined,
        "aria-invalid": invalid || child.props["aria-invalid"] || undefined,
        "aria-describedby":
          [...new Set(`${child.props["aria-describedby"] ?? ""} ${describedBy}`.split(/\s+/).filter(Boolean))].join(
            " ",
          ) || undefined,
      });
    }
    return child.props.children
      ? cloneElement(child, { children: describeControl(child.props.children, id, required, describedBy, invalid) })
      : child;
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
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ");
  return (
    <div className={`${styles.formField} ${wide ? styles.fieldWide : ""}`} data-invalid={error ? true : undefined}>
      <div className={styles.fieldLabelRow}>
        <label htmlFor={htmlFor} className={required ? styles.required : undefined}>
          {label}
        </label>
        {hint ? (
          <span id={hintId} className={styles.fieldHint}>
            {hint}
          </span>
        ) : null}
      </div>
      {describeControl(children, htmlFor, required, describedBy, Boolean(error))}
      {error ? (
        <p id={errorId} className={styles.fieldError}>
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
  required = false,
  id,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T | undefined;
  onChange: (value: T) => void;
  labels?: Partial<Record<T, string>>;
  required?: boolean;
  /** Put on the first option, for an error summary link. */
  id?: string;
}) {
  return (
    <fieldset className={styles.radioField}>
      <legend className={required ? styles.required : undefined}>{legend}</legend>
      <div className={styles.segmented}>
        {options.map((option, index) => (
          <label key={option} data-selected={value === option}>
            <input
              id={index === 0 ? id : undefined}
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
      <h3 className={styles.cardTitle} id={titleId} tabIndex={-1}>
        {title}
      </h3>
      {children ? <div className={styles.cardHeadAside}>{children}</div> : null}
    </div>
  );
}
