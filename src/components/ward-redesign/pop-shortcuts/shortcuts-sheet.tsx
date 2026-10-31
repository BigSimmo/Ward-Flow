"use client";

import { Sheet } from "@/components/wf/sheet";

import { KEYBOARD_SHORTCUTS } from "@/components/ward-management/help/ward-help-content";
import { openWardHelp } from "@/components/ward-management/help/ward-help-events";
import {
  SHORTCUTS_SHEET_HELP_BUTTON,
  SHORTCUTS_SHEET_TITLE,
} from "@/components/ward-management/help/ward-shortcuts-sheet";

import styles from "./shortcuts.module.css";

/** The columns the keys sort into (#1119's `SHORTCUT_GROUPS`). */
const GROUPS = ["Find", "Open", "Move around"] as const;
type Group = (typeof GROUPS)[number];

/**
 * #1119's two new fields on each key in `KEYBOARD_SHORTCUTS`: `short`, the few words the sheet shows
 * (Help's full sentence, `action`, stays the spoken description and the hover title), and `group`,
 * its column. The real build takes them from #1119's `ward-help-content.ts`.
 */
const FROM_1119: Readonly<Record<string, { short: string; group: Group }>> = {
  "/": { short: "Search", group: "Find" },
  "Ctrl+K": { short: "Search, even with shortcuts off (⌘K on a Mac)", group: "Find" },
  "Shift+T": { short: "Open Alerts or Tasks", group: "Open" },
  "Shift+A": { short: "Open Activity", group: "Open" },
  "Shift+R": { short: "New referral", group: "Open" },
  "[": { short: "Fold or open the side menu", group: "Move around" },
  Esc: { short: "Close, or step back", group: "Move around" },
  "?": { short: "Show shortcuts", group: "Open" },
};

/**
 * Final round (D-91): the notices' new key (draft PR #1124), listed with the rest. Not yet in the real
 * `KEYBOARD_SHORTCUTS`; the build adds it there with these words.
 */
const NOTICE_KEY = {
  keys: "Alt+N",
  action: "Jump to the newest notice. Option+N on a Mac.",
  short: "Jump to newest notice (⌥N on a Mac)",
  group: "Move around" as Group,
};

const SHORTCUTS: readonly { keys: string; action: string; short: string; group: Group }[] = [
  ...KEYBOARD_SHORTCUTS.map((item) => ({
    ...item,
    short: FROM_1119[item.keys]?.short ?? item.action,
    group: FROM_1119[item.keys]?.group ?? ("Move around" as Group),
  })),
  NOTICE_KEY,
];

/**
 * The keyboard shortcuts sheet mock-up, forked from `WardShortcutsSheet` (P120). Same title, hint,
 * keys and More in Help button; the keys sit in three columns, each beside what it does.
 */
export function ShortcutsSheet({ onClose, onHelp }: { onClose: () => void; onHelp?: () => void }) {
  return (
    <Sheet
      open
      onClose={onClose}
      // Mock-up: no "Press ? to see these again" line; the ? key is listed under Open.
      title={SHORTCUTS_SHEET_TITLE}
      testId="ward-shortcuts-sheet"
      contentClassName={styles.panel}
      // The strong scrim the other centred dialogs (`Dialog`) sit on, so the page behind dims.
      desktopBackdropClassName={styles.scrim}
      // The list scrolls on short screens: the body takes keyboard focus and is named by the title.
      bodyTabIndex={0}
      bodyLabel={SHORTCUTS_SHEET_TITLE}
      footer={
        <div className={styles.foot}>
          <button
            type="button"
            className={styles.helpButton}
            onClick={() => {
              onClose();
              // Inside the Help mock-up, More in Help opens the mock-up's Help; alone, the app's.
              if (onHelp) onHelp();
              else openWardHelp("screen");
            }}
            data-testid="ward-shortcuts-help"
          >
            {SHORTCUTS_SHEET_HELP_BUTTON}
          </button>
        </div>
      }
    >
      <div className={styles.columns} data-testid="ward-shortcuts-list">
        {GROUPS.map((group) => {
          const items = SHORTCUTS.filter((item) => item.group === group);
          return (
            <section key={group} className={styles.column} aria-labelledby={`ward-shortcuts-${group}`}>
              <h3 id={`ward-shortcuts-${group}`} className={styles.columnTitle}>
                {group}
              </h3>
              <dl className={styles.list}>
                {items.map((item) => (
                  <div key={item.keys} className={styles.item}>
                    <dt className={styles.keys}>
                      {/* Each key straight inside its term, so a touch screen still shows it
                          (globals.css hides a loose kbd on a coarse pointer). */}
                      {item.keys.split("+").flatMap((part, index) => [
                        ...(index > 0
                          ? [
                              <span key={`${part}-plus`} aria-hidden="true">
                                +
                              </span>,
                            ]
                          : []),
                        <kbd key={part} className={styles.kbd}>
                          {part}
                        </kbd>,
                      ])}
                    </dt>
                    <dd className={styles.action} title={item.action}>
                      {item.short}
                      <span className="sr-only">. {item.action}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>
    </Sheet>
  );
}
