"use client";

import {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
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
  ChevronRight,
  ListFilter,
  Network,
  RotateCcw,
  Search,
  Star,
  X,
} from "lucide-react";

import {
  Card,
  CheckingFoot,
  CardHead,
  Count,
  FilterChip,
  Hero,
  HeroStat,
  IconTile,
  Kbd,
  PhoneSheet,
  Segmented,
  SrOnly,
  StatusGlyph,
  TextInput,
  buttonClass,
  cx,
  useIsPhone,
  durMinutes,
} from "@/components/wf";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { edOpenSummaries } from "@/components/ward-management/ed/ed-home-derivations";
import { BED_STATE_DETAILS, BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
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

/** What a hero chip or Ready beds only is highlighting. */
type HubHighlight = "none" | "ready" | "pulled" | "closed" | "stale";

function matchesHighlight(entry: HubEntry, highlight: HubHighlight): boolean {
  switch (highlight) {
    case "ready":
      return (entry.ready ?? 0) > 0;
    case "pulled":
      return (entry.pulled ?? 0) > 0;
    case "closed":
      return (entry.closed ?? 0) > 0;
    case "stale":
      return entry.stale === true;
    default:
      return true;
  }
}

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

/**
 * Occupancy of a group of wards, one decimal place. Undefined for a group with no beds. Occupied or
 * Pulled, the one occupancy count every page and the rail print (`ward-occupancy.ts`, device audit
 * 11 Oct 2026); it used to count the Occupied box alone, so Places read 79.6% against the rail's 85%.
 */
function occupancyShare({
  occupied,
  pulled,
  beds,
}: {
  occupied: number;
  pulled: number;
  beds: number;
}): string | undefined {
  if (beds <= 0) return undefined;
  return `${(((occupied + pulled) / beds) * 100).toFixed(1)}%`;
}

const KIND_WORD_LONG: Record<HubKind, string> = {
  ward: "Ward",
  ed: "Emergency department",
  community: "Community team",
};

const HubPlaceRow = memo(function HubPlaceRow({
  entry,
  active,
  dimmed,
  pinned,
  isPhone,
  now,
  edWaiting,
  edLongestWaitMinutes,
  onSelect,
}: {
  entry: HubEntry;
  active: boolean;
  dimmed: boolean;
  pinned: boolean;
  isPhone: boolean;
  now: number;
  edWaiting: number;
  edLongestWaitMinutes: number;
  onSelect: (id: string) => void;
}) {
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
    <li
      className={cx(styles.resultRow, active && styles.resultRowActive)}
      data-dim={dimmed ? "true" : undefined}
      data-hub-row={entry.id}
    >
      <button
        type="button"
        className={styles.resultMain}
        aria-current={active ? "true" : undefined}
        onClick={() => onSelect(entry.id)}
      >
        <span className={styles.resultText}>
          <span className={styles.resultName}>
            {entry.name}
            {/* Phone (v10): a pinned place carries a filled star by its name; pinning is in its sheet. */}
            {isPhone && pinned ? (
              <>
                <Star className={styles.phonePinMark} size={14} aria-hidden="true" />
                <SrOnly>, pinned</SrOnly>
              </>
            ) : null}
          </span>
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
              <span
                className={styles.resultFigures}
                title={`${wardFigures.ready} ready, ${wardFigures.pulled} pulled, ${wardFigures.closed} closed, of ${entry.beds ?? 0} beds`}
              >
                <span aria-hidden="true">
                  {wardFigures.ready}/{wardFigures.pulled}/{wardFigures.closed} of {entry.beds ?? 0}
                </span>
                <SrOnly>
                  {wardFigures.ready} ready, {wardFigures.pulled} pulled, {wardFigures.closed} closed, of{" "}
                  {entry.beds ?? 0} beds
                </SrOnly>
              </span>
              {entry.pendingPreparation === undefined || entry.pendingPreparation === 0 ? null : (
                <span className={styles.resultPrep}>{entry.pendingPreparation} being made ready</span>
              )}
            </>
          )}
        </span>
        <span className={styles.resultConfirmed}>
          {entry.kind === "ed" ? (
            edWaiting > 0 ? (
              <>
                {durMinutes(edLongestWaitMinutes)} <span className={styles.resultAgo}>longest</span>
              </>
            ) : null
          ) : entry.kind !== "ward" || entry.confirmedAt === undefined ? null : entry.stale === true ? (
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
          {entry.kind === "ed" ? (
            <>
              <span className={styles.resultReadyNum}>{edWaiting}</span>
              <span className={styles.resultReadyWord}>waiting</span>
            </>
          ) : entry.kind !== "ward" ? null : entry.ready === undefined ? (
            <span className={styles.resultReadyWord}>Not reported</span>
          ) : (
            <>
              <span className={styles.resultReadyNum}>{entry.ready}</span>
              {/* Phone review F-24: "0 to check" read as a count of checks; the stale flag beside it
                  already says the count needs checking. */}
              <span className={styles.resultReadyWord}>ready</span>
            </>
          )}
        </span>
      </button>
      {/* ⚠️ A sibling of the row button, not a child: a button inside a button is invalid HTML. */}
      {isPhone ? null : (
        <button
          type="button"
          className={cx(styles.pinButton, pinned && styles.pinButtonOn)}
          aria-pressed={pinned}
          aria-label={`${pinned ? "Unpin" : "Pin"} ${entry.name}`}
          onClick={() => toggleHubPin(entry.id)}
        >
          <Star className={styles.pinIcon} size={15} aria-hidden="true" />
        </button>
      )}
    </li>
  );
});

export function HubScreen() {
  usePrintableDisclosures();
  const { units, bedReleases, admissions, leaveBeds, refreshRequests, dispatch, movements } = useWardFlow();
  const { now, paused, togglePause } = usePageLive();
  const router = useRouter();
  const isPhone = useIsPhone();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const effectiveQuery = query === "" ? "" : deferredQuery;
  const [kind, setKind] = useState<HubKind | "all">("all");
  const [order, setOrder] = useState<Order>("service");
  // v10: the search, a hero chip and Ready beds only highlight matching places and dim the rest.
  // No row is hidden by a highlight; only the kind switch (a view, not a filter) narrows the list.
  const [highlight, setHighlight] = useState<HubHighlight>("none");
  const readyOnly = highlight === "ready";
  const setReadyOnly = (on: boolean) => {
    startTransition(() => {
      setHighlight(on ? "ready" : "none");
    });
  };
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  // Phone (v10): a tap on a place opens its preview as a bottom sheet with Open in its footer.
  const [phonePreviewOpen, setPhonePreviewOpen] = useState(false);
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
        if (selectedId !== undefined || query !== "" || highlight !== "none") {
          event.preventDefault();
          setQuery("");
          setHighlight("none");
          setSelectedId(undefined);
          inputRef.current?.focus();
        }
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [selectedId, query, highlight]);

  // Audit 11 Oct 2026: an ED row answers the page question with its waiting count and longest
  // wait, read from the same summaries the Home ED strip uses.
  const edWaits = useMemo(
    () => new Map(edOpenSummaries(movements, now).map((summary) => [summary.ed.id, summary])),
    [movements, now],
  );
  // Audit 11 Oct 2026: community teams carry no figures here, so in the All view their section
  // starts folded; the Teams switch still lists them in full.
  const [teamsFoldOpen, setTeamsOpen] = useState(false);
  const entries = useMemo(
    () => hubEntries({ units, bedReleases, admissions, leaveBeds, now }),
    [units, bedReleases, admissions, leaveBeds, now],
  );
  const results = useMemo(() => {
    const base = searchHub(entries, "", kind);
    if (order === "service") return base;
    // Most ready first, inside the same service groups. A stable sort keeps the service order for ties.
    return [...base].sort((a, b) => (b.ready ?? -1) - (a.ready ?? -1));
  }, [entries, kind, order]);
  // The places the search matches. The search highlights them; it never removes a row.
  const queryMatches = useMemo(
    () =>
      effectiveQuery.trim() === ""
        ? undefined
        : new Set(searchHub(entries, effectiveQuery, "all").map((entry) => entry.id)),
    [entries, effectiveQuery],
  );
  const highlighting = queryMatches !== undefined || highlight !== "none";
  // A typed search opens the teams so a team it matches is never folded away.
  const teamsOpen = teamsFoldOpen || queryMatches !== undefined;
  // Category counts are the rows pressing that category shows, so they do not follow the search.
  const counts = useMemo(() => hubCounts(entries, ""), [entries]);
  const isLit = (entry: HubEntry) =>
    (queryMatches === undefined || queryMatches.has(entry.id)) && matchesHighlight(entry, highlight);
  const litResults = results.filter(isLit);
  const litCount = litResults.length;
  const readyBedsCount = useMemo(() => entries.reduce((sum, entry) => sum + (entry.ready ?? 0), 0), [entries]);
  const isFiltered = query !== "" || kind !== "all" || highlight !== "none";

  function resetAllFilters() {
    setQuery("");
    setKind("all");
    setHighlight("none");
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
  // Phone (v10): typed search text narrows the list to the matches (a chip or Ready beds only still
  // highlights). Wider screens keep every row and highlight.
  const phoneSearchFilters = isPhone && queryMatches !== undefined;
  const shownSections = useMemo(
    () =>
      phoneSearchFilters && queryMatches !== undefined
        ? groupedResults(results.filter((entry) => queryMatches.has(entry.id)))
        : sections,
    [phoneSearchFilters, queryMatches, results, sections],
  );
  const shownCount = phoneSearchFilters
    ? results.filter((entry) => queryMatches?.has(entry.id)).length
    : results.length;
  const staleCount = useMemo(() => entries.filter((entry) => entry.stale === true).length, [entries]);
  const oldestConfirmedAt = useMemo(() => {
    const times = entries.flatMap((entry) =>
      entry.kind === "ward" && entry.confirmedAt !== undefined ? [entry.confirmedAt] : [],
    );
    return times.length === 0 ? undefined : Math.min(...times);
  }, [entries]);

  function toggleHighlight(next: HubHighlight) {
    startTransition(() => {
      setHighlight((current) => (current === next ? "none" : next));
    });
  }
  const maxServiceReady = Math.max(1, ...byService.map((row) => row.ready));

  const pinnedIds = usePinnedHubIds();
  const recentIds = useRecentHubIds();

  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const pinned = useMemo(() => pinnedIds.flatMap((id) => byId.get(id) ?? []), [pinnedIds, byId]);
  const recent = useMemo(() => recentIds.flatMap((id) => byId.get(id) ?? []), [recentIds, byId]);
  const isPinned = (id: string) => pinnedIds.includes(id);

  const selected = results.find((entry) => entry.id === selectedId) ?? undefined;
  // Phone "Check first": only a place the current filter shows, so its tap opens a preview.
  const checkFirst = attention.filter((item) => results.some((entry) => entry.id === item.entry.id));
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
    // The arrows walk the highlighted places only, so a search reads as a short list to step through.
    const walk = highlighting ? litResults : results;
    if (walk.length === 0) return;
    event.preventDefault();
    const current = walk.findIndex((entry) => entry.id === selectedId);
    const step = event.key === "ArrowDown" ? 1 : -1;
    const next = current === -1 ? (step === 1 ? 0 : walk.length - 1) : (current + step + walk.length) % walk.length;
    const nextId = walk[next]?.id;
    setSelectedId(nextId);
    if (nextId !== undefined) scrollRowIntoView(nextId);
  }

  function scrollRowIntoView(id: string) {
    window.requestAnimationFrame(() => {
      const row = Array.from(document.querySelectorAll<HTMLElement>("[data-hub-row]")).find(
        (element) => element.dataset.hubRow === id,
      );
      row?.scrollIntoView?.({ block: "nearest" });
    });
  }

  function reveal(id: string) {
    setQuery("");
    setKind("all");
    setHighlight("none");
    setSelectedId(id);
  }

  const handleRowSelect = useCallback(
    (id: string) => {
      select(id);
      if (isPhone) setPhonePreviewOpen(true);
    },
    [isPhone],
  );

  function renderRow(entry: HubEntry) {
    const edSummary = entry.kind === "ed" ? edWaits.get(entry.id) : undefined;
    return (
      <HubPlaceRow
        key={entry.id}
        entry={entry}
        active={entry.id === selectedId}
        dimmed={highlighting && !isLit(entry)}
        pinned={isPinned(entry.id)}
        isPhone={isPhone}
        now={now}
        edWaiting={edSummary?.waiting ?? 0}
        edLongestWaitMinutes={edSummary?.longestWaitMinutes ?? 0}
        onSelect={handleRowSelect}
      />
    );
  }

  /** Phone (v10): a ward's preview sheet body. Four ruled tiles, the bed strip, then short facts. */
  function renderPhoneWardPreview(selected: HubEntry) {
    const beds = selected.beds ?? 0;
    const locked = selected.lockedBeds ?? 0;
    return (
      <div className={styles.phonePreviewBody} data-testid="hub-phone-ward-preview">
        <div className={styles.phoneTiles}>
          <h3 className={styles.srOnly}>Beds</h3>
          <div>
            <span>Ready to admit</span>
            <b>
              {(selected.ready ?? 0) > 0 ? <StatusGlyph tone="success" size={8} /> : null}
              {selected.ready ?? 0}
            </b>
          </div>
          <div>
            <span>{BED_STATE_LABELS.pulled}</span>
            <b>{selected.pulled ?? 0}</b>
          </div>
          <div>
            <span>{BED_STATE_LABELS.closed}, not offered</span>
            <b>{selected.closed ?? 0}</b>
          </div>
          <div>
            <span>{BED_STATE_LABELS.occupied}</span>
            <b>
              {selected.occupied ?? 0} of {beds}
            </b>
          </div>
        </div>
        <BedStrip
          counts={{
            ready: selected.ready ?? 0,
            pulled: selected.pulled ?? 0,
            closed: selected.closed ?? 0,
            occupied: selected.occupied ?? 0,
            pendingPreparation: selected.pendingPreparation,
          }}
          wardName={selected.name}
          className={styles.phoneStrip}
        />
        <dl className={styles.phoneFacts}>
          {selected.confirmedAt === undefined ? null : (
            <div>
              <dt>Confirmed</dt>
              <dd>
                {durMinutes(now - selected.confirmedAt)} ago
                {selected.stale === true ? ", stale" : ""}
                {selectedRequest === undefined ? "" : `, asked ${formatInstantWithDay(selectedRequest.at, now)}`}
              </dd>
            </div>
          )}
          <div>
            <dt>Being made ready</dt>
            <dd>{selected.pendingPreparation ?? 0}</dd>
          </div>
          <div>
            <dt>{BED_STATE_LABELS.onLeave}</dt>
            <dd>{selected.onLeave ?? 0}</dd>
          </div>
          <div>
            <dt>Locked beds</dt>
            <dd>{locked === 0 ? "None" : locked === beds ? `All ${beds}` : `${locked} of ${beds}`}</dd>
          </div>
          <div>
            <dt>Involuntary</dt>
            <dd>{selected.authorised === false ? "Voluntary only" : "Authorised hospital"}</dd>
          </div>
        </dl>
        {renderPhonePreviewLinks(selected)}
      </div>
    );
  }

  /** Phone: Pin and Statistics stay reachable as quiet links under the preview. */
  function renderPhonePreviewLinks(selected: HubEntry) {
    return (
      <div className={styles.phonePreviewLinks}>
        <button type="button" onClick={() => toggleHubPin(selected.id)} aria-pressed={isPinned(selected.id)}>
          {isPinned(selected.id) ? "Unpin" : "Pin"}
        </button>
        {selected.kind === "ward" ? (
          <Link href={wardStatisticsHref(selected.id)}>View statistics</Link>
        ) : selected.kind === "ed" ? (
          <Link href={edStatisticsHref(selected.id)}>View statistics</Link>
        ) : null}
      </div>
    );
  }

  function renderPreview(selected: HubEntry) {
    return (
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
              {selected.cohort === undefined ? null : <span className={styles.infoPill}>{selected.cohort}</span>}
              {selected.security === undefined ? null : <span className={styles.infoPill}>{selected.security}</span>}
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
                      <span className={styles.metaTimestamp}>{formatInstantWithDay(selected.confirmedAt, now)}</span>{" "}
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
                      <span className={styles.factMuted}>Asked {formatInstantWithDay(selectedRequest.at, now)}</span>
                    )}
                  </div>
                )}
                {selected.pendingPreparation === undefined || selected.pendingPreparation === 0 ? null : (
                  <div className={styles.factRow}>
                    <dt>Being made ready</dt>
                    <dd>
                      {selected.pendingPreparation} {selected.pendingPreparation === 1 ? "bed is" : "beds are"} still
                      being cleaned, not yet admittable
                    </dd>
                  </div>
                )}
                {selected.onLeave === undefined || selected.onLeave === 0 ? null : (
                  <div className={styles.factRow}>
                    <dt>{BED_STATE_LABELS.onLeave}</dt>
                    <dd>
                      {selected.onLeave} {selected.onLeave === 1 ? "bed is" : "beds are"} held for a patient on leave,
                      already counted in Occupied
                    </dd>
                  </div>
                )}
                {selected.lockedBeds === undefined || selected.lockedBeds === 0 ? null : (
                  <div className={styles.factRow}>
                    <dt>Locked beds</dt>
                    <dd>
                      {selected.lockedBeds} of {selected.beds ?? 0}. A voluntary patient may still be nursed on one
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
              Statistics are unavailable for this regional entry. Community directory; no page for this regional entry.
            </p>
          ) : null}
          <div className={styles.ctaActions}>
            {/* Ward and ED only: the statistics builders resolve against a real id this entry carries. */}
            {selected.kind === "ward" ? (
              <Link className={buttonClass({ variant: "sec", size: "sm" })} href={wardStatisticsHref(selected.id)}>
                <BarChart2 size={14} aria-hidden="true" />
                View statistics
              </Link>
            ) : selected.kind === "ed" ? (
              <Link className={buttonClass({ variant: "sec", size: "sm" })} href={edStatisticsHref(selected.id)}>
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
          eyebrow={
            isPhone
              ? "Places · Statewide"
              : `Places · Statewide · ${totals.ward} wards, ${totals.ed} EDs, ${totals.community} teams`
          }
          title={
            <>
              <SrOnly>Places, </SrOnly>
              {totals.all} places
            </>
          }
          stats={
            isPhone ? (
              <>
                <HeroStat
                  value={network.ready}
                  label="Beds ready"
                  tone="success"
                  pressed={highlight === "ready"}
                  onToggle={() => toggleHighlight("ready")}
                />
                <HeroStat
                  value={network.pulled}
                  label={BED_STATE_LABELS.pulled}
                  tone="warning"
                  pressed={highlight === "pulled"}
                  onToggle={() => toggleHighlight("pulled")}
                />
                <HeroStat
                  value={staleCount}
                  label="Stale counts"
                  tone={staleCount > 0 ? "warning" : undefined}
                  pressed={highlight === "stale"}
                  onToggle={() => toggleHighlight("stale")}
                />
              </>
            ) : undefined
          }
          aside={<PageLiveChip paused={paused} onTogglePause={togglePause} />}
          bar={
            isPhone ? undefined : (
              <div className={styles.heroChips} role="group" aria-label="Network counts">
                <HeroStat
                  inline
                  value={network.ready}
                  label="Beds ready"
                  tone="success"
                  pressed={highlight === "ready"}
                  onToggle={() => toggleHighlight("ready")}
                />
                <HeroStat
                  inline
                  value={network.pulled}
                  label={BED_STATE_LABELS.pulled}
                  pressed={highlight === "pulled"}
                  onToggle={() => toggleHighlight("pulled")}
                />
                <HeroStat
                  inline
                  value={network.closed}
                  label={BED_STATE_LABELS.closed}
                  pressed={highlight === "closed"}
                  onToggle={() => toggleHighlight("closed")}
                />
                <HeroStat inline value={occupancyShare(network) ?? "Not recorded"} label="Occupancy" />
                <HeroStat
                  inline
                  value={staleCount}
                  label="Stale counts"
                  tone={staleCount > 0 ? "warning" : undefined}
                  pressed={highlight === "stale"}
                  onToggle={() => toggleHighlight("stale")}
                />
              </div>
            )
          }
          foot={
            isPhone ? undefined : (
              <CheckingFoot
                items={[
                  {
                    id: "stale",
                    label: "Stale bed counts",
                    value: staleCount,
                    tone: staleCount > 0 ? "warning" : undefined,
                  },
                  {
                    id: "oldest",
                    label: "Oldest bed count",
                    value: oldestConfirmedAt === undefined ? "Not recorded" : durMinutes(now - oldestConfirmedAt),
                  },
                ]}
                notChecked={["ED and team capacity, no feed"]}
              />
            )
          }
        />

        <div className={styles.hubShell}>
          <Card as="section" className={styles.hubLeft} aria-label="Search results">
            {isPhone ? null : (
              <CardHead
                icon={Network}
                title="The network"
                aside={<span className={styles.headMeta}>Perth and country WA</span>}
              />
            )}
            {isPhone ? (
              /* Phone (v10): the kind switch pins under the header while the places scroll. */
              <div className={styles.phoneKindBar}>
                <Segmented
                  label="Show"
                  items={kindItems.map((item) => (item.id === "community" ? { ...item, label: "Teams" } : item))}
                  value={kind}
                  onChange={(id) => {
                    setKind(id);
                    setSelectedId(undefined);
                  }}
                />
              </div>
            ) : null}
            {isPhone ? (
              <div className={styles.phoneControls}>
                <div className={styles.phoneSearchRow}>
                  <TextInput
                    ref={inputRef}
                    id="hub-search-query"
                    name="query"
                    type="search"
                    icon={Search}
                    boxClassName={styles.phoneSearchBox}
                    aria-label="Search wards, EDs and community teams"
                    placeholder="Search places"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={onSearchKeyDown}
                    onClear={() => {
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                  />
                  <button
                    type="button"
                    className={styles.phoneSortButton}
                    aria-pressed={order === "ready"}
                    onClick={() => setOrder(order === "ready" ? "service" : "ready")}
                  >
                    <ListFilter size={16} aria-hidden="true" />
                    {order === "ready" ? "Most ready" : "By service"}
                  </button>
                </div>
                {highlight !== "none" ? (
                  <p className={styles.phoneListHead} data-testid="hub-highlight-note">
                    <b>
                      {highlight === "ready"
                        ? "Ready beds only"
                        : highlight === "pulled"
                          ? "Pulled beds"
                          : highlight === "stale"
                            ? "Stale counts"
                            : "Matching places"}
                    </b>
                    <span>
                      {litCount} {litCount === 1 ? "place" : "places"}
                      <button
                        type="button"
                        className={styles.clearHighlight}
                        onClick={() => {
                          setHighlight("none");
                          setQuery("");
                        }}
                      >
                        Clear
                      </button>
                    </span>
                  </p>
                ) : queryMatches === undefined && checkFirst[0] ? (
                  <button
                    type="button"
                    className={styles.phoneCheckFirst}
                    onClick={() => {
                      select(checkFirst[0].entry.id);
                      setPhonePreviewOpen(true);
                    }}
                  >
                    <StatusGlyph tone="warning" size={10} />
                    <span className={styles.phoneCheckText}>
                      <b>Check first: {checkFirst[0].entry.name}</b>
                      <span>
                        {checkFirst[0].entry.ready === 0 ? "No ready beds" : `${checkFirst[0].entry.ready ?? 0} ready`}
                        {checkFirst[0].entry.confirmedAt === undefined
                          ? ""
                          : `, count ${durMinutes(now - checkFirst[0].entry.confirmedAt)} old`}
                        {checkFirst.length > 1 ? `. ${checkFirst.length - 1} more need a check.` : "."}
                      </span>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                ) : null}
                {/* Phone review F-24: the hero's shorthand, spelled out once where the list starts. */}
                <p className={styles.phoneKey} data-testid="hub-phone-key">
                  {`${BED_STATE_LABELS.pulled}: ${BED_STATE_DETAILS.pulled.toLowerCase()}. Stale: the ward has not confirmed its count in time.`}
                </p>
              </div>
            ) : null}
            {isPhone ? null : (
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
                    placeholder="Search places"
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
            )}

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
              {queryMatches !== undefined && litCount === 0 ? (
                <p className={styles.emptyState} data-testid="hub-no-match">
                  {/* Names the ACTIVE FILTER: "nothing matches" differs from "nothing of this kind matches". */}
                  No{" "}
                  {kind === "all"
                    ? "ward, emergency department or community team"
                    : KIND_WORD_LONG[kind].toLowerCase()}{" "}
                  matches “{query}”. Try a hospital name or a health service such as “WACHS”.
                  {isPhone ? "" : " Every place stays below."}{" "}
                  <button
                    type="button"
                    className={styles.clearHighlight}
                    onClick={() => {
                      setQuery("");
                      inputRef.current?.focus();
                    }}
                  >
                    Clear search
                  </button>
                </p>
              ) : null}
              {shownSections.map((section) => {
                const sectionBeds = section.key === "ward" ? networkBeds(section.entries) : undefined;
                const sectionShare = sectionBeds === undefined ? undefined : occupancyShare(sectionBeds);
                return (
                  <section key={section.key} aria-label={section.label} className={styles.group}>
                    <div className={styles.groupHeadRow}>
                      <h2 className={styles.groupHead}>
                        {section.label} <Count n={section.entries.length} />
                      </h2>
                      {sectionBeds === undefined ? null : (
                        <span className={styles.groupMeta}>
                          {sectionBeds.ready} ready{sectionShare === undefined ? "" : ` · ${sectionShare} in use`}
                        </span>
                      )}
                    </div>
                    {section.subgroups.length === 0 && section.key === "community" && kind === "all" ? (
                      <>
                        <h3 className={styles.subGroupHead}>
                          <button
                            type="button"
                            className={styles.foldButton}
                            aria-expanded={teamsOpen}
                            aria-controls="hub-teams-list"
                            onClick={() => setTeamsOpen((open) => !open)}
                            data-testid="hub-teams-fold"
                          >
                            <ChevronDown className={styles.foldIcon} size={14} aria-hidden="true" />
                            <span className={styles.subGroupName}>
                              {teamsOpen ? "Hide teams" : `Show ${section.entries.length} teams`}
                            </span>
                            <span className={styles.subGroupMeta}>No bed figures</span>
                          </button>
                        </h3>
                        <ul className={styles.groupList} id="hub-teams-list" hidden={!teamsOpen}>
                          {section.entries.map(renderRow)}
                        </ul>
                      </>
                    ) : section.subgroups.length === 0 ? (
                      <ul className={styles.groupList}>{section.entries.map(renderRow)}</ul>
                    ) : (
                      section.subgroups.map((group) => {
                        const key = `${section.key}-${group.label}`;
                        const open = !folded.has(key);
                        const groupBeds = networkBeds(group.entries);
                        const groupShare = occupancyShare(groupBeds);
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
                                    <span className={styles.subGroupShare}>{groupShare} in use</span>
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
              })}
            </div>
            {isPhone && phoneSearchFilters && shownCount > 0 ? (
              <p className={styles.phoneShownCount}>
                {shownCount} of {totals.all} places shown
              </p>
            ) : null}
            {isPhone ? null : (
              <div className={styles.listFoot}>
                <BedStripLegend />
                {!highlighting ? (
                  <span className={styles.shownCount}>
                    <b>
                      {results.length} of {totals.all}
                    </b>{" "}
                    shown
                  </span>
                ) : (
                  <span className={styles.shownCount} data-testid="hub-highlight-note">
                    <b>
                      {litCount} of {results.length}
                    </b>{" "}
                    highlighted. All rows stay.
                    <button
                      type="button"
                      className={styles.clearHighlight}
                      onClick={() => {
                        setHighlight("none");
                        setQuery("");
                      }}
                    >
                      Clear highlight
                    </button>
                  </span>
                )}
              </div>
            )}
          </Card>

          <aside className={styles.hubRight} aria-label="At a glance" data-wf-rail>
            {selected === undefined || isPhone ? null : renderPreview(selected)}

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
                    {occupancyShare(network) === undefined ? null : (
                      <span className={styles.legendShare}>{occupancyShare(network)} occupancy</span>
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
        {isPhone ? (
          <PhoneSheet
            open={phonePreviewOpen && selected !== undefined}
            onClose={() => setPhonePreviewOpen(false)}
            title={selected?.name ?? "Place"}
            description={
              selected === undefined
                ? undefined
                : [KIND_WORD_LONG[selected.kind], selected.site].filter(Boolean).join(" · ")
            }
            className={styles.phonePreviewSheet}
            data-testid="hub-phone-preview"
            secondary={
              selected === undefined
                ? undefined
                : selected.kind === "ward" && selected.confirmedAt !== undefined && selectedRequest === undefined
                  ? {
                      label: "Ask to confirm",
                      onAction: () =>
                        dispatch({
                          type: "REQUEST_CAPACITY_REFRESH",
                          role: "coordinator",
                          now,
                          unitId: selected.id,
                        }),
                    }
                  : {
                      label: isPinned(selected.id) ? "Unpin" : "Pin",
                      onAction: () => toggleHubPin(selected.id),
                    }
            }
            primary={
              selected === undefined
                ? undefined
                : {
                    label:
                      selected.kind === "community"
                        ? "Open community teams"
                        : selected.kind === "ward"
                          ? "Open ward"
                          : "Open department",
                    onAction: () => {
                      recordHubVisit(selected.id);
                      router.push(selected.href);
                    },
                  }
            }
          >
            {selected === undefined ? null : selected.kind === "ward" ? (
              renderPhoneWardPreview(selected)
            ) : (
              <>
                {renderPreview(selected)}
                {renderPhonePreviewLinks(selected)}
              </>
            )}
          </PhoneSheet>
        ) : null}
      </main>
    </div>
  );
}
