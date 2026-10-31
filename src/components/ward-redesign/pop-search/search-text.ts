/**
 * MOCK-UP COPY of draft PR #1123's `search/search-text.ts`, unchanged, because `main` does not have
 * it yet. The real build imports #1123's file once it merges and deletes this copy.
 *
 * SEARCH TEXT — the one way a search box compares what was typed with a record's fields
 * (search and forms review, 31 October 2026). Before this, most screens used a plain lower-case
 * `includes`, so "OQuinn" missed O'Quinn, "UM 100001" missed UM100001 and a number typed with
 * spaces missed the same number written without them.
 *
 * - Text folds as `findPatients` folds it (accents, apostrophes and hyphens dropped).
 * - Every typed word must occur somewhere in the record's fields, in any order.
 * - A word of digits also matches the fields' digits with spaces and punctuation ignored, so a
 *   phone number typed in groups finds it written another way, and "100001" finds "UM 100001".
 * - Near spellings (`fieldsNearlyMatch`) are for places, screens and contacts only. They are never
 *   used for a person or a record number: a near miss there is the classic wrong-patient error.
 *
 * Nothing here ranks or scores; callers keep their own order. Typed words are never stored.
 */
import { allowedSlips, editDistance } from "@/components/ward-management/help/ward-help-typo";
import { foldPatientSearchText } from "@/components/ward-management/ward-patients";

/** The typed text as folded words, in the order typed. */
export function queryWords(query: string): string[] {
  return foldPatientSearchText(query).split(" ").filter(Boolean);
}

/** Only the digits of `value`. */
function digitsOf(value: string): string {
  return value.replace(/\D+/g, "");
}

type Fields = readonly (string | null | undefined)[];

function folded(fields: Fields): { text: string[]; digits: string[] } {
  const text = fields.filter((field): field is string => Boolean(field)).map(foldPatientSearchText);
  return { text, digits: text.map(digitsOf).filter(Boolean) };
}

/** A typed number is matched as digits once it has three or more; "4" stays a plain word. */
function digitWord(word: string): string | null {
  const digits = digitsOf(word);
  return digits.length >= 3 && digits.length === word.replace(/[\s()+.-]/g, "").length ? digits : null;
}

/**
 * Groups typed digit runs into one number, so a phone number typed with spaces
 * is one word rather than three short ones that each match almost anything.
 */
function joinedWords(query: string): string[] {
  // "(08)" and "+61" are numbers too: a word of only digits and phone punctuation keeps its digits.
  const words = queryWords(query)
    .map((word) => (/^[\d()+.-]+$/.test(word) ? digitsOf(word) : word))
    .filter(Boolean);
  const joined: string[] = [];
  for (const word of words) {
    const last = joined.at(-1);
    if (last !== undefined && /^\d+$/.test(last) && /^\d+$/.test(word)) joined[joined.length - 1] = `${last}${word}`;
    else joined.push(word);
  }
  return joined;
}

/**
 * True when every typed word occurs in at least one of `fields`. `ignoreWords` are category words
 * ("ward", "team") that only choose a kind of record, so "Graylands ward" still finds Graylands.
 */
function fieldsMatchEveryWord(query: string, fields: Fields, ignoreWords: readonly string[] = []): boolean {
  const words = joinedWords(query).filter((word) => !ignoreWords.includes(word));
  if (words.length === 0) return false;
  const { text, digits } = folded(fields);
  return words.every((word) => {
    const number = digitWord(word);
    if (number !== null && digits.some((value) => value.includes(number))) return true;
    return text.some((value) => value.includes(word));
  });
}

/**
 * The forgiving second pass for places, screens and contacts: each typed word may be one or two
 * letters out from a word in the fields (none under four letters). Callers use it only when the
 * exact pass found nothing, and never for people or record numbers.
 */
function fieldsNearlyMatch(query: string, fields: Fields, ignoreWords: readonly string[] = []): boolean {
  const words = joinedWords(query).filter((word) => !ignoreWords.includes(word));
  if (words.length === 0) return false;
  const { text } = folded(fields);
  const fieldWords = text.flatMap((value) => value.split(/[^\p{L}\p{N}]+/u)).filter(Boolean);
  return words.every((word) => {
    if (text.some((value) => value.includes(word))) return true;
    const slips = allowedSlips(word);
    // Only plain words are forgiven: a digit or punctuation ("Beta,") is typed on purpose.
    if (slips === 0 || /[^\p{L}]/u.test(word)) return false;
    return fieldWords.some((candidate) => {
      if (candidate.length < 4) return false;
      // A typed word may be the start of a longer field word ("graylnd" for "graylands").
      const stem = candidate.length > word.length ? candidate.slice(0, word.length) : candidate;
      return editDistance(word, stem, slips) <= slips;
    });
  });
}

/**
 * Filters `items` by every typed word, falling back to near spellings only when `nearly` is set
 * and nothing matched exactly. The near pass is for places, screens and contacts.
 */
export function filterBySearchText<T>(
  items: readonly T[],
  query: string,
  fieldsOf: (item: T) => Fields,
  options: { readonly ignoreWords?: readonly string[]; readonly nearly?: boolean } = {},
): T[] {
  const exact = items.filter((item) => fieldsMatchEveryWord(query, fieldsOf(item), options.ignoreWords));
  if (exact.length > 0 || !options.nearly) return exact;
  return items.filter((item) => fieldsNearlyMatch(query, fieldsOf(item), options.ignoreWords));
}
