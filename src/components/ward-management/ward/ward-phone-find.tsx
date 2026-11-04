"use client";

// Josh review (4 Nov 2026): on a phone the ward's find box is a search icon at the end of the Round
// heading, not a full-width field of its own. A tap opens the field in its place, focused; it folds
// back to the icon when it is left empty.

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button, TextInput } from "@/components/wf";

import styles from "./ward-phone-find.module.css";

export function WardPhoneFind({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [opened, setOpened] = useState(false);
  const open = opened || value !== "";
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (opened) inputRef.current?.focus();
  }, [opened]);
  return (
    <div className={styles.row} data-open={open ? "true" : undefined}>
      {open ? (
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
            setOpened(false);
          }}
          onBlur={() => {
            if (value === "") setOpened(false);
          }}
          data-testid="ward-find-input"
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          icon={Search}
          aria-label="Find a bed or person on this ward"
          onClick={() => setOpened(true)}
          data-testid="ward-find-open"
        />
      )}
    </div>
  );
}
