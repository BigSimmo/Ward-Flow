"use client";

/**
 * MOCK-UP for Josh's approval (D-74): one look and one placement for every page's own search box,
 * built on the kit's `TextInput`. Today about 18 page boxes are hand-made labels around raw inputs,
 * each with its own CSS; some have no clear button on a phone and two draw their own magnifier.
 *
 * The proposal: the kit field with its magnifier and clear button, the "/" hint on a computer, a
 * placeholder that names only what is searched, and one count line under it ("4 of 23 wards"). It
 * sits just above the list it narrows, full width and pinned on a phone.
 */
import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Kbd, TextInput, useIsPhone } from "@/components/wf";
import { fieldsMatchEveryWord } from "@/components/ward-management/search/search-text";

import styles from "./search-redesign.module.css";

export function PageSearchField<T>({
  items,
  fieldsOf,
  label,
  placeholder,
  noun,
  render,
}: {
  items: readonly T[];
  fieldsOf: (item: T) => readonly (string | undefined)[];
  label: string;
  placeholder: string;
  /** Plural noun for the count line, for example "wards". */
  noun: string;
  render: (item: T) => React.ReactNode;
}) {
  const isPhone = useIsPhone();
  const [query, setQuery] = useState("");
  const shown = useMemo(
    () => (query.trim() ? items.filter((item) => fieldsMatchEveryWord(query, fieldsOf(item))) : items),
    [items, query, fieldsOf],
  );
  return (
    <div className={styles.pageSearch}>
      <div className={styles.pageSearchBar}>
        <TextInput
          type="search"
          icon={Search}
          aria-label={label}
          placeholder={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
          trailing={query || isPhone ? undefined : <Kbd>/</Kbd>}
          autoComplete="off"
          enterKeyHint="search"
        />
        <p className={styles.pageSearchCount} role="status">
          {query.trim() ? `${shown.length} of ${items.length} ${noun}` : `${items.length} ${noun}`}
        </p>
      </div>
      <ul className={styles.pageSearchList}>{shown.slice(0, 8).map(render)}</ul>
    </div>
  );
}
