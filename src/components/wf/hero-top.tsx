"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { buttonClass } from "./button";
import { cx } from "./cx";
import { useHeroFootSlot } from "./hero-foot-slot";
import { StatusGlyph } from "./status-glyph";
import styles from "./hero-top.module.css";

/**
 * Page tops (Josh, 9 Nov 2026, "build now, single PR"): the parts every page puts inside its slate
 * hero, matched to Home's approved top. Figures, one act row, a status pill, quick chips and one slim
 * band (strip), laid out by `HeroTop`. Pass `HeroTop` as the `children` of `Hero`. Figures shown here
 * must come from the page's own derivations; nothing here counts or decides anything.
 */

// The parts below opt out of the React Compiler ("use no memo"): they are on every page's first load, and
// memoising them added about 1 KB to each phone download (script-budget.json) while changing nothing
// visible. Each renders only from its props, so plain re-rendering looks the same.

type Press = { href?: string; onClick?: () => void };

/**
 * A pressable the page draws itself, in place of the figure's label or the band cell's body: a
 * count breakdown (feature plan item 5) passes its own button here. The kit gives it the look.
 */
export type HeroRenderPress = (press: {
  className: string;
  children: ReactNode;
  testId?: string;
  /** The button's own id and `aria-labelledby`, so a figure's name is its value and label ("2 ready now"). */
  id?: string;
  labelledBy?: string;
}) => ReactNode;

export type HeroFigureItem = Press & {
  id: string;
  value: ReactNode;
  /** Small unit after the value ("%", "h"). */
  unit?: ReactNode;
  label: ReactNode;
  /** Red only when the figure names something to act on now. */
  tone?: "danger" | "warning" | "ok";
  testId?: string;
  /** Underline the label as a link even without `href` (it is underlined anyway with `href` or `onClick`). */
  underline?: boolean;
  /** Test id on the label's link or button. */
  linkTestId?: string;
  /** A toggle's state (`aria-pressed`) when the figure has `onClick`. */
  pressed?: boolean;
  /** The page's own button for the label (`HeroRenderPress`). Wins over `href` and `onClick`. */
  renderPress?: HeroRenderPress;
};

/** A row of figures on the slate: equal columns on a phone (a long label takes the room it needs). */
export function HeroFigures({
  items,
  label = "Figures",
  testId,
}: {
  items: HeroFigureItem[];
  label?: string;
  testId?: string;
}) {
  "use no memo";
  return (
    <div className={styles.figs} role="group" aria-label={label} data-testid={testId}>
      {items.map((item) => (
        <HeroFigure key={item.id} item={item} />
      ))}
    </div>
  );
}

function HeroFigure({ item }: { item: HeroFigureItem }) {
  "use no memo";
  const id = useId();
  const valueId = `${id}-value`;
  const labelId = `${id}-label`;
  const linked = Boolean(item.href || item.onClick);
  const labelClass = cx(styles.figLabel, (linked || item.underline) && styles.figLink);
  // Only the label is the link or button, but its name is the value and the label ("2 ready now"),
  // so a screen reader hears the figure, not only its word.
  const named = { id: labelId, "aria-labelledby": `${valueId} ${labelId}` };
  return (
    <div className={styles.fig} data-tone={item.tone} data-testid={item.testId} data-wf-hero-figure="">
      <b className={styles.figValue} id={valueId}>
        {item.value}
        {item.unit ? <small className={styles.figUnit}>{item.unit}</small> : null}
      </b>{" "}
      {item.renderPress ? (
        item.renderPress({
          className: cx(labelClass, styles.figLink, styles.figButton),
          children: item.label,
          id: named.id,
          labelledBy: named["aria-labelledby"],
        })
      ) : item.href ? (
        <Link href={item.href} className={labelClass} data-testid={item.linkTestId} data-wf-fig-label="" {...named}>
          {item.label}
        </Link>
      ) : item.onClick ? (
        <button
          type="button"
          className={cx(labelClass, styles.figButton)}
          onClick={item.onClick}
          aria-pressed={item.pressed}
          data-testid={item.linkTestId}
          data-wf-fig-label=""
          {...named}
        >
          {item.label}
        </button>
      ) : (
        <span className={labelClass}>{item.label}</span>
      )}
    </div>
  );
}

type HeroActAction = Press & {
  label: string;
  /** Shorter label on a phone ("Show" for "Show act now"). The full label stays on wider screens. */
  phoneLabel?: string;
  /** A toggle's state (`aria-pressed`). */
  pressed?: boolean;
  testId?: string;
};

export type HeroActProps = {
  /** `danger` = act now (red triangle), `warning` = amber dot, `calm` = no glyph. */
  tone: "danger" | "warning" | "calm";
  title: ReactNode;
  /** One quiet line under the title; it ends in an ellipsis rather than wrap. */
  sub?: ReactNode;
  action?: HeroActAction;
  testId?: string;
  /** Test id on the title line (Home keeps `hero-next-answer`). */
  titleTestId?: string;
  /** Free words for `data-kind` (Home names its step: act, decide, overdue, none). */
  kind?: string;
};

/** The one next step on the slate: a slim soft card, its single light button on the right. */
export function HeroAct({ tone, title, sub, action, testId, titleTestId, kind }: HeroActProps) {
  "use no memo";
  const label = action ? (
    action.phoneLabel ? (
      <>
        <span className={styles.wideOnly}>{action.label}</span>
        <span className={styles.phoneOnly}>{action.phoneLabel}</span>
      </>
    ) : (
      action.label
    )
  ) : null;
  const buttonClassName = cx(buttonClass({ variant: "light", size: "sm" }), styles.actButton);
  // With a short phone label both words are in the markup; the full label is the spoken name everywhere.
  // When the phone word is not part of it ("All" for "Show everyone"), the name starts with that word,
  // so the name holds what each width shows (WCAG 2.5.3, label in name).
  const name = action?.phoneLabel
    ? action.label.toLowerCase().includes(action.phoneLabel.toLowerCase())
      ? action.label
      : `${action.phoneLabel}, ${action.label}`
    : undefined;
  return (
    <div className={styles.act} data-tone={tone} data-testid={testId} data-kind={kind} data-wf-hero-next="">
      {tone === "calm" ? null : (
        <StatusGlyph tone={tone === "danger" ? "danger" : "warning"} size={tone === "danger" ? 14 : 8} />
      )}
      <div className={styles.actText}>
        <p className={styles.actTitle} data-testid={titleTestId}>
          {title}
        </p>
        {sub ? <p className={styles.actSub}>{sub}</p> : null}
      </div>
      {action?.href ? (
        <Link href={action.href} className={buttonClassName} aria-label={name} data-testid={action.testId}>
          {label}
        </Link>
      ) : action ? (
        <button
          type="button"
          className={buttonClassName}
          onClick={action.onClick}
          aria-pressed={action.pressed}
          aria-label={name}
          data-testid={action.testId}
        >
          {label}
        </button>
      ) : null}
    </div>
  );
}

export type HeroChipItem = Press & {
  id: string;
  label: string;
  /** A small icon element (say a lucide icon); it is hidden from screen readers. */
  icon?: ReactNode;
  count?: number;
  /** `warning` (amber, the default) for work waiting; `quiet` for a plain tally. */
  countTone?: "warning" | "quiet";
  /** Words read after the count ("to do" reads "Ward updates, 1 to do"). */
  countLabel?: string;
  /** A toggle chip's state (`aria-pressed`). */
  pressed?: boolean;
  /** A chip that opens a panel below (`aria-expanded`), in place of `pressed`. */
  expanded?: boolean;
  /**
   * The chip's full spoken name when the visible words are not enough ("Print list (may include
   * identifiers)", "Switch ward, now Ward 5"). It replaces the name read from the label and count.
   */
  ariaLabel?: string;
  testId?: string;
  /**
   * The page's own control in this place instead (a menu trigger, a stepper link), styled with
   * `heroChipClassName`. `label` and the rest are then unused.
   */
  node?: ReactNode;
};

/** The quick chip's look, for a page's own control in a `HeroQuickChips` row (`HeroChipItem.node`). */
export const heroChipClassName = styles.chip;

/**
 * Quick action chips on the slate (36px; one row that scrolls sideways on a phone). Named
 * `HeroQuickChips` because `HeroChips` is the older v10 count-chip group.
 */
export function HeroQuickChips({ label, items }: { label: string; items: HeroChipItem[] }) {
  "use no memo";
  return (
    <ul className={styles.chips} aria-label={label}>
      {items.map((item) => {
        const body = (
          <>
            {item.icon ? (
              <span className={styles.chipIcon} aria-hidden="true">
                {item.icon}
              </span>
            ) : null}
            <span>{item.label}</span>
            {item.count !== undefined ? (
              <b className={styles.chipCount} data-tone={item.countTone ?? "warning"}>
                {/* The leading space keeps the label and count apart in the chip's text (not drawn: a
                    flex item trims it), so a spoken name that repeats them matches it (WCAG 2.5.3). */}
                <span aria-hidden="true"> {item.count}</span>
                <span className="sr-only">
                  , {item.count}
                  {item.countLabel ? ` ${item.countLabel}` : ""}
                </span>
              </b>
            ) : null}
          </>
        );
        if (item.node) return <li key={item.id}>{item.node}</li>;
        return (
          <li key={item.id}>
            {item.href ? (
              <Link href={item.href} className={styles.chip} aria-label={item.ariaLabel} data-testid={item.testId}>
                {body}
              </Link>
            ) : (
              <button
                type="button"
                className={styles.chip}
                onClick={item.onClick}
                aria-pressed={item.expanded === undefined ? item.pressed : undefined}
                aria-expanded={item.expanded}
                aria-label={item.ariaLabel}
                data-testid={item.testId}
              >
                {body}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export type HeroBandCell = Press & {
  id: string;
  /** Short name ("ARM", "Locked adult"). */
  label: ReactNode;
  value: ReactNode;
  /** First small line under (stacked) or after the name and value (inline). */
  sub?: ReactNode;
  /** Colour of the value. */
  tone?: "danger" | "warning" | "ok";
  /** Colour of `sub`; `danger` also puts a small red triangle before it. */
  subTone?: "danger" | "warning" | "ok";
  /** A second small line (sans), say "15 on forms". */
  note?: ReactNode;
  noteTone?: "danger" | "warning" | "ok";
  /** Words instead of a number ("no wait"): drawn quiet. */
  quiet?: boolean;
  /** Spoken name for a pressable cell when the visible text is too terse. */
  ariaLabel?: string;
  pressed?: boolean;
  testId?: string;
  /** The page's own button for the cell (`HeroRenderPress`). Wins over `href` and `onClick`. */
  renderPress?: HeroRenderPress;
};

/** True while the list is wider than its box (watched only when `watch` is set). */
function useScrollsSideways(ref: { current: HTMLElement | null }, watch: boolean): boolean {
  "use no memo";
  const [scrolls, setScrolls] = useState(false);
  useEffect(() => {
    const list = ref.current;
    if (!watch || !list) {
      setScrolls(false);
      return;
    }
    let live = true;
    const measure = () => {
      if (live) setScrolls(list.scrollWidth > list.clientWidth + 1);
    };
    measure();
    // A phone band keeps its own width while its cells grow (late web fonts, a cell added after
    // hydration, longer values), so each cell is watched as well as the band.
    void document.fonts?.ready.then(measure);
    if (typeof ResizeObserver === "undefined") return () => void (live = false);
    const observer = new ResizeObserver(measure);
    const watchCells = () => {
      observer.disconnect();
      observer.observe(list);
      for (const cell of Array.from(list.children)) observer.observe(cell);
      measure();
    };
    watchCells();
    const cells = typeof MutationObserver === "undefined" ? null : new MutationObserver(watchCells);
    cells?.observe(list, { childList: true });
    return () => {
      live = false;
      observer.disconnect();
      cells?.disconnect();
    };
  }, [ref, watch]);
  return scrolls;
}

export type HeroBandProps = {
  /** The band's small caps label ("Waiting in ED"). */
  title: ReactNode;
  /** Words on the right of the label ("62 in ED · 8 in transit"); wrap numbers in <b>. */
  aside?: ReactNode;
  /** Makes `aside` a link with a chevron. */
  asideHref?: string;
  /** One more quiet line between the head and the cells (My ward's pack time on a phone, D-142). */
  note?: ReactNode;
  cells: HeroBandCell[];
  /**
   * `inline`: name and value on one line (Home's ED strip). `stacked`: name over value. `wrap`: as
   * `inline`, wrapping onto more rows on wider screens and one cell per line on a phone, for a list
   * of named times (the downtime pack's old packs, Batch 4, D-142).
   */
  variant?: "inline" | "stacked" | "wrap";
  /** Narrower gaps between cells on desktop, for a band with many cells (the bed board's eight). */
  compact?: boolean;
  testId?: string;
};

/** One slim strip of cells on the slate, hairlines between; it scrolls sideways with a fade on a phone. */
export function HeroBand({ title, aside, asideHref, note, cells, variant = "inline", compact, testId }: HeroBandProps) {
  "use no memo";
  const titleId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const pressable = cells.some((cell) => cell.href || cell.onClick || cell.renderPress);
  const scrolls = useScrollsSideways(listRef, !pressable);
  return (
    <div className={styles.band} data-testid={testId}>
      <div className={styles.bandHead}>
        <p className={styles.bandTitle} id={titleId}>
          {title}
        </p>
        {aside ? (
          asideHref ? (
            <Link href={asideHref} className={cx(styles.bandAside, styles.bandAsideLink)}>
              {aside}
              <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
            </Link>
          ) : (
            <p className={styles.bandAside}>{aside}</p>
          )
        ) : null}
      </div>
      {note ? <p className={styles.bandNote}>{note}</p> : null}
      <ul
        ref={listRef}
        className={styles.cells}
        aria-labelledby={titleId}
        data-variant={variant}
        data-compact={compact ? "" : undefined}
        // A phone scrolls the band sideways. With no link or button in it, the list itself takes
        // focus then, so a keyboard can scroll it too (WCAG 2.1.1).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={scrolls ? 0 : undefined}
      >
        {cells.map((cell) => {
          // The spaces before each part are not drawn (a flex item trims them), but they keep the words
          // apart in the cell's text, so a spoken name that repeats them matches it (WCAG 2.5.3).
          const body = (
            <>
              <span className={styles.cellTop}>
                <span className={styles.cellLabel}>{cell.label}</span>{" "}
                <span className={styles.cellValue} data-tone={cell.tone}>
                  {cell.value}
                </span>
              </span>
              {cell.sub ? (
                <span className={styles.cellSub} data-tone={cell.subTone}>
                  {" "}
                  {cell.subTone === "danger" ? <StatusGlyph tone="danger" size={9} /> : null}
                  {cell.sub}
                </span>
              ) : null}
              {cell.note ? (
                <span className={styles.cellNote} data-tone={cell.noteTone}>
                  {" "}
                  {cell.note}
                </span>
              ) : null}
            </>
          );
          return (
            <li key={cell.id} className={styles.cell} data-quiet={cell.quiet ? "" : undefined}>
              {cell.renderPress ? (
                cell.renderPress({ className: styles.cellBody, children: body, testId: cell.testId })
              ) : cell.href ? (
                <Link
                  href={cell.href}
                  className={styles.cellBody}
                  aria-label={cell.ariaLabel}
                  data-testid={cell.testId}
                >
                  {body}
                </Link>
              ) : cell.onClick ? (
                <button
                  type="button"
                  className={styles.cellBody}
                  onClick={cell.onClick}
                  aria-pressed={cell.pressed}
                  aria-label={cell.ariaLabel}
                  data-testid={cell.testId}
                >
                  {body}
                </button>
              ) : (
                <span className={styles.cellBody} data-testid={cell.testId}>
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type HeroPillProps = {
  /** `warning` shows a small amber dot before the words. */
  tone?: "warning";
  text: ReactNode;
  /** `ariaLabel` names the action in full when the short label needs the pill's words ("Ask Ward 2K ..."). */
  action?: Press & { label: string; ariaLabel?: string; testId?: string };
  testId?: string;
};

/** A short status line in a pill ("21 of 22 confirmed · 1 not yet · Ask"). */
export function HeroPill({ tone, text, action, testId }: HeroPillProps) {
  "use no memo";
  return (
    <p className={styles.pill} data-tone={tone} data-testid={testId}>
      {tone ? <span className={styles.pillDot} aria-hidden="true" /> : null}
      <span className={styles.pillText}>{text}</span>
      {action?.href ? (
        <Link
          href={action.href}
          className={styles.pillAction}
          aria-label={action.ariaLabel}
          data-testid={action.testId}
        >
          {action.label}
        </Link>
      ) : action ? (
        <button
          type="button"
          className={styles.pillAction}
          onClick={action.onClick}
          aria-label={action.ariaLabel}
          data-testid={action.testId}
        >
          {action.label}
        </button>
      ) : null}
    </p>
  );
}

export type HeroTopProps = {
  figures?: ReactNode;
  act?: ReactNode;
  pill?: ReactNode;
  chips?: ReactNode;
  /**
   * `false` leaves the shell's Quick bar (the desk home's hero foot slot) out when the page passes
   * no `chips` of its own, or passes them only on some screen sizes. Default `true`.
   */
  quickBar?: boolean;
  band?: ReactNode;
  /** Anything page-specific (search field, date stepper), full width at the foot. */
  children?: ReactNode;
  className?: string;
  testId?: string;
};

/**
 * Lays the parts out as Home does. Phone: figures, act, pill, chips, band, children, stacked.
 * Tablet and desktop (46.5rem up): the act row sits right of the figures; with no act (and no pill)
 * the chips take that place instead.
 *
 * The desk home's Quick bar (the shell's hero foot slot) is drawn here as the chip row, so a page
 * never shows two chip rows: a page's own `chips` win and the Quick bar steps aside. `Hero` leaves
 * its own foot slot out when a `HeroTop` is among its children. `quickBar={false}` leaves it out
 * entirely, for a page whose own actions replace it.
 */
export function HeroTop({
  figures,
  act,
  pill,
  chips: ownChips,
  quickBar = true,
  band,
  children,
  className,
  testId,
}: HeroTopProps) {
  "use no memo";
  // The Quick bar draws nothing off the desk's home, so it never takes the place beside the figures.
  const footSlot = useHeroFootSlot();
  const chipsBeside = !act && !pill && Boolean(figures) && Boolean(ownChips);
  const chips = ownChips ?? (quickBar ? footSlot : null);
  const beside = act ?? (chipsBeside ? chips : null);
  return (
    <div className={cx(styles.top, className)} data-testid={testId} data-wf-hero-top="">
      {figures || beside ? (
        <div className={styles.answer} data-solo={figures && beside ? undefined : ""}>
          {figures}
          {beside}
        </div>
      ) : null}
      {pill}
      {chipsBeside ? null : chips}
      {band}
      {children}
    </div>
  );
}

/** Read by `Hero`: this part draws the hero's foot slot (the Quick bar) itself. */
HeroTop.wfTakesFootSlot = true;
