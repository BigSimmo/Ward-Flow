"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { Sheet } from "@/components/wf/sheet";

import { KEYBOARD_SHORTCUTS } from "./ward-help-content";
import { openWardHelp } from "./ward-help-events";

/** PROPOSED WORDING (P120): awaiting Josh's approval of the exact words. */
export const SHORTCUTS_SHEET_TITLE = "Keyboard shortcuts";
export const SHORTCUTS_SHEET_HINT = "Press ? on any screen to see these again.";
export const SHORTCUTS_SHEET_HELP_BUTTON = "More in Help";

/** The keyboard shortcuts sheet "?" opens on any screen (P120). Lists the same keys as Help. */
export function WardShortcutsSheet({ onClose }: { onClose: () => void }) {
  // The list scrolls on short screens: it takes keyboard focus and borrows the sheet title as its name.
  const listRef = useRef<HTMLDivElement>(null);
  const [titleId, setTitleId] = useState<string | undefined>(undefined);
  useLayoutEffect(() => {
    setTitleId(listRef.current?.closest("[aria-labelledby]")?.getAttribute("aria-labelledby") ?? undefined);
  }, []);
  return (
    <Sheet
      open
      onClose={onClose}
      title={SHORTCUTS_SHEET_TITLE}
      description={SHORTCUTS_SHEET_HINT}
      testId="ward-shortcuts-sheet"
      footer={
        <button
          type="button"
          onClick={() => {
            onClose();
            openWardHelp("screen");
          }}
          data-testid="ward-shortcuts-help"
        >
          {SHORTCUTS_SHEET_HELP_BUTTON}
        </button>
      }
    >
      <div ref={listRef} role="region" aria-labelledby={titleId} tabIndex={0} data-testid="ward-shortcuts-scroll">
        <dl data-testid="ward-shortcuts-list">
          {KEYBOARD_SHORTCUTS.map((item) => (
            <div key={item.keys}>
              <dt>
                <kbd>{item.keys}</kbd>
              </dt>
              <dd>{item.action}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Sheet>
  );
}
