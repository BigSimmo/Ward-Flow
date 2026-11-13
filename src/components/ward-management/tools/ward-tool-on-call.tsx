"use client";

import Link from "next/link";
import { useContext, useEffect, useMemo, useReducer, useState } from "react";
import { ArrowUpRight, ChevronDown, Copy, Phone, Star } from "lucide-react";

import { WardFlowContext, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { minuteOfDay } from "@/components/ward-management/ward-clock";
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
} from "@/components/ward-management/on-call/on-call-directory";
import {
  readFavourites,
  saveFavourites,
  subscribeFavourites,
} from "@/components/ward-management/on-call/on-call-favourites";
import { onCallHref } from "@/components/ward-management/shell/ward-facade";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import {
  useExecutiveStatistics,
  useExecutiveStatisticsControl,
} from "@/components/ward-management/statistics/executive-statistics-context";
import { scenarioWardNetwork } from "@/components/ward-management/ward-scenarios";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { Button, Count, EmptyState, Menu, SearchField, StatusGlyph, type WfTone } from "@/components/wf";
import styles from "./ward-tool-on-call.module.css";

/**
 * Tools mock-up Q322, On-call. Forked from the live `WardToolsContacts` view: it still reads the
 * On-call directory, so the sheet and the page can never list different numbers. It opens on Key
 * lines; the five filter chips fold into one kit Menu beside the count; each line gets a call
 * button (40px on a phone) named "Call <role>".
 *
 * Calling does not dial. The On-call directory's rule ("nothing dials or sends; Call copies the
 * number and says the dialler is not wired", `on-call-directory.ts`) holds here too: every number is
 * an invented demo number in the (08) 5550 fiction range. A15-29 (13 Nov 2026): one Sample mark per
 * row covers its number, hours and duty together, not the number alone.
 */

type ContactsView = "key" | "mine" | "now" | "recent" | "all";

const VIEWS: { id: ContactsView; label: string }[] = [
  { id: "key", label: "Key lines" },
  { id: "mine", label: "My list" },
  { id: "now", label: "On now" },
  { id: "recent", label: "Recent" },
  { id: "all", label: "All" },
];

const SHOWN = 12;

function availabilityLine(entry: DirectoryEntry, minute: number): { tone: WfTone; text: string } {
  const now = availability(entry, minute);
  if (now.kind === "none") return { tone: "neutral", text: "No line recorded" };
  if (now.kind === "on" && now.allDay) return { tone: "success", text: now.email ? "Inbox open" : "On now, all day" };
  if (now.kind === "on") return { tone: now.soon ? "warning" : "success", text: `On now until ${hhmm(now.until)}` };
  return { tone: "neutral", text: `Opens ${hhmm(now.opens)}` };
}

export function ToolOnCall({ onNavigate }: { onNavigate: () => void }) {
  return useExecutiveStatisticsControl().executive ? (
    <ExecutiveOnCall onNavigate={onNavigate} />
  ) : (
    <OperationalOnCall onNavigate={onNavigate} />
  );
}

function ExecutiveOnCall({ onNavigate }: { onNavigate: () => void }) {
  const report = useExecutiveStatistics();
  const entries = useMemo(
    () => (report ? buildOnCallDirectory(scenarioWardNetwork(report.sampleScenario).sites) : null),
    [report],
  );
  return report && entries ? (
    <OnCallBody entries={entries} minute={minuteOfDay(report.network.asAt.now)} onNavigate={onNavigate} />
  ) : (
    <p role="status">On-call is unavailable until this report is ready.</p>
  );
}

function OperationalOnCall({ onNavigate }: { onNavigate: () => void }) {
  const scenario = useContext(WardFlowContext)?.scenario;
  const entries = useMemo(
    () => buildOnCallDirectory(scenario ? scenarioWardNetwork(scenario).sites : undefined),
    [scenario],
  );
  const minute = minuteOfDay(useWardFlowClock());
  return <OnCallBody entries={entries} minute={minute} onNavigate={onNavigate} />;
}

function OnCallBody({
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

  async function copyDetail(entry: DirectoryEntry, detail: string, calling: boolean) {
    try {
      await copyTextToClipboard(detail);
      setRecent((current) => [entry.id, ...current.filter((id) => id !== entry.id)].slice(0, 8));
      setNotice(calling ? `Copied ${detail}. Calling is not wired in this prototype.` : `Copied ${detail}`);
    } catch {
      setNotice("Copy is unavailable in this browser.");
    }
  }

  const searching = query.trim().length > 0;
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
  const countOf = (which: ContactsView) => entries.filter((entry) => inView(entry, which)).length;
  // A search looks across everything (the On-call page's own matcher), so a role typed from Key
  // lines is still found.
  const rows = entries
    .filter((entry) => (searching ? entryMatchesQuery(entry, query) : inView(entry, view)))
    .sort((a, b) => (view === "recent" && !searching ? recent.indexOf(a.id) - recent.indexOf(b.id) : 0));
  const current = VIEWS.find((item) => item.id === view)!;

  return (
    <div className={styles.body} data-testid="ward-tools-contacts">
      <SearchField label="Find a contact" placeholder="Team, ward or role" value={query} onValueChange={setQuery} />
      <div className={styles.bar}>
        <Menu
          label="Contact lists"
          items={VIEWS.map((item) => ({
            id: item.id,
            label: item.label,
            meta: <Count n={countOf(item.id)} />,
            checked: !searching && item.id === view,
            checkable: "radio" as const,
            onSelect: () => {
              setQuery("");
              setView(item.id);
            },
          }))}
          trigger={(props) => (
            <button
              {...props}
              type="button"
              className={styles.picker}
              aria-label={`Contact list: ${searching ? "search results" : current.label}`}
              data-testid="ward-tools-contacts-list"
            >
              <span>{searching ? "Search results" : current.label}</span>
              <span className={styles.pickerCount}>{rows.length}</span>
              <ChevronDown aria-hidden="true" size={16} strokeWidth={1.75} />
            </button>
          )}
        />
      </div>
      {rows.length ? (
        <ul className={styles.list} aria-label="Contacts">
          {rows.slice(0, SHOWN).map((entry) => {
            const name = (KEY_LINE_IDS as readonly string[]).includes(entry.id) ? keyLineLabel(entry) : entry.name;
            // An email-only inbox shows its address, so every row has something to use.
            const number = numberAt(entry, minute);
            const detail = number ?? entry.email;
            const status = availabilityLine(entry, minute);
            const starred = favourites.includes(entry.id);
            return (
              <li key={entry.id} className={styles.row}>
                <span className={styles.who}>
                  <strong className={styles.name}>
                    {name} <span className={styles.demo}>Sample</span>
                  </strong>
                  <span className={styles.place}>{entry.place}</span>
                  <span className={styles.status}>
                    <StatusGlyph tone={status.tone} size={8} />
                    {status.text}
                  </span>
                  <span className={styles.number}>{detail ?? "No number"}</span>
                </span>
                <span className={styles.actions}>
                  {number ? (
                    <Button
                      variant="sec"
                      size="sm"
                      icon={Phone}
                      iconOnly
                      aria-label={`Call ${name}`}
                      onClick={() => void copyDetail(entry, number, true)}
                    />
                  ) : null}
                  {!number && detail ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Copy}
                      iconOnly
                      aria-label={`Copy email for ${name}`}
                      onClick={() => void copyDetail(entry, detail, false)}
                    />
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Star}
                    iconOnly
                    className={starred ? styles.starOn : undefined}
                    aria-pressed={starred}
                    aria-label={`${starred ? "Remove" : "Add"} ${name} ${starred ? "from" : "to"} My list`}
                    onClick={() => toggleFavourite(entry.id)}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          title={
            searching
              ? "No contact matches"
              : view === "mine"
                ? "Nothing on My list"
                : view === "recent"
                  ? "Nothing yet"
                  : "None now"
          }
          meta={
            view === "mine" && !searching
              ? "Tap the star on a contact to add it."
              : view === "recent" && !searching
                ? "Numbers you call or copy show here."
                : undefined
          }
        />
      )}
      {rows.length > SHOWN ? (
        <p className={styles.note}>
          Showing {SHOWN} of {rows.length}. Search to narrow, or open On-call.
        </p>
      ) : null}
      <p className={styles.live} role="status">
        <span key={notice.revision}>{notice.text}</span>
      </p>
      {canOpen(onCallHref()) ? (
        <Link className={styles.more} href={onCallHref()} onClick={onNavigate}>
          Open On-call
          <ArrowUpRight aria-hidden="true" size={14} strokeWidth={1.75} />
        </Link>
      ) : null}
    </div>
  );
}
