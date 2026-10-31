"use client";

/**
 * HELP IN THE HEADER SEARCH (search and forms review, Josh, 30 October 2026): "integrate questions
 * asked in help to search mode as well (add to main search) but the help search is focused on help
 * only". The header search lists up to three of Help's own answers beside its records; Help's own
 * search is unchanged.
 *
 * The search itself stays role-blind (`ward-global-search.tsx`). This wrapper, loaded with it, is the
 * caller that knows the desk: which answers are this desk's job, and where "Go there" leads. Typed
 * words stay in memory, as everywhere in search. A clinical question gets Help's fixed reply and no
 * answers, the same guard Help uses.
 */
import { useCallback } from "react";

import { howToHref } from "./help/ward-help-href";
import { askWardHelp, showWardHowTo } from "./help/ward-help-events";
import { CLINICAL_REPLY, searchHelp, type HelpSearchResult } from "./help/ward-help-search-index";
import { useTourRole, type WardTourRole } from "./help/ward-help-store";
import { useWardFeatureFlag } from "./shell/ward-feature-flag-store";
import { WardGlobalSearch as RoleBlindSearch, type WardGlobalSearchProps } from "./ward-global-search";
import type { HelpSearchRows, SearchResultItem } from "./ward-global-search-groups";

/** How many Help answers the header search shows; the rest are one tap away in Help. */
const HEADER_HELP_LIMIT = 3;

/** The answers last listed, so choosing one runs the right Help action. Module memory only. */
const listed = new Map<string, HelpSearchResult>();

function isDeskJob(result: HelpSearchResult, role: WardTourRole): boolean {
  return !result.desks || result.desks.includes(role);
}

/** Help's answers as header search rows. Exported for tests. */
export function headerHelpRows(query: string, role: WardTourRole): HelpSearchRows {
  const typed = query.trim();
  if (typed.length < 3) return { items: [] };
  const answer = searchHelp(typed, role, HEADER_HELP_LIMIT);
  if (answer.kind === "clinical") return { items: [], note: CLINICAL_REPLY };
  if (answer.kind !== "results") return { items: [] };
  listed.clear();
  const items = answer.results.map((result): SearchResultItem => {
    listed.set(result.key, result);
    const href = isDeskJob(result, role) ? howToHref(result.go, role, undefined) : undefined;
    return {
      kind: "help",
      kindLabel: "Help",
      id: result.key,
      title: result.title,
      meta: isDeskJob(result, role) ? result.detail : `Done by another desk · ${result.detail}`,
      // An answer with nowhere to go opens in Help itself (see `openHelpResult`).
      href: href ?? "",
    };
  });
  return { items };
}

/**
 * Runs a chosen Help answer: Show me when it has one for this desk, otherwise the answer in Help.
 * Returns false when the row's own link should simply be followed ("Go there").
 */
export function openHelpResult(id: string, role: WardTourRole, showMeOn: boolean): boolean {
  const result = listed.get(id);
  if (!result) return false;
  if (showMeOn && result.howToId && isDeskJob(result, role)) {
    showWardHowTo(result.howToId);
    return true;
  }
  if (isDeskJob(result, role) && howToHref(result.go, role, undefined)) return false;
  askWardHelp(result.title);
  return true;
}

/** The desk's Help lookups, for the header search and the phone menu's search. */
export function useHeaderHelp() {
  const role = useTourRole();
  const showMeOn = useWardFeatureFlag("help-ask");
  const findHelp = useCallback((query: string) => headerHelpRows(query, role), [role]);
  const onHelpResult = useCallback((id: string) => openHelpResult(id, role, showMeOn), [role, showMeOn]);
  return { findHelp, onHelpResult };
}

export function WardGlobalSearch(props: WardGlobalSearchProps) {
  const { findHelp, onHelpResult } = useHeaderHelp();
  return <RoleBlindSearch {...props} findHelp={findHelp} onHelpResult={onHelpResult} />;
}
