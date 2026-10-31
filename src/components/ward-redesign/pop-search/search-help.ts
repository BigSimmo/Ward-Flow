"use client";

/**
 * MOCK-UP COPY of the lookups in draft PR #1123's `ward-global-search-help.tsx`, because `main` does
 * not have them yet. Only the hook and its two helpers are copied; #1123's wrapper component is not
 * needed, because the mock-up's own `PopSearch` passes the lookups straight to the fork. The real
 * build imports #1123's file and deletes this copy.
 *
 * HELP IN THE HEADER SEARCH (Josh, 30 October 2026, ratified in D-91): up to three of Help's own
 * answers for a query of three letters or more. The search stays role-blind; this caller knows the
 * desk. A clinical question gets Help's fixed reply and no answers.
 */
import { useCallback } from "react";

import { howToHref } from "@/components/ward-management/help/ward-help-ask";
import { askWardHelp, showWardHowTo } from "@/components/ward-management/help/ward-help-events";
import {
  CLINICAL_REPLY,
  searchHelp,
  type HelpSearchResult,
} from "@/components/ward-management/help/ward-help-search-index";
import { useTourRole, type WardTourRole } from "@/components/ward-management/help/ward-help-store";
import { useWardFeatureFlag } from "@/components/ward-management/shell/ward-feature-flag-store";
import type { SearchResultItem } from "@/components/ward-management/ward-global-search-groups";

/** Help's rows for a query, or its fixed reply (`note`) to a clinical question (#1123's type). */
export type HelpSearchRows = { readonly items: readonly SearchResultItem[]; readonly note?: string };

/** How many Help answers the header search shows; the rest are one tap away in Help. */
const HEADER_HELP_LIMIT = 3;

/** The answers last listed, so choosing one runs the right Help action. Module memory only. */
const listed = new Map<string, HelpSearchResult>();

function isDeskJob(result: HelpSearchResult, role: WardTourRole): boolean {
  return !result.desks || result.desks.includes(role);
}

/** Help's answers as header search rows. */
function headerHelpRows(query: string, role: WardTourRole): HelpSearchRows {
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
function openHelpResult(id: string, role: WardTourRole, showMeOn: boolean): boolean {
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

/** The desk's Help lookups for the header search. */
export function useHeaderHelp() {
  const role = useTourRole();
  const showMeOn = useWardFeatureFlag("help-ask");
  const findHelp = useCallback((query: string) => headerHelpRows(query, role), [role]);
  const onHelpResult = useCallback((id: string) => openHelpResult(id, role, showMeOn), [role, showMeOn]);
  return { findHelp, onHelpResult };
}
