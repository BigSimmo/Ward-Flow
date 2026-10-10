"use client";

import {
  Fragment,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ChevronDown, Clock, Copy, Mail, MapPin, Printer, Search, Star, Users } from "lucide-react";
import { minuteOfDay } from "@/components/ward-management/ward-clock";
import { WardFlowContext, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import {
  Button,
  Card,
  CardFoot,
  FilterChip,
  Hero,
  HeroStat,
  HeroTrack,
  Icon,
  Kbd,
  Sheet,
  SrOnly,
  StatusGlyph,
  Tabs,
  TextInput,
  cx,
  tableClasses,
} from "@/components/wf";
import {
  CHECK_DUE_DAYS,
  KEY_LINE_IDS,
  SERVICE_META,
  availability,
  buildOnCallDirectory,
  hhmm,
  isAnswering,
  keyLineLabel,
  numberAt,
  upcomingChanges,
  windowText,
  groupRows,
  type DirectoryEntry,
  type DirectorySection,
  type DirectoryTab,
} from "./on-call-directory";
import {
  ContactCard,
  FavouriteButton,
  NumberCell,
  ServiceTag,
  UntilCell,
  isWardRow,
  placeOf,
  type ContactActions,
} from "./on-call-parts";
import { PhoneDirectory, PhoneFocal, PhoneSheet } from "./on-call-phone";

import styles from "./on-call.module.css";

const FAVOURITES_KEY = "ward-flow:on-call:favourites";

export type Highlight = "now" | "soon" | "email" | "due";

/** Highlights mark rows and never hide one: a contact you cannot see is a contact you cannot ring. */
export const HIGHLIGHTS: { id: Highlight; label: string; test: (entry: DirectoryEntry, minute: number) => boolean }[] =
  [
    { id: "now", label: "Answering", test: (entry, minute) => isAnswering(entry, minute) },
    {
      id: "soon",
      label: "Ends within the hour",
      test: (entry, minute) => {
        const now = availability(entry, minute);
        return now.kind === "on" && !now.allDay && now.soon;
      },
    },
    { id: "email", label: "Has email", test: (entry) => Boolean(entry.email) },
    { id: "due", label: "Check due", test: (entry) => entry.checkedDaysAgo > CHECK_DUE_DAYS },
  ];

const COVER_AT: { id: string; label: string }[] = [
  { id: "now", label: "Now" },
  { id: "1320", label: "22:00" },
  { id: "180", label: "03:00" },
  { id: "480", label: "08:00" },
  { id: "720", label: "12:00" },
];

const PHONE_QUERY = "(max-width: 48rem)";

const JUMP_LABEL: Record<string, string> = {
  "North Metro": "NM",
  "East Metro": "EM",
  "South Metro": "SM",
  CAHS: "CA",
  WACHS: "WA",
  Private: "Pvt",
};

/** Phone is its own layout, not a reflow: the screen renders a different tree under 48rem. */
function useIsPhone(): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window.matchMedia !== "function") return () => undefined;
      const query = window.matchMedia(PHONE_QUERY);
      query.addEventListener?.("change", notify);
      return () => query.removeEventListener?.("change", notify);
    },
    () => typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}

/** My list saved by the earlier roster page held its role ids; each maps to the same directory line. */
const LEGACY_FAVOURITE_IDS: Record<string, string> = {
  "bed-coordinator": "sw-bfc",
  "governance-lead": "sw-gov",
  "nm-coordinator": "nmhs-bfc",
  "nm-consultant": "nmhs-scon",
  "sm-coordinator": "smhs-bfc",
  "sm-consultant": "smhs-scon",
  "em-coordinator": "emhs-bfc",
  "em-consultant": "emhs-scon",
  "pr-coordinator": "pr-liaison",
};

const SECTION_LABEL: Record<DirectorySection, string> = {
  hospitals: "Hospitals",
  community: "Community",
  statewide: "Statewide",
};

export function matchesQuery(entry: DirectoryEntry, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return false;
  return [
    entry.name,
    entry.place,
    entry.groupTitle,
    entry.siteCode ?? "",
    entry.purpose,
    SERVICE_META[entry.service].short,
    SERVICE_META[entry.service].name,
    entry.email ?? "",
    ...entry.lines.map((item) => `${item.number ?? ""} ${item.label}`),
  ].some((value) => value.toLowerCase().includes(needle));
}

export function rowsForTab(entries: readonly DirectoryEntry[], tab: DirectoryTab, favourites: readonly string[]) {
  return tab === "mine"
    ? entries.filter((entry) => favourites.includes(entry.id))
    : entries.filter((entry) => entry.section === tab);
}

/**
 * On-call directory, design A1 (owner pick, 9 October 2026): key lines in the hero, a directory with
 * the number, the time it is available until and the referral email on every row, and a contact
 * card on the right. Every record is synthetic and every number is a mock that cannot be rung; see
 * `on-call-directory.ts`. Nothing here dials or sends. Every escalation ladder on the contact card
 * ends at the governance lead, the statewide Tier 3 desk.
 */
export function OnCallScreen() {
  const boardNow = useWardFlowClock();
  const boardMinute = minuteOfDay(boardNow);
  const isPhone = useIsPhone();
  // The EMHS demo and surge scenarios swap in their own wards, so the directory follows the scenario.
  const scenario = useContext(WardFlowContext)?.scenario;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `scenario` re-points `wardSites`, which the build reads
  const entries = useMemo(() => buildOnCallDirectory(), [scenario]);
  const ids = useMemo(() => new Set(entries.map((entry) => entry.id)), [entries]);

  const [tab, setTab] = useState<DirectoryTab>("hospitals");
  const [groupBy, setGroupBy] = useState<"place" | "role">("place");
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("nmhs-bfc");
  const [coverAt, setCoverAt] = useState("now");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [favourites, setFavourites] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [downtimeOpen, setDowntimeOpen] = useState(false);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const searchId = useId();
  const panelHeadingId = useId();
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const minute = coverAt === "now" ? boardMinute : Number(coverAt);
  const atLater = coverAt !== "now";

  const favouritesChanged = useRef(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (favouritesChanged.current) return;
      try {
        const saved: unknown = JSON.parse(window.localStorage.getItem(FAVOURITES_KEY) ?? "[]");
        if (Array.isArray(saved))
          setFavourites([
            ...new Set(
              saved
                .filter((id): id is string => typeof id === "string")
                .map((id) => LEGACY_FAVOURITE_IDS[id] ?? id)
                .filter((id) => ids.has(id)),
            ),
          ]);
      } catch {
        // Saved preferences are optional; the directory works without them.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [ids]);
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (isPhone) return;
    // "/" focuses search, as the hint beside it says, unless the person is already typing somewhere.
    function onKey(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      document.getElementById(searchId)?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPhone, searchId]);

  const say = useCallback((text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 4000);
  }, []);

  const copy = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        say(label);
      } catch {
        say("Copy is unavailable in this browser. Select the text instead.");
      }
    },
    [say],
  );

  function toggleFavourite(id: string) {
    favouritesChanged.current = true;
    const next = favourites.includes(id) ? favourites.filter((value) => value !== id) : [...favourites, id];
    setFavourites(next);
    try {
      window.localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
      say(next.includes(id) ? "Added to My list" : "Removed from My list");
    } catch {
      say("My list is kept for this visit only. Browser storage is unavailable.");
    }
  }

  /** Selecting a contact opens its group and its tab, so the card and the row always agree. */
  function pick(id: string) {
    const entry = entries.find((item) => item.id === id);
    if (!entry) return;
    setSelectedId(id);
    // My list stays open only for a starred line; anything else opens its own tab so its row shows.
    const stays = tab === entry.section || (tab === "mine" && favourites.includes(id));
    if (!stays) setTab(entry.section);
    setCollapsed((current) => {
      if (!current.has(entry.group) && !current.has(`role-${entry.kind}`)) return current;
      const next = new Set(current);
      next.delete(entry.group);
      next.delete(`role-${entry.kind}`);
      return next;
    });
    if (isPhone) setSheetId(id);
  }

  const actions: ContactActions = {
    minute,
    entries,
    favourites,
    onPick: pick,
    onToggleFavourite: toggleFavourite,
    onCopy: (text, label) => void copy(text, label),
    onCall: (entry) => {
      const number = numberAt(entry, minute);
      if (!number) return;
      void copy(number, `Number copied. Calling is not wired in this prototype.`);
    },
  };

  const answering = entries.filter((entry) => isAnswering(entry, minute));
  const endingSoon = entries.filter((entry) => HIGHLIGHTS[1]!.test(entry, minute));
  const closed = entries.filter((entry) => availability(entry, minute).kind === "off");
  const checkDue = entries.filter((entry) => entry.checkedDaysAgo > CHECK_DUE_DAYS);
  const changes = upcomingChanges(entries, minute, 360);
  const keyLines = KEY_LINE_IDS.map((id) => entries.find((entry) => entry.id === id)).filter(
    (entry): entry is DirectoryEntry => entry !== undefined,
  );

  function copyWhoIsOn() {
    const on = entries.filter((entry) => entry.rostered && isAnswering(entry, minute));
    // Each row names the line answering, so an office line in hours is never passed off as on call.
    const lines = on.map((entry) => {
      const now = availability(entry, minute);
      const until = now.kind === "on" && !now.allDay ? `, until ${hhmm(now.until)}` : "";
      const line = now.kind === "on" && now.line ? `${now.line.label} ` : "";
      return `${entry.name}, ${entry.place}: ${line}${numberAt(entry, minute) ?? "email only"}${until}`;
    });
    void copy(
      [`Who answers at ${hhmm(minute)} (synthetic records)`, ...lines].join("\n"),
      `Copied ${on.length} rostered roles answering`,
    );
  }

  const toggleHighlight = (id: Highlight) => setHighlight((current) => (current === id ? null : id));
  /** A highlight or search is on: rows it does not match recede by colour and stay in place. */
  const dimming = highlight !== null || Boolean(query.trim());
  const isHighlighted = (entry: DirectoryEntry) =>
    matchesQuery(entry, query) ||
    (highlight !== null && HIGHLIGHTS.find((item) => item.id === highlight)!.test(entry, minute));

  const selected = entries.find((entry) => entry.id === selectedId) ?? entries[0]!;
  const sheetEntry = sheetId ? entries.find((entry) => entry.id === sheetId) : undefined;
  const tabRows = rowsForTab(entries, tab, favourites);
  const tabCounts: Record<DirectoryTab, number> = {
    hospitals: entries.filter((entry) => entry.section === "hospitals").length,
    community: entries.filter((entry) => entry.section === "community").length,
    statewide: entries.filter((entry) => entry.section === "statewide").length,
    mine: favourites.length,
  };
  const queryHits = query.trim() ? entries.filter((entry) => matchesQuery(entry, query)) : [];
  // Phone shows one tab at a time, so matches the current tab does not show get a button per tab.
  const shownIds = new Set(tabRows.map((entry) => entry.id));
  const offTab = queryHits.filter((entry) => !shownIds.has(entry.id));
  const otherHits = (Object.keys(SECTION_LABEL) as DirectorySection[])
    .map((section) => ({
      section,
      label: SECTION_LABEL[section],
      count: offTab.filter((entry) => entry.section === section).length,
      onShow: () => setTab(section),
    }))
    .filter((item) => item.count > 0);

  const heroStats = (
    <>
      <HeroStat
        value={answering.length}
        label="answering"
        tone="success"
        pressed={highlight === "now"}
        onToggle={() => toggleHighlight("now")}
      />
      <HeroStat
        value={endingSoon.length}
        label="end within the hour"
        tone="warning"
        pressed={highlight === "soon"}
        onToggle={() => toggleHighlight("soon")}
      />
      <HeroStat value={closed.length} label="closed" tone="neutral" />
      <HeroStat
        value={checkDue.length}
        label="check due"
        tone="warning"
        pressed={highlight === "due"}
        onToggle={() => toggleHighlight("due")}
      />
    </>
  );

  const clock = (
    <span className={styles.heroClock}>
      <Icon icon={Clock} size={14} />
      <span className={styles.heroClockTime}>{hhmm(boardMinute)}</span>
      <span className={styles.heroClockZone}>AWST</span>
    </span>
  );

  const coverTrack = (
    <HeroTrack
      label="Show cover at"
      items={isPhone ? COVER_AT.slice(0, 4) : COVER_AT}
      value={coverAt}
      onChange={setCoverAt}
      size="sm"
    />
  );

  const hero = (
    <div data-testid="ward-on-call-hud-island">
      <Hero
        level={1}
        eyebrow={
          atLater ? `Who answers at ${hhmm(minute)}${minute < boardMinute ? " tomorrow" : ""}` : "Who to call now"
        }
        title={`${answering.length} ${answering.length === 1 ? "line" : "lines"} answering`}
        stats={heroStats}
        aside={clock}
        bar={
          <>
            <span className={styles.heroLabel}>Cover at</span>
            <span className={styles.trackWrap}>{coverTrack}</span>
            {!isPhone && changes.length ? (
              <span className={styles.changes}>
                <span className={styles.heroLabel}>Next</span>
                {changes.slice(0, 1).map((change) => (
                  <button
                    key={`${change.minute}-${change.text}`}
                    type="button"
                    className={styles.change}
                    title={`Show cover at ${hhmm(change.minute)}`}
                    onClick={() => setCoverAt(String(change.minute))}
                  >
                    <b className={styles.mono}>{hhmm(change.minute)}</b>
                    <span className={styles.changeText}>{change.text}</span>
                  </button>
                ))}
              </span>
            ) : null}
          </>
        }
        barAside={
          isPhone ? undefined : (
            <>
              <Button variant="light" size="sm" icon={Copy} onClick={copyWhoIsOn}>
                Copy who is on
              </Button>
              <Button variant="onHero" size="sm" icon={Star} count={favourites.length} onClick={() => setTab("mine")}>
                My list
              </Button>
              <Button
                variant="onHero"
                size="sm"
                icon={Printer}
                className={styles.previewButton}
                title="Preview until the Downtime page exists"
                onClick={() => setDowntimeOpen(true)}
              >
                Downtime card
              </Button>
            </>
          )
        }
        foot={
          isPhone ? (
            <PhoneFocal entries={entries} actions={actions} onOpen={(id) => setSheetId(id)} />
          ) : (
            <div className={styles.keys} role="group" aria-label="Key lines">
              {keyLines.map((entry) => {
                const now = availability(entry, minute);
                return (
                  <button
                    key={entry.id}
                    id={entry.id === "sw-bfc" ? "ward-reach-bed" : undefined}
                    type="button"
                    className={styles.key}
                    aria-pressed={selected.id === entry.id}
                    data-testid={`ward-on-call-key-${entry.id}`}
                    onClick={() => pick(entry.id)}
                  >
                    <span className={styles.keyLabel}>
                      <ServiceTag service={entry.service} label="" />
                      <span className={styles.truncate}>{keyLineLabel(entry)}</span>
                    </span>
                    <span className={styles.keyNumber}>{numberAt(entry, minute) ?? "Not held"}</span>
                    <span className={styles.keyUntil}>
                      {now.kind === "on" ? (
                        now.allDay ? (
                          <>
                            <StatusGlyph tone="success" size={9} />
                            24 hours
                          </>
                        ) : (
                          <>
                            <StatusGlyph tone={now.soon ? "warning" : "success"} size={9} />
                            Until <span className={styles.mono}>{hhmm(now.until)}</span>
                          </>
                        )
                      ) : now.kind === "off" ? (
                        <>
                          <StatusGlyph tone="neutral" size={9} />
                          Opens <span className={styles.mono}>{hhmm(now.opens)}</span>
                        </>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )
        }
      />
    </div>
  );

  const tabItems = [
    { id: "hospitals" as const, label: isPhone ? "Hospitals" : "Hospitals", count: tabCounts.hospitals },
    { id: "community" as const, label: isPhone ? "Teams" : "Community", count: tabCounts.community },
    { id: "statewide" as const, label: isPhone ? "State" : "Statewide", count: tabCounts.statewide },
    { id: "mine" as const, label: isPhone ? "Mine" : "My list", count: tabCounts.mine },
  ];

  const search = (
    <>
      <label className={styles.srOnlyLabel} htmlFor={searchId}>
        Search contacts
      </label>
      <TextInput
        id={searchId}
        type="search"
        icon={Search}
        trailing={isPhone ? undefined : <Kbd>/</Kbd>}
        placeholder="Role, hospital, ward, team or number"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        boxClassName={styles.search}
      />
    </>
  );

  const highlightChips = HIGHLIGHTS.map((item) => (
    <FilterChip
      key={item.id}
      pressed={highlight === item.id}
      onPressedChange={() => toggleHighlight(item.id)}
      count={tabRows.filter((entry) => item.test(entry, minute)).length}
      className={styles.chip}
    >
      {item.id === "email" ? (
        <Icon icon={Mail} size={14} />
      ) : (
        <StatusGlyph tone={item.id === "now" ? "success" : "warning"} size={9} />
      )}
      {item.label}
    </FilterChip>
  ));

  const groupByChip =
    tab === "hospitals" ? (
      <FilterChip
        pressed={groupBy === "role"}
        onPressedChange={(on) => setGroupBy(on ? "role" : "place")}
        className={styles.chip}
      >
        <Icon icon={groupBy === "role" ? Users : MapPin} size={14} />
        By role
      </FilterChip>
    ) : null;

  // A sheet makes the page behind it inert, so while one is open its feedback shows inside it.
  const sheetOpen = downtimeOpen || Boolean(isPhone && sheetEntry);
  const noticeLine = sheetOpen ? null : (
    <p className={cx(styles.toast, notice && styles.toastOn)} role="status" data-testid="ward-on-call-notice">
      {notice}
    </p>
  );
  const sheetNotice = sheetOpen ? (
    <p className={styles.sheetNotice} role="status" data-testid="ward-on-call-notice">
      {notice}
    </p>
  ) : null;

  if (isPhone) {
    return (
      <div className={styles.screen} data-testid="ward-on-call-screen" data-ward-design="v8">
        <main id="main-content" className={styles.main}>
          {hero}
          <div className={styles.phoneTools}>
            {search}
            <Tabs label="Directory" items={tabItems} value={tab} onChange={setTab} className={styles.phoneTabs} />
            <div className={styles.phoneChips}>
              {groupByChip}
              {highlightChips}
            </div>
          </div>
          <PhoneDirectory
            entries={entries}
            rows={tabRows}
            tab={tab}
            groupBy={tab === "hospitals" ? groupBy : "place"}
            actions={actions}
            isHighlighted={isHighlighted}
            dimming={dimming}
            queryActive={Boolean(query.trim())}
            hitCount={tabRows.filter((entry) => matchesQuery(entry, query)).length}
            otherHits={otherHits}
            onClearQuery={() => setQuery("")}
            onOpen={(id) => setSheetId(id)}
          />
          <p className={styles.phoneFoot}>
            <StatusGlyph tone="warning" size={9} />
            Synthetic records. Every number is a mock from an unassigned range.
          </p>
          {noticeLine}
        </main>
        {sheetEntry ? (
          <PhoneSheet entry={sheetEntry} actions={actions} notice={sheetNotice} onClose={() => setSheetId(null)} />
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.screen} data-testid="ward-on-call-screen" data-ward-design="v8">
      <main id="main-content" className={styles.main}>
        {hero}
        <div className={styles.grid}>
          <Card
            id="ward-reach-switchboard"
            tabIndex={-1}
            aria-label="Contacts directory"
            data-testid="ward-on-call-directory"
            className={styles.directory}
          >
            <div className={styles.dirHead}>
              <Tabs label="Directory" items={tabItems} value={tab} onChange={setTab} />
              <span className={styles.spacer} />
              {search}
            </div>
            <div className={styles.dirHead2} role="group" aria-label="Group and highlight rows. Nothing is hidden">
              {groupByChip}
              {groupByChip ? <span className={styles.divider} aria-hidden="true" /> : null}
              {highlightChips}
              {highlight || query ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setHighlight(null);
                    setQuery("");
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </div>
            <DirectoryTable
              entries={entries}
              rows={tabRows}
              tab={tab}
              groupBy={tab === "hospitals" ? groupBy : "place"}
              actions={actions}
              selectedId={selected.id}
              collapsed={collapsed}
              onToggleGroup={(key) =>
                setCollapsed((current) => {
                  const next = new Set(current);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })
              }
              isHighlighted={isHighlighted}
              dimming={dimming}
            />
            <CardFoot
              meta={
                <span className={styles.footMeta} data-testid="ward-on-call-count">
                  {tabRows.length} {tabRows.length === 1 ? "contact" : "contacts"} in this tab, {entries.length} in all.{" "}
                  {atLater ? `Shown as at ${hhmm(minute)}.` : `Shown as at ${hhmm(boardMinute)}, the board time.`}
                </span>
              }
            >
              <span className={styles.disclosure}>
                <StatusGlyph tone="warning" size={9} />
                Synthetic records. Every number is a mock from an unassigned range and every email uses a reserved
                domain. {checkDue.length} records are over {CHECK_DUE_DAYS} days since their last check.
              </span>
            </CardFoot>
          </Card>

          <Card
            className={styles.panel}
            aria-labelledby={panelHeadingId}
            data-testid="ward-on-call-role-panel"
            data-wf-rail
          >
            {queryHits.length || query.trim() ? (
              <MatchesPanel query={query} hits={queryHits} actions={actions} onClear={() => setQuery("")} />
            ) : (
              <ContactCard entry={selected} actions={actions} headingId={panelHeadingId} />
            )}
          </Card>
        </div>
        {noticeLine}
        <WardPrototypeFooter
          testId="ward-on-call-governance"
          note="Not a medical device. Synthetic records, mock numbers. Calling and email are not wired."
        />
      </main>
      <DowntimeCard
        open={downtimeOpen}
        onClose={() => setDowntimeOpen(false)}
        entries={[
          ...keyLines,
          ...entries.filter((entry) => favourites.includes(entry.id) && !KEY_LINE_IDS.includes(entry.id as never)),
        ]}
        onCopy={actions.onCopy}
        notice={sheetNotice}
      />
    </div>
  );
}

function MatchesPanel({
  query,
  hits,
  actions,
  onClear,
}: {
  query: string;
  hits: DirectoryEntry[];
  actions: ContactActions;
  onClear: () => void;
}) {
  return (
    <>
      <div className={styles.cardHead}>
        <div className={styles.cardWho}>
          <h2 className={styles.cardTitle}>Matches</h2>
          <span className={styles.cardPlace}>For &ldquo;{query.trim()}&rdquo;. Rows stay in place, highlighted.</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>
      {hits.length ? (
        <ul className={styles.matches}>
          {hits.slice(0, 30).map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={styles.match}
                onClick={() => {
                  actions.onPick(entry.id);
                  onClear();
                }}
              >
                <span className={styles.roleCell}>
                  <b>{entry.name}</b>
                  <span>{placeOf(entry)}</span>
                </span>
                <span className={styles.matchEnd}>
                  <span className={styles.number}>{numberAt(entry, actions.minute) ?? entry.email ?? ""}</span>
                  <UntilCell entry={entry} actions={actions} compact />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.note}>No role, place, number or team matches.</p>
      )}
    </>
  );
}

function DirectoryTable({
  entries,
  rows,
  tab,
  groupBy,
  actions,
  selectedId,
  collapsed,
  onToggleGroup,
  isHighlighted,
  dimming = false,
}: {
  entries: readonly DirectoryEntry[];
  rows: readonly DirectoryEntry[];
  tab: DirectoryTab;
  groupBy: "place" | "role";
  actions: ContactActions;
  selectedId: string;
  collapsed: ReadonlySet<string>;
  onToggleGroup: (key: string) => void;
  isHighlighted: (entry: DirectoryEntry) => boolean;
  dimming?: boolean;
}) {
  const blocks = groupRows(entries, rows, tab, groupBy);
  const byRole = tab === "hospitals" && groupBy === "role";
  const scroller = useRef<HTMLDivElement>(null);
  const services = blocks.flatMap((block) => (block.service ? [block.service] : []));
  /* Jump inside the table's own scroller, so the page itself never moves. */
  function jumpTo(tone: string) {
    const box = scroller.current;
    const row = box?.querySelector<HTMLElement>(`#ward-on-call-svc-${tone}`);
    if (!box || !row) return;
    const head = box.querySelector("thead")?.getBoundingClientRect().height ?? 0;
    box.scrollTo({ top: row.offsetTop - head, behavior: "smooth" });
  }
  return (
    <div className={styles.tableScroll} ref={scroller}>
      <table className={cx(tableClasses.table, styles.dirTable)} data-testid="ward-on-call-dir-table">
        <colgroup>
          <col className={styles.colStar} />
          <col className={styles.colRole} />
          <col className={styles.colNumber} />
          <col className={styles.colUntil} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">
              <SrOnly>My list</SrOnly>
            </th>
            <th scope="col">Role and place</th>
            <th scope="col">Number</th>
            <th scope="col">Available</th>
            <th scope="col">Referral email</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <Fragment key={block.service ?? "all"}>
              {block.service ? (
                <tr className={styles.serviceRow} id={`ward-on-call-svc-${SERVICE_META[block.service].tone}`}>
                  <th scope="rowgroup" colSpan={5}>
                    <span className={styles.serviceHead}>
                      <ServiceTag service={block.service} label={SERVICE_META[block.service].name} strong />
                      <span className={styles.cellSub}>
                        <span className={styles.mono}>
                          {block.groups.reduce(
                            (total, group) =>
                              total + group.rows.filter((entry) => isAnswering(entry, actions.minute)).length,
                            0,
                          )}
                        </span>{" "}
                        of{" "}
                        <span className={styles.mono}>
                          {block.groups.reduce((total, group) => total + group.rows.length, 0)}
                        </span>{" "}
                        answering
                      </span>
                      <span className={styles.spacer} />
                      {services.length > 1 ? (
                        <span className={styles.jump} role="group" aria-label="Jump to service">
                          {services.map((service) => (
                            <button
                              key={service}
                              type="button"
                              className={styles.jumpButton}
                              aria-label={`Jump to ${SERVICE_META[service].name}`}
                              aria-current={service === block.service ? "true" : undefined}
                              onClick={() => jumpTo(SERVICE_META[service].tone)}
                            >
                              <ServiceTag service={service} label={JUMP_LABEL[service]} />
                            </button>
                          ))}
                        </span>
                      ) : null}
                    </span>
                  </th>
                </tr>
              ) : null}
              {block.groups.map((group) => {
                const isCollapsed = collapsed.has(group.key);
                const on = group.rows.filter((entry) => isAnswering(entry, actions.minute)).length;
                return (
                  <Fragment key={group.key}>
                    {tab !== "mine" ? (
                      <tr className={styles.groupRow}>
                        <th scope="rowgroup" colSpan={5}>
                          <button
                            type="button"
                            className={styles.groupButton}
                            aria-expanded={!isCollapsed}
                            onClick={() => onToggleGroup(group.key)}
                          >
                            <Icon
                              icon={ChevronDown}
                              size={14}
                              className={cx(styles.chevron, isCollapsed && styles.chevronShut)}
                            />
                            {group.code ? <span className={styles.code}>{group.code}</span> : null}
                            <span className={styles.groupTitle}>{group.title}</span>
                            {group.meta ? <span className={styles.cellSub}>{group.meta}</span> : null}
                            <span className={styles.spacer} />
                            <span className={styles.cellSub}>
                              <span className={styles.mono}>{on}</span> of{" "}
                              <span className={styles.mono}>{group.rows.length}</span> answering
                            </span>
                          </button>
                        </th>
                      </tr>
                    ) : null}
                    {group.rows.map((entry) => (
                      <DirectoryRow
                        key={entry.id}
                        entry={entry}
                        actions={actions}
                        byRole={byRole || tab === "mine"}
                        selected={entry.id === selectedId}
                        highlighted={isHighlighted(entry)}
                        dimmed={dimming && !isHighlighted(entry)}
                        collapsed={isCollapsed && !isHighlighted(entry)}
                      />
                    ))}
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className={styles.empty}>
                Star any line to keep it here. My list stays in this browser and holds contact ids only.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function DirectoryRow({
  entry,
  actions,
  byRole,
  selected,
  highlighted,
  dimmed = false,
  collapsed,
}: {
  entry: DirectoryEntry;
  actions: ContactActions;
  byRole: boolean;
  selected: boolean;
  highlighted: boolean;
  dimmed?: boolean;
  collapsed: boolean;
}) {
  const name = byRole && !isWardRow(entry) && entry.siteCode ? entry.groupTitle : entry.name;
  const sub = byRole
    ? isWardRow(entry)
      ? entry.groupTitle
      : entry.siteCode
        ? SERVICE_META[entry.service].short
        : entry.place
    : isWardRow(entry)
      ? entry.place
      : entry.section === "statewide"
        ? entry.place
        : entry.purpose;
  const number = numberAt(entry, actions.minute);
  return (
    <tr
      data-testid={`ward-on-call-row-${entry.id}`}
      className={cx(styles.row, selected && tableClasses.selected, collapsed && styles.rowCollapsed)}
      aria-selected={selected}
      data-highlighted={highlighted || undefined}
      data-dim={dimmed ? "true" : undefined}
      data-collapsed={collapsed || undefined}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        actions.onPick(entry.id);
      }}
    >
      <td className={styles.starCell}>
        <FavouriteButton entry={entry} actions={actions} />
      </td>
      <td>
        <button type="button" className={styles.roleButton} onClick={() => actions.onPick(entry.id)}>
          <span className={styles.roleCell}>
            <b>
              {byRole ? <ServiceTag service={entry.service} label="" /> : null}
              {name}
            </b>
            <span>{sub}</span>
          </span>
        </button>
      </td>
      <td>
        <NumberCell entry={entry} actions={actions} />
      </td>
      <td>
        <UntilCell entry={entry} actions={actions} />
      </td>
      <td>
        <span className={styles.emailCell}>
          <span className={styles.emailText}>{entry.email ?? ""}</span>
          <span className={styles.rowActions}>
            {number ? (
              <button
                type="button"
                className={styles.iconButton}
                aria-label={`Copy number for ${entry.name}${entry.siteCode ? `, ${entry.siteCode}` : ""}`}
                onClick={() => actions.onCopy(number, "Number copied")}
              >
                <Icon icon={Copy} size={14} />
              </button>
            ) : null}
            {entry.email ? (
              <button
                type="button"
                className={styles.iconButton}
                aria-label={`Copy email for ${entry.name}${entry.siteCode ? `, ${entry.siteCode}` : ""}`}
                onClick={() => actions.onCopy(entry.email!, "Email copied")}
              >
                <Icon icon={Mail} size={14} />
              </button>
            ) : null}
          </span>
        </span>
      </td>
    </tr>
  );
}

/** Key lines and My list with every number and its hours, to copy out before a planned outage. */
function DowntimeCard({
  open,
  onClose,
  entries,
  onCopy,
  notice,
}: {
  open: boolean;
  onClose: () => void;
  entries: DirectoryEntry[];
  onCopy: (text: string, label: string) => void;
  notice: ReactNode;
}) {
  const rows = entries.flatMap((entry) =>
    (entry.lines.length
      ? entry.lines
      : [{ label: "Referral email", number: entry.email, window: entry.emailWindow }]
    ).map((item, index) => ({ entry, item, first: index === 0 })),
  );
  const text = entries
    .map(
      (entry) =>
        `${entry.name} (${entry.siteCode ?? SERVICE_META[entry.service].short}): ` +
        (entry.lines.length
          ? entry.lines
              .map((item) => `${item.label} ${item.number ?? "not held"}, ${windowText(item.window)}`)
              .join("; ")
          : `email ${entry.email ?? "not held"}`),
    )
    .join("\n");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Downtime card"
      description="Key lines and My list, every number and its hours. Copy it out before a planned outage."
      testId="ward-on-call-downtime"
      footer={
        <div className={styles.downtimeFoot}>
          {notice}
          <span className={styles.cellSub}>Synthetic records, mock numbers.</span>
          <Button variant="pri" size="sm" icon={Copy} onClick={() => onCopy(text, "Downtime card copied")}>
            Copy as text
          </Button>
        </div>
      }
    >
      <table className={cx(tableClasses.table, styles.downtimeTable)}>
        <thead>
          <tr>
            <th scope="col">Line</th>
            <th scope="col">Number</th>
            <th scope="col">Hours</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ entry, item, first }) => (
            <tr key={`${entry.id}-${item.label}`}>
              <td>
                <span className={styles.roleCell}>
                  <b>{first ? entry.name : ""}</b>
                  <span>
                    {item.label}
                    {first ? `, ${entry.siteCode ?? SERVICE_META[entry.service].short}` : ""}
                  </span>
                </span>
              </td>
              <td className={styles.number}>{item.number ?? "Not held"}</td>
              <td className={styles.mono}>{windowText(item.window)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Sheet>
  );
}
