"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { cx } from "./cx";
import { Icon } from "./icon";
import { Count } from "./primitives";
import { StatusGlyph, type WfTone } from "./status-glyph";
import styles from "./choice.module.css";

export type ChoiceItem<T extends string = string> = {
  id: T;
  label: ReactNode;
  /** Count in `.k`, behind the label. */
  count?: number | string;
  /** Glyph before the label. */
  tone?: WfTone;
  /** Segmented and HeroTrack only: render the item as a link (route tabs). */
  href?: string;
};

/**
 * The item that holds the tab stop: the selected one, or the first when nothing matches the value
 * (a stale filter, an empty selection). Without this fallback every item gets tabIndex -1 and the
 * whole group drops out of the keyboard order.
 */
function tabStopIndex<T extends string>(items: ChoiceItem<T>[], value: T): number {
  return Math.max(
    0,
    items.findIndex((item) => item.id === value),
  );
}

/** Arrow, Home and End keys move between items and select the one reached (automatic activation). */
function useRoving<T extends string>(items: ChoiceItem<T>[], value: T, onChange: (id: T) => void) {
  const refs = useRef<Array<HTMLElement | null>>([]);
  const onKeyDown = (event: KeyboardEvent) => {
    const count = items.length;
    if (count === 0) return;
    const current = tabStopIndex(items, value);
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % count;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current - 1 + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    if (next === null) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onChange(items[next]!.id);
  };
  return { refs, onKeyDown };
}

export type TabsProps<T extends string> = {
  items: ChoiceItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Accessible name of the tab list. */
  label: string;
  /** Links each tab to a `TabPanel` with the same prefix (`aria-controls`). */
  idPrefix?: string;
  className?: string;
};

/** Pill tabs. `tablist` with arrow keys, Home and End; counts sit in `.k`. */
export function Tabs<T extends string>({ items, value, onChange, label, idPrefix, className }: TabsProps<T>) {
  const { refs, onKeyDown } = useRoving(items, value, onChange);
  const stop = tabStopIndex(items, value);
  return (
    <div role="tablist" aria-label={label} className={cx(styles.tabs, className)} onKeyDown={onKeyDown}>
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${item.id}` : undefined}
            aria-controls={idPrefix ? `${idPrefix}-panel-${item.id}` : undefined}
            aria-selected={selected}
            tabIndex={index === stop ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(item.id)}
          >
            {item.tone ? <StatusGlyph tone={item.tone} size={9} /> : null}
            {item.label}
            {item.count != null ? <Count n={item.count} className={styles.k} /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Panel for `Tabs` with an `idPrefix`. Render only the selected one, or all with `hidden`. */
export function TabPanel({
  idPrefix,
  id,
  hidden,
  children,
  className,
}: {
  idPrefix: string;
  id: string;
  hidden?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${id}`}
      aria-labelledby={`${idPrefix}-tab-${id}`}
      hidden={hidden}
      className={className}
    >
      {children}
    </div>
  );
}

export type SegmentedProps<T extends string> = {
  items: ChoiceItem<T>[];
  value: T;
  onChange?: (id: T) => void;
  /** Accessible name of the group. */
  label: string;
  /** `hero` is the dark track on the hero band (`.trk`). */
  variant?: "default" | "hero";
  size?: "sm" | "md";
  /** Shown for review but not connected: each option is `aria-disabled`, still focusable, and
   *  presses still call `onChange` so the screen can say why. */
  unavailable?: boolean;
  className?: string;
};

/**
 * Segmented control: `radiogroup` with roving tabindex, counts in `.k`. When items carry `href`
 * it renders a nav of links with `aria-current="page"` instead (route tabs on the hero band).
 */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  label,
  variant = "default",
  size = "sm",
  unavailable = false,
  className,
}: SegmentedProps<T>) {
  const { refs, onKeyDown } = useRoving(items, value, (id) => onChange?.(id));
  const stop = tabStopIndex(items, value);
  const groupClass = cx(
    variant === "hero" ? styles.trk : styles.seg,
    size === "md" && styles.md,
    unavailable && styles.unavailable,
    className,
  );
  const content = (item: ChoiceItem<T>) => (
    <>
      {item.tone ? <StatusGlyph tone={item.tone} size={9} /> : null}
      {item.label}
      {item.count != null ? <Count n={item.count} className={styles.k} /> : null}
    </>
  );

  if (items.some((item) => item.href)) {
    return (
      <nav aria-label={label} className={groupClass}>
        {items.map((item) => {
          const current = item.id === value;
          return (
            <Link
              key={item.id}
              href={item.href ?? "#"}
              aria-current={current ? "page" : undefined}
              className={cx(styles.segItem, current && styles.segOn)}
              onClick={() => onChange?.(item.id)}
            >
              {content(item)}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div role="radiogroup" aria-label={label} className={groupClass} onKeyDown={onKeyDown}>
      {items.map((item, index) => {
        const checked = item.id === value;
        return (
          <button
            key={item.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={unavailable || undefined}
            tabIndex={index === stop ? 0 : -1}
            className={cx(styles.segItem, checked && styles.segOn)}
            onClick={() => onChange?.(item.id)}
          >
            {content(item)}
          </button>
        );
      })}
    </div>
  );
}

/** The dark segmented control on the hero band (`.trk`). Same API as `Segmented`. */
export function HeroTrack<T extends string>(props: Omit<SegmentedProps<T>, "variant">) {
  return <Segmented {...props} variant="hero" />;
}

export type FilterChipProps = {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
  count?: number | string;
  tone?: WfTone;
  /** Shown for review but not connected: `aria-disabled`, still focusable, presses still call
   *  `onPressedChange` so the screen can say why. */
  unavailable?: boolean;
  className?: string;
};

/** Toggle chip for quick filters (`aria-pressed`). Pressed gets a 3:1 edge, never a colour fill. */
export function FilterChip({
  pressed,
  onPressedChange,
  children,
  count,
  tone,
  unavailable = false,
  className,
}: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-disabled={unavailable || undefined}
      className={cx(styles.chip, unavailable && styles.unavailableChip, className)}
      onClick={() => onPressedChange(!pressed)}
    >
      {tone ? <StatusGlyph tone={tone} size={9} /> : null}
      <span className={styles.chipLabel}>{children}</span>
      {count != null ? <Count n={count} className={styles.k} /> : null}
    </button>
  );
}

/** An applied filter with a remove button ("Tier 1 and 2 ×"). */
export function AppliedFilter({
  children,
  onRemove,
  removeLabel,
  className,
}: {
  children: ReactNode;
  onRemove: () => void;
  /** Defaults to "Remove filter <text>" when children is a string. */
  removeLabel?: string;
  className?: string;
}) {
  const name = removeLabel ?? (typeof children === "string" ? `Remove filter ${children}` : "Remove filter");
  return (
    <span className={cx(styles.applied, className)}>
      <span className={styles.chipLabel}>{children}</span>
      <button type="button" className={styles.chipRemove} aria-label={name} onClick={onRemove}>
        <Icon icon={X} size={14} />
      </button>
    </span>
  );
}

/** Wraps chips in a labelled group. */
export function ChipGroup({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cx(styles.chips, className)}>
      {children}
    </div>
  );
}
