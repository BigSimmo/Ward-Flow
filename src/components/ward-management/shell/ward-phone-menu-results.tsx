"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { NOTHING_FOUND, refusalFor } from "@/components/ward-management/search/search-refusals";
import { buildCensus } from "@/components/ward-management/search/patient-census";
import { answerQuestion, questionFor } from "@/components/ward-management/search/search-answers";
import { searchWardFlow } from "@/components/ward-management/search/ward-smart-search";
import { dueSoonThresholdsOf } from "@/components/ward-management/ward-clock";
import { useDebouncedValue } from "@/components/ward-management/search/use-debounced-value";
import { usePatientNameDisplay } from "@/components/ward-management/settings/discreet-names";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import {
  patientResultTitle,
  SearchResultIcon,
  smartSearchGroups,
  type SearchResultGroup,
  type SearchResultItem,
} from "@/components/ward-management/ward-global-search";

import { Chevron, MenuSearching, type PageRowRender, Section } from "./ward-phone-menu-parts";
import styles from "./ward-phone-menu.module.css";
import type { RailEntry } from "./ward-rail-entries";

/*
 * The phone menu's search results, split out of `ward-phone-menu.tsx` (16 October 2026) so the
 * search engine they need loads after the page instead of with it. The behaviour is unchanged.
 */

/** Records per kind in the menu, the same short list the header search shows under All. */
const MENU_RESULTS_PER_GROUP = 6;
/** Audit round 2 (S-33): what "Show all N" opens a group to, the header search's per-kind limit. */
const MENU_RESULTS_FULL = 40;

/**
 * The menu's search is the app's one smart search (`searchWardFlow`, grouped by
 * `smartSearchGroups`), so it finds the same patients, movements, places, forms and tasks as the
 * header search. Pages come first from the rail's own role-ordered entries; a screen the engine
 * matches by keyword (for example "beds" for Capacity) joins them rather than being listed twice.
 */
function useMenuSearch(query: string, entries: RailEntry[]) {
  const { movements, patients, units, referrals, plannedAdmissions, admissions, leaveBeds, dayZero, configuration } =
    useWardFlowSelect(
      "movements",
      "patients",
      "units",
      "referrals",
      "plannedAdmissions",
      "admissions",
      "leaveBeds",
      "dayZero",
      "configuration",
    );
  const now = useWardFlowClock();
  const debouncedQuery = useDebouncedValue(query, 120);
  const trimmed = query.trim();
  const needle = debouncedQuery.trim();
  const isPending = trimmed !== needle;
  return useMemo(() => {
    if (!needle || isPending) return null;
    const refusal = refusalFor(needle);
    const results = searchWardFlow({
      query: needle,
      patients,
      movements,
      units,
      referrals,
      now,
      limitPerGroup: MENU_RESULTS_FULL,
      plannedAdmissions,
    });
    // A common question ("over 24 hours") is answered from the Patients page's census, built only
    // when the text is one of those questions (search-answers.ts), as the header palette does.
    const answer =
      refusal || !questionFor(needle)
        ? undefined
        : answerQuestion(
            needle,
            buildCensus({
              movements,
              referrals,
              units,
              patients,
              admissions,
              plannedAdmissions,
              leaveBeds,
              now,
              thresholds: dueSoonThresholdsOf(configuration),
              dayZero,
            }),
            MENU_RESULTS_FULL,
          );
    const viewHrefs = new Set(results.views.map((view) => view.href));
    const lower = needle.toLowerCase();
    const pages = entries.filter((entry) => entry.label.toLowerCase().includes(lower) || viewHrefs.has(entry.href));
    // A screen already listed as a page drops out, including an alias titled the same (Escalation
    // is "Delays" and redirects there).
    const pageHrefs = new Set(pages.map((entry) => entry.href));
    const pageLabels = new Set(pages.map((entry) => entry.label.toLowerCase()));
    const groups: SearchResultGroup[] = refusal
      ? []
      : smartSearchGroups(results, needle, units, { patients, referrals, movements, plannedAdmissions }, answer)
          .map((group) =>
            group.key === "views"
              ? {
                  ...group,
                  items: group.items.filter(
                    (item) => !pageHrefs.has(item.href) && !pageLabels.has(item.title.toLowerCase()),
                  ),
                }
              : group,
          )
          .filter((group) => group.items.length > 0);
    const truncatedGroups =
      answer && answer.total > answer.rows.length ? [...results.truncatedGroups, "answers"] : results.truncatedGroups;
    return { needle, refusal, pages, groups, truncatedGroups };
  }, [
    needle,
    isPending,
    entries,
    movements,
    patients,
    units,
    referrals,
    plannedAdmissions,
    admissions,
    leaveBeds,
    dayZero,
    configuration,
    now,
  ]);
}

function ResultRow({ item, onGo }: { item: SearchResultItem; onGo: (item: SearchResultItem) => void }) {
  const nameFor = usePatientNameDisplay();
  const title = patientResultTitle(item, nameFor);
  return (
    <li>
      {/* Announce the name as shown, so the discreet form is never read out in full. */}
      <Link
        href={item.href}
        className={styles.row}
        onClick={() => onGo({ ...item, title })}
        data-testid="ward-phone-menu-result"
      >
        <SearchResultIcon kind={item.kind} id={item.id} className={styles.rowIcon} />
        <span className={styles.rowText}>
          <span className={styles.rowLabel}>{title}</span>
          {item.meta ? <span className={styles.rowMeta}>{item.meta}</span> : null}
        </span>
        <Chevron />
      </Link>
    </li>
  );
}

function MenuResults({
  search,
  pageRow,
  onGo,
}: {
  search: NonNullable<ReturnType<typeof useMenuSearch>>;
  pageRow: PageRowRender;
  onGo: (item: SearchResultItem) => void;
}) {
  const { needle, refusal, pages, groups, truncatedGroups } = search;
  // Audit round 2 (S-33): each group shows six, then "Show all N" opens the rest in place. A new
  // query starts short again.
  const [expanded, setExpanded] = useState<{ needle: string; keys: ReadonlySet<string> }>({
    needle,
    keys: new Set(),
  });
  const openKeys = expanded.needle === needle ? expanded.keys : new Set<string>();
  return (
    <>
      {pages.length > 0 ? <Section label="Pages">{pages.map((entry) => pageRow(entry))}</Section> : null}
      {groups.map((group) => {
        const full = openKeys.has(group.key);
        const shown = full ? group.items : group.items.slice(0, MENU_RESULTS_PER_GROUP);
        return (
          <Section key={group.key} label={group.heading}>
            {shown.map((item) => (
              <ResultRow key={`${item.kind}-${item.id}`} item={item} onGo={onGo} />
            ))}
            {shown.length < group.items.length ? (
              <li>
                <button
                  type="button"
                  className={styles.row}
                  data-testid={`ward-phone-menu-show-all-${group.key}`}
                  onClick={() => setExpanded({ needle, keys: new Set([...openKeys, group.key]) })}
                >
                  <span className={styles.rowText}>
                    <span className={styles.rowLabel}>
                      {truncatedGroups.includes(group.key) ? "Show first" : "Show all"} {group.items.length}
                    </span>
                  </span>
                </button>
              </li>
            ) : null}
            {truncatedGroups.includes(group.key) ? (
              <li className={styles.empty}>
                First {group.items.length} matches. Refine your search to see other matches.
              </li>
            ) : null}
          </Section>
        );
      })}
      {refusal ? (
        <p className={styles.empty}>{refusal.sentence}</p>
      ) : pages.length === 0 && groups.length === 0 ? (
        <p className={styles.empty}>{NOTHING_FOUND(needle)}</p>
      ) : null}
    </>
  );
}

/** With a search typed, the matching pages and records, or "Searching…" while they are worked out. */
export function MenuSearchResults({
  query,
  entries,
  pageRow,
  onGo,
}: {
  query: string;
  entries: RailEntry[];
  pageRow: PageRowRender;
  onGo: (item: SearchResultItem) => void;
}) {
  const search = useMenuSearch(query, entries);
  if (search) return <MenuResults search={search} pageRow={pageRow} onGo={onGo} />;
  return <MenuSearching />;
}
