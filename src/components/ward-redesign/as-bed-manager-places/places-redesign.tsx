"use client";

// Fork of src/components/ward-redesign/places/places-redesign.tsx: a site bed manager branch.

import { hasOpenSheet } from "@/components/wf/sheet-focus";
import { areCharacterShortcutsEnabled } from "@/components/ward-management/shell/ward-character-shortcuts";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart2,
  BedDouble,
  Building2,
  ChevronDown,
  ChevronRight,
  ListFilter,
  Network,
  RotateCcw,
  Search,
  Star,
} from "lucide-react";

import {
  Button,
  Card,
  CheckingFoot,
  CardHead,
  Count,
  Hero,
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
import { useWardFlowSelect, useWardNetwork } from "@/components/ward-management/ward-flow-provider";
import {
  groupedResults,
  hubCounts,
  hubEntries,
  needsAttention,
  searchHub,
  unauthorisedWards,
  type HubEntry,
  type HubKind,
} from "@/components/ward-management/hub/hub-derivations";
import { formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { edStatisticsHref, wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { PageLiveChip, usePageLive } from "@/components/ward-management/ward-page-live";

import {
  recordHubVisit,
  toggleHubPin,
  useRecentHubIds,
  usePinnedHubIds,
} from "@/components/ward-management/hub/hub-browser-memory";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";

import styles from "@/components/ward-management/hub/hub.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { capacityRequestIsOpen } from "@/components/ward-management/ward/ward-buzz-keys";
import { KIND_WORD_LONG } from "@/components/ward-management/hub/hub-screen-helpers";
import { WARD_CAPACITY_HREF } from "@/components/ward-management/ward-nav";

import { PlaceRow } from "@/components/ward-redesign/places/place-row";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { ACCESS_ROLE_LABELS } from "@/components/ward-management/ward-role-access";
import { siteByCode } from "@/components/ward-management/ward-sites";
import directory from "@/components/ward-redesign/places/places-redesign.module.css";

/** Redesign: a directory orders by service or by name; with no bed figures there is no "Most ready". */
type Order = "service" | "name";
/** Ward services shown open before the rest fold, when nothing is typed. */
const OPEN_SERVICES = 2;
/** Rows a group shows before "Show more". */
const GROUP_ROWS = 8;
const ALL_WARDS_HREF = "/ward-flow/wards";
/** needsAttention's own words for a stale ward, used alone so no bed figure is quoted here. */
const STALE_REASON = "The last bed confirmation is stale — check with the ward.";

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
 *
 * Redesign mock-up (review point 21): Places is a directory to find a place and open it. It shows no
 * bed figures of its own; Capacity's bed map and All wards carry beds. Search sits in the header and
 * narrows the list; services after the first two fold, and in All, EDs and teams fold to one row each.
 */

export function AsBedManagerPlaces() {
  usePrintableDisclosures();
  const { units, bedReleases, admissions, leaveBeds, refreshRequests, dispatch } = useWardFlowSelect(
    "units",
    "bedReleases",
    "admissions",
    "leaveBeds",
    "refreshRequests",
    "dispatch",
  );
  const { now, paused, togglePause } = usePageLive();
  // ROLE BRANCH (bed_manager, D-80): a site bed manager's Places opens on its own site's wards,
  // the places it may open. Every other place stays listed as place information (finding a ward,
  // its cohort and security), with no Open, no Ask to confirm and no statistics it cannot read.
  const access = useEffectiveWardAccess();
  const canOpen = useCanOpenHref();
  const siteCode = access.role === "bed_manager" && access.scope.kind === "site" ? access.scope.siteCode : undefined;
  const deskSite = siteCode === undefined ? undefined : siteByCode(siteCode);
  const closedSentence = `This screen is not part of the ${ACCESS_ROLE_LABELS[access.role]} desk.`;
  const router = useRouter();
  const isPhone = useIsPhone();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const effectiveQuery = query === "" ? "" : deferredQuery;
  const [kind, setKind] = useState<HubKind | "all">("all");
  const [order, setOrder] = useState<Order>("service");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  // Phone (v10): a tap on a place opens its preview as a bottom sheet with Open in its footer.
  const [phonePreviewOpen, setPhonePreviewOpen] = useState(false);
  // Redesign: fold rows the reader has flipped from their default (services 3+ and, in All, EDs and
  // teams start folded).
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(() => new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleGlobalKeyDown(event: globalThis.KeyboardEvent) {
      if (areCharacterShortcutsEnabled() && event.key === "/" && document.activeElement !== inputRef.current) {
        const target = event.target as HTMLElement | null;
        const tagName = target?.tagName?.toLowerCase();
        if (tagName !== "input" && tagName !== "textarea" && tagName !== "select" && !target?.isContentEditable) {
          event.preventDefault();
          inputRef.current?.focus();
        }
      } else if (
        event.key === "Escape" &&
        document.activeElement !== inputRef.current &&
        // UISR-01: Escape that closed a sheet on top (or the preview sheet) is not the page's.
        !event.defaultPrevented &&
        !hasOpenSheet()
      ) {
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

  const wardNetwork = useWardNetwork();
  const entries = useMemo(
    () => hubEntries({ units, bedReleases, admissions, leaveBeds, now, sites: wardNetwork.sites }),
    [units, bedReleases, admissions, leaveBeds, now, wardNetwork.sites],
  );
  const results = useMemo(() => {
    const base = searchHub(entries, "", kind);
    if (order === "service") return base;
    // A to Z, inside the same service groups.
    return [...base].sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, kind, order]);
  // The places the search matches. Redesign: on every screen size the search narrows the list to them.
  const queryMatches = useMemo(
    () =>
      effectiveQuery.trim() === ""
        ? undefined
        : new Set(searchHub(entries, effectiveQuery, "all").map((entry) => entry.id)),
    [entries, effectiveQuery],
  );
  const searching = queryMatches !== undefined;
  // Category counts are the rows pressing that category shows, so they do not follow the search.
  const counts = useMemo(() => hubCounts(entries, ""), [entries]);
  const isFiltered = query !== "" || kind !== "all";

  function resetAllFilters() {
    setQuery("");
    setKind("all");
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
  // ROLE BRANCH (bed_manager): only its own wards' stale counts are its to chase.
  const attention = useMemo(
    () =>
      needsAttention(entries).filter(
        (item) => item.entry.stale === true && (deskSite === undefined || canOpen(item.entry.href)),
      ),
    [entries, deskSite, canOpen],
  );
  const ownEntries = useMemo(
    () => (deskSite === undefined ? [] : entries.filter((entry) => entry.kind === "ward" && canOpen(entry.href))),
    [entries, deskSite, canOpen],
  );
  const unauthorised = useMemo(() => unauthorisedWards(entries), [entries]);
  const sections = useMemo(() => groupedResults(results), [results]);
  // Wards per service, read from the same grouping the list uses (a count of places, not beds).
  const wardServices = useMemo(
    () => groupedResults(entries).find((section) => section.key === "ward")?.subgroups ?? [],
    [entries],
  );
  const shownSections = useMemo(
    () =>
      queryMatches !== undefined ? groupedResults(results.filter((entry) => queryMatches.has(entry.id))) : sections,
    [queryMatches, results, sections],
  );
  // In list order: services in their order, then EDs, then teams.
  const shownEntries = useMemo(
    () =>
      shownSections.flatMap((section) =>
        section.subgroups.length > 0 ? section.subgroups.flatMap((group) => group.entries) : section.entries,
      ),
    [shownSections],
  );
  // The rows on screen now (folded groups left out), for the arrow keys and the first preview.
  const visibleEntries = shownSections.flatMap((section) =>
    section.subgroups.length > 0
      ? section.subgroups.flatMap((group, index) =>
          searching || index < OPEN_SERVICES !== flipped.has(`${section.key}-${group.label}`) ? group.entries : [],
        )
      : kind !== "all" || searching || flipped.has(section.key)
        ? section.entries
        : [],
  );
  const shownCount = shownEntries.length;
  // ROLE BRANCH (bed_manager): the oldest count the desk can act on is its own site's.
  const oldestConfirmedAt = useMemo(() => {
    const times = (deskSite === undefined ? entries : ownEntries).flatMap((entry) =>
      entry.kind === "ward" && entry.confirmedAt !== undefined ? [entry.confirmedAt] : [],
    );
    return times.length === 0 ? undefined : Math.min(...times);
  }, [entries, ownEntries, deskSite]);

  const pinnedIds = usePinnedHubIds();
  const recentIds = useRecentHubIds();

  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const pinned = useMemo(() => pinnedIds.flatMap((id) => byId.get(id) ?? []), [pinnedIds, byId]);
  const recent = useMemo(() => recentIds.flatMap((id) => byId.get(id) ?? []), [recentIds, byId]);
  const isPinned = (id: string) => pinnedIds.includes(id);

  // Redesign (no empty panels): on wider screens the preview opens on the first place listed.
  const selected =
    results.find((entry) => entry.id === selectedId) ??
    (isPhone ? undefined : (pinned[0] ?? ownEntries[0] ?? visibleEntries[0]));
  // Phone "Check first": only a place the current filter shows, so its tap opens a preview.
  const checkFirst = attention.filter((item) => results.some((entry) => entry.id === item.entry.id));
  const selectedRequest =
    selected === undefined
      ? undefined
      : refreshRequests
          .filter(
            (entry) =>
              entry.unitId === selected.id &&
              capacityRequestIsOpen(entry, units.find((unit) => unit.id === selected.id)?.allocatable),
          )
          .at(-1);

  function select(id: string) {
    setSelectedId(id);
  }

  function toggleFold(key: string) {
    setFlipped((current) => {
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
      // An explicit choice, or the top match of a typed search.
      const target = selectedId !== undefined || searching ? selected : undefined;
      if (target !== undefined) router.push(target.href);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    // The arrows walk the places listed, so a search reads as a short list to step through.
    const walk = visibleEntries;
    if (walk.length === 0) return;
    event.preventDefault();
    const current = walk.findIndex((entry) => entry.id === selected?.id);
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
    setSelectedId(id);
    // A ward in a folded service opens its service first.
    const index = wardServices.findIndex((group) => group.entries.some((entry) => entry.id === id));
    const key = index < 0 ? undefined : `ward-${wardServices[index].label}`;
    if (key !== undefined && index >= OPEN_SERVICES && !flipped.has(key)) toggleFold(key);
    scrollRowIntoView(id);
  }

  const handleRowSelect = useCallback(
    (id: string) => {
      select(id);
      if (isPhone) setPhonePreviewOpen(true);
    },
    [isPhone],
  );

  function renderRow(entry: HubEntry) {
    return (
      <PlaceRow
        key={entry.id}
        entry={entry}
        active={entry.id === selected?.id}
        pinned={isPinned(entry.id)}
        isPhone={isPhone}
        now={now}
        onSelect={handleRowSelect}
      />
    );
  }

  /** Redesign: a fold row (a service, or in All the EDs or the teams) and its list with Show more. */
  function renderFold(key: string, label: string, meta: string, entries: HubEntry[], openByDefault: boolean) {
    const open = searching || openByDefault !== flipped.has(key);
    return (
      <div key={key}>
        <h3 className={styles.subGroupHead}>
          <button
            type="button"
            className={styles.foldButton}
            aria-expanded={open}
            aria-controls={`hub-fold-${key}`}
            onClick={() => toggleFold(key)}
            disabled={searching}
            data-testid={key === "community" ? "hub-teams-fold" : undefined}
          >
            <ChevronDown className={styles.foldIcon} size={14} aria-hidden="true" />
            <span className={styles.subGroupName}>{label}</span>
            <span className={styles.subGroupCount}>{meta}</span>
          </button>
        </h3>
        {open ? <GroupList id={`hub-fold-${key}`} entries={entries} renderRow={renderRow} /> : null}
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
        {selected.kind === "ward" && canOpen(wardStatisticsHref(selected.id)) ? (
          <Link href={wardStatisticsHref(selected.id)}>View statistics</Link>
        ) : selected.kind === "ed" && canOpen(edStatisticsHref(selected.id)) ? (
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
          {/* Redesign: no close button. The preview always shows a place (the first listed until one
              is chosen); Escape still clears a choice. */}
        </div>

        <div className={styles.detailBody} role="region" aria-label={`${selected.name} details`} tabIndex={0}>
          {selected.kind === "ward" ? (
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
                  {deskSite !== undefined ? (
                    // ROLE BRANCH (bed_manager): asking is the coordinator's; this desk confirms its own
                    // wards itself, on the ward's page, and other sites' counts are not its to chase.
                    canOpen(selected.href) ? (
                      <Link className={buttonClass({ variant: "sec", size: "sm" })} href={selected.href}>
                        Confirm beds
                      </Link>
                    ) : null
                  ) : selectedRequest === undefined ? (
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
              {/* Review point 21: beds are read on Capacity's bed map and All wards, not here. */}
              <div className={styles.factRow}>
                <dt>Beds</dt>
                <dd className={directory.bedsElsewhere}>
                  <BedDouble size={14} aria-hidden="true" />
                  <span>
                    On <Link href={WARD_CAPACITY_HREF}>Capacity&rsquo;s bed map</Link> and{" "}
                    <Link href={ALL_WARDS_HREF}>All wards</Link>
                  </span>
                </dd>
              </div>
            </dl>
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
            {selected.kind === "ward" && canOpen(wardStatisticsHref(selected.id)) ? (
              <Link className={buttonClass({ variant: "sec", size: "sm" })} href={wardStatisticsHref(selected.id)}>
                <BarChart2 size={14} aria-hidden="true" />
                View statistics
              </Link>
            ) : selected.kind === "ed" && canOpen(edStatisticsHref(selected.id)) ? (
              <Link className={buttonClass({ variant: "sec", size: "sm" })} href={edStatisticsHref(selected.id)}>
                <BarChart2 size={14} aria-hidden="true" />
                View statistics
              </Link>
            ) : null}
            {canOpen(selected.href) ? (
              <Link
                className={buttonClass({ variant: "pri", size: "sm" })}
                href={selected.href}
                onClick={() => recordHubVisit(selected.id)}
              >
                {selected.kind === "community" ? "Open community teams" : `Open ${selected.name}`}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            ) : (
              // ROLE BRANCH (bed_manager and every scoped desk): greyed, with the closed page's sentence.
              <Button size="sm" variant="sec" disabledReason={closedSentence}>
                {selected.kind === "community" ? "Open community teams" : `Open ${selected.name}`}
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  const kindItems = (["all", "ward", "ed", "community"] as const).map((id) => ({
    id,
    label: id === "all" ? "All" : id === "ward" ? "Wards" : id === "ed" ? "EDs" : "Teams",
    count: counts[id],
  }));

  const searchBox = (
    <TextInput
      ref={inputRef}
      id="hub-search-query"
      name="query"
      type="search"
      icon={Search}
      boxClassName={isPhone ? styles.phoneSearchBox : directory.heroSearch}
      aria-label="Search wards, EDs and community teams"
      aria-describedby={isPhone ? undefined : "hub-search-hint"}
      placeholder={isPhone ? "Search places" : "Search a ward, hospital, ED, team or health service"}
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      onKeyDown={onSearchKeyDown}
      trailing={isPhone || query !== "" ? undefined : <Kbd>/</Kbd>}
      onClear={() => {
        setQuery("");
        inputRef.current?.focus();
      }}
    />
  );

  return (
    <div className={styles.screen} data-testid="ward-hub-page" data-ward-design="v6">
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          className={styles.hubHero}
          eyebrow={
            isPhone
              ? `Places · ${deskSite?.name ?? "Statewide"}`
              : `Places · ${deskSite?.name ?? "Statewide"} · ${totals.ward} wards, ${totals.ed} EDs, ${totals.community} teams in the network`
          }
          title={
            <>
              <SrOnly>Places, </SrOnly>
              {deskSite
                ? `${ownEntries.length} ${ownEntries.length === 1 ? "ward" : "wards"} at your site`
                : `${totals.all} places`}
            </>
          }
          titleMeta={deskSite ? `${totals.all} places in the network, as place information` : undefined}
          aside={<PageLiveChip paused={paused} onTogglePause={togglePause} />}
          // Redesign: search first, in the header. The bed chips are gone (review point 21).
          bar={isPhone ? undefined : searchBox}
          foot={
            isPhone ? undefined : (
              <CheckingFoot
                items={[
                  {
                    id: "oldest",
                    label: deskSite ? "Oldest bed count at your site" : "Oldest bed count",
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
                  items={kindItems}
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
                  {searchBox}
                  <button
                    type="button"
                    className={styles.phoneSortButton}
                    aria-pressed={order === "name"}
                    onClick={() => setOrder(order === "name" ? "service" : "name")}
                  >
                    <ListFilter size={16} aria-hidden="true" />
                    {order === "name" ? "A to Z" : "By service"}
                  </button>
                </div>
                {queryMatches === undefined && checkFirst[0] ? (
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
                        Stale count
                        {checkFirst[0].entry.confirmedAt === undefined
                          ? ""
                          : `, confirmed ${durMinutes(now - checkFirst[0].entry.confirmedAt)} ago`}
                        {checkFirst.length > 1 ? `. ${checkFirst.length - 1} more need a check.` : "."}
                      </span>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                ) : null}
                {/* Phone review F-24: the hero's shorthand, spelled out once where the list starts. */}
                <p className={styles.phoneKey} data-testid="hub-phone-key">
                  Stale: the ward has not confirmed its count in time.
                </p>
              </div>
            ) : (
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
                  <span className={styles.controlLabel}>Order</span>
                  <Segmented
                    label="Order"
                    items={[
                      { id: "service" as const, label: "Service" },
                      { id: "name" as const, label: "A to Z" },
                    ]}
                    value={order}
                    onChange={setOrder}
                  />
                  {isFiltered ? (
                    <span className={styles.controlsEnd}>
                      <button
                        type="button"
                        className={buttonClass({ variant: "ghost", size: "sm" })}
                        onClick={resetAllFilters}
                        aria-label="Reset all filters and search"
                      >
                        <RotateCcw size={13} aria-hidden="true" />
                        Reset
                      </button>
                    </span>
                  ) : null}
                </div>
                {/* Announced through `aria-describedby`. Escape clears BOTH the search and the preview. */}
                <SrOnly id="hub-search-hint">
                  Typing narrows the list. Arrow keys preview a place, Enter opens it, Escape clears the search.
                </SrOnly>
              </div>
            )}

            {isPhone ? null : (
              <div className={cx(styles.listHead, directory.listHead)} aria-hidden="true">
                <span>Place</span>
                <span>Bed count confirmed</span>
              </div>
            )}

            {/*
              ⚠️ **A SECTION IS NOT A LIST ITEM.** Sections are real `<section>`s with real headings,
              and the only `<li>`s on this screen are result rows, so anything counting rows (a test,
              a screen reader announcing "list, 16 items") counts places, not headings.
            */}
            <div className={styles.listScroll} id="hub-results" role="region" aria-label="Network results" tabIndex={0}>
              {searching && shownCount === 0 ? (
                <p className={styles.emptyState} data-testid="hub-no-match">
                  {/* Names the ACTIVE FILTER: "nothing matches" differs from "nothing of this kind matches". */}
                  No{" "}
                  {kind === "all"
                    ? "ward, emergency department or community team"
                    : KIND_WORD_LONG[kind].toLowerCase()}{" "}
                  matches “{query}”. Try a hospital name or a health service such as “WACHS”.{" "}
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
              {deskSite !== undefined && ownEntries.length > 0 && !searching && (kind === "all" || kind === "ward") ? (
                // ROLE BRANCH (bed_manager): the desk's own site first, open, before the network.
                <section aria-label={`Your site, ${deskSite.name}`} className={styles.group}>
                  <div className={styles.groupHeadRow}>
                    <h2 className={styles.groupHead}>
                      Your site · {deskSite.name} <Count n={ownEntries.length} />
                    </h2>
                  </div>
                  <GroupList id="hub-list-own-site" entries={ownEntries} renderRow={renderRow} />
                </section>
              ) : null}
              {shownSections.map((section) => (
                <section key={section.key} aria-label={section.label} className={styles.group}>
                  <div className={styles.groupHeadRow}>
                    <h2 className={styles.groupHead}>
                      {section.label} <Count n={section.entries.length} />
                    </h2>
                  </div>
                  {section.subgroups.length > 0 ? (
                    section.subgroups.map((group, index) =>
                      renderFold(
                        `${section.key}-${group.label}`,
                        group.label,
                        `${group.entries.length} ${group.entries.length === 1 ? "ward" : "wards"}`,
                        group.entries,
                        index < OPEN_SERVICES,
                      ),
                    )
                  ) : kind === "all" ? (
                    // In All, EDs and teams fold to one row each; their own switch lists them in full.
                    renderFold(
                      section.key,
                      section.key === "ed"
                        ? `${section.entries.length} emergency departments`
                        : `${section.entries.length} community teams`,
                      section.key === "ed" ? "Each opens its department page" : "No beds",
                      section.entries,
                      false,
                    )
                  ) : (
                    <GroupList id={`hub-list-${section.key}`} entries={section.entries} renderRow={renderRow} />
                  )}
                </section>
              ))}
            </div>
            <div className={styles.listFoot}>
              <span className={styles.shownCount}>
                <b>{searching ? `${shownCount} of ${totals.all}` : `${results.length} of ${totals.all}`}</b>{" "}
                {searching ? "match" : "listed"}
              </span>
              <span className={directory.bedsNote}>
                <BedDouble size={14} aria-hidden="true" />
                <span>
                  Beds are on <Link href={WARD_CAPACITY_HREF}>Capacity&rsquo;s bed map</Link> and{" "}
                  <Link href={ALL_WARDS_HREF}>All wards</Link>
                </span>
              </span>
            </div>
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
                <div className={styles.glanceSection}>
                  <h3 className={styles.sectionLabel}>
                    Needs a check <Count n={attention.length} />
                  </h3>
                  {attention.length === 0 ? (
                    <p className={styles.nothing}>
                      {deskSite
                        ? `No ward at ${deskSite.name} is reporting a stale bed count right now.`
                        : "No ward is reporting a stale bed count right now."}
                    </p>
                  ) : (
                    <ul className={styles.queue}>
                      {attention.slice(0, 4).map(({ entry }) => (
                        <li key={entry.id} className={styles.decisionRow}>
                          <StatusGlyph tone="warning" size={8} />
                          <div className={styles.decisionBody}>
                            <span className={styles.decisionRef}>{entry.name}</span>
                            <p className={styles.decisionReason}>{STALE_REASON}</p>
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
                  {attention.length > 4 ? (
                    <p className={styles.nothing}>{attention.length - 4} more marked Stale count in the list.</p>
                  ) : null}
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

                <div className={styles.glanceSection}>
                  <div className={styles.sectionHeadRow}>
                    <h3 className={styles.sectionLabel}>Wards by service</h3>
                    <span className={styles.sectionHint}>Tap to search</span>
                  </div>
                  <ul className={directory.serviceList} aria-label="Wards by health service">
                    {wardServices.map((group) => (
                      <li key={group.label}>
                        <button
                          type="button"
                          className={directory.serviceRow}
                          onClick={() => {
                            setQuery(group.label);
                            if (kind !== "all" && kind !== "ward") setKind("all");
                            inputRef.current?.focus();
                          }}
                        >
                          <span>{group.label}</span>
                          <span className={directory.serviceCount}>
                            {group.entries.length} {group.entries.length === 1 ? "ward" : "wards"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
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
                            <span className={styles.memoryStat}>{KIND_WORD_LONG[entry.kind]}</span>
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
                            <span className={styles.memoryStat}>{KIND_WORD_LONG[entry.kind]}</span>
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
          note="Real hospital network; invented bed figures and community team names · Not approved for clinical use"
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
                : deskSite === undefined &&
                    selected.kind === "ward" &&
                    selected.confirmedAt !== undefined &&
                    selectedRequest === undefined
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
              selected === undefined || !canOpen(selected.href)
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
            {selected === undefined ? null : (
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

/** Redesign: a group's rows, the first eight then "Show more" (owner rule for long lists). */
function GroupList({
  id,
  entries,
  renderRow,
}: {
  id: string;
  entries: HubEntry[];
  renderRow: (entry: HubEntry) => ReactNode;
}) {
  const [limit, setLimit] = useState(GROUP_ROWS);
  const rest = entries.length - limit;
  return (
    <>
      <ul className={styles.groupList} id={id}>
        {entries.slice(0, limit).map(renderRow)}
      </ul>
      {rest > 0 ? (
        <button type="button" className={directory.showMore} onClick={() => setLimit((n) => n + GROUP_ROWS * 2)}>
          Show more <span className={directory.showMoreCount}>{rest} more</span>
        </button>
      ) : null}
    </>
  );
}
