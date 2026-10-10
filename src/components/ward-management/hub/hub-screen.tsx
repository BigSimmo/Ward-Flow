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
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart2,
  Building2,
  ChevronDown,
  Network,
  RotateCcw,
  Search,
  Star,
  X,
} from "lucide-react";

import {
  Card,
  CardHead,
  Count,
  FilterChip,
  Hero,
  HeroStat,
  IconTile,
  Kbd,
  Segmented,
  SrOnly,
  StatusGlyph,
  TextInput,
  buttonClass,
  cx,
  durMinutes,
} from "@/components/wf";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
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
import { formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { edStatisticsHref, wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { PageLiveChip, usePageLive } from "@/components/ward-management/ward-page-live";
import { BedStrip, BedStripLegend } from "@/components/ward-management/wards/bed-strip";

import {
  recordHubVisit,
  toggleHubPin,
  useRecentHubIds,
  usePinnedHubIds,
} from "@/components/ward-management/hub/hub-browser-memory";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";

import styles from "./hub.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

/**
 * PLACES (v6) — one place to reach every ward, emergency department and community team.
 *
 * ⚠️ **EVERY FIGURE ON THIS SCREEN IS DERIVED, NEVER COMPUTED HERE.** `hub-derivations.ts` owns the
 * arithmetic and the clinical rules; this file renders what it returns, so a second copy of "how
 * ready beds are counted" cannot grow in a component.
 *
 * Layout follows design/pages-v6/Places.png: a hero band, "The network" list on the left, the
 * selected place's preview above "At a glance" on the right. The mockup's drive-time controls
 * (Drive from, Nearest, From Peel) and its 24-hour ready-beds chart have no data in this app and
 * are left out rather than drawn as dead controls.
 */

type Order = "service" | "ready";

/**
 * ⚠️ **READY AND NOT-YET-CLEARED ARE TWO NUMBERS.** Owner ruling, 2026-09-05: a bed can be free
 * per the feed and still be being made ready, and the reducer refuses `PULL_PATIENT` into one.
 * The qualifier sits BESIDE Ready and is never subtracted from it. Never collapse these into one
 * figure, and never show only the larger.
 */
function capacityLine(entry: HubEntry): string {
  if (entry.ready === undefined) return "Bed numbers not reported";
  const ready = `${entry.ready} ready`;
  if (entry.pendingPreparation === undefined || entry.pendingPreparation === 0) return ready;
  return `${ready} · ${entry.pendingPreparation} still being made ready`;
}

/**
 * A segment's share of the bar, as a CSS width. ⚠️ A zero-bed network returns 0%, not NaN%, which a
 * browser silently discards and leaves a bar that looks deliberately empty.
 */
function barWidth(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.max(0, Math.min(100, (part / total) * 100))}%`;
}

/** Occupied share of a group of wards, one decimal place. Undefined for a group with no beds. */
function occupiedShare(occupied: number, beds: number): string | undefined {
  if (beds <= 0) return undefined;
  return `${((occupied / beds) * 100).toFixed(1)}%`;
}

const KIND_WORD_LONG: Record<HubKind, string> = {
  ward: "Ward",
  ed: "Emergency department",
  community: "Community team",
};

export function HubScreen() {
  usePrintableDisclosures();
  const { units, bedReleases, admissions, leaveBeds, refreshRequests, dispatch } = useWardFlow();
  const { now, paused, togglePause } = usePageLive();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<HubKind | "all">("all");
  const [order, setOrder] = useState<Order>("service");
  const [readyOnly, setReadyOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());
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
        if (selectedId !== undefined || query !== "" || readyOnly) {
          event.preventDefault();
          setQuery("");
          setReadyOnly(false);
          setSelectedId(undefined);
          inputRef.current?.focus();
        }
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [selectedId, query, readyOnly]);

  const entries = useMemo(
    () => hubEntries({ units, bedReleases, admissions, leaveBeds, now }),
    [units, bedReleases, admissions, leaveBeds, now],
  );
  const results = useMemo(() => {
    const base = searchHub(entries, query, kind);
    const filtered = readyOnly ? base.filter((entry) => (entry.ready ?? 0) > 0) : base;
    if (order === "service") return filtered;
    // Most ready first, inside the same service groups. A stable sort keeps the service order for ties.
    return [...filtered].sort((a, b) => (b.ready ?? -1) - (a.ready ?? -1));
  }, [entries, query, kind, readyOnly, order]);
  // Category counts follow "Ready beds only" as well as the search, so each count matches what
  // pressing that category shows.
  const counts = useMemo(
    () => hubCounts(readyOnly ? entries.filter((entry) => (entry.ready ?? 0) > 0) : entries, query),
    [entries, query, readyOnly],
  );
  // The list foot's "of" stays the search-matched total, so "Ready beds only" reads as a narrowing.
  const searchMatched = useMemo(() => searchHub(entries, query, "all").length, [entries, query]);
  const readyBedsCount = useMemo(() => entries.reduce((sum, entry) => sum + (entry.ready ?? 0), 0), [entries]);
  const isFiltered = query !== "" || kind !== "all" || readyOnly;

  function resetAllFilters() {
    setQuery("");
    setKind("all");
    setReadyOnly(false);
    setSelectedId(undefined);
    inputRef.current?.focus();
  }
  /*
   * 🔴 **`totals`, NOT `counts`, FOR EVERYTHING THAT DESCRIBES THE NETWORK.** `counts` is
   * query-filtered; a search for "fremantle" once made the network subtitle say "2 wards" above a
   * section reading "303 beds across 23 wards". Filtered figures belong only on the controls,
   * because a number on a control states what pressing it gives you.
   */
  const totals = useMemo(() => hubCounts(entries, ""), [entries]);
  const byService = useMemo(() => readyByService(entries), [entries]);
  const attention = useMemo(() => needsAttention(entries), [entries]);
  const network = useMemo(() => networkBeds(entries), [entries]);
  const unauthorised = useMemo(() => unauthorisedWards(entries), [entries]);
  const sections = useMemo(() => groupedResults(results), [results]);
  const staleCount = useMemo(() => entries.filter((entry) => entry.stale === true).length, [entries]);
  const maxServiceReady = Math.max(1, ...byService.map((row) => row.ready));

  const pinnedIds = usePinnedHubIds();
  const recentIds = useRecentHubIds();

  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const pinned = useMemo(() => pinnedIds.flatMap((id) => byId.get(id) ?? []), [pinnedIds, byId]);
  const recent = useMemo(() => recentIds.flatMap((id) => byId.get(id) ?? []), [recentIds, byId]);
  const isPinned = (id: string) => pinnedIds.includes(id);

  const selected = results.find((entry) => entry.id === selectedId) ?? undefined;
  const selectedRequest =
    selected === undefined ? undefined : refreshRequests.filter((entry) => entry.unitId === selected.id).at(-1);

  function select(id: string) {
    setSelectedId(id);
  }

  function toggleFold(key: string) {
    setFolded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /*
   * The arrow keys are implemented on a plain search box rather than announced as a combobox: this
   * is a filter over a permanently visible list, not a picker, and claiming a widget the screen does
   * not implement tells a screen reader user to press keys that do nothing.
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
    const next =
      current === -1 ? (step === 1 ? 0 : results.length - 1) : (current + step + results.length) % results.length;
    setSelectedId(results[next]?.id);
  }

  function reveal(id: string) {
    setQuery("");
    setKind("all");
    setReadyOnly(false);
    setSelectedId(id);
  }

  function renderRow(entry: HubEntry) {
    const active = entry.id === selectedId;
    const wardFigures =
      entry.kind === "ward" && entry.ready !== undefined
        ? {
            ready: entry.ready,
            pulled: entry.pulled ?? 0,
            closed: entry.closed ?? 0,
            occupied: entry.occupied ?? 0,
            pendingPreparation: entry.pendingPreparation,
          }
        : undefined;
    return (
      <li key={entry.id} className={cx(styles.resultRow, active && styles.resultRowActive)}>
        <button
          type="button"
          className={styles.resultMain}
          aria-current={active ? "true" : undefined}
          onClick={() => {
            // Phone: the preview pane is not shown, so a tap opens the place itself, exactly as the
            // preview's own Open link does. Every wider screen keeps select-to-preview.
            if (typeof window.matchMedia === "function" && window.matchMedia("(max-width: 48rem)").matches) {
              recordHubVisit(entry.id);
              router.push(entry.href);
              return;
            }
            select(entry.id);
          }}
        >
          <span className={styles.resultText}>
            <span className={styles.resultName}>{entry.name}</span>
            <span className={styles.resultSub}>
              {(entry.kind === "ward" ? [entry.site, entry.cohort, entry.security] : [entry.site, entry.service])
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
          <span className={styles.resultBeds}>
            {wardFigures === undefined ? null : (
              <>
                <BedStrip bar counts={wardFigures} wardName={entry.name} />
                <span className={styles.resultFigures}>
                  {wardFigures.ready}/{wardFigures.pulled}/{wardFigures.closed} of {entry.beds ?? 0}
                </span>
                {entry.pendingPreparation === undefined || entry.pendingPreparation === 0 ? null : (
                  <span className={styles.resultPrep}>{entry.pendingPreparation} being made ready</span>
                )}
              </>
            )}
          </span>
          <span className={styles.resultConfirmed}>
            {entry.kind !== "ward" || entry.confirmedAt === undefined ? null : entry.stale === true ? (
              <>
                {/* The word, not only the colour — a stale reading must survive a reader who cannot see it. */}
                <StatusGlyph tone="warning" size={8} />
                {durMinutes(now - entry.confirmedAt)} <span className={styles.flagPill}>stale</span>
              </>
            ) : (
              <>
                {durMinutes(now - entry.confirmedAt)} <span className={styles.resultAgo}>ago</span>
              </>
            )}
          </span>
          <span className={styles.resultReady}>
            {entry.kind !== "ward" ? null : entry.ready === undefined ? (
              <span className={styles.resultReadyWord}>Not reported</span>
            ) : (
              <>
                <span className={styles.resultReadyNum}>{entry.ready}</span>
                <span className={styles.resultReadyWord}>{entry.stale === true ? "to check" : "ready"}</span>
              </>
            )}
          </span>
        </button>
        {/* ⚠️ A sibling of the row button, not a child: a button inside a button is invalid HTML. */}
        <button
          type="button"
          className={cx(styles.pinButton, isPinned(entry.id) && styles.pinButtonOn)}
          aria-pressed={isPinned(entry.id)}
          aria-label={`${isPinned(entry.id) ? "Unpin" : "Pin"} ${entry.name}`}
          onClick={() => toggleHubPin(entry.id)}
        >
          <Star className={styles.pinIcon} size={15} aria-hidden="true" />
        </button>
      </li>
    );
  }

  const kindItems = (["all", "ward", "ed", "community"] as const).map((id) => ({
    id,
    label: id === "all" ? "All" : id === "ward" ? "Wards" : id === "ed" ? "EDs" : "Community",
    count: counts[id],
  }));

  return (
    <div className={styles.screen} data-testid="ward-hub-page" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          className={styles.hubHero}
          eyebrow="Places · Statewide"
          title={
            <>
              <SrOnly>Places, </SrOnly>
              {totals.ward} wards, {totals.ed} EDs, {totals.community} community teams
            </>
          }
          stats={
            <>
              <HeroStat value={network.ready} label="Beds ready" tone="success" />
              <HeroStat value={network.pulled} label={BED_STATE_LABELS.pulled} />
              <HeroStat value={network.closed} label={BED_STATE_LABELS.closed} />
              <HeroStat value={staleCount} label="Stale counts" tone={staleCount > 0 ? "warning" : undefined} />
            </>
          }
          aside={<PageLiveChip paused={paused} onTogglePause={togglePause} />}
        />

        <div className={styles.hubShell}>
          <Card as="section" className={styles.hubLeft} aria-label="Search results">
            <CardHead
              icon={Network}
              title="The network"
              aside={<span className={styles.headMeta}>Perth and country WA</span>}
            />
            <div className={styles.controls}>
              <div className={styles.controlsRow}>
                <Segmented
                  label="Show"
                  items={kindItems}
                  value={kind}
                  onChange={(id) => {
                    setKind(id);
                    setSelectedId(undefined);
                  }}
                />
                <TextInput
                  ref={inputRef}
                  id="hub-search-query"
                  name="query"
                  type="search"
                  icon={Search}
                  boxClassName={styles.searchBox}
                  aria-label="Search wards, EDs and community teams"
                  aria-describedby="hub-search-hint"
                  placeholder="Search wards, EDs, teams, services"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onSearchKeyDown}
                  trailing={query === "" ? <Kbd>/</Kbd> : undefined}
                  onClear={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                />
              </div>
              <div className={styles.controlsRow}>
                <span className={styles.controlLabel}>Order</span>
                <Segmented
                  label="Order"
                  items={[
                    { id: "service" as const, label: "Service" },
                    { id: "ready" as const, label: "Most ready" },
                  ]}
                  value={order}
                  onChange={setOrder}
                />
                <span className={styles.controlsEnd}>
                  {isFiltered ? (
                    <button
                      type="button"
                      className={buttonClass({ variant: "ghost", size: "sm" })}
                      onClick={resetAllFilters}
                      aria-label="Reset all filters and search"
                    >
                      <RotateCcw size={13} aria-hidden="true" />
                      Reset
                    </button>
                  ) : null}
                  <FilterChip
                    pressed={readyOnly}
                    count={readyBedsCount}
                    onPressedChange={(pressed) => {
                      setReadyOnly(pressed);
                      setSelectedId(undefined);
                    }}
                  >
                    Ready beds only
                  </FilterChip>
                </span>
              </div>
              {/* Announced through `aria-describedby`. Escape clears BOTH the search and the preview. */}
              <SrOnly id="hub-search-hint">
                Arrow keys preview a result, Enter opens it, Escape clears the search and the preview.
              </SrOnly>
            </div>

            <div className={styles.listHead} aria-hidden="true">
              <span>Place</span>
              <span>Beds</span>
              <span>Confirmed</span>
              <span className={styles.listHeadReady}>Ready</span>
            </div>

            {/*
              ⚠️ **A SECTION IS NOT A LIST ITEM.** Sections are real `<section>`s with real headings,
              and the only `<li>`s on this screen are result rows, so anything counting rows (a test,
              a screen reader announcing "list, 16 items") counts places, not headings.
            */}
            <div className={styles.listScroll} id="hub-results" role="region" aria-label="Network results" tabIndex={0}>
              {results.length === 0 ? (
                <p className={styles.emptyState}>
                  {/* Names the ACTIVE FILTER: "nothing matches" differs from "nothing of this kind matches". */}
                  No{" "}
                  {kind === "all"
                    ? "ward, emergency department or community team"
                    : KIND_WORD_LONG[kind].toLowerCase()}{" "}
                  matches “{query}”. Try a hospital name, a health service such as “WACHS”, or clear the search.
                </p>
              ) : (
                sections.map((section) => {
                  const sectionBeds = section.key === "ward" ? networkBeds(section.entries) : undefined;
                  const sectionShare =
                    sectionBeds === undefined ? undefined : occupiedShare(sectionBeds.occupied, sectionBeds.beds);
                  return (
                    <section key={section.key} aria-label={section.label} className={styles.group}>
                      <div className={styles.groupHeadRow}>
                        <h2 className={styles.groupHead}>
                          {section.label} <Count n={section.entries.length} />
                        </h2>
                        {sectionBeds === undefined ? null : (
                          <span className={styles.groupMeta}>
                            {sectionBeds.ready} ready{sectionShare === undefined ? "" : ` · ${sectionShare} occupied`}
                          </span>
                        )}
                      </div>
                      {section.subgroups.length === 0 ? (
                        <ul className={styles.groupList}>{section.entries.map(renderRow)}</ul>
                      ) : (
                        section.subgroups.map((group) => {
                          const key = `${section.key}-${group.label}`;
                          const open = !folded.has(key);
                          const groupBeds = networkBeds(group.entries);
                          const groupShare = occupiedShare(groupBeds.occupied, groupBeds.beds);
                          return (
                            <div key={key}>
                              <h3 className={styles.subGroupHead}>
                                <button
                                  type="button"
                                  className={styles.foldButton}
                                  aria-expanded={open}
                                  onClick={() => toggleFold(key)}
                                >
                                  <ChevronDown className={styles.foldIcon} size={14} aria-hidden="true" />
                                  <span className={styles.subGroupName}>{group.label}</span>
                                  <span className={styles.subGroupCount}>
                                    {group.entries.length} {group.entries.length === 1 ? "ward" : "wards"}
                                  </span>
                                  <span className={styles.subGroupMeta}>
                                    {groupBeds.ready} ready
                                    {groupShare === undefined ? null : (
                                      <span className={styles.subGroupShare}>{groupShare} occupied</span>
                                    )}
                                  </span>
                                </button>
                              </h3>
                              {open ? <ul className={styles.groupList}>{group.entries.map(renderRow)}</ul> : null}
                            </div>
                          );
                        })
                      )}
                    </section>
                  );
                })
              )}
            </div>
            <div className={styles.listFoot}>
              <BedStripLegend />
              <span className={styles.shownCount}>
                <b>
                  {results.length} of {searchMatched}
                </b>{" "}
                shown
              </span>
            </div>
          </Card>

          <aside className={styles.hubRight} aria-label="At a glance" data-wf-rail>
            {selected === undefined ? null : (
              <Card as="section" className={styles.previewCard} aria-label={`Preview, ${selected.name}`}>
                <div className={styles.previewHead}>
                  <IconTile icon={Building2} />
                  {/* The heading's container holds every flag below it, so the preview states them in words. */}
                  <div className={styles.previewTitleBlock}>
                    <span className={styles.previewEyebrow}>
                      {KIND_WORD_LONG[selected.kind]}
                      {selected.service === undefined ? "" : ` · ${selected.service}`}
                    </span>
                    <h2 className={styles.previewTitle}>{selected.name}</h2>
                    {selected.site === undefined ? null : <p className={styles.previewSite}>{selected.site}</p>}
                    <div className={styles.detailBadges}>
                      {selected.cohort === undefined ? null : (
                        <span className={styles.infoPill}>{selected.cohort}</span>
                      )}
                      {selected.security === undefined ? null : (
                        <span className={styles.infoPill}>{selected.security}</span>
                      )}
                      {/* ⚠️ Mental Health Act authorisation is a SEPARATE fact from locked/open and decides
                          who may legally be admitted, so it is stated in words. */}
                      {selected.authorised === false ? (
                        <span className={styles.flagPill}>
                          <StatusGlyph tone="warning" size={8} />
                          Not authorised — voluntary admissions only
                        </span>
                      ) : null}
                      {selected.forensic === true ? <span className={styles.infoPill}>Forensic ward</span> : null}
                      {/* "Undesignated" accepts either sex, so it is not a constraint and earns no badge. */}
                      {selected.sexDesignation === undefined || selected.sexDesignation === "Undesignated" ? null : (
                        <span className={styles.infoPill}>{selected.sexDesignation}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.closeDetailBtn}
                    onClick={() => {
                      setSelectedId(undefined);
                      inputRef.current?.focus();
                    }}
                    aria-label="Close preview and return to overview (Escape)"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>

                <div className={styles.detailBody} role="region" aria-label={`${selected.name} details`} tabIndex={0}>
                  {selected.kind === "ward" ? (
                    <>
                      {/*
                        ⚠️ **THE RULED BOXES, NEVER A SUM OF READY AND CLOSED.** Adding Ready to Closed
                        produces the physically-empty total, which reads as availability and is not:
                        the reducer refuses `PULL_PATIENT` into Closed.
                      */}
                      <div className={styles.capacityGrid}>
                        <h3 className={styles.srOnly}>Beds</h3>
                        <div className={styles.capacityCell}>
                          <span className={styles.capacityNum}>{selected.ready ?? 0}</span>
                          <span className={styles.capacityLbl}>Ready to admit</span>
                        </div>
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
                      <dl className={styles.factList}>
                        {selected.confirmedAt === undefined ? null : (
                          <div className={styles.factRow}>
                            <dt>Confirmed</dt>
                            <dd>
                              <span className={styles.metaTimestamp}>
                                {formatInstantWithDay(selected.confirmedAt, now)}
                              </span>{" "}
                              <span className={styles.factMuted}>
                                {durMinutes(now - selected.confirmedAt)} ago
                                {selected.stale === true ? ", stale, check with the ward before relying on it" : ""}
                              </span>
                            </dd>
                            {selectedRequest === undefined ? (
                              <button
                                type="button"
                                className={buttonClass({ variant: "sec", size: "sm" })}
                                onClick={() =>
                                  dispatch({
                                    type: "REQUEST_CAPACITY_REFRESH",
                                    role: "coordinator",
                                    now,
                                    unitId: selected.id,
                                  })
                                }
                              >
                                Ask to confirm
                              </button>
                            ) : (
                              <span className={styles.factMuted}>
                                Asked {formatInstantWithDay(selectedRequest.at, now)}
                              </span>
                            )}
                          </div>
                        )}
                        {selected.pendingPreparation === undefined || selected.pendingPreparation === 0 ? null : (
                          <div className={styles.factRow}>
                            <dt>Being made ready</dt>
                            <dd>
                              {selected.pendingPreparation} {selected.pendingPreparation === 1 ? "bed is" : "beds are"}{" "}
                              still being cleaned, not yet admittable
                            </dd>
                          </div>
                        )}
                        {selected.onLeave === undefined || selected.onLeave === 0 ? null : (
                          <div className={styles.factRow}>
                            <dt>{BED_STATE_LABELS.onLeave}</dt>
                            <dd>
                              {selected.onLeave} {selected.onLeave === 1 ? "bed is" : "beds are"} held for a patient on
                              leave, already counted in Occupied
                            </dd>
                          </div>
                        )}
                        {selected.lockedBeds === undefined || selected.lockedBeds === 0 ? null : (
                          <div className={styles.factRow}>
                            <dt>Locked beds</dt>
                            <dd>
                              {selected.lockedBeds} of {selected.beds ?? 0}. A voluntary patient may still be nursed on
                              one
                            </dd>
                          </div>
                        )}
                      </dl>
                    </>
                  ) : selected.kind === "ed" ? (
                    <div className={styles.detailSection}>
                      <h3>On-site mental health wards</h3>
                      {/* ⚠️ An empty list is a fact and is stated as one, never as "0 on-site beds". */}
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
                      <p className={styles.absent}>Referral queue available on the department page.</p>
                    </div>
                  ) : (
                    <div className={styles.detailSection}>
                      <h3>Notes</h3>
                      <ul className={styles.notesList}>
                        <li>Team name is a synthetic placeholder.</li>
                        <li>A community team holds no beds; it takes people for follow-up in the community.</li>
                        <li>Referral queue not available for this entry.</li>
                      </ul>
                    </div>
                  )}
                </div>

                <div className={styles.detailCta}>
                  {selected.kind === "community" ? (
                    <p className={styles.statsAbsent}>
                      Statistics are unavailable for this regional entry. Community directory; no page for this regional
                      entry.
                    </p>
                  ) : null}
                  <div className={styles.ctaActions}>
                    {/* Ward and ED only: the statistics builders resolve against a real id this entry carries. */}
                    {selected.kind === "ward" ? (
                      <Link
                        className={buttonClass({ variant: "sec", size: "sm" })}
                        href={wardStatisticsHref(selected.id)}
                      >
                        <BarChart2 size={14} aria-hidden="true" />
                        View statistics
                      </Link>
                    ) : selected.kind === "ed" ? (
                      <Link
                        className={buttonClass({ variant: "sec", size: "sm" })}
                        href={edStatisticsHref(selected.id)}
                      >
                        <BarChart2 size={14} aria-hidden="true" />
                        View statistics
                      </Link>
                    ) : null}
                    <Link
                      className={buttonClass({ variant: "pri", size: "sm" })}
                      href={selected.href}
                      onClick={() => recordHubVisit(selected.id)}
                    >
                      {selected.kind === "community" ? "Open community teams" : `Open ${selected.name}`}
                      <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </Card>
            )}

            <Card as="section" className={styles.glanceCard} aria-labelledby="hub-glance-title">
              <CardHead
                icon={Activity}
                id="hub-glance-title"
                title="At a glance"
                aside={
                  <p className={styles.asAt}>
                    As at <b className={styles.asAtTime}>{formatInstant(now)}</b>
                  </p>
                }
              />
              <div className={styles.overviewBody} role="region" aria-label="Network overview" tabIndex={0}>
                {/*
                  ⚠️ **THE FOUR RULED BOXES, ONE LEVEL ABOVE THE WARD PANEL.** Ready · Pulled · Closed ·
                  Occupied add up to the network's beds; Ready + Closed is never printed. One `style`
                  attribute carries the widths (`check:design-drift-ratchet` caps them), and the bar is
                  `aria-hidden` because the legend states every figure in words.
                */}
                <div className={styles.glanceSection}>
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
                      <span className={`${styles.legendSwatch} ${styles.barReady}`} />
                      <b>{network.ready}</b> ready
                    </span>
                    <span className={styles.legendItem}>
                      <span className={`${styles.legendSwatch} ${styles.barPulled}`} />
                      <b>{network.pulled}</b> {BED_STATE_LABELS.pulled.toLowerCase()}
                    </span>
                    <span className={styles.legendItem}>
                      <span className={`${styles.legendSwatch} ${styles.barNotYet}`} />
                      <b>{network.closed}</b> {BED_STATE_LABELS.closed.toLowerCase()}
                    </span>
                    <span className={styles.legendItem}>
                      <b>{network.occupied}</b> {BED_STATE_LABELS.occupied.toLowerCase()}
                    </span>
                    {occupiedShare(network.occupied, network.beds) === undefined ? null : (
                      <span className={styles.legendShare}>
                        {occupiedShare(network.occupied, network.beds)} occupied
                      </span>
                    )}
                  </p>
                </div>

                <div className={styles.glanceSection}>
                  <div className={styles.sectionHeadRow}>
                    <h3 className={styles.sectionLabel}>Ready beds by service</h3>
                    <span className={styles.sectionHint}>Tap to filter</span>
                  </div>
                  <div className={styles.servicesGrid} role="group" aria-label="Ready beds by health service">
                    {byService.map((row) => (
                      <button
                        key={row.service}
                        type="button"
                        className={styles.serviceRow}
                        onClick={() => {
                          setQuery(row.service);
                          if (kind !== "all" && kind !== "ward") setKind("all");
                          inputRef.current?.focus();
                        }}
                      >
                        <span className={styles.serviceName}>{row.service}</span>
                        <span className={styles.serviceTrack} aria-hidden="true">
                          <span
                            className={styles.serviceFill}
                            style={{ "--service-fill": barWidth(row.ready, maxServiceReady) } as CSSProperties}
                          />
                        </span>
                        <span className={styles.serviceNum}>{row.ready}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.glanceSection}>
                  <h3 className={styles.sectionLabel}>
                    Needs a check <Count n={attention.length} />
                  </h3>
                  {attention.length === 0 ? (
                    <p className={styles.nothing}>No ward is reporting an empty or stale bed count right now.</p>
                  ) : (
                    <ul className={styles.queue}>
                      {attention.map(({ entry, reason, severity }, index) => (
                        <li key={entry.id} className={styles.decisionRow}>
                          <StatusGlyph tone={entry.stale === true ? "warning" : "neutral"} size={8} />
                          <div className={styles.decisionBody}>
                            <span className={styles.decisionRef}>{entry.name}</span>
                            <p className={styles.decisionReason}>
                              {/* The only ranking claim this screen makes, shown beside its criterion. */}
                              {index === 0 && severity === 2 ? "Do this first — both. " : ""}
                              {reason}
                            </p>
                          </div>
                          <button
                            type="button"
                            className={buttonClass({ variant: "ghost", size: "sm" })}
                            onClick={() => reveal(entry.id)}
                          >
                            Show<SrOnly> {entry.name}</SrOnly>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* ⚠️ NAMED, NOT COUNTED: the value is knowing WHICH ward cannot take an involuntary patient. */}
                  {unauthorised.length === 0 ? null : (
                    <p className={styles.worthKnowing}>
                      <StatusGlyph tone="neutral" size={8} />
                      <span>
                        <b>Voluntary only</b> {unauthorised.map((entry) => entry.name).join(", ")}
                        <SrOnly>, not set up for involuntary admissions</SrOnly>
                      </span>
                    </p>
                  )}
                </div>

                {/* Pinned and recently opened render nothing until used. */}
                {pinned.length === 0 ? null : (
                  <div className={styles.glanceSection}>
                    <h3 className={styles.sectionLabel}>
                      Pinned <Count n={pinned.length} />
                    </h3>
                    <ul className={styles.memoryList}>
                      {pinned.map((entry) => (
                        <li key={entry.id}>
                          <button type="button" className={styles.memoryRow} onClick={() => select(entry.id)}>
                            <Star className={styles.memoryStar} size={14} aria-hidden="true" />
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
                  <div className={styles.glanceSection}>
                    <h3 className={styles.sectionLabel}>Recently opened</h3>
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

                {/*
                  THE DISCLOSURE. A screen showing invented bed figures under real Perth hospital
                  names owes a reader an account of which is which. Counts are derived, never typed.
                */}
                <div className={styles.srOnly}>
                  <h4>What is invented</h4>
                  <p>
                    Every bed figure — ready, pulled, closed and occupied — is invented for this prototype and reflects
                    no real hospital&rsquo;s state.
                  </p>
                </div>
              </div>
            </Card>
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
