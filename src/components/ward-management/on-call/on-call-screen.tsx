"use client";

import { areCharacterShortcutsEnabled } from "@/components/ward-management/shell/ward-character-shortcuts";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { Fragment, type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Copy,
  Mail,
  MapPin,
  Ellipsis,
  Printer,
  Star,
  Users,
} from "lucide-react";
import { MINUTES_PER_DAY, dayOf, formatInstant, minuteOfDay } from "@/components/ward-management/ward-clock";
import { usePageLive } from "@/components/ward-management/ward-page-live";
import { useOptionalWardFlowSelect, useWardNetwork } from "@/components/ward-management/ward-flow-provider";
import { withRecordedChecks } from "./on-call-checks";
import { useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import {
  Button,
  Card,
  CardFoot,
  FilterChip,
  FolderTabs,
  folderTabClasses,
  Hero,
  HeroAct,
  HeroBand,
  HeroFigures,
  heroChipClassName,
  HeroQuickChips,
  HeroTop,
  Icon,
  LiveChip,
  Menu,
  PhoneFilterFold,
  PillTabs,
  SearchField,
  Sheet,
  SrOnly,
  StatusGlyph,
  cx,
  Drawer,
  tableClasses,
  useIsPhone,
  useIsTabletPortrait,
} from "@/components/wf";
import {
  CHECK_DUE_DAYS,
  KEY_LINE_IDS,
  SERVICE_META,
  availability,
  buildOnCallDirectory,
  entryMatchesQuery,
  hhmm,
  isAnswering,
  keyLineLabel,
  numberAt,
  windowText,
  groupRows,
  type DirectoryEntry,
  type DirectoryService,
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
import { PhoneDirectory, PhoneSheet } from "./on-call-phone";

import { readFavourites, saveFavourites, subscribeFavourites } from "./on-call-favourites";
import titles from "@/components/ward-management/page-top-title.module.css";
import styles from "./on-call.module.css";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { useActionToast } from "@/components/ward-management/use-action-toast";

export type Highlight = "now" | "soon" | "email" | "due";

/** Highlights mark rows and never hide one: a contact you cannot see is a contact you cannot ring. */
const HIGHLIGHTS: { id: Highlight; label: string; test: (entry: DirectoryEntry, minute: number) => boolean }[] = [
  { id: "now", label: "Answering", test: (entry, minute) => isAnswering(entry, minute) },
  {
    id: "soon",
    label: "Ending soon",
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

const JUMP_LABEL: Record<string, string> = {
  "North Metro": "NM",
  "East Metro": "EM",
  "South Metro": "SM",
  CAHS: "CA",
  WACHS: "WA",
  Private: "Pvt",
};

const SECTION_LABEL: Record<DirectorySection, string> = {
  hospitals: "Hospitals",
  community: "Community",
  statewide: "Statewide",
};

// Every word, in any order, and numbers with spaces ignored, as the Tools sheet and header search.
const matchesQuery = entryMatchesQuery;

function rowsForTab(entries: readonly DirectoryEntry[], tab: DirectoryTab, favourites: readonly string[]) {
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
  // Page tops (9 Nov 2026): the Demo pill pauses the board, as on Alerts and Places.
  const live = usePageLive();
  const boardNow = live.now;
  const boardMinute = minuteOfDay(boardNow);
  const isPhone = useIsPhone();
  // Tablet portrait (v10): the directory takes the width and a line opens as a slide-over card.
  const isTabletPortrait = useIsTabletPortrait();
  const [slideId, setSlideId] = useState<string | null>(null);
  // The EMHS demo and surge scenarios swap in their own wards, so the directory follows the scenario.
  const network = useWardNetwork();
  const baseEntries = useMemo(() => buildOnCallDirectory(network.sites), [network.sites]);
  // Closing-the-loop (package E): recorded checks replace the synthetic ones, in the same order.
  const directoryChecks = useOptionalWardFlowSelect("directoryChecks")?.directoryChecks;
  // #839: a check's age is counted in whole days, so the list is rebuilt once a day, not on every
  // clock tick. The ids come from the base list (a check never adds or drops an entry), so the
  // favourites subscription below is not torn down and rebuilt each minute either.
  const boardDay = dayOf(boardNow);
  const allEntries = useMemo(
    () => withRecordedChecks(baseEntries, directoryChecks, boardDay * MINUTES_PER_DAY),
    [baseEntries, directoryChecks, boardDay],
  );
  // OC2 mock-up (4 Nov 2026): the page follows the header's service, as every other page does. A
  // chosen service shows its own lines plus the statewide ones; Statewide shows everyone.
  // WF-45: transport officers only need transport/retrieval lines (not the full statewide roster).
  // WF-45 follow-up: a site bed manager is scoped to their own site's lines plus statewide, and
  // keeps its own service's service-wide lines (no site: the service's bed coordinator, consultant
  // and executive on call, the liaison), as the "+ service" heading says (#1470 review). Community
  // teams also carry no site, so the exception is limited to the Hospitals section (#1471 review).
  const scope = useServiceScope();
  const access = useEffectiveWardAccess();
  const siteCode = access.scope.kind === "site" ? access.scope.siteCode : undefined;
  const siteService = siteCode ? network.sites.find((site) => site.code === siteCode)?.service : undefined;
  const entries = useMemo(() => {
    const scoped = scope
      ? allEntries.filter((entry) => entry.service === scope || entry.service === "Statewide")
      : allEntries;
    if (access.role === "officer") {
      return scoped.filter((entry) => entry.group === "Transport and retrieval");
    }
    if (access.role === "bed_manager" && siteCode) {
      return scoped.filter(
        (entry) =>
          entry.service === "Statewide" ||
          entry.siteCode === siteCode ||
          (entry.section === "hospitals" &&
            entry.siteCode === undefined &&
            siteService !== undefined &&
            entry.service === siteService),
      );
    }
    return scoped;
  }, [allEntries, scope, access.role, siteCode, siteService]);
  const ids = useMemo(() => new Set(baseEntries.map((entry) => entry.id)), [baseEntries]);

  // WF-45: an officer's three transport lines all sit in Statewide, so an officer starts there, not
  // on an empty Hospitals tab. Derived until a tab is picked, so a late-arriving role still applies.
  const [pickedTab, setTab] = useState<DirectoryTab | null>(null);
  const tab: DirectoryTab = pickedTab ?? (access.role === "officer" ? "statewide" : "hospitals");
  const [groupBy, setGroupBy] = useState<"place" | "role">("place");
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("nmhs-bfc");
  const [coverAt, setCoverAt] = useState("now");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [favourites, setFavourites] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const [downtimeOpen, setDowntimeOpen] = useState(false);
  const [allLines, setAllLines] = useState(false);
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
      setFavourites(readFavourites(ids));
    });
    // A star set in the Tools sheet's Contacts shows here at once (Tools review, 15 Oct 2026).
    const unsubscribe = subscribeFavourites((next) => {
      favouritesChanged.current = true;
      setFavourites(next.filter((id) => ids.has(id)));
    });
    return () => {
      window.cancelAnimationFrame(frame);
      unsubscribe();
    };
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
      if (!areCharacterShortcutsEnabled() || event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey)
        return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      document.getElementById(searchId)?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPhone, searchId]);

  // Outside a sheet the outcome goes to the shared toast region. A sheet makes the page behind it
  // inert, so while one is open its feedback stays inside the sheet, beside what was copied.
  const pushNotice = useActionToast({ testId: "ward-on-call-notice", tone: "info" });
  const inSheetRef = useRef(false);
  const say = useCallback(
    (text: string, warning = false) => {
      if (!inSheetRef.current) {
        pushNotice(warning ? { warning: text } : text);
        return;
      }
      setNotice(text);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      noticeTimer.current = setTimeout(() => setNotice(""), 4000);
    },
    [pushNotice],
  );

  const copy = useCallback(
    async (text: string, label: string) => {
      try {
        await copyTextToClipboard(text);
        say(label);
      } catch {
        say("Copy is unavailable in this browser. Select the text instead.", true);
      }
    },
    [say],
  );

  function toggleFavourite(id: string) {
    favouritesChanged.current = true;
    const next = favourites.includes(id) ? favourites.filter((value) => value !== id) : [...favourites, id];
    setFavourites(next);
    if (saveFavourites(next)) say(next.includes(id) ? "Added to My list" : "Removed from My list");
    else say("My list is kept for this visit only. Browser storage is unavailable.");
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
    else if (isTabletPortrait) setSlideId(id);
  }

  const actions: ContactActions = {
    minute,
    entries,
    favourites,
    onPick: pick,
    onToggleFavourite: toggleFavourite,
    onCopy: (text, label) => void copy(text, label),
  };

  const answering = entries.filter((entry) => isAnswering(entry, minute));
  const closed = entries.filter((entry) => availability(entry, minute).kind === "off");
  const checkDue = entries.filter((entry) => entry.checkedDaysAgo > CHECK_DUE_DAYS);
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
  // OC2 mock-up: a Show pill filters the rows (it used to only tint them); search still tints.
  const dimming = Boolean(query.trim()) || (isPhone && highlight !== null);
  const isHighlighted = (entry: DirectoryEntry) =>
    matchesQuery(entry, query) ||
    (isPhone && highlight !== null && HIGHLIGHTS.find((item) => item.id === highlight)!.test(entry, minute));
  const showTest = highlight ? HIGHLIGHTS.find((item) => item.id === highlight)!.test : null;

  const selected = entries.find((entry) => entry.id === selectedId) ?? entries[0]!;
  const slideEntry = slideId ? entries.find((entry) => entry.id === slideId) : undefined;
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

  // Page tops (Josh, 9 Nov 2026): one slate top as on Home. Three figures over every list this desk
  // holds, the State bed desk as the act row, Cover at, Copy who is on and Downtime card as chips,
  // and on a desktop one slim row of bed flow key lines.
  const stateDesk = entries.find((entry) => entry.id === "sw-bfc");
  const untilText = (entry: DirectoryEntry) => {
    const now = availability(entry, minute);
    if (now.kind === "on") return now.allDay ? "24 hours" : `until ${hhmm(now.until)}`;
    if (now.kind === "off") return `opens ${hhmm(now.opens)}`;
    return undefined;
  };
  const stateDeskNumber = stateDesk ? numberAt(stateDesk, minute) : undefined;
  const stateDeskUntil = stateDesk ? untilText(stateDesk) : undefined;
  const act = stateDesk ? (
    <HeroAct
      tone="calm"
      testId="ward-on-call-act"
      title={
        <span className={styles.actLine}>
          <span className={styles.actKey}>{keyLineLabel(stateDesk)}</span>
          <span className={styles.actNumber}>{stateDeskNumber ?? "Not recorded"}</span>
          {!isPhone && stateDeskUntil ? <span className={styles.actSoft}>{stateDeskUntil}</span> : null}
        </span>
      }
      action={
        stateDeskNumber
          ? {
              label: "Copy number",
              phoneLabel: "Copy",
              testId: "ward-on-call-act-copy",
              onClick: () => void copy(stateDeskNumber, "Number copied"),
            }
          : undefined
      }
    />
  ) : undefined;

  const coverLabel = COVER_AT.find((item) => item.id === coverAt)?.label ?? "Now";
  const chips = (
    <HeroQuickChips
      label="On-call actions"
      items={[
        {
          id: "cover",
          label: "Cover at",
          node: (
            <Menu
              label="Show cover at"
              items={COVER_AT.map((item) => ({
                id: item.id,
                label: item.label,
                checked: coverAt === item.id,
                checkable: "radio" as const,
                onSelect: () => setCoverAt(item.id),
              }))}
              trigger={(props) => (
                <button
                  {...props}
                  type="button"
                  className={heroChipClassName}
                  data-testid="ward-on-call-cover"
                  aria-label={`Cover at ${coverLabel}`}
                >
                  <Icon icon={Clock} size={16} />
                  <span>
                    Cover at <b className={styles.coverValue}>{coverLabel}</b>
                  </span>
                  <Icon icon={ChevronDown} size={14} />
                </button>
              )}
            />
          ),
        },
        {
          id: "copy",
          label: "Copy who is on",
          icon: <ClipboardList size={16} strokeWidth={1.75} aria-hidden="true" />,
          onClick: copyWhoIsOn,
          testId: "ward-on-call-copy-who",
        },
        {
          id: "downtime",
          label: "Downtime card",
          node: (
            <button
              type="button"
              className={heroChipClassName}
              title="Preview until the Downtime page exists"
              data-testid="ward-on-call-downtime-open"
              onClick={() => setDowntimeOpen(true)}
            >
              <Icon icon={Printer} size={16} />
              <span>Downtime card</span>
            </button>
          ),
        },
      ]}
    />
  );

  // Desktop key lines: the bed flow lines and the crisis line (the State bed desk is the act row).
  // Three show; "All 6 lines" opens the rest in place.
  // OC3 (4 Nov 2026): a chosen service shows its own bed flow, consultant and executive lines.
  const scopeKey = scope ? SERVICE_META[scope].short.toLowerCase() : null;
  const bandLines = (
    scopeKey
      ? [`${scopeKey}-bfc`, `${scopeKey}-scon`, `${scopeKey}-exec`, "sw-mherl"]
      : KEY_LINE_IDS.filter((id) => id !== "sw-bfc")
  )
    .map((id) => entries.find((entry) => entry.id === id))
    .filter((entry): entry is DirectoryEntry => entry !== undefined);
  const bandShown = allLines ? bandLines : bandLines.slice(0, 3);
  const keyName = (entry: DirectoryEntry) =>
    entry.id === "sw-mherl"
      ? "MHERL"
      : entry.kind === "serviceConsultant"
        ? "Consultant"
        : entry.kind === "bedFlow"
          ? scope
            ? "Bed flow"
            : SERVICE_META[entry.service].short
          : entry.name;
  const band =
    isPhone || bandLines.length === 0 ? undefined : (
      <HeroBand
        title="Key lines"
        variant="inline"
        testId="ward-on-call-key-lines"
        aside={
          bandLines.length > 3 ? (
            <button
              type="button"
              className={styles.allLines}
              aria-expanded={allLines}
              onClick={() => setAllLines((open) => !open)}
            >
              {allLines ? "Fewer lines" : `All ${bandLines.length} lines`}
              <Icon icon={allLines ? ChevronDown : ChevronRight} size={14} />
            </button>
          ) : undefined
        }
        cells={bandShown.map((entry) => {
          const number = numberAt(entry, minute);
          const until = untilText(entry);
          return {
            id: entry.id,
            label: keyName(entry),
            // The time sits on the number's line in quiet sans, as the act row's does.
            value: (
              <>
                <span className={styles.keyLineNumber}>{number ?? "Email only"}</span>
                {until ? <span className={styles.keyLineUntil}> {until}</span> : null}
              </>
            ),
            onClick: () => pick(entry.id),
            // The name starts with the cell's visible words (WCAG 2.5.3, label in name).
            ariaLabel: `${keyName(entry)} ${number ?? "Email only"}${until ? ` ${until}` : ""}, ${keyLineLabel(entry)}`,
            testId: `ward-on-call-key-${entry.id}`,
          };
        })}
      />
    );

  // WF-45: a narrowed desk still says whose lines these are.
  const scopeNote =
    access.role === "officer"
      ? "Transport lines"
      : access.role === "bed_manager" && siteCode
        ? // #1471 review: a saved service other than the site's leaves only statewide lines.
          scope && scope !== siteService
          ? `${SERVICE_META[scope].short} selected: statewide only`
          : `${siteCode}${siteService ? ` + ${SERVICE_META[siteService].short}` : ""} + statewide`
        : scope
          ? `${SERVICE_META[scope].short} + statewide`
          : undefined;

  const tabItems = [
    // One set of tab names on every device (device audit 11 Oct 2026; the guide uses the short ones).
    { id: "hospitals" as const, label: "Hospitals", count: tabCounts.hospitals },
    { id: "community" as const, label: "Teams", count: tabCounts.community },
    { id: "statewide" as const, label: "State", count: tabCounts.statewide },
    { id: "mine" as const, label: "Mine", count: tabCounts.mine },
    // Page tops QA (10 Nov 2026): a phone shows three tabs; Mine opens from the More menu beside the
    // search and joins the row only while it is the chosen tab.
  ].filter((item) => !isPhone || item.id !== "mine" || tab === "mine");

  const hero = (
    <div data-testid="ward-on-call-hud-island" className={styles.hudIsland}>
      <Hero
        level={1}
        className={cx(titles.hero, folderTabClasses.hero)}
        // H-0887: the page heading names the page, not only the time.
        title={
          <>
            <SrOnly>On-call:</SrOnly> {atLater ? `Who answers at ${hhmm(minute)}` : "Who to call"}{" "}
            <span className={titles.soft}>{atLater ? (minute < boardMinute ? "tomorrow" : "") : "now"}</span>
          </>
        }
        // F-08 (phone review, Oct 2026): the phone top says the numbers are invented.
        titleMeta={isPhone ? "Prototype data, invented numbers" : scopeNote}
        aside={
          <LiveChip
            state={live.paused ? "paused" : "live"}
            onHero
            age={formatInstant(boardNow)}
            onTogglePause={live.togglePause}
          />
        }
      >
        <HeroTop
          testId="ward-on-call-top"
          figures={
            <HeroFigures
              items={[
                {
                  id: "answering",
                  value: answering.length,
                  label: "answering, all lists",
                  testId: "ward-on-call-figure-answering",
                },
                { id: "closed", value: closed.length, label: "closed", testId: "ward-on-call-figure-closed" },
                {
                  id: "due",
                  value: checkDue.length,
                  label: "check due, all lists",
                  testId: "ward-on-call-figure-due",
                },
              ]}
            />
          }
          act={act}
          chips={chips}
          band={band}
        />
      </Hero>
      {/* Page tops (9 Nov 2026): the directory's tabs are the folder tabs under the top. */}
      <FolderTabs label="Directory views" value={tab} testId="ward-on-call-tabs">
        <PillTabs
          className={folderTabClasses.switch}
          label="Directory"
          items={tabItems}
          value={tab}
          onChange={setTab}
        />
      </FolderTabs>
    </div>
  );

  // D-91: the one page search field. Its spoken name is the full hint; the placeholder names what
  // is searched in words that never cut off. The Matches panel and the hit count say how many match.
  const search = (
    <SearchField
      id={searchId}
      label="Search by role, hospital, ward, team or number"
      placeholder="Role, place or number"
      value={query}
      onValueChange={setQuery}
      // Page tops (9 Nov 2026): the header search already shows "/", so this field shows no second
      // hint. The "/" key still lands here on a desktop.
      className={styles.search}
    />
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

  // Phone: every Show highlight sits in the Filter fold, uncounted (page tops, 9 Nov 2026: the hero
  // figures no longer press to highlight).
  const phoneHighlightChips = HIGHLIGHTS.map((item) => (
    <FilterChip
      key={item.id}
      pressed={highlight === item.id}
      onPressedChange={() => toggleHighlight(item.id)}
      className={styles.chip}
    >
      {item.id === "email" ? (
        <Icon icon={Mail} size={16} />
      ) : (
        <StatusGlyph tone={item.id === "now" ? "success" : "warning"} size={9} />
      )}
      {item.label}
    </FilterChip>
  ));

  // OC2 mock-up: one service index in the toolbar replaces the jump pills repeated on every service row.
  const shownRows = showTest ? tabRows.filter((entry) => showTest(entry, minute)) : tabRows;
  const indexServices = groupRows(entries, shownRows, tab, tab === "hospitals" ? groupBy : "place")
    .map((block) => block.service)
    .filter(
      (service): service is Exclude<DirectoryService, "Statewide"> => service !== null && service !== "Statewide",
    );
  const serviceIndex =
    tab !== "mine" && indexServices.length > 1 ? (
      <span className={styles.jump} role="group" aria-label="Jump to service">
        {indexServices.map((service) => (
          <button
            key={service}
            type="button"
            className={styles.jumpButton}
            // CB-3: the name carries the visible short form (axe label-content-name-mismatch).
            aria-label={`Jump to ${SERVICE_META[service].name}, ${JUMP_LABEL[service]}`}
            onClick={() =>
              document
                .getElementById(`ward-on-call-svc-${SERVICE_META[service].tone}`)
                ?.scrollIntoView({ block: "start", behavior: wardScrollBehavior() })
            }
          >
            <ServiceTag service={service} label={JUMP_LABEL[service]} />
          </button>
        ))}
      </span>
    ) : null;

  const groupByChip =
    tab === "hospitals" ? (
      <FilterChip
        pressed={groupBy === "role"}
        onPressedChange={(on) => setGroupBy(on ? "role" : "place")}
        className={styles.chip}
      >
        <Icon icon={isPhone || groupBy === "role" ? Users : MapPin} size={isPhone ? 16 : 14} />
        By role
      </FilterChip>
    ) : null;

  // A sheet makes the page behind it inert, so while one is open its feedback shows inside it.
  const sheetOpen = downtimeOpen || Boolean(isPhone && sheetEntry);
  useEffect(() => {
    inSheetRef.current = sheetOpen;
  }, [sheetOpen]);
  const sheetNotice = sheetOpen ? (
    <p className={styles.sheetNotice} role="status" data-testid="ward-on-call-notice">
      {notice}
    </p>
  ) : null;

  const downtimeCard = (
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
  );

  if (isPhone) {
    return (
      <div className={styles.screen} data-testid="ward-on-call-screen" data-ward-design="v8">
        <main id="main-content" className={styles.main}>
          {hero}
          <div className={styles.phoneTools}>
            {/* Device audit 11 Oct 2026: search is the main tool here, so Copy and Downtime sit in a
                menu beside it rather than as two large buttons above it. */}
            <div className={styles.phoneSearchRow}>
              {search}
              {/* Josh review (4 Nov 2026): By role, Answering and Has email fold into one Filter
                  button on the search line, so the directory starts a row higher. */}
              <PhoneFilterFold
                count={(groupBy === "role" && tab === "hospitals" ? 1 : 0) + (highlight !== null ? 1 : 0)}
                title="Show"
                description="Highlights never hide a line."
                data-testid="ward-on-call-filter-fold"
              >
                <div className={styles.phoneChips}>
                  {groupByChip}
                  {phoneHighlightChips}
                </div>
              </PhoneFilterFold>
              <Menu
                label="On-call tools"
                align="end"
                items={[
                  {
                    id: "mine",
                    label: "Mine",
                    icon: Star,
                    meta: tabCounts.mine,
                    onSelect: () => setTab("mine"),
                  },
                  { id: "copy", label: "Copy who is on", icon: Copy, onSelect: copyWhoIsOn },
                  { id: "downtime", label: "Downtime card", icon: Printer, onSelect: () => setDowntimeOpen(true) },
                ]}
                trigger={(props) => (
                  <button
                    {...props}
                    type="button"
                    className={styles.phoneMoreButton}
                    aria-label="More on-call tools"
                    data-testid="ward-on-call-phone-more"
                  >
                    <Icon icon={Ellipsis} size={20} />
                  </button>
                )}
              />
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
        </main>
        {sheetEntry ? (
          <PhoneSheet entry={sheetEntry} actions={actions} notice={sheetNotice} onClose={() => setSheetId(null)} />
        ) : null}
        {downtimeCard}
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
              <span className={styles.spacer} />
              {search}
            </div>
            <div className={styles.dirHead2} role="group" aria-label="Show and group rows">
              <span className={styles.chipScope}>Show</span>
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
                  Show all
                </Button>
              ) : null}
              <span className={styles.spacer} />
              {serviceIndex}
              {groupByChip}
            </div>
            <DirectoryTable
              entries={entries}
              rows={shownRows}
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
              className={styles.dirFoot}
              meta={
                <span className={styles.footMeta} data-testid="ward-on-call-count">
                  {tabRows.length} {tabRows.length === 1 ? "contact" : "contacts"} in this tab, {entries.length} in
                  scope ({answering.length} answering).{" "}
                  {atLater ? `Shown as at ${hhmm(minute)}.` : `Shown as at ${hhmm(boardMinute)}, the board time.`}
                </span>
              }
            >
              {/* Wraps rather than cutting mid-sentence (device audit 11 Oct 2026). */}
              <span className={styles.disclosure}>
                <StatusGlyph tone="warning" size={9} />
                <span className={styles.disclosureText}>
                  Synthetic records. Every number is a mock from an unassigned range and every email uses a reserved
                  domain. {checkDue.length} {checkDue.length === 1 ? "record is" : "records are"} over {CHECK_DUE_DAYS}{" "}
                  days since their last check.
                </span>
              </span>
            </CardFoot>
          </Card>

          {isTabletPortrait && !(queryHits.length || query.trim()) ? null : (
            <Card
              className={styles.panel}
              aria-labelledby={panelHeadingId}
              data-testid="ward-on-call-role-panel"
              data-wf-rail
            >
              {queryHits.length || query.trim() ? (
                <MatchesPanel
                  query={query}
                  hits={queryHits}
                  actions={actions}
                  onClear={() => setQuery("")}
                  headingId={panelHeadingId}
                />
              ) : (
                <ContactCard entry={selected} actions={actions} headingId={panelHeadingId} />
              )}
            </Card>
          )}
        </div>
        {isTabletPortrait && slideEntry ? (
          <Drawer
            open
            onClose={() => setSlideId(null)}
            title={slideEntry.name}
            description={[
              SERVICE_META[slideEntry.service].name,
              slideEntry.place === SERVICE_META[slideEntry.service].short ? null : placeOf(slideEntry),
            ]
              .filter(Boolean)
              .join(", ")}
            testId="ward-on-call-line-sheet"
          >
            {/* OC1: the drawer title already names the contact, so the card drops its own head. */}
            <ContactCard entry={slideEntry} actions={actions} showHead={false} showStar />
          </Drawer>
        ) : null}
        <WardPrototypeFooter
          testId="ward-on-call-governance"
          note="Not approved for clinical use. Synthetic records, mock numbers."
        />
      </main>
      {downtimeCard}
    </div>
  );
}

/** The side panel lists this many matches at most. */
const MATCHES_SHOWN = 30;

function MatchesPanel({
  query,
  hits,
  actions,
  onClear,
  headingId,
}: {
  query: string;
  hits: DirectoryEntry[];
  actions: ContactActions;
  onClear: () => void;
  /** Names the side panel, which is labelled by this heading (review finding 15, 12 Nov 2026). */
  headingId?: string;
}) {
  const shown = hits.slice(0, MATCHES_SHOWN);
  return (
    <>
      <div className={styles.cardHead}>
        <div className={styles.cardWho}>
          <h2 className={styles.cardTitle} id={headingId}>
            Matches
          </h2>
          <span className={styles.cardPlace}>For &ldquo;{query.trim()}&rdquo;</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>
      {hits.length ? (
        <ul className={styles.matches}>
          {shown.map((entry) => (
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
      {/* Review finding 15: the list stops at MATCHES_SHOWN, so it says so, politely, when it does. */}
      <p
        className={hits.length > shown.length ? styles.note : "sr-only"}
        aria-live="polite"
        data-testid="ward-on-call-matches-truncated"
      >
        {hits.length > shown.length
          ? `Showing ${shown.length} of ${hits.length} synthetic entries. Refine the search.`
          : null}
      </p>
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
  return (
    <div className={styles.tableScroll} ref={scroller}>
      <table className={cx(tableClasses.table, styles.dirTable)} data-testid="ward-on-call-dir-table">
        <colgroup>
          <col className={styles.colStar} />
          <col className={styles.colRole} />
          <col className={styles.colNumber} />
          <col />
          <col className={styles.colActions} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">
              <SrOnly>My list</SrOnly>
            </th>
            <th scope="col">Role and place</th>
            <th scope="col">Number</th>
            <th scope="col">Available</th>
            {/* Device audit 11 Oct 2026: the email column was empty on most rows and cut where present;
                the contact card shows the full address, and the row keeps its copy buttons. */}
            <th scope="col">
              <SrOnly>Copy</SrOnly>
            </th>
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
                Star any line to keep it here.
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
              <span className={styles.truncate}>{name}</span>
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
              .map((item) => `${item.label} ${item.number ?? "not recorded"}, ${windowText(item.window)}`)
              .join("; ")
          : `email ${entry.email ?? "not recorded"}`),
    )
    .join("\n");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Downtime card"
      description="Key lines and My list, with their hours."
      testId="ward-on-call-downtime"
      footer={
        <div className={styles.downtimeFoot}>
          {notice}
          <span className={styles.cellSub}>Synthetic records and numbers.</span>
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
              <td className={styles.number}>{item.number ?? "Not recorded"}</td>
              <td className={styles.mono}>{windowText(item.window)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Sheet>
  );
}
