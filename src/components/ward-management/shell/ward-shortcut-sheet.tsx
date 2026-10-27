"use client";

import { Sheet } from "@/components/wf";
import { KEYBOARD_SHORTCUTS } from "@/components/ward-management/help/ward-help-content";
import styles from "./ward-shortcut-sheet.module.css";

/** The shell's keyboard shortcuts, read from the Help list so there is one source (P13). */
export default function WardShortcutSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet id="ward-shortcut-sheet" testId="ward-shortcut-sheet" open onClose={onClose} title="Keyboard shortcuts">
      <dl className={styles.keys} data-testid="ward-shortcut-list">
        {KEYBOARD_SHORTCUTS.map((item) => (
          <div key={item.keys} className={styles.key}>
            <dt>
              <kbd>{item.keys}</kbd>
            </dt>
            <dd>{item.action}</dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
}
