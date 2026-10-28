"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { CHROME_ROLE_LABELS } from "@/components/ward-management/ward-chrome-role";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import { popSheet, pushSheet } from "@/components/wf/sheet-focus";

import { howToHref } from "./ward-help-ask";
import { showWardHowTo } from "./ward-help-events";
import { DESK_GUIDES } from "./ward-help-guide";
import { CLINICAL_REPLY, HELP_SEARCH_GROUPS, searchHelp, type HelpSearchResult } from "./ward-help-search-index";
import type { WardTourRole } from "./ward-help-store";
import styles from "./ward-help-search.module.css";

/** Native fragment navigation keeps the mounted workspace and notifies Settings. */
function openHelpTab(tab: string) {
  if (window.location.hash !== `#${tab}`) window.location.hash = tab;
}

function roleLabel(role: WardTourRole): string {
  return role === "admin" ? "Access admin" : CHROME_ROLE_LABELS[role];
}

function suggested(role: WardTourRole): readonly HelpSearchResult[] {
  return DESK_GUIDES[role].jobs.slice(0, 3).map((job, index) => ({
    key: `guide:${role}:${index}`,
    group: "Guides",
    title: job.job,
    detail: job.how,
    go: job.go,
    desks: [role],
  }));
}

/**
 * HELP SEARCH (variant A): a field in the Help sheet that opens a centred search box over all of
 * Help. Results come from `searchHelp` only; typed words stay in this component's state and are never
 * written to storage, a URL or a log (D-11, D-18).
 */
export function WardHelpSearch({
  role,
  home,
  onNavigate,
}: {
  role: WardTourRole;
  home: string | undefined;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const id = useId();
  // Show me plays only when the help-ask flag is on; otherwise a result falls back to Open.
  const showMeOn = useWardFeatureFlag("help-ask");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const answer = useMemo(() => searchHelp(query, role), [query, role]);
  const rows =
    answer.kind === "results"
      ? answer.results
      : answer.kind === "none"
        ? answer.closest
        : answer.kind === "empty"
          ? suggested(role)
          : [];

  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Join the shared modal stack so the Help sheet behind stops handling Escape and Tab.
    const layerId = `ward-help-search-${id}`;
    pushSheet(layerId, layer.current);
    input.current?.focus();
    return () => popSheet(layerId);
  }, [open, id]);

  useEffect(() => {
    // Keep the highlighted result visible when arrows move past the edge of a scrolled list.
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, id]);

  function close(restoreFocus = true) {
    setOpen(false);
    setQuery("");
    setActive(0);
    // Wait a frame so the layer has left the modal stack and the Help sheet behind is no longer
    // inert; Show me and navigation pass false because they take focus elsewhere.
    if (restoreFocus) requestAnimationFrame(() => opener.current?.focus());
  }

  function act(result: HelpSearchResult) {
    const mine = !result.desks || result.desks.includes(role);
    if (showMeOn && result.howToId && mine) {
      close(false);
      showWardHowTo(result.howToId);
      return;
    }
    const href = mine ? howToHref(result.go, role, home) : undefined;
    if (href) {
      close(false);
      onNavigate?.();
      const [path, tab] = href.split("#");
      if (path === window.location.pathname && tab) openHelpTab(tab);
      else router.push(href);
    }
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      // Closing removes this layer before window listeners run. Keep the same Escape from
      // reaching the Help sheet that has just become the top layer again.
      event.stopPropagation();
      close();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (rows.length)
        setActive((current) => (current + (event.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length);
    } else if (event.key === "Enter" && rows[active]) {
      event.preventDefault();
      act(rows[active]);
    } else if (event.key === "Tab") {
      event.preventDefault(); // Focus stays in the box; arrows move between results.
    }
  }

  function row(result: HelpSearchResult, index: number) {
    const mine = !result.desks || result.desks.includes(role);
    const href = mine ? howToHref(result.go, role, home) : undefined;
    return (
      <li
        key={result.key}
        id={`${id}-${index}`}
        role="option"
        aria-selected={index === active}
        className={index === active ? `${styles.row} ${styles.active}` : styles.row}
        data-testid={`ward-help-search-result-${result.key}`}
        onMouseEnter={() => setActive(index)}
        onClick={() => act(result)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            act(result);
          }
        }}
      >
        <span className={styles.text}>
          <strong>{result.title}</strong>
          <span className={styles.detail}>{result.detail}</span>
        </span>
        {showMeOn && result.howToId && mine ? (
          <span className={styles.action}>Show me</span>
        ) : href ? (
          <span className={styles.action}>Open</span>
        ) : null}
      </li>
    );
  }

  function groups(list: readonly HelpSearchResult[]) {
    return HELP_SEARCH_GROUPS.map((group, groupIndex) => {
      const inGroup = list.flatMap((result, index) => (result.group === group ? [{ result, index }] : []));
      if (!inGroup.length) return null;
      return (
        <li key={group} role="presentation">
          <p className={styles.group} id={`${id}-g-${groupIndex}`}>
            {group}
          </p>
          <ul role="group" aria-labelledby={`${id}-g-${groupIndex}`} className={styles.list}>
            {inGroup.map(({ result, index }) => row(result, index))}
          </ul>
        </li>
      );
    });
  }

  return (
    <>
      <button
        ref={opener}
        type="button"
        className={styles.field}
        data-testid="ward-help-search-field"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Search size={16} aria-hidden="true" />
        <span>Search Help: guides, screens, words, shortcuts…</span>
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div ref={layer} className={styles.backdrop}>
              <button type="button" aria-label="Close" tabIndex={-1} className={styles.scrim} onClick={() => close()} />
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Search Help"
                className={styles.box}
                data-testid="ward-help-search"
              >
                <div className={styles.inputRow}>
                  <Search size={18} aria-hidden="true" />
                  <input
                    ref={input}
                    type="search"
                    role="combobox"
                    aria-expanded={rows.length > 0}
                    aria-controls={`${id}-list`}
                    aria-activedescendant={rows.length ? `${id}-${active}` : undefined}
                    aria-label="Search Help"
                    placeholder="Search Help: guides, screens, words, shortcuts…"
                    autoComplete="off"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActive(0);
                    }}
                    onKeyDown={onKey}
                    className={styles.input}
                  />
                </div>
                {answer.kind === "clinical" ? (
                  <div className={styles.notice} role="status" data-testid="ward-help-search-clinical">
                    <strong>This is a clinical question.</strong>
                    <p>{CLINICAL_REPLY}</p>
                  </div>
                ) : (
                  <>
                    {answer.kind === "empty" ? <p className={styles.group}>Suggested for {roleLabel(role)}</p> : null}
                    {answer.kind === "none" ? (
                      <div className={styles.notice} role="status" data-testid="ward-help-search-none">
                        <strong>No Help topics match &ldquo;{query.trim()}&rdquo;.</strong>
                        <p>
                          {rows.length
                            ? "Check the spelling, or try one of these closest topics."
                            : "Check the spelling, or try different words."}
                        </p>
                      </div>
                    ) : null}
                    <ul id={`${id}-list`} role="listbox" aria-label="Search Help" className={styles.list}>
                      {answer.kind === "empty" ? rows.map(row) : groups(rows)}
                    </ul>
                  </>
                )}
                <p className={styles.footer}>
                  <span>↑ ↓ Move · Enter Open · Esc Close</span>
                  <span>Search stays on this device only · nothing typed is saved</span>
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
