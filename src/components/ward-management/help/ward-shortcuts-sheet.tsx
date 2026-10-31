"use client";

import { Sheet } from "@/components/wf/sheet";

import { SHORTCUT_GROUPS, shortcutsForDesk } from "./ward-help-content";
import { openWardHelp } from "./ward-help-events";
import { useTourRole } from "./ward-help-store";
import styles from "./ward-shortcuts-sheet.module.css";

/** PROPOSED WORDING (P120): awaiting Josh's approval of the exact words. */
export const SHORTCUTS_SHEET_TITLE = "Keyboard shortcuts";
export const SHORTCUTS_SHEET_HELP_BUTTON = "More in Help";

/**
 * The keyboard shortcuts sheet "?" opens on any screen (P120), and Help's Keyboard shortcuts button.
 * Lists the same keys as Help, in three columns (Find, Open, Move around), each key drawn beside a
 * short label, with Help's full sentence kept as the spoken description and the hover title; the
 * columns stack on a narrow window (redesign, #1118). Only the keys this login can use are listed
 * (audit finding 11, Josh 31 Oct 2026): no New referral for a desk that cannot refer.
 */
export function WardShortcutsSheet({ onClose }: { onClose: () => void }) {
  const keys = shortcutsForDesk(useTourRole());
  return (
    <Sheet
      open
      onClose={onClose}
      title={SHORTCUTS_SHEET_TITLE}
      // Round 2 (#1118): no "Press ? to see these again" line; ? is listed under Open.
      testId="ward-shortcuts-sheet"
      contentClassName={styles.sheet}
      // The list scrolls on short screens: the body takes keyboard focus and is named by the title.
      bodyTabIndex={0}
      bodyLabel={SHORTCUTS_SHEET_TITLE}
      footer={
        <button
          type="button"
          className={styles.more}
          onClick={() => {
            onClose();
            openWardHelp("tasks");
          }}
          data-testid="ward-shortcuts-help"
        >
          {SHORTCUTS_SHEET_HELP_BUTTON}
        </button>
      }
    >
      <div className={styles.columns} data-testid="ward-shortcuts-list">
        {SHORTCUT_GROUPS.filter((group) => keys.some((item) => item.group === group)).map((group, groupIndex) => (
          <section key={group} className={styles.column} aria-labelledby={`ward-shortcuts-group-${groupIndex}`}>
            <h3 id={`ward-shortcuts-group-${groupIndex}`} className={styles.heading}>
              {group}
            </h3>
            <dl className={styles.list}>
              {keys
                .filter((item) => item.group === group)
                .map((item) => (
                  <div key={item.keys} className={styles.row}>
                    <dt>
                      <kbd className={styles.key}>{item.keys}</kbd>
                    </dt>
                    <dd title={item.action}>
                      {item.short}
                      <span className="sr-only">. {item.action}</span>
                    </dd>
                  </div>
                ))}
            </dl>
          </section>
        ))}
      </div>
    </Sheet>
  );
}
