"use client";

import { Search } from "lucide-react";
import dynamic from "next/dynamic";
import {
  type ComponentType,
  type ReactNode,
  type RefObject,
  useEffect,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useIsPhone } from "@/components/wf";
import { isGlobalSearchShortcut } from "./search/search-shortcut";
import { useEffectiveWardAccess, useWardAccessSnapshot } from "./shell/ward-access-store";
import { useWardPartialDisplayHost } from "./ward-partial-view";
import { useCanOpenHref } from "./shell/ward-access";
import { canDispatch } from "./ward-role-permissions";
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
// The search arrives with its Help wrapper (`ward-global-search-help.tsx`), which supplies the
// desk's Help answers; neither loads on a phone before the page is ready.
const loadSearch = () => import("./ward-global-search-help");
const SearchLoaded = dynamic(() => loadSearch().then((m) => m.WardGlobalSearch));

/**
 * WT-38 (walk-through, 26 Oct 2026): a new desk starts with an empty search, not the last desk's
 * text. The search itself stays role-blind; only this wrapper starts it afresh when the desk changes.
 */
export function WardGlobalSearch(props: WardGlobalSearchProps) {
  const desk = useEffectiveWardAccess();
  const access = useWardAccessSnapshot();
  const host = useWardPartialDisplayHost();
  const canOpenHref = useCanOpenHref();
  const canRunAction = useCallback(
    (action: "new-referral" | "add-patient" | "advance-clock") =>
      action === "advance-clock"
        ? desk.role === "coordinator"
        : desk.role !== "admin" &&
          canDispatch(desk.role, action === "new-referral" ? "RECEIVE_REFERRAL" : "ADD_PATIENT"),
    [desk.role],
  );
  const active = (until: number) => props.now === undefined || until > props.now;
  const accessLifetime =
    host.shared && host.accessContext === null
      ? null
      : JSON.stringify({
          shared: host.shared,
          context: host.accessContext,
          desk,
          openings: access.records.filter((record) => active(record.until)).map(({ id, until }) => [id, until]),
          covers: access.covers.filter((cover) => active(cover.until)).map(({ id, until }) => [id, until]),
        });
  return (
    <DeskSearch
      key={accessLifetime ?? "unavailable"}
      {...props}
      accessLifetime={accessLifetime}
      canOpenHref={canOpenHref}
      canRunAction={canRunAction}
    />
  );
}

function DeskSearch(props: WardGlobalSearchProps) {
  const phone = useIsPhone();
  // Settled by the first render (the server's phone guess), so resizing a window never swaps a
  // working search back to the placeholder.
  const [deferred] = useState(phone);
  const [Loaded, setLoaded] = useState<ComponentType<WardGlobalSearchProps> | null>(null);
  // What the placeholder field holds, kept to the last keystroke so none is lost in the swap.
  const [draft, setDraft] = useState("");
  // True for the one commit in which both fields are drawn (see the layout effect below).
  const [handingOff, setHandingOff] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!deferred) return;
    let live = true;
    loadSearch().then(
      (module) => {
        if (!live) return;
        // Also covers typing before the page was ready, which raised no React events.
        if (fieldRef.current) setDraft(fieldRef.current.value);
        setHandingOff(true);
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

  // The real search is drawn first with the placeholder still beside it, and takes the focus and
  // caret from it in its own layout effect, which runs before this one. Only then is the
  // placeholder removed, in the same task and before any paint. Removing a focused field first
  // would close an iPhone's keyboard, which a focus() outside a tap cannot reopen.
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the second, synchronous commit is the point: it removes the placeholder before any paint
    if (handingOff) setHandingOff(false);
  }, [handingOff]);

  // While the placeholder is up, "/" and Ctrl/Cmd K focus it, as they will the real search.
  const waiting = deferred && Loaded === null;
  useEffect(() => {
    if (!waiting) return;
    function onWindowKeyDown(event: KeyboardEvent) {
      if (!isGlobalSearchShortcut(event)) return;
      event.preventDefault();
      fieldRef.current?.focus();
    }
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, [waiting]);

  // Offline before the code arrived: the next tap or keystroke tries again, even in a field that
  // already has the focus.
  const retry = () => {
    if (!failed) return;
    setFailed(false);
    setAttempt((count) => count + 1);
  };

  if (!deferred) return <SearchLoaded {...props} />;
  const field =
    Loaded === null || handingOff ? (
      <SearchField
        fieldRef={fieldRef}
        label={props.label ?? "Search"}
        placeholder={props.placeholder ?? "Search people and movements…"}
        scope={props.scope}
        onChange={(value) => {
          setDraft(value);
          retry();
        }}
        onFocus={retry}
        onPointerDown={retry}
      />
    ) : null;
  // One shape throughout, so the placeholder keeps its place (and its focus) until it is removed.
  return (
    <>
      {Loaded ? <Loaded {...props} initialQuery={draft} takeFocusFrom={fieldRef} /> : null}
      {field}
    </>
  );
}

/** The search field as `WardGlobalSearch` first draws it, closed, holding only the typed text. */
function SearchField({
  fieldRef,
  label,
  placeholder,
  scope,
  onChange,
  onFocus,
  onPointerDown,
}: {
  fieldRef: RefObject<HTMLInputElement | null>;
  label: string;
  placeholder: string;
  scope: ReactNode;
  onChange: (value: string) => void;
  onFocus: () => void;
  onPointerDown: () => void;
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
          onKeyDown={(event) => {
            // Esc clears, as the guidance below says and the real search does.
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.currentTarget.value = "";
            onChange("");
          }}
          onFocus={onFocus}
          onPointerDown={onPointerDown}
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
