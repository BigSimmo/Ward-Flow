"use client";

import { Search } from "lucide-react";
import { useEffect, useRef } from "react";

import { TextInput } from "@/components/wf";

import styles from "./ward-phone-find.module.css";

/**
 * The ward's open find field (see `ward-phone-find.tsx`). Its own file so the kit text input loads
 * only once the search icon is pressed or the address already holds a search (phone script budget,
 * 28 Nov 2026). `focusOnOpen` focuses it as it appears after a press.
 */
export function WardPhoneFindField({
  value,
  onChange,
  onFold,
  focusOnOpen,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Clear, or leaving the field empty, folds it back to the icon; `refocus` asks for the icon's focus. */
  onFold: (refocus: boolean) => void;
  focusOnOpen: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Only as the field appears, as before the split.
  const focusFirst = useRef(focusOnOpen);
  useEffect(() => {
    if (focusFirst.current) inputRef.current?.focus();
  }, []);
  return (
    <TextInput
      ref={inputRef}
      type="search"
      icon={Search}
      boxClassName={styles.box}
      aria-label="Find a bed or person on this ward"
      placeholder="Find bed or person"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onClear={() => {
        onChange("");
        onFold(true);
      }}
      onBlur={() => {
        if (value === "") onFold(false);
      }}
      data-testid="ward-find-input"
    />
  );
}
