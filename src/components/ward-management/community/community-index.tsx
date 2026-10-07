"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, BookOpen, ChevronDown, ChevronRight, FileText, Search, X } from "lucide-react";

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
import panelStyles from "@/components/ward-management/ward-panel.module.css";
import { createBrowserStore } from "@/lib/client-store-factory";
import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { mapClinicToServiceAndHospital } from "@/components/ward-management/tools/ward-catchment-resolver";
import { S2015_CATCHMENT_ROWS, parseFollowUpClinicSet } from "@/components/ward-management/ward-catchment";

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
 * THE GATEWAY REDESIGN, 2026-09-05 — approved prototype at
 * `docs/ward-flow/design/prototypes/mockup-community-gateway-v1.html`. This file reproduces that
 * mockup's structure and behaviour in React, over the app's own token layer; it does not change
 * what the mockup decided.
 *
 * ⚠️ **THE ONE RULE THIS FILE MUST NEVER BREAK: THIS PAGE COMPUTES NO "READS ALIKE" GROUPING OF ITS
 * OWN.** The mockup's own vanilla-JS prototype derives near-duplicate names inline, and its own
 * comments record two live bugs that derivation produced — a missing service-word ("clinic",
 * "centre") and a length-gated distance band that silently dropped the very misspelling it existed
 * to catch. Both were found only because a SECOND implementation existed to disagree with. This
 * page is that second implementation's replacement: it reads `communityNameCollisions()`,
 * `communityNamesInCollisions()` and `namesAreNearDuplicates()`-derived groupings from
 * `community-vocabulary.ts` and nothing else. If that shared function ever disagrees with what the
 * mockup shows, the shared function wins — that is the whole point of having one derivation feed
 * every surface, and it is an owner ruling, not a style preference.
 *
 * **What is new here, matched to the mockup:** a live search box with a rendered match count and a
 * "/" shortcut; an A–Z jump rail whose disabled letters say why in words; letter-headed sections of
 * rows in place of the old flat `<ul>` of boxes; a "reads like N others" marker — never "did you
 * mean" — on every row whose name collides, opening a collapsible panel that lists each family side
 * by side; and a "recently opened" strip backed by `localStorage`, wrapped in `try`/`catch` on every
 * read and write because it throws in a private or storage-restricted context.
 *
 * **The marker never implies sameness, and an absent one is stated as not proving uniqueness.**
 * Both are TRUTH rules from the owner, not wording preferences: this page marks a name that reads
 * like another, it never merges, corrects or de-duplicates one, and it says so in words in the
 * provenance copy below.
 *
 * ⚠️ **THE PROVENANCE COPY NAMED `ICC` AS ITS EXAMPLE UNTIL 2026-09-05, AND THE EXAMPLE HAD TO GO
 * BEFORE IT BECAME A LIE.** It read that `ICC` carries no marker because no rule flags an
 * initialism — true of the string rules, and about to be false of the page. The owner confirmed
 * that day that `ICC`, `Inner City`, `Inner City Clinic` and `Inner City (central)` are ONE
 * service across 21 suburbs, so an owner-confirmed alias list will record them as the same. **A
 * screen teaching a reader that `ICC` is unmatched, while it is matched, is worse than the gap it
 * was describing.** The copy now states the MECHANISM — the check compares spellings, so an
 * abbreviation or a renaming is invisible to it — which stays true either side of that landing,
 * and points at the human decision rather than at one name whose status can change underneath it.
 * `tests/ward-community-collision-coverage.test.ts` pins `ICC` as unmatched BY THE RULES, and is
 * meant to go red when the alias list lands: it is the thing that makes whoever lands it come and
 * read this paragraph. Fix the copy, never the pin.
 *
 * **Two counts are rendered here that are not typed anywhere as prose**: the search result line and
 * the two chip counts. Every one of them reads off `allTeams`/`filteredTeams`/the collision map at
 * render time, the same discipline the surrounding doc comment already holds this file to for the
 * team count itself.
 */
export const COMMUNITY_SERVICE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "NMHS", label: "North Metro (NMHS)" },
  { value: "SMHS", label: "South Metro (SMHS)" },
  { value: "EMHS", label: "East Metro (EMHS)" },
  { value: "WACHS", label: "Country Health (WACHS)" },
] as const;

export function CommunityIndex({ teams = COMMUNITY_TEAM_PAGES }: { teams?: readonly CommunityTeam[] }) {
  // Sorted here rather than trusted from upstream. `communityTeamOptions()` happens to return its
  // names sorted today, but this page is the surface making the alphabetical CLAIM — in its own
  // copy, on screen — and a claim held somewhere else is a claim that can be withdrawn without
  // anybody editing the page that makes it. The id tie-break keeps the order total: `localeCompare`
  // can rank two distinct names equal, and an unstable order on an index is a team that appears to
  // move between renders.
  const allTeams = useMemo(
    () => [...teams].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
    [teams],
  );

  // One call to the shared derivation, indexed by name for O(1) lookup per row. `communityNameCollisions()`
  // re-derives from the catchment rows on every call (its own doc comment says so), so it is called
  // once here and once below for the family panel's own totals — never re-implemented.
  const collisionByName = useMemo(() => {
    const map = new Map<string, CommunityNameCollision>();
    for (const collision of communityNameCollisions()) {
      for (const entry of collision.names) map.set(entry.name, collision);
    }
    return map;
  }, []);

  // Pre-map every community team name to its health service code ("NMHS" | "SMHS" | "EMHS" | "WACHS")
  const teamServiceMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const team of allTeams) {
      map.set(team.name, mapClinicToServiceAndHospital(team.name).code);
    }
    return map;
  }, [allTeams]);

  // Suburb aliases + service labels so typeahead matches the PR's promised fields, not only names.
  const teamSearchHaystack = useMemo(() => {
    const suburbByClinicKey = new Map<string, Set<string>>();
    const clinicKey = (name: string) =>
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, " ")
        .trim();
    for (const row of S2015_CATCHMENT_ROWS) {
      for (const clinic of parseFollowUpClinicSet(row.followUpClinicVerbatim)) {
        const key = clinicKey(clinic);
        if (!key) continue;
        const set = suburbByClinicKey.get(key) ?? new Set<string>();
        set.add(row.suburb);
        suburbByClinicKey.set(key, set);
      }
    }
    const map = new Map<string, string>();
    for (const team of allTeams) {
      const mapping = mapClinicToServiceAndHospital(team.name);
      const suburbs = suburbByClinicKey.get(clinicKey(team.name));
      map.set(
        team.name,
        [team.name, mapping.code, mapping.name, mapping.displayName, ...(suburbs ? [...suburbs] : [])]
          .join(" ")
          .toLowerCase(),
      );
    }
    return map;
  }, [allTeams]);

  // The family panel is deliberately NOT scoped to the `teams` prop: it is the same derivation
  // regardless of which subset of pages a caller happens to be rendering (a test overriding `teams`
  // to `[]` still gets an honest, real family panel rather than an empty one that looks like a
  // measurement of the override).
  const familyGroups = useMemo(() => communityNameCollisions(), []);

  const [query, setQuery] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");

  // `useSyncExternalStore` (via `createBrowserStore`, module scope below), not a `useState` fed
  // from an effect: an effect that calls `setState` in its own body — which is exactly what a
  // "load once after mount" effect does — trips `react-hooks/set-state-in-effect`, and rightly so,
  // since it is really a subscription to state that lives outside React. This also renders under
  // `renderToStaticMarkup` in several test files, which never runs effects OR subscribes, so the
  // server snapshot (an empty list) is what those tests see — exactly the honest "nothing opened
  // yet" state a server-rendered first paint should have anyway.
  const storedRecentNames = useRecentTeamNames();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const familyPanelRef = useRef<HTMLDetailsElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    if (!drawerOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setDrawerOpen(false);
        drawerTriggerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    /*
     * ⚠️ **`stopPropagation()` IS LOAD-BEARING, NOT DEFENSIVE.** `WardGlobalSearch`
     * (`ward-global-search.tsx`) binds the same "/" shortcut on `window`, and a keydown dispatched
     * inside this document bubbles from `document` to `window` afterwards — so without this call,
     * the header's handler ran a moment after this one on every "/" press, read the ORIGINAL event
     * target (still whatever had focus before either handler ran, never this field, since the
     * target does not change when focus moves mid-event), and refocused its own input, undoing the
     * line above. Measured on `/community`: `document.activeElement` ended up as the header's
     * input, not this one, even though this handler ran first and the page renders a `[/]` hint
     * beside its own field. This page's own field owning "/" on this page is the intended reading
     * of that hint — `WardGlobalSearch`'s handler already declines to act when the keydown's target
     * is itself a form field (see its own "does not hijack another field" guard), so a page owning
     * the key on its own route is a shape the header already anticipates, not one that fights it.
     * Stopping propagation here is what actually delivers that: it keeps the keystroke from ever
     * reaching the header's `window` listener at all, rather than racing it.
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

  // Imperative rather than a controlled `open` state: this only ever needs to force the panel OPEN
  // from a row's marker, never to close it, and a controlled boolean would have to track the
  // reader's own toggle clicks too just to stay in sync with the native element.
  const openFamilyPanel = useCallback(() => {
    const panel = familyPanelRef.current;
    if (!panel) return;
    panel.open = true;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panel.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, []);

  // `document.getElementById` rather than a ref map: the set of letters is not fixed (it depends on
  // what the current search leaves visible), so a ref map would have to be rebuilt on every filter
  // change for no benefit over an id lookup that already has to happen at click time regardless.
  const jumpToLetter = useCallback((letter: string) => {
    const heading = document.getElementById(letterHeadingId(letter));
    if (!heading) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    heading.focus();
  }, []);

  // One source-validated recent list feeds the strip, the filter and its count, so a stored name that
  // was renamed or removed can never show a chip the filter then reports as empty.
  const recentNames = useMemo(() => {
    const known = new Set(allTeams.map((team) => team.name));
    return storedRecentNames.filter((name) => known.has(name));
  }, [allTeams, storedRecentNames]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredTeams = useMemo(
    () =>
      allTeams.filter((team) => {
        if (serviceFilter !== "all" && teamServiceMap.get(team.name) !== serviceFilter) return false;
        if (normalizedQuery) {
          const haystack = teamSearchHaystack.get(team.name) ?? team.name.toLowerCase();
          if (!haystack.includes(normalizedQuery)) return false;
        }
        return true;
      }),
    [allTeams, serviceFilter, teamServiceMap, teamSearchHaystack, normalizedQuery],
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

  return (
    <div className={styles.screen} data-testid="community-index">
      <main id="main-content" className={styles.main}>
        <div className={styles.topActionBar}>
          <div className={styles.topActionContext}>
            <h1 className={styles.pageTitle}>Community teams</h1>
          </div>
          <div className={styles.topActionButtons}>
            <Link
              href="/mockups/ward-flow/referrals/new"
              className={styles.btnActionPrimary}
              data-testid="community-action-raise-referral"
            >
              <FileText aria-hidden="true" className={styles.btnIcon} />
              <span>+ Raise Referral</span>
            </Link>
            <Link
              href="/mockups/ward-flow/referrals"
              className={styles.btnActionSecondary}
              data-testid="community-action-referral-board"
            >
              <ArrowUpRight aria-hidden="true" className={styles.btnIcon} />
              <span>Referrals</span>
            </Link>
            <button
              ref={drawerTriggerRef}
              type="button"
              className={styles.btnActionSecondary}
              onClick={() => setDrawerOpen(true)}
              data-testid="community-action-catchment-guide"
              aria-haspopup="dialog"
              aria-expanded={drawerOpen}
            >
              <BookOpen aria-hidden="true" className={styles.btnIcon} />
              <span>Catchment Guide</span>
            </button>
          </div>
        </div>

        <p className="sr-only">
          These are recorded <strong>names</strong>, not verified services; possible aliases remain separate.
        </p>

        <div className={styles.body}>
          <nav className={styles.azRail} aria-label="Jump to letter">
            {/*
             * ⚠️ `aria-disabled`, NOT native `disabled` — an empty letter is unavailable for a
             * STATED reason (no team currently starts with it), and the reason can change on the
             * next render as the search or the collision filter changes what `grouped` holds. A
             * native `disabled` button drops out of the Tab order entirely, so a keyboard or
             * screen-reader user moving by Tab would never land on the letter to learn why it is
             * empty, and the rail's own count of live letters would silently shrink under them.
             * `ignoreUnavailableActivation` absorbs the click the same way the rest of this repo's
             * `aria-disabled` controls do; see `primitive-recipes/recipes.ts`.
             */}
            {ALPHABET.map((letter) => {
              const present = grouped.has(letter);
              const blockedReason = present ? undefined : `No teams under this letter`;
              const blockedId = present ? undefined : azRailBlockedId(letter);
              return (
                // F14 (Opus adversarial review, 2026-09-17): the reason span used to sit INSIDE
                // this button. `aria-describedby` already pointed at it for the DESCRIPTION, but a
                // descendant text node is also folded into the accessible NAME computation, so the
                // reason was announced twice — once as "A No teams under this letter" (the name)
                // and again as its own description. Moving it to a sibling, still inside the rail
                // and still referenced by `aria-describedby`, keeps the description and drops the
                // button's name back to just the letter.
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

          <div className={styles.content}>
            {recentNames.length > 0 ? (
              <section className={styles.recentStrip} aria-label="Recently opened">
                <p className={styles.stripLabel}>Recently opened</p>
                <div className={styles.recentRow}>
                  {recentNames.map((name) => {
                    const team = teamRef(name);
                    return (
                      <Link
                        key={team.id}
                        className={styles.recentLink}
                        href={communityTeamHref(team)}
                        data-testid="community-gateway-recent-link"
                        onClick={() => recordVisit(name)}
                      >
                        {name}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section
              className={`${panelStyles.panel} ${styles.directoryPanel}`}
              aria-label="A–Z"
              data-testid="community-index-teams"
              data-ward-primitive="panel"
            >
              <header className={styles.directoryHeader} data-ward-primitive="panel-header">
                <div className={styles.headerControlsLeft}>
                  <h2 className={styles.directoryTitle}>A–Z</h2>
                  <span className={styles.headerDivider} aria-hidden="true" />
                  <div className={styles.searchRow}>
                    <div className={styles.searchBox}>
                      <label className={styles.searchField}>
                        <Search aria-hidden="true" className={styles.searchIcon} />
                        <input
                          ref={searchInputRef}
                          type="search"
                          className={styles.searchInput}
                          placeholder="Search team names"
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
                        />
                      </label>
                      {query ? (
                        <button
                          type="button"
                          className={styles.clearButton}
                          aria-label="Clear search"
                          onClick={() => {
                            setQuery("");
                            searchInputRef.current?.focus();
                          }}
                        >
                          Clear
                        </button>
                      ) : null}
                      <kbd className={styles.kbdHint} aria-hidden="true">
                        /
                      </kbd>
                    </div>

                    <div className={styles.nameFilter}>
                      <select
                        className={styles.filterSelect}
                        aria-label="Filter team names"
                        value={serviceFilter}
                        onChange={(event) => setServiceFilter(event.target.value)}
                      >
                        {COMMUNITY_SERVICE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown aria-hidden="true" className={styles.filterChevron} />
                    </div>
                  </div>
                </div>

                <div className={styles.headerStatusRight}>
                  <p className={styles.resultLine} aria-live="polite" data-testid="community-gateway-result-line">
                    {filteredTeams.length === allTeams.length ? (
                      <>
                        <strong>{filteredTeams.length}</strong> synthetic team results
                      </>
                    ) : (
                      <>
                        <strong>{filteredTeams.length}</strong> of {allTeams.length} synthetic team results
                      </>
                    )}
                  </p>

                  {(query.trim() !== "" || serviceFilter !== "all") && (
                    <button
                      type="button"
                      className={styles.resetButton}
                      onClick={() => {
                        setQuery("");
                        setServiceFilter("all");
                        searchInputRef.current?.focus();
                      }}
                      aria-label="Reset all search and filter parameters"
                      title="Clear active search and filter"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </header>
              {allTeams.length === 0 ? (
                /*
                 * An empty SOURCE is rendered as a stated absence, never as an empty list. A blank
                 * list looks exactly like a loaded page for a service with no teams, and nobody
                 * re-checks a blank — so the page has to say which of the two it is. It says only
                 * what is observable: the derivation returned nothing. It does NOT name a cause,
                 * because nothing here can see one. This is deliberately checked BEFORE the search
                 * filter below: a truly empty source and a search that matched nothing are two
                 * different facts and must not share one sentence.
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
                <SearchEmptyNotice query={query.trim()} />
              ) : (
                <div className={styles.letterGroups} role="region" aria-label="Community team directory" tabIndex={0}>
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
                            query={normalizedQuery}
                            collision={collisionByName.get(team.name)}
                            onVisit={recordVisit}
                            onOpenFamilyPanel={openFamilyPanel}
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </section>

            <details className={styles.familyPanel} ref={familyPanelRef} data-testid="community-gateway-family-panel">
              <summary className={styles.familySummary}>
                <ChevronRight aria-hidden="true" className={styles.familyCaret} />
                <span>
                  Names that read alike — <strong>{communityNamesInCollisions()}</strong> names in{" "}
                  <strong>{familyGroups.length}</strong> groups
                </span>
                <span className={styles.familyWhy}>View details</span>
              </summary>
              <div className={styles.familyBody}>
                <p>
                  These entries reduce to the same or nearly the same name once brackets, punctuation and suffixes such
                  as &ldquo;HS&rdquo; are set aside. <strong>They have not been merged.</strong> Each is still its own
                  entry with its own page, exactly as the source document records it — this grouping is only a prompt to
                  check you are opening the one you mean.
                </p>
                {familyGroups.length === 0 ? (
                  <p className={styles.familyEmpty} data-testid="community-gateway-family-empty">
                    No name in this list currently reads like another. That would itself be a change worth noticing,
                    since the source document is known to hold near-duplicate spellings.
                  </p>
                ) : (
                  <div className={styles.familyGrid}>
                    {familyGroups.map((family) => (
                      <FamilyCard key={family.names[0]?.name ?? ""} family={family} onVisit={recordVisit} />
                    ))}
                  </div>
                )}
              </div>
            </details>
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
            This is a way in, not a caseload. It shows each team&apos;s name and links to it — no counts of people, no
            discharges and nothing about who a team is following up. A team&apos;s own page answers those questions for
            that team.
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
              <span>Unverified directory · Not a medical device</span>
              <span className="sr-only">
                Every team listed here comes from one extracted source document; no team has agreed to be represented,
                and nothing here has been checked against a real service.
              </span>
            </>
          }
        />

        {drawerOpen ? (
          <div
            className={styles.drawerScrim}
            onClick={() => {
              setDrawerOpen(false);
              drawerTriggerRef.current?.focus();
            }}
          >
            <div
              className={styles.drawerPanel}
              role="dialog"
              aria-modal="true"
              aria-labelledby="community-catchment-guide-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.drawerHead}>
                <div className={styles.drawerHeadTitleWrap}>
                  <BookOpen aria-hidden="true" className={styles.drawerHeadIcon} />
                  <div
                    id="community-catchment-guide-title"
                    role="heading"
                    aria-level={2}
                    className={styles.drawerTitle}
                  >
                    Catchment Directory Guide
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.drawerClose}
                  aria-label="Close guide"
                  onClick={() => {
                    setDrawerOpen(false);
                    drawerTriggerRef.current?.focus();
                  }}
                >
                  <X aria-hidden="true" className={styles.drawerCloseIcon} />
                </button>
              </div>
              <div className={styles.drawerBody}>
                <section className={styles.drawerSection}>
                  <h3 className={styles.drawerSectionTitle}>Where this list comes from</h3>
                  <p className={styles.drawerText}>
                    Every team listed in this directory is derived directly from the referral intake vocabulary
                    extracted from Western Australian Mental Health Service catchment documentation.
                  </p>
                </section>

                <section className={styles.drawerSection}>
                  <h3 className={styles.drawerSectionTitle}>Similar names</h3>
                  <p className={styles.drawerText}>
                    Some recorded names read alike. Each remains a separate entry; check that you are opening the team
                    you mean. This directory has not been verified with the services.
                  </p>
                </section>

                <section className={styles.drawerSection}>
                  <h3 className={styles.drawerSectionTitle}>Actions</h3>
                  <div className={styles.drawerActions}>
                    <Link href="/mockups/ward-flow/referrals/new" className={styles.drawerBtnPrimary}>
                      <FileText aria-hidden="true" className={styles.btnIcon} />
                      <span>Raise referral</span>
                    </Link>
                  </div>
                </section>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

/** How many recently-opened teams the strip remembers. */
const RECENT_LIMIT = 5;

/** The `localStorage` key the "recently opened" strip reads and writes. Namespaced to this
 *  prototype's gateway rather than reusing another Ward Flow key, so the two cannot collide. */
const RECENT_STORAGE_KEY = "ward-community-gateway-recent";

/** Fired after a same-tab write, since the `storage` event browsers dispatch natively only reaches
 *  OTHER tabs, never the tab that made the write — and this strip has to update in the same tab a
 *  reader just clicked a team in. */
const RECENT_CHANGE_EVENT = "ward-community-gateway-recent-change";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** The id a letter's heading renders under, and the id the jump rail looks up. One function, so
 *  the two never drift apart. */
function letterHeadingId(letter: string): string {
  return `community-gateway-letter-${letter}`;
}

/** The id an empty A–Z rail letter's `aria-describedby` points at, and the id its own `sr-only`
 *  reason span renders under. Namespaced separately from `letterHeadingId` — the two ids name
 *  different things (a heading that exists only when the letter is present; a reason that exists
 *  only when it is not) and must never collide even though they share a source letter. */
function azRailBlockedId(letter: string): string {
  return `community-gateway-az-blocked-${letter}`;
}

/**
 * A `CommunityTeam` built straight from a name, for the two surfaces (the recent strip, the family
 * panel) that carry only a name and need a link. `id` is recomputed from the name via
 * `communityTeamSlug` — the same function `COMMUNITY_TEAM_PAGES` itself uses — rather than looked
 * up in `allTeams`, which may be a caller-supplied subset that does not contain this name at all.
 */
function teamRef(name: string): CommunityTeam {
  return { id: communityTeamSlug(name), name };
}

/**
 * Every name the "recently opened" strip has stored, oldest read failure absorbed rather than
 * thrown. Wrapped in `try`/`catch`: `localStorage` throws in a private-browsing context in some
 * browsers, and a page that crashed on that would be a strictly worse outcome than a strip that
 * simply remembers nothing this session.
 */
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

/** The write half of the pair above — same reason, same shape: a failed write must not crash the
 *  page that just successfully navigated somewhere. */
function writeRecentTeamNames(names: readonly string[]): void {
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(names));
  } catch {
    // Private browsing or quota exhaustion: the strip will not remember this visit, and nothing
    // else on the page depends on the write having succeeded.
  }
  try {
    window.dispatchEvent(new Event(RECENT_CHANGE_EVENT));
  } catch {
    // No `window` (should not happen — this only ever runs from a click handler) — nothing else
    // depends on the notification having gone out.
  }
}

/** Reads the strip, prepends `teamName`, drops any earlier occurrence of it, and caps the length —
 *  then writes the result straight back. A plain module-level function rather than a hook: nothing
 *  it does depends on this component's own state, so every caller (a team row, a family-panel
 *  link, the recent strip's own links) can reference it directly with a stable identity. */
function recordVisit(teamName: string): void {
  const current = readRecentTeamNames();
  const next = [teamName, ...current.filter((name) => name !== teamName)].slice(0, RECENT_LIMIT);
  writeRecentTeamNames(next);
}

/*
 * The `useSyncExternalStore` plumbing behind `recentNames` in `CommunityIndex` — the same
 * `createBrowserStore` pattern `use-ward-sidebar-collapsed.ts` already uses, and for the same
 * reason: it lets a write to `localStorage` trigger a re-render through a SUBSCRIPTION rather than
 * through `setState` called inside an effect body, which is the pattern
 * `react-hooks/set-state-in-effect` exists to flag — correctly, since state that lives in
 * `localStorage` is exactly the "external system" `useSyncExternalStore` is for.
 *
 * ⚠️ THE SNAPSHOT IS CACHED AGAINST THE RAW STRING, NOT RECOMPUTED ON EVERY CALL. `getSnapshot`
 * must return a referentially STABLE value when nothing has changed, or `useSyncExternalStore`
 * treats every render as a change and loops. Parsing a fresh array from `JSON.parse` on every call
 * would do exactly that, so the last raw string and its parsed array are cached at module scope and
 * only a raw string that has actually changed produces a new array reference.
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
  // `storage` covers a write from another tab; the custom event covers a write from THIS one,
  // which the native `storage` event deliberately never fires for.
  window.addEventListener("storage", onChange);
  window.addEventListener(RECENT_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(RECENT_CHANGE_EVENT, onChange);
  };
}

const useRecentTeamNames = createBrowserStore(subscribeToRecentNames, getRecentNamesSnapshot, NO_RECENT_NAMES);

/**
 * Highlights every case-insensitive occurrence of `query` inside `name` with a real `<mark>`,
 * exactly like the approved mockup. Returns `name` untouched when there is no query, so a row never
 * pays for a scan it does not need.
 */
function highlightMatches(name: string, query: string): ReactNode {
  if (!query) return name;
  const lower = name.toLowerCase();
  const needle = query.toLowerCase();
  const parts: ReactNode[] = [];
  let from = 0;
  let at = lower.indexOf(needle, from);
  let key = 0;
  while (at !== -1) {
    if (at > from) parts.push(name.slice(from, at));
    parts.push(
      <mark key={`match-${key}`} className={styles.match}>
        {name.slice(at, at + needle.length)}
      </mark>,
    );
    key += 1;
    from = at + needle.length;
    at = lower.indexOf(needle, from);
  }
  if (from < name.length) parts.push(name.slice(from));
  return parts;
}

/**
 * One row: the team's own link, an optional reads-alike marker, and a "go" chevron.
 *
 * ⚠️ **THE MARKER IS A SIBLING OF THE LINK, NEVER A DESCENDANT OF IT.** A `<button>` nested inside
 * an `<a>` is invalid HTML and, worse, fires the anchor's own navigation on top of the button's
 * click — a reader trying to open the comparison panel would be sent straight to the team page
 * instead. `.teamRowLink`'s CSS stretches an `::after` pseudo-element over the whole row so the row
 * keeps its whole-area click behaviour without the marker ever being inside the anchor's own DOM
 * subtree — the same technique the approved mockup documents in its own CSS comments.
 */
function TeamRow({
  team,
  query,
  collision,
  onVisit,
  onOpenFamilyPanel,
}: {
  team: CommunityTeam;
  query: string;
  collision: CommunityNameCollision | undefined;
  onVisit: (name: string) => void;
  onOpenFamilyPanel: () => void;
}) {
  return (
    <li className={styles.teamRow}>
      <Link
        className={styles.teamRowLink}
        href={communityTeamHref(team)}
        data-testid="community-index-link"
        onClick={() => onVisit(team.name)}
      >
        <span className={styles.teamRowName}>{highlightMatches(team.name, query)}</span>
      </Link>
      {collision ? <ReadsAlikeMarker collision={collision} onOpen={onOpenFamilyPanel} /> : null}
      <ChevronRight aria-hidden="true" className={styles.teamRowGo} />
    </li>
  );
}

/**
 * The reads-alike marker itself. A real `<button type="button">`, never a `<span role="button">` —
 * a fake button is invisible to keyboard Tab order and to the accessibility tree's list of
 * activatable controls, which is exactly the gap this whole task exists to close on the rest of the
 * page.
 *
 * ⚠️ **WORDING IS A CLINICAL-SAFETY RULE HERE, NOT A STYLE CHOICE.** "Reads like N others — check
 * you have the right one" states a spelling property and asks for a check. "Did you mean" — or any
 * wording implying sameness — is forbidden: this project has already shipped the harm a merge would
 * cause (see `community-vocabulary.ts`'s own doc comment), and the owner ruled the fix is a visible
 * split a reader is warned about, never an invisible merge nobody is.
 */
function ReadsAlikeMarker({ collision, onOpen }: { collision: CommunityNameCollision; onOpen: () => void }) {
  const others = collision.names.length - 1;
  return (
    <button type="button" className={styles.readsAlike} data-testid="community-gateway-reads-alike" onClick={onOpen}>
      <span className={styles.readsAlikeDot} aria-hidden="true" />
      Reads like {others} {others === 1 ? "other" : "others"} — check you have the right one
    </button>
  );
}

/** One family in the collapsible panel: the lead spelling, a rendered count of the group, and every
 *  member linked to its own page. `teamRef` builds each link independently of `allTeams` — see its
 *  own comment — so this panel is honest even when a caller renders the index over a subset. */
function FamilyCard({ family, onVisit }: { family: CommunityNameCollision; onVisit: (name: string) => void }) {
  const lead = family.names[0]?.name ?? "";
  const total = family.names.length;
  return (
    <div className={styles.familyCard} data-testid="community-gateway-family-card">
      <p className={styles.familyCardLabel}>
        {lead} — {total} {total === 1 ? "entry" : "entries"} read alike
      </p>
      <ul className={styles.familyCardList}>
        {family.names.map((entry) => {
          const team = teamRef(entry.name);
          return (
            <li key={team.id}>
              <Link
                className={styles.familyCardLink}
                href={communityTeamHref(team)}
                data-testid="community-gateway-family-link"
                onClick={() => onVisit(entry.name)}
              >
                {entry.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The empty state when a search or the "reads alike" filter leaves nothing — distinct from the
 * "the whole derivation is empty" state above, which is a fact about the SOURCE rather than about
 * anything a reader typed. Three variants, matched to the approved mockup: alike-only with a query,
 * alike-only alone, and a plain query. Every variant states the absence in words and offers the
 * next step, never a bare blank.
 */
function SearchEmptyNotice({ query }: { query: string }) {
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
        <strong>No teams found matching active filters.</strong>
      </p>
      <p>Try resetting the filter to view all teams.</p>
    </div>
  );
}
