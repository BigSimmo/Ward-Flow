/**
 * MOCK-UP: two small pieces of the redesigned header search.
 *
 * - `ResultIcon`: `main`'s row icons plus the three #1123 adds (Contacts, Suburb, Help), copied
 *   from #1123's `ward-global-search-icon.tsx`.
 * - `Marked`: the matched words marked in a row (D-91: "matched words highlighted"), folded as the
 *   search folds them. The mark is a quiet accent tint, never a yellow highlighter (`.mark`).
 */
import { Fragment, type ReactNode } from "react";
import { CircleHelp, MapPin, PhoneCall } from "lucide-react";

import styles from "@/components/ward-management/ward-global-search.module.css";
import { SearchResultIcon } from "@/components/ward-management/ward-global-search-icon";
import local from "@/components/ward-redesign/pop-search/search.module.css";
import { queryWords } from "@/components/ward-redesign/pop-search/search-text";

export function ResultIcon({ kind, id }: { kind: string; id: string }) {
  switch (kind) {
    case "contact":
      return <PhoneCall className={styles.itemIcon} aria-hidden="true" />;
    case "suburb":
      return <MapPin className={styles.itemIcon} aria-hidden="true" />;
    case "help":
      return <CircleHelp className={styles.itemIcon} aria-hidden="true" />;
    default:
      return <SearchResultIcon kind={kind} id={id} />;
  }
}

/** Accents and apostrophes fold away, as `foldPatientSearchText` folds them. */
function fold(character: string): string {
  return character.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** A question's own little words ("how do I…") are not marked; only the words it is about. */
const QUESTION_WORDS = new Set([
  "how",
  "do",
  "does",
  "where",
  "why",
  "what",
  "when",
  "who",
  "is",
  "are",
  "the",
  "to",
  "an",
  "of",
  "in",
  "on",
  "can",
  "my",
]);

/**
 * `text` with every typed word of two letters or more marked. Matching runs on a folded copy, so
 * "oquinn" marks "O'Quinn" and "jose" marks "José"; the marked letters are the original ones.
 */
export function Marked({ text, query }: { text: string; query: string }): ReactNode {
  const words = queryWords(query)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((word) => word.length > 1 && !QUESTION_WORDS.has(word));
  if (words.length === 0 || text.length === 0) return text;
  // A folded copy, with a map from each folded letter back to its place in `text`. Apostrophes,
  // hyphens and spaces inside a word are skipped, as the search skips them.
  let folded = "";
  const from: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (/['’-]/u.test(character)) continue;
    for (const letter of fold(character)) {
      folded += letter;
      from.push(index);
    }
  }
  const marked = new Array<boolean>(text.length).fill(false);
  for (const word of words) {
    for (let at = folded.indexOf(word); at >= 0; at = folded.indexOf(word, at + word.length)) {
      for (let offset = 0; offset < word.length; offset += 1) marked[from[at + offset]!] = true;
    }
  }
  // Characters skipped by the fold (an apostrophe inside a marked name) join the mark around them.
  for (let index = 1; index < text.length - 1; index += 1) {
    if (!marked[index] && marked[index - 1] && marked[index + 1]) marked[index] = true;
  }
  const parts: ReactNode[] = [];
  let start = 0;
  for (let index = 1; index <= text.length; index += 1) {
    if (index < text.length && marked[index] === marked[start]) continue;
    const piece = text.slice(start, index);
    parts.push(
      marked[start] ? (
        <mark key={start} className={local.mark}>
          {piece}
        </mark>
      ) : (
        <Fragment key={start}>{piece}</Fragment>
      ),
    );
    start = index;
  }
  return parts;
}
