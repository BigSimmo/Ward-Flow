"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { CHROME_ROLE_LABELS } from "@/components/ward-management/ward-chrome-role";

import { howToHref } from "./ward-help-ask";
import { showWardHowTo } from "./ward-help-events";
import { DESK_GUIDES } from "./ward-help-guide";
import { CLINICAL_REPLY, HELP_SEARCH_GROUPS, searchHelp, type HelpSearchResult } from "./ward-help-search-index";
import type { WardTourRole } from "./ward-help-store";
import styles from "./ward-help-search.module.css";

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
export function WardHelpSearch({ role, home }: { role: WardTourRole; home: string | undefined }) {
  const id = useId();
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

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
    setActive(0);
    opener.current?.focus();
  }

  function act(result: HelpSearchResult) {
    const mine = !result.desks || result.desks.includes(role);
    if (result.howToId && mine) {
      close();
      showWardHowTo(result.howToId);
      return;
    }
    const href = mine ? howToHref(result.go, role, home) : undefined;
    if (href) {
      close();
      window.location.assign(href);
    }
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
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
      >
        <span className={styles.text}>
          <strong>{result.title}</strong>
          <span className={styles.detail}>{result.detail}</span>
        </span>
        {result.howToId && mine ? (
          <button type="button" tabIndex={-1} className={styles.action} onClick={() => act(result)}>
            Show me
          </button>
        ) : href ? (
          <Link href={href} tabIndex={-1} className={styles.action} onClick={close}>
            Open
          </Link>
        ) : null}
      </li>
    );
  }

  function groups(list: readonly HelpSearchResult[]) {
    return HELP_SEARCH_GROUPS.map((group) => {
      const inGroup = list.flatMap((result, index) => (result.group === group ? [{ result, index }] : []));
      if (!inGroup.length) return null;
      return (
        <li key={group} role="presentation">
          <p className={styles.group} id={`${id}-g-${group}`}>
            {group}
          </p>
          <ul role="group" aria-labelledby={`${id}-g-${group}`} className={styles.list}>
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
      {open ? (
        <div className={styles.backdrop}>
          <button type="button" aria-label="Close" tabIndex={-1} className={styles.scrim} onClick={close} />
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
                    <p>Check the spelling, or try one of these closest topics.</p>
                  </div>
                ) : null}
                <ul id={`${id}-list`} role="listbox" aria-label="Search Help" className={styles.list}>
                  {answer.kind === "empty" ? rows.map(row) : groups(rows)}
                </ul>
              </>
            )}
            <p className={styles.footer}>
              <span>↑ ↓ Move · Enter Open · Esc Close</span>
              <span>Searches on this device only · nothing typed is saved</span>
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
