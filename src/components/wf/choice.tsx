"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { DisabledReason } from "./button";
import { cx } from "./cx";
import { Icon } from "./icon";
import { PanelBoundary } from "./panel-boundary";
import { Count, WindowWord, type CountWindow } from "./primitives";
import { controlTone, StatusGlyph, type WfTone } from "./status-glyph";
import styles from "./choice.module.css";

export type ChoiceItem<T extends string = string> = {
  id: T;
  label: ReactNode;
  /** Count in `.k`, behind the label. */
  count?: number | string;
  /**
   * The count's time window ("any date"), drawn quiet after it (shared design parts item 2). Tabs
   * and pill tabs put it after a middle dot; `Segmented` puts it under the label. Show it only when
   * the window differs from what the page title already says, or one strip mixes windows.
   */
  window?: CountWindow;
  /** Glyph before the label. */
  tone?: WfTone;
  /** Segmented and HeroTrack only: render the item as a link (route tabs). */
  href?: string;
};

/**
 * The item that holds the tab stop: the selected one, or the first when nothing matches the value
 * (a stale filter, an empty selection). Without this fallback every item gets tabIndex -1 and the
 * whole group drops out of the keyboard order (v9 section 8: one item in every tab list holds it).
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
  /** Links each tab to a `TabPanel` with the same prefix (`aria-controls` on the chosen tab only). */
  idPrefix?: string;
  className?: string;
};

/** Tabs with an ink underline. `tablist` with arrow keys, Home and End; counts sit in `.k`. */
export function Tabs<T extends string>({ items, value, onChange, label, idPrefix, className }: TabsProps<T>) {
  const { refs, onKeyDown } = useRoving(items, value, onChange);
  const stop = tabStopIndex(items, value);
  return (
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tab stop: arrow keys bubble up from the focused tab, option or item
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
            // Panels render only when chosen, so only the chosen tab names one that exists.
            aria-controls={idPrefix && selected ? `${idPrefix}-panel-${item.id}` : undefined}
            aria-selected={selected}
            tabIndex={index === stop ? 0 : -1}
            className={styles.tab}
            onClick={() => onChange(item.id)}
          >
            {item.tone ? <StatusGlyph tone={controlTone(item.tone)} size={9} /> : null}
            {item.label}
            {item.count != null ? <Count n={item.count} className={styles.k} /> : null}
            {item.window ? <WindowWord word={item.window} /> : null}
          </button>
        );
      })}
    </div>
  );
}

export type PillTabsProps<T extends string> = TabsProps<T> & {
  /** `fill` stretches the items across the width (phone page tabs). */
  fill?: boolean;
  /**
   * Filter buttons drawn as pill tabs: a `toolbar` of buttons with `aria-pressed`, no `tablist`, for
   * a row that narrows a list rather than switching panels (none pressed when `value` matches none).
   */
  toggles?: boolean;
};

/**
 * Pill tabs (v10 `.pt`): page and panel tabs as a rounded track with the selected item raised.
 * Same `tablist` contract as `Tabs` (arrow keys, Home and End, one tab stop, `TabPanel` ids).
 * Choice pills never wrap: the track scrolls sideways instead. Use `Segmented` for a view toggle.
 */
export function PillTabs<T extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix,
  fill = false,
  toggles = false,
  className,
}: PillTabsProps<T>) {
  const { refs, onKeyDown } = useRoving(items, value, onChange);
  const stop = tabStopIndex(items, value);
  return (
    <div
      role={toggles ? "toolbar" : "tablist"}
      aria-label={label}
      className={cx(styles.pt, fill && styles.ptFill, className)}
      onKeyDown={onKeyDown}
      data-testid="wf-pill-tabs"
    >
      {items.map((item, index) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role={toggles ? undefined : "tab"}
            id={idPrefix && !toggles ? `${idPrefix}-tab-${item.id}` : undefined}
            // Panels render only when chosen, so only the chosen tab names one that exists.
            aria-controls={idPrefix && selected && !toggles ? `${idPrefix}-panel-${item.id}` : undefined}
            aria-selected={toggles ? undefined : selected}
            aria-pressed={toggles ? selected : undefined}
            tabIndex={index === stop ? 0 : -1}
            className={styles.ptItem}
            onClick={() => onChange(item.id)}
          >
            {item.tone ? <StatusGlyph tone={controlTone(item.tone)} size={9} /> : null}
            {item.label}
            {item.count != null ? <Count n={item.count} className={styles.k} /> : null}
            {item.window ? <WindowWord word={item.window} /> : null}
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
      {/* Tier 1 item 5: a failing tab shows an error line; the tabs and the page keep working. A tab
          kept mounted behind `hidden` tries again when it is shown again. */}
      <PanelBoundary resetKey={`${id}:${hidden ? "hidden" : "shown"}`}>{children}</PanelBoundary>
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
  /**
   * Why the choice cannot be changed now (K11, design audit 5 Nov 2026; DESIGN-SYSTEM §4 Actions):
   * every option is `aria-disabled` and keeps its tab stop, presses do nothing, and the reason shows
   * as text beside the control, linked by `aria-describedby`.
   */
  disabledReason?: string;
  className?: string;
  /**
   * `track` (the default): one switch, options side by side. `answers`: a form answer row (spec item
   * 15, C18, 13 Nov 2026). Each option is sized to its words and wraps, never cut mid-word; four or
   * more options become separate chips across the full width; on a phone three or more become a
   * one-per-line list of 40px rows with a radio mark. Two options stay a switch.
   */
  layout?: "track" | "answers";
};

/** Answer rows of this many options or more list one per line on a phone (spec item 15). */
const ANSWER_LIST_MIN = 3;
/** Answer rows of this many options or more become separate wrapping chips (spec item 15). */
const ANSWER_CHIPS_MIN = 4;

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
  disabledReason,
  className,
  layout = "track",
}: SegmentedProps<T>) {
  const reasonId = useId();
  const off = Boolean(disabledReason);
  const { refs, onKeyDown } = useRoving(items, value, (id) => {
    if (!off) onChange?.(id);
  });
  const stop = tabStopIndex(items, value);
  const groupClass = cx(
    variant === "hero" ? styles.trk : styles.seg,
    size === "md" && styles.md,
    (unavailable || off) && styles.unavailable,
    layout === "answers" && styles.answers,
    layout === "answers" && items.length >= ANSWER_CHIPS_MIN && styles.answerChips,
    layout === "answers" && items.length >= ANSWER_LIST_MIN && styles.answerList,
    className,
  );
  const main = (item: ChoiceItem<T>) => (
    <>
      {item.tone ? <StatusGlyph tone={controlTone(item.tone)} size={9} /> : null}
      {item.label}
      {item.count != null ? <Count n={item.count} className={styles.k} /> : null}
    </>
  );
  // A window word sits under the label and count, so equal segments keep their width.
  const content = (item: ChoiceItem<T>) =>
    item.window ? (
      <span className={styles.segStack}>
        <span className={styles.segMain}>{main(item)}</span>
        <WindowWord word={item.window} className={styles.segWin} />
      </span>
    ) : (
      main(item)
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

  const group = (
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus -- roving tab stop: arrow keys bubble up from the focused tab, option or item
    <div
      role="radiogroup"
      aria-label={label}
      aria-describedby={off ? reasonId : undefined}
      className={groupClass}
      onKeyDown={onKeyDown}
    >
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
            aria-disabled={unavailable || off || undefined}
            tabIndex={index === stop ? 0 : -1}
            className={cx(styles.segItem, checked && styles.segOn)}
            onClick={() => {
              if (!off) onChange?.(item.id);
            }}
          >
            {content(item)}
          </button>
        );
      })}
    </div>
  );
  if (!off) return group;
  return (
    <span className={styles.withReason}>
      {group}
      <DisabledReason id={reasonId}>{disabledReason}</DisabledReason>
    </span>
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
  /** Why the filter cannot be changed now (K11): `aria-disabled`, presses do nothing, and the reason
   *  shows as text beside the chip, linked by `aria-describedby`. */
  disabledReason?: string;
  className?: string;
};

/** Toggle chip for quick filters (`aria-pressed`). Pressed takes the accent tint and edge. */
export function FilterChip({
  pressed,
  onPressedChange,
  children,
  count,
  tone,
  unavailable = false,
  disabledReason,
  className,
}: FilterChipProps) {
  const reasonId = useId();
  const off = Boolean(disabledReason);
  const chip = (
    <button
      type="button"
      aria-pressed={pressed}
      aria-disabled={unavailable || off || undefined}
      aria-describedby={off ? reasonId : undefined}
      className={cx(styles.chip, (unavailable || off) && styles.unavailableChip, className)}
      // Simplification A1 (Josh, 19 Oct 2026): a filter with nothing to show recedes, so the eye
      // lands on the ones that matter. It stays pressable; only its colour changes.
      data-dim={!pressed && (count === 0 || count === "0") ? "true" : undefined}
      onClick={() => {
        if (!off) onPressedChange(!pressed);
      }}
    >
      {tone ? <StatusGlyph tone={controlTone(tone)} size={9} /> : null}
      <span className={styles.chipLabel} data-text={typeof children === "string" ? children : undefined}>
        {children}
      </span>
      {count != null ? <Count n={count} className={styles.k} /> : null}
    </button>
  );
  if (!off) return chip;
  return (
    <span className={styles.withReason}>
      {chip}
      <DisabledReason id={reasonId}>{disabledReason}</DisabledReason>
    </span>
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
