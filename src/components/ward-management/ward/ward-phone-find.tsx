"use client";

// Josh review (4 Nov 2026): on a phone the ward's find box is a search icon at the end of the Round
// heading, not a full-width field of its own. A tap opens the field in its place, focused; it folds
// back to the icon when it is left empty.

import dynamic from "next/dynamic";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/wf";
import { withLoadRetry } from "@/components/ward-management/load-retry";
import { preloadWhenIdle } from "@/components/ward-management/preload-when-idle";

import styles from "./ward-phone-find.module.css";

// Phone script budget (28 Nov 2026): the field, with the kit text input, loads on its own and is
// fetched when the browser is idle. The server still draws it when the address holds a search.
const loadField = () => import("./ward-phone-find-field");
const WardPhoneFindField = dynamic(withLoadRetry(() => loadField().then((m) => m.WardPhoneFindField)));
preloadWhenIdle(loadField);

export function WardPhoneFind({
  value,
  onChange,
  iconClassName,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Audit four item 25: the tab row passes its own More ink, so the icon reads on the band. */
  iconClassName?: string;
}) {
  const [opened, setOpened] = useState(false);
  const open = opened || value !== "";
  const rowRef = useRef<HTMLDivElement>(null);
  const refocusOpener = useRef(false);
  // Clear folds the field away, so focus moves to the search icon that replaces it.
  useEffect(() => {
    if (!refocusOpener.current || open) return;
    refocusOpener.current = false;
    rowRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [open]);
  return (
    <div ref={rowRef} className={styles.row} data-open={open ? "true" : undefined}>
      {open ? (
        <WardPhoneFindField
          value={value}
          onChange={onChange}
          focusOnOpen={opened}
          onFold={(refocus) => {
            setOpened(false);
            if (refocus) refocusOpener.current = true;
          }}
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          icon={Search}
          // Review EH-4: the kit's icon-only button, drawn 40 px with a 48 x 48 px tap cover on a phone.
          iconOnly
          className={iconClassName}
          aria-label="Find a bed or person on this ward"
          onClick={() => setOpened(true)}
          data-testid="ward-find-open"
        />
      )}
    </div>
  );
}
