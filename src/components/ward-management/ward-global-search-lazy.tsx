"use client";

import { Search } from "lucide-react";
import dynamic from "next/dynamic";
import { type ComponentType, type ReactNode, type RefObject, useEffect, useId, useRef, useState } from "react";

import { useIsPhone } from "@/components/wf";
import type { WardGlobalSearchProps } from "./ward-global-search";
import styles from "./ward-global-search.module.css";
// The palette's preview styles stay in the shell's own stylesheet, in the same order as before, so
// the desktop page is drawn exactly as it was. Only the search's script is split out.
import "./search/global-search-preview.module.css";

/**
 * Repo score follow-up (16 October 2026): the header search and the engine behind it are about
 * 38 KB gzipped, and every phone page loaded them before it could draw. The bar mounts search from
 * here. Above phone width it is the same search, drawn by the server as before (`ssr` stays on and
 * there is no `loading`, so the server waits for it). On a phone the server draws a plain field
 * with the same markup, and the search loads straight after the page is ready and takes its place,
 * keeping anything already typed and the focus.
 */
const loadSearch = () => import("./ward-global-search");
const SearchLoaded = dynamic(() => loadSearch().then((m) => m.WardGlobalSearch));

export function WardGlobalSearch(props: WardGlobalSearchProps) {
  const phone = useIsPhone();
  // Settled by the first render (the server's phone guess), so resizing a window never swaps a
  // working search back to the placeholder.
  const [deferred] = useState(phone);
  const [Loaded, setLoaded] = useState<ComponentType<WardGlobalSearchProps> | null>(null);
  // What the placeholder field holds, kept to the last keystroke so none is lost in the swap.
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!deferred) return;
    let live = true;
    loadSearch().then(
      (module) => {
        if (!live) return;
        // Also covers a tap or typing before the page was ready, which raised no React events.
        const field = fieldRef.current;
        if (field) {
          setDraft(field.value);
          if (document.activeElement === field) setFocused(true);
        }
        setLoaded(() => module.WardGlobalSearch);
      },
      () => {
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [deferred, attempt]);

  // Offline before the code arrived: the next tap or keystroke tries again, even in a field that
  // already has the focus.
  const retry = () => {
    if (!failed) return;
    setFailed(false);
    setAttempt((count) => count + 1);
  };

  if (!deferred) return <SearchLoaded {...props} />;
  if (Loaded) return <Loaded {...props} initialQuery={draft} takeFocus={focused} />;
  return (
    <SearchField
      fieldRef={fieldRef}
      label={props.label ?? "Search"}
      placeholder={props.placeholder ?? "Search people and movements…"}
      scope={props.scope}
      onChange={(value) => {
        setDraft(value);
        retry();
      }}
      onFocus={() => {
        setFocused(true);
        retry();
      }}
      onPointerDown={retry}
      onBlur={() => setFocused(false)}
    />
  );
}

/** The search field as `WardGlobalSearch` first draws it, closed and empty, with nothing wired. */
function SearchField({
  fieldRef,
  label,
  placeholder,
  scope,
  onChange,
  onFocus,
  onPointerDown,
  onBlur,
}: {
  fieldRef: RefObject<HTMLInputElement | null>;
  label: string;
  placeholder: string;
  scope: ReactNode;
  onChange: (value: string) => void;
  onFocus: () => void;
  onPointerDown: () => void;
  onBlur: () => void;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={styles.root} data-testid="ward-global-search">
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
          ref={fieldRef}
          className={styles.input}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          enterKeyHint="search"
          spellCheck={false}
          aria-describedby={hintId}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onFocus={onFocus}
          onPointerDown={onPointerDown}
          onBlur={onBlur}
          data-testid="ward-global-search-input"
        />
        <kbd aria-hidden="true" className={styles.shortcut} data-ward-search-shortcut>
          /
        </kbd>
      </div>
      <span className={styles.guidance} id={hintId}>
        Press <kbd>/</kbd> or <kbd>Ctrl K</kbd> to search from anywhere. <kbd>Esc</kbd> clears.
      </span>
    </div>
  );
}
