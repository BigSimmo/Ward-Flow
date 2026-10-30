"use client";

import { Sheet } from "@/components/wf/sheet";

import { KEYBOARD_SHORTCUTS } from "@/components/ward-management/help/ward-help-content";
import { openWardHelp } from "@/components/ward-management/help/ward-help-events";
import {
  SHORTCUTS_SHEET_HELP_BUTTON,
  SHORTCUTS_SHEET_HINT,
  SHORTCUTS_SHEET_TITLE,
} from "@/components/ward-management/help/ward-shortcuts-sheet";

import styles from "./shortcuts.module.css";

/**
 * Redesign: the keys sort into three columns. Every key still comes from `KEYBOARD_SHORTCUTS`, so
 * the list cannot drift from Help; a key not named here falls into Move around.
 */
const COLUMNS: readonly { title: string; keys: readonly string[] }[] = [
  { title: "Find", keys: ["/", "Ctrl+K"] },
  { title: "Open", keys: ["Shift+T", "Shift+A", "Shift+R", "?"] },
  { title: "Move around", keys: ["[", "Esc"] },
];

function columnOf(keys: string): string {
  return COLUMNS.find((column) => column.keys.includes(keys))?.title ?? "Move around";
}

/**
 * The keyboard shortcuts sheet mock-up, forked from `WardShortcutsSheet` (P120). Same title, hint,
 * keys and More in Help button; the keys sit in three columns, each beside what it does.
 */
export function ShortcutsSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet
      open
      onClose={onClose}
      title={SHORTCUTS_SHEET_TITLE}
      description={SHORTCUTS_SHEET_HINT}
      testId="ward-shortcuts-sheet"
      contentClassName={`${styles.panel} sm:max-w-5xl`}
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
              openWardHelp("screen");
            }}
            data-testid="ward-shortcuts-help"
          >
            {SHORTCUTS_SHEET_HELP_BUTTON}
          </button>
        </div>
      }
    >
      <div className={styles.columns} data-testid="ward-shortcuts-list">
        {COLUMNS.map((column) => {
          const items = KEYBOARD_SHORTCUTS.filter((item) => columnOf(item.keys) === column.title);
          if (items.length === 0) return null;
          return (
            <section key={column.title} className={styles.column} aria-label={column.title}>
              <h3 className={styles.columnTitle}>{column.title}</h3>
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
                    <dd className={styles.action}>{item.action}</dd>
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
