"use client";

/**
 * THE KIT'S LONG-LIST PICKER. Replaces a browser `<select>` for long lists (30 or more EDs and sites,
 * diagnoses, providers), where a native list is hard to scan and cannot be searched.
 *
 * - A labelled kit field button (the `Field` look from `form.tsx`) showing the chosen label or the
 *   placeholder. Nothing is pre-selected.
 * - Opens a glass popover on desktop and tablet, and the kit `Sheet` on a phone.
 * - A search box (the kit `SearchField`) once there are more than 8 options; it filters by label and
 *   hint, ignoring case, every typed word must match.
 * - Options with a `group` sit under group headings, in the order the groups first appear.
 * - Combobox and listbox pattern: arrows, Home and End move, Enter chooses, Escape closes and puts
 *   focus back on the field button, Tab leaves. The chosen option shows a check.
 * - A hidden input named `name` carries the value for forms.
 * - When not `required`, a "Clear" row at the foot removes a chosen value.
 *
 * Example:
 *
 *     const [site, setSite] = useState<string | null>(null);
 *     <ListPicker label="Emergency department" value={site} onChange={setSite} options={sites} name="site" />
 */
import { Check, ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { DisabledReason } from "./button";
import { cx } from "./cx";
import { Icon } from "./icon";
import { useOutsidePress, usePanelFit } from "./menu";
import { SearchField } from "./search-field";
import { Sheet } from "./sheet";
import { useIsPhone } from "./use-is-phone";

import formStyles from "./form.module.css";
import overlayStyles from "./overlay.module.css";
import styles from "./list-picker.module.css";

export type ListPickerOption = { value: string; label: string; group?: string; hint?: string };

export type ListPickerProps = {
  label: ReactNode;
  value: string | null;
  onChange: (value: string | null) => void;
  options: ListPickerOption[];
  /** Shown on the field while nothing is chosen. Defaults to "Choose". */
  placeholder?: string;
  /** Marks the field required (`aria-required`) and leaves out the Clear row. */
  required?: boolean;
  disabled?: boolean;
  /**
   * Why the choice cannot be changed now (K11, design audit 5 Nov 2026; DESIGN-SYSTEM §4 Actions):
   * the field button is `aria-disabled` and keeps its tab stop, it does not open, and the reason
   * shows as text under the field, linked by `aria-describedby`.
   */
  disabledReason?: string;
  /** The field button's id. Generated when omitted. */
  id?: string;
  /** Name of the hidden input that carries the value in a form. */
  name?: string;
  /** `data-testid` on the field button. */
  testId?: string;
  /** Marks the field unanswered or wrong: `aria-invalid` and the kit's red edge. */
  invalid?: boolean;
};

/** The search box appears above this many options. */
const SEARCH_ABOVE = 8;

type Row = { kind: "option"; option: ListPickerOption } | { kind: "clear" };
type Section = { group: string | undefined; rows: Array<{ option: ListPickerOption; index: number }> };

function matches(query: string, option: ListPickerOption): boolean {
  const words = query.trim().toLowerCase().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return true;
  const text = `${option.label} ${option.hint ?? ""}`.toLowerCase();
  return words.every((word) => text.includes(word));
}

/**
 * Orders options by group, keeping their order inside each group. Groups keep the order they first
 * appear in `all`, so headings do not shuffle while the search narrows the list.
 */
function sectionsOf(options: ListPickerOption[], all: ListPickerOption[] = options): Section[] {
  const sections: Section[] = [];
  const byGroup = new Map<string | undefined, Section>();
  for (const option of all) {
    if (!byGroup.has(option.group)) {
      const section: Section = { group: option.group, rows: [] };
      byGroup.set(option.group, section);
      sections.push(section);
    }
  }
  for (const option of options) {
    let section = byGroup.get(option.group);
    if (!section) {
      section = { group: option.group, rows: [] };
      byGroup.set(option.group, section);
      sections.push(section);
    }
    section.rows.push({ option, index: -1 });
  }
  const shown = sections.filter((section) => section.rows.length > 0);
  let index = 0;
  for (const section of shown) for (const row of section.rows) row.index = index++;
  return shown;
}

export function ListPicker({
  label,
  value,
  onChange,
  options,
  placeholder = "Choose",
  required = false,
  disabled = false,
  disabledReason,
  id: idProp,
  name,
  testId,
  invalid = false,
}: ListPickerProps): JSX.Element {
  const generated = useId();
  const id = idProp ?? `wf-list-picker-${generated.replace(/:/gu, "")}`;
  const labelId = `${id}-label`;
  const listId = `${id}-list`;
  const reasonId = `${id}-reason`;
  const off = disabled || Boolean(disabledReason);
  const isPhone = useIsPhone();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const anchorRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const chosen = value === null ? null : (options.find((option) => option.value === value) ?? null);
  const searchable = options.length > SEARCH_ABOVE;
  const canClear = !required && chosen !== null;
  const labelText = typeof label === "string" ? label : undefined;

  const sections = useMemo(
    () =>
      sectionsOf(
        options.filter((option) => matches(query, option)),
        options,
      ),
    [options, query],
  );
  const rows = useMemo<Row[]>(() => {
    const list: Row[] = sections.flatMap((section) =>
      section.rows.map(({ option }) => ({ kind: "option" as const, option })),
    );
    if (canClear) list.push({ kind: "clear" });
    return list;
  }, [sections, canClear]);
  const optionCount = rows.length - (canClear ? 1 : 0);

  const rowId = (index: number) => `${id}-row-${index}`;
  const activeIndex = rows.length === 0 ? -1 : Math.min(active, rows.length - 1);
  const activeId = open && activeIndex >= 0 ? rowId(activeIndex) : undefined;

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setQuery("");
    if (returnFocus) buttonRef.current?.focus({ preventScroll: true });
  }, []);
  const closeFromOutside = useCallback(() => close(false), [close]);

  const openList = useCallback(
    (seed = "") => {
      if (off) return;
      const chosenAt = chosen ? sectionsOf(options).flatMap((section) => section.rows) : [];
      const at = chosenAt.find((row) => row.option.value === chosen?.value)?.index ?? 0;
      setQuery(seed);
      setActive(seed ? 0 : at);
      setOpen(true);
    },
    [chosen, off, options],
  );

  useOutsidePress(open && !isPhone, anchorRef, closeFromOutside);
  usePanelFit(open && !isPhone, anchorRef, panelRef);

  // Desktop: the search box takes focus on open. Without one, focus stays on the field button.
  useEffect(() => {
    if (open && !isPhone && searchable) searchRef.current?.focus({ preventScroll: true });
  }, [open, isPhone, searchable]);

  // Keep the active row in view inside the list, never scrolling the page behind it.
  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [activeId]);

  const choose = (row: Row | undefined) => {
    if (!row) return;
    onChange(row.kind === "clear" ? null : row.option.value);
    close(true);
  };

  /** Arrows, Home, End, Enter and Escape for whichever element holds focus while open. */
  const onListKeys = (event: KeyboardEvent<HTMLElement>) => {
    const last = rows.length - 1;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(Math.min(last, activeIndex + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(0, activeIndex - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(Math.max(0, last));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(rows[activeIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab" && !isPhone) {
      // From the search box, park focus on the field button before the box unmounts, so the
      // browser's (or a modal's) Tab step carries on from the field rather than dropping to the
      // page. The closing panel goes inert so a modal's Tab cycle does not step back into it.
      if (event.currentTarget !== buttonRef.current) panelRef.current?.setAttribute("inert", "");
      close(event.currentTarget !== buttonRef.current);
    } else {
      return false;
    }
    return true;
  };

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        openList();
      } else if (searchable && event.key.length === 1 && /\S/u.test(event.key) && !event.ctrlKey && !event.metaKey) {
        // Typing on the closed field starts a search with that letter.
        event.preventDefault();
        openList(event.key);
      }
      return;
    }
    if (onListKeys(event)) return;
    if (!searchable && event.key.length === 1 && /\S/u.test(event.key)) {
      // A short list without a search box: a letter jumps to the next option that starts with it.
      const char = event.key.toLowerCase();
      for (let step = 1; step <= optionCount; step += 1) {
        const position = (activeIndex + step) % optionCount;
        const row = rows[position];
        if (row?.kind === "option" && row.option.label.toLowerCase().startsWith(char)) {
          setActive(position);
          break;
        }
      }
    }
  };

  const listbox = (
    <div
      ref={listRef}
      id={listId}
      role="listbox"
      aria-labelledby={labelId}
      // On a phone without a search box the list itself holds focus inside the sheet.
      tabIndex={isPhone && !searchable ? 0 : -1}
      aria-activedescendant={isPhone && !searchable ? activeId : undefined}
      onKeyDown={isPhone && !searchable ? (event) => void onListKeys(event) : undefined}
      className={cx(styles.list, isPhone && styles.phoneList)}
    >
      {sections.map((section) => {
        const optionsMarkup = section.rows.map(({ option, index }) => {
          const selected = option.value === value;
          return (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus -- not focusable by design: keys reach the option through aria-activedescendant on the focused field
            <div
              key={option.value}
              id={rowId(index)}
              role="option"
              aria-selected={selected}
              data-value={option.value}
              className={cx(styles.option, index === activeIndex && styles.active)}
              onPointerDown={(event) => event.preventDefault()}
              onMouseMove={() => setActive(index)}
              onClick={() => choose({ kind: "option", option })}
            >
              <span className={styles.check} aria-hidden="true">
                {selected ? <Icon icon={Check} size={14} /> : null}
              </span>
              <span className={styles.optionLabel}>{option.label}</span>
              {option.hint ? <span className={styles.optionHint}>{option.hint}</span> : null}
            </div>
          );
        });
        if (section.group === undefined) return optionsMarkup;
        const headingId = `${id}-group-${section.rows[0].index}`;
        return (
          <div key={`group-${section.group}`} role="group" aria-labelledby={headingId}>
            <div id={headingId} role="presentation" className={overlayStyles.heading}>
              {section.group}
            </div>
            {optionsMarkup}
          </div>
        );
      })}
      {canClear ? (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus -- not focusable by design: keys reach the row through aria-activedescendant on the focused field
        <div
          id={rowId(rows.length - 1)}
          role="option"
          aria-selected={false}
          className={cx(styles.option, styles.clearRow, activeIndex === rows.length - 1 && styles.active)}
          onPointerDown={(event) => event.preventDefault()}
          onMouseMove={() => setActive(rows.length - 1)}
          onClick={() => choose({ kind: "clear" })}
        >
          <span className={styles.check} aria-hidden="true" />
          <span className={styles.optionLabel}>Clear</span>
        </div>
      ) : null}
    </div>
  );

  const search = searchable ? (
    <SearchField
      inputRef={searchRef}
      label={labelText ? `Search ${labelText}` : "Search the list"}
      placeholder="Type to filter"
      value={query}
      onValueChange={(next) => {
        setQuery(next);
        setActive(0);
      }}
      role="combobox"
      aria-expanded={open}
      aria-controls={listId}
      aria-autocomplete="list"
      aria-activedescendant={activeId}
      onKeyDown={(event) => void onListKeys(event)}
      className={styles.search}
    />
  ) : null;

  const empty =
    optionCount === 0 ? (
      <p className={styles.empty} role="status">
        No matches
      </p>
    ) : null;

  return (
    <div ref={anchorRef} className={cx(formStyles.field, styles.root)}>
      <div className={formStyles.labelRow}>
        <span id={labelId} className={formStyles.label}>
          {label}
        </span>
      </div>
      <div className={cx(formStyles.in, invalid && formStyles.invalid, off && styles.disabled)}>
        <button
          ref={buttonRef}
          id={id}
          type="button"
          role="combobox"
          aria-labelledby={labelId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-required={required || undefined}
          aria-activedescendant={!isPhone && !searchable ? activeId : undefined}
          {...(disabledReason ? { "aria-disabled": true, "aria-describedby": reasonId } : { disabled })}
          aria-invalid={invalid || undefined}
          data-testid={testId}
          className={cx(formStyles.control, formStyles.select, styles.trigger, !chosen && styles.placeholder)}
          onClick={() => (open ? close(false) : openList())}
          onKeyDown={onButtonKeyDown}
        >
          <span className={styles.triggerText}>{chosen ? chosen.label : placeholder}</span>
        </button>
        <Icon icon={ChevronDown} size={16} className={formStyles.selectCaret} />
      </div>
      {disabledReason ? <DisabledReason id={reasonId}>{disabledReason}</DisabledReason> : null}
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
      {open && !isPhone ? (
        <div ref={panelRef} className={cx(overlayStyles.glass, styles.panel)}>
          {search}
          {listbox}
          {empty}
        </div>
      ) : null}
      {isPhone ? (
        <Sheet
          open={open}
          onClose={() => close(false)}
          {...(labelText ? { title: labelText } : { labelledBy: labelId })}
          mobileBreakpoint="phone"
          initialFocusRef={searchable ? searchRef : listRef}
          returnFocusRef={buttonRef}
          headerBottom={labelText && search ? <div className={styles.sheetSearch}>{search}</div> : undefined}
        >
          {!labelText ? search : null}
          {open ? listbox : null}
          {empty}
        </Sheet>
      ) : null}
    </div>
  );
}
