"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart2, Search, Star } from "lucide-react";

import { useWardFlow, useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import {
  groupedResults,
  hubCounts,
  hubEntries,
  needsAttention,
  networkBeds,
  readyByService,
  searchHub,
  unauthorisedWards,
  type HubEntry,
  type HubKind,
} from "@/components/ward-management/hub/hub-derivations";
import {
  formatElapsed,
  formatInstant,
  formatInstantWithDay,
  splitDuration,
} from "@/components/ward-management/ward-clock";
import { edStatisticsHref, wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";

import {
  recordHubVisit,
  toggleHubPin,
  useRecentHubIds,
  usePinnedHubIds,
} from "@/components/ward-management/hub/hub-browser-memory";
import { hubReconciliationLine } from "@/components/ward-management/hub/hub-provenance";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";
import { WardTable } from "@/components/ward-management/ward-table/ward-table";

import styles from "./hub.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

/**
 * THE MASTER SEARCH HUB — one place to reach every ward, emergency department and community team.
 *
 * Built from the owner-approved mockup (`scratchpad/fix-hub/fixhub_master_search.html`), which he
 * chose over two alternatives and then had refined twice: search dominant at two-thirds, the glance
 * pane compact at one-third, and high-yield figures only.
 *
 * ⚠️ **EVERY FIGURE ON THIS SCREEN IS DERIVED, NEVER COMPUTED HERE.** `hub-derivations.ts` owns the
 * arithmetic and the clinical rules; this file renders what it returns. That split is the reason a
 * second copy of "how ready beds are counted" cannot grow in a component — the failure this
 * repository has already had once, when `capacityBreakdown` copied `unitCapacity`'s arithmetic by
 * hand and nothing compared the two until `ward-capacity-derivation-agreement.test.ts` was written.
 */

const TABS: readonly { id: HubKind | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ward", label: "Wards" },
  { id: "ed", label: "EDs" },
  { id: "community", label: "Community" },
];

/**
 * ⚠️ **READY AND NOT-YET-CLEARED ARE TWO NUMBERS AND THIS IS THE ONE PLACE THAT RENDERS THEM.**
 *
 * Owner ruling, 2026-09-05: a bed can be free per the feed and still be being made ready, and the
 * reducer refuses `PULL_PATIENT` into one. The ruling was explicitly **not** to reduce Ready — an
 * earlier ruling of his avoids the figure lurching as cleaning starts and stops — so the qualifier
 * sits BESIDE it and is never subtracted from it.
 *
 * **Never collapse these into one figure**, and never show only the larger. A screen showing the
 * physically-empty total alone tells a coordinator they can admit into beds the system will then
 * refuse. `tests/ward-hub-screen.dom.test.tsx` pins this against Mental Health Unit specifically,
 * because its two figures differ (2 and 3) — a ward whose figures happened to be equal would pass
 * a "shows two numbers" assertion even against a screen that collapsed them.
 */
function capacityLine(entry: HubEntry): string {
  if (entry.ready === undefined) return "Bed numbers not reported";
  const ready = `${entry.ready} ready`;
  if (entry.pendingPreparation === undefined || entry.pendingPreparation === 0) return ready;
  return `${ready} · ${entry.pendingPreparation} still being made ready`;
}

/**
 * One result row's right-hand cell. Wards carry beds; the other two kinds carry what they are.
 *
 * ⚠️ **NOT `entry.service`, WHICH IS ALREADY IN THE ROW'S SUBTITLE.** It read as a second fact and
 * was the same one: an ED row printed "Peel Health Campus · South Metro" and then "South Metro"
 * again, and a community row printed its region twice. In a list a coordinator scans down, a
 * repeated word costs more than a blank — it looks like a column that means something.
 *
 * ⚠️ **AND THE KIND IS NO LONGER SPELLED OUT HERE AT ALL.** It moved to a badge at the start of the
 * row, which is where the mockup puts it and where it costs no horizontal space that a bed figure
 * wants. A non-ward row's right-hand cell is now deliberately empty: there is no second fact about
 * an emergency department that belongs in a scan column, and inventing one to fill the space is how
 * a screen grows a number nobody asked for.
 */
function resultStat(entry: HubEntry): string {
  return entry.kind === "ward" ? capacityLine(entry) : "";
}

/**
 * A segment's share of the bar, as a CSS width.
 *
 * ⚠️ **A ZERO-BED NETWORK RETURNS 0%, NOT NaN%.** `beds` is a real figure that can in principle
 * be zero — a fixture with no wards, or every ward filtered out of a future variant — and
 * `0/0` in a template literal renders the string "NaN%", which a browser silently discards, leaving
 * a bar that looks deliberately empty rather than broken. The guard is one comparison and it is the
 * difference between a wrong picture and no picture.
 */
function barWidth(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.max(0, Math.min(100, (part / total) * 100))}%`;
}

/** The long form, for the detail header where there is room and the abbreviation would be curt. */
const KIND_WORD_LONG: Record<HubKind, string> = {
  ward: "Ward",
  ed: "Emergency department",
  community: "Community team",
};

/**
 * ⚠️ **COLOUR IS NEVER THE ONLY SIGNAL.** The badge is tinted per kind AND spells the word, so it
 * survives a reader who cannot distinguish the three tints, a forced-colors palette that discards
 * them, and a screen reader that renders none of them.
 */
function kindBadgeClass(kind: HubKind): string {
  if (kind === "ward") return styles.kindBadgeWard;
  if (kind === "ed") return styles.kindBadgeEd;
  return styles.kindBadgeCommunity;
}

export function HubScreen() {
  usePrintableDisclosures();
  const { units, bedReleases, admissions, leaveBeds } = useWardFlow();
  const now = useWardFlowClock();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<HubKind | "all">("all");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleGlobalKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "/" && document.activeElement !== inputRef.current) {
        const target = event.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();
        if (tagName !== "input" && tagName !== "textarea" && tagName !== "select" && !target?.isContentEditable) {
          event.preventDefault();
          inputRef.current?.focus();
        }
      } else if (event.key === "Escape" && document.activeElement !== inputRef.current) {
        if (selectedId !== undefined || query !== "") {
          event.preventDefault();
          setQuery("");
          setSelectedId(undefined);
          inputRef.current?.focus();
        }
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [selectedId, query]);

  const entries = useMemo(
    () => hubEntries({ units, bedReleases, admissions, leaveBeds, now }),
    [units, bedReleases, admissions, leaveBeds, now],
  );
  const results = useMemo(() => searchHub(entries, query, kind), [entries, query, kind]);
  const counts = useMemo(() => hubCounts(entries, query), [entries, query]);
  /**
   * 🔴 **THE UNFILTERED TOTALS, AND THEY ARE A DIFFERENT NUMBER FROM `counts` ON PURPOSE.**
   *
   * `counts` answers "how many of this kind does the current query match", which is what belongs on
   * a filter tab. The disclosure panel at the foot of the page is making a claim about the NETWORK
   * — "the 23 wards ... come from this project's ward records" — and that sentence must not become
   * "the 2 wards" because somebody typed "fremantle". Same function, empty query: one matcher, two
   * questions, and the difference is stated here rather than left for a reader to notice on screen.
   */
  const totals = useMemo(() => hubCounts(entries, ""), [entries]);
  const byService = useMemo(() => readyByService(entries), [entries]);
  const attention = useMemo(() => needsAttention(entries), [entries]);
  const network = useMemo(() => networkBeds(entries), [entries]);
  const unauthorised = useMemo(() => unauthorisedWards(entries), [entries]);
  const sections = useMemo(() => groupedResults(results), [results]);

  const pinnedIds = usePinnedHubIds();
  const recentIds = useRecentHubIds();

  /**
   * ⚠️ **BOTH LISTS ARE RESOLVED AGAINST THE LIVE ENTRIES, NEVER RENDERED FROM THE STORED IDS.**
   * A stored id is a name for something that may since have gone: a ward retired from the fixture,
   * a region renamed. Mapping through `entries` and dropping what no longer resolves means a stale
   * pin disappears quietly, where rendering the id would put a dead row on a clinical screen that
   * looks exactly like a live one. `flatMap` rather than `map(...).filter(...)` so the undefined
   * case cannot leak into the array's type and get `!`-asserted later.
   */
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const pinned = useMemo(() => pinnedIds.flatMap((id) => byId.get(id) ?? []), [pinnedIds, byId]);
  const recent = useMemo(() => recentIds.flatMap((id) => byId.get(id) ?? []), [recentIds, byId]);
  const isPinned = (id: string) => pinnedIds.includes(id);

  const selected = results.find((entry) => entry.id === selectedId) ?? undefined;

  /**
   * ⚠️ **A ROW CAN ONLY BE SELECTED IF IT IS IN `results`**, which is why `selected` is looked up
   * there rather than in `entries`. A selection that survived a narrowing query would leave the
   * preview describing a ward the coordinator can no longer see or click back to — a screen
   * talking about something that is not on it.
   */
  function select(id: string) {
    setSelectedId(id);
  }

  /**
   * Arrow keys from the search box walk the results and preview each one as it is reached; Enter
   * opens the previewed row; Escape clears the query.
   *
   * ⚠️ **IT MOVES THE SELECTION, NOT A SEPARATE “highlight”.** A second piece of state for
   * "which row is focused" would be a second answer to "which ward is this screen describing", and
   * the two would disagree the first time one was updated without the other. There is one cursor
   * here and the preview pane IS its readout — which also means an arrow-key user and a mouse user
   * are looking at the same screen, rather than two modes that drift.
   *
   * ⚠️ **`results` IS THE LIST IT WALKS**, not `entries`, so the cursor can never leave what is
   * on screen. Wrapping is deliberate at both ends: at 41 rows, the alternative is a key that
   * silently does nothing at the boundary, which reads as the screen having frozen.
   */
  function onSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setQuery("");
      setSelectedId(undefined);
      return;
    }
    if (event.key === "Enter") {
      const target = results.find((entry) => entry.id === selectedId);
      if (target !== undefined) router.push(target.href);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (results.length === 0) return;
    event.preventDefault();
    const current = results.findIndex((entry) => entry.id === selectedId);
    const step = event.key === "ArrowDown" ? 1 : -1;
    // From nothing selected, Down starts at the first row and Up at the last.
    const next =
      current === -1 ? (step === 1 ? 0 : results.length - 1) : (current + step + results.length) % results.length;
    setSelectedId(results[next]?.id);
  }

  /**
   * Left/Right (and Home/End) move between the kind filters, which is what `role="tablist"`
   * promises and what four separate tab stops were failing to deliver.
   *
   * ⚠️ **IT SELECTS AS IT MOVES, AND THAT IS THE RIGHT CHOICE HERE, NOT AN OVERSIGHT.** The ARIA
   * pattern permits either; the deciding fact is cost. Moving to a filter shows a different list
   * instantly and costs nothing to undo — no request, no navigation, nothing lost — so requiring a
   * second keypress to confirm would make the keyboard slower than the mouse for no protection.
   * Focus follows the selection so the new tab is where the next arrow key starts from.
   */
  function onTabsKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const order = TABS.map((tab) => tab.id);
    const current = order.indexOf(kind);
    let next = -1;
    if (event.key === "ArrowRight") next = (current + 1) % order.length;
    if (event.key === "ArrowLeft") next = (current - 1 + order.length) % order.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = order.length - 1;
    if (next === -1) return;
    event.preventDefault();
    const target = order[next];
    if (target === undefined) return;
    setKind(target);
    setSelectedId(undefined);
    // Focus follows selection, so the next arrow key continues from where the user just landed
    // rather than from the tab they left behind.
    const el = event.currentTarget.querySelector<HTMLButtonElement>(`[data-kind-tab="${target}"]`);
    el?.focus();
  }

  /** Jump from the attention list to that ward's preview. Clearing the query and the kind filter
   *  is not tidiness: if either excludes the ward, the click would select something the preview
   *  then refuses to show, and the row would read as broken. */
  function reveal(id: string) {
    setQuery("");
    setKind("all");
    setSelectedId(id);
  }

  return (
    <div className={styles.screen} data-testid="ward-hub-page" data-ward-design="third-edition">
      <main id="main-content" className={styles.main}>
        <header className={styles.pageHeader}>
          {/*
            Wave 4 item 14 / owner Q-3: this screen stays "Search hub" — the place directory.
            Command (`/mockups/ward-flow`) is the job board. An earlier "Start of shift" job strip
            made this page read as a second dashboard; the served drawing has no such strip.
          */}
          <h1 className={styles.pageTitle}>Search hub</h1>
        </header>

        <div className={styles.hubShell}>
          <section className={styles.hubLeft} aria-label="Search results">
            <div className={styles.panelHeader}>
              <div>
                <h2>The network</h2>
              </div>
              <span className={styles.groupCount}>
                {results.length} of {counts.all}
              </span>
            </div>
            <div className={styles.searchBar}>
              <div className={styles.searchInputWrap}>
                <Search className={styles.searchGlyph} aria-hidden="true" />
                {/*
                  🔴 **THIS DECLARED `role="combobox"` WITH `aria-expanded="true"` HARD-CODED, AND THE
                  CLAIM WAS FALSE.** A combobox promises a controlled popup of options, arrow keys
                  that move through them, and an expanded state that means something. This screen
                  had none of it: `aria-controls` pointed at a plain list with no `option` roles,
                  `aria-expanded` never changed, and there was no key handler at all. A screen
                  reader announced a widget the screen did not implement — **worse than no ARIA,
                  because it tells a blind user to press keys that do nothing.**

                  Two honest ways out: implement the pattern, or stop claiming it. BOTH are taken
                  here, split by what each is for. The role is dropped, because this is a filter box
                  over a permanently visible list, not a picker — `type="search"` says what it
                  actually is. And the arrow keys are implemented anyway, because the mockup's own
                  script has them and they are the fastest way through 41 rows; they are simply not
                  announced as something they are not.
                */}
                <input
                  ref={inputRef}
                  id="hub-search-query"
                  name="query"
                  className={styles.searchInput}
                  type="search"
                  aria-label="Search wards, EDs and community teams"
                  aria-describedby="hub-search-hint"
                  placeholder="Search wards, EDs, community teams…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onSearchKeyDown}
                />
                {query === "" ? null : (
                  <button
                    type="button"
                    className={styles.clearButton}
                    aria-label="Clear search"
                    onClick={() => {
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Announced through `aria-describedby`, and readable by everyone else. A keyboard
                  affordance nobody is told about is one nobody uses. */}
              <p className={styles.searchHint} id="hub-search-hint">
                {/* ⚠️ "and the preview" is not padding. Escape has always cleared BOTH, and it is
                    the only way back to the pinned and recently-opened lists once something is
                    selected — a reader told it clears "the search" has no reason to press it while
                    looking at a ward, which is exactly when they need it. */}
                ↑ ↓ Preview · Enter Open · Escape Clear search and preview
              </p>

              {/*
                ⚠️ **`role="tablist"` IS A PROMISE ABOUT KEYS, NOT A LABEL.** It tells assistive
                technology that these four are ONE stop in the tab order and that arrow keys move
                between them. Without `tabIndex` management and an arrow handler that was false: all
                four sat in the tab order individually, and arrow keys did nothing. Implemented here
                rather than dropping the role, because the role is the right one — four mutually
                exclusive filters over one list is exactly what a tablist is for, and the existing
                tests pin it.
              */}
              <div className={styles.kindTabsWrap}>
                <div className={styles.kindTabs} role="tablist" aria-label="Filter by kind" onKeyDown={onTabsKeyDown}>
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={kind === tab.id}
                      // The roving half: only the selected tab is reachable by Tab, and arrows move
                      // between them. Four separate tab stops for one control is what this replaces.
                      tabIndex={kind === tab.id ? 0 : -1}
                      data-kind-tab={tab.id}
                      className={kind === tab.id ? styles.kindTabActive : styles.kindTab}
                      onClick={() => {
                        setKind(tab.id);
                        // ⚠️ Clearing the selection is not tidiness. The preview pane reads from
                        // `results`, so a selection that the new filter excludes would leave the
                        // pane showing a ward the list no longer contains — a screen describing
                        // something a coordinator can no longer see or click back to.
                        setSelectedId(undefined);
                      }}
                    >
                      {tab.label} <span className={styles.tabCount}>{counts[tab.id]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/*
              ⚠️ **A SECTION IS NOT A LIST ITEM, AND MAKING IT ONE WAS A REAL DEFECT.** The first
              grouped version nested each section inside an `<li>` of an outer `<ul>`, with the
              sub-group headings as `<li>`s too. That is valid HTML and it silently broke a guard:
              `getAllByRole("listitem")` in this region returned 20 where 16 rows were showing,
              because four headings counted as rows. Anything counting rows got the wrong number for
              the same reason — a test, and a screen reader announcing "list, 20 items".

              So the scroller is a plain container, each section is a real `<section>` with a real
              heading, and the only `<li>`s on this screen are result rows.
            */}
            <div className={styles.listScroll} id="hub-results" role="region" aria-label="Network results" tabIndex={0}>
              {results.length === 0 ? (
                <p className={styles.emptyState}>
                  {/* ⚠️ The message names the ACTIVE FILTER, because "nothing matches" is a
                      different fact from "nothing of this kind matches" — and a coordinator who
                      forgot a tab was pressed would otherwise conclude the ward does not exist. */}
                  No{" "}
                  {kind === "all" ? "ward, emergency department or community team" : KIND_WORD_LONG[kind].toLowerCase()}{" "}
                  matches “{query}”. Try a hospital name, a health service such as “WACHS”, or clear the search.
                </p>
              ) : (
                sections.map((section) => (
                  <section key={section.key} aria-label={section.label}>
                    <h2 className={styles.groupHead}>
                      {section.label} <span className={styles.groupCount}>{section.entries.length}</span>
                    </h2>
                    {(section.subgroups.length > 0 ? section.subgroups : [{ label: "", entries: section.entries }]).map(
                      (group) => (
                        <div key={`${section.key}-${group.label}`}>
                          {group.label === "" ? null : <p className={styles.subGroupHead}>{group.label}</p>}
                          <ul className={styles.groupList}>
                            {group.entries.map((entry) => (
                              <li
                                key={entry.id}
                                className={entry.id === selectedId ? styles.resultRowActive : styles.resultRow}
                              >
                                <button
                                  type="button"
                                  className={styles.resultMain}
                                  // ⚠️ `aria-current` is the non-visual half of the selected state. The
                                  // tinted background and accent bar both vanish under forced-colors, and
                                  // neither was ever announced — so which ward the preview described was
                                  // unknowable to a screen-reader or high-contrast user.
                                  aria-current={entry.id === selectedId ? "true" : undefined}
                                  onClick={() => select(entry.id)}
                                >
                                  {/*
                                    ⚠️ **NO KIND BADGE ON THE ROW, AND THE MOCKUP HAS ONE.** A
                                    deliberate departure. The mockup renders a per-row badge AND a
                                    section header naming the kind — invisible there, because its
                                    list was three sample rows long. Against the real fixture it is
                                    23 rows each stamped "WARD" directly under a sticky header
                                    reading "WARDS 23", and that header does not scroll away. Same
                                    repeated-word cost already removed from the right-hand cell,
                                    moved to the left. The badge survives where it still carries
                                    information: the detail header, which has no section above it to
                                    say what you are looking at.
                                  */}
                                  <span className={styles.resultText}>
                                    <span className={styles.resultName}>{entry.name}</span>
                                    <span className={styles.resultSub}>
                                      {[entry.site, entry.service].filter(Boolean).join(" · ")}
                                    </span>
                                  </span>
                                  <span className={entry.stale === true ? styles.resultStatStale : styles.resultStat}>
                                    {resultStat(entry)}
                                    {/* The word, not only the colour — a stale reading must survive a
                                    reader who cannot see the difference between the two styles. */}
                                    {entry.stale === true ? <span className={styles.flagPill}>stale</span> : null}
                                  </span>
                                </button>
                                {/*
                              ⚠️ **A SIBLING OF THE ROW BUTTON, NOT A CHILD OF IT.** The whole row is a
                              `<button>` — that is the fix for a dead click on the bed figure — and a
                              button inside a button is invalid HTML that browsers resolve by
                              dropping one of them, unpredictably. So the star sits beside it and
                              the row button takes the remaining width.
                            */}
                                <button
                                  type="button"
                                  className={isPinned(entry.id) ? styles.pinButtonOn : styles.pinButton}
                                  aria-pressed={isPinned(entry.id)}
                                  aria-label={`${isPinned(entry.id) ? "Unpin" : "Pin"} ${entry.name}`}
                                  onClick={() => toggleHubPin(entry.id)}
                                >
                                  {/* Optical SVG star replacing unicode emojis/glyphs */}
                                  <Star
                                    className={isPinned(entry.id) ? styles.pinIconPinned : styles.pinIcon}
                                    size={15}
                                    aria-hidden="true"
                                  />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ),
                    )}
                  </section>
                ))
              )}
            </div>
          </section>

          <aside className={styles.hubRight} aria-label="At a glance">
            {selected === undefined ? (
              <>
                <div className={styles.detailHead}>
                  <h2 className={styles.detailTitle}>At a glance</h2>
                  {/*
                    🔴 **`totals`, NOT `counts`, AND THIS IS THE THIRD TIME THE SAME MISTAKE HAS
                    APPEARED ON THIS SCREEN.** It read `counts`, which is query-filtered, so a search
                    for "fremantle" made this line say "2 wards, 0 EDs, 0 community teams" — three
                    lines above a section headed "Beds, network-wide" reading "303 beds across 23
                    wards". One pane, two answers to how many wards exist, neither labelled.

                    ⚠️ **THE RULE IS THE SCOPE OF THE PANE, NOT THE PREFERENCE OF THE LINE.**
                    Everything else in this pane — needs attention, ready beds by service, worth
                    knowing, the network bar — is computed over every entry regardless of the query.
                    A subtitle heading them must be too. The filtered figures have exactly one
                    correct home on this screen, which is the tabs, because a number on a control
                    states what pressing it gives you.
                  */}
                  <p className={styles.detailSub}>
                    {totals.ward} wards, {totals.ed} EDs, {totals.community} community teams.
                  </p>
                </div>

                <div className={styles.overviewBody} role="region" aria-label="Network overview" tabIndex={0}>
                  <div className={styles.quickActionsSection}>
                    <span className={styles.quickActionsLabel}>Quick Jump</span>
                    <div className={styles.quickActionsChips}>
                      <button
                        type="button"
                        className={styles.quickChip}
                        onClick={() => {
                          setKind("ward");
                          setQuery("");
                          setSelectedId(undefined);
                        }}
                      >
                        ⚡ Wards
                      </button>
                      <button
                        type="button"
                        className={styles.quickChip}
                        onClick={() => {
                          setKind("ed");
                          setQuery("");
                          setSelectedId(undefined);
                        }}
                      >
                        🏥 Emergency Depts
                      </button>
                      <button
                        type="button"
                        className={styles.quickChip}
                        onClick={() => {
                          setKind("community");
                          setQuery("");
                          setSelectedId(undefined);
                        }}
                      >
                        👥 Community Teams
                      </button>
                    </div>
                  </div>
                  {/*
                    ⚠️ **THE FOUR RULED BOXES (`ward-bed-states.ts`), ONE LEVEL ABOVE THE WARD
                    PANEL.** Ready · Pulled · Closed · Occupied add up to the network's beds, but
                    Ready + Closed is the physically-empty total, which reads as availability and is
                    not: the reducer refuses `PULL_PATIENT` into Closed, so the screen never prints
                    that sum. The bar draws Ready, Pulled and Closed as proportions of the network's
                    size; the rest of the bar is Occupied. The legend names each in words — a bar
                    segment a reader cannot name is decoration.
                  */}
                  {/*
                    ⚠️ **PINNED AND RECENTLY OPENED LIVE HERE, AND THE MOCKUP PUT "RECENTLY VIEWED"
                    IN THE RESULT LIST.** A deliberate departure. The mockup's list was three sample
                    rows; against the real fixture the list is 41 rows already grouped under sticky
                    headers, and a fourth section competing with "WARDS 23" muddles the one column
                    whose job is answering the search. **It would also put the same ward on screen
                    twice under two different headings** — the shape a coordinator reads as two
                    wards. This pane is the quick-access side by construction, so both belong here.

                    Both render nothing at all until used, which is why the screen looks unchanged
                    on a fresh browser and why every existing test still sees exactly one row per
                    place.
                  */}
                  <div className={styles.detailSection}>
                    <h3>Beds, network-wide</h3>
                    <div className={styles.capacityGrid}>
                      <div className={styles.capacityCell}>
                        <span className={styles.capacityLbl}>Ready to admit now</span>
                        <span className={styles.capacityNum}>{network.ready}</span>
                      </div>
                      <div className={styles.capacityCell}>
                        <span className={styles.capacityLbl}>{BED_STATE_LABELS.pulled}</span>
                        <span className={styles.capacityNum}>{network.pulled}</span>
                      </div>
                      <div className={styles.capacityCell}>
                        <span className={styles.capacityLbl}>{BED_STATE_LABELS.closed}, not offered</span>
                        <span className={styles.capacityNum}>{network.closed}</span>
                      </div>
                      <div className={styles.capacityCell}>
                        <span className={styles.capacityLbl}>{BED_STATE_LABELS.occupied}</span>
                        <span className={styles.capacityNum}>{network.occupied}</span>
                      </div>
                    </div>
                    {/*
                      ⚠️ **ONE `style` ATTRIBUTE, NOT ONE PER SEGMENT, AND THAT IS NOT A STYLE PREFERENCE.**
                      `check:design-drift-ratchet` caps inline `style` attributes repository-wide at
                      232 and the repository stands at 230; three separate ones would have broken the
                      build. Custom properties carry the widths and the stylesheet consumes them, so
                      the proportions stay dynamic at the cost of a single attribute.

                      `aria-hidden` because every figure the bar draws is stated as a number in the
                      cells above and named again in the legend below — a screen reader announcing
                      unlabelled proportions would be repeating, worse, what it already read.
                    */}
                    <div
                      className={styles.capacityBar}
                      aria-hidden="true"
                      style={
                        {
                          "--bar-ready": barWidth(network.ready, network.beds),
                          "--bar-pulled": barWidth(network.pulled, network.beds),
                          "--bar-not-yet": barWidth(network.closed, network.beds),
                        } as CSSProperties
                      }
                    >
                      <span className={styles.barReady} />
                      <span className={styles.barPulled} />
                      <span className={styles.barNotYet} />
                    </div>
                    <p className={styles.barLegend}>
                      <span className={styles.legendItem}>
                        <span className={`${styles.legendSwatch} ${styles.barReady}`} /> Ready {network.ready}
                      </span>
                      <span className={styles.legendItem}>
                        <span className={`${styles.legendSwatch} ${styles.barPulled}`} /> {BED_STATE_LABELS.pulled}{" "}
                        {network.pulled}
                      </span>
                      <span className={styles.legendItem}>
                        <span className={`${styles.legendSwatch} ${styles.barNotYet}`} /> {BED_STATE_LABELS.closed}{" "}
                        {network.closed}
                      </span>
                    </p>
                    <p className={styles.capacityTotal}>
                      Of {network.beds} beds across {network.wards} wards, the rest are {network.occupied} occupied.
                    </p>
                  </div>

                  <div className={styles.detailSection}>
                    <h3>Ready beds by service</h3>
                    <WardTable className={styles.overviewTable}>
                      <thead>
                        <tr>
                          <th scope="col">Health service</th>
                          <th scope="col" className={styles.numCell}>
                            Ready
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {byService.map((row) => (
                          <tr
                            key={row.service}
                            className={styles.serviceRow}
                            onClick={() => {
                              setQuery(row.service);
                              inputRef.current?.focus();
                            }}
                            title={`Filter network by ${row.service}`}
                          >
                            <th scope="row">
                              <span className={styles.serviceBadge}>{row.service}</span>
                            </th>
                            <td className={styles.numCell}>
                              <span className={styles.serviceReadyPill}>{row.ready}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th scope="row">Total</th>
                          <td className={styles.numCell}>{network.ready}</td>
                        </tr>
                      </tfoot>
                    </WardTable>
                  </div>

                  <div className={styles.detailSection}>
                    <h3>
                      Wards that need a check <span className={styles.groupCount}>{attention.length}</span>
                    </h3>
                    {attention.length === 0 ? (
                      <p className={styles.nothing}>No ward is reporting an empty or stale bed count right now.</p>
                    ) : (
                      <ul className={styles.queue}>
                        {attention.map(({ entry, reason, severity }, index) => (
                          <li key={entry.id} className={styles.decisionRow}>
                            <div className={styles.decisionBody}>
                              <div className={styles.decisionHeader}>
                                <span className={styles.decisionRef}>
                                  {entry.name}{" "}
                                  {/* ⚠️ The ONLY ranking claim this screen makes, and it is shown
                                      beside its own criterion rather than as an unexplained order.
                                      `severity` counts how many of the two stated reasons apply —
                                      never a tuned score a coordinator cannot audit. */}
                                  {index === 0 && severity === 2 ? (
                                    <span className={styles.firstFlag}>Do this first — both</span>
                                  ) : null}
                                </span>
                                {entry.confirmedAt === undefined ? null : (
                                  <span className={styles.decisionAge}>{splitDuration(now - entry.confirmedAt)}</span>
                                )}
                              </div>
                              <p className={styles.decisionReason}>{reason}</p>
                            </div>
                            <button type="button" className={styles.rowAction} onClick={() => reveal(entry.id)}>
                              Show this ward
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/*
                    ⚠️ **NAMED, NOT COUNTED.** "2 wards not authorised" says there is a problem and
                    not where; the whole value of this line is knowing WHICH ward cannot take the
                    involuntary patient in front of you. Mental Health Act authorisation is a legal
                    fact about who may be admitted, so it is stated in words on the overview and
                    again on the ward itself — never left to a badge colour.
                  */}
                  {unauthorised.length === 0 ? null : (
                    <div className={styles.detailSection}>
                      <h3>Worth knowing</h3>
                      <p className={styles.nothing}>
                        {unauthorised.length === 1 ? "One ward is" : `${unauthorised.length} wards are`} recorded as
                        voluntary-only (not set up for involuntary admissions) —
                        {unauthorised.map((entry) => entry.name).join(", ")}.
                      </p>
                    </div>
                  )}

                  {pinned.length === 0 ? null : (
                    <div className={styles.detailSection}>
                      <h3>
                        Pinned <span className={styles.groupCount}>{pinned.length}</span>
                      </h3>
                      <ul className={styles.memoryList}>
                        {pinned.map((entry) => (
                          <li key={entry.id}>
                            <button type="button" className={styles.memoryRow} onClick={() => select(entry.id)}>
                              <span className={styles.memoryName}>{entry.name}</span>
                              <span className={styles.memoryStat}>
                                {entry.kind === "ward" ? capacityLine(entry) : ""}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {recent.length === 0 ? null : (
                    <div className={styles.detailSection}>
                      <h3>Recently opened</h3>
                      <ul className={styles.memoryList}>
                        {recent.map((entry) => (
                          <li key={entry.id}>
                            <button type="button" className={styles.memoryRow} onClick={() => select(entry.id)}>
                              <span className={styles.memoryName}>{entry.name}</span>
                              <span className={styles.memoryStat}>
                                {entry.kind === "ward" ? capacityLine(entry) : ""}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className={styles.detailHead}>
                  <p className={styles.detailEyebrow}>
                    <span className={kindBadgeClass(selected.kind)}>{KIND_WORD_LONG[selected.kind]}</span>
                    {/* The health service or WA region, beside the kind rather than only in the
                        subtitle: it is the first thing a coordinator checks when deciding whether a
                        bed is even reachable for this patient. */}
                    {selected.service === undefined ? null : (
                      <span className={styles.resultSub}>{selected.service}</span>
                    )}
                  </p>
                  <h2 className={styles.detailTitle}>{selected.name}</h2>
                  {/* ⚠️ SITE ONLY. The service (or WA region) is already in the eyebrow
                      directly above, so joining it in here printed "Perth Metropolitan" twice on a
                      community panel and the health service twice on a ward. A community team has no
                      site at all, which left its subtitle as a bare repeat of the line above it. */}
                  {selected.site === undefined ? null : <p className={styles.detailSub}>{selected.site}</p>}

                  <div className={styles.detailBadges}>
                    {selected.cohort === undefined ? null : <span className={styles.infoPill}>{selected.cohort}</span>}
                    {selected.security === undefined ? null : (
                      <span className={styles.infoPill}>{selected.security}</span>
                    )}
                    {/* ⚠️ Mental Health Act authorisation is a SEPARATE fact from locked/open — a
                        unit can be both locked and unauthorised at once — and it is stated in words
                        because it decides who may legally be admitted. */}
                    {selected.authorised === false ? (
                      <span className={styles.flagPill}>Not authorised — voluntary admissions only</span>
                    ) : null}
                    {/* Forensic status is independent of locked/open — `Unit.forensic`'s own doc
                        comment says so — so it is its own badge and never folded into security. */}
                    {selected.forensic === true ? <span className={styles.flagPill}>Forensic ward</span> : null}
                    {/* ⚠️ A sex designation is a CONSTRAINT on who may be admitted, not a description
                        of who is there. "Undesignated" accepts either sex, so it is not a
                        constraint and earns no badge — showing it would read as a restriction. */}
                    {selected.sexDesignation === undefined || selected.sexDesignation === "Undesignated" ? null : (
                      <span className={styles.infoPill}>{selected.sexDesignation}</span>
                    )}
                  </div>
                </div>

                <div className={styles.detailBody} role="region" aria-label={`${selected.name} details`} tabIndex={0}>
                  {selected.kind === "ward" ? (
                    <div className={styles.detailSection}>
                      <h3>Beds</h3>
                      <div className={styles.capacityGrid}>
                        <div className={styles.capacityCell}>
                          <span className={styles.capacityNum}>{selected.ready ?? 0}</span>
                          <span className={styles.capacityLbl}>Ready to admit</span>
                        </div>
                        {/*
                          ⚠️ **THE RULED BOXES, NEVER A SUM OF READY AND CLOSED.** Ready is what a
                          coordinator can fill now. Pulled is allocated to someone not yet arrived.
                          Closed is empty but not offered. Occupied has someone in it. Beds is the
                          ward's size. Adding Ready to Closed produces the physically-empty total — a
                          number that reads as availability and is not, because the reducer refuses
                          `PULL_PATIENT` into Closed.
                        */}
                        <div className={styles.capacityCell}>
                          <span className={styles.capacityNum}>{selected.pulled ?? 0}</span>
                          <span className={styles.capacityLbl}>{BED_STATE_LABELS.pulled}</span>
                        </div>
                        <div className={styles.capacityCell}>
                          <span className={styles.capacityNum}>{selected.closed ?? 0}</span>
                          <span className={styles.capacityLbl}>{BED_STATE_LABELS.closed}, not offered</span>
                        </div>
                        <div className={styles.capacityCell}>
                          <span className={styles.capacityNum}>{selected.occupied ?? 0}</span>
                          <span className={styles.capacityLbl}>{BED_STATE_LABELS.occupied}</span>
                        </div>
                        <div className={styles.capacityCell}>
                          <span className={styles.capacityNumMuted}>{selected.beds ?? 0}</span>
                          <span className={styles.capacityLbl}>Beds</span>
                        </div>
                      </div>
                      {/*
                        The owner's 2026-09-05 qualifier used to be repeated here as a sentence.
                        It now lives ONCE, in the Notes list below, beside the other three bed facts
                        — stating it twice on one panel invites the two copies to drift apart, and
                        the Notes list is where a coordinator is already reading bed facts.
                      */}
                    </div>
                  ) : selected.kind === "ed" ? (
                    <div className={styles.detailSection}>
                      <h3>On-site mental health wards</h3>
                      {/*
                        ⚠️ **AN EMPTY LIST IS A FACT AND IS STATED AS ONE.** Joondalup and Peel
                        genuinely run emergency departments with no mental health beds of their own
                        — a real asymmetry in this network. "0 on-site beds" would read as a
                        shortage; naming the wards where there are some, and saying so in a sentence
                        where there are none, is the difference between a number and an answer.
                      */}
                      {selected.onSiteUnits === undefined || selected.onSiteUnits.length === 0 ? (
                        <p className={styles.absent}>
                          No mental health beds on-site — this department places patients elsewhere in the network.
                        </p>
                      ) : (
                        <ul className={styles.notesList}>
                          {selected.onSiteUnits.map((unit) => (
                            <li key={unit}>{unit}</li>
                          ))}
                        </ul>
                      )}
                      <ul className={styles.notesList}>
                        <li>
                          <b>Referral queue</b> available on the department page.
                        </li>
                      </ul>
                    </div>
                  ) : (
                    <div className={styles.detailSection}>
                      <h3>Notes</h3>
                      <ul className={styles.notesList}>
                        <li>
                          <b>Team name</b> a synthetic placeholder.
                        </li>
                        <li>
                          <b>Beds</b> a community team holds none; it takes people for follow-up in the community.
                        </li>
                        <li>
                          <b>Referral queue</b> not available for this entry.
                        </li>
                      </ul>
                    </div>
                  )}

                  {/*
                    ⚠️ **WARD-ONLY, AND IT WAS NOT.** This block sat outside the kind conditional, so
                    an emergency department and a community team each rendered a SECOND "Notes"
                    heading with nothing under it — a heading over an empty list, which reads as a
                    section that failed to load rather than one that does not apply. Every fact in
                    it (bed confirmation, on leave, locked beds, being cleaned) is a fact
                    about a ward; none of the three has any meaning for the other two kinds.
                  */}
                  {selected.kind !== "ward" ? null : (
                    // ⚠️ **AND EVERY LINE IN IT IS A FACT WITH A LABEL, NEVER A BARE NUMBER**, shown
                    // only when there is something to say. A ward with nobody on leave gets no
                    // line rather than a line reading "0" — a zero standing where a fact belongs is
                    // read as a measurement, and this screen cannot distinguish "none" from "unknown"
                    // unless it says which.
                    <div className={styles.detailSection}>
                      <h3>Notes</h3>
                      <ul className={styles.notesList}>
                        {selected.confirmedAt === undefined ? null : (
                          <li>
                            <b>Ready-to-admit confirmed</b>{" "}
                            <span className={styles.metaTimestamp}>
                              {formatInstantWithDay(selected.confirmedAt, now)}
                            </span>
                            {selected.stale === true ? " — stale, check with the ward before relying on it" : ""} (
                            <span className={styles.metaTimestamp}>{formatElapsed(now - selected.confirmedAt)}</span>).
                          </li>
                        )}
                        {selected.onLeave === undefined || selected.onLeave === 0 ? null : (
                          <li>
                            <b>{BED_STATE_LABELS.onLeave}</b> {selected.onLeave}{" "}
                            {selected.onLeave === 1 ? "bed is" : "beds are"} held for a patient on leave — already
                            counted in Occupied.
                          </li>
                        )}
                        {selected.lockedBeds === undefined || selected.lockedBeds === 0 ? null : (
                          <li>
                            <b>Locked beds</b> {selected.lockedBeds} of {selected.beds ?? 0} beds are designated locked.
                            A voluntary patient may still be nursed on one.
                          </li>
                        )}
                        {selected.pendingPreparation === undefined || selected.pendingPreparation === 0 ? null : (
                          <li>
                            <b>Being made ready</b> {selected.pendingPreparation}{" "}
                            {selected.pendingPreparation === 1 ? "bed is" : "beds are"} still being cleaned and cannot
                            take anyone yet.
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                <div className={styles.detailCta}>
                  {/* The one honest caveat about where this button lands. A community entry has no
                      per-region page to reach — see `communityHref` in hub-derivations.ts — so the
                      button says so rather than implying a screen about THIS team. */}
                  <p className={styles.ctaNote}>
                    {selected.kind === "community" ? "Community directory; no page for this regional entry." : ""}
                  </p>
                  <div className={styles.ctaActions}>
                    <a
                      className={styles.ctaButton}
                      href={selected.href}
                      // ⚠️ Recorded HERE and nowhere else — see `recordHubVisit`. Arrow keys move the
                      // preview, so recording a selection would stamp five wards into "recently
                      // opened" that nobody chose. This is the only control that leaves the screen.
                      onClick={() => recordHubVisit(selected.id)}
                    >
                      <span>{selected.kind === "community" ? "Open community teams" : `Open ${selected.name}`}</span>
                      <ArrowRight className={styles.ctaIcon} size={15} aria-hidden="true" />
                    </a>
                    {/*
                      ⚠️ **WARD AND ED ONLY, AND DELIBERATELY.** `wardStatisticsHref`/`edStatisticsHref`
                      (`statistics/statistics-sections.ts`) resolve against `units.find` and
                      `edById` — a real id this entry actually carries, so the link is a real
                      arrival. There is no third builder called here for `community`: see the
                      stated absence below and the block comment above `communityHref` in
                      `hub-derivations.ts` for why one must not be invented.
                    */}
                    {selected.kind === "ward" ? (
                      <a className={styles.statsLink} href={wardStatisticsHref(selected.id)}>
                        <BarChart2 className={styles.statsIcon} size={14} aria-hidden="true" />
                        <span>View statistics</span>
                      </a>
                    ) : selected.kind === "ed" ? (
                      <a className={styles.statsLink} href={edStatisticsHref(selected.id)}>
                        <BarChart2 className={styles.statsIcon} size={14} aria-hidden="true" />
                        <span>View statistics</span>
                      </a>
                    ) : null}
                  </div>
                  {selected.kind === "community" ? (
                    // 🔴 STATED ABSENCE, NEVER A LINK — see the block comment above `communityHref`
                    // in `hub-derivations.ts`. This entry's id is a slug of a `HOME_REGIONS` name;
                    // the statistics route's `/community/[teamId]` resolves against
                    // `communityTeamById`, a DIFFERENT list keyed by the clinic names a referral
                    // actually records. The two vocabularies share no names, so a link built by
                    // slugifying a region would land on "No community team in this prototype has
                    // the address …" — an href that is not an arrival. The words below are true
                    // read alone and do not imply a page exists to visit.
                    <p className={styles.statsAbsent}>Statistics are unavailable for this regional entry.</p>
                  ) : null}
                </div>
              </>
            )}
            {/*
          THE DISCLOSURE THE FIRST BUILD DROPPED. The mockup carries it in full and it is the page's
          governance statement, not decoration — a screen showing invented bed figures under real
          Perth hospital names owes a reader an account of which is which.

          ⚠️ **EVERY CLAIM BELOW WAS CHECKED AGAINST THE DATA BEFORE IT WAS WRITTEN, AND FOUR OF
          THE MOCKUP'S OWN CLAIMS DID NOT SURVIVE THAT CHECK.** The mockup's footer described a
          pin/star and "recently viewed" feature this build does not have; it said the placeholder
          caveat is "stated once here rather than on every row", which is the exact behaviour
          `hub-derivations.ts` was changed AWAY from; and it called Broome's forensic ward a
          forensic BED, which is a whole-ward flag covering six beds. Those claims are omitted or
          corrected rather than softened — a rephrased unverifiable claim still asserts something,
          and reads as having been checked.

          ⚠️ **AND THE COUNTS ARE DERIVED, NEVER TYPED.** "23 wards" written as a literal is true
          until somebody adds a ward, and then it is a false statement on a clinical screen that
          nothing goes red about. They come from the same figures the rest of the page renders.
        */}
            <section className={styles.aboutPanel} aria-label="Data provenance">
              <div className={styles.asAtWrap}>
                <p className={styles.asAt}>
                  <span className={styles.liveDot} aria-hidden="true" />
                  <span className={styles.clockPhrase}>
                    As at <b className={styles.asAtTime}>{formatInstant(now)}</b>, Perth.
                  </span>
                </p>
                <p className={styles.reconciliationNotice}>{hubReconciliationLine(null)}</p>
              </div>
              <div className={styles.srOnly}>
                <h4>What is invented</h4>
                <p>
                  Every bed figure — ready, pulled, closed and occupied — is invented for this prototype and reflects no
                  real hospital&rsquo;s state.
                </p>
              </div>
            </section>
          </aside>
        </div>
        <WardPrototypeFooter
          testId="ward-hub-governance"
          note="Real hospital network; invented bed figures and community team names · Not a medical device"
        />
      </main>
    </div>
  );
}
