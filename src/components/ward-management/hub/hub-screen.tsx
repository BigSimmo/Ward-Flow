"use client";

import { hasOpenSheet } from "@/components/wf/sheet-focus";
import { areCharacterShortcutsEnabled } from "@/components/ward-management/shell/ward-character-shortcuts";
import {
  startTransition,
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
  Kbd,
  PanelDrawer,
  DrawerFootRow,
  Segmented,
  ShowMoreRow,
  foldHidden,
  foldLimit,
  SrOnly,
  StatusGlyph,
  StatusPill,
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
import {
  edStatisticsHref,
  raiseReferralHref,
  wardStatisticsHref,
} from "@/components/ward-management/shell/ward-facade";
import { openReferralSheet } from "@/components/ward-management/shell/ward-drawer-bus";
import { wardRaise } from "@/components/ward-management/ward-flow-raise";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import { communityTeamSuburbs, placePeople, type PlacePerson } from "./hub-place-people";
import { PageLiveChip, usePageLive } from "@/components/ward-management/ward-page-live";

import {
  recordHubVisit,
  toggleHubPin,
  useRecentHubIds,
  usePinnedHubIds,
} from "@/components/ward-management/hub/hub-browser-memory";
import { usePrintableDisclosures } from "@/components/ward-management/use-printable-disclosures";

import { useWardFormSave } from "../use-ward-form-save";
import styles from "./hub.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { HubPlaceRow } from "./hub-place-row";
import { PlacesTrack } from "./places-track";
import { useHubDesk } from "./hub-desk";
import { capacityRequestIsOpen } from "@/components/ward-management/ward/ward-buzz-keys";
import {
  GROUP_ROWS,
  KIND_WORD_LONG,
  OPEN_SERVICES,
  SECURITY_WORD,
  STALE_REASON,
  placeFacts,
  type Order,
} from "./hub-screen-helpers";

/**
 * PLACES (v6) — one place to reach every ward, emergency department and community team.
 *
 * ⚠️ **EVERY FIGURE ON THIS SCREEN IS DERIVED, NEVER COMPUTED HERE.** `hub-derivations.ts` owns the
 * arithmetic and the clinical rules; this file renders what it returns.
 *
 * Layout follows design/pages-v6/Places.png: a hero band, then "At a glance" as an unscrolled summary
 * above "The network" list at full width. Drawer review (6 Nov 2026): a chosen place opens in the
 * kit right drawer, so the page keeps one scroll. The mockup's drive-time controls
 * (Drive from, Nearest, From Peel) and its 24-hour ready-beds chart have no data in this app and
 * are left out rather than drawn as dead controls.
 *
 * Review point 21 (core pages review, Josh approved 31 Oct 2026): Places is a directory to find a
 * place and open it. It shows no bed figures of its own; Capacity's bed map and All wards carry
 * beds. Search sits in the header and narrows the list; services after the first two fold, and in
 * All, EDs and teams fold to one row each.
 */

export function HubScreen() {
  usePrintableDisclosures();
  const {
    units,
    bedReleases,
    admissions,
    leaveBeds,
    refreshRequests,
    movements,
    patients,
    referrals,
    plannedAdmissions,
    dispatch,
  } = useWardFlowSelect(
    "units",
    "bedReleases",
    "admissions",
    "leaveBeds",
    "refreshRequests",
    "movements",
    "patients",
    "referrals",
    "plannedAdmissions",
    "dispatch",
  );
  const { now, paused, togglePause } = usePageLive();
  // ROLE BRANCH (bed_manager, D-80): a site bed manager's own site's wards come first.
  const { site: deskSite, canOpen, closedSentence } = useHubDesk();
  const router = useRouter();
  const isPhone = useIsPhone();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const effectiveQuery = query === "" ? "" : deferredQuery;
  const [kind, setKind] = useState<HubKind | "all">("all");
  const [order, setOrder] = useState<Order>("service");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  // Drawer review (6 Nov 2026): a chosen place opens in the kit drawer at every width. The arrow
  // keys still walk the list (the highlighted row is what Enter opens) without opening the drawer.
  const [previewOpen, setPreviewOpen] = useState(false);
  // Fold rows the reader has flipped from their default (services 3+ and, in All, EDs and teams
  // start folded).
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
  // The places the search matches. On every screen size the search narrows the list to them.
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

  /** A kind switch re-renders the whole list, so it yields to typing and taps (INP). */
  function chooseKind(id: HubKind | "all") {
    startTransition(() => {
      setKind(id);
      setSelectedId(undefined);
    });
  }
  function chooseOrder(next: Order) {
    startTransition(() => setOrder(next));
  }

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
  // Stale counts only, in needsAttention's own words. ROLE BRANCH (bed_manager): only its own
  // wards' stale counts are its to chase.
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
  // ROLE BRANCH (bed_manager): the site's own wards head the list once, in their own group, so the
  // service groups below leave them out instead of listing the same rows twice.
  const ownShown = deskSite !== undefined && ownEntries.length > 0 && !searching && (kind === "all" || kind === "ward");
  const ownIds = useMemo(() => new Set(ownShown ? ownEntries.map((entry) => entry.id) : []), [ownShown, ownEntries]);
  const sections = useMemo(() => groupedResults(results.filter((entry) => !ownIds.has(entry.id))), [results, ownIds]);
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
  // Under the site's own group, the network's wards read as the other wards.
  const sectionLabel = (section: { key: string; label: string }) =>
    ownShown && section.key === "ward" ? "Other wards" : section.label;
  // In list order: services in their order, then EDs, then teams.
  const shownEntries = useMemo(
    () =>
      shownSections.flatMap((section) =>
        section.subgroups.length > 0 ? section.subgroups.flatMap((group) => group.entries) : section.entries,
      ),
    [shownSections],
  );
  // The rows on screen now (folded groups left out), for the arrow keys and the first preview.
  const visibleEntries = (ownShown ? ownEntries : []).concat(
    shownSections.flatMap((section) =>
      section.subgroups.length > 0
        ? section.subgroups.flatMap((group, index) =>
            searching || index < OPEN_SERVICES !== flipped.has(`${section.key}-${group.label}`) ? group.entries : [],
          )
        : kind !== "all" || searching || flipped.has(section.key)
          ? section.entries
          : [],
    ),
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

  // On wider screens the keyboard cursor starts on the first place listed (the drawer opens only on a
  // choice). While a search is typed, the choice and its fallback come from the matches only, so
  // Enter never opens a place the list is not showing.
  const listed = queryMatches !== undefined ? results.filter((entry) => queryMatches.has(entry.id)) : results;
  const selected =
    listed.find((entry) => entry.id === selectedId) ??
    (isPhone ? undefined : searching ? visibleEntries[0] : (pinned[0] ?? ownEntries[0] ?? visibleEntries[0]));
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

  const refreshSave = useWardFormSave(`places-refresh:${selected?.id ?? "none"}`);

  // PL1 follow-up (Josh, 4 Nov 2026): the band's title is a task. A ward whose bed confirmation is
  // stale needs a check; the coordinator asks it, and a site desk confirms its own on the ward's page.
  const staleWards = (deskSite === undefined ? entries : ownEntries).filter(
    (entry) => entry.kind === "ward" && entry.stale === true,
  );
  const unasked = staleWards.filter(
    (entry) =>
      !refreshRequests.some(
        (request) =>
          request.unitId === entry.id &&
          capacityRequestIsOpen(request, units.find((unit) => unit.id === entry.id)?.allocatable),
      ),
  );
  const wardsWord = (n: number) => `${n} ${n === 1 ? "ward" : "wards"}`;
  const bandTask: { title: string; action?: ReactNode } = (() => {
    if (deskSite !== undefined) {
      const first = staleWards.find((entry) => canOpen(entry.href));
      if (staleWards.length === 0) return { title: "Your site's bed counts are current" };
      return {
        title: `${wardsWord(staleWards.length)} at your site ${staleWards.length === 1 ? "needs" : "need"} a bed check`,
        action:
          first === undefined ? undefined : (
            <Link className={buttonClass({ variant: "onHero", size: "sm" })} href={first.href}>
              Confirm beds
            </Link>
          ),
      };
    }
    if (unasked.length > 0) {
      return {
        title: `${wardsWord(unasked.length)} ${unasked.length === 1 ? "needs" : "need"} a bed check`,
        action: (
          <button
            type="button"
            className={buttonClass({ variant: "onHero", size: "sm" })}
            onClick={() => {
              const raise = wardRaise(dispatch, "coordinator", now);
              for (const entry of unasked) raise("REQUEST_CAPACITY_REFRESH", { unitId: entry.id });
            }}
          >
            {unasked.length === 1 ? `Ask ${unasked[0].name}` : `Ask all ${unasked.length}`}
          </button>
        ),
      };
    }
    if (staleWards.length > 0) {
      return { title: `${wardsWord(staleWards.length)} asked to confirm beds` };
    }
    return { title: "Every ward's bed count is current" };
  })();

  // PL1 follow-up (Josh, 4 Nov 2026): the people a place's panel names, and the suburbs a team covers.
  const resolvePerson = useMemo(
    () => createPatientResolver({ patients, referrals, movements, plannedAdmissions }),
    [patients, referrals, movements, plannedAdmissions],
  );
  // Plain derivations: the React Compiler memoises them, and a manual memo on `selected` it cannot keep.
  const selectedPeople = selected === undefined ? [] : placePeople(selected, movements, resolvePerson);
  const selectedSuburbs = selected?.kind === "community" ? communityTeamSuburbs(selected.name) : [];
  // One lead action per kind: Refer here for a ward, New referral from a team, Open for an ED.
  const leadReferral = (() => {
    if (selected === undefined || selected.kind === "ed") return undefined;
    const href =
      selected.kind === "ward"
        ? raiseReferralHref({ refer: "ward", unitIds: [selected.id] })
        : raiseReferralHref({ source: "community", teamId: selected.id });
    if (!canOpen(href)) return undefined;
    return { href, label: selected.kind === "ward" ? "Refer here" : "New referral" };
  })();

  function select(id: string) {
    setSelectedId(id);
    setPreviewOpen(true);
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
      if (target !== undefined && canOpen(target.href)) router.push(target.href);
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
    setPreviewOpen(true);
    // A ward in a folded service opens its service first (the site desk's own wards are never folded).
    const index = wardServices.findIndex((group) => group.entries.some((entry) => entry.id === id));
    const key = index < 0 ? undefined : `ward-${wardServices[index].label}`;
    const own = deskSite !== undefined && ownEntries.some((entry) => entry.id === id);
    if (key !== undefined && !own && index >= OPEN_SERVICES && !flipped.has(key)) toggleFold(key);
    scrollRowIntoView(id);
  }

  const handleRowSelect = useCallback((id: string) => {
    setSelectedId(id);
    setPreviewOpen(true);
  }, []);

  function renderRow(entry: HubEntry) {
    return (
      <HubPlaceRow
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

  /** A fold row (a ward service) and its list with Show more. */
  function renderFold(key: string, label: string, meta: string, entries: HubEntry[], openByDefault: boolean) {
    const open = searching || openByDefault !== flipped.has(key);
    return (
      <div key={key}>
        <h3 className={styles.subGroupHead}>
          <button
            type="button"
            className={styles.foldButton}
            aria-expanded={open}
            aria-controls={hubFoldId(key)}
            onClick={() => toggleFold(key)}
            disabled={searching}
          >
            <ChevronDown className={styles.foldIcon} size={14} aria-hidden="true" />
            <span className={styles.foldName}>{label}</span>
            <span className={styles.subGroupCount}>{meta}</span>
          </button>
        </h3>
        {open ? (
          <GroupList id={hubFoldId(key)} entries={entries} renderRow={renderRow} selectedId={selected?.id} />
        ) : null}
      </div>
    );
  }

  /** In All, a section (EDs or teams) whose heading is its own fold row, with the count once. */
  function renderSectionFold(key: string, label: string, entries: HubEntry[]) {
    const open = searching || flipped.has(key);
    return (
      <section key={key} aria-label={label} className={styles.group}>
        <div className={styles.groupHeadRow}>
          <h2 className={cx(styles.groupHead, styles.sectionHead)}>
            <button
              type="button"
              className={styles.sectionFold}
              aria-expanded={open}
              aria-controls={hubFoldId(key)}
              onClick={() => toggleFold(key)}
              disabled={searching}
              data-testid={key === "community" ? "hub-teams-fold" : undefined}
            >
              <ChevronDown className={styles.sectionFoldIcon} size={14} aria-hidden="true" />
              {label} <Count n={entries.length} />
            </button>
          </h2>
        </div>
        {open ? (
          <GroupList id={hubFoldId(key)} entries={entries} renderRow={renderRow} selectedId={selected?.id} />
        ) : null}
      </section>
    );
  }

  /**
   * Drawer review (6 Nov 2026): the chosen place opens in the kit right drawer at every width (a
   * sheet rising from the foot on a phone), so the list keeps the page's full width and one scroll.
   * The head names the place with one quiet line (kind, service, site) and a tag for the one fact
   * that changes who may go there; the foot holds the kind's lead action, then the quieter links.
   */
  function renderPreview(selected: HubEntry) {
    // "Open ward" and "Open team" sit beside the lead action, so the name is read out, not shown.
    const openLabel =
      selected.kind === "ed" ? (
        `Open ${selected.name}`
      ) : (
        <>
          {selected.kind === "ward" ? "Open ward" : "Open team"}
          <SrOnly>, {selected.name}</SrOnly>
        </>
      );
    const subtitle = [KIND_WORD_LONG[selected.kind], selected.service, selected.site]
      .filter((part) => part !== undefined && part !== "")
      .join(" · ");
    const statisticsHref =
      selected.kind === "ward"
        ? wardStatisticsHref(selected.id)
        : selected.kind === "ed"
          ? edStatisticsHref(selected.id)
          : undefined;
    const lead =
      leadReferral !== undefined ? (
        isPhone ? (
          // Phone: the referral opens in the app's referral sheet, as it did from the phone preview.
          <Button variant="pri" onClick={() => openReferralSheet(leadReferral.href)}>
            {leadReferral.label}
            <ArrowRight size={15} aria-hidden="true" />
          </Button>
        ) : (
          <Link className={buttonClass({ variant: "pri" })} href={leadReferral.href}>
            {leadReferral.label}
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        )
      ) : canOpen(selected.href) ? (
        <Link
          className={buttonClass({ variant: "pri" })}
          href={selected.href}
          onClick={() => recordHubVisit(selected.id)}
        >
          {openLabel}
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      ) : (
        // ROLE BRANCH (bed_manager and every scoped desk): greyed, with the closed page's sentence.
        <Button variant="sec" disabledReason={closedSentence} reasonDisplay="tooltip">
          {openLabel}
        </Button>
      );
    return (
      <PanelDrawer
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={selected.name}
        titleId="hub-preview-title"
        subtitle={subtitle === "" ? undefined : subtitle}
        tag={
          // Mental Health Act authorisation decides who may legally be admitted, so it leads the tag.
          selected.authorised === false ? (
            <StatusPill tone="warning">Voluntary only</StatusPill>
          ) : selected.stale === true ? (
            <StatusPill tone="warning">Stale</StatusPill>
          ) : undefined
        }
        closeLabel={`Close ${selected.name}`}
        bodyLabel={`${selected.name} details`}
        testId="hub-place-drawer"
        foot={
          <>
            {lead}
            <DrawerFootRow>
              {/* PL1 follow-up (Josh, 4 Nov 2026): opening a ward or team stays one step away. */}
              {leadReferral === undefined ? null : canOpen(selected.href) ? (
                <Link
                  className={buttonClass({ variant: "sec" })}
                  href={selected.href}
                  onClick={() => recordHubVisit(selected.id)}
                >
                  {openLabel}
                </Link>
              ) : (
                <Button variant="sec" disabledReason={closedSentence} reasonDisplay="tooltip">
                  {openLabel}
                </Button>
              )}
              {/* Ward and ED only: the statistics builders resolve against a real id this entry carries. */}
              {statisticsHref !== undefined && canOpen(statisticsHref) ? (
                <Link
                  className={buttonClass({ variant: "sec" })}
                  href={statisticsHref}
                  aria-label={`View statistics, ${selected.name}`}
                >
                  <BarChart2 size={14} aria-hidden="true" />
                  Statistics
                </Link>
              ) : null}
              <Button variant="sec" aria-pressed={isPinned(selected.id)} onClick={() => toggleHubPin(selected.id)}>
                <Star size={14} aria-hidden="true" />
                {isPinned(selected.id) ? "Unpin" : "Pin"}
              </Button>
            </DrawerFootRow>
          </>
        }
      >
        <div className={styles.drawerBody}>
          <div className={styles.detailBadges}>
            {deskSite !== undefined ? (
              // ROLE BRANCH (bed_manager), polish r2: plain facts read as one quiet line, as on the
              // list row; only the warning keeps its glyph.
              placeFacts(selected).length === 0 ? null : (
                <span className={styles.factsLine}>{placeFacts(selected).join(" · ")}</span>
              )
            ) : (
              <>
                {selected.cohort === undefined ? null : <span className={styles.infoPill}>{selected.cohort}</span>}
                {selected.security === undefined ? null : (
                  <span className={styles.infoPill}>{SECURITY_WORD[selected.security]}</span>
                )}
              </>
            )}
            {/* Mental Health Act authorisation is a SEPARATE fact from locked/open and decides who
                may legally be admitted, so it is stated in words as well as in the tag. */}
            {selected.authorised === false ? (
              <span className={styles.flagPill}>
                <StatusGlyph tone="warning" size={8} />
                Not authorised — voluntary admissions only
              </span>
            ) : null}
            {deskSite !== undefined ? null : (
              <>
                {selected.forensic === true ? <span className={styles.infoPill}>Forensic ward</span> : null}
                {/* "Undesignated" accepts either sex, so it is not a constraint and earns no badge. */}
                {selected.sexDesignation === undefined || selected.sexDesignation === "Undesignated" ? null : (
                  <span className={styles.infoPill}>{selected.sexDesignation}</span>
                )}
              </>
            )}
          </div>
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
                  {/* The action is the row's second value, so the list keeps only dt and dd (axe). */}
                  <dd className={styles.factAction}>
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
                        disabled={refreshSave.pending}
                        onClick={() =>
                          refreshSave.submit(
                            () =>
                              dispatch({
                                type: "REQUEST_CAPACITY_REFRESH",
                                role: "coordinator",
                                now,
                                unitId: selected.id,
                              }),
                            () => {},
                          )
                        }
                      >
                        Ask to confirm
                      </button>
                    ) : (
                      <span className={styles.factMuted}>Asked {formatInstantWithDay(selectedRequest.at, now)}</span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          ) : null}
          {/* PL1 follow-up (Josh, 4 Nov 2026): names, not counts, so the panel never borrows another
              page's numbers. Beds stay on Capacity and All wards (review point 21). */}
          {selected.kind === "community" ? null : (
            <PeopleList
              heading={selected.kind === "ward" ? "Heading here" : "Waiting here"}
              people={selectedPeople}
              empty={selected.kind === "ward" ? "Nobody is heading here." : "Nobody is waiting here."}
            />
          )}
          {selected.kind === "ed" ? (
            <div className={styles.detailSection}>
              <h3>On-site mental health wards</h3>
              {/* ⚠️ An empty list is a fact and is stated as one, never as "0 on-site beds". */}
              {selected.onSiteUnits === undefined || selected.onSiteUnits.length === 0 ? (
                <p className={styles.absent}>No mental health beds on-site.</p>
              ) : (
                <ul className={styles.notesList}>
                  {selected.onSiteUnits.map((unit) => (
                    <li key={unit}>{unit}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : selected.kind === "community" ? (
            <SuburbList suburbs={selectedSuburbs} />
          ) : null}
          {/* ROLE BRANCH (bed_manager): the closed page's sentence in full, wrapping (QA 31 Oct). The
              greyed button in the foot carries it for a screen reader. */}
          {canOpen(selected.href) ? null : (
            <p className={styles.closedReason} aria-hidden="true">
              {closedSentence}
            </p>
          )}
        </div>
      </PanelDrawer>
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
      boxClassName={isPhone ? styles.phoneSearchBox : styles.heroSearch}
      aria-label="Search wards, EDs and community teams"
      aria-describedby={isPhone ? undefined : "hub-search-hint"}
      placeholder={isPhone ? "Search places" : "Search a ward, hospital, ED, team or service"}
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
          // PL1 follow-up (Josh, 4 Nov 2026): the counts are said once, on the Wards, EDs and Teams switch.
          eyebrow={deskSite !== undefined ? `Places · ${deskSite.name}` : "Places · Statewide"}
          // The title is the band's task: the wards whose bed count needs checking, with the action.
          title={
            <>
              <SrOnly>Places, </SrOnly>
              {bandTask.title}
            </>
          }
          titleMeta={bandTask.action}
          aside={<PageLiveChip paused={paused} onTogglePause={togglePause} />}
          // PL1 (Josh, 3 Nov 2026): the band holds the Places and Catchments switch; this page's own
          // search moved into the list card, so the band no longer holds a second search box beside
          // the header's global search.
          bar={<PlacesTrack value="places" />}
          foot={
            isPhone ? undefined : (
              <CheckingFoot
                items={[
                  {
                    id: "oldest",
                    label: deskSite !== undefined ? "Oldest bed count at your site" : "Oldest bed count",
                    value: oldestConfirmedAt === undefined ? "Not recorded" : durMinutes(now - oldestConfirmedAt),
                  },
                ]}
                notChecked={["ED and team capacity, no feed"]}
              />
            )
          }
        />

        <div className={styles.hubShell}>
          <aside className={styles.hubGlance} aria-label="At a glance">
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
              {/* Drawer review (6 Nov 2026): the summary sits above the list and never scrolls on its own. */}
              <div className={styles.overviewBody}>
                <div className={styles.glanceSection}>
                  <h3 className={styles.sectionLabel}>
                    Needs a check <Count n={attention.length} />
                  </h3>
                  {attention.length === 0 ? (
                    <p className={styles.nothing}>
                      {deskSite !== undefined
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
                    <p className={styles.nothing}>{attention.length - 4} more marked Stale in the list.</p>
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
                  <ul className={styles.serviceList} aria-label="Wards by health service">
                    {wardServices.map((group) => (
                      <li key={group.label}>
                        <button
                          type="button"
                          className={styles.serviceRow}
                          onClick={() => {
                            setQuery(group.label);
                            if (kind !== "all" && kind !== "ward") setKind("all");
                            inputRef.current?.focus();
                          }}
                        >
                          <span>{group.label}</span>
                          <span className={styles.serviceCount}>
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
                    <ul className={styles.memoryList} aria-label="Pinned places">
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
                    <ul className={styles.memoryList} aria-label="Recently opened places">
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
                {/* A section, so the disclosure ends here: the list now follows the summary (drawer review). */}
                <section className={styles.srOnly}>
                  <h4>What is invented</h4>
                  <p>
                    Every bed figure — ready, pulled, closed and occupied — is invented for this prototype and reflects
                    no real hospital&rsquo;s state.
                  </p>
                </section>
              </div>
            </Card>
          </aside>
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
                <Segmented label="Show" items={kindItems} value={kind} onChange={chooseKind} />
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
                    onClick={() => chooseOrder(order === "name" ? "service" : "name")}
                  >
                    <ListFilter size={16} aria-hidden="true" />
                    {order === "name" ? "A to Z" : "By service"}
                  </button>
                </div>
                {queryMatches === undefined && checkFirst[0] ? (
                  <button
                    type="button"
                    className={styles.phoneCheckFirst}
                    onClick={() => select(checkFirst[0].entry.id)}
                  >
                    <StatusGlyph tone="warning" size={10} />
                    <span className={styles.phoneCheckText}>
                      <b>Check first: {checkFirst[0].entry.name}</b>
                      <span>
                        {checkFirst[0].entry.confirmedAt === undefined
                          ? "Bed count not confirmed"
                          : `Bed count confirmed ${durMinutes(now - checkFirst[0].entry.confirmedAt)} ago`}
                        {checkFirst.length > 1 ? `. ${checkFirst.length - 1} more need a check.` : "."}
                      </span>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                ) : null}
                {/* Round 2: the Stale legend sentence is gone; the card above and each row's own
                    words say it, and the row's spoken label explains it. */}
              </div>
            ) : (
              <div className={styles.controls}>
                <div className={styles.listSearchRow}>{searchBox}</div>
                <div className={styles.controlsRow}>
                  <Segmented label="Show" items={kindItems} value={kind} onChange={chooseKind} />
                  <span className={styles.controlLabel}>Order</span>
                  <Segmented
                    label="Order"
                    items={[
                      { id: "service" as const, label: "Service" },
                      { id: "name" as const, label: "A to Z" },
                    ]}
                    value={order}
                    onChange={chooseOrder}
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
              <div className={styles.listHead} aria-hidden="true">
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
              {deskSite !== undefined && ownShown ? (
                // ROLE BRANCH (bed_manager): the desk's own site first, open, before the network.
                <section aria-label={`Your site, ${deskSite.name}`} className={styles.group}>
                  <div className={styles.groupHeadRow}>
                    <h2 className={styles.groupHead}>
                      Your site · {deskSite.name} <Count n={ownEntries.length} />
                    </h2>
                  </div>
                  <GroupList
                    id="hub-list-own-site"
                    entries={ownEntries}
                    renderRow={renderRow}
                    selectedId={selected?.id}
                  />
                </section>
              ) : null}
              {shownSections.map((section) =>
                // Round 2: in All, the EDs' and teams' heading is itself the fold row, so the count shows once.
                kind === "all" && section.subgroups.length === 0 ? (
                  renderSectionFold(section.key, section.label, section.entries)
                ) : (
                  <section key={section.key} aria-label={sectionLabel(section)} className={styles.group}>
                    <div className={styles.groupHeadRow}>
                      <h2 className={styles.groupHead}>
                        {sectionLabel(section)} <Count n={section.entries.length} />
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
                    ) : (
                      <GroupList
                        id={`hub-list-${section.key}`}
                        entries={section.entries}
                        renderRow={renderRow}
                        selectedId={selected?.id}
                      />
                    )}
                  </section>
                ),
              )}
            </div>
            {/* Round 2: the count shows only when a search or tab narrows the list (the hero says the
                total), and the beds pointer lives once, as the preview's Beds row. */}
            {searching || kind !== "all" ? (
              <div className={styles.listFoot}>
                <span className={styles.shownCount} data-testid="hub-shown-count">
                  <b>{searching ? `${shownCount} of ${totals.all}` : `${results.length} of ${totals.all}`}</b>{" "}
                  {searching ? "match" : "listed"}
                </span>
              </div>
            ) : null}
          </Card>
        </div>
        <WardPrototypeFooter
          testId="ward-hub-governance"
          note="Real hospital network; invented bed figures and community team names · Not approved for clinical use"
        />
        {selected === undefined ? null : renderPreview(selected)}
      </main>
    </div>
  );
}

/**
 * A fold's list id, safe for `aria-controls`: a service key can carry a space ("North Metro"), and an
 * id with a space names two ids, so the fold button would point at nothing (axe, critical).
 */
function hubFoldId(key: string): string {
  return `hub-fold-${key.replace(/[^A-Za-z0-9_-]+/gu, "-")}`;
}

/**
 * A group's rows, the first eight then "Show N more" (owner rule for long lists). The list folds only
 * when two or more rows would be hidden (Josh, answer 21): a group of nine shows all nine.
 */
export function GroupList({
  id,
  entries,
  renderRow,
  selectedId,
}: {
  id: string;
  entries: HubEntry[];
  renderRow: (entry: HubEntry) => ReactNode;
  /** The previewed place. If the arrow keys reach a row past "Show more", the list opens down to it. */
  selectedId: string | undefined;
}) {
  const [limit, setLimit] = useState(GROUP_ROWS);
  const reach = Math.max(limit, entries.findIndex((entry) => entry.id === selectedId) + 1);
  const shown = foldLimit(entries.length, reach);
  const hidden = foldHidden(entries.length, reach);
  return (
    <>
      <ul className={styles.groupList} id={id}>
        {entries.slice(0, shown).map(renderRow)}
      </ul>
      {hidden > 0 ? (
        <ShowMoreRow controls={id} onClick={() => setLimit(shown + GROUP_ROWS * 2)}>
          Show {hidden} more
        </ShowMoreRow>
      ) : null}
    </>
  );
}

/** How many names or suburbs a panel shows before "Show all" (the owner rule for long lists). */
const PANEL_LIST_LIMIT = 6;

/**
 * The people a ward or ED panel names (PL1 follow-up, Josh, 4 Nov 2026). Each name opens the person
 * when a record links them. Names are shown in full (D-83).
 */
function PeopleList({ heading, people, empty }: { heading: string; people: PlacePerson[]; empty: string }) {
  const [open, setOpen] = useState(false);
  const shown = open ? people : people.slice(0, foldLimit(people.length, PANEL_LIST_LIMIT));
  return (
    <section className={cx(styles.detailSection, styles.listSection)} aria-label={heading}>
      <h3>{heading}</h3>
      {people.length === 0 ? (
        <p className={styles.absent}>{empty}</p>
      ) : (
        <>
          <ul className={styles.peopleList}>
            {shown.map((person) => (
              <li key={person.key}>
                {person.href === undefined ? person.name : <Link href={person.href}>{person.name}</Link>}
              </li>
            ))}
          </ul>
          {foldHidden(people.length, PANEL_LIST_LIMIT) > 0 ? (
            <ShowMoreRow expanded={open} onClick={() => setOpen((value) => !value)}>
              {open ? "Show fewer" : `Show ${foldHidden(people.length, PANEL_LIST_LIMIT)} more`}
            </ShowMoreRow>
          ) : null}
        </>
      )}
    </section>
  );
}

/** The suburbs a team covers, by name, from the catchment table (PL1 follow-up, Josh, 4 Nov 2026). */
function SuburbList({ suburbs }: { suburbs: readonly string[] }) {
  const [open, setOpen] = useState(false);
  const hidden = foldHidden(suburbs.length, PANEL_LIST_LIMIT * 2);
  const shown = open || hidden === 0 ? suburbs : suburbs.slice(0, foldLimit(suburbs.length, PANEL_LIST_LIMIT * 2));
  return (
    <section className={cx(styles.detailSection, styles.listSection)} aria-label="Suburbs it covers">
      <h3>Suburbs it covers</h3>
      {suburbs.length === 0 ? (
        <p className={styles.absent}>No suburbs are on the catchment list for this team.</p>
      ) : (
        <>
          <p className={styles.suburbLine}>{shown.join(", ")}</p>
          {hidden > 0 ? (
            <ShowMoreRow expanded={open} onClick={() => setOpen((value) => !value)}>
              {open ? "Show fewer" : `Show ${hidden} more`}
            </ShowMoreRow>
          ) : null}
        </>
      )}
    </section>
  );
}
