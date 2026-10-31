/**
 * MOCK-UP: the header search's kind chips, start-screen rows and recent records, moved out of the
 * fork (`global-search.tsx`) unchanged so that file stays under the 1,500-line cap. The kind chips
 * carry draft PR #1123's Contacts, Help and suburb additions. People no longer folds in "Did you
 * mean?", which the mock-up leaves out (never a typo match for a person, `search-groups.ts`).
 */
import { useLayoutEffect, useSyncExternalStore } from "react";

import { onWardSessionEnd } from "@/components/ward-management/ward-browser-data";
import type { SearchResultItem } from "@/components/ward-management/ward-global-search-groups";
import { WARD_ADD_PERSON_HREF, WARD_REFERRAL_INTAKE_HREF } from "@/components/ward-management/ward-nav";

/**
 * THE KIND CHIPS ALONG THE TOP OF THE PALETTE. "All" keeps the short list per kind; a single kind
 * shows that kind's matches up to `FULL_RESULTS_PER_GROUP`, so a chip is also how someone sees
 * more than six of one thing without leaving the page. Places folds wards, EDs and teams together,
 * the same three groups the engine leads with for a place query.
 */
export type KindFilter =
  | "all"
  | "answers"
  | "people"
  | "movements"
  | "referrals"
  | "places"
  | "forms"
  | "views"
  | "tasks"
  | "contacts"
  | "help";

export const KIND_FILTERS: readonly { key: KindFilter; label: string; groups: readonly string[] }[] = [
  { key: "all", label: "All", groups: [] },
  // A common question ("over 24 hours") answered from the Patients page's census (search-answers.ts).
  { key: "answers", label: "Answers", groups: ["answers"] },
  { key: "people", label: "People", groups: ["people"] },
  { key: "movements", label: "Movements", groups: ["movements"] },
  { key: "referrals", label: "Referrals", groups: ["referrals"] },
  { key: "places", label: "Places", groups: ["beds", "wards", "eds", "teams", "suburbs"] },
  { key: "forms", label: "Forms", groups: ["forms"] },
  { key: "views", label: "Views", groups: ["views"] },
  { key: "tasks", label: "Tasks", groups: ["tasks"] },
  { key: "contacts", label: "Contacts", groups: ["contacts"] },
  { key: "help", label: "Help", groups: ["help"] },
];

export const FULL_RESULTS_PER_GROUP = 40;

/** The screens offered before anything is typed: the four a coordinator jumps to most. */
export const START_VIEW_KEYS = ["capacity", "delays", "referrals", "handover"] as const;

export const START_ACTIONS: readonly SearchResultItem[] = [
  {
    kind: "action",
    kindLabel: "Action",
    id: "new-referral",
    title: "New referral",
    meta: "",
    href: WARD_REFERRAL_INTAKE_HREF,
  },
  {
    kind: "action",
    kindLabel: "Action",
    id: "add-patient",
    title: "Add patient",
    meta: "",
    href: WARD_ADD_PERSON_HREF,
  },
];

export const NEEDS_YOU_LIMIT = 3;
const RECENT_LIMIT = 4;

/*
 * ⚠️ RECENT RECORDS LIVE IN THIS MODULE'S MEMORY ONLY, NEVER IN BROWSER STORAGE. They last as long
 * as the current access lifetime does. Only kind and id are retained: every displayed row is
 * rebuilt from the current authorised collections, so a retained row never carries old details.
 */
type RecentRecord = Pick<SearchResultItem, "kind" | "id">;
let sessionRecents: readonly RecentRecord[] = [];
const NO_RECENTS: readonly RecentRecord[] = [];
let recentsLifetime: string | null = null;
const recentsListeners = new Set<() => void>();

/** A small store, so the React Compiler sees the list change as an input rather than a module read. */
function setSessionRecents(next: readonly RecentRecord[]) {
  sessionRecents = next;
  recentsListeners.forEach((listener) => listener());
}

function subscribeRecents(listener: () => void) {
  recentsListeners.add(listener);
  return () => {
    recentsListeners.delete(listener);
  };
}

// Recent records name patients, so a session ending forgets them (Codex review on PR #487).
onWardSessionEnd(clearGlobalSearchRecents);

const serverRecentsSnapshot = () => NO_RECENTS;

export function useSessionRecents(lifetime: string | null) {
  // The getter fails closed on the very first render; an effect alone would paint the old desk.
  const recents = useSyncExternalStore(
    subscribeRecents,
    () => (lifetime !== null && recentsLifetime === lifetime ? sessionRecents : NO_RECENTS),
    serverRecentsSnapshot,
  );
  useLayoutEffect(() => {
    if (recentsLifetime === lifetime) return;
    recentsLifetime = lifetime;
    setSessionRecents(NO_RECENTS);
  }, [lifetime]);
  return recents;
}

/** Kinds that are not records, so they never join Recent. */
const NOT_RECENT = new Set(["action", "help", "contact", "suburb"]);

export function rememberRecent(item: SearchResultItem, lifetime: string | null) {
  if (NOT_RECENT.has(item.kind) || lifetime === null || recentsLifetime !== lifetime) return;
  const { kind, id } = item;
  setSessionRecents(
    [{ kind, id }, ...sessionRecents.filter((recent) => recent.kind !== kind || recent.id !== id)].slice(
      0,
      RECENT_LIMIT,
    ),
  );
}

/** Test seam: recents are module memory, so a suite that asserts the start screen clears them first. */
function clearGlobalSearchRecents() {
  setSessionRecents(NO_RECENTS);
}

/** Whether the recents store belongs to this access lifetime (the fork's guard before it opens a row). */
export function isRecentsLifetime(lifetime: string | null): boolean {
  return recentsLifetime === lifetime;
}
