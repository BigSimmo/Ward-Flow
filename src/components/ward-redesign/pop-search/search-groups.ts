/**
 * MOCK-UP: the three groups draft PR #1123 adds to the header search (Suburb catchment, Contacts,
 * Help) and its order rule, laid over `main`'s `smartSearchGroups`. #1123 builds these inside
 * `ward-global-search-groups.ts` and `ward-smart-search.ts`; `main` has neither change yet, so this
 * adds them after the fact. The real build takes #1123's files and deletes this one.
 *
 * Order (D-91): people and records first, places, then forms, screens and tasks, then contacts, and
 * Help answers last, unless the query is a question (how, where, why, what), when Help leads. A
 * census answer ("over 24 hours") still leads, as it does in the real search.
 *
 * Never a typo match for a person or a UMRN (D-91 brief): `main`'s "Did you mean?" group of
 * near-spelled names is left out here. Near spellings stay for contacts only (#1123's rule).
 */
import { searchGroupOrder, type SmartSearchResults } from "@/components/ward-management/search/ward-smart-search";
import type { SearchResultGroup, SearchResultItem } from "@/components/ward-management/ward-global-search-groups";

import type { ContactSearchResult, SuburbSearchResult } from "@/components/ward-redesign/pop-search/search-directory";

/** The same question test as Help's `looksLikeHelpQuestion` and #1123's `leadingGroups`. */
export function isAppQuestion(query: string): boolean {
  return /^\s*(how|where|why|what)\b\s*\S/i.test(query);
}

function suburbGroup(suburbs: readonly SuburbSearchResult[]): SearchResultGroup {
  return {
    key: "suburbs",
    heading: "Suburb catchment",
    items: suburbs.map((result) => ({
      kind: "suburb",
      kindLabel: "Suburb",
      id: result.suburb.toLowerCase(),
      title: result.postcodes.length > 0 ? `${result.suburb} ${result.postcodes.join(", ")}` : result.suburb,
      // A contested or unreviewed suburb names no single clinic: the lookup's own status says why.
      meta:
        result.status === "Reviewed clinic match"
          ? `${result.clinic} · ${result.service}`
          : `${result.status} · check in the suburb lookup`,
      href: result.href,
    })),
  };
}

function contactGroup(contacts: readonly ContactSearchResult[]): SearchResultGroup {
  return {
    key: "contacts",
    heading: "Contacts",
    items: contacts.map((contact) => ({
      kind: "contact",
      kindLabel: "Contact",
      id: contact.entry.id,
      title: contact.entry.name,
      meta: [contact.number, contact.entry.place].filter(Boolean).join(" · "),
      href: contact.href,
    })),
  };
}

/**
 * `main`'s groups (already in its intent order) with #1123's three groups added and the whole list
 * put in #1123's order. `groups` may start with the census answer, which keeps its lead.
 */
export function withReferenceGroups(
  groups: readonly SearchResultGroup[],
  smartResults: SmartSearchResults,
  trimmed: string,
  reference: { contacts: readonly ContactSearchResult[]; suburbs: readonly SuburbSearchResult[] },
  help: readonly SearchResultItem[],
): SearchResultGroup[] {
  const answer = groups[0]?.key === "answers" ? groups[0] : undefined;
  const rest = groups.filter((group) => group !== answer && group.key !== "similar");
  if (reference.suburbs.length > 0) rest.push(suburbGroup(reference.suburbs));
  if (reference.contacts.length > 0) rest.push(contactGroup(reference.contacts));
  if (help.length > 0) rest.push({ key: "help", heading: "Help", items: [...help] });

  const base: string[] = [...searchGroupOrder(smartResults.intent, trimmed)];
  base.splice(base.indexOf("teams") + 1, 0, "suburbs");
  base.splice(base.indexOf("tasks") + 1, 0, "contacts");
  const order = isAppQuestion(trimmed) ? ["help", ...base] : [...base, "help"];
  const position = new Map(order.map((key, index) => [key, index]));
  rest.sort((left, right) => (position.get(left.key) ?? order.length) - (position.get(right.key) ?? order.length));
  return answer ? [answer, ...rest] : rest;
}
