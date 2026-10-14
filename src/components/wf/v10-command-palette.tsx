"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "./button";
import { cx } from "./cx";
import { Kbd } from "./primitives";
import { StatusGlyph, type WfTone } from "./status-glyph";
import styles from "./v10-parts.module.css";

export type CommandPaletteItem = {
  id: string;
  kind?: "patient" | "ward" | "action";
  label: string;
  detail?: string;
  category?: string;
  keywords?: readonly string[];
  umrn?: string;
  unitId?: string;
  tone?: WfTone;
  onSelect?: () => void;
};

export type CommandPaletteProps = {
  open: boolean;
  items: readonly CommandPaletteItem[];
  onSelect?: (item: CommandPaletteItem) => void;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  onOpenRequest?: () => void;
  enableGlobalShortcut?: boolean;
  placeholder?: string;
  className?: string;
};

/**
 * Keyboard-first Ctrl+K / Cmd+K command palette (Top 25 #22, D-39).
 * Searches patient UMRN, ward name, or quick operational action without requiring mouse scroll.
 */
export function CommandPalette({
  open,
  items,
  onSelect,
  onClose,
  onOpenChange,
  onOpenRequest,
  enableGlobalShortcut = true,
  placeholder = "Search UMRN, ward name, or quick action…",
  className,
}: CommandPaletteProps) {
  const titleId = useId();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      inputRef.current?.focus();
    } else {
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (open && event.key === "Tab") {
        const focusable = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[data-testid="wf-command-palette"] button, [data-testid="wf-command-palette"] input',
          ),
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (first && last && (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
        return;
      }
      if (enableGlobalShortcut && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopPropagation();
        if (open) {
          setQuery("");
          onClose?.();
          onOpenChange?.(false);
        } else {
          onOpenRequest?.();
          onOpenChange?.(true);
        }
        return;
      }
      if (
        enableGlobalShortcut &&
        !open &&
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !(
          event.target instanceof HTMLElement &&
          (event.target.tagName === "INPUT" ||
            event.target.tagName === "TEXTAREA" ||
            event.target.tagName === "SELECT" ||
            event.target.isContentEditable)
        )
      ) {
        event.preventDefault();
        onOpenRequest?.();
        onOpenChange?.(true);
        return;
      }
      if (open && event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setQuery("");
        onClose?.();
        onOpenChange?.(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enableGlobalShortcut, open, onClose, onOpenChange, onOpenRequest]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 12);
    return items
      .filter((item) => {
        const haystack = [
          item.label,
          item.detail ?? "",
          item.category ?? "",
          ...(item.keywords ?? []),
          item.umrn ?? "",
          item.kind ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 12);
  }, [items, query]);

  if (!open) return null;

  return (
    <div
      className={cx(styles.cmdOverlay, className)}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="wf-command-palette"
    >
      <div className={styles.cmdPanel}>
        <div className={styles.cmdHeader}>
          <span id={titleId} className={styles.cmdTitle}>
            Quick jump &amp; actions
          </span>
          <span className={styles.cmdShortcut}>
            <Kbd>Ctrl+K</Kbd>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              onClose?.();
              onOpenChange?.(false);
            }}
          >
            Close
          </Button>
        </div>
        <div className={styles.cmdSearchWrap}>
          <input
            ref={inputRef}
            type="search"
            className={styles.cmdInput}
            placeholder={placeholder}
            aria-label={placeholder}
            data-testid="wf-command-palette-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {filtered.length === 0 ? (
          <p className={styles.cmdEmpty}>No matching UMRN, ward, or quick action.</p>
        ) : (
          <ul className={styles.cmdList}>
            {filtered.map((item) => (
              <li key={item.id} className={styles.cmdListItem}>
                <button
                  type="button"
                  className={styles.cmdOption}
                  onClick={() => {
                    item.onSelect?.();
                    onSelect?.(item);
                    setQuery("");
                    onClose?.();
                    onOpenChange?.(false);
                  }}
                >
                  <span className={styles.cmdOptionMain}>
                    {item.tone ? <StatusGlyph tone={item.tone} size={10} /> : null}
                    <span className={styles.cmdOptionLabel}>{item.label}</span>
                    {item.umrn ? <span className={styles.cmdOptionUmrn}>{item.umrn}</span> : null}
                  </span>
                  {(item.detail ?? item.category) ? (
                    <span className={styles.cmdOptionDetail}>{item.detail ?? item.category}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function UndoHairlineExpiryEffect({
  active,
  remainingMs,
  onExpire,
}: {
  active: boolean;
  remainingMs: number;
  onExpire?: () => void;
}) {
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!active || !onExpireRef.current) return;
    if (remainingMs <= 0) {
      onExpireRef.current();
      return;
    }
    const timer = window.setTimeout(() => {
      onExpireRef.current?.();
    }, remainingMs);
    return () => window.clearTimeout(timer);
  }, [active, remainingMs]);
  return null;
}
