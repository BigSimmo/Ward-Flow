"use client";

/**
 * THE ONE PAGE SEARCH FIELD (D-91, "Every page search box has one look"). Draft PR #1123 found about
 * 18 hand-made page boxes, each with its own CSS, some with no clear button on a phone. This is the
 * one look the mock-ups use for every page's own search box, and the field pinned at the top of the
 * phone search sheet.
 *
 * - The kit's `TextInput`, at the kit's control height (36px on a laptop, 44px on a phone, never
 *   48px): magnifier, the typed words, and one clear button once something is typed.
 * - An optional "/" hint on a laptop while the box is empty, when the page binds "/" to it.
 * - An optional count line under it: "12 of 40 wards" while filtering, "40 wards" otherwise.
 * - `pinned`: on a phone the field (and its count) stays at the top while its list scrolls under it.
 * - The placeholder names only what is searched ("Name, UMRN or ward"), never "Search…".
 *
 * Typed words stay in memory only, like every search in Ward Flow.
 *
 * Example:
 *
 *     const [query, setQuery] = useState("");
 *     const shown = wards.filter((ward) => fieldsMatchEveryWord(query, [ward.name, ward.site]));
 *     <SearchField
 *       label="Find a ward"
 *       placeholder="Ward or hospital"
 *       value={query}
 *       onValueChange={setQuery}
 *       count={{ shown: shown.length, total: wards.length, noun: "wards" }}
 *       pinned
 *     />
 */
import { Search } from "lucide-react";
import { useRef, type ComponentPropsWithRef, type Ref } from "react";

import { Kbd, TextInput } from "@/components/wf";

import styles from "./search-field.module.css";

export type SearchFieldProps = Omit<
  ComponentPropsWithRef<"input">,
  "value" | "defaultValue" | "onChange" | "type" | "size" | "ref" | "aria-label"
> & {
  /** The typed words. */
  value: string;
  /** Called with the new words on typing and with "" on Clear. */
  onValueChange: (value: string) => void;
  /** The field's spoken name, for example "Find a ward". */
  label: string;
  /** The count line under the field; leave out for none. `noun` is plural ("wards"). */
  count?: { shown: number; total: number; noun?: string };
  /** On a phone, stays at the top of its scrolling list. */
  pinned?: boolean;
  /** Shows the "/" hint on a laptop while empty. Only when the page binds "/" to this field. */
  shortcut?: boolean;
  /** The input element, for a caller that moves focus or wires `aria-activedescendant`. */
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
};

/** The count line's words: "12 of 40 wards" while filtering, "40 wards" before. */
function searchCountText(count: NonNullable<SearchFieldProps["count"]>, filtering: boolean): string {
  const noun = count.noun ? ` ${count.noun}` : "";
  return filtering ? `${count.shown} of ${count.total}${noun}` : `${count.total}${noun}`;
}

export function SearchField({
  value,
  onValueChange,
  label,
  count,
  pinned = false,
  shortcut = false,
  inputRef,
  className,
  placeholder,
  id,
  "aria-describedby": describedBy,
  ...inputProps
}: SearchFieldProps) {
  // Clear hands the focus back to the field; found through the wrapper so the caller keeps `inputRef`.
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const countId = id ? `${id}-count` : undefined;
  const filtering = value.trim().length > 0;
  return (
    <div
      ref={wrapperRef}
      className={[styles.field, pinned ? styles.pinned : "", className ?? ""].filter(Boolean).join(" ")}
    >
      <TextInput
        {...inputProps}
        id={id}
        ref={inputRef}
        type="search"
        icon={Search}
        aria-label={label}
        aria-describedby={[describedBy, count && countId ? countId : ""].filter(Boolean).join(" ") || undefined}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onClear={() => {
          onValueChange("");
          wrapperRef.current?.querySelector("input")?.focus();
        }}
        trailing={shortcut && !filtering ? <Kbd className={styles.shortcut}>/</Kbd> : undefined}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        enterKeyHint="search"
        boxClassName={styles.box}
      />
      {count ? (
        <p id={countId} className={styles.count} aria-live="polite">
          {searchCountText(count, filtering)}
        </p>
      ) : null}
    </div>
  );
}
