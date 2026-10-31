"use client";

import Link from "next/link";
import { useContext, useEffect, useMemo, useState, useReducer } from "react";
import { Copy, Search, Star } from "lucide-react";

import { StatusGlyph } from "@/components/wf";
import { WardFlowContext, useWardFlowClock } from "../ward-flow-provider";
import { minuteOfDay } from "../ward-clock";
import {
  KEY_LINE_IDS,
  availability,
  buildOnCallDirectory,
  entryMatchesQuery,
  hhmm,
  isAnswering,
  keyLineLabel,
  numberAt,
  type DirectoryEntry,
} from "../on-call/on-call-directory";
import { readFavourites, saveFavourites, subscribeFavourites } from "../on-call/on-call-favourites";
import { onCallHref } from "../shell/ward-facade";
import styles from "./ward-tools-sheet.module.css";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "../statistics/executive-statistics-context";
import { scenarioWardNetwork } from "../ward-scenarios";
import { useCanOpenHref } from "../shell/ward-access";

type ContactsView = "key" | "mine" | "now" | "recent" | "all";

function availabilityLine(
  entry: DirectoryEntry,
  minute: number,
): { tone: "success" | "warning" | "neutral"; text: string } {
  const now = availability(entry, minute);
  if (now.kind === "none") return { tone: "neutral", text: "No line recorded" };
  if (now.kind === "on" && now.allDay) return { tone: "success", text: now.email ? "Inbox open" : "On now, all day" };
  if (now.kind === "on") return { tone: now.soon ? "warning" : "success", text: `On now until ${hhmm(now.until)}` };
  return { tone: "neutral", text: `Opens ${hhmm(now.opens)}` };
}

/**
 * Tools, Contacts (Tools review item 14, 15 Oct 2026). Reads the On-call directory, so the sheet and
 * the On-call page can never list different numbers, and adds who is answering now, the key lines,
 * My list (shared with On-call) and the numbers copied this visit. Every number is a labelled mock.
 */
export function WardToolsContacts({ onNavigate }: { onNavigate: () => void }) {
  return useExecutiveStatisticsControl().executive ? (
    <ExecutiveContacts onNavigate={onNavigate} />
  ) : (
    <OperationalContacts onNavigate={onNavigate} />
  );
}
function ExecutiveContacts({ onNavigate }: { onNavigate: () => void }) {
  const report = useExecutiveStatistics();
  const entries = useMemo(
    () => (report ? buildOnCallDirectory(scenarioWardNetwork(report.sampleScenario).sites) : null),
    [report],
  );
  return report && entries ? (
    <ContactsBody entries={entries} minute={minuteOfDay(report.network.asAt.now)} onNavigate={onNavigate} />
  ) : (
    <p role="status">On-call is unavailable until this report is ready.</p>
  );
}
function OperationalContacts({ onNavigate }: { onNavigate: () => void }) {
  const scenario = useContext(WardFlowContext)?.scenario;
  const entries = useMemo(
    () => buildOnCallDirectory(scenario ? scenarioWardNetwork(scenario).sites : undefined),
    [scenario],
  );
  const minute = minuteOfDay(useWardFlowClock());
  return <ContactsBody entries={entries} minute={minute} onNavigate={onNavigate} />;
}
function ContactsBody({
  entries,
  minute,
  onNavigate,
}: {
  entries: DirectoryEntry[];
  minute: number;
  onNavigate: () => void;
}) {
  const canOpen = useCanOpenHref();
  const [view, setView] = useState<ContactsView>("key");
  const [query, setQuery] = useState("");
  const [favourites, setFavourites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [notice, setNotice] = useReducer(
    (previous: { text: string; revision: number }, text: string) => ({ text, revision: previous.revision + 1 }),
    { text: "", revision: 0 },
  );

  const ids = useMemo(() => new Set(entries.map((entry) => entry.id)), [entries]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setFavourites(readFavourites(ids)));
    // Shared with the On-call page, so a star set there while Tools is open shows here too.
    const unsubscribe = subscribeFavourites((next) => setFavourites(next.filter((id) => ids.has(id))));
    return () => {
      window.cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [ids]);

  function toggleFavourite(id: string) {
    const next = favourites.includes(id) ? favourites.filter((value) => value !== id) : [...favourites, id];
    setFavourites(next);
    setNotice(
      saveFavourites(next)
        ? next.includes(id)
          ? "Added to My list"
          : "Removed from My list"
        : "My list is kept for this visit only.",
    );
  }

  async function copyDetail(entry: DirectoryEntry, detail: string) {
    try {
      await copyTextToClipboard(detail);
      setRecent((current) => [entry.id, ...current.filter((id) => id !== entry.id)].slice(0, 8));
      setNotice(`Copied ${detail}`);
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
          ? isAnswering(entry, minute)
          : which === "recent"
            ? recent.includes(entry.id)
            : true;
  // The same matcher as the On-call page and the header search (`entryMatchesQuery`).
  const matchesQuery = (entry: DirectoryEntry) => entryMatchesQuery(entry, query);
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
          aria-label="Search a team, ward or role"
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
          // An email-only inbox shows its address, so every row has something to use.
          const number = numberAt(entry, minute);
          const detail = number ?? entry.email;
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
                {detail ?? "No number"}
                {detail ? <b className={styles.mockBadge}>Mock</b> : null}
              </span>
              <span className={styles.contactActions}>
                {detail ? (
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={`Copy ${number ? "number" : "email"} for ${entry.name}`}
                    onClick={() => void copyDetail(entry, detail)}
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
        <span key={notice.revision}>{notice.text}</span>
      </p>
      {canOpen(onCallHref()) && (
        <Link className={styles.moreLink} href={onCallHref()} onClick={onNavigate}>
          Open On-call
        </Link>
      )}
    </div>
  );
}
