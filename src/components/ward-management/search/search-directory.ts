/**
 * The header search's reference lookups (search and forms review, 31 October 2026): on-call
 * contacts and "which team covers this suburb or postcode". Before this, staff had to know these
 * lived on the On-call page and in the Tools sheet. Both are reference data, never patient records.
 *
 * Contacts match every typed word, phone numbers ignore spaces, and a slip in a place or role name is
 * forgiven when nothing matched exactly. The suburb row reads the same catchment lookup as the Tools
 * sheet and never routes a contested or unreviewed suburb: it says so and opens the lookup instead.
 */
import {
  buildOnCallDirectory,
  numberAt,
  entrySearchFields,
  type DirectoryEntry,
} from "@/components/ward-management/on-call/on-call-directory";
import { resolveCatchmentQuery, type ResolvedCatchment } from "@/components/ward-management/tools/ward-catchment-query";
import { minuteOfDay } from "@/components/ward-management/ward-clock";

import { filterBySearchText } from "./search-text";

export type ContactSearchResult = {
  readonly entry: DirectoryEntry;
  /** The number to ring now: the answering line, else the next to open. */
  readonly number: string | null;
  readonly href: string;
};

export type SuburbSearchResult = {
  readonly suburb: string;
  readonly postcodes: readonly string[];
  /** "Reviewed clinic match", "Contested / split" or "Unreviewed", word for word from the lookup. */
  readonly status: ResolvedCatchment["status"];
  readonly clinic: string;
  readonly service: string;
  readonly href: string;
};

let directory: readonly DirectoryEntry[] | undefined;
function onCallDirectory(): readonly DirectoryEntry[] {
  directory ??= buildOnCallDirectory();
  return directory;
}

const CONTACT_WORDS = ["contact", "contacts", "phone", "number", "call", "ring", "oncall", "on", "page"];

/**
 * On-call contacts for a query of at least three characters. A single bare kind word ("contacts")
 * finds nothing here; the On-call screen row already answers it. `nearly` allows near spellings;
 * the header search turns it off once a person, movement or referral matched, so a patient's
 * name never pulls in a contact one letter away.
 */
export function searchContacts(
  query: string,
  now: number | undefined,
  entries: readonly DirectoryEntry[] = onCallDirectory(),
  nearly = true,
): ContactSearchResult[] {
  if (query.trim().length < 3) return [];
  // `now` is the board's clock in minutes; without it the first listed line is shown.
  const minute = now === undefined ? null : minuteOfDay(now);
  return filterBySearchText(entries, query, entrySearchFields, { ignoreWords: CONTACT_WORDS, nearly }).map((entry) => ({
    entry,
    number: minute === null ? (entry.lines[0]?.number ?? null) : numberAt(entry, minute),
    href: "/ward-flow/on-call",
  }));
}

/**
 * The catchment for a suburb name or a 4-digit postcode: only an exact suburb, an alias or a
 * postcode, never a part-word, so a person's name is not read as a place.
 */
export function searchSuburbs(query: string): SuburbSearchResult[] {
  const typed = query.trim();
  if (typed.length < 3 || (/\d/.test(typed) && !/^\d{4}$/.test(typed))) return [];
  const result = resolveCatchmentQuery(typed);
  if (result.type === "not-found" || result.type === "empty") return [];
  // A part-word ("Morl") reaches suburbs through the resolver's partial pass, which looks each one
  // up by its own name; only the typed suburb or alias itself, or a postcode, answers here.
  const exact =
    result.type === "postcode"
      ? result.results
      : result.results.filter((entry) => entry.rawLookup?.query.trim().toLowerCase() === typed.toLowerCase());
  return exact.map((entry) => ({
    suburb: entry.suburb,
    postcodes: entry.postcodes,
    status: entry.status,
    clinic: entry.communityClinic,
    service: entry.healthService.displayName,
    href: "/ward-flow/community",
  }));
}
