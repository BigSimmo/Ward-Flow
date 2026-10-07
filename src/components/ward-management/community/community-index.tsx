"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, BookOpen, ChevronRight, Download, History, Info, MapPin, Plus, Search, X } from "lucide-react";

import {
  BarList,
  Button,
  Card,
  CardBody,
  CardHead,
  Drawer,
  FilterChip,
  Hero,
  HeroStat,
  Icon,
  Kbd,
  Segmented,
  Select,
  SrOnly,
  StatusGlyph,
  TextInput,
  buttonClass,
  tableClasses,
  type BarListRow,
} from "@/components/wf";
import {
  COMMUNITY_TEAM_PAGES,
  communityTeamSlug,
  type CommunityTeam,
} from "@/components/ward-management/community/community-derivations";
import { communityTeamHref } from "@/components/ward-management/shell/ward-facade";
import {
  communityNameCollisions,
  communityNamesInCollisions,
  type CommunityNameCollision,
} from "@/components/ward-management/community/community-vocabulary";
import { createBrowserStore } from "@/lib/client-store-factory";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { mapClinicToServiceAndHospital } from "@/components/ward-management/tools/ward-catchment-resolver";
import {
  S2015_CATCHMENT_ROWS,
  lookupCatchment,
  parseFollowUpClinicSet,
} from "@/components/ward-management/ward-catchment";
import { csvCell } from "@/components/ward-management/statistics/statistics-csv";

import styles from "./community-index.module.css";

/**
 * THE COMMUNITY TEAM INDEX — the front door to `community/[teamId]`.
 *
 * **Why it exists.** That dynamic route serves one page per team in `COMMUNITY_TEAM_PAGES`, and
 * before this page existed **nothing linked to it from anywhere a person could get to**.
 * `community-screen.tsx` renders an "Other community teams" switcher that links every team but the
 * one you are looking at, which only helped somebody already standing on a team page — and the way
 * onto a team page was to type its address. Every one of those pages had a single entry condition,
 * and that condition was knowing a URL. This page is what closes that.
 *
 * ⚠️ **NO COUNT OF TEAMS IS WRITTEN INTO THIS COMMENT, AND THAT IS DELIBERATE.** An earlier draft
 * named the size of the derived list, in words, more than once. It was true the day it was written,
 * it is a property of the seed rather than of this page, and nothing would have gone red when the
 * seed changed — the exact class of sentence `statistics-derivations.ts` records as having falsified
 * itself silently four times on one paragraph. The list is derived, so the derivation is the only
 * honest answer to "how many"; a count that is RENDERED from live state is fine, and a count typed
 * into prose is the defect. `tests/ward-community-index.test.ts` scans this comment for a numeral
 * or a spelled-out count and records why the size pin belongs to the fixture's own suite, not here.
 *
 * ⚠️ **THE INDEX'S OWN REACHABILITY IS THE POINT, NOT A DETAIL.** An index that links every derived
 * team confers none of that reachability on any of them unless the index is itself reachable.
 * Reachability is transitive: a page that is not itself reachable passes none of it on to what it
 * links. This page's own reachability is no longer in question — it is registered in `ward-nav.ts`'s
 * `WARD_NAV` list under the id "community", and the root rail renders that entry.
 * `tests/ward-community-index.dom.test.tsx` proves it, as an ordinary passing assertion now rather
 * than the inverted `it.fails` tripwire it started life as; that test's own comment records why the
 * response to a tripwire going red is to delete the `.fails`, and never to bring it back.
 *
 * ⚠️ **ONE FLAT, ALPHABETICAL LIST. THE ABSENCE OF GROUPING IS ENFORCED BY THE TYPE, AND THE PAGE
 * SAYS SO OUT LOUD.** `CommunityTeam` is `{ id, name }` and nothing else, and
 * `community-derivations.ts` records that the missing `region` field is "enforcement rather than
 * tidying: a screen cannot fall back to region-derived membership if no team here knows a region".
 * The region-keyed `COMMUNITY_TEAMS` table in `ward-teams.ts` is deliberately not read by this hub,
 * for the same reason, and is not read here either. `id` is a slug derived from `name`, so it is not
 * an independent field to group on. That leaves exactly two ways to render a grouped index: read a
 * table this code is barred from, or invent a category — and an invented category on this prototype
 * reads to a coordinator as a real one. The gateway redesign below breaks this same flat list into
 * letter-headed sections with a jump rail, which is presentation over the alphabet, not a category:
 * every team still reaches the page by name alone, and the letter it lands under is read off that
 * same name rather than assigned by anything this page invented.
 *
 * So the page states, in its own copy rather than only in this comment, that the teams are listed
 * alphabetically **because the record holds a name and nothing else to group by**. That sentence is
 * the honest version of the grouping that was asked for. Two chats recommended grouping by health
 * service before anybody read the type; the sentence is the record of what reading it settled.
 *
 * **Deliberately not a second caseload board.** No count of people, no discharges, no waiting
 * figure, nothing this page renders answers a question a team's own page already answers. That is
 * `ward-index.tsx`'s ruling applied here verbatim: "Two surfaces answering one question in wording
 * that can drift is this project's most reliable defect." A team's name and a link cannot drift
 * against a figure, because neither is a figure.
 *
 * **Enumerated, never listed.** The teams come from `COMMUNITY_TEAM_PAGES`, which derives from the
 * referral picker's own vocabulary — a team reaches this page by appearing in the catchment source
 * and by nothing else. A hand-written list of teams here would be a second home for that vocabulary
 * and would silently disagree with it the first time the source document is replaced.
 *
 * **A client component.** It used to need no hooks; the gateway redesign below added live search,
 * jump-navigation and a localStorage-backed recent list, all of which are hooks, so this boundary is
 * now doing double duty rather than an unused formality.
 *
 * ⚠️ **AND IT USED TO BE DOING A JOB IT NO LONGER HAS TO.** The team-href builder lived in
 * `community-screen.tsx`, which is `"use client"` — and every export of a client module reaches a
 * Server Component as a client *reference* rather than as a callable function, so a server component
 * calling it would typecheck, pass every unit test, and throw on the first real request. That is why
 * the boundary here used to move rather than the builder. `communityTeamHref` now
 * lives in
 * `shell/ward-facade.ts`, which carries no client directive at all, so the constraint is gone and
 * this file stays a client component for its own hooks alone. **The lesson is not gone with it:** a
 * shared builder must never be defined inside a `"use client"` module, which is why the facade's own
 * header forbids that file ever acquiring the directive. (No date is cited here on purpose — this
 * comment is scanned for numerals, because a figure typed into prose is a claim nothing re-checks.)
 */

/**
 * THE V6 REBUILD, 7 October 2026 — `design/pages-v6/Community.png` and its state shots. The page
 * keeps the gateway's rules and changes its frame: one hero band names the page and counts what the
 * record holds; the A to Z card lists every team with its health service and how many catchment
 * suburbs name it; the side column looks a suburb up, sets names that read alike side by side and
 * counts teams by service.
 *
 * ⚠️ **THIS PAGE STILL COMPUTES NO "READS ALIKE" GROUPING OF ITS OWN.** Every marker, family and
 * count reads `communityNameCollisions()` and `communityNamesInCollisions()` from
 * `community-vocabulary.ts`. The suburb lookup reads `lookupCatchment()` and states its own note
 * when a suburb is contested, unreviewed or unknown; it never picks a team for a reader.
 *
 * **A row carries catchment facts and nothing about people.** The service code comes from the
 * catchment resolver's mapping and the suburb figure from the catchment rows. Neither is a count
 * of people, a discharge or a follow-up, so the page is still a way in, not a caseload.
 *
 * **Left out, because the record cannot support it:** a nearest emergency department per team (the
 * catchment table's hospital column is stale by the owner's ruling and is not carried), times on the
 * recently opened strip (the strip stores names only), and a selected-team bar with a "Refer to this
 * team" action (the referral form takes no team from its address).
 */
export const COMMUNITY_SERVICE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "NMHS", label: "North Metro (NMHS)" },
  { value: "SMHS", label: "South Metro (SMHS)" },
  { value: "EMHS", label: "East Metro (EMHS)" },
  { value: "WACHS", label: "Country Health (WACHS)" },
] as const;

type ServiceFilter = (typeof COMMUNITY_SERVICE_OPTIONS)[number]["value"];

/** The bar label for each service on "Teams by service", read from the options above. */
const SERVICE_BAR_LABEL: Record<Exclude<ServiceFilter, "all">, string> = {
  NMHS: "North Metro, NMHS",
  SMHS: "South Metro, SMHS",
  EMHS: "East Metro, EMHS",
  WACHS: "Country, WACHS",
};

/** The same key `communityTeamOptions()` folds spellings with: case, whitespace and punctuation. */
function clinicKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

type TeamFacts = { service: string; suburbs: number };

export function CommunityIndex({ teams = COMMUNITY_TEAM_PAGES }: { teams?: readonly CommunityTeam[] }) {
  // Sorted here rather than trusted from upstream: this page makes the alphabetical claim in its own
  // copy, so it holds the sort itself. The id tie-break keeps the order total.
  const allTeams = useMemo(
    () => [...teams].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
    [teams],
  );

  // One call to the shared derivation, indexed by name for each row's marker.
  const collisionByName = useMemo(() => {
    const map = new Map<string, CommunityNameCollision>();
    for (const collision of communityNameCollisions()) {
      for (const entry of collision.names) map.set(entry.name, collision);
    }
    return map;
  }, []);

  // The family card is deliberately NOT scoped to the `teams` prop: it is the same derivation
  // whichever subset a caller renders, so an override to `[]` still gets the real families.
  const familyGroups = useMemo(() => communityNameCollisions(), []);

  // Suburbs per clinic key, from the catchment rows. Feeds search, the row figure, the lookup and
  // the side-by-side families, so all four read one map.
  const suburbsByClinicKey = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of S2015_CATCHMENT_ROWS) {
      for (const clinic of parseFollowUpClinicSet(row.followUpClinicVerbatim)) {
        const key = clinicKey(clinic);
        if (!key) continue;
        const set = map.get(key) ?? new Set<string>();
        set.add(row.suburb);
        map.set(key, set);
      }
    }
    return map;
  }, []);

  const factsFor = useCallback(
    (name: string): TeamFacts => ({
      service: mapClinicToServiceAndHospital(name).code,
      suburbs: suburbsByClinicKey.get(clinicKey(name))?.size ?? 0,
    }),
    [suburbsByClinicKey],
  );

  const teamFacts = useMemo(() => {
    const map = new Map<string, TeamFacts>();
    for (const team of allTeams) map.set(team.name, factsFor(team.name));
    return map;
  }, [allTeams, factsFor]);

  // Suburb names and service labels, so search matches the fields the page promises, not only names.
  const teamSearchHaystack = useMemo(() => {
    const map = new Map<string, string>();
    for (const team of allTeams) {
      const mapping = mapClinicToServiceAndHospital(team.name);
      const suburbs = suburbsByClinicKey.get(clinicKey(team.name));
      map.set(
        team.name,
        [team.name, mapping.code, mapping.name, mapping.displayName, ...(suburbs ? [...suburbs] : [])]
          .join(" ")
          .toLowerCase(),
      );
    }
    return map;
  }, [allTeams, suburbsByClinicKey]);

  const teamByKey = useMemo(() => {
    const map = new Map<string, CommunityTeam>();
    for (const team of allTeams) map.set(clinicKey(team.name), team);
    return map;
  }, [allTeams]);

  const [query, setQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all");
  const [alikeOnly, setAlikeOnly] = useState(false);
  const [familyIndex, setFamilyIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // `useSyncExternalStore` through `createBrowserStore`: the recent list lives in localStorage, and
  // a server render (and `renderToStaticMarkup` in tests) sees the empty server snapshot.
  const storedRecentNames = useRecentTeamNames();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    /*
     * ⚠️ **`stopPropagation()` IS LOAD-BEARING, NOT DEFENSIVE.** `WardGlobalSearch` binds the same
     * "/" shortcut on `window`, and a keydown bubbles from `document` to `window` afterwards, so
     * without this call the header's handler refocused its own input a moment later. This page's
     * own field owns "/" on this page, which is what its "/" hint promises.
     */
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.activeElement === searchInputRef.current) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      searchInputRef.current?.focus();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // A row's marker selects that row's family on the side-by-side card and brings the card into view.
  const openFamily = useCallback(
    (collision: CommunityNameCollision) => {
      const index = familyGroups.findIndex((family) => family.names[0]?.name === collision.names[0]?.name);
      if (index >= 0) setFamilyIndex(index);
      const card = document.getElementById(FAMILY_CARD_ID);
      if (!card) return;
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      card.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    },
    [familyGroups],
  );

  // `document.getElementById` rather than a ref map: which letters exist depends on the filters.
  const jumpToLetter = useCallback((letter: string) => {
    const heading = document.getElementById(letterHeadingId(letter));
    if (!heading) return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    heading.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    heading.focus();
  }, []);

  // One source-validated recent list feeds the strip, so a renamed or removed name never shows.
  const recentNames = useMemo(() => {
    const known = new Set(allTeams.map((team) => team.name));
    return storedRecentNames.filter((name) => known.has(name));
  }, [allTeams, storedRecentNames]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredTeams = useMemo(
    () =>
      allTeams.filter((team) => {
        if (serviceFilter !== "all" && teamFacts.get(team.name)?.service !== serviceFilter) return false;
        if (alikeOnly && !collisionByName.has(team.name)) return false;
        if (normalizedQuery) {
          const haystack = teamSearchHaystack.get(team.name) ?? team.name.toLowerCase();
          if (!haystack.includes(normalizedQuery)) return false;
        }
        return true;
      }),
    [allTeams, serviceFilter, alikeOnly, teamFacts, collisionByName, teamSearchHaystack, normalizedQuery],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, CommunityTeam[]>();
    for (const team of filteredTeams) {
      const letter = team.name.charAt(0).toUpperCase();
      const bucket = map.get(letter);
      if (bucket) bucket.push(team);
      else map.set(letter, [team]);
    }
    return map;
  }, [filteredTeams]);

  const serviceCounts = useMemo(() => {
    const counts = new Map<string, { teams: number; alike: number }>();
    for (const team of allTeams) {
      const service = teamFacts.get(team.name)?.service ?? "";
      const entry = counts.get(service) ?? { teams: 0, alike: 0 };
      entry.teams += 1;
      if (collisionByName.has(team.name)) entry.alike += 1;
      counts.set(service, entry);
    }
    return counts;
  }, [allTeams, teamFacts, collisionByName]);

  const alikeTeamCount = useMemo(
    () => allTeams.filter((team) => collisionByName.has(team.name)).length,
    [allTeams, collisionByName],
  );

  // Distinct suburbs whose catchment row names at least one team on this page.
  const suburbsMapped = useMemo(() => {
    const suburbs = new Set<string>();
    for (const row of S2015_CATCHMENT_ROWS) {
      if (parseFollowUpClinicSet(row.followUpClinicVerbatim).some((clinic) => teamByKey.has(clinicKey(clinic)))) {
        suburbs.add(row.suburb.toLowerCase());
      }
    }
    return suburbs.size;
  }, [teamByKey]);

  const filtersActive = query.trim() !== "" || serviceFilter !== "all" || alikeOnly;

  function resetFilters() {
    setQuery("");
    setServiceFilter("all");
    setAlikeOnly(false);
  }

  // "Show in list" clears the filters first; the focus waits a tick so the row has rendered.
  function showInList(team: CommunityTeam) {
    resetFilters();
    window.setTimeout(() => {
      const link = document.getElementById(teamRowId(team.id))?.querySelector("a");
      if (!(link instanceof HTMLElement)) return;
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      link.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      link.focus();
    }, 0);
  }

  function exportTeamList() {
    const lines: (string | number)[][] = [["Team", "Health service", "Catchment suburbs", "Reads like another name"]];
    for (const team of allTeams) {
      const facts = teamFacts.get(team.name);
      lines.push([team.name, facts?.service ?? "", facts?.suburbs ?? 0, collisionByName.has(team.name) ? "Yes" : "No"]);
    }
    const url = URL.createObjectURL(
      new Blob([lines.map((line) => line.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "ward-flow-synthetic-community-team-list.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const serviceItems = COMMUNITY_SERVICE_OPTIONS.map((option) => ({
    id: option.value,
    label: option.value === "all" ? "All" : option.value,
    count: option.value === "all" ? allTeams.length : (serviceCounts.get(option.value)?.teams ?? 0),
  }));

  return (
    <div className={styles.screen} data-testid="community-index">
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          eyebrow="Community"
          title="Community teams"
          stats={
            <>
              <HeroStat value={allTeams.length} label="Team names" />
              <HeroStat value={alikeTeamCount} label="Read alike" tone={alikeTeamCount > 0 ? "warning" : undefined} />
              <HeroStat value={serviceCounts.size} label="Health services" />
              <HeroStat value={suburbsMapped} label="Suburbs mapped" />
            </>
          }
          aside={
            <div className={styles.heroActions}>
              <Button
                ref={drawerTriggerRef}
                variant="onHero"
                icon={BookOpen}
                onClick={() => setDrawerOpen(true)}
                data-testid="community-action-catchment-guide"
                aria-haspopup="dialog"
                aria-expanded={drawerOpen}
              >
                Catchment guide
              </Button>
              <Link
                href="/mockups/ward-flow/referrals"
                className={buttonClass({ variant: "onHero" })}
                data-testid="community-action-referral-board"
              >
                <Icon icon={ArrowRight} size={16} />
                Referrals
              </Link>
              <Link
                href="/mockups/ward-flow/referrals/new"
                className={buttonClass({ variant: "light" })}
                data-testid="community-action-raise-referral"
              >
                <Icon icon={Plus} size={16} />
                Raise referral
              </Link>
            </div>
          }
          bar={
            recentNames.length > 0 ? (
              <section className={styles.recentStrip} aria-label="Recently opened">
                <span className={styles.recentLabel}>
                  <Icon icon={History} size={14} />
                  Recently opened
                </span>
                {recentNames.map((name) => {
                  const team = teamRef(name);
                  return (
                    <Link
                      key={team.id}
                      className={buttonClass({ variant: "onHero", size: "sm" })}
                      href={communityTeamHref(team)}
                      data-testid="community-gateway-recent-link"
                      onClick={() => recordVisit(name)}
                    >
                      {name}
                    </Link>
                  );
                })}
              </section>
            ) : undefined
          }
          barAside={<span className={styles.heroNote}>Recorded names, not verified services</span>}
        />

        <div className={styles.layout}>
          <Card
            className={styles.directoryCard}
            aria-label="A–Z"
            data-testid="community-index-teams"
            data-ward-primitive="panel"
          >
            <div data-ward-primitive="panel-header">
              <CardHead
                title="A–Z"
                eyebrow
                aside={
                  <p className={styles.resultLine} aria-live="polite" data-testid="community-gateway-result-line">
                    <strong>{filteredTeams.length}</strong> of {allTeams.length} synthetic team names
                  </p>
                }
              />
            </div>
            <div className={styles.toolbar}>
              <TextInput
                ref={searchInputRef}
                type="search"
                icon={Search}
                boxClassName={styles.searchBox}
                placeholder="Search"
                autoComplete="off"
                aria-label="Search team names"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && query) {
                    event.stopPropagation();
                    setQuery("");
                  }
                }}
                trailing={<Kbd>/</Kbd>}
              />
              <Segmented
                label="Filter team names"
                items={serviceItems}
                value={serviceFilter}
                onChange={setServiceFilter}
              />
              <FilterChip pressed={alikeOnly} onPressedChange={setAlikeOnly} tone="warning">
                Reads alike
              </FilterChip>
              {filtersActive ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    resetFilters();
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Reset all search and filter parameters"
                >
                  Reset
                </Button>
              ) : null}
            </div>
            <div className={styles.directoryBody}>
              <nav className={styles.azRail} aria-label="Jump to letter">
                {/*
                 * ⚠️ `aria-disabled`, NOT native `disabled`: an empty letter is unavailable for a
                 * stated reason that changes with the filters, and a natively disabled button drops
                 * out of the Tab order, so a keyboard user would never reach it to learn why. The
                 * reason is a sibling span, not a child, so the button's name stays the letter.
                 */}
                {ALPHABET.map((letter) => {
                  const present = grouped.has(letter);
                  const blockedReason = present ? undefined : "No teams under this letter";
                  const blockedId = present ? undefined : azRailBlockedId(letter);
                  return (
                    <Fragment key={letter}>
                      <button
                        type="button"
                        className={styles.azRailButton}
                        aria-disabled={present ? undefined : "true"}
                        aria-describedby={blockedId}
                        title={blockedReason}
                        onClick={present ? () => jumpToLetter(letter) : ignoreUnavailableActivation}
                      >
                        {letter}
                      </button>
                      {blockedId ? (
                        <span id={blockedId} className="sr-only">
                          {blockedReason}
                        </span>
                      ) : null}
                    </Fragment>
                  );
                })}
              </nav>
              {allTeams.length === 0 ? (
                /*
                 * An empty SOURCE is a stated absence, never an empty list: a blank list looks like
                 * a loaded page for a service with no teams. Checked before the filters, because an
                 * empty source and a search that matched nothing are different facts.
                 */
                <div className={styles.emptyNotice} data-testid="community-index-empty">
                  <p>
                    <strong>This list is empty.</strong> Every team on this page is derived from the vocabulary a
                    referral can name, so an empty list means that derivation returned no teams.
                  </p>
                  <p>
                    It does not mean this prototype has no community teams, and nothing on this page has checked whether
                    any exist. Read it as a page that found nothing, not as a service that has nothing.
                  </p>
                </div>
              ) : filteredTeams.length === 0 ? (
                <SearchEmptyNotice query={query.trim()} alikeOnly={alikeOnly} />
              ) : (
                <div className={styles.listWrap} role="region" aria-label="Community team directory" tabIndex={0}>
                  <div className={styles.columnHead} aria-hidden="true">
                    <span />
                    <span>Team</span>
                    <span>Service</span>
                    <span className={styles.numHead}>Suburbs</span>
                    <span>Name check</span>
                    <span />
                  </div>
                  {[...grouped.keys()].sort().map((letter) => (
                    <section key={letter} className={styles.letterSection} aria-labelledby={letterHeadingId(letter)}>
                      <h3 id={letterHeadingId(letter)} tabIndex={-1} className={styles.letterHeading}>
                        {letter}
                      </h3>
                      <ul className={styles.teamList}>
                        {(grouped.get(letter) ?? []).map((team) => (
                          <TeamRow
                            key={team.id}
                            team={team}
                            facts={teamFacts.get(team.name)}
                            query={normalizedQuery}
                            collision={collisionByName.get(team.name)}
                            onOpenFamily={openFamily}
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <div className={styles.side} data-testid="community-index-side">
            <SuburbLookup teamByKey={teamByKey} factsFor={factsFor} onShowInList={showInList} />

            <Card
              id={FAMILY_CARD_ID}
              className={styles.sideCard}
              aria-labelledby="community-gateway-family-title"
              data-testid="community-gateway-family-panel"
            >
              <CardHead
                id="community-gateway-family-title"
                title="Names that read alike"
                eyebrow
                aside={
                  <span className={styles.headNote}>
                    {communityNamesInCollisions()} names in {familyGroups.length} groups
                  </span>
                }
              />
              <CardBody className={styles.familyBody}>
                {familyGroups.length === 0 ? (
                  <p className={styles.muted} data-testid="community-gateway-family-empty">
                    No name in this list currently reads like another. That would itself be a change worth noticing,
                    since the source document is known to hold near-duplicate spellings.
                  </p>
                ) : (
                  <>
                    <Select
                      aria-label="Names to set side by side"
                      value={String(familyIndex)}
                      onChange={(event) => setFamilyIndex(Number(event.target.value))}
                    >
                      {familyGroups.map((family, index) => (
                        <option key={family.names[0]?.name ?? index} value={index}>
                          {family.names[0]?.name} · {family.names.length} spellings
                        </option>
                      ))}
                    </Select>
                    {familyGroups.map((family, index) => (
                      <FamilySideBySide
                        key={family.names[0]?.name ?? index}
                        family={family}
                        hidden={index !== familyIndex}
                        factsFor={factsFor}
                        suburbsByClinicKey={suburbsByClinicKey}
                      />
                    ))}
                  </>
                )}
                <p className={styles.note}>
                  <Icon icon={Info} size={14} />
                  <span>Not merged. Spellings are compared, so an abbreviation or a renaming carries no marker.</span>
                </p>
              </CardBody>
            </Card>

            <Card className={styles.sideCard} aria-labelledby="community-gateway-service-title">
              <CardHead
                id="community-gateway-service-title"
                title="Teams by service"
                eyebrow
                aside={<span className={styles.headNote}>Line is the mean</span>}
              />
              <CardBody>
                <ServiceBars serviceCounts={serviceCounts} />
              </CardBody>
            </Card>
          </div>
        </div>

        <div className="sr-only">
          <p data-testid="community-index-about">Every community team a referral can name in this prototype</p>
          <p data-testid="community-index-provenance">
            These teams are listed alphabetically because the record holds a team&apos;s name and nothing else to group
            by. The catchment table this list is derived from does link each team to a set of suburbs, but that link is
            not carried on the team itself, so any grouping on this page would be one this prototype invented rather
            than one a team&apos;s own record supports.
          </p>
          <p data-testid="community-index-restraint">
            This is a way in, not a caseload. Each row shows a team&apos;s name, its health service and how many
            catchment suburbs name it, and links to the team — no counts of people, no discharges and nothing about who
            a team is following up. A team&apos;s own page answers those questions for that team.
          </p>
          <p data-testid="community-index-marker-explanation">
            Some names below carry a marker reading <strong>reads like others</strong>, because the source document
            spells one team more than one way, or holds two different teams under names close enough to confuse.{" "}
            <strong>The marker never means two entries are the same service</strong> — nothing on this page merges,
            corrects or de-duplicates a name, and each stays its own entry with its own page. The reverse is just as
            true and easy to miss: a name with <strong>no</strong> marker is <strong>not a guarantee</strong> it appears
            only once in this list. The check compares <strong>spellings</strong>, so two names for one service are
            invisible to it whenever they are not spelled alike — an abbreviation, or a service renamed rather than
            misspelt. Recognising those takes a person who knows the services, and where somebody has confirmed that two
            names are the same service, that is recorded as their decision and never inferred here.
          </p>
        </div>
        <WardPrototypeFooter
          testId="community-index-governance"
          note={
            <>
              <span>
                Synthetic prototype. Listed A to Z because the record holds a name only. Names come from referral
                vocabulary, not a roster of WA services.
              </span>
              <span className="sr-only">
                Every team listed here comes from one extracted source document; no team has agreed to be represented,
                and nothing here has been checked against a real service.
              </span>
            </>
          }
        />

        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Catchment guide"
          returnFocusRef={drawerTriggerRef}
          testId="community-catchment-guide"
        >
          <div className={styles.guide}>
            <section className={styles.guideSection} aria-labelledby="community-guide-source">
              <h3 id="community-guide-source" className={styles.guideHead}>
                Source
              </h3>
              <dl className={styles.guideList}>
                <div>
                  <dt>Table</dt>
                  <dd>S2015 catchment rows</dd>
                </div>
                <div>
                  <dt>Team names</dt>
                  <dd>{allTeams.length}</dd>
                </div>
                <div>
                  <dt>Suburbs mapped</dt>
                  <dd>{suburbsMapped}</dd>
                </div>
                <div>
                  <dt>Roster and hours</dt>
                  <dd>Not held</dd>
                </div>
              </dl>
              <p className={styles.muted}>
                Every team listed here is derived from the referral vocabulary extracted from Western Australian mental
                health catchment documents. This directory has not been verified with the services.
              </p>
            </section>
            <section className={styles.guideSection} aria-labelledby="community-guide-similar">
              <h3 id="community-guide-similar" className={styles.guideHead}>
                Similar names
              </h3>
              <ul className={styles.guideLegend}>
                <li>
                  <StatusGlyph tone="warning" size={9} />
                  <strong>Reads like N</strong>
                  <span>spelling close to another name</span>
                </li>
                <li>
                  <StatusGlyph tone="neutral" size={9} />
                  <strong>No marker</strong>
                  <span>does not prove a name is unique</span>
                </li>
                <li>
                  <Icon icon={X} size={14} />
                  <strong>Never merged</strong>
                  <span>each name keeps its own page</span>
                </li>
              </ul>
            </section>
            <section className={styles.guideSection} aria-labelledby="community-guide-actions">
              <h3 id="community-guide-actions" className={styles.guideHead}>
                Actions
              </h3>
              <div className={styles.guideActions}>
                <Link href="/mockups/ward-flow/referrals/new" className={buttonClass({ variant: "sec" })}>
                  <Icon icon={Plus} size={16} />
                  Raise referral
                </Link>
                <Link href="/mockups/ward-flow/referrals" className={buttonClass({ variant: "sec" })}>
                  <Icon icon={ArrowRight} size={16} />
                  Open referrals
                </Link>
                <Button variant="sec" icon={Download} onClick={exportTeamList}>
                  Export team list
                </Button>
              </div>
            </section>
          </div>
        </Drawer>
      </main>
    </div>
  );
}

/** How many recently-opened teams the strip remembers. */
const RECENT_LIMIT = 5;

/** The `localStorage` key the "recently opened" strip reads and writes. */
const RECENT_STORAGE_KEY = "ward-community-gateway-recent";

/** Fired after a same-tab write; the native `storage` event only reaches other tabs. */
const RECENT_CHANGE_EVENT = "ward-community-gateway-recent-change";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** The id a letter's heading renders under, and the id the jump rail looks up. */
function letterHeadingId(letter: string): string {
  return `community-gateway-letter-${letter}`;
}

/** The id an empty rail letter's `aria-describedby` points at. */
function azRailBlockedId(letter: string): string {
  return `community-gateway-az-blocked-${letter}`;
}

/** The id of the side-by-side card, so a row's marker can bring it into view. */
const FAMILY_CARD_ID = "community-gateway-family";

/** The id of a team's row, so "Show in list" can focus its link. */
function teamRowId(teamId: string): string {
  return `community-gateway-row-${teamId}`;
}

/** A `CommunityTeam` built from a name, for surfaces that carry only a name and need a link. */
function teamRef(name: string): CommunityTeam {
  return { id: communityTeamSlug(name), name };
}

/** Every stored recent name; a read failure (private browsing) is absorbed, never thrown. */
function readRecentTeamNames(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string").slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

/** The write half: a failed write must not crash the page that just navigated somewhere. */
function writeRecentTeamNames(names: readonly string[]): void {
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(names));
  } catch {
    // Private browsing or quota exhaustion: the strip will not remember this visit.
  }
  try {
    window.dispatchEvent(new Event(RECENT_CHANGE_EVENT));
  } catch {
    // Nothing else depends on the notification having gone out.
  }
}

/** Prepends `teamName`, drops any earlier occurrence, caps the length, and writes it back. */
function recordVisit(teamName: string): void {
  const current = readRecentTeamNames();
  const next = [teamName, ...current.filter((name) => name !== teamName)].slice(0, RECENT_LIMIT);
  writeRecentTeamNames(next);
}

/*
 * The `useSyncExternalStore` plumbing behind the recent strip. The snapshot is cached against the
 * raw string, because `getSnapshot` must return a stable value when nothing changed or React loops.
 */
let cachedRecentRaw: string | null = null;
let cachedRecentNames: readonly string[] = [];
const NO_RECENT_NAMES: readonly string[] = [];

function getRecentNamesSnapshot(): readonly string[] {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRecentRaw) return cachedRecentNames;
  cachedRecentRaw = raw;
  cachedRecentNames = readRecentTeamNames();
  return cachedRecentNames;
}

function subscribeToRecentNames(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(RECENT_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(RECENT_CHANGE_EVENT, onChange);
  };
}

const useRecentTeamNames = createBrowserStore(subscribeToRecentNames, getRecentNamesSnapshot, NO_RECENT_NAMES);

/** Highlights every case-insensitive occurrence of `query` inside `name` with a real `<mark>`. */
function HighlightedName({ name, query }: { name: string; query: string }) {
  if (!query) return <>{name}</>;
  const lower = name.toLowerCase();
  const parts: ReactNode[] = [];
  let from = 0;
  let at = lower.indexOf(query, from);
  let key = 0;
  while (at !== -1) {
    if (at > from) parts.push(name.slice(from, at));
    parts.push(
      <mark key={`match-${key}`} className={styles.match}>
        {name.slice(at, at + query.length)}
      </mark>,
    );
    key += 1;
    from = at + query.length;
    at = lower.indexOf(query, from);
  }
  if (from < name.length) parts.push(name.slice(from));
  return <>{parts}</>;
}

/**
 * One row: the team's own link, its service and catchment suburbs, the name check and a chevron.
 *
 * ⚠️ **THE MARKER IS A SIBLING OF THE LINK, NEVER A DESCENDANT OF IT.** A button inside an anchor is
 * invalid HTML and fires the navigation on top of the button. The link's `::after` stretches over
 * the row instead, and the marker sits above it.
 *
 * Every cell other than the name and the marker carries `data-row-detail`, so the gateway test can
 * check that what sits beside the name is a catchment fact and never a figure about people.
 */
function TeamRow({
  team,
  facts,
  query,
  collision,
  onOpenFamily,
}: {
  team: CommunityTeam;
  facts: TeamFacts | undefined;
  query: string;
  collision: CommunityNameCollision | undefined;
  onOpenFamily: (collision: CommunityNameCollision) => void;
}) {
  return (
    <li className={styles.teamRow} id={teamRowId(team.id)}>
      <Link
        className={styles.teamRowLink}
        href={communityTeamHref(team)}
        data-testid="community-index-link"
        onClick={() => recordVisit(team.name)}
      >
        <HighlightedName name={team.name} query={query} />
      </Link>
      <span className={styles.service} data-row-detail="service">
        {facts?.service}
      </span>
      <span className={styles.suburbs} data-row-detail="suburbs">
        {facts?.suburbs ?? 0}
      </span>
      <span className={styles.check}>
        {collision ? (
          <ReadsAlikeMarker collision={collision} onOpen={() => onOpenFamily(collision)} />
        ) : (
          <span className={styles.noMarker} data-row-detail="no-marker">
            No marker
          </span>
        )}
      </span>
      <Icon icon={ChevronRight} size={14} className={styles.teamRowGo} />
    </li>
  );
}

/**
 * The reads-alike marker. A real `<button type="button">`.
 *
 * ⚠️ **WORDING IS A CLINICAL-SAFETY RULE HERE, NOT A STYLE CHOICE.** It states a spelling property
 * and asks for a check. "Did you mean", or any wording implying sameness, is forbidden.
 */
function ReadsAlikeMarker({ collision, onOpen }: { collision: CommunityNameCollision; onOpen: () => void }) {
  const others = collision.names.length - 1;
  return (
    <button type="button" className={styles.readsAlike} data-testid="community-gateway-reads-alike" onClick={onOpen}>
      <StatusGlyph tone="warning" size={9} />
      Reads like {others} {others === 1 ? "other" : "others"}
      <SrOnly> — check you have the right one</SrOnly>
    </button>
  );
}

/**
 * One family set side by side: each spelling's own link, its service and its catchment suburbs, and
 * the suburbs more than one spelling names. Hidden families stay in the document, so every
 * colliding name keeps a link on the page whichever family is showing.
 */
function FamilySideBySide({
  family,
  hidden,
  factsFor,
  suburbsByClinicKey,
}: {
  family: CommunityNameCollision;
  hidden: boolean;
  factsFor: (name: string) => TeamFacts;
  suburbsByClinicKey: ReadonlyMap<string, ReadonlySet<string>>;
}) {
  const lead = family.names[0]?.name ?? "";
  const total = family.names.length;
  const shared = useMemo(() => {
    const seen = new Map<string, number>();
    for (const entry of family.names) {
      for (const suburb of suburbsByClinicKey.get(clinicKey(entry.name)) ?? []) {
        seen.set(suburb, (seen.get(suburb) ?? 0) + 1);
      }
    }
    return [...seen.entries()]
      .filter(([, count]) => count > 1)
      .map(([suburb]) => suburb)
      .sort((left, right) => left.localeCompare(right));
  }, [family, suburbsByClinicKey]);

  return (
    <div className={styles.family} hidden={hidden} data-testid="community-gateway-family-card">
      <div className={styles.sideTableWrap}>
        <table className={`${tableClasses.table} ${styles.sideTable}`}>
          <caption className="sr-only">
            {lead}, {total} entries read alike
          </caption>
          <thead>
            <tr>
              <th scope="col">Written as</th>
              {family.names.map((entry) => {
                const team = teamRef(entry.name);
                return (
                  <th key={team.id} scope="col">
                    <Link
                      className={styles.familyLink}
                      href={communityTeamHref(team)}
                      data-testid="community-gateway-family-link"
                      onClick={() => recordVisit(entry.name)}
                    >
                      {entry.name}
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Service</th>
              {family.names.map((entry) => (
                <td key={entry.name} className={styles.mono}>
                  {factsFor(entry.name).service}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Suburbs</th>
              {family.names.map((entry) => (
                <td key={entry.name} className={styles.mono}>
                  {factsFor(entry.name).suburbs}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {shared.length > 0 ? (
        <div className={styles.shared}>
          <h3 className={styles.subHead}>Suburbs more than one names</h3>
          <ul className={styles.tagList}>
            {shared.map((suburb) => (
              <li key={suburb} className={styles.tag}>
                {suburb}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** Teams per health service, with the mean as a tick and how many of each read alike. */
function ServiceBars({ serviceCounts }: { serviceCounts: ReadonlyMap<string, { teams: number; alike: number }> }) {
  const codes = COMMUNITY_SERVICE_OPTIONS.map((option) => option.value).filter(
    (value): value is Exclude<ServiceFilter, "all"> => value !== "all",
  );
  const present = codes.filter((code) => (serviceCounts.get(code)?.teams ?? 0) > 0);
  if (present.length === 0) return <p className={styles.muted}>No team on this page maps to a health service.</p>;
  const total = present.reduce((sum, code) => sum + (serviceCounts.get(code)?.teams ?? 0), 0);
  const rows: BarListRow[] = present.map((code) => {
    const entry = serviceCounts.get(code) ?? { teams: 0, alike: 0 };
    return {
      id: code,
      label: SERVICE_BAR_LABEL[code],
      value: entry.teams,
      display: (
        <span className={styles.serviceFigure}>
          {entry.teams}
          <span className={styles.alikeFigure}>
            <StatusGlyph tone={entry.alike > 0 ? "warning" : "neutral"} size={9} />
            {entry.alike}
          </span>
        </span>
      ),
    };
  });
  return (
    <>
      <BarList
        rows={rows}
        mean={total / present.length}
        meanLabel="Mean"
        label="Community teams by health service"
        labelWidth="9.5rem"
      />
      <SrOnly>
        <ul>
          {present.map((code) => (
            <li key={code}>
              {SERVICE_BAR_LABEL[code]}, names that read alike: {serviceCounts.get(code)?.alike ?? 0}
            </li>
          ))}
        </ul>
      </SrOnly>
    </>
  );
}

/**
 * The suburb lookup: which team or teams the catchment table names for a suburb. It reads
 * `lookupCatchment()` and states its note when the answer is contested, unreviewed or unknown; it
 * never picks one team for a reader. The quick picks are the suburbs whose own row names more than
 * one team, read off the rows.
 */
function SuburbLookup({
  teamByKey,
  factsFor,
  onShowInList,
}: {
  teamByKey: ReadonlyMap<string, CommunityTeam>;
  factsFor: (name: string) => TeamFacts;
  onShowInList: (team: CommunityTeam) => void;
}) {
  const picks = useMemo(() => {
    const names = new Set<string>();
    for (const row of S2015_CATCHMENT_ROWS) {
      if (parseFollowUpClinicSet(row.followUpClinicVerbatim).length > 1) names.add(row.suburb);
    }
    return [...names].sort((left, right) => left.localeCompare(right));
  }, []);
  const [suburb, setSuburb] = useState(() => picks[0] ?? "");
  const trimmed = suburb.trim();
  const lookup = useMemo(() => (trimmed ? lookupCatchment(trimmed) : null), [trimmed]);

  const answers = lookup && lookup.state !== "unknown" ? lookup.answers : [];
  const clinics = [...new Set(answers.flatMap((answer) => answer.clinics))];
  const postcodes = [...new Set(answers.flatMap((answer) => answer.postcodes))];
  const named = lookup?.suburb ?? trimmed;

  return (
    <Card className={styles.sideCard} aria-labelledby="community-suburb-lookup-title">
      <CardHead
        id="community-suburb-lookup-title"
        title="Suburb lookup"
        eyebrow
        aside={<span className={styles.headNote}>Which team covers it</span>}
      />
      <CardBody className={styles.lookupBody}>
        <TextInput
          icon={MapPin}
          aria-label="Suburb"
          placeholder="Suburb"
          autoComplete="off"
          value={suburb}
          onChange={(event) => setSuburb(event.target.value)}
          onClear={() => setSuburb("")}
          trailing={postcodes.length > 0 ? <span className={styles.mono}>{postcodes.join(", ")} WA</span> : undefined}
        />
        {picks.length > 0 ? (
          <div className={styles.picks} role="group" aria-label="Suburbs whose row names more than one team">
            {picks.map((pick) => (
              <button
                key={pick}
                type="button"
                className={buttonClass({ variant: "sec", size: "sm" })}
                aria-pressed={pick === trimmed}
                onClick={() => setSuburb(pick)}
              >
                {pick}
              </button>
            ))}
          </div>
        ) : null}
        {lookup === null ? null : (
          <div className={styles.lookupResult}>
            {clinics.length > 0 ? (
              <ul className={styles.lookupList}>
                {clinics.map((clinic) => {
                  const team = teamByKey.get(clinicKey(clinic));
                  const facts = factsFor(clinic);
                  return (
                    <li key={clinic} className={styles.lookupRow}>
                      <span className={styles.lookupName}>
                        {team ? (
                          <Link href={communityTeamHref(team)} onClick={() => recordVisit(team.name)}>
                            {clinic}
                          </Link>
                        ) : (
                          clinic
                        )}
                        <span className={styles.lookupMeta}>
                          {facts.service} · {facts.suburbs} suburbs
                        </span>
                      </span>
                      <span className={styles.lookupAside}>
                        {clinics.length > 1 ? (
                          <span className={styles.oneOf}>
                            <StatusGlyph tone="warning" size={9} />
                            One of {clinics.length}
                          </span>
                        ) : null}
                        {team ? (
                          <Button variant="ghost" size="sm" onClick={() => onShowInList(team)}>
                            Show in list
                          </Button>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {lookup.state === "reviewed" ? (
              clinics.length > 1 ? (
                <p className={styles.lookupNote}>
                  {clinics.length} teams name {named}. Check the right one.
                </p>
              ) : null
            ) : (
              <p className={styles.lookupNote}>{lookup.note}</p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * The empty state when the filters leave nothing — distinct from the empty SOURCE above. Each
 * variant states the absence in words and offers the next step.
 */
function SearchEmptyNotice({ query, alikeOnly }: { query: string; alikeOnly: boolean }) {
  if (query) {
    return (
      <div className={styles.emptyNotice} data-testid="community-gateway-search-empty">
        <p>
          <strong>No team name contains &ldquo;{query}&rdquo;.</strong>
        </p>
        <p>
          The list holds names as they reach this page, so a team may be recorded under a spelling you would not expect.
          Try a shorter fragment.
        </p>
      </div>
    );
  }
  return (
    <div className={styles.emptyNotice} data-testid="community-gateway-search-empty">
      <p>
        <strong>
          {alikeOnly ? "No team in this service reads like another." : "No teams found matching active filters."}
        </strong>
      </p>
      <p>Reset the filters to view all teams.</p>
    </div>
  );
}
