"use client";

import Link from "next/link";
import { useContext, useEffect, useMemo, useState } from "react";
import { Copy, Search, Star } from "lucide-react";

import { StatusGlyph } from "@/components/wf";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";
import { WardFlowContext, useWardFlowClock } from "../ward-flow-provider";
import { minuteOfDay } from "../ward-clock";
import {
  KEY_LINE_IDS,
  availability,
  buildOnCallDirectory,
  hhmm,
  isAnswering,
  keyLineLabel,
  numberAt,
  type DirectoryEntry,
} from "../on-call/on-call-directory";
import { onCallHref } from "../shell/ward-facade";
import styles from "./ward-tools-sheet.module.css";

/** The On-call page's own My list, so a star set in either place shows in both. Ids only. */
const FAVOURITES_KEY = "ward-flow:on-call:favourites";

type ContactsView = "key" | "mine" | "now" | "recent" | "all";

function readFavourites(): string[] {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(FAVOURITES_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function availabilityLine(
  entry: DirectoryEntry,
  minute: number,
): { tone: "success" | "warning" | "neutral"; text: string } {
  const now = availability(entry, minute);
  if (now.kind === "none") return { tone: "neutral", text: "No line recorded" };
  if (now.kind === "on" && now.allDay) return { tone: "success", text: "On now, 24 hours" };
  if (now.kind === "on") return { tone: now.soon ? "warning" : "success", text: `On now until ${hhmm(now.until)}` };
  return { tone: "neutral", text: `Opens ${hhmm(now.opens)}` };
}

/**
 * Tools, Contacts (Tools review item 14, 15 Oct 2026). Reads the On-call directory, so the sheet and
 * the On-call page can never list different numbers, and adds who is answering now, the key lines,
 * My list (shared with On-call) and the numbers copied this visit. Every number is a labelled mock.
 */
export function WardToolsContacts({ onNavigate }: { onNavigate: () => void }) {
  const scenario = useContext(WardFlowContext)?.scenario;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `scenario` re-points `wardSites`, which the build reads
  const entries = useMemo(() => buildOnCallDirectory(), [scenario]);
  const minute = minuteOfDay(useWardFlowClock());
  const [view, setView] = useState<ContactsView>("key");
  const [query, setQuery] = useState("");
  const [favourites, setFavourites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setFavourites(readFavourites()));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleFavourite(id: string) {
    const next = favourites.includes(id) ? favourites.filter((value) => value !== id) : [...favourites, id];
    setFavourites(next);
    try {
      window.localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
      setNotice(next.includes(id) ? "Added to My list" : "Removed from My list");
    } catch {
      setNotice("My list is kept for this visit only.");
    }
  }

  async function copyNumber(entry: DirectoryEntry, number: string) {
    try {
      await copyTextToClipboard(number);
      setRecent((current) => [entry.id, ...current.filter((id) => id !== entry.id)].slice(0, 8));
      setNotice(`Copied ${number}`);
    } catch {
      setNotice("Copy is unavailable in this browser.");
    }
  }

  const terms = query.toLowerCase().trim().split(/\s+/u).filter(Boolean);
  const inView = (entry: DirectoryEntry, which: ContactsView) =>
    which === "key"
      ? (KEY_LINE_IDS as readonly string[]).includes(entry.id)
      : which === "mine"
        ? favourites.includes(entry.id)
        : which === "now"
          ? isAnswering(entry, minute) && entry.lines.length > 0
          : which === "recent"
            ? recent.includes(entry.id)
            : true;
  const matchesQuery = (entry: DirectoryEntry) =>
    terms.every((term) => `${entry.name} ${entry.place} ${entry.purpose}`.toLowerCase().includes(term));
  // A search looks across everything, so a name typed from the Key lines view is still found.
  const rows = entries
    .filter((entry) => (terms.length > 0 ? matchesQuery(entry) : inView(entry, view)))
    .sort((a, b) => (view === "recent" && terms.length === 0 ? recent.indexOf(a.id) - recent.indexOf(b.id) : 0));
  const views: { id: ContactsView; label: string }[] = [
    { id: "key", label: "Key lines" },
    { id: "mine", label: "My list" },
    { id: "now", label: "On now" },
    { id: "recent", label: "Recent" },
    { id: "all", label: "All" },
  ];

  return (
    <div className={styles.toolBody} data-testid="ward-tools-contacts">
      <label className={styles.search}>
        <Search aria-hidden="true" strokeWidth={1.75} />
        <input
          type="search"
          aria-label="Search contacts"
          placeholder="Search a team, ward or role"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className={styles.chips} role="group" aria-label="Contact lists">
        {views.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.chip}
            aria-pressed={terms.length === 0 && view === item.id}
            onClick={() => {
              setQuery("");
              setView(item.id);
            }}
          >
            {item.label}
            <span className={styles.chipCount} aria-hidden="true">
              {entries.filter((entry) => inView(entry, item.id)).length}
            </span>
          </button>
        ))}
      </div>
      <ul className={styles.contactList} aria-label="Contacts">
        {rows.slice(0, 12).map((entry) => {
          const number = numberAt(entry, minute);
          const status = availabilityLine(entry, minute);
          const starred = favourites.includes(entry.id);
          return (
            <li key={entry.id} className={styles.contactRow}>
              <span className={styles.contactName}>
                <strong>
                  {(KEY_LINE_IDS as readonly string[]).includes(entry.id) ? keyLineLabel(entry) : entry.name}
                </strong>
                <small>{entry.place}</small>
                <small className={styles.contactStatus}>
                  <StatusGlyph tone={status.tone} size={8} />
                  {status.text}
                </small>
              </span>
              <span className={styles.contactNumber}>
                {number ?? "No number"}
                {number ? <b className={styles.mockBadge}>Mock</b> : null}
              </span>
              <span className={styles.contactActions}>
                {number ? (
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={`Copy number for ${entry.name}`}
                    onClick={() => void copyNumber(entry, number)}
                  >
                    <Copy aria-hidden="true" strokeWidth={1.75} />
                  </button>
                ) : null}
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-pressed={starred}
                  aria-label={`${starred ? "Remove" : "Add"} ${entry.name} ${starred ? "from" : "to"} My list`}
                  onClick={() => toggleFavourite(entry.id)}
                >
                  <Star aria-hidden="true" strokeWidth={1.75} data-on={starred || undefined} />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 ? (
        <p className={styles.empty}>
          {view === "mine"
            ? "Nothing on My list yet. Tap the star on a contact to add it."
            : view === "recent"
              ? "Numbers you copy appear here."
              : "No contact matches."}
        </p>
      ) : rows.length > 12 ? (
        <p className={styles.note}>Showing 12 of {rows.length}. Search to narrow, or open On-call for the full list.</p>
      ) : null}
      <p className={styles.liveNote} role="status">
        {notice}
      </p>
      <Link className={styles.moreLink} href={onCallHref()} onClick={onNavigate}>
        Open On-call and contacts
      </Link>
    </div>
  );
}
