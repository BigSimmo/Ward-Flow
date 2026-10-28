"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { useIsPhone } from "@/components/wf";
import { lockPageScroll } from "@/components/wf/sheet-focus";
import { isGlobalSearchShortcut } from "./search/search-shortcut";
import {
  CORE_SEARCH_VIEWS,
  searchCoreViews,
  searchExecutiveCatalogue,
  type ExecutiveSearchCatalogue,
  type PublicSearchChoice,
} from "./search/ward-smart-search";
import type { WardGlobalSearchProps } from "./ward-global-search";
import styles from "./ward-global-search.module.css";
const START_VIEW_KEYS = ["capacity", "delays", "referrals", "handover"] as const;
const PHONE_SHEET_TOP = "calc(max(var(--wgs-bar-top, 0px), env(safe-area-inset-top, 0px)) + var(--wgs-bar-h, 3.5rem))";
function headerBox(root: HTMLElement | null) {
  const rect = (root?.closest("header") ?? root)?.getBoundingClientRect();
  return { top: Math.max(0, Math.round(rect?.top ?? 0)), height: Math.max(0, Math.round(rect?.height ?? 0)) };
}
/** Public-page search has no operational context, record inputs, recents or commands. */
export function WardPublicSearch({
  accessLifetime,
  ...props
}: Pick<WardGlobalSearchProps, "scope" | "onNavigate" | "label" | "placeholder"> & {
  canOpenHref: (href: string) => boolean;
  catalogue: ExecutiveSearchCatalogue;
  accessLifetime: string;
}) {
  return <PublicSearchPalette key={accessLifetime} {...props} />;
}

function PublicSearchPalette({
  canOpenHref,
  catalogue,
  scope,
  onNavigate,
  label = "Search",
  placeholder = "Search pages…",
}: Pick<WardGlobalSearchProps, "scope" | "onNavigate" | "label" | "placeholder"> & {
  canOpenHref: (href: string) => boolean;
  catalogue: ExecutiveSearchCatalogue;
}) {
  const id = useId();
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const palette = useRef<HTMLDivElement>(null);
  const skipFocus = useRef(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [box, setBox] = useState({ top: 0, height: 0 });
  const phone = useIsPhone();
  const permitted = CORE_SEARCH_VIEWS.filter((view) => canOpenHref(view.href));
  const usual = START_VIEW_KEYS.flatMap((key) => permitted.filter((view) => view.key === key));
  const page = (view: (typeof permitted)[number]): PublicSearchChoice => ({ ...view, kind: "view", kindLabel: "View" });
  const matches = (
    query.trim()
      ? [
          ...searchCoreViews(query, permitted).map((result) => page(result.view)),
          ...searchExecutiveCatalogue(query, catalogue),
        ]
      : (usual.length ? usual : permitted).slice(0, 4).map(page)
  ).filter((choice) => canOpenHref(choice.href));
  const rows = matches.slice(0, 40);
  const selected = rows[active];
  const optionId = (choice: PublicSearchChoice) => `${id}-page-${choice.kind}-${encodeURIComponent(choice.key)}`;
  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const navigate = (href: string) => {
    if (!canOpenHref(href)) return;
    const confirmNavigation = (window as typeof window & { __wardFlowConfirmNavigation?: () => boolean })
      .__wardFlowConfirmNavigation;
    if (confirmNavigation && !confirmNavigation()) return;
    close();
    if (onNavigate) onNavigate(href);
    else router.push(href);
  };
  useEffect(() => {
    const shortcut = (event: globalThis.KeyboardEvent) => {
      if (!isGlobalSearchShortcut(event)) return;
      event.preventDefault();
      input.current?.focus();
      setOpen(true);
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => setBox(headerBox(root.current));
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open || !phone) return;
    return lockPageScroll();
  }, [open, phone]);
  return (
    <div
      ref={root}
      className={styles.root}
      data-open={open || undefined}
      data-testid="ward-global-search"
      style={{ "--wgs-bar-h": `${box.height}px`, "--wgs-bar-top": `${box.top}px` } as CSSProperties}
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (next && !root.current?.contains(next) && !palette.current?.contains(next)) close();
      }}
    >
      {scope !== undefined ? (
        <span className={styles.scopeChip} data-testid="ward-global-search-scope">
          {scope}
        </span>
      ) : null}
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.controlBox}>
        <Search className={styles.icon} width={16} height={16} aria-hidden="true" />
        <input
          id={id}
          ref={input}
          className={styles.input}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-haspopup="listbox"
          aria-controls={open && rows.length ? `${id}-pages` : undefined}
          aria-activedescendant={open && selected ? optionId(selected) : undefined}
          aria-autocomplete="list"
          aria-describedby={`${id}-hint`}
          placeholder={placeholder}
          value={query}
          data-testid="ward-global-search-input"
          onFocus={() => {
            if (skipFocus.current) {
              skipFocus.current = false;
              return;
            }
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setQuery("");
              close();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              if (rows.length)
                setActive((index) =>
                  event.key === "ArrowDown" ? (index + 1) % rows.length : index <= 0 ? rows.length - 1 : index - 1,
                );
            } else if (open && rows.length && (event.key === "Home" || event.key === "End")) {
              event.preventDefault();
              setActive(event.key === "Home" ? 0 : rows.length - 1);
            } else if (open && selected && event.key === "Enter") {
              event.preventDefault();
              navigate(selected.href);
            }
          }}
        />
        {!query ? (
          <kbd className={styles.shortcut} aria-hidden="true">
            /
          </kbd>
        ) : (
          <button
            type="button"
            className={styles.clear}
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setActive(-1);
              input.current?.focus();
            }}
          >
            <X width={12} height={12} aria-hidden="true" />
            <span className={styles.clearText}>Clear</span>
          </button>
        )}
        {open ? (
          <button
            type="button"
            className={styles.cancel}
            data-testid="ward-global-search-cancel"
            onClick={(event) => {
              setQuery("");
              close();
              if (event.detail === 0) {
                skipFocus.current = true;
                input.current?.focus();
              } else input.current?.blur();
            }}
          >
            Cancel
          </button>
        ) : null}
      </div>
      <span id={`${id}-hint`} className={styles.guidance}>
        Press <kbd>/</kbd> or <kbd>Ctrl K</kbd> to search from anywhere. <kbd>Esc</kbd> clears.
      </span>
      {open && typeof document !== "undefined"
        ? createPortal(
            <>
              <div className={styles.scrim} aria-hidden="true" onMouseDown={close} />
              <div
                ref={palette}
                className={styles.popup}
                role="presentation"
                style={
                  {
                    top: phone ? PHONE_SHEET_TOP : box.top + box.height + 8,
                    "--wgs-bar-h": `${box.height}px`,
                    "--wgs-bar-top": `${box.top}px`,
                  } as CSSProperties
                }
                data-start={!query.trim() || undefined}
                data-testid="ward-global-search-popup"
                onMouseDown={(event) => event.preventDefault()}
              >
                <p className={styles.commandNote} role="status">
                  Individual records are unavailable for executive reporting.
                </p>
                <div className={styles.listPane}>
                  <div className={styles.group}>Go to</div>
                  {rows.length ? (
                    <ul id={`${id}-pages`} className={styles.groupList} role="listbox" aria-label="Go to">
                      {rows.map((view, index) => (
                        <li key={`${view.kind}:${view.key}`} role="presentation">
                          <Link
                            id={optionId(view)}
                            href={view.href}
                            className={styles.option}
                            role="option"
                            aria-selected={index === active}
                            data-active={index === active || undefined}
                            data-testid={`ward-global-search-result-${view.kind}-${view.key}`}
                            onClick={(event) => {
                              if (!canOpenHref(view.href)) {
                                event.preventDefault();
                                return;
                              }
                              if (
                                event.defaultPrevented ||
                                event.button !== 0 ||
                                event.metaKey ||
                                event.ctrlKey ||
                                event.shiftKey ||
                                event.altKey
                              )
                                return;
                              close();
                              if (onNavigate) {
                                event.preventDefault();
                                onNavigate(view.href);
                              }
                            }}
                          >
                            <span className={styles.resultContent}>
                              <span className={styles.resultTitle}>{view.title}</span>
                              <span className={styles.resultMeta}>{view.description}</span>
                            </span>
                            <span className={styles.resultKind}>{view.kindLabel}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.emptyDescription}>No permitted pages match this search.</p>
                  )}
                  {matches.length > rows.length ? (
                    <p className={styles.commandNote}>
                      First {rows.length} matches. Refine your search to see other matches.
                    </p>
                  ) : null}
                </div>
              </div>
            </>,
            document.body,
          )
        : null}
    </div>
  );
}
