"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ComponentPropsWithoutRef,
  type ElementType,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import Link from "next/link";
import { X, type LucideIcon } from "lucide-react";
import { OverlayPortal } from "@/components/ui/overlay-root";
import {
  canRestoreFocusTo,
  isTopmostSheet,
  popSheet,
  pushSheet,
  startSheetOpenFocus,
  updateSheetRoot,
  type SheetFocusController,
} from "@/components/ui/sheet-focus";
import { Button } from "./button";
import { cx, present } from "./cx";
import type { DialogAction } from "./dialog";
import { Icon } from "./icon";
import { CountBubble } from "./primitives";
import { StatusGlyph, type WfTone } from "./status-glyph";
import styles from "./phone.module.css";

/*
 * v9 phone parts (design system v9 section 7, "Phone"). Phone is its own design at 390 by 844,
 * never a reflow of desktop: a priority list of rows with their one action, bottom sheets, a solid
 * sticky bottom bar, and chip rows that scroll with an edge fade. These parts carry no desktop
 * styling of their own and change nothing on desktop; a screen chooses to render them.
 */

/* ---------- PhoneSheet ---------- */

export type PhoneSheetProps = {
  open: boolean;
  /** Escape, the close button, a press on the scrim and a long drag down on the handle call this. */
  onClose: () => void;
  /** Names the sheet (`aria-labelledby`). Five words at most. */
  title: string;
  /** One line under the title, read as the sheet's description. */
  description?: ReactNode;
  /** The scrolling body. It never runs under the footer. */
  children?: ReactNode;
  /** The sheet's one primary action, pinned in the footer. `danger` is for a step that cannot be undone. */
  primary?: DialogAction & { tone?: "default" | "danger" };
  /** One quiet action beside the primary (Cancel, Not now). */
  secondary?: DialogAction;
  /** Accessible name of the close button. */
  closeLabel?: string;
  /** A press that starts on the scrim closes the sheet. On by default. */
  closeOnScrim?: boolean;
  /** Where focus starts. Defaults to a `data-sheet-autofocus` child, then the close button. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Where focus returns on close. Defaults to whatever had focus when the sheet opened. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** `content` sizes to its body (up to the top safe area). `tall` opens near full height. */
  height?: "content" | "tall";
  className?: string;
  "data-testid"?: string;
};

const FOCUSABLE =
  'a[href], button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function focusableIn(panel: HTMLElement | null) {
  return Array.from(panel?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.tabIndex >= 0 &&
      !element.closest('[aria-hidden="true"], [inert]') &&
      element.getClientRects().length > 0,
  );
}

/** A drag down the handle past this many pixels closes the sheet; a shorter drag snaps back. */
const DRAG_CLOSE_PX = 96;

/**
 * Phone bottom sheet: a grab handle, the title with a close button, a scrolling body and a footer
 * that holds the sheet's one primary action. The footer is in the panel's flow, not laid over the
 * body, so content never sits under it. It joins the shared sheet stack (`sheet-focus`), so the
 * page behind is inert, Tab stays inside, Escape closes only the top layer, and focus returns to
 * whatever opened it. It rises from the bottom edge and fades under reduced motion.
 */
export function PhoneSheet({
  open,
  onClose,
  title,
  description,
  children,
  primary,
  secondary,
  closeLabel = "Close",
  closeOnScrim = true,
  initialFocusRef,
  returnFocusRef,
  height = "content",
  className,
  ...data
}: PhoneSheetProps) {
  const sheetId = useId();
  const titleId = useId();
  const descId = useId();
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const openFocusRef = useRef<SheetFocusController | null>(null);
  // The scrim closes the sheet only when the press starts on it, so a drag that begins inside the
  // panel and ends on the scrim does not dismiss.
  const scrimPressRef = useRef(false);
  const dragRef = useRef<{ startY: number; dragging: boolean }>({ startY: 0, dragging: false });

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Read at close time, so a caller can retarget the return while the sheet is open.
  const resolveReturnTarget = useCallback(() => returnFocusRef?.current ?? null, [returnFocusRef]);

  const setScrimRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrimRef.current = node;
      updateSheetRoot(sheetId, node);
    },
    [sheetId],
  );

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    pushSheet(sheetId, scrimRef.current);
    openFocusRef.current = startSheetOpenFocus({
      sheetId,
      getPanel: () => panelRef.current,
      resolveTarget: () =>
        initialFocusRef?.current ??
        panelRef.current?.querySelector<HTMLElement>('[data-sheet-autofocus="true"]') ??
        closeRef.current ??
        panelRef.current,
    });

    function onKeyDown(event: KeyboardEvent) {
      // Only the top layer reacts, so a sheet under a dialog stays open on one Escape.
      if (!isTopmostSheet(sheetId)) return;
      if (event.key === "Escape") {
        if (event.defaultPrevented) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = focusableIn(panelRef.current);
      event.preventDefault();
      if (focusable.length === 0) {
        panelRef.current?.focus();
        return;
      }
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const index = active ? focusable.indexOf(active) : -1;
      const next =
        index === -1
          ? event.shiftKey
            ? focusable.length - 1
            : 0
          : (index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
      focusable[next].focus();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      openFocusRef.current?.cancel();
      openFocusRef.current = null;
      popSheet(sheetId);
      const target = [resolveReturnTarget(), opener].find((element): element is HTMLElement =>
        Boolean(element?.isConnected),
      );
      // The panel is gone, so focus has fallen to the page. Hand it back to the opener unless
      // another layer has taken over.
      const active = document.activeElement;
      const focusFell = active == null || active === document.body || !active.isConnected;
      if (target && focusFell && canRestoreFocusTo(target)) target.focus({ preventScroll: true });
    };
  }, [open, sheetId, initialFocusRef, resolveReturnTarget]);

  // Drag to dismiss from the handle only, so it never competes with scrolling the body.
  function onHandleDown(event: ReactPointerEvent<HTMLDivElement>) {
    const panel = panelRef.current;
    if (!panel) return;
    dragRef.current = { startY: event.clientY, dragging: true };
    panel.style.transition = "none";
    // The entry animation would otherwise override the inline drag transform while it runs.
    panel.style.animation = "none";
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onHandleMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current.dragging) return;
    const delta = Math.max(0, event.clientY - dragRef.current.startY);
    if (panelRef.current) panelRef.current.style.transform = `translateY(${delta}px)`;
  }

  function endDrag() {
    dragRef.current = { startY: 0, dragging: false };
    const panel = panelRef.current;
    if (panel) {
      panel.style.transition = "";
      panel.style.transform = "";
    }
  }

  function onHandleUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current.dragging) return;
    const delta = Math.max(0, event.clientY - dragRef.current.startY);
    endDrag();
    if (delta > DRAG_CLOSE_PX) onCloseRef.current();
  }

  // An interrupted gesture puts the sheet back and never closes it.
  function onHandleCancel() {
    if (dragRef.current.dragging) endDrag();
  }

  if (!open) return null;

  const hasFooter = Boolean(primary || secondary);

  return (
    <OverlayPortal layer="modal" name={title}>
      <div
        ref={setScrimRef}
        className={styles.sheetScrim}
        onPointerDown={(event) => {
          scrimPressRef.current = event.target === event.currentTarget;
        }}
        onClick={(event) => {
          const startedOnScrim = scrimPressRef.current;
          scrimPressRef.current = false;
          if (closeOnScrim && startedOnScrim && event.target === event.currentTarget) onCloseRef.current();
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={present(description) ? descId : undefined}
          tabIndex={-1}
          data-height={height}
          className={cx(styles.sheet, !hasFooter && styles.sheetNoFooter, className)}
          {...data}
        >
          <div
            className={styles.handle}
            aria-hidden="true"
            data-phone-sheet-handle=""
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleCancel}
          >
            <span className={styles.grip} />
          </div>
          <div className={styles.sheetHeader}>
            <div className={styles.sheetTitleBlock}>
              <h2 id={titleId} className={styles.sheetTitle}>
                {title}
              </h2>
              {present(description) ? (
                <p id={descId} className={styles.sheetDescription}>
                  {description}
                </p>
              ) : null}
            </div>
            <Button
              ref={closeRef}
              variant="ghost"
              size="sm"
              iconOnly
              icon={X}
              aria-label={closeLabel}
              className={styles.sheetClose}
              onClick={() => onCloseRef.current()}
            />
          </div>
          <div className={styles.sheetBody} data-phone-sheet-body="">
            {children}
          </div>
          {hasFooter ? (
            <div className={styles.sheetFooter} data-phone-sheet-footer="">
              {secondary ? (
                <Button
                  variant="ghost"
                  size="lg"
                  loading={secondary.loading}
                  disabledReason={secondary.disabledReason}
                  reasonDisplay="tooltip"
                  onClick={secondary.onAction}
                >
                  {secondary.label}
                </Button>
              ) : null}
              {primary ? (
                <Button
                  variant={primary.tone === "danger" ? "danger" : "pri"}
                  size="lg"
                  loading={primary.loading}
                  disabledReason={primary.disabledReason}
                  reasonDisplay="tooltip"
                  className={styles.sheetPrimary}
                  onClick={primary.onAction}
                >
                  {primary.label}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </OverlayPortal>
  );
}

/* ---------- PhoneTabBar ---------- */

export type PhoneTab = {
  id: string;
  /** One or two words. */
  label: string;
  href: string;
  icon: LucideIcon;
  /** A count on the icon. Leave it out to show none. */
  count?: number;
  /** Words for the count, read after the label ("3 open"). Defaults to the number. */
  countLabel?: string;
};

export type PhoneTabBarProps = {
  /** Up to five destinations. Any after the fifth are not drawn. */
  items: PhoneTab[];
  /** The id of the page being shown. That link carries `aria-current="page"`. */
  current?: string;
  /** Accessible name of the navigation. */
  label?: string;
  className?: string;
  "data-testid"?: string;
};

/** The most destinations a phone bottom bar holds. */
export const PHONE_TAB_LIMIT = 5;

/**
 * Phone bottom bar: a solid, sticky row of up to five destinations, each a real link with an icon,
 * a label and an optional count. Every link is at least 44px tall, and the bar pads itself clear of
 * the home indicator. Phone bars are solid, never glass (v9 section 3).
 */
export function PhoneTabBar({ items, current, label = "Main", className, ...data }: PhoneTabBarProps) {
  const shown = items.slice(0, PHONE_TAB_LIMIT);
  return (
    <nav aria-label={label} className={cx(styles.tabBar, className)} {...data}>
      <ul className={styles.tabList}>
        {shown.map((item) => {
          const selected = item.id === current;
          return (
            <li key={item.id} className={styles.tabItem}>
              <Link
                href={item.href}
                aria-current={selected ? "page" : undefined}
                className={cx(styles.tabLink, selected && styles.tabCurrent)}
              >
                <span className={styles.tabIcon}>
                  <Icon icon={item.icon} size={20} />
                </span>
                <span className={styles.tabLabel}>{item.label}</span>
                {item.count != null ? " " : null}
                {item.count != null ? (
                  <CountBubble
                    n={item.count}
                    label={item.countLabel ?? String(item.count)}
                    className={styles.tabCount}
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ---------- PhoneListRow ---------- */

export type PhoneRowAction = {
  /** Visible words, six at most. Or an icon with `label` as its name. */
  label: string;
  onAction: () => void;
  icon?: LucideIcon;
  /** Show only the icon, named by `label`. */
  iconOnly?: boolean;
  /** Why the action is unavailable. Keeps the tab stop and shows the reason in a tip. */
  disabledReason?: string;
  loading?: boolean;
};

export type PhoneListRowProps = {
  /** The person, bed or item. 14px, one line. */
  name: ReactNode;
  /** One 12px line under the name: where, who or why. */
  meta?: ReactNode;
  /** A glyph or a tier before the name. */
  leading?: ReactNode;
  /** A figure at the end of the row, mono. */
  value?: ReactNode;
  /** A clock time or age under the value, mono 12px. */
  time?: ReactNode;
  /** Makes the whole row a link. */
  href?: string;
  /** Makes the whole row a button. Ignored when `href` is set. */
  onSelect?: () => void;
  /** Replaces the row target's accessible name, which is otherwise all of its text. */
  "aria-label"?: string;
  /** The row's one action, beside the row target, never inside it. At least 36px. */
  action?: PhoneRowAction;
  /** Act now: a thin red edge all round, never a fill. */
  actNow?: boolean;
  /** `li` when the row sits in a `ul`. */
  as?: "div" | "li";
  className?: string;
  "data-testid"?: string;
};

/**
 * Phone list row. The whole row is one tap target (a link or a button). Its one action is a sibling
 * of that target, never nested inside it, so the HTML stays valid and the two never swallow each
 * other's taps. An act now row takes a thin red edge with no fill, as in the table.
 */
export function PhoneListRow({
  name,
  meta,
  leading,
  value,
  time,
  href,
  onSelect,
  "aria-label": ariaLabel,
  action,
  actNow = false,
  as: Wrapper = "div",
  className,
  ...data
}: PhoneListRowProps) {
  // The spaces between parts keep the accessible name readable ("Bed 4 Ready since 09:10"). They
  // sit between flex items, so they take no room on screen.
  const content = (
    <>
      {present(leading) ? <span className={styles.rowLeading}>{leading}</span> : null}
      <span className={styles.rowText}>
        <span className={styles.rowName}>{name}</span>
        {present(meta) ? (
          <>
            {" "}
            <span className={styles.rowMeta}>{meta}</span>
          </>
        ) : null}
      </span>
      {present(value) || present(time) ? (
        <>
          {" "}
          <span className={styles.rowTrail}>
            {present(value) ? <span className={styles.rowValue}>{value}</span> : null}
            {present(value) && present(time) ? " " : null}
            {present(time) ? <span className={styles.rowTime}>{time}</span> : null}
          </span>
        </>
      ) : null}
    </>
  );

  const target = href ? (
    <Link href={href} aria-label={ariaLabel} className={cx(styles.rowTarget, styles.rowInteractive)}>
      {content}
    </Link>
  ) : onSelect ? (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cx(styles.rowTarget, styles.rowInteractive)}
      onClick={onSelect}
    >
      {content}
    </button>
  ) : (
    <div className={styles.rowTarget}>{content}</div>
  );

  return (
    <Wrapper
      className={cx(styles.row, actNow && styles.rowActNow, className)}
      data-act-now={actNow ? "true" : undefined}
      {...data}
    >
      {target}
      {action ? (
        <span className={styles.rowActionSlot}>
          {action.iconOnly && action.icon ? (
            <Button
              variant="sec"
              size="sm"
              iconOnly
              icon={action.icon}
              aria-label={action.label}
              loading={action.loading}
              disabledReason={action.disabledReason}
              reasonDisplay="tooltip"
              className={cx(styles.rowAction, styles.rowActionIcon)}
              onClick={action.onAction}
            />
          ) : (
            <Button
              variant="sec"
              size="sm"
              icon={action.icon}
              loading={action.loading}
              disabledReason={action.disabledReason}
              reasonDisplay="tooltip"
              className={styles.rowAction}
              onClick={action.onAction}
            >
              {action.label}
            </Button>
          )}
        </span>
      ) : null}
    </Wrapper>
  );
}

/* ---------- PhoneHero ---------- */

export type PhoneHeroFigure = {
  id: string;
  value: ReactNode;
  label: ReactNode;
  /** Glyph before the label. Red (danger) only when it needs action now. */
  tone?: WfTone;
};

export type PhoneHeroProps = {
  /** The answer, five words at most ("2 need you now"). */
  title: ReactNode;
  /** One quiet line under the title. */
  sub?: ReactNode;
  /** Up to three figures in one row. Any after the third are not drawn. */
  figures?: PhoneHeroFigure[];
  /** Actions, in a row below the figures. One light primary at most. */
  actions?: ReactNode;
  /** Heading level of the title. Defaults to 2. */
  level?: 1 | 2;
  className?: string;
  "data-testid"?: string;
};

/** The most figures a phone hero shows. */
export const PHONE_HERO_FIGURE_LIMIT = 3;

/**
 * Phone hero: the deep slate band, compact. The title, an optional sub line, at most three figures
 * in one row (15px mono, tabular), and the actions below them. It stays under about a quarter of an
 * 844px screen. Inside it status glyphs take the on-hero tones and focus turns light.
 */
export function PhoneHero({
  title,
  sub,
  figures,
  actions,
  level = 2,
  className,
  "data-testid": testId,
}: PhoneHeroProps) {
  const titleId = useId();
  const Heading = `h${level}` as ElementType;
  const shown = (figures ?? []).slice(0, PHONE_HERO_FIGURE_LIMIT);
  return (
    <section className={cx(styles.hero, className)} aria-labelledby={titleId} data-testid={testId}>
      <div className={styles.heroTitleBlock}>
        {/* One line each; a cut string keeps its full words in a hover title. */}
        <Heading id={titleId} className={styles.heroTitle} title={textOf(title)}>
          {title}
        </Heading>
        {present(sub) ? (
          <p className={styles.heroSub} title={textOf(sub)}>
            {sub}
          </p>
        ) : null}
      </div>
      {shown.length ? (
        <ul className={styles.heroFigures} data-count={shown.length}>
          {shown.map((figure) => (
            <li key={figure.id} className={styles.heroFigure}>
              <span className={styles.heroValue}>{figure.value}</span>
              <span className={styles.heroLabel}>
                {figure.tone ? <StatusGlyph tone={figure.tone} size={10} /> : null}
                <span className={styles.heroLabelText}>{figure.label}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {present(actions) ? <div className={styles.heroActions}>{actions}</div> : null}
    </section>
  );
}

/* ---------- ScrollRow ---------- */

export type ScrollRowProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  /** Chips, tabs or segments. They stay on one line and never wrap. */
  children: ReactNode;
  /** Classes for the inner row that scrolls. */
  rowClassName?: string;
};

function textOf(node: ReactNode): string | undefined {
  return typeof node === "string" || typeof node === "number" ? String(node) : undefined;
}

function setFlag(element: HTMLElement, key: "fadeStart" | "fadeEnd", on: boolean) {
  if (on) element.dataset[key] = "true";
  else delete element.dataset[key];
}

/**
 * A horizontal row of chips or tabs that scrolls sideways and never wraps. Each edge fades only
 * while there is more content that way, so an overflowing row never ends in a hard cut. The fade is
 * a mask, so it works on any surface. Props other than `className` go to the scrolling row, so a
 * caller can give it a role and a name.
 */
export function ScrollRow({ children, className, rowClassName, ...rest }: ScrollRowProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // The fade flags are written straight onto the frame, so scrolling never re-renders the row.
  const measure = useCallback(() => {
    const frame = frameRef.current;
    const row = rowRef.current;
    if (!frame || !row) return;
    const max = row.scrollWidth - row.clientWidth;
    // Right to left rows report a negative scrollLeft; the start edge is the right one there.
    const at = Math.abs(row.scrollLeft);
    setFlag(frame, "fadeStart", max > 1 && at > 1);
    setFlag(frame, "fadeEnd", max > 1 && at < max - 1);
  }, []);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    measure();
    row.addEventListener("scroll", measure, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(row);
    // Chips arriving or leaving change the content width without resizing the row itself, so each
    // chip is watched too, and the list is refreshed only when chips actually change.
    const watch = () => {
      for (const child of Array.from(row.children)) observer?.observe(child);
    };
    watch();
    const chips =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            watch();
            measure();
          });
    chips?.observe(row, { childList: true });
    return () => {
      row.removeEventListener("scroll", measure);
      observer?.disconnect();
      chips?.disconnect();
    };
  }, [measure]);

  return (
    <div ref={frameRef} className={cx(styles.scrollRow, className)}>
      <div ref={rowRef} className={cx(styles.scrollTrack, rowClassName)} {...rest}>
        {children}
      </div>
    </div>
  );
}
