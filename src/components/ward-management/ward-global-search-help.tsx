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
import { useCallback, useMemo } from "react";
import { useIsPhone } from "@/components/wf";

import { useTourHome } from "./help/ward-tour-home";
import { useEffectiveWardAccess } from "./shell/ward-access-store";
import type { WardAccessScope } from "./ward-role-access";
import { howToFor } from "./help/ward-help-access";
import { HOW_TOS, showMeSteps } from "./help/ward-help-howto";
import { walkPlaysHere } from "./help/ward-help-screen-tours";
import { howToHref } from "./help/ward-help-href";
import { showMeAvailable } from "./help/ward-help-task-list";
import { askWardHelp, openWardHelp, showWardHowTo } from "./help/ward-help-events";
import { CLINICAL_REPLY, searchHelp, type HelpSearchResult } from "./help/ward-help-search-index";
import { useTourRole, type WardTourRole } from "./help/ward-help-store";
import { useWardFeatureFlag } from "./shell/ward-feature-flag-store";
import { WardGlobalSearch as RoleBlindSearch, type WardGlobalSearchProps } from "./ward-global-search";
import type {
  HelpPreviewAnswer,
  HelpPreviewSource,
  HelpSearchRows,
  SearchResultItem,
} from "./ward-global-search-groups";

/** How many Help answers the header search shows; the rest are one tap away in Help. */
const HEADER_HELP_LIMIT = 3;

/** The answers last listed, so choosing one runs the right Help action. Module memory only. */
const listed = new Map<string, HelpSearchResult>();

function isDeskJob(result: HelpSearchResult, role: WardTourRole, scope?: WardAccessScope): boolean {
  const howTo = HOW_TOS.find((entry) => entry.id === result.howToId);
  if (howTo && !howToFor(howTo, role, scope)) return false;
  return !result.desks || result.desks.includes(role);
}

/** Help's answers as header search rows. Exported for tests. */
export function headerHelpRows(query: string, role: WardTourRole, scope?: WardAccessScope): HelpSearchRows {
  const typed = query.trim();
  if (typed.length < 3) return { items: [] };
  const answer = searchHelp(typed, role, HEADER_HELP_LIMIT);
  if (answer.kind === "clinical") return { items: [], note: CLINICAL_REPLY };
  if (answer.kind !== "results") return { items: [] };
  const items = answer.results.map((result): SearchResultItem => {
    listed.set(result.key, result);
    const href = isDeskJob(result, role, scope) ? howToHref(result.go, role, undefined) : undefined;
    return {
      kind: "help",
      kindLabel: "Help",
      id: result.key,
      title: result.title,
      meta: isDeskJob(result, role, scope) ? result.detail : `Done by another desk · ${result.detail}`,
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
export function openHelpResult(
  id: string,
  role: WardTourRole,
  showMeOn: boolean,
  phone = false,
  home: string | undefined = "/ward-flow",
  scope?: WardAccessScope,
): boolean {
  const result = listed.get(id);
  if (!result) return false;
  if (result.howToId && helpPreviewAnswer(id, role, showMeOn, phone, home, scope)?.showMe) {
    showWardHowTo(result.howToId);
    return true;
  }
  if (isDeskJob(result, role, scope) && howToHref(result.go, role, undefined)) return false;
  // Without Show me, Help's Ask box is off too, so the desk's own task opens in How do I… instead.
  if (!showMeOn && result.howToId && isDeskJob(result, role, scope)) {
    openWardHelp("tasks", result.howToId);
    return true;
  }
  askWardHelp(result.title);
  return true;
}

/**
 * The answer behind a listed Help row, for the preview pane: the steps Show me lights, and whether
 * this desk may run Show me for it here (Help redesign, 1 Nov 2026). Exported for tests.
 */
export function helpPreviewAnswer(
  id: string,
  role: WardTourRole,
  showMeOn: boolean,
  phone = false,
  home: string | undefined = "/ward-flow",
  scope?: WardAccessScope,
): HelpPreviewAnswer | undefined {
  const result = listed.get(id);
  if (!result) return undefined;
  const howTo = result.howToId ? HOW_TOS.find((candidate) => candidate.id === result.howToId) : undefined;
  const steps = showMeSteps(howTo, phone ? "phone" : "desk", role);
  // A page walk round (one ward, one ED board) plays only on its own page.
  const here = !howTo || typeof window === "undefined" || walkPlaysHere(howTo, window.location.pathname);
  return {
    steps,
    showMe: Boolean(
      showMeOn && howTo && showMeAvailable(howTo, role, home, phone) && here && isDeskJob(result, role, scope),
    ),
  };
}

/** Opens a listed Help answer in Help itself ("Open in Help"). */
function openListedInHelp(id: string): void {
  const result = listed.get(id);
  if (result) askWardHelp(result.title);
}

/** The desk's Help lookups, for the header search and the phone menu's search. */
export function useHeaderHelp() {
  const role = useTourRole();
  const phone = useIsPhone();
  const scope = useEffectiveWardAccess().scope;
  const homes = useTourHome(role);
  const home = homes.deskHome ?? homes.home;
  const showMeOn = useWardFeatureFlag("help-ask");
  const findHelp = useCallback((query: string) => headerHelpRows(query, role, scope), [role, scope]);
  const onHelpResult = useCallback(
    (id: string) => openHelpResult(id, role, showMeOn, phone, home, scope),
    [role, showMeOn, phone, home, scope],
  );
  const helpPreview = useMemo<HelpPreviewSource>(
    () => ({
      answerFor: (id) => helpPreviewAnswer(id, role, showMeOn, phone, home, scope),
      showMe: (id) => {
        const howToId = listed.get(id)?.howToId;
        if (howToId && helpPreviewAnswer(id, role, showMeOn, phone, home, scope)?.showMe) showWardHowTo(howToId);
      },
      openInHelp: openListedInHelp,
    }),
    [role, showMeOn, phone, home, scope],
  );
  return { findHelp, onHelpResult, helpPreview };
}

export function WardGlobalSearch(props: WardGlobalSearchProps) {
  const { findHelp, onHelpResult, helpPreview } = useHeaderHelp();
  return <RoleBlindSearch {...props} findHelp={findHelp} onHelpResult={onHelpResult} helpPreview={helpPreview} />;
}
