"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { Check, type LucideIcon } from "lucide-react";
import { cx } from "./cx";
import { Icon } from "./icon";
import { Kbd } from "./primitives";
import styles from "./overlay.module.css";

export type MenuItem =
  | {
      kind?: "item";
      id: string;
      label: ReactNode;
      icon?: LucideIcon;
      /** Right-aligned meta, such as a count or a short reason. */
      meta?: ReactNode;
      kbd?: string;
      /** `danger` only for an act-now or destructive choice. */
      tone?: "danger";
      /** Keeps the item focusable with `aria-disabled`; show why in `meta`. */
      disabled?: boolean;
      /**
       * Makes the item checkable: `menuitemcheckbox` (or `menuitemradio` with `checkable:
       * "radio"`) with `aria-checked` and a tick when checked. The caller owns the state and
       * flips it in `onSelect`.
       */
      checked?: boolean;
      /** Checkable role. Defaults to `checkbox` when `checked` is set. */
      checkable?: "checkbox" | "radio";
      /**
       * Close the menu after selecting. Defaults to true, except checkbox items, which stay open
       * so several can be toggled in one visit.
       */
      closeOnSelect?: boolean;
      onSelect: () => void;
    }
  | { kind: "separator"; id: string }
  | { kind: "heading"; id: string; label: ReactNode };

export type MenuTriggerProps = {
  ref: RefObject<HTMLButtonElement | null>;
  "aria-haspopup": "menu" | "dialog";
  "aria-expanded": boolean;
  "aria-controls": string | undefined;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
};

/** Closes on a pointer press outside the anchor. */
function useOutsidePress(open: boolean, anchorRef: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const anchor = anchorRef.current;
      if (anchor && event.target instanceof Node && !anchor.contains(event.target)) onClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, anchorRef, onClose]);
}

export type MenuProps = {
  /** Accessible name of the menu. */
  label: string;
  items: MenuItem[];
  /** Renders the trigger. Spread the props onto a real `<button>`. */
  trigger: (props: MenuTriggerProps) => ReactNode;
  align?: "start" | "end";
  className?: string;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Glass menu with full keyboard support: arrows, Home and End, type-ahead, Escape returns focus
 * to the trigger, Tab closes. Items are real buttons with `role="menuitem"`, or
 * `menuitemcheckbox` / `menuitemradio` with `aria-checked` when they carry `checked`.
 */
export function Menu({ label, items, trigger, align = "start", className, onOpenChange }: MenuProps) {
  const menuId = useId();
  const [open, setOpenState] = useState(false);
  const [active, setActive] = useState(0);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const actionableCount = items.filter((item) => item.kind === undefined || item.kind === "item").length;
  /** One checkable item reserves the tick column on every item, so labels stay aligned. */
  const hasCheckable = items.some(
    (item) =>
      (item.kind === undefined || item.kind === "item") && (item.checked !== undefined || item.checkable !== undefined),
  );

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const close = useCallback(
    (returnFocus: boolean) => {
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [setOpen],
  );

  const closeFromOutside = useCallback(() => close(false), [close]);
  useOutsidePress(open, anchorRef, closeFromOutside);

  useEffect(() => {
    if (open) itemRefs.current[active]?.focus();
  }, [open, active]);

  const openAt = (position: "first" | "last") => {
    if (actionableCount === 0) return;
    setActive(position === "first" ? 0 : actionableCount - 1);
    setOpen(true);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openAt("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openAt("last");
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = actionableCount;
    if (count === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (current + 1) % count);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current - 1 + count) % count);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(count - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      close(false);
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      const char = event.key.toLowerCase();
      for (let step = 1; step <= count; step += 1) {
        const position = (active + step) % count;
        const text = itemRefs.current[position]?.textContent?.trim().toLowerCase() ?? "";
        if (text.startsWith(char)) {
          setActive(position);
          break;
        }
      }
    }
  };

  const positionOf = new Map<string, number>();
  for (const item of items) {
    if (item.kind === undefined || item.kind === "item") positionOf.set(item.id, positionOf.size);
  }

  return (
    <span ref={anchorRef} className={cx(styles.anchor, className)}>
      {trigger({
        ref: triggerRef,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? menuId : undefined,
        onClick: () => (open ? close(false) : openAt("first")),
        onKeyDown: onTriggerKeyDown,
      })}
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={cx(styles.glass, styles.panel, align === "end" ? styles.end : styles.start)}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item) => {
            if (item.kind === "separator") return <div key={item.id} role="separator" className={styles.separator} />;
            if (item.kind === "heading")
              return (
                <div key={item.id} role="presentation" className={styles.heading}>
                  {item.label}
                </div>
              );
            const position = positionOf.get(item.id) ?? 0;
            const checkable = item.checkable ?? (item.checked !== undefined ? ("checkbox" as const) : undefined);
            const closeOnSelect = item.closeOnSelect ?? checkable !== "checkbox";
            return (
              <button
                key={item.id}
                ref={(node) => {
                  itemRefs.current[position] = node;
                }}
                type="button"
                role={checkable === "radio" ? "menuitemradio" : checkable ? "menuitemcheckbox" : "menuitem"}
                aria-checked={checkable ? Boolean(item.checked) : undefined}
                tabIndex={position === active ? 0 : -1}
                aria-disabled={item.disabled || undefined}
                className={cx(styles.item, item.tone === "danger" && styles.danger)}
                onMouseEnter={() => setActive(position)}
                onClick={() => {
                  if (item.disabled) return;
                  if (closeOnSelect) close(true);
                  item.onSelect();
                }}
              >
                {hasCheckable ? (
                  <span className={styles.itemCheck} aria-hidden="true">
                    {checkable && item.checked ? <Icon icon={Check} size={14} /> : null}
                  </span>
                ) : null}
                {item.icon ? <Icon icon={item.icon} size={16} className={styles.itemIcon} /> : null}
                <span className={styles.itemLabel}>{item.label}</span>
                {item.meta ? <span className={styles.itemMeta}>{item.meta}</span> : null}
                {item.kbd ? <Kbd>{item.kbd}</Kbd> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </span>
  );
}

export type PopoverProps = {
  /** Accessible name of the popover dialog. */
  label: string;
  trigger: (props: MenuTriggerProps) => ReactNode;
  /** Content. Receives `close` so an action inside can dismiss it. */
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  className?: string;
  panelClassName?: string;
};

/**
 * Non-modal glass popover (filters, small pickers, pop-outs). Escape and an outside press close
 * it, and Escape returns focus to the trigger. Focus moves to the first control inside on open.
 */
export function Popover({ label, trigger, children, align = "start", className, panelClassName }: PopoverProps) {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus goes back to the trigger after Escape or an action inside, not after an outside press.
  const [returnFocus, setReturnFocus] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const closeAndReturn = useCallback(() => {
    setOpen(false);
    setReturnFocus(true);
  }, []);
  useOutsidePress(open, anchorRef, close);

  useEffect(() => {
    if (!open && returnFocus) triggerRef.current?.focus();
  }, [open, returnFocus]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    (first ?? panel)?.focus();
  }, [open]);

  return (
    <span ref={anchorRef} className={cx(styles.anchor, className)}>
      {trigger({
        ref: triggerRef,
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        "aria-controls": open ? panelId : undefined,
        onClick: () => {
          setReturnFocus(false);
          setOpen((value) => !value);
        },
        onKeyDown: () => {},
      })}
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={label}
          tabIndex={-1}
          className={cx(
            styles.glass,
            styles.panel,
            styles.popover,
            align === "end" ? styles.end : styles.start,
            panelClassName,
          )}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              closeAndReturn();
            }
          }}
        >
          {children(closeAndReturn)}
        </div>
      ) : null}
    </span>
  );
}
